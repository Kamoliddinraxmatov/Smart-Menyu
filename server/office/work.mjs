// AI ofisning ishi: lidlarni baholash, xabar yozish, vazifalarni bo'lish, majlis (munozara + ovoz) va vakansiya.
// Hamma funksiya `ctx` oladi: { ask, project }. ask = llm.ask (testda soxtasi), project = projects.mjs dagi view():
// qaysi loyiha, uning faktlari, xodimlari va qarorlari. Shunda bir loyihaning ishi boshqasiga aralashmaydi.
import { check, redact } from "./guard.mjs";
import { allRoles, everyone, BOARD, PROFILE, systemPrompt } from "./roles.mjs";

const role = (ctx, id) => everyone(ctx.project).find((r) => r.id === id);

// who: rol id si yoki rolning o'zi (vazifa uchun olingan vaqtinchalik mutaxassis).
async function say(ctx, who, prompt, opts = {}) {
  const r = typeof who === "string" ? role(ctx, who) : who;
  return ctx.ask([{ role: "system", content: systemPrompt(r, ctx.project) }, { role: "user", content: prompt }], { prefer: r.prefer || 0, ...opts });
}

// AI'ga faqat ochiq biznes ma'lumoti boradi: telefon va email yashiriladi.
const leadInfo = (l) => redact([l.name, l.address, l.category, l.tables && `${l.tables} stol`, l.instagram, l.note].filter(Boolean).join(", "));

// ---------- Lidlar ----------
export async function scoreLeads(ctx, leads) {
  for (let i = 0; i < leads.length; i += 10) {
    const batch = leads.slice(i, i + 10);
    const list = batch.map((l, k) => `${k + 1}. ${leadInfo(l)}`).join("\n");
    const { data } = await say(ctx, "qidiruvchi",
      `Har restoranga 1 dan 10 gacha ball qo'y (Smart Menyu uchun qanchalik mos mijoz). Faqat JSON qaytar: [{"n":1,"ball":7,"sabab":"..."}]\n\n${list}`,
      { json: true });
    for (const s of Array.isArray(data) ? data : []) {
      const l = batch[Number(s.n) - 1];
      if (l) { l.score = Math.max(0, Math.min(10, Number(s.ball) || 0)); l.why = String(s.sabab || "").slice(0, 200); }
    }
  }
  return leads;
}

// Sotuv boshlig'i yozadi -> kod tekshiradi -> nazoratchi tekshiradi. Muammo bo'lsa qayta yozadi (ko'pi bilan 3 urinish).
export async function draftMessage(ctx, lead, kind = "birinchi") {
  let feedback = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const { text } = await say(ctx, "sotuv",
      `${kind === "birinchi" ? "Birinchi xabar" : "Eslatma xabari"} yoz. Restoran: ${leadInfo(lead)}.` +
      (lead.why ? ` Nega mos: ${lead.why}.` : "") +
      (feedback ? `\n\nOldingi variant rad etildi: ${feedback}. Shu muammolarsiz qayta yoz.` : "") +
      "\nFaqat xabar matnini qaytar, izohsiz.");
    const problems = check(text, ctx.project.strict);
    if (problems.length) { feedback = problems.join("; "); continue; }
    const { data } = await say(ctx, "nazoratchi",
      `Shu xabarni tekshir. Faqat JSON qaytar: {"ok":true|false,"izoh":"..."}\n\n${text}`, { json: true });
    if (data && data.ok === false) { feedback = String(data.izoh || "nazoratchi rad etdi"); continue; }
    return { text, note: data?.izoh || "" };
  }
  return { text: null, note: feedback };
}

// ---------- Vazifa: direktor bo'ladi, xodimlar bajaradi ----------
// Mos xodim bo'lmasa, direktor shu topshiriq uchun vaqtinchalik mutaxassis oladi (masalan "Veb dizayner"). U faqat shu
// vazifada ishlaydi va ofis xodimlari ro'yxatiga qo'shilmaydi: doimiy xodim faqat egasi vakansiyani tasdiqlasa qo'shiladi.
export async function runTask(ctx, goal) {
  const ids = allRoles(ctx.project).filter((r) => r.id !== "direktor").map((r) => `${r.id} (${r.title})`).join(", ");
  const { data } = await say(ctx, "direktor",
    `Loyiha: ${ctx.project.name}. ${PROFILE.owner}ning topshirig'i: "${goal}".\nUni ko'pi bilan 4 ta qadamga bo'l va har birini bitta xodimga ber. Xodimlar: ${ids}.\n` +
    `Agar qadamga mos xodim yo'q bo'lsa, shu ish uchun vaqtinchalik mutaxassis ol: "rol" o'rniga "lavozim" va "ish" (1-2 gap) yoz.\n` +
    `Faqat JSON qaytar: [{"rol":"${ids.split(" ")[0] || "nazoratchi"}","vazifa":"..."},{"lavozim":"Veb dizayner","ish":"...","vazifa":"..."}]`, { json: true });
  const steps = [];
  for (const s of (Array.isArray(data) ? data : []).filter((s) => s && s.vazifa)) {
    if (steps.length >= 4) break;
    const r = role(ctx, s.rol) || (s.lavozim && {
      id: `vaqtinchalik-${steps.length + 1}`, title: String(s.lavozim).slice(0, 60), temp: true, prefer: steps.length,
      job: String(s.ish || s.vazifa).slice(0, 400)
    });
    if (r) steps.push({ r, vazifa: String(s.vazifa).slice(0, 600) });
  }
  const results = [];
  for (const { r, vazifa } of steps) {
    const { text, provider } = await say(ctx, r, `Direktor topshirig'i: ${vazifa}\nUmumiy maqsad: ${goal}`);
    results.push({ rol: r.id, title: r.title, temp: !!r.temp, vazifa, text, provider, problems: check(text, ctx.project.strict) });
  }
  return results;
}

// ---------- Majlis: har kim taklif beradi, nazoratchi tanqid qiladi, hamma ovoz beradi ----------
// members berilmasa, ofis xodimlari (nazoratchidan tashqari) gapiradi. Kengash majlisida esa kengash a'zolari.
export async function council(ctx, topic, context = "", members = allRoles(ctx.project).filter((r) => r.id !== "nazoratchi")) {
  const proposals = [];
  for (const m of members) {
    try {
      const { text, provider } = await say(ctx, m.id,
        `Ofis majlisi. Mavzu: ${topic}\n${context}\nO'z lavozimingdan kelib chiqib bitta aniq taklif ber (80 so'zgacha): nima qilamiz va nega.`);
      proposals.push({ by: m.id, title: m.title, text, provider });
    } catch (e) { proposals.push({ by: m.id, title: m.title, text: null, error: e.message }); }
  }
  const live = proposals.filter((p) => p.text);
  if (!live.length) throw new Error("hech kim taklif bera olmadi (AI kalitlari yoki limitni tekshiring)");
  const list = live.map((p, i) => `${i + 1}. ${p.title}: ${p.text}`).join("\n\n");
  const { text: critique } = await say(ctx, "nazoratchi",
    `Majlis mavzusi: ${topic}\nTakliflar:\n\n${list}\n\nHar taklifning eng katta zaif tomonini bir gapda ayt. Qaysi biri faktlarga yoki taqiqlarga zid bo'lsa, aniq ko'rsat.`);
  const votes = [];
  for (const m of members) {
    const own = live.findIndex((p) => p.by === m.id) + 1;
    try {
      const { data } = await say(ctx, m.id,
        `Majlis mavzusi: ${topic}\nTakliflar:\n\n${list}\n\nTanqid:\n${critique}\n\n` +
        `Eng yaxshi taklifga ovoz ber${own ? ` (o'zingning ${own}-taklifingga emas)` : ""}. Faqat JSON: {"ovoz":2,"sabab":"..."}`, { json: true });
      const n = Number(data?.ovoz);
      if (n >= 1 && n <= live.length && n !== own) votes.push({ by: m.title, n, why: String(data.sabab || "").slice(0, 200) });
    } catch {}
  }
  const tally = live.map((_, i) => votes.filter((v) => v.n === i + 1).length);
  const best = tally.indexOf(Math.max(...tally));
  return { topic, proposals: live, critique, votes, tally, winner: live[best], winnerNo: best + 1 };
}

// ---------- Boshqaruv kengashi: haftalik majlis + keyingi hafta vazifalari ----------
// Kengash a'zolari raqamlar va o'tgan qarorlarga qarab taklif beradi, ovoz beradi; direktor g'olib taklifni 3-5 ta vazifaga
// bo'ladi. Hech narsa o'zi bajarilmaydi: qaror va vazifalar egasiga tasdiq uchun boradi.
export async function boardMeeting(ctx, topic, context = "") {
  if (!BOARD.length) throw new Error("kengash bo'sh: profile.json dagi \"board\" ro'yxatiga a'zo qo'shing");
  const r = await council(ctx, topic, context, BOARD);
  const { data } = await say(ctx, "direktor",
    `Kengash qarori: ${r.winner.title}: ${r.winner.text}\n${context}\n` +
    `Shu qarorni keyingi hafta uchun 3-5 ta aniq, o'lchanadigan vazifaga bo'l. Pul, imzo, mijozga yozish kabi ishlar faqat ${PROFILE.owner}da. ` +
    `Faqat JSON: [{"vazifa":"...","kim":"${PROFILE.owner} yoki xodim lavozimi","natija":"qanday o'lchaymiz"}]`, { json: true });
  const tasks = (Array.isArray(data) ? data : []).filter((t) => t && t.vazifa).slice(0, 5)
    .map((t) => ({ vazifa: String(t.vazifa).slice(0, 300), kim: String(t.kim || PROFILE.owner).slice(0, 60), natija: String(t.natija || "").slice(0, 200) }));
  return { ...r, tasks, problems: check([r.winner.text, ...tasks.map((t) => t.vazifa)].join("\n"), ctx.project.strict) };
}

// ---------- Vakansiya: direktor yangi xodim kerakmi deb o'ylaydi ----------
export async function vacancy(ctx, summary) {
  const team = allRoles(ctx.project).map((r) => r.title).join(", ");
  const { data } = await say(ctx, "direktor",
    `Hozirgi xodimlar: ${team}.\nSo'nggi majlis xulosasi: ${summary}\n` +
    `Ish natijasini yaxshilash uchun yangi AI xodim kerakmi? Faqat haqiqatan kerak bo'lsa "kerak":true. ` +
    `Faqat JSON: {"kerak":false} yoki {"kerak":true,"lavozim":"...","vazifa":"... (2-3 gap)","nega":"..."}`, { json: true });
  if (!data?.kerak || !data.lavozim || !data.vazifa) return null;
  return { title: String(data.lavozim).slice(0, 60), job: String(data.vazifa).slice(0, 600), why: String(data.nega || "").slice(0, 400) };
}
