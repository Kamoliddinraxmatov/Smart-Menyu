// Smart Menyu: restoranlarning Telegram botlari ("Qayta tashrif").
//
// Har restoranning o'z boti bor. Egasi botning tokenini "Smart Menyu Egasi" ilovasida kiritadi. Token shu xizmatning
// ochiq kaliti uchun shifrlanib, egasi imzolagan ruxsatnoma ichida keladi (<v2>/<rid>/lic, lic.wb). Xizmat
// ruxsatnomani egasining ochiq kaliti bilan tekshiradi: tarif Biznes yoki Premium, muddat tugamagan bo'lsa, bot ishlaydi.
// Tarif tushirilsa yoki restoran to'xtatilsa, bot o'zi to'xtaydi.
//
// Mijoz: stol QR kodi -> bot -> til -> telefon raqami. Raqam restoran planshetlariga yuboriladi (<v2>/<rid>/wb/in/<id>).
// Planshet: kupon xabarini yuboradi (<v2>/<rid>/wb/out/<id>), bot uni QR kod rasmi bilan mijozga jo'natadi va
// natijani qaytaradi (<v2>/<rid>/wb/done/<id>). Bu xabarlar restoranning bot kaliti (lic.wb) bilan shifrlangan.
//
// Sozlamalar (muhit o'zgaruvchilari): MQTT_URL, MQTT_USER, MQTT_PASS, DATA_DIR, TG_API.
import fs from "node:fs/promises";
import path from "node:path";
import mqtt from "mqtt";
import QRCode from "qrcode";
import { OWNER } from "../../js/owner-key.js";
import { importVerifyKey, verify, importDataKey, seal, open, unwrapWith, exportPub } from "../../js/crypto.js";
import { has, currentPlan } from "../../js/plan.js";

const V2 = "menyuuz/v2";
const MQTT_URL = process.env.MQTT_URL || "ws://mqtt:9001";
const DATA = process.env.DATA_DIR || "/data";
const TG = (process.env.TG_API || "https://api.telegram.org").replace(/\/$/, "");
const DAY = 86400000;
const C = globalThis.crypto.subtle;
const log = (...a) => console.log(new Date().toISOString(), ...a);

// ---------- Xizmatning kaliti (bir marta yaratiladi, diskda saqlanadi) ----------
const DH = { name: "ECDH", namedCurve: "P-256" };
async function serviceKey() {
  const file = path.join(DATA, "key.json");
  try {
    const jwk = JSON.parse(await fs.readFile(file, "utf8"));
    return { priv: await C.importKey("jwk", jwk, DH, false, ["deriveKey"]), pub: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y } };
  } catch {}
  const kp = await C.generateKey(DH, true, ["deriveKey"]);
  const jwk = await C.exportKey("jwk", kp.privateKey);
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(file, JSON.stringify(jwk), { mode: 0o600 });
  log("yangi xizmat kaliti yaratildi");
  return { priv: kp.privateKey, pub: await exportPub(kp.publicKey) };
}

// ---------- Holat: chatlar (til, stol), yuborilgan xabarlar ----------
let state = { rest: {} };
const stateFile = path.join(DATA, "state.json");
let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await fs.writeFile(stateFile + ".tmp", JSON.stringify(state)); await fs.rename(stateFile + ".tmp", stateFile); } catch (e) { log("holat saqlanmadi:", e.message); }
  }, 500);
}
const rs = (rid) => (state.rest[rid] = state.rest[rid] || { offset: 0, chats: {}, sent: {} });

// ---------- Matnlar ----------
const TXT = {
  uz: {
    ask: (k) => `${k}ga xush kelibsiz! Keyingi tashrifingiz uchun shaxsiy chegirma olish uchun telefon raqamingizni yuboring 👇`,
    btn: "📱 Raqamni yuborish",
    thanks: "Rahmat! Raqamingiz saqlandi. Keyingi tashrifingiz uchun shaxsiy chegirma kuponi shu yerga keladi 🎁",
    own: "Iltimos, o'z raqamingizni pastdagi tugma orqali yuboring 👇",
    again: "Raqamingiz saqlangan. Chegirma kuponi shu yerga keladi 🎁"
  },
  ru: {
    ask: (k) => `Добро пожаловать в ${k}! Чтобы получить персональную скидку на следующий визит, отправьте свой номер телефона 👇`,
    btn: "📱 Отправить номер",
    thanks: "Спасибо! Номер сохранён. Персональный купон на скидку придёт сюда 🎁",
    own: "Пожалуйста, отправьте свой номер кнопкой ниже 👇",
    again: "Ваш номер сохранён. Купон на скидку придёт сюда 🎁"
  },
  en: {
    ask: (k) => `Welcome to ${k}! Share your phone number to get a personal discount for your next visit 👇`,
    btn: "📱 Share my number",
    thanks: "Thank you! Your number is saved. Your personal discount coupon will arrive here 🎁",
    own: "Please share your own number with the button below 👇",
    again: "Your number is saved. Your discount coupon will arrive here 🎁"
  }
};
const LANGS = [["uz", "🇺🇿 O'zbekcha"], ["ru", "🇷🇺 Русский"], ["en", "🇬🇧 English"]];

// ---------- Telegram ----------
async function tg(token, method, body, signal) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${TG}/bot${token}/${method}`, {
    method: "POST",
    headers: isForm ? undefined : { "content-type": "application/json" },
    body: isForm ? body : JSON.stringify(body || {}),
    signal
  });
  const j = await res.json().catch(() => ({ ok: false, error_code: res.status, description: res.statusText }));
  if (!j.ok) { const e = new Error(j.description || "telegram"); e.code = j.error_code; throw e; }
  return j.result;
}

// ---------- Restoranlar ----------
const bots = {};          // rid -> { token, key, name, user, ctl }
const waitingOut = {};    // rid -> { id: raw } (bot ishga tushguncha kelgan xabarlar)
let client = null;
let ownerKey = null;
let svc = null;

function pub(topic, text, retain = true) {
  return new Promise((res) => client.publish(topic, text, { qos: 1, retain }, () => res()));
}
async function pubSealed(rid, topic, obj) {
  const b = bots[rid];
  if (!b) return;
  await pub(topic, await seal(b.key, JSON.stringify(obj), topic));
}

async function onLicense(rid, text) {
  let lic = null;
  try {
    const msg = JSON.parse(text);
    if (await verify(ownerKey, msg.p, msg.s)) lic = JSON.parse(msg.p);
  } catch {}
  if (!lic || lic.rid !== rid) return;
  const cur = bots[rid];
  if (cur && (cur.issued || 0) > (lic.issued || 0)) return; // eski ruxsatnoma
  const ok = lic.wb?.tok && !lic.blocked && Date.now() < (lic.until || 0) && has("winback", currentPlan(lic));
  let token = "", k = "";
  if (ok) {
    try { ({ token, k } = JSON.parse(await unwrapWith(svc.priv, lic.eph, lic.wb.tok, `${rid}/bot`))); } catch { log(rid, "token ochilmadi (boshqa xizmat kaliti uchun yozilgan)"); }
  }
  if (!token || !k) {
    if (cur) { stopBot(rid); log(rid, "bot to'xtatildi"); }
    return;
  }
  if (cur && cur.token === token && cur.k === k) { cur.name = lic.name || cur.name; cur.issued = lic.issued; cur.until = lic.until; return; }
  if (cur) stopBot(rid);
  startBot(rid, { token, k, key: await importDataKey(k), name: lic.name || "", issued: lic.issued, until: lic.until });
}

function stopBot(rid) {
  bots[rid]?.ctl.abort();
  delete bots[rid];
}

async function startBot(rid, b) {
  b.ctl = new AbortController();
  bots[rid] = b;
  const info = (x) => pubSealed(rid, `${V2}/${rid}/wb/info`, { ...x, at: Date.now() });
  try {
    const me = await tg(b.token, "getMe", {}, b.ctl.signal);
    b.user = me.username;
    await tg(b.token, "deleteWebhook", {}, b.ctl.signal).catch(() => {});
    await info({ ok: true, user: me.username, title: me.first_name });
    log(rid, `bot ishga tushdi: @${me.username}`);
  } catch (e) {
    if (b.ctl.signal.aborted) return;
    await info({ ok: false, err: e.code === 401 || e.code === 404 ? "token" : "net" });
    log(rid, "bot ishga tushmadi:", e.message);
    if (e.code === 401 || e.code === 404) { stopBot(rid); return; }
    setTimeout(() => { if (bots[rid] === b) { stopBot(rid); startBot(rid, { ...b }); } }, 30000);
    return;
  }
  for (const [id, raw] of Object.entries(waitingOut[rid] || {})) onOut(rid, id, raw);
  delete waitingOut[rid];
  poll(rid, b);
}

async function poll(rid, b) {
  const s = rs(rid);
  while (bots[rid] === b) {
    try {
      const ups = await tg(b.token, "getUpdates", { offset: s.offset, timeout: 50, allowed_updates: ["message", "callback_query"] }, b.ctl.signal);
      for (const u of ups) {
        s.offset = u.update_id + 1;
        try { await onUpdate(rid, b, u); } catch (e) { log(rid, "xabar:", e.message); }
      }
      if (ups.length) saveState();
    } catch (e) {
      if (b.ctl.signal.aborted) return;
      if (e.code === 401) { stopBot(rid); return; }
      await new Promise((r) => setTimeout(r, e.code === 409 ? 10000 : 3000));
    }
  }
}

const langOf = (s) => (TXT[s] ? s : "uz");
async function askPhone(b, chat, lang) {
  const t = TXT[lang];
  await tg(b.token, "sendMessage", {
    chat_id: chat, text: t.ask(b.name || "Restoran"),
    reply_markup: { keyboard: [[{ text: t.btn, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true }
  });
}

async function onUpdate(rid, b, u) {
  const s = rs(rid);
  if (u.callback_query) {
    const q = u.callback_query;
    const chat = q.message?.chat?.id;
    await tg(b.token, "answerCallbackQuery", { callback_query_id: q.id }).catch(() => {});
    const m = /^l:(uz|ru|en)$/.exec(q.data || "");
    if (!m || !chat) return;
    const c = s.chats[chat] = { ...(s.chats[chat] || {}), lang: m[1] };
    if (c.phone) return tg(b.token, "sendMessage", { chat_id: chat, text: TXT[c.lang].again });
    return askPhone(b, chat, c.lang);
  }
  const msg = u.message;
  if (!msg || msg.chat?.type !== "private") return;
  const chat = msg.chat.id;
  const c = s.chats[chat] = s.chats[chat] || {};
  if (msg.contact) {
    const lang = langOf(c.lang);
    if (msg.contact.user_id && msg.contact.user_id !== msg.from?.id) return askPhone(b, chat, lang).then(() => tg(b.token, "sendMessage", { chat_id: chat, text: TXT[lang].own }));
    c.phone = String(msg.contact.phone_number || "").replace(/[^\d+]/g, "");
    const rec = {
      chat, phone: c.phone, lang,
      name: [msg.contact.first_name || msg.from?.first_name, msg.contact.last_name || msg.from?.last_name].filter(Boolean).join(" ").slice(0, 60),
      table: c.table || "", scanAt: c.scanAt || 0, at: Date.now()
    };
    const id = `${chat}-${Date.now().toString(36)}`;
    await pubSealed(rid, `${V2}/${rid}/wb/in/${id}`, rec);
    saveState();
    return tg(b.token, "sendMessage", { chat_id: chat, text: TXT[lang].thanks, reply_markup: { remove_keyboard: true } });
  }
  const text = String(msg.text || "");
  if (text.startsWith("/start")) {
    const arg = text.split(/\s+/)[1] || "";
    const tm = /^t_([A-Za-z0-9_-]{1,60})$/.exec(arg);
    if (tm) { c.table = tm[1]; c.scanAt = Date.now(); }
    saveState();
    // Raqami bor mijoz yana stolni skanerladi: tashrifi shu stolga yoziladi
    if (c.phone && c.lang && tm) {
      const id = `${chat}-${Date.now().toString(36)}`;
      await pubSealed(rid, `${V2}/${rid}/wb/in/${id}`, { chat, phone: c.phone, lang: c.lang, name: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ").slice(0, 60), table: c.table, scanAt: c.scanAt, at: Date.now() });
      return tg(b.token, "sendMessage", { chat_id: chat, text: TXT[c.lang].again });
    }
    return tg(b.token, "sendMessage", {
      chat_id: chat, text: "Tilni tanlang · Выберите язык · Choose language",
      reply_markup: { inline_keyboard: [LANGS.map(([l, t]) => ({ text: t, callback_data: `l:${l}` }))] }
    });
  }
  if (!c.phone) return c.lang ? askPhone(b, chat, langOf(c.lang)) : tg(b.token, "sendMessage", {
    chat_id: chat, text: "Tilni tanlang · Выберите язык · Choose language",
    reply_markup: { inline_keyboard: [LANGS.map(([l, t]) => ({ text: t, callback_data: `l:${l}` }))] }
  });
}

// Planshetdan kupon xabari: QR kod rasmi + matn
async function onOut(rid, id, raw) {
  const topic = `${V2}/${rid}/wb/out/${id}`;
  const b = bots[rid];
  if (!b) { (waitingOut[rid] = waitingOut[rid] || {})[id] = raw; return; }
  let m;
  try { m = JSON.parse(await open(b.key, raw, topic)); } catch { return; } // begona yoki soxta
  const s = rs(rid);
  const done = (res) => Promise.all([pub(topic, ""), pubSealed(rid, `${V2}/${rid}/wb/done/${id}`, { ...res, code: m.code, at: Date.now() })]);
  if (s.sent[id]) return done({ ok: true, again: true });
  try {
    const png = await QRCode.toBuffer(String(m.code), { width: 480, margin: 2, errorCorrectionLevel: "M" });
    const form = new FormData();
    form.append("chat_id", String(m.chat));
    form.append("caption", String(m.text || "").slice(0, 1024));
    form.append("photo", new Blob([png], { type: "image/png" }), `${m.code}.png`);
    await tg(b.token, "sendPhoto", form);
    s.sent[id] = Date.now();
    // 120 kundan eskilarini unutamiz
    for (const [k, t] of Object.entries(s.sent)) if (Date.now() - t > 120 * DAY) delete s.sent[k];
    saveState();
    await done({ ok: true });
    log(rid, "kupon yuborildi", m.code);
  } catch (e) {
    // 403: mijoz botni bloklagan; 400: chat topilmadi. Qolganlari (internet) keyinroq qayta urinib ko'riladi.
    if (e.code === 403 || e.code === 400) { await done({ ok: false, err: e.code === 403 ? "blocked" : "chat" }); return; }
    setTimeout(() => onOut(rid, id, raw), 60000);
  }
}

// ---------- Ishga tushirish ----------
async function main() {
  try { state = JSON.parse(await fs.readFile(stateFile, "utf8")); } catch {}
  state.rest = state.rest || {};
  svc = await serviceKey();
  ownerKey = await importVerifyKey(OWNER.pub);
  client = mqtt.connect(MQTT_URL, {
    username: process.env.MQTT_USER || undefined, password: process.env.MQTT_PASS || undefined,
    clientId: `menyu_bot_${Math.random().toString(16).slice(2, 10)}`, clean: true, keepalive: 30, reconnectPeriod: 3000
  });
  client.on("connect", () => {
    log("serverga ulandi:", MQTT_URL);
    // Egasi ilovasi tokenni shu kalit uchun shifrlaydi
    pub(`${V2}/_bot/pub`, JSON.stringify({ pub: svc.pub, at: Date.now() }));
    client.subscribe([`${V2}/+/lic`, `${V2}/+/wb/out/+`], { qos: 1 });
  });
  client.on("error", (e) => log("MQTT:", e.message));
  let inbox = Promise.resolve();
  client.on("message", (topic, payload) => {
    const text = payload.toString();
    inbox = inbox.then(async () => {
      const p = topic.split("/");
      const rid = p[2];
      if (!/^[a-z0-9_-]{3,40}$/.test(rid || "")) return;
      if (p[3] === "lic" && p.length === 4 && text) await onLicense(rid, text);
      else if (p[3] === "wb" && p[4] === "out" && p.length === 6 && text) await onOut(rid, p[5], text);
    }).catch((e) => log("xato:", e.message));
  });
  // Muddati tugagan restoranlarning botini to'xtatish
  setInterval(() => { for (const [rid, b] of Object.entries(bots)) if (Date.now() > (b.until || 0)) stopBot(rid); }, 3600000);
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, async () => { clearTimeout(saveTimer); try { await fs.writeFile(stateFile, JSON.stringify(state)); } catch {} process.exit(0); });
}

main();
