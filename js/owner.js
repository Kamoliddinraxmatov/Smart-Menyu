// "Smart Menyu Egasi": restoranlarga obuna (dostup) berish, planshetlarni tasdiqlash.
// Faqat egasi uchun. Kirish: birinchi marta maxfiy parol, keyin shu telefonda 4 xonali PIN.
//
// Ma'lumotlar (restoranlar ro'yxati, ularning kalitlari, to'lovlar) shu telefonda saqlanadi va
// shifrlangan zaxira nusxasi serverga yoziladi: boshqa telefonda parol bilan kirilsa, ro'yxat o'zi tiklanadi.
import { OWNER } from "./owner-key.js";
import { V2, DEFAULT_BROKER } from "./license.js";
import { createStore } from "./sync.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import { PLANS as TARIFFS, FEATURES, planOf } from "./plan.js";
import {
  passKey, open, seal, importSignKey, sign, importVerifyKey, verify, newEphemeral, wrapFor, genDataKey, importDataKey,
  prettyId, fingerprint, kvGet, kvSet, kvDel, b64, rand
} from "./crypto.js";
import { esc, money, modal, toast, confirmBox, fileToDataUrl, registerSW, saveFile, ADMIN_PASS_RULE, adminPassOk } from "./common.js";

const app = document.getElementById("app");
const DAY = 86400000;
const PLANS = [[1, "1 oy"], [3, "3 oy"], [6, "6 oy"], [12, "1 yil"]];
const enc = new TextEncoder();

let keys = null;        // { sign: CryptoKey, state: CryptoKey }
let ownerId = "";       // zaxira mavzusi uchun egasining kodi
let S = null;           // holat
let client = null;
let online = false;
const regs = Object.create(null); // kutilayotgan planshetlar: rid -> { id -> reg }
const RID_RE = /^[a-z0-9_-]{3,40}$/;
const DEV_RE = /^[0-9A-HJKMNP-TV-Z]{8}$/;
let verifyKey = null;
// Serverdagi xabar haqiqatan egasining imzosi bilanmi
async function signed(text) {
  try {
    const msg = JSON.parse(text);
    verifyKey = verifyKey || await importVerifyKey(OWNER.pub);
    return (await verify(verifyKey, msg.p, msg.s)) ? JSON.parse(msg.p) : null;
  } catch { return null; }
}
// Planshet yuborgan ochiq kalit to'g'ri va uning kodiga mos kelishi shart (aks holda boshqa odam o'z kalitini qo'yib, restoran kalitini olishi mumkin)
async function validReg(reg, id) {
  if (!reg || typeof reg !== "object" || reg.id !== id || !reg.pub || reg.pub.kty !== "EC" || reg.pub.crv !== "P-256") return false;
  try {
    await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: reg.pub.x, y: reg.pub.y }, { name: "ECDH", namedCurve: "P-256" }, true, []);
    return (await fingerprint(reg.pub)) === id;
  } catch { return false; }
}
const ui = { view: "list", rid: null, q: "", f: "all" };

// ---------- Holat ----------
const blank = () => ({ v: 1, updatedAt: 0, settings: { phone: "", broker: "" }, rests: {} });
const loadLocal = () => { try { return JSON.parse(localStorage.getItem("owner.state") || "null"); } catch { return null; } };
// Har restoran o'zgarganda o'z vaqt belgisini oladi: ikki telefondagi o'zgarishlar bir-birini o'chirmaydi
const snap = {};
const bare = (r) => { const { upd, ...x } = r; return JSON.stringify(x); };
function stamp() {
  const now = Date.now();
  for (const r of Object.values(S.rests)) {
    const j = bare(r);
    if (snap[r.rid] !== undefined && snap[r.rid] !== j) r.upd = now;
    if (!r.upd) r.upd = now;
    snap[r.rid] = j;
  }
  const sj = JSON.stringify(S.settings);
  if (snap._settings !== undefined && snap._settings !== sj) S.settingsUpd = now;
  snap._settings = sj;
}
function merge(local, remote) {
  const out = { ...local, rests: { ...local.rests }, gone: { ...(local.gone || {}), ...(remote.gone || {}) } };
  for (const [rid, rr] of Object.entries(remote.rests || {})) {
    const lr = out.rests[rid];
    if (!lr) { out.rests[rid] = rr; continue; }
    const [older, newer] = (rr.upd || 0) > (lr.upd || 0) ? [lr, rr] : [rr, lr];
    // Mahalliy obyektni o'rnida yangilaymiz: ochiq ekrandagi tugmalar shu obyekt bilan ishlaydi
    const joined = joinRest(older, newer);
    if (bare(joined) === bare(lr) && joined.upd === lr.upd) continue;
    for (const k of Object.keys(lr)) if (!(k in joined)) delete lr[k];
    Object.assign(lr, joined);
  }
  for (const [rid, t] of Object.entries(out.gone)) if (out.rests[rid] && (out.rests[rid].upd || 0) <= t) delete out.rests[rid];
  if ((remote.settingsUpd || 0) > (local.settingsUpd || 0)) { out.settings = remote.settings; out.settingsUpd = remote.settingsUpd; }
  return out;
}
// Ikki telefonda bir vaqtda qilingan o'zgarishlar: oddiy maydonlar yangisidan, planshetlar va to'lovlar ikkalasidan
function joinRest(older, newer) {
  const out = { ...newer };
  const rejected = { ...(older.rejected || {}) };
  for (const [id, t] of Object.entries(newer.rejected || {})) rejected[id] = Math.max(rejected[id] || 0, t);
  const devices = {};
  for (const src of [older.devices || {}, newer.devices || {}]) {
    for (const [id, d] of Object.entries(src)) {
      if ((rejected[id] || 0) >= (d.approvedAt || 0)) continue; // keyinroq o'chirilgan
      if (!devices[id] || (d.approvedAt || 0) > (devices[id].approvedAt || 0)) devices[id] = d;
    }
  }
  const pays = new Map();
  for (const p of [...(older.payments || []), ...(newer.payments || [])]) pays.set(`${p.at}:${p.months}:${p.amount}`, p);
  out.devices = devices;
  out.rejected = rejected;
  out.payments = [...pays.values()].sort((a, b) => a.at - b.at);
  if (!(newer.cutAt > (older.payments || []).reduce((m, p) => Math.max(m, p.at), 0))) out.until = Math.max(older.until || 0, newer.until || 0);
  out.licIssued = Math.max(older.licIssued || 0, newer.licIssued || 0);
  out.upd = Math.max(older.upd || 0, newer.upd || 0);
  return out;
}
function persist(remote = true) {
  stamp();
  S.updatedAt = Date.now();
  try { localStorage.setItem("owner.state", JSON.stringify(S)); } catch {}
  if (remote) backup();
}
async function backup() {
  if (!client || !keys) return;
  const topic = `${V2}/_owner/${ownerId}/state`;
  client.publish(topic, await seal(keys.state, JSON.stringify(S), topic), { qos: 1, retain: true });
}
const authOf = () => (S?.settings?.broker && S.settings.mqttUser ? { username: S.settings.mqttUser, password: S.settings.mqttPass || "" } : {});
const brokerOf = () => {
  const q = new URLSearchParams(location.search).get("broker");
  return q || S?.settings?.broker || DEFAULT_BROKER;
};

// ---------- Kirish ----------
async function start() {
  try { keys = await kvGet("owner.keys"); } catch { keys = null; }
  // Zaxira mavzusi paroldan olinadi: ochiq kalitni biladigan begona odam uni topa olmaydi
  if (keys?.sign && !keys.bid) { try { await kvDel("owner.keys"); } catch {} keys = null; }
  ownerId = keys?.bid || "";
  if (!keys?.sign) return passwordScreen();
  const pin = localStorage.getItem("owner.pin");
  if (pin) return pinScreen(pin);
  boot();
}

function shell(html) {
  app.innerHTML = `<div class="ow-gate"><div class="ow-gate-card"><div class="ow-brand"><img src="img/icon.svg" alt=""><div><b>Smart Menyu</b><small>Egasi</small></div></div>${html}</div></div>`;
}

function passwordScreen(err = "") {
  shell(`
    <h1>Kirish</h1>
    <p>Smart Menyu egasining maxfiy parolini kiriting. Bu bir marta, shu telefonda kerak.</p>
    <label class="ow-field"><span>Parol</span><input id="pw" type="password" autocomplete="current-password" autocapitalize="characters" placeholder="SM-XXXX-XXXX-XXXX-XXXX"></label>
    ${err ? `<p class="ow-err">${err}</p>` : ""}
    <button class="ow-btn" id="go">Kirish</button>`);
  const go = async () => {
    const pw = app.querySelector("#pw").value.trim().toUpperCase().replace(/\s+/g, "");
    if (!pw) return;
    const b = app.querySelector("#go"); b.disabled = true; b.textContent = "Tekshirilmoqda...";
    try {
      const k = await passKey(pw, OWNER.salt, OWNER.iter);
      const jwk = JSON.parse(await open(k, OWNER.key, "owner-key"));
      const signKey = await importSignKey(jwk);
      const stateKey = await passKey(pw, b64(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`state:${OWNER.salt}`)))), 100000);
      const bid = b64(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`backup:${pw}:${OWNER.salt}`)))).replace(/[^A-Za-z0-9]/g, "").slice(0, 20).toLowerCase();
      keys = { sign: signKey, state: stateKey, bid };
      ownerId = bid;
      await kvSet("owner.keys", keys);
      pinSetup();
    } catch {
      passwordScreen("Parol noto'g'ri.");
    }
  };
  app.querySelector("#go").addEventListener("click", go);
  app.querySelector("#pw").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  app.querySelector("#pw").focus();
}

function pinPad(title, sub, onDone, err = "") {
  let v = "";
  shell(`
    <h1>${title}</h1><p>${sub}</p>
    <div class="ow-dots">${[0, 1, 2, 3].map((i) => `<i data-i="${i}"></i>`).join("")}</div>
    ${err ? `<p class="ow-err">${err}</p>` : ""}
    <div class="ow-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k) => `<button data-k="${k}" ${k === "" ? "disabled" : ""}>${k}</button>`).join("")}</div>`);
  const dots = () => app.querySelectorAll(".ow-dots i").forEach((d, i) => d.classList.toggle("on", i < v.length));
  app.querySelectorAll(".ow-pad [data-k]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.k;
    if (k === "⌫") v = v.slice(0, -1); else if (k !== "" && v.length < 4) v += k;
    dots();
    if (v.length === 4) setTimeout(() => onDone(v), 120);
  }));
}
function pinSetup() {
  pinPad("PIN kod o'rnating", "Keyingi safar ilova shu 4 xonali PIN bilan ochiladi.", (a) => {
    pinPad("PIN kodni takrorlang", "Xuddi shu 4 raqamni yana kiriting.", (b) => {
      if (a !== b) return pinPad("PIN kod o'rnating", "Keyingi safar ilova shu 4 xonali PIN bilan ochiladi.", () => pinSetup(), "PIN mos kelmadi, qaytadan.");
      localStorage.setItem("owner.pin", a);
      boot();
    });
  });
}
function pinScreen(pin, err = "") {
  pinPad("Xush kelibsiz", "PIN kodni kiriting.", (v) => {
    if (v === pin) boot();
    else pinScreen(pin, "PIN noto'g'ri.");
  }, err);
  const forgot = document.createElement("button");
  forgot.className = "ow-link"; forgot.textContent = "PIN esdan chiqdimi? Parol bilan kirish";
  forgot.addEventListener("click", async () => { await kvDel("owner.keys"); localStorage.removeItem("owner.pin"); passwordScreen(); });
  app.querySelector(".ow-gate-card").appendChild(forgot);
}

// ---------- Server bilan aloqa ----------
function connect() {
  client?.end(true);
  client = window.mqtt.connect(brokerOf(), { ...authOf(), clientId: `menyu_owner_${Math.random().toString(16).slice(2, 10)}`, clean: true, keepalive: 30, reconnectPeriod: 2000 });
  client.on("connect", () => {
    online = true;
    client.subscribe([`${V2}/_owner/${ownerId}/state`, `${V2}/+/reg/+`, `${V2}/+/lic`], { qos: 1 });
    render();
  });
  client.on("close", () => { if (online) { online = false; render(); } });
  let inbox = Promise.resolve();
  client.on("message", (topic, payload) => { inbox = inbox.then(() => onMessage(topic, payload.toString())).catch((e) => console.warn(e)); });
}

const issuedSeen = {};
async function onMessage(topic, text) {
  if (topic === `${V2}/_owner/${ownerId}/state`) {
    if (!text) return;
    let remote;
    try { remote = JSON.parse(await open(keys.state, text, topic)); } catch { return; }
    stamp();
    const beforeRests = JSON.stringify(S.rests), beforeSettings = JSON.stringify(S.settings);
    const beforeEach = {};
    for (const r of Object.values(S.rests)) beforeEach[r.rid] = bare(r);
    const merged = merge(S, remote);
    const changedLocal = JSON.stringify(merged.rests) !== beforeRests || JSON.stringify(merged.settings) !== beforeSettings;
    const changedRemote = JSON.stringify(merged.rests) !== JSON.stringify(remote.rests || {}) || JSON.stringify(merged.settings) !== JSON.stringify(remote.settings);
    S = merged;
    // Ikkala tomondan yig'ilgan restoran: ruxsatnomani ham yangilaymiz
    for (const r of Object.values(S.rests)) {
      const l = beforeEach[r.rid], m = remote.rests?.[r.rid];
      if (l && m && bare(r) !== l && bare(r) !== bare(m)) publishLicense(r, false).catch((e) => console.warn(e));
    }
    for (const r of Object.values(S.rests)) snap[r.rid] = bare(r);
    snap._settings = JSON.stringify(S.settings);
    if (changedLocal) { try { localStorage.setItem("owner.state", JSON.stringify(S)); } catch {} render(); }
    if (changedRemote) backup();
    return;
  }
  const parts = topic.split("/");
  const rid = parts[2];
  if (!RID_RE.test(rid || "") || rid in Object.prototype) return;
  if (parts[3] === "reg") {
    const id = parts[4];
    if (!DEV_RE.test(id || "")) return;
    let reg = null;
    try { reg = text ? JSON.parse(text) : null; } catch { return; }
    const list = regs[rid] || (regs[rid] = Object.create(null));
    if (reg && await validReg(reg, id)) list[id] = { id, pub: { kty: "EC", crv: "P-256", x: reg.pub.x, y: reg.pub.y }, name: String(reg.name || "").slice(0, 40), ua: String(reg.ua || "").slice(0, 160), at: Number(reg.at) || 0 };
    else delete list[id];
    render();
    return;
  }
  if (parts[3] === "lic") {
    // Serverdagi ruxsatnoma biznikidan farq qilsa (o'chirilgan yoki eskisi qayta yuborilgan), qayta yozamiz
    const r = S.rests[rid];
    if (!r || !r.licIssued) return;
    const lic = text ? await signed(text) : null;
    issuedSeen[rid] = lic?.rid === rid ? lic.issued : 0;
    if (issuedSeen[rid] === r.licIssued || healTimer[rid]) return;
    healTimer[rid] = setTimeout(() => {
      delete healTimer[rid];
      const cur = S.rests[rid];
      if (cur && issuedSeen[rid] !== cur.licIssued) publishLicense(cur, false).catch((e) => console.warn(e));
    }, 3000);
  }
}
const healTimer = {};

// Ruxsatnomani imzolab yuborish
async function publishLicense(r, save = true) {
  const eph = await newEphemeral();
  const dev = {};
  for (const [id, d] of Object.entries(r.devices || {})) {
    try { dev[id] = await wrapFor(eph.priv, d.pub, r.key, `${r.rid}/${id}`); } catch (e) { console.warn("planshet kaliti noto'g'ri:", id, e); }
  }
  const issued = Math.max(Date.now(), (r.licIssued || 0) + 1);
  const lic = {
    v: 1, rid: r.rid, name: r.name, until: r.until || 0, issued, blocked: !!r.blocked,
    phone: S.settings.phone || "", eph: eph.pub, dev, max: r.max || 5
  };
  if (planOf(r.plan)) lic.plan = r.plan;
  if (S.settings.broker) {
    lic.broker = S.settings.broker;
    if (S.settings.mqttUser) lic.mqtt = { user: S.settings.mqttUser, pass: S.settings.mqttPass || "" };
  }
  const p = JSON.stringify(lic);
  const msg = JSON.stringify({ p, s: await sign(keys.sign, p) });
  r.licIssued = issued;
  if (save) persist();
  client?.publish(`${V2}/${r.rid}/lic`, msg, { qos: 1, retain: true });
}

// Yangi planshetlar egasining serverini topishi uchun umumiy serverga imzolangan "ko'rsatkich"
async function publishPointer() {
  const ptr = { broker: S.settings.broker || "", mqtt: S.settings.broker && S.settings.mqttUser ? { user: S.settings.mqttUser, pass: S.settings.mqttPass || "" } : null, issued: Date.now() };
  const p = JSON.stringify(ptr);
  const msg = JSON.stringify({ p, s: await sign(keys.sign, p) });
  const c = window.mqtt.connect(DEFAULT_BROKER, { clientId: `menyu_ownptr_${Math.random().toString(16).slice(2, 8)}`, clean: true, reconnectPeriod: 0, connectTimeout: 8000 });
  c.on("connect", () => c.publish(`${V2}/_server`, ptr.broker ? msg : "", { qos: 1, retain: true }, () => c.end()));
  c.on("error", () => c.end(true));
}

// Server almashganda: restoranlarning (shifrlangan) menyu, buyurtma va hisobotlarini eski serverdan yangisiga ko'chirish
function moveData(from) {
  return new Promise((resolve) => {
    const got = [];
    const c = window.mqtt.connect(from.url, { ...from.opts, clientId: `menyu_move_${Math.random().toString(16).slice(2, 8)}`, reconnectPeriod: 0, connectTimeout: 8000 });
    const finish = () => {
      try { c.end(true); } catch {}
      const rids = new Set(Object.keys(S.rests));
      for (const [t, p] of got) {
        const parts = t.split("/");
        if (!rids.has(parts[2]) || !["config", "stop", "orders", "calls", "reserves", "sales"].includes(parts[3]) || parts.length > 6) continue;
        client.publish(t, p, { qos: 1, retain: true });
      }
      toast(`Ma'lumotlar yangi serverga ko'chirildi`, { kind: "ok" });
      resolve();
    };
    const t = setTimeout(finish, 8000);
    c.on("connect", () => c.subscribe(`${V2}/#`, { qos: 1 }, () => { clearTimeout(t); setTimeout(finish, 4000); }));
    c.on("message", (topic, payload, packet) => { if (packet.retain && payload.length) got.push([topic, payload]); });
    c.on("error", () => { clearTimeout(t); resolve(); });
  });
}

// Restoranning menyu va sozlamalarini (shifrlangan) yozish
async function withStore(r, fn) {
  const key = await importDataKey(r.key);
  const st = createStore(r.rid, { key, url: brokerOf(), auth: authOf() });
  await new Promise((res) => {
    const t = setTimeout(res, 5000);
    const off = st.on((e) => { if (e.type === "online") setTimeout(() => { clearTimeout(t); off(); res(); }, 1500); });
  });
  const out = await fn(st);
  await st.flush();
  setTimeout(() => st.close(), 1500);
  return out;
}

// ---------- Yordamchilar ----------
const fmtDate = (ts) => { const d = new Date(ts); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; };
const daysLeft = (r) => Math.ceil(((r.until || 0) - Date.now()) / DAY);
function status(r) {
  if (r.blocked) return { k: "blocked", t: "To'xtatilgan" };
  const d = daysLeft(r);
  if (!r.until) return { k: "new", t: "To'lov kutilmoqda" };
  if (d <= 0) return { k: "expired", t: "Muddati tugagan" };
  if (d <= 7) return { k: "soon", t: `${d} kun qoldi` };
  return { k: "ok", t: `${d} kun qoldi` };
}
const pendingOf = (r) => Object.values(regs[r.rid] || {}).filter((g) => !r.devices?.[g.id] && !((r.rejected || {})[g.id] >= (g.at || 0)));
function addMonths(ts, m) { const d = new Date(ts); d.setMonth(d.getMonth() + m); return d.getTime(); }
function slug(s) {
  let x = s.toLowerCase().replace(/[ʻʼ‘’`']/g, "");
  const tr = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "s", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", қ: "q", ғ: "g", ў: "o", ҳ: "h" };
  x = x.split("").map((c) => tr[c] ?? c).join("");
  return x.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "restoran";
}
const code4 = () => Array.from(rand(4), (b) => "23456789abcdefghjkmnpqrstuvwxyz"[b % 31]).join("");

// ---------- Ekranlar ----------
function boot() {
  S = loadLocal() || blank();
  stamp();
  connect();
  if (S.settings.broker) setTimeout(publishPointer, 3000);
  render();
  registerSW();
  setInterval(() => { if (ui.view === "list") render(); }, 60000);
}

function render() {
  if (!S) return;
  // Ochiq oyna buzilmasin: yopilgach chizamiz
  if (document.querySelector(".modal-back")) { clearTimeout(render.t); render.t = setTimeout(render, 300); return; }
  if (ui.view === "rest" && S.rests[ui.rid]) return renderRest(S.rests[ui.rid]);
  if (ui.view === "settings") return renderSettings();
  ui.view = "list";
  renderList();
}

function top(title, back = false, right = "") {
  return `<header class="ow-top">
    ${back ? `<button class="ow-back" id="back">‹</button>` : `<div class="ow-brand sm"><img src="img/icon.svg" alt=""><div><b>Smart Menyu</b><small>Egasi</small></div></div>`}
    ${title ? `<h2>${title}</h2>` : ""}
    <div class="ow-top-r"><span class="ow-conn ${online ? "on" : "off"}">${online ? "● Onlayn" : "● Aloqa yo'q"}</span>${right}</div>
  </header>`;
}

function renderList() {
  const all = Object.values(S.rests).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const counts = { all: all.length, ok: 0, soon: 0, expired: 0, wait: 0 };
  for (const r of all) {
    const k = status(r).k;
    if (k === "ok") counts.ok++;
    if (k === "soon") counts.soon++;
    if (k === "expired" || k === "new" || k === "blocked") counts.expired++;
    if (pendingOf(r).length) counts.wait++;
  }
  const q = ui.q.trim().toLowerCase();
  const list = all.filter((r) => {
    const k = status(r).k;
    if (ui.f === "ok" && k !== "ok") return false;
    if (ui.f === "soon" && k !== "soon") return false;
    if (ui.f === "expired" && !["expired", "new", "blocked"].includes(k)) return false;
    if (ui.f === "wait" && !pendingOf(r).length) return false;
    return !q || `${r.name} ${r.city || ""} ${r.rid} ${r.contact || ""} ${r.phone || ""}`.toLowerCase().includes(q);
  });
  app.innerHTML = `
    ${top("", false, `<button class="ow-icon" id="set" aria-label="Sozlamalar">⚙️</button>`)}
    <main class="ow-main">
      <section class="ow-stats">
        ${[["all", "Restoranlar", counts.all], ["ok", "Faol", counts.ok], ["soon", "Tugayapti", counts.soon], ["expired", "To'lanmagan", counts.expired], ["wait", "Yangi planshet", counts.wait]]
          .map(([k, t, n]) => `<button class="ow-stat s-${k} ${ui.f === k ? "on" : ""}" data-f="${k}"><b>${n}</b><span>${t}</span></button>`).join("")}
      </section>
      ${(() => {
        const ap = allPending();
        return ap.length ? `<section class="ow-sec ow-new">
          <h3>📲 Tasdiq kutayotgan planshetlar <small>${ap.length} ta</small></h3>
          ${ap.map(([r, g]) => `<button class="ow-req ow-req-link" data-rid="${esc(r.rid)}">${reqRows(r, g)}<span class="ow-req-go">Ochish va tasdiqlash →</span></button>`).join("")}
        </section>` : "";
      })()}
      <div class="ow-search"><input id="q" type="search" placeholder="🔍 Restoran nomi, shahar yoki kod" value="${esc(ui.q)}"></div>
      <section class="ow-list">
        ${list.map((r) => {
          const st = status(r), pend = pendingOf(r).length;
          return `<button class="ow-card" data-rid="${esc(r.rid)}">
            <div class="ow-card-l"><b>${esc(r.name)}</b><small>${esc([planOf(r.plan)?.name, r.city, r.rid].filter(Boolean).join(" · "))}</small></div>
            <div class="ow-card-r">${pend ? `<span class="ow-pend">📲 ${pend} yangi planshet</span>` : ""}<span class="ow-pill p-${st.k}">${st.t}</span></div>
          </button>`;
        }).join("") || `<div class="ow-empty">${all.length ? "Hech narsa topilmadi" : "Hali restoran yo'q. Birinchi restoranni qo'shing."}</div>`}
      </section>
    </main>
    <button class="ow-fab" id="add">+ Yangi restoran</button>`;
  app.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { ui.f = ui.f === b.dataset.f ? "all" : b.dataset.f; render(); }));
  app.querySelectorAll("[data-rid]").forEach((b) => b.addEventListener("click", () => { ui.view = "rest"; ui.rid = b.dataset.rid; render(); window.scrollTo(0, 0); }));
  const qi = app.querySelector("#q");
  qi.addEventListener("input", () => { ui.q = qi.value; const pos = qi.selectionStart; render(); const n = app.querySelector("#q"); n.focus(); n.setSelectionRange(pos, pos); });
  app.querySelector("#add").addEventListener("click", addRestaurant);
  app.querySelector("#set").addEventListener("click", () => { ui.view = "settings"; render(); });
}

function infoForm(r = {}) {
  return `
    <label class="field"><span>Restoran nomi</span><input id="fName" value="${esc(r.name || "")}" placeholder="Masalan: Rayhon"></label>
    ${r.rid ? "" : `<label class="field"><span>Tarif</span><select id="fPlan">${TARIFFS.map((t) => `<option value="${t.id}" ${t.id === "standart" ? "selected" : ""}>${t.name} · ${t.tablets} planshet · ${money(t.price)}</option>`).join("")}</select></label>`}
    <div class="row2">
      <label class="field"><span>Shahar / viloyat</span><input id="fCity" value="${esc(r.city || "")}" placeholder="Masalan: Samarqand"></label>
      <label class="field"><span>Planshetlar soni (chegara)</span><input id="fMax" type="number" min="1" max="50" value="${esc(r.max || (r.rid ? 5 : planOf("standart").tablets))}"></label>
    </div>
    <div class="row2">
      <label class="field"><span>Mas'ul shaxs</span><input id="fContact" value="${esc(r.contact || "")}" placeholder="Ism familiya"></label>
      <label class="field"><span>Telefon</span><input id="fPhone" type="tel" value="${esc(r.phone || "")}" placeholder="+998 90 123 45 67"></label>
    </div>
    <label class="field"><span>Izoh</span><input id="fNote" value="${esc(r.note || "")}" placeholder="Masalan: manzil, to'lov kuni"></label>`;
}
const readInfo = (m) => ({
  name: m.querySelector("#fName").value.trim(), city: m.querySelector("#fCity").value.trim(), contact: m.querySelector("#fContact").value.trim(),
  phone: m.querySelector("#fPhone").value.trim(), note: m.querySelector("#fNote").value.trim(), max: Math.max(1, Math.min(50, Number(m.querySelector("#fMax").value) || 5))
});

function addRestaurant() {
  modal(`
    <div class="modal-head"><h3>Yangi restoran</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      ${infoForm()}
      <details class="ow-old"><summary>Restoran avval eski kod bilan ishlaganmi?</summary>
        <label class="field"><span>Eski restoran kodi (menyusi ko'chiriladi)</span><input id="fOld" autocapitalize="none" placeholder="masalan: rayhon-4k2m"></label>
      </details>
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" data-close>Bekor qilish</button><button class="btn btn-primary" id="ok">Yaratish</button></div>`, {
    onMount(m, close) {
      m.querySelector("#fPlan").addEventListener("change", (e) => { m.querySelector("#fMax").value = planOf(e.target.value).tablets; });
      m.querySelector("#ok").addEventListener("click", async (e) => {
        const info = readInfo(m);
        if (!info.name) return toast("Restoran nomini kiriting", { kind: "error" });
        const old = m.querySelector("#fOld").value.trim().toLowerCase();
        if (old && !/^[a-z0-9_-]{3,40}$/.test(old)) return toast("Eski kod noto'g'ri", { kind: "error" });
        const rid = old || `${slug(info.name)}-${code4()}`;
        if (S.rests[rid]) return toast("Bu kod bilan restoran allaqachon bor", { kind: "error" });
        e.currentTarget.disabled = true; e.currentTarget.textContent = "Yaratilmoqda...";
        const plan = m.querySelector("#fPlan").value;
        const r = { rid, ...info, plan, createdAt: Date.now(), until: 0, blocked: false, key: await genDataKey(), devices: {}, payments: [] };
        try {
          let config = null;
          if (old) config = await readOldConfig(old);
          if (!config) {
            config = structuredClone(DEFAULT_CONFIG);
            config.adminPin = "";
          }
          config.restaurant = old
            ? { ...config.restaurant, name: info.name }
            : { ...config.restaurant, name: info.name, logo: "", slogan: "", phone: info.phone };
          await withStore(r, (st) => st.saveConfig(config));
        } catch (err) {
          console.warn(err);
          toast("Server bilan aloqa yo'q. Internetni tekshiring.", { kind: "error" });
          e.currentTarget.disabled = false; e.currentTarget.textContent = "Yaratish";
          return;
        }
        S.rests[rid] = r;
        persist();
        await publishLicense(r);
        close();
        ui.view = "rest"; ui.rid = rid; render();
        toast(`Restoran yaratildi. Kodi: <b>${esc(rid)}</b>`, { kind: "ok", timeout: 6000 });
      });
    }
  });
}

// Eski (shifrlanmagan) restoranning menyusini o'qish
function readOldConfig(code) {
  return new Promise((res) => {
    const st = createStore(code, { url: new URLSearchParams(location.search).get("broker") || DEFAULT_BROKER, auth: {} });
    let done = false;
    const finish = (v) => { if (done) return; done = true; setTimeout(() => st.close(), 300); res(v); };
    st.on((e) => {
      if (e.type !== "config" || done) return;
      const cfg = structuredClone(st.state.config);
      // Eski ochiq nusxani (PIN kodlar bilan) umumiy serverdan o'chiramiz: endi faqat shifrlangani qoladi
      st.client.publish(`menyuuz/v1/${code}/config`, "", { qos: 1, retain: true });
      finish(cfg);
    });
    setTimeout(() => finish(null), 6000);
  });
}

// Kutilayotgan planshet haqida to'liq ma'lumot: qaysi restoran, qaysi planshet
const fmtTime = (ts) => { const d = new Date(ts); return `${fmtDate(ts)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
function reqRows(r, g) {
  const rows = [
    ["Restoran", `<b>${esc(r.name)}</b>`],
    ["Restoran kodi", `<span class="ow-mono">${esc(r.rid)}</span>`],
    ["Shahar, aloqa", esc([r.city, r.contact, r.phone].filter(Boolean).join(" · ") || "kiritilmagan")],
    ["Planshet kodi", `<b class="ow-mono">${prettyId(g.id)}</b>`],
    ["Planshet nomi", g.name ? esc(g.name) : "<i>kiritilmagan</i>"],
    ["Qurilma", esc(devModel(g.ua))],
    ["So'rov vaqti", g.at ? fmtTime(g.at) : "—"]
  ];
  return `<dl class="ow-kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
}
function allPending() {
  const out = [];
  for (const r of Object.values(S.rests)) for (const g of pendingOf(r)) out.push([r, g]);
  return out.sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
}

function renderRest(r) {
  const st = status(r);
  const pend = pendingOf(r);
  const devs = Object.entries(r.devices || {});
  app.innerHTML = `
    ${top(esc(r.name), true)}
    <main class="ow-main">
      <section class="ow-hero p-${st.k}">
        <div>
          <small>Restoran kodi (planshetga shu kiritiladi)</small>
          <div class="ow-code"><b>${esc(r.rid)}</b><button class="ow-copy" id="copy">Nusxa</button></div>
          <p>${esc([r.city, r.contact, r.phone].filter(Boolean).join(" · ") || "Ma'lumot kiritilmagan")}</p>
        </div>
        <div class="ow-hero-st">
          <span class="ow-pill p-${st.k}">${st.t}</span>
          ${r.until ? `<small>${daysLeft(r) > 0 ? "Dostup" : "Tugagan sana"}: <b>${fmtDate(r.until)}</b>${daysLeft(r) > 0 ? " gacha" : ""}</small>` : ""}
        </div>
      </section>

      ${pend.length ? `<section class="ow-sec ow-new">
        <h3>📲 Tasdiq kutayotgan planshetlar</h3>
        ${pend.map((g) => `<div class="ow-req">
          ${reqRows(r, g)}
          <div class="ow-dev-btns"><button class="btn btn-ghost" data-rej="${esc(g.id)}">Rad etish</button><button class="btn btn-primary" data-ok="${esc(g.id)}">Tasdiqlash</button></div>
        </div>`).join("")}
        <p class="ow-hint">Planshet ekranidagi kod shu yerdagi kod bilan bir xil ekanini tekshiring.</p>
      </section>` : ""}

      <section class="ow-sec">
        <h3>Tarif <small>${planOf(r.plan) ? esc(planOf(r.plan).name) : "tanlanmagan"}</small></h3>
        <p class="ow-hint">${planOf(r.plan) ? "Tarif o'zgarsa, restoran planshetlarida funksiyalar darhol o'zi yoqiladi yoki yopiladi." : "Tarif tanlanmagan: hozircha hamma funksiya ochiq. Restoran to'layotgan tarifni tanlang."}</p>
        <div class="ow-plans ow-tariffs">${TARIFFS.map((t) => `<button class="ow-plan ${r.plan === t.id ? "on" : ""}" data-tariff="${t.id}"><b>${t.name}</b><small>${t.tablets} planshet · ${money(t.price)}</small></button>`).join("")}</div>
        ${planOf(r.plan) ? `<ul class="ow-feats">${tariffFeatures(r.plan)}</ul>` : ""}
      </section>

      <section class="ow-sec">
        <h3>Dostup berish</h3>
        <p class="ow-hint">To'lov olgach, tegishli tugmani bosing. Muddat ${daysLeft(r) > 0 ? "hozirgi muddat oxiriga" : "bugundan boshlab"} qo'shiladi.</p>
        <div class="ow-plans">${PLANS.map(([m, t]) => `<button class="ow-plan" data-m="${m}"><b>+${t}</b><small>${fmtDate(addMonths(Math.max(Date.now(), r.until || 0), m))} gacha</small></button>`).join("")}</div>
        <div class="ow-row-btns">
          <button class="btn btn-ghost" id="block">${r.blocked ? "▶ Qayta yoqish" : "⏸ To'xtatish"}</button>
          ${r.until > Date.now() ? `<button class="btn btn-ghost" id="cut">Muddatni bugun tugatish</button>` : ""}
        </div>
      </section>

      <section class="ow-sec">
        <h3>Planshetlar <small class="${devs.length > (r.max || 5) ? "ow-over" : ""}">${devs.length} / ${r.max || 5}</small></h3>
        ${devs.length > (r.max || 5) ? `<p class="ow-hint ow-over">Planshetlar tarif chegarasidan ko'p. Ortiqchasini o'chiring yoki chegarani oshiring.</p>` : ""}
        ${devs.map(([id, d]) => `<div class="ow-dev">
          <div><b class="ow-mono">${prettyId(id)}</b> ${d.name ? `· ${esc(d.name)}` : ""}<small>${esc(devModel(d.ua))} · tasdiqlangan ${fmtDate(d.approvedAt)}</small></div>
          <div class="ow-dev-btns"><button class="btn btn-ghost" data-rm="${esc(id)}">O'chirish</button></div>
        </div>`).join("") || `<p class="ow-hint">Hali planshet yo'q. Planshetda Smart Menyu ilovasini oching va restoran kodini kiriting: so'rov shu yerda chiqadi.</p>`}
      </section>

      <section class="ow-sec">
        <h3>To'lovlar tarixi</h3>
        ${(r.payments || []).slice().reverse().map((p) => `<div class="ow-pay"><span>${fmtDate(p.at)}</span><b>+${PLANS.find(([m]) => m === p.months)?.[1] || p.months + " oy"}${planOf(p.plan) ? ` · ${planOf(p.plan).name}` : ""}</b><span>${p.amount ? money(p.amount) : "—"}</span><small>${fmtDate(p.from)} → ${fmtDate(p.to)}</small></div>`).join("") || `<p class="ow-hint">Hali to'lov yo'q.</p>`}
      </section>

      <section class="ow-sec">
        <h3>Restoran</h3>
        <div class="ow-row-btns">
          <button class="btn btn-ghost" id="edit">✏️ Ma'lumotlarni tahrirlash</button>
          <button class="btn btn-ghost" id="brand">🎨 Nomi, logo va chek</button>
          <button class="btn btn-ghost" id="pin">🔑 Boshqaruv paroli</button>
        </div>
      </section>
    </main>`;
  const $ = (s) => app.querySelector(s);
  $("#back").addEventListener("click", () => { ui.view = "list"; render(); });
  $("#copy").addEventListener("click", () => { navigator.clipboard?.writeText(r.rid).then(() => toast("Kod nusxalandi", { kind: "ok" }), () => {}); });
  app.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => grant(r, Number(b.dataset.m))));
  app.querySelectorAll("[data-tariff]").forEach((b) => b.addEventListener("click", () => setTariff(r, b.dataset.tariff)));
  $("#block").addEventListener("click", async () => {
    if (!r.blocked && !(await confirmBox(`"${esc(r.name)}" to'xtatilsinmi? Barcha planshetlari darhol yopiladi.`, "To'xtatish", { danger: true }))) return;
    r.blocked = !r.blocked; await publishLicense(r); render();
    toast(r.blocked ? "Restoran to'xtatildi" : "Restoran qayta yoqildi", { kind: "ok" });
  });
  $("#cut")?.addEventListener("click", async () => {
    if (!(await confirmBox("Muddat bugun tugatilsinmi? Planshetlar yopiladi.", "Tugatish", { danger: true }))) return;
    r.until = Date.now() - 1000; r.cutAt = Date.now(); await publishLicense(r); render();
  });
  app.querySelectorAll("[data-ok]").forEach((b) => b.addEventListener("click", async () => {
    const g = regs[r.rid][b.dataset.ok];
    if (!g) return;
    if (!(await confirmBox(`<b>${esc(r.name)}</b> restoraniga <b>${prettyId(g.id)}</b>${g.name ? ` (${esc(g.name)})` : ""} planshetini tasdiqlaysizmi?`, "Tasdiqlash"))) return;
    if (Object.keys(r.devices || {}).length >= (r.max || 5)) return toast(`Planshetlar chegarasi: ${r.max || 5}. Avval eskisini o'chiring yoki chegarani oshiring.`, { kind: "error", timeout: 6000 });
    r.devices = r.devices || {};
    r.devices[g.id] = { pub: g.pub, name: g.name || "", ua: g.ua || "", approvedAt: Date.now() };
    if (r.rejected) delete r.rejected[g.id];
    await publishLicense(r); render();
    toast(`Planshet ${prettyId(g.id)} tasdiqlandi${r.until > Date.now() ? "" : ". Ishlashi uchun dostup bering."}`, { kind: "ok", timeout: 5000 });
  }));
  app.querySelectorAll("[data-rej]").forEach((b) => b.addEventListener("click", () => {
    r.rejected = { ...(r.rejected || {}), [b.dataset.rej]: Date.now() };
    persist();
    client?.publish(`${V2}/${r.rid}/reg/${b.dataset.rej}`, "", { qos: 1, retain: true });
    render();
  }));
  app.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", async () => {
    if (!(await confirmBox(`Planshet ${prettyId(b.dataset.rm)} o'chirilsinmi? U darhol ishlamay qoladi.`, "O'chirish", { danger: true }))) return;
    delete r.devices[b.dataset.rm];
    r.rejected = { ...(r.rejected || {}), [b.dataset.rm]: Date.now() };
    client?.publish(`${V2}/${r.rid}/reg/${b.dataset.rm}`, "", { qos: 1, retain: true });
    await publishLicense(r); render();
  }));
  $("#edit").addEventListener("click", () => editInfo(r));
  $("#brand").addEventListener("click", () => editBrand(r));
  $("#pin").addEventListener("click", () => adminPassword(r));
}

// Tarifda ochiq va yopiq funksiyalar ro'yxati
function tariffFeatures(planId) {
  const rank = (id) => TARIFFS.findIndex((t) => t.id === id);
  return Object.values(FEATURES).map((f) => {
    const on = rank(planId) >= rank(f.plan);
    return `<li class="${on ? "on" : "off"}">${on ? "✓" : "🔒"} ${esc(f.name)}${on ? "" : ` <small>${esc(planOf(f.plan).name)}</small>`}</li>`;
  }).join("");
}

// Tarifni o'zgartirish: planshetlar chegarasi tarifga moslanadi, funksiyalar yangi ruxsatnoma bilan o'zi o'zgaradi
async function setTariff(r, id) {
  const t = planOf(id);
  if (!t || r.plan === id) return;
  const old = planOf(r.plan);
  const down = old && TARIFFS.indexOf(t) < TARIFFS.indexOf(old);
  const devs = Object.keys(r.devices || {}).length;
  const msg = `<b>${esc(r.name)}</b> tarifi <b>${t.name}</b> ga o'zgartirilsinmi?<br>Planshetlar chegarasi: <b>${t.tablets}</b>.` +
    (down ? `<br>Yuqori tarif funksiyalari restoranda darhol yopiladi.` : "") +
    (devs > t.tablets ? `<br>⚠️ Hozir ${devs} ta planshet ulangan: ortiqchasini o'zingiz o'chiring.` : "");
  if (!(await confirmBox(msg, "O'zgartirish", { danger: down }))) return;
  r.plan = id;
  r.max = t.tablets;
  r.planAt = Date.now();
  await publishLicense(r); render();
  toast(`Tarif: ${t.name}. Restoran planshetlarida funksiyalar yangilandi.`, { kind: "ok", timeout: 5000 });
}

function devModel(ua = "") {
  const m = ua.match(/Android [\d.]+; ([^;)]+)/) || ua.match(/\(([^;)]+)/);
  return m ? m[1].replace(/ Build.*/, "").trim() : "Qurilma";
}

function grant(r, months) {
  const from = Math.max(Date.now(), r.until || 0);
  const to = addMonths(from, months);
  const label = PLANS.find(([m]) => m === months)[1];
  modal(`
    <div class="modal-head"><h3>+${label} dostup</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <p class="ow-big"><b>${esc(r.name)}</b><br>Dostup <b>${fmtDate(to)}</b> gacha ochiladi.</p>
      <label class="field"><span>Olingan to'lov, so'm (ixtiyoriy)</span><input id="amt" type="number" inputmode="numeric" min="0" step="1000" placeholder="Masalan: 500000"></label>
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" data-close>Bekor qilish</button><button class="btn btn-primary btn-lg" id="ok">✓ Dostup berish</button></div>`, {
    onMount(m, close) {
      m.querySelector("#ok").addEventListener("click", async () => {
        r.until = to;
        r.blocked = false;
        r.payments = r.payments || [];
        r.payments.push({ at: Date.now(), months, amount: Number(m.querySelector("#amt").value) || 0, from, to, plan: r.plan || "" });
        await publishLicense(r);
        close(); render();
        toast(`Dostup berildi: ${fmtDate(to)} gacha`, { kind: "ok", timeout: 5000 });
      });
    }
  });
}

function editInfo(r) {
  modal(`
    <div class="modal-head"><h3>Ma'lumotlar</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">${infoForm(r)}</div>
    <div class="modal-actions"><button class="btn btn-danger" id="del">Restoranni o'chirish</button><button class="btn btn-primary" id="ok">Saqlash</button></div>`, {
    onMount(m, close) {
      m.querySelector("#ok").addEventListener("click", async () => {
        const info = readInfo(m);
        if (!info.name) return toast("Nomini kiriting", { kind: "error" });
        Object.assign(r, info);
        await publishLicense(r);
        close(); render();
      });
      m.querySelector("#del").addEventListener("click", async () => {
        const ok = await confirmBox(`"${esc(r.name)}" ro'yxatdan butunlay o'chirilsinmi? Planshetlari ishlamay qoladi va menyusi tiklanmaydi.`, "O'chirish", { danger: true });
        if (!ok) return;
        r.blocked = true; r.devices = {}; r.until = 0;
        await publishLicense(r, false);
        delete S.rests[r.rid];
        S.gone = { ...(S.gone || {}), [r.rid]: Date.now() };
        persist();
        close(); ui.view = "list"; render();
      });
    }
  });
}

// Restoran sozlamasini serverdan o'qish (kelguncha 4 soniya kutadi)
const loadCfg = (s) => new Promise((res) => {
  if (s.state.configLoaded) return res(structuredClone(s.state.config));
  const t = setTimeout(() => res(null), 4000);
  s.on((e) => { if (e.type === "config") { clearTimeout(t); res(structuredClone(s.state.config)); } });
});

// Boshqaruv paroli: egasi ko'radi, o'zgartiradi, blokdan chiqaradi
function adminPassword(r) {
  modal(`
    <div class="modal-head"><h3>🔑 Boshqaruv paroli</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body"><p class="ow-hint">Yuklanmoqda...</p></div>`, {
    async onMount(m, close) {
      const body = m.querySelector(".modal-body");
      let cfg = null;
      try { cfg = await withStore(r, loadCfg); } catch {}
      if (!cfg) { body.innerHTML = `<p class="ow-hint">Restoran sozlamalarini o'qib bo'lmadi. Internetni tekshiring.</p>`; return; }
      body.innerHTML = `
        <p class="ow-hint">${esc(r.name)} restorani boshqaruviga kirish paroli:</p>
        <div class="ow-pass">${cfg.adminPin ? esc(cfg.adminPin) : "<small>O'rnatilmagan. Restoran boshqaruvga birinchi kirganda o'zi qo'yadi.</small>"}</div>
        ${cfg.adminLock ? `<p class="ow-lock">⛔ Bloklangan: parol 5 marta noto'g'ri kiritilgan.</p>` : ""}
        <label class="field"><span>Yangi parol (bosh harf va raqam, kamida 6 belgi)</span><input id="np" maxlength="30" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="masalan Kamoliddin1234"></label>
        <button class="btn btn-primary btn-block" id="setp">Saqlash${cfg.adminLock ? " va blokdan chiqarish" : ""}</button>
        ${cfg.adminLock ? `<button class="btn btn-ghost btn-block" id="unl" style="margin-top:10px">Eski parol bilan blokdan chiqarish</button>` : ""}`;
      const save = async (btn, fn, msg) => {
        btn.disabled = true;
        try {
          const ok = await withStore(r, async (s) => {
            const c = await loadCfg(s);
            if (!c) return false;
            fn(c);
            c.adminLock = false;
            c.adminGen = (c.adminGen || 0) + 1; // planshetlardagi xato urinishlar hisobi yangidan boshlanadi
            s.saveConfig(c);
            return true;
          });
          if (!ok) throw new Error("no config");
          close(); toast(msg, { kind: "ok" });
        } catch { btn.disabled = false; toast("Aloqa yo'q. Internetni tekshiring.", { kind: "error" }); }
      };
      m.querySelector("#setp").addEventListener("click", (e) => {
        const v = m.querySelector("#np").value.trim();
        if (!adminPassOk(v)) return toast(ADMIN_PASS_RULE, { kind: "error", timeout: 6000 });
        save(e.currentTarget, (c) => { c.adminPin = v; }, `Yangi parol saqlandi: ${v}`);
      });
      m.querySelector("#unl")?.addEventListener("click", (e) => save(e.currentTarget, () => {}, "Blokdan chiqarildi"));
    }
  });
}

function editBrand(r) {
  modal(`
    <div class="modal-head"><h3>Restoran sozlamalari</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body"><p class="ow-hint">Yuklanmoqda...</p></div>`, {
    async onMount(m, close) {
      let cfg = null;
      try { cfg = await withStore(r, (s) => new Promise((res) => { if (s.state.configLoaded) res(structuredClone(s.state.config)); else { const t = setTimeout(() => res(null), 4000); s.on((e) => { if (e.type === "config") { clearTimeout(t); res(structuredClone(s.state.config)); } }); } })); } catch {}
      if (!cfg) { m.querySelector(".modal-body").innerHTML = `<p class="ow-hint">Restoran sozlamalarini o'qib bo'lmadi. Internetni tekshiring.</p>`; return; }
      const R = cfg.restaurant;
      m.querySelector(".modal-body").innerHTML = `
        <div class="ow-logo-row"><div class="ow-logo" id="lg">${R.logo ? `<img src="${esc(R.logo)}" alt="">` : esc((R.name || "?")[0])}</div>
          <label class="btn btn-ghost">📷 Logo yuklash<input type="file" accept="image/*" id="logo" class="file-overlay"></label></div>
        <label class="field"><span>Nomi</span><input id="bName" value="${esc(R.name || "")}"></label>
        <label class="field"><span>Shior</span><input id="bSlogan" value="${esc(R.slogan || "")}"></label>
        <div class="row2">
          <label class="field"><span>Brend rangi</span><input type="color" id="bColor" value="${esc(R.color || "#B4232A")}"></label>
          <label class="field"><span>Xizmat haqi, %</span><input type="number" id="bSvc" min="0" max="30" value="${esc(R.service ?? 0)}"></label>
        </div>
        <div class="row2">
          <label class="field"><span>Telefon (chekda)</span><input id="bPhone" type="tel" value="${esc(R.phone || "")}"></label>
          <label class="field"><span>Valyuta</span><input id="bCur" value="${esc(R.currency || "so'm")}"></label>
        </div>
        <label class="field"><span>Manzil (chekda)</span><input id="bAddr" value="${esc(R.address || "")}"></label>
        <div class="row2">
          <label class="field"><span>Chek kengligi</span><select id="bW">${["80", "58"].map((w) => `<option value="${w}" ${String(R.receiptWidth || "80") === w ? "selected" : ""}>${w} mm</option>`).join("")}</select></label>
        </div>
        <label class="field"><span>Chek pastidagi matn</span><input id="bNote" value="${esc(R.receiptNote || "")}" placeholder="Rahmat! Yana kutib qolamiz"></label>`;
      m.insertAdjacentHTML("beforeend", `<div class="modal-actions"><button class="btn btn-ghost" data-close2>Bekor qilish</button><button class="btn btn-primary" id="ok">Saqlash</button></div>`);
      m.querySelector("[data-close2]").addEventListener("click", close);
      m.querySelector("#logo").addEventListener("change", async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { R.logo = await fileToDataUrl(f, 256, 0.85); m.querySelector("#lg").innerHTML = `<img src="${esc(R.logo)}" alt="">`; } catch { toast("Rasmni ochib bo'lmadi", { kind: "error" }); }
      });
      m.querySelector("#ok").addEventListener("click", async () => {
        const v = (id) => m.querySelector(id).value.trim();
        Object.assign(R, {
          name: v("#bName") || R.name, slogan: v("#bSlogan"), color: m.querySelector("#bColor").value, service: Number(v("#bSvc")) || 0,
          phone: v("#bPhone"), currency: v("#bCur") || "so'm", address: v("#bAddr"), receiptWidth: m.querySelector("#bW").value, receiptNote: v("#bNote")
        });
        try { await withStore(r, (s) => s.saveConfig(cfg)); } catch { return toast("Aloqa yo'q", { kind: "error" }); }
        if (R.name !== r.name) { r.name = R.name; await publishLicense(r); }
        close(); render(); toast("Saqlandi", { kind: "ok" });
      });
    }
  });
}

function renderSettings() {
  app.innerHTML = `
    ${top("Sozlamalar", true)}
    <main class="ow-main">
      <section class="ow-sec">
        <h3>Aloqa telefoni</h3>
        <p class="ow-hint">Obunasi tugagan restoran planshetida shu raqam chiqadi.</p>
        <label class="field"><input id="phone" type="tel" value="${esc(S.settings.phone || "")}" placeholder="+998 90 123 45 67"></label>
        <button class="btn btn-primary" id="savePhone">Saqlash</button>
      </section>
      <section class="ow-sec">
        <h3>Server</h3>
        <p class="ow-hint">Hozir: <b class="ow-mono">${esc(brokerOf())}</b>. O'z serveringizga o'tganda manzilini shu yerga yozing: barcha planshetlar o'zi o'tadi.</p>
        <label class="field"><span>Server manzili</span><input id="broker" value="${esc(S.settings.broker || "")}" placeholder="wss://menyu.domen.uz/mqtt"></label>
        <div class="row2">
          <label class="field"><span>Login</span><input id="mUser" value="${esc(S.settings.mqttUser || "")}" placeholder="smartmenyu" autocapitalize="none"></label>
          <label class="field"><span>Parol</span><input id="mPass" value="${esc(S.settings.mqttPass || "")}" autocapitalize="none"></label>
        </div>
        <p class="ow-hint">Bo'sh qoldirilsa, umumiy bepul server ishlatiladi.</p>
        <button class="btn btn-ghost" id="saveBroker">Serverni saqlash</button>
      </section>
      <section class="ow-sec">
        <h3>Zaxira nusxa</h3>
        <p class="ow-hint">Restoranlar ro'yxati va kalitlari shifrlangan holda serverda saqlanadi. Qo'shimcha xavfsizlik uchun faylga ham saqlab qo'ying.</p>
        <div class="ow-row-btns"><button class="btn btn-ghost" id="exp">⬇ Faylga saqlash</button><label class="btn btn-ghost">⬆ Fayldan tiklash<input type="file" accept=".smz,application/octet-stream,text/plain" id="imp" class="file-overlay"></label></div>
      </section>
      <section class="ow-sec">
        <h3>Xavfsizlik</h3>
        <div class="ow-row-btns"><button class="btn btn-ghost" id="lock">🔒 Chiqish (PIN so'raladi)</button><button class="btn btn-danger" id="forget">Shu telefondan butunlay chiqish</button></div>
      </section>
    </main>`;
  const $ = (s) => app.querySelector(s);
  $("#back").addEventListener("click", () => { ui.view = "list"; render(); });
  $("#savePhone").addEventListener("click", async () => {
    S.settings.phone = $("#phone").value.trim(); persist();
    for (const r of Object.values(S.rests)) await publishLicense(r, false);
    persist(); toast("Saqlandi", { kind: "ok" });
  });
  $("#saveBroker").addEventListener("click", async () => {
    const v = $("#broker").value.trim();
    if (v && !/^wss?:\/\/.+/.test(v)) return toast("Manzil wss:// bilan boshlanishi kerak", { kind: "error" });
    if (!(await confirmBox("Server o'zgartirilsinmi? Barcha planshetlar yangi serverga o'tadi.", "O'zgartirish"))) return;
    // Avval yangi serverga ulanib ko'ramiz: noto'g'ri manzil yoki parol bilan planshetlarni yo'qotmaslik uchun
    const user = $("#mUser").value.trim(), pass = $("#mPass").value;
    if (v) {
      const ok = await new Promise((res) => {
        const c = window.mqtt.connect(v, { ...(user ? { username: user, password: pass } : {}), clientId: `menyu_test_${Math.random().toString(16).slice(2, 8)}`, reconnectPeriod: 0, connectTimeout: 8000 });
        const t = setTimeout(() => { c.end(true); res(false); }, 9000);
        c.on("connect", () => { clearTimeout(t); c.end(true); res(true); });
        c.on("error", () => { clearTimeout(t); c.end(true); res(false); });
      });
      if (!ok) return toast("Bu serverga ulanib bo'lmadi. Manzil, login va parolni tekshiring.", { kind: "error", timeout: 6000 });
    }
    // Restoranlar ma'lumotlari (menyu, buyurtmalar) yangi serverga ko'chirilmaydi: menyuni egasi ilovasidan qayta yozamiz
    const from = { url: brokerOf(), opts: S.settings.broker && S.settings.mqttUser ? { username: S.settings.mqttUser, password: S.settings.mqttPass || "" } : {} };
    S.settings.broker = v; S.settings.mqttUser = user; S.settings.mqttPass = pass;
    // Planshetlar eski serverda turibdi: ruxsatnomani avval eski serverga yozamiz, ular yangisiga o'tadi
    for (const r of Object.values(S.rests)) await publishLicense(r, false);
    persist();
    publishPointer();
    setTimeout(async () => {
      connect();
      await moveData(from);
      for (const r of Object.values(S.rests)) await publishLicense(r, false);
      backup();
    }, 2500);
    toast("Server o'zgartirildi", { kind: "ok" });
  });
  $("#exp").addEventListener("click", async () => {
    const text = await seal(keys.state, JSON.stringify(S), "backup");
    saveFile(`smart-menyu-zaxira-${fmtDate(Date.now())}.smz`, text, "application/octet-stream");
  });
  $("#imp").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await open(keys.state, (await f.text()).trim(), "backup"));
      if (!(await confirmBox(`Zaxiradan ${Object.keys(data.rests || {}).length} ta restoran tiklansinmi?`, "Tiklash"))) return;
      stamp(); S = merge(S, data); persist(); render(); toast("Tiklandi", { kind: "ok" });
    } catch { toast("Bu fayl Smart Menyu zaxirasi emas yoki boshqa parolga tegishli", { kind: "error" }); }
  });
  $("#lock").addEventListener("click", () => start());
  $("#forget").addEventListener("click", async () => {
    if (!(await confirmBox("Shu telefondan chiqilsinmi? Qayta kirish uchun maxfiy parol kerak bo'ladi.", "Chiqish", { danger: true }))) return;
    await kvDel("owner.keys"); localStorage.removeItem("owner.pin"); localStorage.removeItem("owner.state");
    location.reload();
  });
}

start();
