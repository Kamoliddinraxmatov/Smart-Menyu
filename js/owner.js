// "Smart Menyu Egasi": restoranlarga obuna (dostup) berish, planshetlarni tasdiqlash.
// Faqat egasi uchun. Kirish: birinchi marta maxfiy parol, keyin shu telefonda 4 xonali PIN.
//
// Ma'lumotlar (restoranlar ro'yxati, ularning kalitlari, to'lovlar) shu telefonda saqlanadi va
// shifrlangan zaxira nusxasi serverga yoziladi: boshqa telefonda parol bilan kirilsa, ro'yxat o'zi tiklanadi.
import { OWNER } from "./owner-key.js";
import { V2, DEFAULT_BROKER } from "./license.js";
import { createStore } from "./sync.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import {
  passKey, open, seal, importSignKey, sign, newEphemeral, wrapFor, genDataKey, importDataKey,
  prettyId, fingerprint, kvGet, kvSet, kvDel, b64, rand
} from "./crypto.js";
import { esc, money, modal, toast, confirmBox, fileToDataUrl, registerSW } from "./common.js";

const app = document.getElementById("app");
const DAY = 86400000;
const PLANS = [[1, "1 oy"], [3, "3 oy"], [6, "6 oy"], [12, "1 yil"]];
const enc = new TextEncoder();

let keys = null;        // { sign: CryptoKey, state: CryptoKey }
let ownerId = "";       // zaxira mavzusi uchun egasining kodi
let S = null;           // holat
let client = null;
let online = false;
const regs = {};        // kutilayotgan planshetlar: rid -> { id -> reg }
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
    if (!lr || (rr.upd || 0) > (lr.upd || 0)) out.rests[rid] = rr;
  }
  for (const [rid, t] of Object.entries(out.gone)) if (out.rests[rid] && (out.rests[rid].upd || 0) <= t) delete out.rests[rid];
  if ((remote.settingsUpd || 0) > (local.settingsUpd || 0)) { out.settings = remote.settings; out.settingsUpd = remote.settingsUpd; }
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
const brokerOf = () => {
  const q = new URLSearchParams(location.search).get("broker");
  return q || S?.settings?.broker || DEFAULT_BROKER;
};

// ---------- Kirish ----------
async function start() {
  ownerId = (await fingerprint(OWNER.pub)).toLowerCase();
  try { keys = await kvGet("owner.keys"); } catch { keys = null; }
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
      keys = { sign: signKey, state: stateKey };
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
  client = window.mqtt.connect(brokerOf(), { clientId: `menyu_owner_${Math.random().toString(16).slice(2, 10)}`, clean: true, keepalive: 30, reconnectPeriod: 2000 });
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
    const merged = merge(S, remote);
    const changedLocal = JSON.stringify(merged.rests) !== JSON.stringify(S.rests) || JSON.stringify(merged.settings) !== JSON.stringify(S.settings);
    const changedRemote = JSON.stringify(merged.rests) !== JSON.stringify(remote.rests || {}) || JSON.stringify(merged.settings) !== JSON.stringify(remote.settings);
    S = merged;
    for (const r of Object.values(S.rests)) snap[r.rid] = bare(r);
    snap._settings = JSON.stringify(S.settings);
    if (changedLocal) { try { localStorage.setItem("owner.state", JSON.stringify(S)); } catch {} render(); }
    if (changedRemote) backup();
    return;
  }
  const parts = topic.split("/");
  const rid = parts[2];
  if (parts[3] === "reg") {
    const id = parts[4];
    let reg = null;
    try { reg = text ? JSON.parse(text) : null; } catch { return; }
    regs[rid] = regs[rid] || {};
    if (reg && reg.pub && reg.id === id) regs[rid][id] = reg; else delete regs[rid][id];
    render();
    return;
  }
  if (parts[3] === "lic") {
    // Serverdagi ruxsatnoma biznikidan farq qilsa (o'chirilgan yoki soxta), qayta yozamiz
    const r = S.rests[rid];
    if (!r || !r.licIssued) return;
    let issued = 0;
    try { issued = JSON.parse(JSON.parse(text).p).issued; } catch {}
    issuedSeen[rid] = issued;
    if (issued !== r.licIssued) setTimeout(() => { if (issuedSeen[rid] !== S.rests[rid]?.licIssued) publishLicense(S.rests[rid], false); }, 1500);
  }
}

// Ruxsatnomani imzolab yuborish
async function publishLicense(r, save = true) {
  const eph = await newEphemeral();
  const dev = {};
  for (const [id, d] of Object.entries(r.devices || {})) dev[id] = await wrapFor(eph.priv, d.pub, r.key, `${r.rid}/${id}`);
  const issued = Math.max(Date.now(), (r.licIssued || 0) + 1);
  const lic = {
    v: 1, rid: r.rid, name: r.name, until: r.until || 0, issued, blocked: !!r.blocked,
    phone: S.settings.phone || "", eph: eph.pub, dev, max: r.max || 5
  };
  if (S.settings.broker) lic.broker = S.settings.broker;
  const p = JSON.stringify(lic);
  const msg = JSON.stringify({ p, s: await sign(keys.sign, p) });
  r.licIssued = issued;
  if (save) persist();
  client?.publish(`${V2}/${r.rid}/lic`, msg, { qos: 1, retain: true });
}

// Restoranning menyu va sozlamalarini (shifrlangan) yozish
async function withStore(r, fn) {
  const key = await importDataKey(r.key);
  const st = createStore(r.rid, { key });
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
      <div class="ow-search"><input id="q" type="search" placeholder="🔍 Restoran nomi, shahar yoki kod" value="${esc(ui.q)}"></div>
      <section class="ow-list">
        ${list.map((r) => {
          const st = status(r), pend = pendingOf(r).length;
          return `<button class="ow-card" data-rid="${esc(r.rid)}">
            <div class="ow-card-l"><b>${esc(r.name)}</b><small>${esc([r.city, r.rid].filter(Boolean).join(" · "))}</small></div>
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
    <div class="row2">
      <label class="field"><span>Shahar / viloyat</span><input id="fCity" value="${esc(r.city || "")}" placeholder="Masalan: Samarqand"></label>
      <label class="field"><span>Planshetlar soni (chegara)</span><input id="fMax" type="number" min="1" max="50" value="${esc(r.max || 5)}"></label>
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
      m.querySelector("#ok").addEventListener("click", async (e) => {
        const info = readInfo(m);
        if (!info.name) return toast("Restoran nomini kiriting", { kind: "error" });
        const old = m.querySelector("#fOld").value.trim().toLowerCase();
        if (old && !/^[a-z0-9_-]{3,40}$/.test(old)) return toast("Eski kod noto'g'ri", { kind: "error" });
        const rid = old || `${slug(info.name)}-${code4()}`;
        if (S.rests[rid]) return toast("Bu kod bilan restoran allaqachon bor", { kind: "error" });
        e.currentTarget.disabled = true; e.currentTarget.textContent = "Yaratilmoqda...";
        const r = { rid, ...info, createdAt: Date.now(), until: 0, blocked: false, key: await genDataKey(), devices: {}, payments: [] };
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
    const st = createStore(code);
    let done = false;
    const finish = (v) => { if (done) return; done = true; setTimeout(() => st.close(), 300); res(v); };
    st.on((e) => { if (e.type === "config") finish(structuredClone(st.state.config)); });
    setTimeout(() => finish(null), 6000);
  });
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
        ${pend.map((g) => `<div class="ow-dev">
          <div><b class="ow-mono">${prettyId(g.id)}</b> ${g.name ? `· ${esc(g.name)}` : ""}<small>${esc(devModel(g.ua))} · ${fmtDate(g.at || Date.now())}</small></div>
          <div class="ow-dev-btns"><button class="btn btn-ghost" data-rej="${esc(g.id)}">Rad etish</button><button class="btn btn-primary" data-ok="${esc(g.id)}">Tasdiqlash</button></div>
        </div>`).join("")}
        <p class="ow-hint">Planshet ekranidagi kod shu yerdagi kod bilan bir xil ekanini tekshiring.</p>
      </section>` : ""}

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
        <h3>Planshetlar <small>${devs.length} / ${r.max || 5}</small></h3>
        ${devs.map(([id, d]) => `<div class="ow-dev">
          <div><b class="ow-mono">${prettyId(id)}</b> ${d.name ? `· ${esc(d.name)}` : ""}<small>${esc(devModel(d.ua))} · tasdiqlangan ${fmtDate(d.approvedAt)}</small></div>
          <div class="ow-dev-btns"><button class="btn btn-ghost" data-rm="${esc(id)}">O'chirish</button></div>
        </div>`).join("") || `<p class="ow-hint">Hali planshet yo'q. Planshetda Smart Menyu ilovasini oching va restoran kodini kiriting: so'rov shu yerda chiqadi.</p>`}
      </section>

      <section class="ow-sec">
        <h3>To'lovlar tarixi</h3>
        ${(r.payments || []).slice().reverse().map((p) => `<div class="ow-pay"><span>${fmtDate(p.at)}</span><b>+${PLANS.find(([m]) => m === p.months)?.[1] || p.months + " oy"}</b><span>${p.amount ? money(p.amount) : "—"}</span><small>${fmtDate(p.from)} → ${fmtDate(p.to)}</small></div>`).join("") || `<p class="ow-hint">Hali to'lov yo'q.</p>`}
      </section>

      <section class="ow-sec">
        <h3>Restoran</h3>
        <div class="ow-row-btns">
          <button class="btn btn-ghost" id="edit">✏️ Ma'lumotlarni tahrirlash</button>
          <button class="btn btn-ghost" id="brand">🎨 Nomi, logo va rangi</button>
          <button class="btn btn-ghost" id="pin">🔑 Admin PIN'ni tiklash</button>
        </div>
      </section>
    </main>`;
  const $ = (s) => app.querySelector(s);
  $("#back").addEventListener("click", () => { ui.view = "list"; render(); });
  $("#copy").addEventListener("click", () => { navigator.clipboard?.writeText(r.rid).then(() => toast("Kod nusxalandi", { kind: "ok" }), () => {}); });
  app.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => grant(r, Number(b.dataset.m))));
  $("#block").addEventListener("click", async () => {
    if (!r.blocked && !(await confirmBox(`"${esc(r.name)}" to'xtatilsinmi? Barcha planshetlari darhol yopiladi.`, "To'xtatish", { danger: true }))) return;
    r.blocked = !r.blocked; await publishLicense(r); render();
    toast(r.blocked ? "Restoran to'xtatildi" : "Restoran qayta yoqildi", { kind: "ok" });
  });
  $("#cut")?.addEventListener("click", async () => {
    if (!(await confirmBox("Muddat bugun tugatilsinmi? Planshetlar yopiladi.", "Tugatish", { danger: true }))) return;
    r.until = Date.now() - 1000; await publishLicense(r); render();
  });
  app.querySelectorAll("[data-ok]").forEach((b) => b.addEventListener("click", async () => {
    const g = regs[r.rid][b.dataset.ok];
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
  $("#pin").addEventListener("click", async () => {
    if (!(await confirmBox("Restoran boshqaruvining PIN kodi o'chirilsinmi? Keyin boshqaruv parolsiz ochiladi va restoran yangi PIN qo'yadi.", "Tiklash"))) return;
    try { await withStore(r, (s) => { const c = structuredClone(s.state.config); c.adminPin = ""; s.saveConfig(c); }); toast("Admin PIN tiklandi", { kind: "ok" }); }
    catch { toast("Aloqa yo'q", { kind: "error" }); }
  });
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
        r.payments.push({ at: Date.now(), months, amount: Number(m.querySelector("#amt").value) || 0, from, to });
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

function editBrand(r) {
  modal(`
    <div class="modal-head"><h3>Nomi, logo va rangi</h3><button class="icon-btn" data-close>✕</button></div>
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
        </div>`;
      m.insertAdjacentHTML("beforeend", `<div class="modal-actions"><button class="btn btn-ghost" data-close2>Bekor qilish</button><button class="btn btn-primary" id="ok">Saqlash</button></div>`);
      m.querySelector("[data-close2]").addEventListener("click", close);
      m.querySelector("#logo").addEventListener("change", async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { R.logo = await fileToDataUrl(f, 256, 0.85); m.querySelector("#lg").innerHTML = `<img src="${esc(R.logo)}" alt="">`; } catch { toast("Rasmni ochib bo'lmadi", { kind: "error" }); }
      });
      m.querySelector("#ok").addEventListener("click", async () => {
        Object.assign(R, { name: m.querySelector("#bName").value.trim() || R.name, slogan: m.querySelector("#bSlogan").value.trim(), color: m.querySelector("#bColor").value, service: Number(m.querySelector("#bSvc").value) || 0 });
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
        <label class="field"><input id="broker" value="${esc(S.settings.broker || "")}" placeholder="wss://server.manzil:8084/mqtt"></label>
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
    S.settings.broker = v;
    // Planshetlar eski serverda turibdi: ruxsatnomani avval eski serverga yozamiz, ular yangisiga o'tadi
    for (const r of Object.values(S.rests)) await publishLicense(r, false);
    persist();
    setTimeout(() => { connect(); for (const r of Object.values(S.rests)) publishLicense(r, false); backup(); }, 2500);
    toast("Server o'zgartirildi", { kind: "ok" });
  });
  $("#exp").addEventListener("click", async () => {
    const text = await seal(keys.state, JSON.stringify(S), "backup");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
    a.download = `smart-menyu-zaxira-${fmtDate(Date.now())}.smz`;
    a.click();
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
