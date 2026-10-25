// Smart Menyu AI ofisi: bir nechta tekin AI xodim Smart Menyu sotuvini tayyorlaydi, Kamoliddin Telegram orqali boshqaradi.
//
// Ofis o'zi hech kimga yozmaydi. Mijozga ketadigan har bir xabar avval kod tekshiruvidan (guard.mjs), keyin nazoratchi
// AI'dan o'tadi va Kamoliddinga "✅ / ❌" tugmalari bilan keladi. Tasdiqlansa, bot matnni va restoran kontaktini beradi,
// Kamoliddin o'zi yuboradi (Telegram/Instagram spam qoidalari buzilmaydi, akkaunt bloklanmaydi).
//
// Buyruqlar: /holat, /vazifa <matn>, /majlis [mavzu], /kengash [mavzu], /raqamlar <matn>, /xabarlar, CSV fayl = restoranlar ro'yxati.
// Har dushanba 09:00 (Toshkent) boshqaruv kengashi o'zi yig'iladi (kengash bo'sh bo'lsa, xodimlar majlisi).
// Direktor yangi xodim so'rasa, vakansiya kartasi keladi. Kim ishlashi profile.json da (roles.mjs ga qarang).
//
// Sozlamalar (office.env): OFFICE_BOT_TOKEN, OWNER_CHAT_ID, GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY,
// LLM_DAILY_LIMIT, OFFICE_DRAFTS_PER_DAY, DATA_DIR, TG_API.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLLM } from "./llm.mjs";
import { allRoles, BOARD, PROFILE } from "./roles.mjs";
import { scoreLeads, draftMessage, runTask, council, boardMeeting, vacancy } from "./work.mjs";

const env = process.env;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA = env.DATA_DIR || "/data/office";
const TG = (env.TG_API || "https://api.telegram.org").replace(/\/$/, "");
const TOKEN = env.OFFICE_BOT_TOKEN;
const OWNER = String(env.OWNER_CHAT_ID || "");
const DRAFTS = Number(env.OFFICE_DRAFTS_PER_DAY || 20);
const log = (...a) => console.log(new Date().toISOString(), ...a);

// ---------- Holat ----------
let state = { offset: 0, usage: {}, leads: [], approvals: {}, roles: [], decisions: [], metrics: [], lastMajlis: "", seq: 0 };
const stateFile = path.join(DATA, "state.json");
async function saveState() {
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(stateFile + ".tmp", JSON.stringify(state));
  await fs.rename(stateFile + ".tmp", stateFile);
}
const nextId = () => String(++state.seq);

// ---------- Telegram ----------
async function tg(method, body) {
  const res = await fetch(`${TG}/bot${TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {})
  });
  const j = await res.json().catch(() => ({ ok: false, description: res.statusText }));
  if (!j.ok) throw new Error(j.description || "telegram");
  return j.result;
}
async function send(text, buttons) {
  const parts = [];
  for (let s = String(text); s.length; s = s.slice(3900)) parts.push(s.slice(0, 3900));
  for (let i = 0; i < parts.length; i++) {
    await tg("sendMessage", {
      chat_id: OWNER, text: parts[i], disable_web_page_preview: true,
      ...(buttons && i === parts.length - 1 ? { reply_markup: { inline_keyboard: [buttons] } } : {})
    });
  }
}
const okNo = (id) => [{ text: "✅ Tasdiqlash", callback_data: `ok:${id}` }, { text: "❌ Rad etish", callback_data: `no:${id}` }];

// ---------- AI ----------
let llm, facts;
const ctx = () => ({ ask: llm.ask, facts, state });
// AI ishlari ketma-ket bajariladi: tekin limit tez tugamasin va majlis bilan xabarlar aralashmasin.
let queue = Promise.resolve();
const job = (name, fn) => (queue = queue.then(async () => {
  try { await fn(); } catch (e) { log(name, "xato:", e.message); await send(`⚠️ ${name}: ${e.message}`).catch(() => {}); }
  await saveState();
}));

// ---------- Restoranlar ro'yxati (CSV) ----------
const COLS = { name: /^(name|nomi|nom|restoran|название)$/i, address: /^(address|manzil|адрес)$/i, phone: /^(phone|telefon|tel|телефон)$/i,
  instagram: /^(instagram|insta)$/i, tables: /^(tables|stol|stollar|столы)$/i, category: /^(category|turi|тип|категория)$/i, note: /^(note|izoh|примечание)$/i };
export function parseCSV(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
  const split = (l) => {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === sep) { out.push(cur.trim()); cur = ""; } else cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const head = split(lines[0]).map((h) => Object.keys(COLS).find((k) => COLS[k].test(h)) || null);
  return lines.slice(1).map((l) => {
    const row = {};
    split(l).forEach((v, i) => { if (head[i] && v) row[head[i]] = v; });
    return row;
  }).filter((r) => r.name);
}

async function importLeads(doc) {
  const f = await tg("getFile", { file_id: doc.file_id });
  const res = await fetch(`${TG}/file/bot${TOKEN}/${f.file_path}`);
  const rows = parseCSV(await res.text());
  const known = new Set(state.leads.map((l) => (l.name + "|" + (l.address || "")).toLowerCase()));
  const fresh = rows.filter((r) => !known.has((r.name + "|" + (r.address || "")).toLowerCase()))
    .map((r) => ({ ...r, id: nextId(), status: "yangi", added: new Date().toISOString() }));
  state.leads.push(...fresh);
  await send(`📥 ${rows.length} ta qator, ${fresh.length} ta yangi restoran qo'shildi. Mijoz qidiruvchi baholayapti...`);
  await scoreLeads(ctx(), fresh);
  const good = fresh.filter((l) => l.score >= 6).length;
  await send(`📊 Baholandi: ${good} tasi yaxshi mijoz (6+ ball). Xabar qoralamalari tayyorlanmoqda...`);
  await draftBatch();
}

// Eng yuqori balli, hali xabar yozilmagan restoranlarga qoralama. Kuniga OFFICE_DRAFTS_PER_DAY tadan ko'p emas.
async function draftBatch() {
  const day = new Date().toISOString().slice(0, 10);
  const done = state.leads.filter((l) => l.drafted === day).length;
  const todo = state.leads.filter((l) => l.status === "yangi" && (l.score || 0) >= 6)
    .sort((a, b) => b.score - a.score).slice(0, Math.max(0, DRAFTS - done));
  if (!todo.length) { await send(done >= DRAFTS ? `Bugungi ${DRAFTS} ta qoralama chegarasi tugadi.` : "Xabar yoziladigan yangi restoran yo'q. CSV ro'yxat yuboring."); return; }
  for (const l of todo) {
    const d = await draftMessage(ctx(), l);
    l.drafted = day;
    if (!d.text) { l.status = "qoralama-yo'q"; await send(`⚠️ ${l.name}: toza xabar yozilmadi (${d.note}). O'tkazib yuborildi.`); continue; }
    l.status = "kutilmoqda"; l.draft = d.text;
    const id = nextId();
    state.approvals[id] = { type: "xabar", lead: l.id };
    await send(`✉️ ${l.name} (${l.score}/10)\n${l.why || ""}\n\n${d.text}${d.note ? `\n\nNazoratchi: ${d.note}` : ""}`, okNo(id));
    await saveState();
  }
}

// ---------- Majlis ----------
function stats() {
  const by = (s) => state.leads.filter((l) => l.status === s).length;
  return `Restoranlar: ${state.leads.length}, yuborishga tasdiqlangan: ${by("tasdiqlandi")}, rad etilgan: ${by("rad")}, kutilmoqda: ${by("kutilmoqda")}. ` +
    `Oxirgi qarorlar: ${state.decisions.slice(-3).map((d) => d.text).join(" | ") || "yo'q"}.`;
}
async function majlis(topic) {
  await send(`🏛 Majlis boshlandi: ${topic}`);
  const r = await council(ctx(), topic, `Holat: ${stats()}`);
  const lines = r.proposals.map((p, i) => `${i + 1}. ${p.title} [${p.provider}] — ${r.tally[i]} ovoz\n${p.text}`).join("\n\n");
  const id = nextId();
  state.approvals[id] = { type: "majlis", topic, text: `${r.winner.title}: ${r.winner.text}` };
  await send(`🏛 Majlis: ${topic}\n\n${lines}\n\n🔎 Nazoratchi tanqidi:\n${r.critique}\n\n` +
    `🗳 G'olib: ${r.winnerNo}-taklif (${r.winner.title}). Tasdiqlaysizmi?`, okNo(id));
  const v = await vacancy(ctx(), `${r.winner.title}: ${r.winner.text}`);
  if (v) {
    const vid = nextId();
    state.approvals[vid] = { type: "vakansiya", ...v };
    await send(`🧑‍💼 Vakansiya so'rovi (direktordan)\nLavozim: ${v.title}\nVazifa: ${v.job}\nNega: ${v.why}\n\nTasdiqlasangiz, yangi AI xodim ofisga qo'shiladi (hozirgi tekin modellardan foydalanadi).`, okNo(vid));
  }
}

// ---------- Boshqaruv kengashi ----------
// Kengash oxirgi raqamlar, o'tgan qarorlar va ularning vazifalariga qarab gapiradi: shunda har hafta o'tgan haftani tekshiradi.
function boardContext() {
  const m = state.metrics.slice(-2).map((x) => `${x.at.slice(0, 10)}: ${x.text}`).join("\n") || "kiritilmagan (egasidan /raqamlar so'rang)";
  const last = state.decisions.slice(-2).map((d) =>
    `${d.at.slice(0, 10)} qaror: ${d.text}${d.tasks?.length ? `\nVazifalar: ${d.tasks.map((t) => `${t.vazifa} (${t.kim})`).join("; ")}` : ""}`).join("\n") || "yo'q";
  return `Haftalik raqamlar:\n${m}\nO'tgan qarorlar:\n${last}\nOfis holati: ${stats()}`;
}
async function kengash(topic) {
  await send(`👔 Boshqaruv kengashi yig'ildi: ${topic}\nA'zolar: ${BOARD.map((b) => b.title).join(", ")}`);
  const r = await boardMeeting(ctx(), topic, boardContext());
  const lines = r.proposals.map((p, i) => `${i + 1}. ${p.title} [${p.provider}] — ${r.tally[i]} ovoz\n${p.text}`).join("\n\n");
  const tasks = r.tasks.map((t, i) => `${i + 1}. ${t.vazifa}\n   Kim: ${t.kim}${t.natija ? `. O'lchov: ${t.natija}` : ""}`).join("\n");
  const id = nextId();
  state.approvals[id] = { type: "majlis", topic, text: `${r.winner.title}: ${r.winner.text}`, tasks: r.tasks };
  await send(`👔 Kengash: ${topic}\n\n${lines}\n\n🔎 Nazoratchi tanqidi:\n${r.critique}\n\n` +
    `🗳 Qaror: ${r.winnerNo}-taklif (${r.winner.title}).\n\n📋 Keyingi hafta vazifalari:\n${tasks || "direktor vazifa chiqara olmadi"}` +
    `${r.problems.length ? `\n\n⚠️ Tekshiruv: ${r.problems.join("; ")} — mijozga shu holda aytmang.` : ""}\n\nTasdiqlaysizmi?`, okNo(id));
}

// ---------- Tasdiqlash tugmalari ----------
async function decide(id, yes) {
  const a = state.approvals[id];
  if (!a) return "Bu karta allaqachon hal qilingan.";
  delete state.approvals[id];
  if (a.type === "xabar") {
    const l = state.leads.find((x) => x.id === a.lead);
    if (!l) return "Restoran topilmadi.";
    l.status = yes ? "tasdiqlandi" : "rad";
    if (!yes) return `❌ ${l.name}: rad etildi.`;
    const to = [l.phone && `Telefon: ${l.phone}`, l.instagram && `Instagram: ${l.instagram}`].filter(Boolean).join("\n") || "Kontakt yo'q, o'zingiz toping";
    await send(`📤 Endi o'zingiz yuboring:\n${l.name}\n${to}\n\n${l.draft}`);
    return `✅ ${l.name}: tasdiqlandi.`;
  }
  if (a.type === "majlis") {
    if (yes) state.decisions.push({ at: new Date().toISOString(), topic: a.topic, text: a.text, tasks: a.tasks || [] });
    return yes ? "✅ Majlis qarori qabul qilindi va ofis xotirasiga yozildi." : "❌ Majlis qarori rad etildi.";
  }
  if (a.type === "vakansiya") {
    if (!yes) return `❌ Vakansiya rad etildi: ${a.title}.`;
    const n = allRoles(state).length;
    state.roles.push({ id: `x${n}`, title: a.title, job: a.job, prefer: n });
    return `✅ Yangi xodim ofisga qo'shildi: ${a.title}.`;
  }
  return "Noma'lum karta.";
}

// ---------- Buyruqlar ----------
const HELP = `${PROFILE.company} AI ofisi 🏢
/holat — ofis holati va AI limitlari
/vazifa <matn> — direktor vazifani xodimlarga bo'lib beradi
/majlis [mavzu] — xodimlar munozara qilib ovoz beradi
/kengash [mavzu] — boshqaruv kengashi qaror va haftalik vazifalar chiqaradi
/raqamlar <matn> — haftalik raqamlar (sotuv, xarajat, yangi mijozlar), kengash shularga qarab gapiradi
/xabarlar — navbatdagi restoranlarga xabar qoralamasi
CSV fayl yuboring — restoranlar ro'yxati (ustunlar: nomi, manzil, telefon, instagram, stol, turi, izoh)

Ofis o'zi hech kimga yozmaydi: har xabar sizning tasdig'ingiz bilan keladi.`;

async function onMessage(m) {
  const chat = String(m.chat.id);
  if (!OWNER) { await tg("sendMessage", { chat_id: chat, text: `Sizning chat ID: ${chat}\noffice.env ga OWNER_CHAT_ID=${chat} yozing va ofisni qayta ishga tushiring.` }); return; }
  if (chat !== OWNER) return;
  const text = (m.text || "").trim();
  if (m.document) {
    if (!/\.csv$/i.test(m.document.file_name || "")) { await send("Faqat .csv fayl qabul qilinadi."); return; }
    job("Ro'yxat", () => importLeads(m.document));
    return;
  }
  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(" ");
  if (cmd === "/start" || cmd === "/yordam") return send(HELP);
  if (cmd === "/holat") {
    const u = llm.usage().map((p) => `${p.label}: ${p.used}/${p.limit}`).join(", ") || "AI kaliti yo'q";
    return send(`🏢 Xodimlar: ${allRoles(state).map((r) => r.title).join(", ")}\n👔 Kengash: ${BOARD.map((b) => b.title).join(", ") || "yo'q"}\n📊 ${stats()}\n🧠 Bugun AI so'rovlari: ${u}\n⏳ Tasdiq kutayotgan kartalar: ${Object.keys(state.approvals).length}`);
  }
  if (cmd === "/vazifa") {
    if (!arg) return send("Vazifani yozing: /vazifa Samarqanddagi restoranlar uchun Instagram post");
    await send("📋 Direktor vazifani bo'lyapti...");
    job("Vazifa", async () => {
      const res = await runTask(ctx(), arg);
      if (!res.length) { await send("Direktor vazifani bo'la olmadi, aniqroq yozing."); return; }
      for (const r of res) await send(`👤 ${r.title} [${r.provider}]\nTopshiriq: ${r.vazifa}\n\n${r.text}${r.problems.length ? `\n\n⚠️ Tekshiruv: ${r.problems.join("; ")} — mijozga yubormang.` : ""}`);
    });
    return;
  }
  if (cmd === "/majlis") { job("Majlis", () => majlis(arg || "Keyingi hafta sotuvni qanday oshiramiz?")); return; }
  if (cmd === "/kengash") { job("Kengash", () => kengash(arg || "Keyingi hafta biznesni qanday o'stiramiz?")); return; }
  if (cmd === "/raqamlar") {
    if (!arg) return send("Raqamlarni yozing: /raqamlar sotuv 12 mln, xarajat 8 mln, yangi mijoz 5, demo 3");
    state.metrics = [...state.metrics, { at: new Date().toISOString(), text: arg.slice(0, 1000) }].slice(-12);
    await saveState();
    return send("📈 Raqamlar saqlandi. Kengash keyingi majlisda shularga qaraydi.");
  }
  if (cmd === "/xabarlar") { job("Xabarlar", draftBatch); return; }
  return send(HELP);
}

async function onCallback(q) {
  if (String(q.message?.chat?.id) !== OWNER) return;
  const [kind, id] = String(q.data || "").split(":");
  const reply = await decide(id, kind === "ok");
  await saveState();
  await tg("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {});
  await tg("editMessageReplyMarkup", { chat_id: OWNER, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
  await send(reply);
}

// ---------- Haftalik majlis: dushanba 09:00 Toshkent vaqti (UTC+5) ----------
function weekly() {
  const t = new Date(Date.now() + 5 * 3600000);
  const day = t.toISOString().slice(0, 10);
  if (t.getUTCDay() === 1 && t.getUTCHours() >= 9 && state.lastMajlis !== day && OWNER) {
    state.lastMajlis = day;
    const topic = "Haftalik majlis: o'tgan haftani baholash va keyingi hafta rejasi";
    job("Haftalik majlis", () => (BOARD.length ? kengash(topic) : majlis(topic)));
  }
}

async function main() {
  try { state = { ...state, ...JSON.parse(await fs.readFile(stateFile, "utf8")) }; } catch {}
  facts = await fs.readFile(path.join(DIR, "facts.md"), "utf8");
  llm = createLLM(env, state.usage);
  if (!TOKEN) { log("OFFICE_BOT_TOKEN yo'q: ofis kutish rejimida (office.env ni to'ldiring)"); setInterval(() => {}, 1 << 30); return; }
  log(`ofis ishga tushdi: ${llm.providers.map((p) => p.label).join(", ") || "AI kaliti yo'q"}`);
  setInterval(weekly, 60000);
  for (;;) {
    try {
      const ups = await tg("getUpdates", { offset: state.offset, timeout: 50, allowed_updates: ["message", "callback_query"] });
      for (const u of ups) {
        state.offset = u.update_id + 1;
        try {
          if (u.message) await onMessage(u.message);
          if (u.callback_query) await onCallback(u.callback_query);
        } catch (e) { log("xabar xatosi:", e.message); }
      }
      if (ups.length) await saveState();
    } catch (e) { log("telegram:", e.message); await new Promise((r) => setTimeout(r, 5000)); }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
