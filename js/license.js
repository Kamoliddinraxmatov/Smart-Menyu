// Planshetni faollashtirish va obuna (ruxsatnoma) tekshiruvi.
//
// Qanday ishlaydi:
//  1. Har planshet birinchi ochilganda o'zining maxfiy kalitini yaratadi (u qurilmadan chiqmaydi) va qurilma kodini ko'rsatadi.
//  2. Restoran kodi kiritilgach, planshet egasiga so'rov yuboradi: <v2>/<rid>/reg/<qurilma kodi>.
//  3. Egasi "Smart Menyu Egasi" ilovasida planshetni tasdiqlaydi va muddat beradi. Ilova egasining imzosi bilan
//     ruxsatnoma chiqaradi: <v2>/<rid>/lic. Unda muddat, tasdiqlangan planshetlar va har biriga alohida
//     o'ralgan restoran kaliti bor.
//  4. Planshet imzoni egasining ochiq kaliti bilan tekshiradi. Imzo to'g'ri, planshet ro'yxatda va muddat
//     tugamagan bo'lsa, ishlaydi. Nusxa ko'chirilgan ilova boshqa planshetda yangi kalit yaratadi va
//     egasi tasdiqlamaguncha ishlamaydi.
import { OWNER } from "./owner-key.js";
import { importVerifyKey, verify, genDeviceKeys, exportPub, fingerprint, prettyId, unwrapWith, importDataKey, kvGet, kvSet } from "./crypto.js";

export const V2 = "menyuuz/v2";
export const DEFAULT_BROKER = "wss://broker.emqx.io:8084/mqtt";
const ACT = "menyu.act";
const DAY = 86400000;

// Server manzili: ?broker= (sinov uchun) > qo'lda saqlangan > egasi bergan o'z server > umumiy server.
// Namoyish restorani doim umumiy serverda.
export function brokerUrl(demo = false) {
  const q = new URLSearchParams(location.search).get("broker");
  if (q) { try { localStorage.setItem("menyu.broker", q); } catch {} return q; }
  try { return localStorage.getItem("menyu.broker") || (!demo && localStorage.getItem("menyu.licBroker")) || DEFAULT_BROKER; } catch { return DEFAULT_BROKER; }
}

// O'z serverimizga login/parol (ruxsatnoma bilan keladi)
export function brokerOpts() {
  try { const m = JSON.parse(localStorage.getItem("menyu.licMqtt") || "null"); return m?.user ? { username: m.user, password: m.pass } : {}; } catch { return {}; }
}
function rememberServer(lic) {
  try {
    if (lic.broker) localStorage.setItem("menyu.licBroker", lic.broker); else localStorage.removeItem("menyu.licBroker");
    if (lic.mqtt) localStorage.setItem("menyu.licMqtt", JSON.stringify(lic.mqtt)); else localStorage.removeItem("menyu.licMqtt");
  } catch {}
}

// Yangi planshet: egasi o'z serveriga o'tgan bo'lsa, umumiy serverdagi imzolangan "ko'rsatkich"dan manzilni oladi
async function findServer() {
  if (new URLSearchParams(location.search).get("broker") || localStorage.getItem("menyu.licBroker") || !window.mqtt) return;
  await new Promise((resolve) => {
    const c = window.mqtt.connect(DEFAULT_BROKER, { clientId: `menyu_ptr_${Math.random().toString(16).slice(2, 8)}`, clean: true, reconnectPeriod: 0, connectTimeout: 6000 });
    const done = () => { try { c.end(true); } catch {} resolve(); };
    const t = setTimeout(done, 5000);
    c.on("error", () => { clearTimeout(t); done(); });
    c.on("connect", () => c.subscribe(`${V2}/_server`));
    c.on("message", async (_, payload) => {
      try {
        const msg = JSON.parse(payload.toString());
        pubKey = pubKey || await importVerifyKey(OWNER.pub);
        if (await verify(pubKey, msg.p, msg.s)) {
          const ptr = JSON.parse(msg.p);
          if (ptr.broker) rememberServer(ptr);
        }
      } catch {}
      clearTimeout(t); done();
    });
  });
}

const loadAct = () => { try { return JSON.parse(localStorage.getItem(ACT) || "null"); } catch { return null; } };
const saveAct = (a) => { try { localStorage.setItem(ACT, JSON.stringify(a)); } catch {} };

// Qurilma kaliti (bir marta yaratiladi)
let devPromise = null;
export function deviceKeys() {
  if (!devPromise) devPromise = (async () => {
    let d = null;
    try { d = await kvGet("device"); } catch {}
    if (!d?.priv) {
      const kp = await genDeviceKeys();
      const pub = await exportPub(kp.publicKey);
      d = { priv: kp.privateKey, pub, id: await fingerprint(pub), at: Date.now() };
      try { await kvSet("device", d); } catch {}
    }
    return d;
  })();
  return devPromise;
}

// Soat orqaga surilganini sezish: ko'rilgan eng katta vaqtni eslab qolamiz
export function noteTime(ts) {
  if (!ts || ts > Date.now() + 365 * DAY) return;
  try { if (ts > Number(localStorage.getItem("menyu.seen") || 0)) localStorage.setItem("menyu.seen", String(ts)); } catch {}
}
function now() {
  const n = Date.now();
  const seen = Number(localStorage.getItem("menyu.seen") || 0);
  noteTime(n);
  return { n, rolled: seen && n < seen - 6 * 3600 * 1000 };
}

let pubKey = null;
// Ruxsatnomani tekshirish. Natija: { state, lic, rawKey }
// state: ok | pending | expired | blocked | bad | clock | other
export async function checkLicense(text, rid, dev) {
  if (!text) return { state: "pending" };
  let msg, lic;
  try { msg = JSON.parse(text); lic = JSON.parse(msg.p); } catch { return { state: "bad" }; }
  pubKey = pubKey || await importVerifyKey(OWNER.pub);
  if (!(await verify(pubKey, msg.p, msg.s))) return { state: "bad" };
  if (lic.rid !== rid) return { state: "other", lic };
  noteTime(lic.issued);
  const t = now();
  if (lic.blocked) return { state: "blocked", lic };
  const wrapped = lic.dev?.[dev.id];
  if (!wrapped) return { state: "pending", lic };
  if (t.rolled || t.n < (lic.issued || 0) - DAY) return { state: "clock", lic };
  if (t.n > (lic.until || 0)) return { state: "expired", lic };
  let rawKey;
  try { rawKey = await unwrapWith(dev.priv, lic.eph, wrapped, `${rid}/${dev.id}`); } catch { return { state: "pending", lic }; }
  return { state: "ok", lic, rawKey };
}

export const daysLeft = (lic) => Math.ceil(((lic?.until || 0) - Date.now()) / DAY);

// --- Ekranlar ---
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function screen(html) {
  let el = document.getElementById("lic-screen");
  if (!el) {
    el = document.createElement("div");
    el.id = "lic-screen";
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="lic-card"><div class="lic-brand"><img src="img/icon.svg" alt=""><b>Smart Menyu</b></div>${html}</div>`;
  return el;
}
function closeScreen() { document.getElementById("lic-screen")?.remove(); }

const STATE_TEXT = {
  expired: ["Obuna muddati tugagan", "Ilovadan foydalanishni davom ettirish uchun obunani uzaytiring."],
  blocked: ["Restoran vaqtincha to'xtatilgan", "Batafsil ma'lumot uchun Smart Menyu bilan bog'laning."],
  bad: ["Ruxsatnoma noto'g'ri", "Smart Menyu bilan bog'laning."],
  clock: ["Planshet soati noto'g'ri", "Planshet sozlamalarida sana va vaqtni to'g'rilang, keyin \"Qayta tekshirish\"ni bosing."]
};
export function lockHtml(state, lic, dev) {
  const [h, p] = STATE_TEXT[state] || ["Planshet o'chirilgan", "Bu planshetga ruxsat olib tashlangan. Smart Menyu bilan bog'laning."];
  return `
    <div class="lic-ico lic-ico-lock">🔒</div>
    <h1>${h}</h1>
    <p>${p}</p>
    ${lic?.name ? `<p class="lic-meta">Restoran: <b>${esc(lic.name)}</b></p>` : ""}
    ${lic?.phone ? `<a class="lic-phone" href="tel:${esc(lic.phone.replace(/[^+\d]/g, ""))}">📞 ${esc(lic.phone)}</a>` : ""}
    <p class="lic-meta">Planshet kodi: <b class="lic-code">${prettyId(dev.id)}</b></p>
    <button class="lic-btn" id="licRetry">Qayta tekshirish</button>`;
}

// Asosiy kirish nuqtasi. Sahifalar shundan boshlanadi:
//   const { rid, key, watcher } = await activate();
export async function activate() {
  return notices(await activateInner());
}

// Namoyish belgisi va obuna tugashi yaqinlashganda ogohlantirish
function notices(res) {
  const show = () => {
    if (res.demo) {
      if (!document.querySelector(".demo-badge")) document.body.insertAdjacentHTML("beforeend", `<div class="demo-badge">NAMOYISH</div>`);
      return;
    }
    const d = daysLeft(res.lic);
    if (d <= 5 && d >= 0) {
      const key = `menyu.warned.${new Date().toDateString()}.${location.pathname}`;
      try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch {}
      document.body.insertAdjacentHTML("beforeend", `<div class="lic-warn">⚠️ <span>Obuna ${d ? `${d} kundan keyin` : "bugun"} tugaydi.${res.lic.phone ? ` Uzaytirish: <b>${esc(res.lic.phone)}</b>` : ""}</span><button aria-label="Yopish">✕</button></div>`);
      const el = document.body.lastElementChild;
      el.querySelector("button").addEventListener("click", () => el.remove());
      setTimeout(() => el.remove(), 20000);
    }
  };
  if (document.body) show(); else addEventListener("DOMContentLoaded", show);
  return res;
}

// Namoyishdan chiqib, haqiqiy restoran kodini kiritish
export function leaveDemo() {
  try { localStorage.removeItem(ACT); localStorage.removeItem("menyu.rid"); } catch {}
  location.href = "index.html";
}

async function activateInner() {
  const p = new URLSearchParams(location.search);
  const want = (p.get("r") || "").trim().toLowerCase();
  if (window.MENYU_DEMO || want === "demo") return demo();
  const act = loadAct();
  const dev = await deviceKeys();

  if (act?.rid && act.lic) {
    const r = await checkLicense(act.lic, act.rid, dev);
    if (r.state === "ok") return ready(act.rid, r, dev);
  }
  if (act?.demo && !act.rid) return demo();
  return waitForLicense(dev, act);
}

function demo() {
  try { localStorage.setItem("menyu.rid", "demo"); } catch {}
  return { rid: "demo", key: null, demo: true, watcher: null };
}

async function ready(rid, r, dev) {
  try { localStorage.setItem("menyu.rid", rid); } catch {}
  rememberServer(r.lic);
  const key = await importDataKey(r.rawKey);
  return { rid, key, lic: r.lic, dev, demo: false, watcher: makeWatcher(rid, dev, r.lic) };
}

// Ishlab turgan planshetda ruxsatnoma yangilansa (uzaytirildi, to'xtatildi, planshet o'chirildi)
function makeWatcher(rid, dev, lic) {
  const w = {
    lic,
    async handle(text) {
      if (!text) return;
      const r = await checkLicense(text, rid, dev);
      if (r.state === "other" || r.state === "bad") return; // begona yoki soxta xabar: e'tiborsiz
      // Eski ruxsatnomani qayta yuborib (masalan to'xtatilgan restoranni) ochib bo'lmaydi
      if ((r.lic?.issued || 0) < (w.lic?.issued || 0)) return;
      if (r.state === "ok") {
        const a = loadAct() || {};
        saveAct({ ...a, rid, lic: text });
        const moved = (r.lic.broker || "") !== (w.lic?.broker || "");
        w.lic = r.lic;
        rememberServer(r.lic);
        closeScreen();
        if (moved) setTimeout(() => location.reload(), 500); // egasi serverni o'zgartirdi: yangisiga ulanamiz
        return;
      }
      const a = loadAct() || {};
      saveAct({ ...a, rid, lic: text });
      lock(r.state, r.lic || w.lic, dev);
    },
    // Muddat ish vaqtida tugasa
    tick() {
      if (w.lic && Date.now() > w.lic.until) lock("expired", w.lic, dev);
    }
  };
  setInterval(() => w.tick(), 60000);
  return w;
}

function lock(state, lic, dev) {
  const el = screen(lockHtml(state, lic, dev));
  el.querySelector("#licRetry").addEventListener("click", () => location.reload());
}

// Faollashtirish: restoran kodini kiritish va egasining tasdig'ini kutish
function waitForLicense(dev, act) {
  return new Promise((resolve) => {
    let client = null;
    let rid = act?.rid || "";
    let name = act?.name || "";

    const askCode = (err = "") => {
      const el = screen(`
        <div class="lic-ico">📲</div>
        <h1>Planshetni faollashtirish</h1>
        <p>Smart Menyu bergan restoran kodini kiriting.</p>
        <label class="lic-field"><span>Restoran kodi</span><input id="licRid" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="masalan: rayhon-4k2m" value="${esc(rid)}"></label>
        <label class="lic-field"><span>Planshet nomi (ixtiyoriy)</span><input id="licName" placeholder="masalan: Zal 1 yoki Oshxona" value="${esc(name)}"></label>
        ${err ? `<p class="lic-err">${err}</p>` : ""}
        <button class="lic-btn" id="licGo">Davom etish</button>
        <p class="lic-meta">Planshet kodi: <b class="lic-code">${prettyId(dev.id)}</b></p>
        <button class="lic-link" id="licDemo">Namoyishni ko'rish</button>`);
      const go = () => {
        const v = el.querySelector("#licRid").value.trim().toLowerCase().replace(/\s+/g, "");
        if (!/^[a-z0-9_-]{3,40}$/.test(v) || v === "demo") { askCode("Kod noto'g'ri. Kodni Smart Menyu'dan oling."); return; }
        rid = v; name = el.querySelector("#licName").value.trim().slice(0, 40);
        saveAct({ rid, name });
        request();
      };
      el.querySelector("#licGo").addEventListener("click", go);
      el.querySelector("#licRid").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
      el.querySelector("#licDemo").addEventListener("click", () => { saveAct({ demo: true }); closeScreen(); client?.end(true); resolve(demo()); });
      el.querySelector("#licRid").focus();
    };

    const waiting = (online, state, lic) => {
      const locked = state && !["pending", "other"].includes(state);
      const el = screen(locked ? lockHtml(state, lic, dev) : `
        <div class="lic-ico lic-spin">⏳</div>
        <h1>Tasdiq kutilmoqda</h1>
        <p>So'rov yuborildi. Smart Menyu egasi bu planshetni tasdiqlashi bilan ilova o'zi ochiladi.</p>
        <div class="lic-box">
          <div><small>Restoran</small><b>${esc(lic?.name || rid)}</b></div>
          <div><small>Planshet kodi</small><b class="lic-code">${prettyId(dev.id)}</b></div>
        </div>
        <p class="lic-meta ${online ? "on" : "off"}">${online ? "● Internetga ulangan" : "● Internet yo'q, ulanmoqda..."}</p>
        <button class="lic-link" id="licBack">Restoran kodini o'zgartirish</button>`);
      el.querySelector("#licBack")?.addEventListener("click", () => { client?.end(true); client = null; askCode(); });
      el.querySelector("#licRetry")?.addEventListener("click", () => location.reload());
    };

    const request = async () => {
      client?.end(true);
      let online = false, last = { state: "pending", lic: null };
      waiting(false);
      if (!window.mqtt) { waiting(false); return; }
      await findServer();
      client = window.mqtt.connect(brokerUrl(), { ...brokerOpts(), clientId: `menyu_act_${dev.id}_${Math.random().toString(16).slice(2, 6)}`, clean: true, keepalive: 30, reconnectPeriod: 3000 });
      const base = `${V2}/${rid}`;
      client.on("connect", () => {
        online = true;
        client.subscribe(`${base}/lic`, { qos: 1 });
        client.publish(`${base}/reg/${dev.id}`, JSON.stringify({ id: dev.id, pub: dev.pub, name, ua: navigator.userAgent.slice(0, 160), at: Date.now() }), { qos: 1, retain: true });
        waiting(true, last.state, last.lic);
      });
      client.on("close", () => { if (online) { online = false; waiting(false, last.state, last.lic); } });
      const minIssued = (() => { try { return JSON.parse(JSON.parse(loadAct()?.lic || "null")?.p || "null")?.issued || 0; } catch { return 0; } })();
      client.on("message", async (topic, payload) => {
        const text = payload.toString();
        const r = await checkLicense(text, rid, dev);
        if (r.lic && r.lic.rid === rid && (r.lic.issued || 0) < minIssued) return;
        if (r.state === "ok") {
          saveAct({ rid, name, lic: text });
          client.end(true);
          closeScreen();
          resolve(await ready(rid, r, dev));
          return;
        }
        if (r.state === "bad") return;
        if (r.state !== "pending" && r.state !== "other") saveAct({ rid, name, lic: text });
        last = r;
        waiting(online, r.state, r.lic);
      });
    };

    if (rid) request(); else askCode();
  });
}
