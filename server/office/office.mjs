// Virtual ofis: tekin AI xodimlar Kamoliddinning loyihalari (Smart Menyu, UZBIONIC, Novum web ...) bo'yicha topshiriqlarni
// bajaradi, Kamoliddin Telegram orqali boshqaradi.
//
// Ofis o'zi ish boshlamaydi: har buyruqda avval "qaysi loyiha?" deb tugmalar bilan so'raydi, mavzu yoki topshiriq
// yozilmagan bo'lsa, uni ham so'raydi. Har loyihaning o'z faktlari, qarorlari va raqamlari bor (projects.mjs), har
// loyihaning ishi o'z navbatida bajariladi: 2-3 loyiha parallel ishlaydi, bir loyiha ikkinchisini kutmaydi.
//
// Ofis o'zi hech kimga yozmaydi. Mijozga ketadigan har bir xabar avval kod tekshiruvidan (guard.mjs), keyin nazoratchi
// AI'dan o'tadi va Kamoliddinga "✅ / ❌" tugmalari bilan keladi. Tasdiqlansa, bot matnni va restoran kontaktini beradi,
// Kamoliddin o'zi yuboradi (Telegram/Instagram spam qoidalari buzilmaydi, akkaunt bloklanmaydi).
//
// Buyruqlar: /loyiha [nom], /fakt <matn>, /holat, /vazifa <matn>, /majlis [mavzu], /kengash [mavzu], /raqamlar <matn>,
// /bekor, /xabarlar va CSV fayl (restoranlar ro'yxati, faqat asosiy loyiha). Oddiy matn = yangi topshiriq.
// Har dushanba 09:00 (Toshkent) bot haftalik kengash qaysi loyiha bo'yicha bo'lishini so'raydi, o'zi boshlamaydi.
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
import { MAIN, migrate, list, find, create, view } from "./projects.mjs";

const env = process.env;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA = env.DATA_DIR || "/data/office";
const TG = (env.TG_API || "https://api.telegram.org").replace(/\/$/, "");
const TOKEN = env.OFFICE_BOT_TOKEN;
const OWNER = String(env.OWNER_CHAT_ID || "");
const DRAFTS = Number(env.OFFICE_DRAFTS_PER_DAY || 20);
const log = (...a) => console.log(new Date().toISOString(), ...a);

// ---------- Holat ----------
// projects: loyihalar (projects.mjs). asks: "qaysi loyiha?" kartalari. waiting: bot egasidan matn kutyapti (mavzu, topshiriq...).
let state = { offset: 0, usage: {}, leads: [], approvals: {}, projects: {}, asks: {}, waiting: null, lastMajlis: "", seq: 0 };
const stateFile = path.join(DATA, "state.json");
// Bir nechta loyiha bir vaqtda saqlaydi: yozuvlar ketma-ket bo'lsin, fayl buzilmasin.
let saving = Promise.resolve();
function saveState() {
  return (saving = saving.then(async () => {
    await fs.mkdir(DATA, { recursive: true });
    await fs.writeFile(stateFile + ".tmp", JSON.stringify(state));
    await fs.rename(stateFile + ".tmp", stateFile);
  }).catch((e) => log("holat saqlanmadi:", e.message)));
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
// buttons: bitta qator [{text, callback_data}] yoki qatorlar [[...], [...]].
async function send(text, buttons) {
  const rows = buttons && (Array.isArray(buttons[0]) ? buttons : [buttons]);
  const parts = [];
  for (let s = String(text); s.length; s = s.slice(3900)) parts.push(s.slice(0, 3900));
  for (let i = 0; i < parts.length; i++) {
    await tg("sendMessage", {
      chat_id: OWNER, text: parts[i], disable_web_page_preview: true,
      ...(rows && i === parts.length - 1 ? { reply_markup: { inline_keyboard: rows } } : {})
    });
  }
}
const okNo = (id) => [{ text: "✅ Tasdiqlash", callback_data: `ok:${id}` }, { text: "❌ Rad etish", callback_data: `no:${id}` }];

// ---------- AI ----------
let llm, facts;
const name = (pid) => state.projects[pid]?.name || pid;
const ctx = (pid) => ({ ask: llm.ask, project: view(state, pid, facts) });
// Har loyihaning AI ishlari o'z navbatida ketma-ket bajariladi (majlis bilan xabarlar aralashmasin), loyihalar esa parallel.
const queues = {};
const busy = {};
const job = (pid, title, fn) => {
  busy[pid] = (busy[pid] || 0) + 1;
  queues[pid] = (queues[pid] || Promise.resolve()).then(async () => {
    try { await fn(); } catch (e) { log(pid, title, "xato:", e.message); await send(`⚠️ [${name(pid)}] ${title}: ${e.message}`).catch(() => {}); }
    busy[pid]--;
    await saveState();
  });
};

// ---------- Restoranlar ro'yxati (CSV), faqat asosiy loyiha ----------
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
  await send(`📥 [${name(MAIN)}] ${rows.length} ta qator, ${fresh.length} ta yangi restoran qo'shildi. Mijoz qidiruvchi baholayapti...`);
  await scoreLeads(ctx(MAIN), fresh);
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
    const d = await draftMessage(ctx(MAIN), l);
    l.drafted = day;
    if (!d.text) { l.status = "qoralama-yo'q"; await send(`⚠️ ${l.name}: toza xabar yozilmadi (${d.note}). O'tkazib yuborildi.`); continue; }
    l.status = "kutilmoqda"; l.draft = d.text;
    const id = nextId();
    state.approvals[id] = { type: "xabar", lead: l.id };
    await send(`✉️ ${l.name} (${l.score}/10)\n${l.why || ""}\n\n${d.text}${d.note ? `\n\nNazoratchi: ${d.note}` : ""}`, okNo(id));
    await saveState();
  }
}

// ---------- Topshiriq ----------
async function vazifa(pid, goal) {
  const res = await runTask(ctx(pid), goal);
  if (!res.length) { await send(`[${name(pid)}] Direktor topshiriqni bo'la olmadi, aniqroq yozing.`); return; }
  const temp = res.filter((r) => r.temp).map((r) => r.title);
  if (temp.length) await send(`[${name(pid)}] 🧑‍🔧 Shu topshiriq uchun vaqtinchalik mutaxassis olindi: ${temp.join(", ")}. Ish tugagach ular ketadi.`);
  for (const r of res) await send(`[${name(pid)}] 👤 ${r.title} [${r.provider}]\nTopshiriq: ${r.vazifa}\n\n${r.text}${r.problems.length ? `\n\n⚠️ Tekshiruv: ${r.problems.join("; ")} — mijozga yubormang.` : ""}`);
  await send(`[${name(pid)}] ✅ Topshiriq bajarildi: ${goal.slice(0, 200)}`);
}

// ---------- Majlis ----------
function stats(pid) {
  const p = state.projects[pid];
  const by = (s) => state.leads.filter((l) => l.status === s).length;
  const leads = pid === MAIN
    ? `Restoranlar: ${state.leads.length}, yuborishga tasdiqlangan: ${by("tasdiqlandi")}, rad etilgan: ${by("rad")}, kutilmoqda: ${by("kutilmoqda")}. ` : "";
  return `${leads}Oxirgi qarorlar: ${p.decisions.slice(-3).map((d) => d.text).join(" | ") || "yo'q"}.`;
}
async function majlis(pid, topic) {
  await send(`🏛 [${name(pid)}] Majlis boshlandi: ${topic}`);
  const r = await council(ctx(pid), topic, `Holat: ${stats(pid)}`);
  const lines = r.proposals.map((p, i) => `${i + 1}. ${p.title} [${p.provider}] — ${r.tally[i]} ovoz\n${p.text}`).join("\n\n");
  const id = nextId();
  state.approvals[id] = { type: "majlis", project: pid, topic, text: `${r.winner.title}: ${r.winner.text}` };
  await send(`🏛 [${name(pid)}] Majlis: ${topic}\n\n${lines}\n\n🔎 Nazoratchi tanqidi:\n${r.critique}\n\n` +
    `🗳 G'olib: ${r.winnerNo}-taklif (${r.winner.title}). Tasdiqlaysizmi?`, okNo(id));
  const v = await vacancy(ctx(pid), `${r.winner.title}: ${r.winner.text}`);
  if (v) {
    const vid = nextId();
    state.approvals[vid] = { type: "vakansiya", project: pid, ...v };
    await send(`🧑‍💼 [${name(pid)}] Vakansiya so'rovi (direktordan)\nLavozim: ${v.title}\nVazifa: ${v.job}\nNega: ${v.why}\n\nTasdiqlasangiz, yangi AI xodim shu loyihaga qo'shiladi (hozirgi tekin modellardan foydalanadi).`, okNo(vid));
  }
}

// ---------- Boshqaruv kengashi ----------
// Kengash loyihaning oxirgi raqamlari, o'tgan qarorlari va ularning vazifalariga qarab gapiradi: har hafta o'tgan haftani tekshiradi.
function boardContext(pid) {
  const p = state.projects[pid];
  const m = p.metrics.slice(-2).map((x) => `${x.at.slice(0, 10)}: ${x.text}`).join("\n") || "kiritilmagan (egasidan /raqamlar so'rang)";
  const last = p.decisions.slice(-2).map((d) =>
    `${d.at.slice(0, 10)} qaror: ${d.text}${d.tasks?.length ? `\nVazifalar: ${d.tasks.map((t) => `${t.vazifa} (${t.kim})`).join("; ")}` : ""}`).join("\n") || "yo'q";
  return `Loyiha: ${p.name}\nHaftalik raqamlar:\n${m}\nO'tgan qarorlar:\n${last}\nOfis holati: ${stats(pid)}`;
}
async function kengash(pid, topic) {
  await send(`👔 [${name(pid)}] Boshqaruv kengashi yig'ildi: ${topic}\nA'zolar: ${BOARD.map((b) => b.title).join(", ")}`);
  const r = await boardMeeting(ctx(pid), topic, boardContext(pid));
  const lines = r.proposals.map((p, i) => `${i + 1}. ${p.title} [${p.provider}] — ${r.tally[i]} ovoz\n${p.text}`).join("\n\n");
  const tasks = r.tasks.map((t, i) => `${i + 1}. ${t.vazifa}\n   Kim: ${t.kim}${t.natija ? `. O'lchov: ${t.natija}` : ""}`).join("\n");
  const id = nextId();
  state.approvals[id] = { type: "majlis", project: pid, topic, text: `${r.winner.title}: ${r.winner.text}`, tasks: r.tasks };
  await send(`👔 [${name(pid)}] Kengash: ${topic}\n\n${lines}\n\n🔎 Nazoratchi tanqidi:\n${r.critique}\n\n` +
    `🗳 Qaror: ${r.winnerNo}-taklif (${r.winner.title}).\n\n📋 Keyingi hafta vazifalari:\n${tasks || "direktor vazifa chiqara olmadi"}` +
    `${r.problems.length ? `\n\n⚠️ Tekshiruv: ${r.problems.join("; ")} — mijozga shu holda aytmang.` : ""}\n\nTasdiqlaysizmi?`, okNo(id));
}

// ---------- Tasdiqlash tugmalari ----------
async function decide(id, yes) {
  const a = state.approvals[id];
  if (!a) return "Bu karta allaqachon hal qilingan.";
  delete state.approvals[id];
  const p = state.projects[a.project || MAIN];
  if (a.type === "xabar") {
    const l = state.leads.find((x) => x.id === a.lead);
    if (!l) return "Restoran topilmadi.";
    l.status = yes ? "tasdiqlandi" : "rad";
    if (!yes) return `❌ ${l.name}: rad etildi.`;
    const to = [l.phone && `Telefon: ${l.phone}`, l.instagram && `Instagram: ${l.instagram}`].filter(Boolean).join("\n") || "Kontakt yo'q, o'zingiz toping";
    await send(`📤 Endi o'zingiz yuboring:\n${l.name}\n${to}\n\n${l.draft}`);
    return `✅ ${l.name}: tasdiqlandi.`;
  }
  if (!p) return "Loyiha topilmadi.";
  if (a.type === "majlis") {
    if (yes) p.decisions.push({ at: new Date().toISOString(), topic: a.topic, text: a.text, tasks: a.tasks || [] });
    return yes ? `✅ [${p.name}] Qaror qabul qilindi va loyiha xotirasiga yozildi.` : `❌ [${p.name}] Qaror rad etildi.`;
  }
  if (a.type === "vakansiya") {
    if (!yes) return `❌ [${p.name}] Vakansiya rad etildi: ${a.title}.`;
    const n = allRoles(view(state, p.id, facts)).length;
    p.roles.push({ id: `x${n}`, title: a.title, job: a.job, prefer: n });
    return `✅ [${p.name}] Yangi xodim qo'shildi: ${a.title}.`;
  }
  return "Noma'lum karta.";
}

// ---------- Loyiha tanlash ----------
const KINDS = {
  vazifa: { what: "topshiriq", ask: "Topshiriqni yozing: nima qilish kerak?" },
  kengash: { what: "boshqaruv kengashi", ask: "Kengash mavzusini yozing: nimani hal qilamiz?" },
  majlis: { what: "xodimlar majlisi", ask: "Majlis mavzusini yozing: nimani muhokama qilamiz?" },
  raqamlar: { what: "haftalik raqamlar", ask: "Raqamlarni yozing: sotuv, xarajat, yangi mijozlar..." },
  fakt: { what: "loyiha ma'lumoti", ask: "Loyiha haqida AI bilishi kerak bo'lgan faktni yozing (narx, mahsulot, taqiq...)." },
  haqida: { what: "loyiha tavsifi", ask: "" }
};

// "UZBIONIC: matn" yoki "uzbionic matn" kabi yozilsa, loyihani matnning boshidan topadi.
function projectPrefix(text) {
  const m = String(text).match(/^\s*([^:]{1,40}):\s*([\s\S]*)$/);
  if (m && find(state, m[1])) return { pid: find(state, m[1]).id, rest: m[2].trim() };
  return null;
}

// Ishni boshlashdan oldin egasidan loyihani so'raydi. text bo'lmasa, loyiha tanlangach matnni ham so'raydi.
async function askProject(kind, text = "") {
  const pre = text && projectPrefix(text);
  if (pre) return proceed(kind, pre.pid, pre.rest);
  const id = nextId();
  state.asks[id] = { kind, text };
  for (const k of Object.keys(state.asks).slice(0, -20)) delete state.asks[k];
  await saveState();
  const rows = list(state).map((p) => [{ text: `${p.name}${busy[p.id] ? " ⏳" : ""}`, callback_data: `p:${id}:${p.id}` }]);
  rows.push([{ text: "➕ Yangi loyiha", callback_data: `p:${id}:+` }]);
  await send(`📂 Qaysi loyiha uchun ${KINDS[kind].what}?${text ? `\n\n«${text.slice(0, 300)}»` : ""}`, rows);
}

async function proceed(kind, pid, text) {
  if (!text) {
    state.waiting = { kind, project: pid };
    await saveState();
    return send(`✍️ [${name(pid)}] ${KINDS[kind].ask}\n(Bekor qilish: /bekor)`);
  }
  state.waiting = null;
  const p = state.projects[pid];
  if (kind === "vazifa") { await send(`📋 [${p.name}] Direktor topshiriqni bo'lyapti...${busy[pid] ? " (oldingi ish tugashi bilan boshlanadi)" : ""}`); job(pid, "Topshiriq", () => vazifa(pid, text)); return; }
  if (kind === "majlis") { job(pid, "Majlis", () => majlis(pid, text)); return; }
  if (kind === "kengash") { job(pid, "Kengash", () => kengash(pid, text)); return; }
  if (kind === "raqamlar") {
    p.metrics = [...p.metrics, { at: new Date().toISOString(), text: text.slice(0, 1000) }].slice(-12);
    await saveState();
    return send(`📈 [${p.name}] Raqamlar saqlandi. Kengash keyingi majlisda shularga qaraydi.`);
  }
  if (kind === "fakt" || kind === "haqida") {
    p.facts = `${p.facts ? p.facts + "\n" : ""}- ${text.slice(0, 1500)}`.slice(-6000);
    await saveState();
    return send(`🧠 [${p.name}] Saqlandi. AI xodimlar endi shuni biladi.\nEndi topshiriq bering: /vazifa, /kengash yoki shunchaki matn yozing.`);
  }
}

async function newProject(title, after) {
  if (!title) {
    state.waiting = { kind: "yangi", after };
    await saveState();
    return send("✍️ Yangi loyiha nomini yozing (masalan: UZBIONIC).\n(Bekor qilish: /bekor)");
  }
  const old = find(state, title);
  if (old) { state.waiting = null; return after ? proceed(after.kind, old.id, after.text) : send(`«${old.name}» loyihasi allaqachon bor.`); }
  const p = create(state, title);
  // Loyiha ochilgach, AI to'qimasligi uchun avval loyiha nima ekanini so'raymiz; keyin kutilgan ish (after) davom etadi.
  state.waiting = { kind: "haqida", project: p.id, after };
  await saveState();
  return send(`📁 Yangi loyiha ochildi: ${p.name}\n\n✍️ ${p.name} nima? 2-5 gapda yozing: nima qiladi, mijozi kim, narxlari, nimani va'da qilib bo'lmaydi. ` +
    `AI xodimlar faqat shunga tayanadi.\n(Keyinroq qo'shish: /fakt)`);
}

// ---------- Buyruqlar ----------
const HELP = `Virtual ofis 🏢 (${PROFILE.owner})
Ofis o'zi ish boshlamaydi: har safar qaysi loyiha va qanday topshiriq ekanini so'raydi. Bir nechta loyiha parallel ishlaydi.

/loyiha — loyihalar ro'yxati; /loyiha <nom> — yangi loyiha ochish
/vazifa <matn> — topshiriq: direktor uni xodimlarga bo'ladi, kerak bo'lsa vaqtinchalik mutaxassis oladi
Oddiy matn yozsangiz ham topshiriq deb qabul qilinadi.
/kengash [mavzu] — boshqaruv kengashi qaror va haftalik vazifalar chiqaradi
/majlis [mavzu] — xodimlar munozara qilib ovoz beradi
/raqamlar <matn> — loyihaning haftalik raqamlari, kengash shularga qaraydi
/fakt <matn> — loyiha haqida AI bilishi kerak bo'lgan ma'lumot
/holat — loyihalar holati va AI limitlari
/bekor — kutilayotgan savolni bekor qilish
Loyihani darrov ko'rsatish mumkin: /vazifa UZBIONIC: sayt uchun matn

${PROFILE.company} uchun: /xabarlar — restoranlarga xabar qoralamasi; CSV fayl — restoranlar ro'yxati (nomi, manzil, telefon, instagram, stol, turi, izoh)

Ofis o'zi hech kimga yozmaydi: har xabar sizning tasdig'ingiz bilan keladi.`;

function holat() {
  const u = llm.usage().map((p) => `${p.label}: ${p.used}/${p.limit}`).join(", ") || "AI kaliti yo'q";
  const ps = list(state).map((p) => {
    const v = view(state, p.id, facts);
    return `📁 ${p.name}${busy[p.id] ? ` — ishlayapti (${busy[p.id]} ta ish)` : " — bo'sh"}\n   Xodimlar: ${allRoles(v).map((r) => r.title).join(", ")}\n   ${stats(p.id)}`;
  }).join("\n");
  return `🏢 Loyihalar:\n${ps}\n👔 Kengash: ${BOARD.map((b) => b.title).join(", ") || "yo'q"}\n🧠 Bugun AI so'rovlari: ${u}\n⏳ Tasdiq kutayotgan kartalar: ${Object.keys(state.approvals).length}`;
}

async function onMessage(m) {
  const chat = String(m.chat.id);
  if (!OWNER) { await tg("sendMessage", { chat_id: chat, text: `Sizning chat ID: ${chat}\noffice.env ga OWNER_CHAT_ID=${chat} yozing va ofisni qayta ishga tushiring.` }); return; }
  if (chat !== OWNER) return;
  const text = (m.text || "").trim();
  if (m.document) {
    if (!/\.csv$/i.test(m.document.file_name || "")) { await send("Faqat .csv fayl qabul qilinadi."); return; }
    job(MAIN, "Ro'yxat", () => importLeads(m.document));
    return;
  }
  if (!text) return;
  if (!text.startsWith("/")) {
    // Bot savol bergan bo'lsa, bu javob. Aks holda yangi topshiriq: avval qaysi loyiha ekanini so'raymiz.
    const w = state.waiting;
    if (!w) return askProject("vazifa", text);
    if (w.kind === "yangi") return newProject(text, w.after);
    state.waiting = null;
    await proceed(w.kind, w.project, text);
    if (w.kind === "haqida" && w.after) return proceed(w.after.kind, w.project, w.after.text);
    return;
  }
  state.waiting = null;
  const [cmd0, ...rest] = text.split(/\s+/);
  const cmd = cmd0.replace(/@\w+$/, "").toLowerCase();
  const arg = rest.join(" ");
  if (cmd === "/start" || cmd === "/yordam") return send(HELP);
  if (cmd === "/bekor") { await saveState(); return send("Bekor qilindi."); }
  if (cmd === "/holat") return send(holat());
  if (cmd === "/loyiha" || cmd === "/loyihalar") {
    if (arg) return find(state, arg) ? send(`📁 ${find(state, arg).name}\n${stats(find(state, arg).id)}`) : newProject(arg);
    return send(`📂 Loyihalar:\n${list(state).map((p) => `• ${p.name}${busy[p.id] ? " ⏳" : ""}`).join("\n")}\n\nYangi loyiha: /loyiha <nom>`,
      [[{ text: "➕ Yangi loyiha", callback_data: "p:0:+" }]]);
  }
  if (cmd === "/vazifa") return askProject("vazifa", arg);
  if (cmd === "/kengash") return askProject("kengash", arg);
  if (cmd === "/majlis") return askProject("majlis", arg);
  if (cmd === "/raqamlar") return askProject("raqamlar", arg);
  if (cmd === "/fakt") return askProject("fakt", arg);
  if (cmd === "/xabarlar") { job(MAIN, "Xabarlar", draftBatch); return; }
  return send(HELP);
}

async function onCallback(q) {
  if (String(q.message?.chat?.id) !== OWNER) return;
  const [kind, id, pid] = String(q.data || "").split(":");
  await tg("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {});
  if (kind === "p") {
    const a = id === "0" ? { kind: null, text: "" } : state.asks[id];
    if (!a) return send("Bu savol eskirgan, buyruqni qayta yuboring.");
    delete state.asks[id];
    await tg("editMessageReplyMarkup", { chat_id: OWNER, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    if (pid === "+") return newProject("", a.kind && a);
    if (!state.projects[pid]) return send("Loyiha topilmadi.");
    return proceed(a.kind, pid, a.text);
  }
  const reply = await decide(id, kind === "ok");
  await saveState();
  await tg("editMessageReplyMarkup", { chat_id: OWNER, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
  await send(reply);
}

// ---------- Haftalik kengash: dushanba 09:00 Toshkent vaqti (UTC+5) ----------
// Ofis o'zi yig'ilmaydi: qaysi loyiha bo'yicha kengash o'tkazishni so'raydi. Egasi tugmani bossa boshlanadi.
function weekly() {
  const t = new Date(Date.now() + 5 * 3600000);
  const day = t.toISOString().slice(0, 10);
  if (t.getUTCDay() === 1 && t.getUTCHours() >= 9 && state.lastMajlis !== day && OWNER) {
    state.lastMajlis = day;
    askProject(BOARD.length ? "kengash" : "majlis", "Haftalik majlis: o'tgan haftani baholash va keyingi hafta rejasi")
      .catch((e) => log("haftalik:", e.message));
  }
}

async function main() {
  try { state = { ...state, ...JSON.parse(await fs.readFile(stateFile, "utf8")) }; } catch {}
  migrate(state);
  facts = await fs.readFile(path.join(DIR, "facts.md"), "utf8");
  llm = createLLM(env, state.usage);
  if (!TOKEN) { log("OFFICE_BOT_TOKEN yo'q: ofis kutish rejimida (office.env ni to'ldiring)"); setInterval(() => {}, 1 << 30); return; }
  log(`ofis ishga tushdi: ${llm.providers.map((p) => p.label).join(", ") || "AI kaliti yo'q"}; loyihalar: ${list(state).map((p) => p.name).join(", ")}`);
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
