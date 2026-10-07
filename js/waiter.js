// Ofitsiant (menyu) planshet ilovasi
import { createStore, newId } from "./sync.js";
import {
  getRid, esc, money, fullName, initials, ago, clock, shortNo, orderTotal, applyBrand, logoHtml, itemVisual,
  unlockAudio, chime, vibrate, keepAwake, toast, modal, confirmBox, connBadge, registerSW, link
} from "./common.js";
import { LANGS, t as T, setLang, getLang, itemName, itemDesc, catName, catTagline, weightText, noteLabel, optName } from "./i18n.js";

const rid = getRid();
try { setLang(localStorage.getItem("menyu.lang") || "uz"); } catch { setLang("uz"); }
// Ofitsiant ekranidagi yozuvlar ham tanlangan tilda: L("o'zbekcha", "русский", "english")
const L = (uz, ru, en) => ({ ru, en })[getLang()] ?? uz;
const agoL = (ts) => {
  const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (m < 1) return L("hozir", "сейчас", "now");
  if (m < 60) return `${m} ${L("daq", "мин", "min")}`;
  return `${Math.floor(m / 60)} ${L("soat", "ч", "h")} ${m % 60} ${L("daq", "мин", "min")}`;
};
const ST = (t) => `${L("Stol", "Стол", "Table")} ${t}`;
const store = createStore(rid);
const S = store.state;
const app = document.getElementById("app");


const ui = {
  me: loadMe(),
  view: "tables",       // tables | table
  tableId: null,
  filter: "mine",       // mine | all
  cat: "all",
  q: "",
  cartOpen: false,
  guest: loadGuest()    // mijoz rejimidagi stol id (planshet mijozga berilgan)
};

function loadGuest() {
  try { return localStorage.getItem(`menyu.guest.${rid}`) || null; } catch { return null; }
}
function saveGuest(tid) {
  ui.guest = tid || null;
  try { tid ? localStorage.setItem(`menyu.guest.${rid}`, tid) : localStorage.removeItem(`menyu.guest.${rid}`); } catch {}
}

function loadMe() {
  try { return JSON.parse(localStorage.getItem(`menyu.waiter.${rid}`) || "null"); } catch { return null; }
}
function saveMe(w) {
  ui.me = w ? { id: w.id } : null;
  try { w ? localStorage.setItem(`menyu.waiter.${rid}`, JSON.stringify(ui.me)) : localStorage.removeItem(`menyu.waiter.${rid}`); } catch {}
}
const cfg = () => S.config;
const meW = () => cfg().waiters.find((w) => w.id === ui.me?.id);
const waiterById = (id) => cfg().waiters.find((w) => w.id === id);
const tableById = (id) => cfg().tables.find((t) => t.id === id);
const cur = () => {
  const c = cfg().restaurant.currency || "so'm";
  return c === "so'm" && getLang() !== "uz" ? T("cur") : c;
};

// ---------- Savat (har stol uchun alohida, qurilmada saqlanadi) ----------
function cartKey(tid) { return `menyu.cart.${rid}.${tid}`; }
function getCart(tid) { try { return JSON.parse(localStorage.getItem(cartKey(tid)) || "[]"); } catch { return []; } }
function setCart(tid, items) { try { items.length ? localStorage.setItem(cartKey(tid), JSON.stringify(items)) : localStorage.removeItem(cartKey(tid)); } catch {} }
// sel: { variant, extras } — porsiya (bittasi) va pullik qo'shimchalar (bir nechta)
function unitPrice(item, sel) {
  return (sel?.variant ? sel.variant.price : item.price) + (sel?.extras || []).reduce((s, e) => s + (Number(e.price) || 0), 0);
}
function addToCart(tid, item, qty = 1, note = "", sel = null) {
  const v = sel?.variant || null;
  const exs = sel?.extras || [];
  const opts = [v?.name, ...exs.map((e) => "+ " + e.name)].filter(Boolean).join(", ");
  const sig = (v?.id || "") + "|" + exs.map((e) => e.id).sort().join(",");
  const cart = getCart(tid);
  const ex = cart.find((c) => c.itemId === item.id && (c.note || "") === note && (c.sig || "|") === sig);
  if (ex) ex.qty += qty;
  else cart.push({ key: newId(), itemId: item.id, name: item.name, price: unitPrice(item, sel), emoji: item.emoji, qty, note, opts, sig, vId: v?.id || "", exIds: exs.map((e) => e.id) });
  setCart(tid, cart);
}
const hasOpts = (i) => !!(i.variants?.length || i.extras?.length);
// Tanlangan variantlar matni (mijoz tilida); oshxonaga o'zbekcha "opts" boradi
function optsText(c) {
  if (!c.opts) return "";
  const item = cfg().items.find((i) => i.id === c.itemId);
  if (getLang() === "uz" || !item) return c.opts;
  const v = item.variants?.find((x) => x.id === c.vId);
  const exs = (c.exIds || []).map((id) => item.extras?.find((x) => x.id === id)).filter(Boolean);
  return [v && optName(v), ...exs.map((e) => "+ " + optName(e))].filter(Boolean).join(", ") || c.opts;
}
const optsHtml = (c) => (c.opts ? `<small class="cl-opts">${esc(optsText(c))}</small>` : "");
const orderLine = (c) => ({ key: c.key, itemId: c.itemId, name: c.name, price: c.price, qty: c.qty, note: c.note || "", opts: c.opts || "", vId: c.vId || "", exIds: c.exIds || [], emoji: c.emoji || "", done: false });

// ---------- Stol holati ----------
function activeOrders(tid) {
  return Object.values(S.orders).filter((o) => o.tableId === tid && o.status !== "closed").sort((a, b) => a.createdAt - b.createdAt);
}
function tableState(tid) {
  const os = activeOrders(tid);
  if (!os.length && S.reserves?.[tid]) return { key: "reserved", label: `🔖 ${L("Bron", "Бронь", "Reserved")}`, orders: os, res: S.reserves[tid] };
  if (!os.length) return { key: "free", label: L("Bo'sh", "Свободен", "Free"), orders: os };
  if (os.some((o) => o.status === "ready")) return { key: "ready", label: L("Tayyor ✓", "Готово ✓", "Ready ✓"), orders: os };
  if (os.some((o) => o.status === "cooking")) return { key: "cooking", label: L("Tayyorlanmoqda", "Готовится", "Cooking"), orders: os };
  if (os.some((o) => o.status === "new")) return { key: "new", label: L("Oshxonada", "На кухне", "In the kitchen"), orders: os };
  if (os.every((o) => o.status === "served")) return { key: "served", label: L("🍽 Taom stolda", "🍽 Блюда на столе", "🍽 Served"), orders: os };
  return { key: "busy", label: L("Band", "Занят", "Busy"), orders: os };
}
function tableWaiterId(t) {
  // Stol band bo'lsa — mijozni o'tqazib buyurtma olgan ofitsiant; bo'sh stol hech kimniki emas
  const active = activeOrders(t.id);
  if (active.length) return active[active.length - 1].waiterId || active[0].waiterId;
  return S.reserves?.[t.id]?.waiterId || "";
}
// qo'ng'iroqcha faqat buyurtmani olgan ofitsiantda yonadi ("Barcha stollar" tanlangan bo'lsa ham)
function myReady() {
  return Object.values(S.orders).filter((o) => o.status === "ready" && o.waiterId === ui.me?.id);
}
// tayyor buyurtmalar faqat uni olgan ofitsiantga ko'rinadi
function readyForMe() {
  return myReady().sort((a, b) => (a.readyAt || 0) - (b.readyAt || 0));
}

// ---------- Ko'rinishlar ----------
function render() {
  applyBrand(cfg().restaurant);
  document.title = `${cfg().restaurant.name} · Ofitsiant`;
  if (ui.guest && tableById(ui.guest)) {
    ui.view = "table";
    ui.tableId = ui.guest;
    return renderTable();
  }
  if (ui.guest) saveGuest(null);
  if (!ui.me || !meW()) return renderLogin();
  if (ui.view === "table" && tableById(ui.tableId)) return renderTable();
  if (ui.view === "history") return renderHistory();
  ui.view = "tables";
  renderTables();
}

function topbar(extra = "") {
  const r = cfg().restaurant;
  if (ui.guest) return guestBar();
  const me = meW();
  const ready = myReady().length;
  return `
  <header class="topbar">
    <div class="brand">${logoHtml(r)}<div><b>${esc(r.name)}</b><small>${esc(r.slogan || "")}</small></div></div>
    ${extra}
    <div class="top-right">
      ${connBadge(S.online)}
      <button class="ready-pill ${ready ? "on" : ""}" data-act="show-ready" title="${L("Tayyor buyurtmalar", "Готовые заказы", "Ready orders")}"><span class="bell">🔔</span> <b>${ready}</b></button>
      <button class="me-chip" data-act="me"><span class="avatar">${esc(initials(me))}</span><span class="me-name">${esc(fullName(me))}</span></button>
    </div>
  </header>`;
}

// ---------- Mijoz rejimi ----------
function guestBar() {
  const r = cfg().restaurant;
  const t = tableById(ui.guest);
  return `
  <header class="topbar guest-bar">
    <div class="brand">${logoHtml(r)}<div><b>${esc(r.name)}</b><small>${T("table")} ${esc(t.no)} · ${T("welcome")}</small></div></div>
    <div class="top-right" id="guestActs">${guestActs()}</div>
  </header>`;
}

// Mijoz planshetida faqat ofitsiantga qaytish tugmasi (PIN bilan)
function guestActs() {
  return `<button class="g-lock" data-act="guest-exit" title="Ofitsiant uchun">${T("waiterMode")}</button>`;
}

function bindGuestActs() {
  const box = app.querySelector("#guestActs");
  if (!box) return;
  box.querySelector("[data-act=guest-exit]").addEventListener("click", guestExit);
}

function startGuest(t) {
  setCart(t.id, getCart(t.id)); // savat saqlanib qoladi
  saveGuest(t.id);
  ui.cartOpen = false;
  ui.cat = "all";
  ui.q = "";
  try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch {}
  history.pushState({ guest: 1 }, "");
  render();
  window.scrollTo(0, 0);
}

// Chiqish faqat ofitsiant (yoki admin) PIN-kodi bilan
function guestExit() {
  let val = "";
  const pins = new Set(cfg().waiters.map((w) => String(w.pin || "")).filter(Boolean));
  if (cfg().adminPin) pins.add(String(cfg().adminPin));
  const done = (close) => {
    close();
    const t = tableById(ui.guest);
    saveGuest(null);
    changeLang("uz", false);
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch {}
    ui.view = t ? "table" : "tables";
    ui.tableId = t?.id || null;
    render();
  };
  modal(`
    <div class="modal-head"><h3>${T("waiterMode")}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <p class="muted center">${T("waiterPin")}</p>
      <div class="pin-dots">${"<i></i>".repeat(4)}</div>
      <div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k) => `<button ${k === "" ? "disabled" : ""} data-k="${k}">${k}</button>`).join("")}</div>
    </div>`, {
    onMount(m, close) {
      if (!pins.size) return done(close);
      const dots = m.querySelectorAll(".pin-dots i");
      const paint = () => dots.forEach((d, i) => d.classList.toggle("on", i < val.length));
      m.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => {
        const k = b.dataset.k;
        if (k === "⌫") val = val.slice(0, -1);
        else if (val.length < 4) val += k;
        paint();
        if (val.length === 4) {
          if (pins.has(val)) done(close);
          else { m.querySelector(".pin-dots").classList.add("shake"); vibrate(120); chime("error"); setTimeout(() => { val = ""; paint(); m.querySelector(".pin-dots").classList.remove("shake"); }, 450); }
        }
      }));
    }
  });
}

// Mijoz o'zi buyurtma beradi: oddiy tasdiqlash oynasi
function guestConfirm(t) {
  const cart = getCart(t.id);
  if (!cart.length) return;
  // bo'sh stol — planshetni mijozga bergan ofitsiant xizmat qiladi
  const w = waiterById(tableWaiterId(t)) || meW();
  const sum = cart.reduce((s, c) => s + c.price * c.qty, 0);
  modal(`
    <div class="modal-head"><h3>${T("confirmTitle")}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <ul class="confirm-list">
        ${cart.map((c) => `<li><span><b>${c.qty} ×</b> ${esc(cartName(c))}${optsHtml(c)}${c.note ? `<small>📝 ${esc(noteText(c.note))}</small>` : ""}</span><span>${money(c.price * c.qty, cur())}</span></li>`).join("")}
      </ul>
      <div class="sum-row big"><span>${T("total")}</span><b>${money(sum, cur())}</b></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>${T("moreChoose")}</button>
      <button class="btn btn-primary btn-lg" id="send">${T("send")}</button>
    </div>`, {
    onMount(m, close) {
      m.querySelector("#send").addEventListener("click", () => {
        if (S.reserves?.[t.id]) store.setReserve(t.id, null);
        store.putOrder({
          id: newId(),
          no: nextNo(),
          tableId: t.id,
          tableNo: t.no,
          zone: t.zone || "",
          waiterId: w?.id || "",
          waiterName: fullName(w) || "",
          sentBy: "Mijoz",
          byGuest: true,
          guests: activeOrders(t.id)[0]?.guests || Math.min(t.seats || 2, 2),
          comment: "",
          items: cart.map(orderLine),
          status: "new",
          createdAt: Date.now()
        });
        setCart(t.id, []);
        close();
        ui.cartOpen = false;
        renderCart();
        app.querySelectorAll(".dish[data-item]").forEach((d) => refreshCard(d.dataset.item));
        toast(T("sent"), { kind: "ok", timeout: 5000 });
      });
    }
  });
}

// Ofitsiant uchun: stollardan kelgan chaqiruvlar
function callsForMe() {
  return Object.entries(S.calls)
    .map(([tid, c]) => ({ ...c, tableId: tid }))
    .filter((c) => tableById(c.tableId) && (ui.filter === "all" || tableWaiterId(tableById(c.tableId)) === ui.me?.id))
    .sort((a, b) => a.at - b.at);
}
const callText = (c) => (c.type === "bill" ? "🧾 hisobni so'ramoqda" : "🙋 ofitsiantni chaqirmoqda");

function renderLogin() {
  const r = cfg().restaurant;
  const loginBg = cfg().categories.find((c) => c.hero)?.hero || "";
  app.innerHTML = `
  <div class="login" style="--login-bg:url('${esc(absUrl(loginBg))}')">
    <div class="login-card">
      <div class="login-brand">${logoHtml(r, "logo logo-xl")}<h1>${esc(r.name)}</h1><p>${esc(r.slogan || "")}</p></div>
      <h2>${L("Ofitsiant, ismingizni tanlang", "Официант, выберите своё имя", "Waiter, choose your name")}</h2>
      <div class="waiter-grid">
        ${cfg().waiters.map((w) => `
          <button class="waiter-card" data-w="${esc(w.id)}">
            <span class="avatar avatar-lg">${esc(initials(w))}</span>
            <b>${esc(w.first)}</b><small>${esc(w.last)}</small>
          </button>`).join("") || `<p class="empty">${L("Admin panelda ofitsiantlarni qo'shing.", "Добавьте официантов в админ-панели.", "Add waiters in the admin panel.")}</p>`}
      </div>
      <div class="login-foot">${connBadge(S.online)} <a href="${link("index.html", rid)}">Bosh sahifa</a></div>
    </div>
  </div>`;
  app.querySelectorAll("[data-w]").forEach((b) => b.addEventListener("click", () => {
    unlockAudio();
    const w = waiterById(b.dataset.w);
    if (!w.pin) { saveMe(w); keepAwake(); render(); return; }
    pinPad(w);
  }));
}

function pinPad(w) {
  let val = "";
  modal(`
    <div class="modal-head"><h3>${esc(fullName(w))}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <p class="muted center">PIN-kodni kiriting</p>
      <div class="pin-dots">${"<i></i>".repeat(4)}</div>
      <div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k) => `<button ${k === "" ? "disabled" : ""} data-k="${k}">${k}</button>`).join("")}</div>
    </div>`, {
    onMount(m, close) {
      const dots = m.querySelectorAll(".pin-dots i");
      const paint = () => dots.forEach((d, i) => d.classList.toggle("on", i < val.length));
      m.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => {
        const k = b.dataset.k;
        if (k === "⌫") val = val.slice(0, -1);
        else if (val.length < 4) val += k;
        paint();
        if (val.length === 4) {
          if (val === String(w.pin)) { close(); saveMe(w); keepAwake(); render(); toast(`Xush kelibsiz, ${esc(w.first)}!`, { kind: "ok" }); }
          else { m.querySelector(".pin-dots").classList.add("shake"); vibrate(120); chime("error"); setTimeout(() => { val = ""; paint(); m.querySelector(".pin-dots").classList.remove("shake"); }, 450); }
        }
      }));
    }
  });
}

function renderTables() {
  // "Mening stollarim": men xizmat qilayotgan stollar + bo'sh stollar (mijozni istalgan ofitsiant o'tqazishi mumkin)
  const tables = cfg().tables.filter((t) => ui.filter === "all" || tableState(t.id).key === "free" || tableWaiterId(t) === ui.me.id);
  const zones = [...new Set(tables.map((t) => t.zone || "Zal"))];
  const ready = readyForMe();
  const calls = [];
  const counts = { free: 0, busy: 0, ready: 0, served: 0, reserved: 0 };
  tables.forEach((t) => { const k = tableState(t.id).key; if (k === "free") counts.free++; else if (k === "reserved") counts.reserved++; else if (k === "ready") counts.ready++; else if (k === "served") counts.served++; else counts.busy++; });

  app.innerHTML = `
  ${topbar()}
  <div class="tv-bg" style="--tv-bg:url('${esc(absUrl(cfg().categories.find((c) => c.hero)?.hero || ""))}')"></div>
  <main class="tables-view">
    <div class="tv-back"><button class="btn btn-ghost" data-act="tables-back">← ${L("Orqaga", "Назад", "Back")}</button></div>
    ${helloHtml()}
    ${ready.length ? `
      <section class="ready-strip">
        ${ready.map((o) => `
          <div class="ready-item">
            <div><span class="check">✓</span><b>${ST(esc(o.tableNo))}</b> ${L("buyurtmasi tayyor", "заказ готов", "order ready")} <span class="ready-go">${L("Mijozga olib boring", "Отнесите гостю", "Take it to the guest")}</span><span class="ready-what">${o.items.map((i) => `${i.qty}× ${esc(i.name)}${i.opts ? ` (${esc(i.opts)})` : ""}`).join("<br>")}</span><small>#${esc(shortNo(o))} · ${agoL(o.readyAt)} ${L("oldin", "назад", "ago")} · ${esc(o.waiterName)}</small></div>
            <button class="btn btn-ok" data-served="${esc(o.id)}">🍽 ${L("Stolga olib kelindi", "Подано на стол", "Served to table")}</button>
          </div>`).join("")}
      </section>` : ""}
    ${calls.length ? `
      <section class="call-strip">
        ${calls.map((c) => `
          <div class="call-item ${c.type}">
            <div><b>Stol ${esc(c.tableNo)}</b> ${callText(c)} <small>${agoL(c.at)} oldin</small></div>
            <button class="btn btn-primary" data-callok="${esc(c.tableId)}">Bordim ✓</button>
          </div>`).join("")}
      </section>` : ""}
    <div class="tables-head">
      <div class="seg">
        <button class="${ui.filter === "mine" ? "on" : ""}" data-filter="mine">${L("Mening stollarim", "Мои столы", "My tables")}</button>
        <button class="${ui.filter === "all" ? "on" : ""}" data-filter="all">${L("Barcha stollar", "Все столы", "All tables")}</button>
      </div>
      <div class="legend">
        <span><i class="dot free"></i>${L("Bo'sh", "Свободно", "Free")} ${counts.free}</span>
        <span class="lg-band"><i class="dot band"></i>${L("Band", "Занято", "Busy")} <b>${counts.busy + counts.ready + counts.served + counts.reserved}</b></span>
        ${counts.reserved ? `<span><i class="dot reserved"></i>${L("Bron", "Бронь", "Reserved")} ${counts.reserved}</span>` : ""}
        <span><i class="dot busy"></i>${L("Oshxonada", "На кухне", "In kitchen")} ${counts.busy}</span>
        <span><i class="dot ready"></i>${L("Tayyor", "Готово", "Ready")} ${counts.ready}</span>
        <span><i class="dot served"></i>${L("Stolda", "На столе", "Served")} ${counts.served}</span>
      </div>
    </div>
    ${zones.map((z) => `
      <h3 class="zone">${esc(z)}</h3>
      <div class="table-grid">
        ${tables.filter((t) => (t.zone || "Zal") === z).map(tableCard).join("")}
      </div>`).join("") || `<div class="empty"><span class="big">🪑</span>${L(`Sizga biriktirilgan stol yo'q. "Barcha stollar"ni bosing.`, "За вами нет столов. Нажмите «Все столы».", `No tables assigned to you. Tap "All tables".`)}</div>`}
  </main>`;

  bindCommon();
  app.querySelector("[data-act=tables-back]")?.addEventListener("click", () => {
    // oxirgi ochilgan stolga qaytadi; bo'lmasa — restoranlar ro'yxatiga
    if (ui.lastTable && tableById(ui.lastTable)) return openTable(ui.lastTable);
    location.href = "index.html";
  });
  app.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { ui.filter = b.dataset.filter; render(); }));
  app.querySelectorAll("[data-table]").forEach((b) => b.addEventListener("click", () => tableTap(b.dataset.table)));
  app.querySelectorAll("[data-callok]").forEach((b) => b.addEventListener("click", () => { store.setCall(b.dataset.callok, null); render(); }));
}

// ---------- Ofitsiantning xizmat tarixi ----------
// Har yakunlangan stol (bir vaqtda yopilgan cheklar) bitta yozuv bo'ladi; arxiv kanaldan yuklanadi va yig'ilib boradi
function myVisits() {
  const me = meW();
  const all = { ...S.sales };
  Object.values(S.orders).forEach((o) => {
    if (o.status !== "closed" || all[o.id]) return;
    const sum = orderTotal(o);
    all[o.id] = { id: o.id, at: o.closedAt || o.createdAt, createdAt: o.createdAt, tableNo: o.tableNo, zone: o.zone || "", waiterId: o.waiterId, guests: o.guests || 0, pay: o.pay || "", sum, svc: Math.round(sum * (o.serviceRate || 0) / 100), items: o.items.map((it) => [it.name + (it.opts ? ` (${it.opts})` : ""), it.qty, it.price]) };
  });
  const visits = {};
  Object.values(all).filter((x) => x.waiterId === me.id).forEach((x) => {
    const k = `${x.tableNo}|${x.at}`;
    const v = visits[k] || (visits[k] = { k, tableNo: x.tableNo, zone: x.zone, at: x.at, start: x.createdAt || x.at, guests: 0, pay: x.pay, sum: 0, svc: 0, items: {} });
    v.start = Math.min(v.start, x.createdAt || x.at);
    v.guests = Math.max(v.guests, x.guests || 0);
    v.sum += x.sum; v.svc += x.svc;
    (x.items || []).forEach(([n, q]) => { v.items[n] = (v.items[n] || 0) + q; });
  });
  return Object.values(visits).sort((a, b) => b.at - a.at);
}
function openHistory() {
  store.loadSales();
  ui.view = "history";
  ui.histPeriod = ui.histPeriod || "today";
  render();
  window.scrollTo(0, 0);
}
function renderHistory() {
  const me = meW();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const from = { today: start.getTime(), week: start.getTime() - 6 * 86400000, all: 0 }[ui.histPeriod] ?? 0;
  const list = myVisits().filter((v) => v.at >= from);
  const total = list.reduce((s, v) => s + v.sum + v.svc, 0);
  const svc = list.reduce((s, v) => s + v.svc, 0);
  const guests = list.reduce((s, v) => s + (v.guests || 0), 0);
  const dayName = (ts) => { const d = new Date(ts); const t0 = start.getTime(); return ts >= t0 ? L("Bugun", "Сегодня", "Today") : ts >= t0 - 86400000 ? L("Kecha", "Вчера", "Yesterday") : d.toLocaleDateString("ru-RU"); };
  const groups = {};
  list.forEach((v) => (groups[dayName(v.at)] = groups[dayName(v.at)] || []).push(v));
  const payName = { naqd: "💵 Naqd", karta: "💳 Karta", click: "📱 Click/Payme" };
  const mins = (ms) => Math.max(1, Math.round(ms / 60000));
  app.innerHTML = `
  ${topbar()}
  <main class="tables-view hist-view">
    <div class="hist-head">
      <button class="icon-btn" data-act="back" title="${L("Orqaga", "Назад", "Back")}">←</button>
      <div><h2>${L("Xizmat tarixim", "История обслуживания", "Service history")}</h2><small class="muted">${esc(fullName(me))}</small></div>
    </div>
    <div class="seg hist-seg">
      ${[["today", L("Bugun", "Сегодня", "Today")], ["week", L("7 kun", "7 дней", "7 days")], ["all", L("Hammasi", "Все", "All")]].map(([k, l]) => `<button class="${ui.histPeriod === k ? "on" : ""}" data-hp="${k}">${l}</button>`).join("")}
    </div>
    <div class="tv-stats hist-stats">
      <span><b>${list.length}</b><small>${L("xizmat qilingan stol", "обслужено столов", "tables served")}</small></span>
      <span><b>${guests}</b><small>${L("mijoz", "гостей", "guests")}</small></span>
      <span><b>${money(total, cur())}</b><small>${L("savdo", "продажи", "sales")}</small></span>
      <span><b>${money(svc, cur())}</b><small>${L("xizmat haqi", "обслуживание", "service")}</small></span>
    </div>
    ${list.length ? Object.entries(groups).map(([d, vs]) => `
      <h3 class="zone">${esc(d)}</h3>
      <div class="hist-list">${vs.map((v) => `
        <details class="hist-item">
          <summary>
            <span class="hi-no">${esc(v.tableNo)}</span>
            <span class="hi-main"><b>${ST(esc(v.tableNo))}</b><small>${v.zone ? `${esc(v.zone)} · ` : ""}${clock(v.start)} – ${clock(v.at)} · ${mins(v.at - v.start)} ${L("daq", "мин", "min")}${v.guests ? ` · 👤 ${v.guests}` : ""}</small></span>
            <span class="hi-sum"><b>${money(v.sum + v.svc, cur())}</b><small>${v.pay ? payName[v.pay] || esc(v.pay) : ""}</small></span>
          </summary>
          <ul>${Object.entries(v.items).map(([n, q]) => `<li><span>${q} × ${esc(n)}</span></li>`).join("")}</ul>
        </details>`).join("")}
      </div>`).join("") : `<div class="empty"><span class="big">📜</span>${S.salesLoaded || ui.histPeriod === "today" ? L("Bu davrda yakunlangan stol yo'q.", "За этот период нет закрытых столов.", "No closed tables in this period.") : L("Tarix yuklanmoqda…", "История загружается…", "Loading history…")}</div>`}
  </main>`;
  bindCommon();
  app.querySelector("[data-act=back]").addEventListener("click", () => { ui.view = "tables"; render(); });
  app.querySelectorAll("[data-hp]").forEach((b) => b.addEventListener("click", () => { ui.histPeriod = b.dataset.hp; render(); }));
}

function helloHtml() {
  const me = meW();
  const h = new Date().getHours();
  const greet = h < 5 ? L("Xayrli tun", "Доброй ночи", "Good night") : h < 12 ? L("Xayrli tong", "Доброе утро", "Good morning") : h < 18 ? L("Xayrli kun", "Добрый день", "Good afternoon") : L("Xayrli kech", "Добрый вечер", "Good evening");
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const mine = Object.values(S.orders).filter((o) => o.waiterId === me.id);
  const closedToday = mine.filter((o) => o.status === "closed" && (o.closedAt || 0) >= start.getTime());
  const sales = closedToday.reduce((s, o) => s + orderTotal(o) * (1 + (o.serviceRate || 0) / 100), 0);
  const tips = closedToday.reduce((s, o) => s + orderTotal(o) * (o.serviceRate || 0) / 100, 0);
  const busy = new Set(mine.filter((o) => o.status !== "closed").map((o) => o.tableId)).size;
  return `
    <section class="tv-hello">
      <div><small>${clock()} · ${new Date().toLocaleDateString("ru-RU")}</small><h1>${greet}, ${esc(me.first)}!</h1></div>
      <div class="tv-stats">
        <span><b>${busy}</b><small>${L("band stolim", "мои занятые столы", "my busy tables")}</small></span>
        <span><b>${closedToday.length}</b><small>${L("bugun yopilgan chek", "закрыто чеков сегодня", "checks closed today")}</small></span>
        <span><b>${money(sales, cur())}</b><small>${L("bugungi savdom", "мои продажи сегодня", "my sales today")}</small></span>
        <span><b>${money(tips, cur())}</b><small>${L("xizmat haqi", "обслуживание", "service")}</small></span>
        <button class="tv-hist" data-act="history"><b>📜</b><small>${L("Xizmat tarixim", "История", "History")}</small></button>
      </div>
    </section>`;
}

function tableCard(t) {
  const st = tableState(t.id);
  const w = waiterById(tableWaiterId(t));
  const total = st.orders.reduce((s, o) => s + orderTotal(o), 0);
  const since = st.orders[0]?.createdAt;
  return `
  <button class="table-card st-${st.key}" data-table="${esc(t.id)}">
    <div class="tc-top"><span class="tc-no">${esc(t.no)}</span><span class="tc-seats">👤 ${esc(t.seats || "")}</span></div>
    <div class="tc-status">${st.label}</div>
    ${st.key === "reserved" && st.res.note ? `<div class="tc-res">${esc(st.res.note)}</div>` : ""}
    ${st.key === "ready" ? `<div class="tc-go">${L("Mijozga olib boring", "Отнесите гостю", "Take it to the guest")}</div>` : ""}
    ${st.key === "reserved" ? `<div class="tc-meta"><span>${clock(st.res.at)} ${L("da bron qilindi", "— забронирован", "reserved at")}</span></div>` : st.key !== "free" ? `<div class="tc-meta"><b>${money(total, cur())}</b><span>${st.key === "served" ? `${agoL(Math.max(...st.orders.map((o) => o.servedAt || 0)))} ${L("oldin berildi", "назад подано", "ago served")}` : since ? agoL(since) : ""}</span></div>` : `<div class="tc-meta"><span>&nbsp;</span></div>`}
    <div class="tc-waiter">${st.key === "free" ? "&nbsp;" : esc(fullName(w) || st.res?.waiterName || "—")}</div>
  </button>`;
}

// Bo'sh stol — darhol menyu; band stol — "Buyurtma qo'shish" yoki "Yakunlash"
function tableTap(tid) {
  const t = tableById(tid);
  const st = tableState(tid);
  if (!t) return;
  if (st.key === "free" || st.key === "reserved") return freeTap(t, st);
  const total = st.orders.reduce((s, o) => s + orderTotal(o), 0);
  modal(`
    <div class="modal-head"><h3>${ST(esc(t.no))}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <p class="tap-status">${st.label} · <b>${money(total, cur())}</b></p>
    </div>
    <div class="modal-actions tap-actions">
      <button class="btn btn-info btn-lg btn-block" id="tapAdd">➕ ${L("Buyurtma qo'shish", "Добавить заказ", "Add to order")}</button>
      <button class="btn btn-ok btn-lg btn-block" id="tapClose">✓ ${L("Yakunlash", "Завершить", "Finish")}</button>
    </div>`, {
    onMount(m, close) {
      m.querySelector("#tapAdd").addEventListener("click", () => { close(); openTable(tid); });
      m.querySelector("#tapClose").addEventListener("click", () => { close(); billModal(t); });
    }
  });
}

// Bo'sh stol: buyurtma berish yoki oldindan bron qilish; bron qilingan stol: mijoz keldi yoki bronni bekor qilish
function freeTap(t, st) {
  const res = st.key === "reserved" ? st.res : null;
  modal(`
    <div class="modal-head"><h3>${ST(esc(t.no))}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      ${res
        ? `<p class="tap-status">🔖 ${L("Bron qilingan", "Забронирован", "Reserved")}${res.note ? ` · <b>${esc(res.note)}</b>` : ""}</p><p class="muted small">${esc(res.waiterName || "")} · ${clock(res.at)}</p>${res.waiterId !== ui.me?.id ? `<p class="muted small">${L("Bronni faqat uni qilgan ofitsiant yoki admin bekor qila oladi.", "Отменить бронь может только её автор или админ.", "Only the waiter who made it or an admin can cancel it.")}</p>` : ""}`
        : `<p class="tap-status">${L("Bo'sh stol", "Свободный стол", "Free table")}</p>
           <label class="res-note"><small>${L("Bron uchun izoh (ixtiyoriy): mijoz ismi, vaqti", "Комментарий к брони (необязательно): имя, время", "Reservation note (optional): name, time")}</small>
           <input id="resNote" maxlength="60" placeholder="${L("Masalan: Alisher, 19:30", "Например: Алишер, 19:30", "e.g. Alisher, 7:30 pm")}"></label>`}
    </div>
    <div class="modal-actions tap-actions">
      <button class="btn btn-info btn-lg btn-block" id="tapOrder">🍽 ${res ? L("Mijoz keldi · Buyurtma", "Гость пришёл · Заказ", "Guest arrived · Order") : L("Buyurtma berish", "Принять заказ", "Take order")}</button>
      ${res
        ? (res.waiterId !== ui.me?.id ? "" : `<button class="btn btn-ghost btn-lg btn-block" id="tapUnres">✕ ${L("Bronni bekor qilish", "Отменить бронь", "Cancel reservation")}</button>`)
        : `<button class="btn btn-res btn-lg btn-block" id="tapRes">🔖 ${L("Bron qilish", "Забронировать", "Reserve")}</button>`}
    </div>`, {
    onMount(m, close) {
      m.querySelector("#tapOrder").addEventListener("click", () => { close(); openTable(t.id); });
      m.querySelector("#tapRes")?.addEventListener("click", () => {
        const me = meW();
        store.setReserve(t.id, { at: Date.now(), tableNo: t.no, waiterId: me.id, waiterName: fullName(me), note: m.querySelector("#resNote").value.trim() });
        close(); toast(`🔖 ${ST(esc(t.no))}: ${L("bron qilindi", "забронирован", "reserved")}`, { kind: "ok" }); render();
      });
      m.querySelector("#tapUnres")?.addEventListener("click", () => {
        store.setReserve(t.id, null);
        close(); toast(`${ST(esc(t.no))}: ${L("bron bekor qilindi", "бронь отменена", "reservation cancelled")}`); render();
      });
    }
  });
}

function openTable(tid) {
  ui.view = "table";
  ui.tableId = tid;
  ui.lastTable = tid;
  ui.cat = "all";
  ui.q = "";
  ui.cartOpen = false;
  render();
  window.scrollTo(0, 0);
}

// ---------- Stol: menyu + savat ----------
function renderTable() {
  const t = tableById(ui.tableId);
  const w = waiterById(tableWaiterId(t)) || meW();
  app.innerHTML = `
  ${topbar()}
  <div class="table-view">
    <div class="mood" id="mood"><i></i><i></i></div>
    <section class="menu-pane" id="menuPane">
      <div class="menu-top">
      <div class="menu-head">
        ${ui.guest ? "" : `<button class="btn btn-ghost to-tables" data-act="back" title="${L("Barcha stollar", "Все столы", "All tables")}">← ${L("Stollar", "Столы", "Tables")}</button>`}
        <div class="mh-title">${ui.guest
          ? `<h2>${T("menu")}</h2><small>${T("yourWaiter")}: <b>${esc(fullName(w) || "—")}</b></small>`
          : `<h2>${ST(esc(t.no))}</h2><small>${esc(t.zone || "")} · ${L("Ofitsiant", "Официант", "Waiter")}: <b>${esc(fullName(w) || "—")}</b></small>`}</div>
        ${ui.guest ? "" : `<button class="btn btn-ghost guest-start" data-act="guest" title="${L("Planshetni mijozga berish", "Передать планшет гостю", "Hand tablet to guest")}">📱 ${L("Mijozga berish", "Гостю", "To guest")}</button>`}
        <div class="langs" id="langs">${LANGS.map((l) => `<button class="${getLang() === l.id ? "on" : ""}" data-lang="${l.id}" title="${l.label}">${l.short}</button>`).join("")}</div>
        <div class="search"><input type="search" id="q" placeholder="${esc(T("search"))}" value="${esc(ui.q)}"></div>
      </div>
      </div>
      ${ui.guest ? "" : `<div class="add-hint" id="addHint" hidden></div>`}
      <nav class="cats" id="cats"></nav>
      <div id="grid"></div>
    </section>
    <aside class="cart-pane ${ui.cartOpen ? "open" : ""}" id="cartPane"></aside>
    <button class="cart-fab" id="cartFab"></button>
    <button class="menu-back" id="menuBack" hidden>← ${esc(T("back"))}</button>
  </div>`;
  bindCommon();
  bindGuestActs();
  app.querySelector("[data-act=back]")?.addEventListener("click", () => { ui.view = "tables"; render(); });
  app.querySelector("[data-act=guest]")?.addEventListener("click", () => startGuest(t));
  app.querySelector(".table-view").classList.toggle("guest", !!ui.guest);
  app.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => changeLang(b.dataset.lang)));
  const q = app.querySelector("#q");
  q.addEventListener("input", () => { ui.q = q.value; renderGrid(); });
  app.querySelector("#cartFab").addEventListener("click", () => { ui.cartOpen = true; app.querySelector("#cartPane").classList.add("open"); });
  renderCats();
  renderGrid();
  renderCart();
  syncTopbarHeight();
  bindHeadroom();
}

// Pastga varaqlaganda sarlavha ketadi, faqat taomlar qoladi; yuqoriga surilsa bo'limlar qatori qaytadi
function bindHeadroom() {
  const pane = app.querySelector("#menuPane");
  const cats = app.querySelector("#cats");
  if (!pane || !cats) return;
  let last = 0;
  const onScroll = (y) => {
    const dy = y - last;
    if (Math.abs(dy) < 6) return;
    const past = cats.getBoundingClientRect().top <= (window.innerWidth <= 900 ? 1 : pane.getBoundingClientRect().top + 1);
    cats.classList.toggle("stuck", past);
    cats.classList.toggle("hide", past && dy > 0);
    if (back) back.hidden = !past;
    last = y;
  };
  // "Orqaga": eng tepaga, bo'limlar ro'yxatiga qaytaradi
  const back = app.querySelector("#menuBack");
  back?.addEventListener("click", () => {
    if (pane.scrollHeight > pane.clientHeight && window.innerWidth > 900) pane.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
    back.hidden = true;
  });
  pane.addEventListener("scroll", () => onScroll(pane.scrollTop), { passive: true });
  if (!window.__headroomWin) {
    window.__headroomWin = true;
    window.addEventListener("scroll", () => { const c = app.querySelector("#cats"); if (c && window.innerWidth <= 900) c.__onScroll?.(window.scrollY); }, { passive: true });
  }
  cats.__onScroll = onScroll;
}

// Yopishqoq menyu sarlavhasi topbar ostida turishi uchun uning balandligini CSS'ga beramiz
function syncTopbarHeight() {
  const tb = app.querySelector(".topbar");
  if (tb) document.documentElement.style.setProperty("--tb", tb.offsetHeight + "px");
}
window.addEventListener("resize", syncTopbarHeight);

// ---------- Kayfiyat foni ----------
let moodUrl = null;
let moodFlip = 0;
function setMood(url) {
  const el = app.querySelector("#mood");
  if (!el || url === moodUrl) return;
  moodUrl = url;
  const layers = el.querySelectorAll("i");
  const next = layers[moodFlip % 2];
  const prev = layers[(moodFlip + 1) % 2];
  moodFlip++;
  next.style.backgroundImage = url ? `url('${url}')` : "none";
  next.classList.add("on");
  prev.classList.remove("on");
}
// CSS o'zgaruvchisidagi url() css/ papkaga nisbatan hisoblanadi, shuning uchun to'liq manzil beramiz
const absUrl = (u) => (u && !/^(data:|https?:)/.test(u) ? new URL(u, location.href).href : u || "");
const catById = (id) => cfg().categories.find((c) => c.id === id);

function renderCats() {
  const el = app.querySelector("#cats");
  if (!el) return;
  const hasPopular = cfg().items.some((i) => i.popular && !i.hidden);
  const cats = [{ id: "all", name: T("all"), emoji: "🍽️" }, ...(hasPopular ? [{ id: "popular", name: T("popular"), emoji: "⭐" }] : []), ...cfg().categories];
  el.innerHTML = cats.map((c) => {
    const pic = c.hero || c.bg;
    return `<button class="cat ${ui.cat === c.id ? "on" : ""}" data-cat="${esc(c.id)}">
      <span class="cat-thumb" ${pic ? `style="background-image:url('${esc(pic)}')"` : ""}>${pic ? "" : esc(c.emoji || "")}</span>${esc(catName(c))}${c.adult ? "<sup>18+</sup>" : ""}
    </button>`;
  }).join("");
  el.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => {
    ui.cat = b.dataset.cat;
    renderCats(); renderGrid();
    const pane = app.querySelector("#menuPane");
    // Sarlavha allaqachon ketgan bo'lsa, qaytarmaymiz: yangi bo'lim bo'limlar qatori ostidan boshlanadi
    const stuck = el.classList.contains("stuck");
    const head = app.querySelector(".menu-top");
    if (pane && pane.scrollHeight > pane.clientHeight) pane.scrollTo({ top: stuck && head ? head.offsetTop + head.offsetHeight : 0 });
    else window.scrollTo({ top: stuck && head ? head.getBoundingClientRect().bottom + window.scrollY : 0 });
    el.classList.remove("hide");
    b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }));
}

function visibleItems() {
  const q = ui.q.trim().toLowerCase();
  return cfg().items.filter((i) => {
    if (i.hidden) return false;
    if (q) return [i.name, i.desc, itemName(i), itemDesc(i)].join(" ").toLowerCase().includes(q);
    if (ui.cat === "all") return true;
    if (ui.cat === "popular") return i.popular;
    return i.cat === ui.cat;
  });
}

function dishCard(i, cart) {
  const inCart = cart.filter((c) => c.itemId === i.id).reduce((s, c) => s + c.qty, 0);
  const stop = !!S.stop[i.id];
  const img = i.img
    ? `<div class="dish-img ${i.fit === "contain" ? "contain" : ""}" style="background-image:url('${esc(i.img)}')">`
    : `<div class="dish-img emoji"><span class="dish-emo">${esc(i.emoji || "🍽️")}</span>`;
  const minPrice = i.variants?.length ? Math.min(...i.variants.map((v) => Number(v.price) || 0)) : i.price;
  const priceTxt = (i.variants?.length > 1 && new Set(i.variants.map((v) => v.price)).size > 1 ? (getLang() === "uz" ? "" : T("from") + " ") : "") + money(minPrice, cur()).replace(` ${cur()}`, "");
  const fromSuffix = i.variants?.length > 1 && new Set(i.variants.map((v) => v.price)).size > 1 && getLang() === "uz" ? " dan" : "";
  return `
  <article class="dish ${stop ? "stopped" : ""} ${inCart ? "in-cart" : ""}" data-item="${esc(i.id)}">
    ${img}
      ${i.popular ? `<span class="dish-pop">★ ${T("popular")}</span>` : ""}
      ${inCart ? `<span class="dish-qty">${inCart}</span>` : ""}
    </div>
    <div class="dish-body">
      <h3>${esc(itemName(i))}</h3>
      <p>${esc(itemDesc(i))}</p>
      <div class="dish-foot">
        <span class="dish-price">${stop ? T("soldOut") : `${esc(priceTxt)}<small>${esc(cur() + fromSuffix)}</small>`}</span>
        ${i.weight && !stop ? `<span class="dish-weight">${esc(weightText(i.weight))}</span>` : ""}
        ${stop ? "" : `<button class="dish-add" data-add="${esc(i.id)}" aria-label="${L("Qo'shish", "Добавить", "Add")}">+</button>`}
      </div>
    </div>
  </article>`;
}

// Bo'lim boshidagi katta rasmli sarlavha olib tashlandi (taom deb bosib yuborishardi); funksiya kerak bo'lsa qoladi
function heroHtml(c, count) {
  if (!c) return "";
  const pic = c.hero || c.bg;
  return `
  <header class="cat-hero ${pic ? "" : "plain"}" ${pic ? `style="--hero:url('${esc(absUrl(pic))}')"` : ""}>
    ${c.adult ? `<span class="adult">18+</span>` : ""}
    <div>${catTagline(c) ? `<small>${esc(catTagline(c))}</small>` : ""}<h2>${esc(catName(c))}</h2><span>${count} ${T("dishes")}</span></div>
  </header>`;
}

let moodObserver = null;
function renderGrid() {
  const el = app.querySelector("#grid");
  if (!el) return;
  const cart = getCart(ui.tableId);
  const items = visibleItems();
  const q = ui.q.trim();
  let sections = [];
  if (q) {
    sections = [{ c: { id: "q", name: `“${q}”`, tagline: T("searchRes") }, list: items }];
  } else if (ui.cat === "all") {
    sections = cfg().categories.map((c) => ({ c, list: items.filter((i) => i.cat === c.id) })).filter((s) => s.list.length);
  } else if (ui.cat === "popular") {
    const top = cfg().items.find((i) => i.popular && i.img);
    sections = [{ c: { id: "popular", name: T("popularTitle"), tagline: T("popularTag"), hero: top?.img, bg: catById(top?.cat)?.bg }, list: items }];
  } else {
    const c = catById(ui.cat);
    sections = [{ c, list: items }];
  }
  if (!items.length) {
    el.innerHTML = `<div class="empty"><span class="big">🔍</span>${T("notFound")}</div>`;
    setMood(null);
    return;
  }
  el.innerHTML = sections.map(({ c, list }) => `
    <section class="cat-sec" data-bg="${esc(c.bg || c.hero || "")}">
      <div class="grid-row">${list.map((i) => dishCard(i, cart)).join("")}</div>
    </section>`).join("");

  setMood(sections[0].c.bg || sections[0].c.hero || null);
  moodObserver?.disconnect();
  if (sections.length > 1 && "IntersectionObserver" in window) {
    moodObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setMood(e.target.dataset.bg || null); });
    }, { rootMargin: "-35% 0px -60% 0px" });
    el.querySelectorAll(".cat-sec").forEach((s) => moodObserver.observe(s));
  }

  el.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    const item = cfg().items.find((i) => i.id === b.dataset.add);
    if (hasOpts(item)) return itemModal(item);
    addToCart(ui.tableId, item);
    refreshCard(item.id, true);
    renderCart();
  }));
  el.querySelectorAll("[data-item]").forEach((c) => c.addEventListener("click", () => {
    const item = cfg().items.find((i) => i.id === c.dataset.item);
    if (S.stop[item.id]) { toast(`${esc(itemName(item))} ${T("soldOutMsg")}`, { kind: "error" }); return; }
    itemModal(item);
  }));
}

// Bitta kartani qayta chizish (butun menyuni emas, scroll joyida qoladi)
function refreshCard(itemId, bump = false) {
  const old = app.querySelector(`.dish[data-item="${CSS.escape(itemId)}"]`);
  const item = cfg().items.find((i) => i.id === itemId);
  if (!old || !item) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = dishCard(item, getCart(ui.tableId)).trim();
  const card = tmp.firstElementChild;
  old.replaceWith(card);
  if (bump) card.classList.add("bump");
  card.querySelector("[data-add]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (hasOpts(item)) return itemModal(item);
    addToCart(ui.tableId, item);
    refreshCard(item.id, true);
    renderCart();
  });
  card.addEventListener("click", () => { if (!S.stop[item.id]) itemModal(item); });
}

function itemModal(item) {
  let qty = 1;
  const variants = item.variants || [];
  const extras = item.extras || [];
  let variant = variants.length === 1 ? variants[0] : null;
  const chosen = new Set();
  const visual = item.img
    ? `<div class="dm-img ${item.fit === "contain" ? "contain" : ""}" style="background-image:url('${esc(item.img)}')">`
    : `<div class="dm-img emoji"><span>${esc(item.emoji || "🍽️")}</span>`;
  const sel = () => ({ variant, extras: extras.filter((e) => chosen.has(e.id)) });
  const plus = (p) => (Number(p) ? `+${money(p, cur())}` : "");
  modal(`
    ${visual}<button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <div class="im-title"><h3>${esc(itemName(item))}</h3><b id="unit">${money(unitPrice(item, sel()), cur())}</b></div>
      <div class="im-meta">${item.weight ? `<span>${esc(weightText(item.weight))}</span>` : ""}${item.time ? `<span>⏱ ~${item.time} ${T("min")}</span>` : ""}${item.popular ? `<span>★ ${T("popular")}</span>` : ""}</div>
      <p class="muted">${esc(itemDesc(item))}</p>
      ${variants.length ? `
        <div class="label">${T("options")}</div>
        <div class="opt-vars">${variants.map((v) => `<button class="opt-var ${variant === v ? "on" : ""}" data-v="${esc(v.id)}"><b>${esc(optName(v))}</b><span>${money(v.price, cur())}</span></button>`).join("")}</div>` : ""}
      ${extras.length ? `
        <div class="label">${T("extras")}</div>
        <div class="opt-extras">${extras.map((e) => `<button class="opt-ex" data-e="${esc(e.id)}"><i></i><b>${esc(optName(e))}</b><span>${plus(e.price)}</span></button>`).join("")}</div>` : ""}
    </div>
    <div class="modal-actions">
      <div class="stepper"><button data-d="-1">−</button><b id="qty">1</b><button data-d="1">+</button></div>
      <button class="btn btn-primary btn-lg" id="add">${T("toCart")} · <span id="sum">${money(unitPrice(item, sel()), cur())}</span></button>
    </div>`, {
    onMount(m, close) {
      m.classList.add("dish-modal");
      const paint = () => {
        const u = unitPrice(item, sel());
        m.querySelector("#unit").textContent = money(u, cur());
        m.querySelector("#sum").textContent = money(u * qty, cur());
      };
      m.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => {
        variant = variants.find((v) => v.id === b.dataset.v);
        m.querySelectorAll("[data-v]").forEach((x) => x.classList.toggle("on", x === b));
        m.querySelector(".opt-vars").classList.remove("need");
        paint();
      }));
      m.querySelectorAll("[data-e]").forEach((b) => b.addEventListener("click", () => {
        const id = b.dataset.e; chosen.has(id) ? chosen.delete(id) : chosen.add(id); b.classList.toggle("on"); paint();
      }));
      m.querySelectorAll("[data-d]").forEach((b) => b.addEventListener("click", () => {
        qty = Math.max(1, qty + Number(b.dataset.d));
        m.querySelector("#qty").textContent = qty;
        paint();
      }));
      m.querySelector("#add").addEventListener("click", () => {
        if (variants.length && !variant) {
          const box = m.querySelector(".opt-vars");
          box.classList.add("need"); box.scrollIntoView({ block: "center", behavior: "smooth" });
          toast(T("chooseFirst"), { kind: "error" });
          return;
        }
        addToCart(ui.tableId, item, qty, "", sel());
        close(); refreshCard(item.id, true); renderCart();
      });
    }
  });
}

// Savat belgisi: qopqoqli patnis (Kamoliddin bergan logo)
const CART_ICON = `<i class="fab-ico" aria-hidden="true"></i>`;

function renderCart() {
  const pane = app.querySelector("#cartPane");
  const fab = app.querySelector("#cartFab");
  if (!pane) return;
  const t = tableById(ui.tableId);
  const cart = getCart(t.id);
  const cartSum = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const orders = activeOrders(t.id);
  const billSum = orders.reduce((s, o) => s + orderTotal(o), 0);

  pane.innerHTML = `
    <div class="cart-head">
      <h3>${ui.guest ? `${T("cart")} <small>${T("table")} ${esc(t.no)}</small>` : orders.length ? ST(esc(t.no)) : `${L("Yangi buyurtma", "Новый заказ", "New order")} <small>${ST(esc(t.no))}</small>`}</h3>
      <button class="icon-btn cart-close" data-act="close-cart">✕</button>
    </div>
    <div class="cart-scroll">
      ${cart.length ? `<ul class="cart-list">
        ${cart.map((c) => `
          <li>
            ${cartThumb(c)}
            <div class="cl-main"><b>${esc(cartName(c))}</b>${optsHtml(c)}${c.note ? `<small class="cl-note">📝 ${esc(noteText(c.note))}</small>` : ""}<small>${money(c.price * c.qty, cur())}</small></div>
            <div class="stepper sm"><button data-q="${esc(c.key)}" data-d="-1">−</button><b>${c.qty}</b><button data-q="${esc(c.key)}" data-d="1">+</button></div>
          </li>`).join("")}
      </ul>` : `<div class="empty small"><i class="serve-ico" aria-hidden="true"></i>${ui.guest ? T("emptyCart") : orders.length ? L("Menyudan taom tanlang, u shu stol buyurtmasiga qo'shiladi", "Выберите блюдо в меню, оно добавится к заказу стола", "Pick a dish from the menu, it will be added to this table's order") : L("Menyudan taom tanlang", "Выберите блюдо в меню", "Pick a dish from the menu")}</div>`}

      ${orders.length ? `
        <div class="tickets">
          <h4>${ui.guest ? T("yourOrders") : L("Stol cheklari", "Чеки стола", "Table checks")}</h4>
          ${orders.map((o) => `
            <div class="ticket">
              <div class="tk-head"><b>#${esc(shortNo(o))}</b><span class="badge b-${o.status}">${ui.guest ? T("st_" + o.status) : statusLabel(o.status)}</span><small>${clock(o.createdAt)}</small></div>
              <ul>${o.items.map((it) => `<li class="${it.done ? "done" : ""}"><span>${it.qty} × ${esc(cartName(it))}${it.opts ? ` <i class="tk-opts">(${esc(optsText(it))})</i>` : ""}</span><span>${money(it.qty * it.price, cur())}</span></li>`).join("")}</ul>
              ${ui.guest ? "" : o.status === "ready" ? `<button class="btn btn-ok btn-block" data-served="${esc(o.id)}">🍽 ${L("Stolga olib kelindi", "Подано на стол", "Served to table")}</button>` : ""}
              ${!ui.guest && o.status === "new" ? `<button class="link-btn" data-cancel="${esc(o.id)}">${L("Bekor qilish", "Отменить", "Cancel")}</button>` : ""}
            </div>`).join("")}
        </div>` : ""}
    </div>
    <div class="cart-foot">
      ${cart.length ? `
        <div class="sum-row"><span>${ui.guest ? T("newOrder") : orders.length ? L("Yangi tanlangan taomlar", "Новые выбранные блюда", "Newly picked dishes") : L("Yangi buyurtma", "Новый заказ", "New order")}</span><b>${money(cartSum, cur())}</b></div>
        <button class="btn btn-primary btn-lg btn-block" data-act="confirm">${ui.guest ? T("placeOrder") : orders.length ? L("✓ Buyurtmaga qo'shish", "✓ Добавить к заказу", "✓ Add to order") : L("🍳 Oshxonaga yuborish", "🍳 Отправить на кухню", "🍳 Send to kitchen")}</button>` : ""}
      ${orders.length && !cart.length && !ui.guest ? `
        ${`<button class="btn btn-info btn-lg btn-block" data-act="add-more">➕ ${L("Buyurtma qo'shish", "Добавить заказ", "Add order")}</button>
        <button class="btn btn-ok btn-lg btn-block" data-act="bill">✓ ${L("Mijoz ketdi · Yakunlash", "Гость ушёл · Закрыть", "Guest left · Close")}</button>`}` : ""}
    </div>`;

  fab.innerHTML = ui.guest
    ? (cartCount ? `${CART_ICON}<b>${cartCount} ${T("pcs")}</b> · ${money(cartSum, cur())} <span>${T("view")}</span>` : orders.length ? `🍽 ${T("yourOrders")} <span>${T("view")}</span>` : "")
    : (cartCount ? `${CART_ICON}<b>${cartCount} ${T("pcs")}</b> · ${money(cartSum, cur())} <span>${T("view")}</span>` : "");
  // ofitsiantda pastdagi tugma faqat yangi taom tanlanganda chiqadi (chalg'itmasin)
  fab.hidden = ui.guest ? !cartCount && !orders.length : !cartCount;
  const hint = app.querySelector("#addHint");
  if (hint) {
    hint.hidden = !orders.length;
    hint.innerHTML = orders.length ? `<b>➕ ${L(`Stolda ${orders.length} ta buyurtma bor.`, `На столе заказов: ${orders.length}.`, `Orders on this table: ${orders.length}.`)}</b> <span>${L("Mijoz yana nimadir so'rasa, taomni tanlang va tasdiqlang: u shu stolga qo'shiladi.", "Если гость закажет ещё, выберите блюдо и подтвердите: оно добавится к этому столу.", "If the guest orders more, pick the dish and confirm: it is added to this table.")}</span>` : "";
  }

  pane.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
    const list = getCart(t.id);
    const c = list.find((x) => x.key === b.dataset.q);
    c.qty += Number(b.dataset.d);
    setCart(t.id, list.filter((x) => x.qty > 0));
    renderCart(); refreshCard(c.itemId);
  }));
  pane.querySelector("[data-act=close-cart]").addEventListener("click", () => { ui.cartOpen = false; pane.classList.remove("open"); });
  // Menyuga qaytib yana taom tanlash: tanlangani shu stol hisobiga qo'shiladi
  pane.querySelector("[data-act=add-more]")?.addEventListener("click", () => {
    ui.cartOpen = false; pane.classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast(`${ST(esc(t.no))}: ${L(`menyudan taom tanlang, keyin pastdagi "Buyurtmaga qo'shish"ni bosing`, "выберите блюда в меню, затем внизу нажмите «Добавить к заказу»", `pick dishes, then tap "Add to order" below`)}`);
  });
  pane.querySelector("[data-act=confirm]")?.addEventListener("click", () => (ui.guest ? guestConfirm(t) : confirmOrder(t)));
  pane.querySelector("[data-act=bill]")?.addEventListener("click", () => billModal(t));
  pane.querySelectorAll("[data-served]").forEach((b) => b.addEventListener("click", () => markServed(b.dataset.served)));
  pane.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", async () => {
    const o = S.orders[b.dataset.cancel];
    if (o?.status !== "new") { toast("Oshpaz allaqachon boshlagan, bekor qilib bo'lmaydi", { kind: "error" }); return; }
    if (await confirmBox(L(`#${esc(shortNo(o))} buyurtmani bekor qilasizmi?`, `Отменить заказ #${esc(shortNo(o))}?`, `Cancel order #${esc(shortNo(o))}?`), L("Bekor qilish", "Отменить", "Cancel"), { danger: true })) store.removeOrder(o.id);
  }));
}

// Savat qatori: nom mijoz tilida, oshxonaga esa o'zbekcha nom boradi
function cartName(c) {
  const item = cfg().items.find((i) => i.id === c.itemId);
  return item && getLang() !== "uz" ? itemName(item) : c.name;
}
function noteText(n) {
  return n.split(", ").map(noteLabel).join(", ");
}

function changeLang(l, rerender = true) {
  setLang(l);
  try { localStorage.setItem("menyu.lang", getLang()); } catch {}
  if (!rerender || ui.view !== "table") return;
  const y = window.scrollY;
  const pane = app.querySelector("#menuPane");
  const py = pane?.scrollTop || 0;
  render();
  window.scrollTo(0, y);
  const p2 = app.querySelector("#menuPane"); if (p2) p2.scrollTop = py;
}

function cartThumb(c) {
  const item = cfg().items.find((i) => i.id === c.itemId);
  return item?.img ? `<span class="cl-img" style="background-image:url('${esc(item.img)}')"></span>` : `<span class="cl-img">${esc(c.emoji || "🍽️")}</span>`;
}

function statusLabel(s) {
  return { new: L("Yangi", "Новый", "New"), cooking: L("Tayyorlanmoqda", "Готовится", "Cooking"), ready: L("Tayyor ✓", "Готово ✓", "Ready ✓"), served: L("Stolda 🍽", "На столе 🍽", "Served 🍽"), closed: L("Yopilgan", "Закрыт", "Closed") }[s] || s;
}

function nextNo() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = Object.values(S.orders).filter((o) => o.createdAt >= start.getTime());
  return Math.max(0, ...today.map((o) => Number(o.no) || 0)) + 1;
}

// Ofitsiant tasdiqlashi bilan buyurtma darhol oshxonaga ketadi (alohida oyna yo'q)
function confirmOrder(t) {
  const cart = getCart(t.id);
  if (!cart.length) return;
  const me = meW();
  const active = activeOrders(t.id);
  // bo'sh stolga buyurtmani kim yuborsa, stol o'sha ofitsiantniki bo'ladi
  const w = active.length ? waiterById(tableWaiterId(t)) : me;
  const order = {
    id: newId(),
    no: nextNo(),
    tableId: t.id,
    tableNo: t.no,
    zone: t.zone || "",
    waiterId: w?.id || me.id,
    waiterName: fullName(w || me),
    sentBy: fullName(me),
    guests: active[0]?.guests || Math.min(t.seats || 2, 2),
    comment: "",
    items: cart.map(orderLine),
    status: "new",
    createdAt: Date.now()
  };
  if (active.length) order.extra = true;
  store.putOrder(order);
  if (S.reserves?.[t.id]) store.setReserve(t.id, null);
  setCart(t.id, []);
  ui.cartOpen = false;
  toast(`✓ ${ST(esc(t.no))}: ${order.extra ? L("buyurtmaga qo'shildi va oshxonaga yuborildi", "добавлено к заказу и отправлено на кухню", "added to the order and sent to the kitchen") : L("buyurtma oshxonaga yuborildi", "заказ отправлен на кухню", "order sent to the kitchen")}`, { kind: "ok" });
  if (!S.online) toast(L("Aloqa yo'q: buyurtma aloqa tiklanishi bilan yuboriladi", "Нет связи: заказ отправится, когда связь восстановится", "Offline: the order will be sent when the connection is back"), { kind: "error", timeout: 6000 });
  ui.view = "tables";
  render();
}

function markServed(id) {
  const o = S.orders[id];
  if (!o) return;
  store.updateOrder(id, { status: "served", servedAt: Date.now() });
  toast(`${ST(esc(o.tableNo))}: ${L("taom stolga olib kelindi", "блюда поданы на стол", "food served")}`, { kind: "ok" });
}

function billLines(orders) {
  const lines = {};
  orders.forEach((o) => o.items.forEach((it) => {
    const k = it.itemId + "|" + it.price + "|" + (it.opts || "");
    lines[k] = lines[k] || { k, name: it.name, opts: it.opts || "", price: it.price, qty: 0 };
    lines[k].qty += it.qty;
  }));
  return Object.values(lines);
}

function billModal(t) {
  const orders = activeOrders(t.id);
  const lines = billLines(orders);
  const sub = orders.reduce((s, o) => s + orderTotal(o), 0);
  const rate = Number(cfg().restaurant.service) || 0;
  const service = Math.round(sub * rate / 100);
  const total = sub + service;
  const notServed = orders.filter((o) => o.status === "new" || o.status === "cooking" || o.status === "ready").length;
  const w = waiterById(tableWaiterId(t));
  modal(`
    <div class="modal-head"><h3>${L("Hisob", "Счёт", "Bill")} · ${ST(esc(t.no))}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <div class="bill">
        <div class="bill-brand">${logoHtml(cfg().restaurant)}<b>${esc(cfg().restaurant.name)}</b></div>
        <ul>${lines.map((l) => `<li><span>${l.qty} × ${esc(l.name)}${l.opts ? ` <small>(${esc(l.opts)})</small>` : ""}</span><span>${money(l.qty * l.price, cur())}</span></li>`).join("")}</ul>
        <div class="sum-row"><span>${L("Jami taomlar", "Блюда всего", "Food total")}</span><b>${money(sub, cur())}</b></div>
        ${rate ? `<div class="sum-row"><span>${L("Xizmat haqi", "Обслуживание", "Service")} ${rate}%</span><b>${money(service, cur())}</b></div>` : ""}
        <div class="sum-row big"><span>To'lov uchun</span><b>${money(total, cur())}</b></div>
        <p class="muted small">${L("Ofitsiant", "Официант", "Waiter")}: ${esc(fullName(w))} · ${clock()}</p>
      </div>
      ${notServed ? `<p class="warn-note">⚠️ ${L(`${notServed} ta chek hali mijozga berilmagan.`, `Ещё не подано чеков: ${notServed}.`, `${notServed} check(s) not served yet.`)}</p>` : ""}
    </div>
    <div class="modal-actions">
      <button class="btn btn-ok btn-lg btn-block" id="close">✓ ${L("Stolni yopish", "Закрыть стол", "Close table")}</button>
    </div>`, {
    onMount(m, close) {
      m.querySelector("#close").addEventListener("click", () => {
        const now = Date.now();
        orders.forEach((o) => {
          const done = store.updateOrder(o.id, { status: "closed", closedAt: now, servedAt: o.servedAt || now, serviceRate: rate, closedBy: fullName(meW()) });
          if (done) store.recordSale(done);
        });
        if (S.calls[t.id]) store.setCall(t.id, null);
        close();
        toast(`${ST(esc(t.no))} ${L("yopildi va bo'shadi", "закрыт и свободен", "closed and free")} · ${money(total, cur())}`, { kind: "ok", timeout: 5000 });
        ui.view = "tables";
        render();
        showReceipt({ t, w, orders, lines });
      });
    }
  });
}

// ---------- Chek chop etish (58/80 mm termoprinter) ----------
function receiptHtml({ t, w, orders, lines, pay, split = 0, title = "" }) {
  const r = cfg().restaurant;
  const width = String(r.receiptWidth || "80") === "58" ? 58 : 80;
  const c = cfg().restaurant.currency || "so'm";
  const m = (x) => money(x, c);
  const sub = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const rate = Number(r.service) || 0;
  const service = Math.round(sub * rate / 100);
  const total = sub + service;
  const d = new Date();
  const dt = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${clock()}`;
  const payName = { naqd: "Naqd", karta: "Karta", click: "Click/Payme" }[pay] || pay;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Chek</title><style>
    @page { size: ${width}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; width: ${width}mm; padding: 3mm ${width === 58 ? 2 : 4}mm 6mm; font: ${width === 58 ? 11 : 12.5}px/1.35 "Courier New", ui-monospace, monospace; color: #000; }
    .c { text-align: center; } h1 { font-size: 1.45em; margin: 0 0 2px; } .sm { font-size: .88em; }
    .logo { max-width: 26mm; max-height: 18mm; display: block; margin: 0 auto 4px; filter: grayscale(1); }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; } td { vertical-align: top; padding: 1px 0; } td.r { text-align: right; white-space: nowrap; padding-left: 6px; }
    .opt { font-size: .85em; } .tot td { font-weight: 700; font-size: 1.2em; padding-top: 3px; } .b { font-weight: 700; }
  </style></head><body>
    <div class="c">${r.logo ? `<img class="logo" src="${esc(r.logo)}">` : ""}<h1>${esc(r.name)}</h1>
      ${r.address ? `<div class="sm">${esc(r.address)}</div>` : ""}${r.phone ? `<div class="sm">${esc(r.phone)}</div>` : ""}</div>
    <hr>
    ${title ? `<div class="c b">${esc(title)}</div>` : ""}
    <table class="sm">
      <tr><td>Stol</td><td class="r">${esc(t.no)}</td></tr>
      <tr><td>Ofitsiant</td><td class="r">${esc(fullName(w) || "")}</td></tr>
      <tr><td>Chek</td><td class="r">${orders.map((o) => "#" + esc(shortNo(o))).join(", ")}</td></tr>
      <tr><td>Sana</td><td class="r">${dt}</td></tr>
    </table>
    <hr>
    <table>${lines.map((l) => `
      <tr><td colspan="2">${esc(l.name)}${l.opts ? `<div class="opt">  ${esc(l.opts)}</div>` : ""}</td></tr>
      <tr><td class="sm">  ${l.qty} x ${m(l.price)}</td><td class="r">${m(l.qty * l.price)}</td></tr>`).join("")}
    </table>
    <hr>
    <table>
      <tr><td>Jami</td><td class="r">${m(sub)}</td></tr>
      ${rate ? `<tr><td>Xizmat ${rate}%</td><td class="r">${m(service)}</td></tr>` : ""}
      <tr class="tot"><td>TO'LOV</td><td class="r">${m(total)}</td></tr>
      ${split > 1 ? `<tr><td>${split} kishiga</td><td class="r">${m(Math.ceil(total / split / 100) * 100)} dan</td></tr>` : ""}
      ${pay ? `<tr><td class="sm">To'lov turi</td><td class="r sm">${esc(payName)}</td></tr>` : ""}
    </table>
    <hr>
    <div class="c sm">${esc(r.receiptNote || "Rahmat! Yana kutib qolamiz")}</div>
    <div class="c sm" style="margin-top:4px">Smart Menyu</div>
  </body></html>`;
}

// Stol yopilgandan keyin chek shakllanadi: ko'rsatamiz, xohlasa chop etadi
function showReceipt(opts) {
  const native = window.Capacitor?.isNativePlatform?.();
  modal(`
    <div class="modal-head"><h3>🧾 ${L("Chek", "Чек", "Receipt")} · ${ST(esc(opts.t.no))}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body"><iframe class="receipt-preview" srcdoc="${esc(receiptHtml(opts))}"></iframe></div>
    <div class="modal-actions">
      ${native ? "" : `<button class="btn btn-ghost" data-act="print">🖨 ${L("Chop etish", "Печать", "Print")}</button>`}
      <button class="btn btn-primary btn-lg" data-close>${L("Tayyor", "Готово", "Done")}</button>
    </div>`, {
    onMount(m) { m.querySelector("[data-act=print]")?.addEventListener("click", () => printReceipt(opts)); }
  });
}

function printReceipt(opts) {
  const html = receiptHtml(opts);
  // Android ilovasi (APK) ichida brauzer chop etish oynasi yo'q: chekni ko'rsatamiz
  if (window.Capacitor?.isNativePlatform?.()) {
    modal(`
      <div class="modal-head"><h3>🧾 Chek</h3><button class="icon-btn" data-close>✕</button></div>
      <div class="modal-body"><iframe class="receipt-preview" srcdoc="${esc(html)}"></iframe>
        <p class="muted small">Termoprinterga to'g'ridan-to'g'ri chop etish ilovaning keyingi versiyasida (Bluetooth printer) qo'shiladi. Hozircha brauzerdagi versiyadan chop etish mumkin.</p></div>`);
    return;
  }
  const old = document.getElementById("printFrame");
  old?.remove();
  const f = document.createElement("iframe");
  f.id = "printFrame";
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(f);
  f.onload = () => {
    try { f.contentWindow.focus(); f.contentWindow.print(); }
    catch { toast("Chop etib bo'lmadi. Printer ulanganini tekshiring.", { kind: "error" }); }
  };
  f.srcdoc = html;
}

function showReadyList() {
  const list = myReady();
  modal(`
    <div class="modal-head"><h3>🔔 ${L("Tayyor buyurtmalar", "Готовые заказы", "Ready orders")}<span class="ready-sub">${L("Mijozga olib boring", "Отнесите гостю", "Take it to the guest")}</span></h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      ${list.length ? list.map((o) => `
        <div class="ready-item">
          <div><span class="check">✓</span><b>${ST(esc(o.tableNo))}</b> <small>#${esc(shortNo(o))} · ${o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join(", ")}</small></div>
          <button class="btn btn-ok" data-served="${esc(o.id)}" data-close>🍽 ${L("Stolga olib kelindi", "Подано на стол", "Served to table")}</button>
        </div>`).join("") : `<div class="empty"><span class="big">🍽️</span>${L("Hozircha tayyor buyurtma yo'q", "Пока нет готовых заказов", "No ready orders yet")}</div>`}
    </div>`, {
    onMount(m) { m.querySelectorAll("[data-served]").forEach((b) => b.addEventListener("click", () => markServed(b.dataset.served))); }
  });
}

function meMenu() {
  const me = meW();
  modal(`
    <div class="modal-head"><h3>${esc(fullName(me))}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <p class="muted">${L("Restoran", "Ресторан", "Restaurant")}: <b>${esc(cfg().restaurant.name)}</b></p>
      <p class="muted">${L("Siz xizmat qilayotgan stollar", "Ваши столы", "Your tables")}: <b>${cfg().tables.filter((t) => activeOrders(t.id).length && tableWaiterId(t) === me.id).map((t) => esc(t.no)).join(", ") || L("yo'q", "нет", "none")}</b></p>
      <button class="btn btn-ghost btn-block" data-act="history">📜 ${L("Xizmat tarixim", "История обслуживания", "Service history")}</button>
      <button class="btn btn-ghost btn-block" data-act="sound">🔊 ${L("Ovozni sinash", "Проверить звук", "Test sound")}</button>
    </div>
    <div class="modal-actions"><button class="btn btn-danger" data-act="logout">${L("Chiqish", "Выйти", "Log out")}</button></div>`, {
    onMount(m, close) {
      m.querySelector("[data-act=history]").addEventListener("click", () => { close(); openHistory(); });
      m.querySelector("[data-act=sound]").addEventListener("click", () => { unlockAudio(); chime("ready"); vibrate(); });
      m.querySelector("[data-act=logout]").addEventListener("click", () => { saveMe(null); close(); ui.view = "tables"; render(); });
    }
  });
}

function bindCommon() {
  app.querySelector("[data-act=show-ready]")?.addEventListener("click", showReadyList);
  app.querySelector("[data-act=me]")?.addEventListener("click", meMenu);
  app.querySelector(".tv-hist")?.addEventListener("click", openHistory);
  app.querySelectorAll(".ready-strip [data-served]").forEach((b) => b.addEventListener("click", () => markServed(b.dataset.served)));
}

// ---------- Realtime hodisalar ----------
store.on((evt) => {
  if (ui.guest) return guestEvent(evt);
  if (evt.type === "order" && !evt.local && evt.order.status === "ready" && evt.prev && evt.prev.status !== "ready") {
    const o = evt.order;
    const mine = o.waiterId === ui.me?.id;
    if (ui.me && mine) {
      chime("ready");
      vibrate([300, 120, 300, 120, 300]);
      toast(`<b>✓ ${ST(esc(o.tableNo))}</b> ${L("buyurtmasi tayyor! Oshxonadan olib chiqing.", "заказ готов! Заберите на кухне.", "order is ready! Pick it up from the kitchen.")}`, { kind: "ready", timeout: 9000, onClick: () => openTable(o.tableId) });
      flashTitle(`✓ ${ST(o.tableNo)} ${L("tayyor", "готов", "ready")}`);
    }
  }
  // oshpaz "Boshlash"ni bosdi — ofitsiantga xabar
  if (evt.type === "order" && !evt.local && evt.order.status === "cooking" && evt.prev && evt.prev.status === "new") {
    const o = evt.order;
    if (ui.me && (o.waiterId === ui.me.id || ui.filter === "all")) {
      vibrate([150]);
      toast(`<b>🍳 ${ST(esc(o.tableNo))}</b> ${L("buyurtmasi tayyorlanmoqda", "заказ готовится", "order is being cooked")}`, { kind: "ok", timeout: 6000, onClick: () => openTable(o.tableId) });
    }
  }
  if (evt.type === "config" || evt.type === "stop") ui.menuDirty = true;
  if (evt.type !== "render") return;
  const active = document.activeElement;
  const typing = active && (active.id === "q" || active.closest?.(".modal"));
  if (ui.view === "table" && app.querySelector("#grid")) {
    // Menyu ochiq: qidiruv maydonini buzmaslik uchun faqat kerakli qismlarni yangilaymiz
    const pill = app.querySelector("[data-act=show-ready] b");
    if (pill) { const n = myReady().length; pill.textContent = n; pill.parentElement.classList.toggle("on", !!n); }
    const conn = app.querySelector(".conn");
    if (conn) conn.outerHTML = connBadge(S.online);
    renderCart();
    if (ui.menuDirty) { ui.menuDirty = false; renderCats(); renderGrid(); }
    return;
  }
  if (!typing) render();
});

// Mijoz rejimida: faqat shu stolga oid yangilanishlar
function guestEvent(evt) {
  if (evt.type === "order" && !evt.local && evt.order.tableId === ui.guest && evt.order.status === "ready" && evt.prev?.status !== "ready") {
    chime("ready");
    toast(T("ready"), { kind: "ready", timeout: 7000 });
  }
  if (evt.type === "config" || evt.type === "stop") ui.menuDirty = true;
  if (evt.type !== "render") return;
  if (!tableById(ui.guest)) { saveGuest(null); return render(); }
  if (!app.querySelector("#grid")) return render();
  const acts = app.querySelector("#guestActs");
  if (acts && !acts.contains(document.activeElement)) { acts.innerHTML = guestActs(); bindGuestActs(); }
  renderCart();
  if (ui.menuDirty) { ui.menuDirty = false; renderCats(); renderGrid(); }
}

// Mijoz rejimida "orqaga" tugmasi menyudan chiqarmaydi
window.addEventListener("popstate", () => { if (ui.guest) history.pushState({ guest: 1 }, ""); });

let titleTimer = null;
function flashTitle(msg) {
  clearInterval(titleTimer);
  const orig = `${cfg().restaurant.name} · Ofitsiant`;
  let n = 0;
  titleTimer = setInterval(() => { document.title = n++ % 2 ? orig : msg; if (n > 12) { clearInterval(titleTimer); document.title = orig; } }, 800);
}

// Vaqt ko'rsatkichlarini yangilab turish
setInterval(() => { if (ui.view === "tables" && !document.querySelector(".modal-back")) render(); }, 30000);
document.addEventListener("pointerdown", unlockAudio, { once: true });

render();
registerSW();

