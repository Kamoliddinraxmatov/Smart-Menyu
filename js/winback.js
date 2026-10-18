// "Qayta tashrif": mijozni shaxsiy chegirma kuponi bilan qaytarish (Biznes va Premium tariflarida).
//
// 1. Mijoz stoldagi QR kodni skanerlaydi -> restoranning Telegram boti -> til -> telefon raqami.
//    Bot raqamni planshetlarga yuboradi (wb/in). Planshet mijozni shu stoldagi ochiq chekka bog'laydi.
// 2. Stol yopilganda mijozning tashrifi yoziladi va unga shaxsiy kupon beriladi: 1 harf + 5 raqam (K73049),
//    foiz va muddat restoran sozlamasidan (standart 10%, 15 kun).
// 3. Menejer "Yuborish" tugmasini bosadi (Premium'da unutilsa kupon tugashidan 3 kun oldin o'zi ketadi):
//    xabar mijozning tilida, QR kod rasmi bilan bot orqali boradi (wb/out -> wb/done).
// 4. Mijoz qaytib kelib QR kodni ko'rsatadi: ofitsiant uni skanerlaydi yoki kodni yozadi, chekda chegirma chiqadi.
//
// Ma'lumotlar: mijozlar <base>/guests/<id> (restoran kaliti bilan shifrlangan, sync.js). Bot bilan almashinuv
// restoranning bot kaliti bilan shifrlangan: uni egasi ruxsatnomada beradi (lic.wb.k, restoran kaliti bilan o'ralgan).
import { importDataKey, seal, open } from "./crypto.js";
import { orderTotal } from "./common.js";
import { has, currentPlan } from "./plan.js";

const DAY = 86400000;
export const WB_DEFAULTS = { pct: 10, days: 15, paused: false, auto: true };
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // I va O yo'q: 1 va 0 bilan adashmasin

export const fmtDay = (ts) => { const d = new Date(ts); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; };
export const normCode = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const CODE_RE = /^[A-Z]\d{5}$/;

// Kupon xabari (kelishilgan matn). Tugmalar yo'q, QR kod rasm sifatida birga boradi.
export const MESSAGES = {
  uz: (v) => `Assalomu alaykum, ${v.kafe}ning hurmatli mijozi!\nOshpazimiz sevimli taomingizni yana siz uchun tayyorlashga tayyor.\nSizga atalgan ${v.pct}% chegirma ${v.days} kundan keyin kuyib ketadi ⏳\nKod: ${v.code} · ${v.date}gacha\n${v.kafe} sizni kutmoqda!\n📌 Chegirmadan foydalanish uchun buyurtma berishdan oldin ushbu QR kodni ofitsiantga ko'rsating.`,
  ru: (v) => `Здравствуйте, уважаемый гость ${v.kafe}!\nНаш шеф-повар готов снова приготовить ваше любимое блюдо.\nВаша персональная скидка ${v.pct}% сгорит через ${v.days} дн. ⏳\nКод: ${v.code} · до ${v.date}\n${v.kafe} ждёт вас!\n📌 Чтобы воспользоваться скидкой, покажите этот QR-код официанту до оформления заказа.`,
  en: (v) => `Hello, valued guest of ${v.kafe}!\nOur chef is ready to cook your favourite dish for you again.\nYour personal ${v.pct}% discount expires in ${v.days} days ⏳\nCode: ${v.code} · valid until ${v.date}\n${v.kafe} is waiting for you!\n📌 To use the discount, show this QR code to your waiter before ordering.`
};

export const couponActive = (c, now = Date.now()) => !!c && !c.used && (c.until || 0) > now;

async function sha(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

// act: activate() natijasi ({ rid, key, lic, watcher, demo })
export function createWinback(store, act) {
  const S = store.state;
  const listeners = new Set();
  const wb = {
    ready: false,      // bot kaliti bor (egasi bot ulagan)
    info: null,        // bot holati: { ok, user, err }
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
  const emit = () => { for (const fn of listeners) { try { fn(); } catch (e) { console.warn(e); } } };
  if (act.demo || !act.key) return wb;

  const lic = () => act.watcher?.lic || act.lic;
  const can = (f) => has(f, currentPlan(lic()));
  const base = store.conn.base;
  let kbot = null, kraw = "", kfor = "";
  const queue = [];

  wb.settings = () => ({ ...WB_DEFAULTS, ...(S.config.winback || {}) });
  wb.can = can;

  // Bot kaliti ruxsatnomadan (egasi tokenni almashtirsa, yangisi keladi)
  async function loadKey() {
    const sealed = lic()?.wb?.k || "";
    if (sealed === kfor) return;
    kfor = sealed;
    kbot = null; kraw = ""; wb.ready = false;
    if (sealed) {
      try { kraw = await open(act.key, sealed, `${act.rid}/wbk`); kbot = await importDataKey(kraw); wb.ready = true; } catch (e) { console.warn("bot kaliti:", e); }
    }
    emit();
    drain();
  }
  window.addEventListener("menyu-lic", () => loadKey());

  store.loadGuests();
  store.watchRaw(["wb/in/+", "wb/done/+", "wb/info"], (topic, raw) => { queue.push([topic, raw]); drain(); });
  store.on((evt) => {
    if (evt.type === "guests") drain();
    if (evt.type === "order" && evt.local && evt.order?.status === "closed" && evt.prev && evt.prev.status !== "closed") onClosed(evt.order);
  });

  let draining = false;
  async function drain() {
    if (draining || !kbot || !S.guestsLoaded) return;
    draining = true;
    try {
      while (queue.length) {
        const [topic, raw] = queue.shift();
        if (!raw) continue;
        let rec;
        try { rec = JSON.parse(await open(kbot, raw, topic)); } catch { continue; } // eski kalit yoki begona xabar
        const rel = topic.slice(base.length + 1);
        if (rel === "wb/info") { wb.info = rec; emit(); continue; }
        if (rel.startsWith("wb/in/")) await onScan(rec, rel);
        else if (rel.startsWith("wb/done/")) onDone(rec, rel);
      }
    } finally { draining = false; }
  }

  async function gidOf(phone) {
    const h = await sha(`${act.rid}|${String(phone).replace(/\D/g, "")}`);
    return Array.from(h.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  const guest = (id) => (S.guests[id] ? structuredClone(S.guests[id]) : null);

  // Mijoz raqamini yubordi yoki stol QR kodini qayta skanerladi
  async function onScan(rec, rel) {
    const phone = String(rec.phone || "").replace(/[^\d+]/g, "");
    if (!phone || !rec.chat) { store.publishRaw(rel, ""); return; }
    const id = await gidOf(phone);
    const g = guest(id) || { id, visits: {}, past: [], createdAt: Date.now() };
    Object.assign(g, { phone, chat: rec.chat, lang: ["uz", "ru", "en"].includes(rec.lang) ? rec.lang : "uz" });
    if (rec.name) g.name = String(rec.name).slice(0, 60);
    if (rec.table) {
      g.scan = { table: String(rec.table), at: Number(rec.scanAt || rec.at) || Date.now() };
      const t = S.config.tables.find((x) => x.id === g.scan.table);
      if (t) {
        const open = Object.values(S.orders).filter((o) => o.tableId === t.id && o.status !== "closed").sort((a, b) => a.createdAt - b.createdAt);
        if (open.length) {
          if (!open.some((o) => (o.wb || []).includes(id))) store.updateOrder(open[0].id, (o) => ({ wb: [...(o.wb || []), id] }));
        } else {
          // Stol endi yopilgan (mijoz hisobni to'lab bo'lgach skanerladi): oxirgi 1 soatdagi chekka bog'laymiz
          const closed = Object.values(S.orders).filter((o) => o.tableId === t.id && o.status === "closed" && Date.now() - (o.closedAt || 0) < 3600000);
          const last = Math.max(0, ...closed.map((o) => o.closedAt));
          if (last) await linkVisit(g, closed.filter((o) => o.closedAt === last));
        }
      }
    }
    store.putGuest(g);
    store.publishRaw(rel, "");
  }

  // Stol yopildi (shu planshetda): kupon ishlatilgan bo'lsa yakunlanadi, stoldagi mijozlarga tashrif va yangi kupon
  async function onClosed(o) {
    const bill = Object.values(S.orders).filter((x) => x.tableId === o.tableId && x.status === "closed" && x.closedAt === o.closedAt);
    if (o.disc?.gid) {
      const g = guest(o.disc.gid);
      if (g?.coupon?.code === o.disc.code && !g.coupon.used) {
        g.coupon.used = { at: o.closedAt, sum: bill.reduce((s, x) => s + orderTotal(x), 0), disc: o.disc.amount || 0, guests: Math.max(1, ...bill.map((x) => x.guests || 1)), table: o.tableNo };
        delete g.coupon.hold;
        if (!(o.wb || []).includes(g.id)) await linkVisit(g, bill);
        store.putGuest(g);
      }
    }
    for (const id of o.wb || []) {
      const g = guest(id);
      if (g && await linkVisit(g, bill)) store.putGuest(g);
    }
  }

  // Tashrifni yozish va kupon berish. O'zgarish bo'lsa true.
  async function linkVisit(g, bill) {
    if (!bill.length) return false;
    const o = bill[0];
    const vid = `${o.tableId}-${o.closedAt}`;
    g.visits = g.visits || {};
    if (g.visits[vid]) return false;
    const names = {};
    bill.forEach((x) => (x.items || []).forEach((it) => { names[it.name] = (names[it.name] || 0) + it.qty; }));
    g.visits[vid] = {
      at: o.closedAt, table: o.tableNo, sum: bill.reduce((s, x) => s + orderTotal(x), 0),
      guests: Math.max(1, ...bill.map((x) => x.guests || 1)),
      items: Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n)
    };
    const keep = Object.entries(g.visits).sort((a, b) => b[1].at - a[1].at).slice(0, 20);
    g.visits = Object.fromEntries(keep);
    const st = wb.settings();
    if (st.paused || !can("winback") || couponActive(g.coupon)) return true;
    if (g.coupon) g.past = [g.coupon, ...(g.past || [])].slice(0, 20);
    g.coupon = { code: await newCode(g.id, vid), pct: st.pct, days: st.days, issuedAt: o.closedAt, until: o.closedAt + st.days * DAY, visit: vid };
    return true;
  }

  // Kod: 1 harf + 5 raqam. Har planshetda bir xil chiqadi (bir vaqtda ikki planshet yozsa ham kod bitta bo'ladi)
  async function newCode(gid, vid) {
    const used = new Set();
    for (const g of Object.values(S.guests)) for (const c of [g.coupon, ...(g.past || [])]) if (c) used.add(c.code);
    for (let n = 0; ; n++) {
      const h = await sha(`${kraw}|${gid}|${vid}|${n}`);
      const code = LETTERS[h[0] % LETTERS.length] + String(((h[1] << 16) | (h[2] << 8) | h[3]) % 100000).padStart(5, "0");
      if (!used.has(code)) return code;
    }
  }

  function onDone(rec, rel) {
    const g = Object.values(S.guests).find((x) => x.coupon?.code === rec.code);
    store.publishRaw(rel, "");
    if (!g) return;
    const n = structuredClone(g);
    if (rec.ok) { n.coupon.delivered = rec.at || Date.now(); delete n.coupon.err; } else n.coupon.err = rec.err || "err";
    store.putGuest(n);
  }

  // ---------- Menejer ----------
  wb.message = (g, lang = g?.lang || "uz", c = g?.coupon) => {
    const days = Math.max(1, Math.ceil(((c?.until || 0) - Date.now()) / DAY));
    return (MESSAGES[lang] || MESSAGES.uz)({ kafe: S.config.restaurant.name, pct: c?.pct ?? wb.settings().pct, days, code: c?.code || "K73049", date: fmtDay(c?.until || Date.now() + wb.settings().days * DAY) });
  };
  // Kupon yuborilishi kerak bo'lganlar (hali yuborilmagan yoki yetmagan)
  wb.toSend = () => Object.values(S.guests).filter((g) => g.chat && couponActive(g.coupon) && (!g.coupon.sentAt || g.coupon.err === "net"));

  wb.send = async (guests, auto = false) => {
    if (!kbot) return 0;
    let n = 0;
    for (const g0 of guests) {
      const g = guest(g0.id);
      if (!g?.chat || !couponActive(g.coupon)) continue;
      const id = g.coupon.code;
      const topic = `wb/out/${id}`;
      const body = { chat: g.chat, lang: g.lang || "uz", code: id, text: wb.message(g) };
      const sealed = await seal(kbot, JSON.stringify(body), `${base}/${topic}`);
      // Avval belgilaymiz, keyin yuboramiz: bot javobi (wb/done) bu yozuvdan keyin kelsin
      g.coupon.sentAt = Date.now();
      g.coupon.auto = auto;
      delete g.coupon.err;
      delete g.coupon.delivered;
      store.putGuest(g);
      await store.publishRaw(topic, sealed);
      n++;
    }
    return n;
  };

  wb.lists = () => {
    const now = Date.now();
    const waiting = [], returned = [], expired = [];
    for (const g of Object.values(S.guests)) {
      if (couponActive(g.coupon, now)) waiting.push({ g, c: g.coupon });
      for (const c of [g.coupon, ...(g.past || [])]) {
        if (!c) continue;
        if (c.used) returned.push({ g, c });
        else if (c.until <= now) expired.push({ g, c });
      }
    }
    waiting.sort((a, b) => a.c.until - b.c.until);
    returned.sort((a, b) => b.c.used.at - a.c.used.at);
    expired.sort((a, b) => b.c.until - a.c.until);
    return { waiting, returned, expired };
  };

  wb.stats = () => {
    const all = Object.values(S.guests).flatMap((g) => [g.coupon, ...(g.past || [])]).filter(Boolean);
    const sent = all.filter((c) => c.sentAt);
    const used = all.filter((c) => c.used);
    const sum = used.reduce((s, c) => s + (c.used.sum || 0), 0);
    const disc = used.reduce((s, c) => s + (c.used.disc || 0), 0);
    return {
      guests: Object.keys(S.guests).length, sent: sent.length, returned: used.length,
      rate: sent.length ? Math.round(sent.filter((c) => c.used).length / sent.length * 100) : 0,
      companions: used.reduce((s, c) => s + Math.max(0, (c.used.guests || 1) - 1), 0),
      sum, disc, net: sum - disc, perSom: disc ? Math.round((sum - disc) / disc * 10) / 10 : 0
    };
  };

  wb.botLink = (tableId) => (wb.info?.ok && wb.info.user ? `https://t.me/${wb.info.user}?start=t_${tableId}` : "");

  // ---------- Ofitsiant: kuponni chekka qo'llash ----------
  // Natija: { ok, g, c } yoki { err }
  wb.check = (raw, tableId) => {
    const code = normCode(raw);
    if (!CODE_RE.test(code)) return { err: "format" };
    const g = Object.values(S.guests).find((x) => x.coupon?.code === code);
    if (!g) {
      const old = Object.values(S.guests).find((x) => (x.past || []).some((c) => c.code === code));
      return { err: old && old.past.find((c) => c.code === code).used ? "used" : "notfound" };
    }
    const c = g.coupon;
    if (c.used) return { err: "used", c };
    if (c.until <= Date.now()) return { err: "expired", c };
    if (c.hold && c.hold.table !== tableId && Date.now() - c.hold.at < 6 * 3600000) return { err: "busy", c };
    return { ok: true, g, c };
  };
  wb.hold = (g, tableId) => { const n = guest(g.id); if (!n?.coupon) return; n.coupon.hold = { table: tableId, at: Date.now() }; store.putGuest(n); };
  wb.release = (gid, code) => { const n = guest(gid); if (n?.coupon?.code !== code || !n.coupon.hold) return; delete n.coupon.hold; store.putGuest(n); };

  // ---------- Premium: unutilgan kuponlar tugashidan 3 kun oldin o'zi ketadi ----------
  async function autoSend() {
    const st = wb.settings();
    if (!kbot || !S.guestsLoaded || st.paused || st.auto === false || !can("winbackAuto")) return;
    const due = Object.values(S.guests).filter((g) => g.chat && couponActive(g.coupon) && !g.coupon.sentAt && g.coupon.until - Date.now() <= 3 * DAY);
    if (!due.length) return;
    // Bir nechta planshet bir vaqtda yubormasin: tasodifiy kutish va qayta tekshirish (bot ham bir kodni ikki marta yubormaydi)
    await new Promise((r) => setTimeout(r, Math.random() * 60000));
    await wb.send(due.filter((g) => !S.guests[g.id]?.coupon?.sentAt), true);
  }
  setTimeout(autoSend, 20000);
  setInterval(autoSend, 30 * 60000);

  loadKey();
  return wb;
}
