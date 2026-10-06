// Ofitsiant (menyu) planshet ilovasi
import { createStore, newId } from "./sync.js";
import {
  getRid, esc, money, fullName, initials, ago, clock, shortNo, orderTotal, applyBrand, logoHtml, itemVisual,
  unlockAudio, chime, vibrate, keepAwake, toast, modal, confirmBox, connBadge, registerSW, link
} from "./common.js";
import { LANGS, t as T, setLang, getLang, itemName, itemDesc, catName, catTagline, weightText, noteLabel, optName } from "./i18n.js";

const rid = getRid();
try { setLang(localStorage.getItem("menyu.lang") || "uz"); } catch { setLang("uz"); }
const store = createStore(rid);
const S = store.state;
const app = document.getElementById("app");

const QUICK_NOTES = ["Achchiq", "Achchiq emas", "Piyozsiz", "Ko'katsiz", "Tuzi kam", "Tezroq", "Bolalar uchun", "Olib ketish"];

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
  if (!os.length) return { key: "free", label: "Bo'sh", orders: os };
  if (os.some((o) => o.status === "ready")) return { key: "ready", label: "Tayyor ✓", orders: os };
  if (os.some((o) => o.status === "cooking")) return { key: "cooking", label: "Tayyorlanmoqda", orders: os };
  if (os.some((o) => o.status === "new")) return { key: "new", label: "Oshxonaga yuborildi", orders: os };
  return { key: "busy", label: "Band", orders: os };
}
function tableWaiterId(t) {
  return t.waiterId || ui.me?.id;
}
function readyForMe() {
  return Object.values(S.orders)
    .filter((o) => o.status === "ready" && (ui.filter === "all" || o.waiterId === ui.me?.id))
    .sort((a, b) => (a.readyAt || 0) - (b.readyAt || 0));
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
  ui.view = "tables";
  renderTables();
}

function topbar(extra = "") {
  const r = cfg().restaurant;
  if (ui.guest) return guestBar();
  const me = meW();
  const ready = readyForMe().length;
  return `
  <header class="topbar">
    <div class="brand">${logoHtml(r)}<div><b>${esc(r.name)}</b><small>${esc(r.slogan || "")}</small></div></div>
    ${extra}
    <div class="top-right">
      ${connBadge(S.online)}
      <button class="ready-pill ${ready ? "on" : ""}" data-act="show-ready" title="Tayyor buyurtmalar">🔔 <b>${ready}</b></button>
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

function guestActs() {
  const call = S.calls[ui.guest];
  const w = call?.type === "waiter", b = call?.type === "bill";
  return `
    <button class="g-btn ${w ? "sent" : ""}" data-call="waiter">${w ? T("waiterComing") : T("callWaiter")}</button>
    <button class="g-btn ${b ? "sent" : ""}" data-call="bill">${b ? T("billComing") : T("askBill")}</button>
    <button class="icon-btn g-lock" data-act="guest-exit" title="Ofitsiant uchun">🔒</button>`;
}

function bindGuestActs() {
  const box = app.querySelector("#guestActs");
  if (!box) return;
  box.querySelectorAll("[data-call]").forEach((b) => b.addEventListener("click", () => {
    unlockAudio();
    const type = b.dataset.call;
    const t = tableById(ui.guest);
    if (S.calls[t.id]?.type === type) { store.setCall(t.id, null); toast(T("callCancelled")); }
    else {
      store.setCall(t.id, { type, at: Date.now(), tableNo: t.no, waiterId: tableWaiterId(t) || "" });
      toast(type === "bill" ? T("billAsked") : T("called"), { kind: "ok" });
    }
    box.innerHTML = guestActs();
    bindGuestActs();
  }));
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
  const w = waiterById(tableWaiterId(t));
  const sum = cart.reduce((s, c) => s + c.price * c.qty, 0);
  modal(`
    <div class="modal-head"><h3>${T("confirmTitle")}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <ul class="confirm-list">
        ${cart.map((c) => `<li><span><b>${c.qty} ×</b> ${esc(cartName(c))}${optsHtml(c)}${c.note ? `<small>📝 ${esc(noteText(c.note))}</small>` : ""}</span><span>${money(c.price * c.qty, cur())}</span></li>`).join("")}
      </ul>
      <label class="field"><span>${T("wishes")}</span><input type="text" id="comment" placeholder="${esc(T("wishesPh"))}"></label>
      <div class="sum-row big"><span>${T("total")}</span><b>${money(sum, cur())}</b></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>${T("moreChoose")}</button>
      <button class="btn btn-primary btn-lg" id="send">${T("send")}</button>
    </div>`, {
    onMount(m, close) {
      m.querySelector("#send").addEventListener("click", () => {
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
          comment: m.querySelector("#comment").value.trim(),
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
      <h2>Ofitsiant, ismingizni tanlang</h2>
      <div class="waiter-grid">
        ${cfg().waiters.map((w) => `
          <button class="waiter-card" data-w="${esc(w.id)}">
            <span class="avatar avatar-lg">${esc(initials(w))}</span>
            <b>${esc(w.first)}</b><small>${esc(w.last)}</small>
          </button>`).join("") || `<p class="empty">Admin panelda ofitsiantlarni qo'shing.</p>`}
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
  const tables = cfg().tables.filter((t) => ui.filter === "all" || tableWaiterId(t) === ui.me.id);
  const zones = [...new Set(tables.map((t) => t.zone || "Zal"))];
  const ready = readyForMe();
  const calls = callsForMe();
  const counts = { free: 0, busy: 0, ready: 0 };
  tables.forEach((t) => { const k = tableState(t.id).key; if (k === "free") counts.free++; else if (k === "ready") counts.ready++; else counts.busy++; });

  app.innerHTML = `
  ${topbar()}
  <main class="tables-view">
    ${ready.length ? `
      <section class="ready-strip">
        ${ready.map((o) => `
          <div class="ready-item">
            <div><span class="check">✓</span><b>Stol ${esc(o.tableNo)}</b> buyurtmasi tayyor <small>#${esc(shortNo(o))} · ${ago(o.readyAt)} oldin · ${esc(o.waiterName)}</small></div>
            <button class="btn btn-ok" data-served="${esc(o.id)}">Olib chiqdim</button>
          </div>`).join("")}
      </section>` : ""}
    ${calls.length ? `
      <section class="call-strip">
        ${calls.map((c) => `
          <div class="call-item ${c.type}">
            <div><b>Stol ${esc(c.tableNo)}</b> ${callText(c)} <small>${ago(c.at)} oldin</small></div>
            <button class="btn btn-primary" data-callok="${esc(c.tableId)}">Bordim ✓</button>
          </div>`).join("")}
      </section>` : ""}
    <div class="tables-head">
      <div class="seg">
        <button class="${ui.filter === "mine" ? "on" : ""}" data-filter="mine">Mening stollarim</button>
        <button class="${ui.filter === "all" ? "on" : ""}" data-filter="all">Barcha stollar</button>
      </div>
      <div class="legend">
        <span><i class="dot free"></i>Bo'sh ${counts.free}</span>
        <span><i class="dot busy"></i>Band ${counts.busy}</span>
        <span><i class="dot ready"></i>Tayyor ${counts.ready}</span>
      </div>
    </div>
    ${zones.map((z) => `
      <h3 class="zone">${esc(z)}</h3>
      <div class="table-grid">
        ${tables.filter((t) => (t.zone || "Zal") === z).map(tableCard).join("")}
      </div>`).join("") || `<div class="empty"><span class="big">🪑</span>Sizga biriktirilgan stol yo'q. "Barcha stollar"ni bosing.</div>`}
  </main>`;

  bindCommon();
  app.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { ui.filter = b.dataset.filter; render(); }));
  app.querySelectorAll("[data-table]").forEach((b) => b.addEventListener("click", () => openTable(b.dataset.table)));
  app.querySelectorAll("[data-callok]").forEach((b) => b.addEventListener("click", () => { store.setCall(b.dataset.callok, null); render(); }));
}

function tableCard(t) {
  const st = tableState(t.id);
  const w = waiterById(tableWaiterId(t));
  const total = st.orders.reduce((s, o) => s + orderTotal(o), 0);
  const since = st.orders[0]?.createdAt;
  const draft = getCart(t.id).reduce((s, c) => s + c.qty, 0);
  return `
  <button class="table-card st-${st.key}" data-table="${esc(t.id)}">
    <div class="tc-top"><span class="tc-no">${esc(t.no)}</span><span class="tc-seats">👤 ${esc(t.seats || "")}</span></div>
    <div class="tc-status">${st.label}</div>
    ${st.key !== "free" ? `<div class="tc-meta"><b>${money(total, cur())}</b><span>${since ? ago(since) : ""}</span></div>` : `<div class="tc-meta"><span>&nbsp;</span></div>`}
    <div class="tc-waiter">${esc(fullName(w) || "—")}</div>
    ${S.calls[t.id] ? `<span class="tc-call">${S.calls[t.id].type === "bill" ? "🧾 Hisob" : "🙋 Chaqiryapti"}</span>` : ""}
    ${draft ? `<span class="tc-draft">${draft} ta savatda</span>` : ""}
  </button>`;
}

function openTable(tid) {
  ui.view = "table";
  ui.tableId = tid;
  ui.cat = "all";
  ui.q = "";
  ui.cartOpen = false;
  render();
  window.scrollTo(0, 0);
}

// ---------- Stol: menyu + savat ----------
function renderTable() {
  const t = tableById(ui.tableId);
  const w = waiterById(tableWaiterId(t));
  app.innerHTML = `
  ${topbar()}
  <div class="table-view">
    <div class="mood" id="mood"><i></i><i></i></div>
    <section class="menu-pane" id="menuPane">
      <div class="menu-top">
      <div class="menu-head">
        ${ui.guest ? "" : `<button class="icon-btn" data-act="back" title="Orqaga">←</button>`}
        <div class="mh-title">${ui.guest
          ? `<h2>${T("menu")}</h2><small>${T("yourWaiter")}: <b>${esc(fullName(w) || "—")}</b></small>`
          : `<h2>Stol ${esc(t.no)}</h2><small>${esc(t.zone || "")} · Ofitsiant: <b>${esc(fullName(w) || "—")}</b></small>`}</div>
        ${ui.guest ? "" : `<button class="btn btn-ghost guest-start" data-act="guest" title="Planshetni mijozga berish">📱 Mijozga berish</button>`}
        <div class="langs" id="langs">${LANGS.map((l) => `<button class="${getLang() === l.id ? "on" : ""}" data-lang="${l.id}" title="${l.label}">${l.short}</button>`).join("")}</div>
        <div class="search"><input type="search" id="q" placeholder="${esc(T("search"))}" value="${esc(ui.q)}"></div>
      </div>
      <nav class="cats" id="cats"></nav>
      </div>
      <div id="grid"></div>
    </section>
    <aside class="cart-pane ${ui.cartOpen ? "open" : ""}" id="cartPane"></aside>
    <button class="cart-fab" id="cartFab"></button>
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
    if (pane && pane.scrollHeight > pane.clientHeight) pane.scrollTo({ top: 0 }); else window.scrollTo({ top: 0 });
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
    : `<div class="dish-img emoji"><span>${esc(i.emoji || "🍽️")}</span>`;
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
        ${stop ? "" : `<button class="dish-add" data-add="${esc(i.id)}" aria-label="Qo'shish">+</button>`}
      </div>
    </div>
  </article>`;
}

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
      ${heroHtml(c, list.length)}
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
  const notes = new Set();
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
      <div class="label">${T("noteForChef")}</div>
      <div class="chips">${QUICK_NOTES.map((n) => `<button class="chip" data-n="${esc(n)}">${esc(noteLabel(n))}</button>`).join("")}</div>
      <input type="text" id="note" placeholder="${esc(T("otherNote"))}">
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
      m.querySelectorAll("[data-n]").forEach((b) => b.addEventListener("click", () => {
        const n = b.dataset.n; notes.has(n) ? notes.delete(n) : notes.add(n); b.classList.toggle("on");
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
        const note = [...notes, m.querySelector("#note").value.trim()].filter(Boolean).join(", ");
        addToCart(ui.tableId, item, qty, note, sel());
        close(); refreshCard(item.id, true); renderCart();
      });
    }
  });
}

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
      <h3>${ui.guest ? T("cart") : "Yangi buyurtma"} <small>${ui.guest ? T("table") : "Stol"} ${esc(t.no)}</small></h3>
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
      </ul>` : `<div class="empty small"><span class="big">🧺</span>${ui.guest ? T("emptyCart") : "Menyudan taom tanlang"}</div>`}

      ${orders.length ? `
        <div class="tickets">
          <h4>${ui.guest ? T("yourOrders") : "Stol cheklari"}</h4>
          ${orders.map((o) => `
            <div class="ticket">
              <div class="tk-head"><b>#${esc(shortNo(o))}</b><span class="badge b-${o.status}">${ui.guest ? T("st_" + o.status) : statusLabel(o.status)}</span><small>${clock(o.createdAt)}</small></div>
              <ul>${o.items.map((it) => `<li class="${it.done ? "done" : ""}"><span>${it.qty} × ${esc(ui.guest ? cartName(it) : it.name)}${it.opts ? ` <i class="tk-opts">(${esc(optsText(it))})</i>` : ""}</span><span>${money(it.qty * it.price, cur())}</span></li>`).join("")}</ul>
              ${ui.guest ? "" : o.status === "ready" ? `<button class="btn btn-ok btn-block" data-served="${esc(o.id)}">✓ Olib chiqdim</button>` : ""}
              ${!ui.guest && o.status === "new" ? `<button class="link-btn" data-cancel="${esc(o.id)}">Bekor qilish</button>` : ""}
            </div>`).join("")}
        </div>` : ""}
    </div>
    <div class="cart-foot">
      ${cart.length ? `
        <div class="sum-row"><span>${ui.guest ? T("newOrder") : "Yangi buyurtma"}</span><b>${money(cartSum, cur())}</b></div>
        <button class="btn btn-primary btn-lg btn-block" data-act="confirm">${ui.guest ? T("placeOrder") : "Buyurtmani tasdiqlash →"}</button>` : ""}
      ${orders.length ? `
        <div class="sum-row muted"><span>${ui.guest ? T("tableBill") : "Stol hisobi"}</span><b>${money(billSum, cur())}</b></div>
        ${ui.guest ? "" : `<button class="btn btn-ghost btn-block" data-act="bill">🧾 Hisob va stolni yopish</button>`}` : ""}
    </div>`;

  fab.innerHTML = ui.guest
    ? (cartCount ? `🧺 <b>${cartCount} ${T("pcs")}</b> · ${money(cartSum, cur())} <span>${T("view")}</span>` : orders.length ? `🧾 ${T("tableBill")} · ${money(billSum, cur())} <span>${T("view")}</span>` : "")
    : (cartCount ? `🧺 <b>${cartCount} ta</b> · ${money(cartSum, cur())} <span>Ko'rish →</span>` : orders.length ? `🧾 Stol hisobi · ${money(billSum, cur())} <span>Ko'rish →</span>` : "");
  fab.hidden = !cartCount && !orders.length;

  pane.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
    const list = getCart(t.id);
    const c = list.find((x) => x.key === b.dataset.q);
    c.qty += Number(b.dataset.d);
    setCart(t.id, list.filter((x) => x.qty > 0));
    renderCart(); refreshCard(c.itemId);
  }));
  pane.querySelector("[data-act=close-cart]").addEventListener("click", () => { ui.cartOpen = false; pane.classList.remove("open"); });
  pane.querySelector("[data-act=confirm]")?.addEventListener("click", () => (ui.guest ? guestConfirm(t) : confirmOrder(t)));
  pane.querySelector("[data-act=bill]")?.addEventListener("click", () => billModal(t));
  pane.querySelectorAll("[data-served]").forEach((b) => b.addEventListener("click", () => markServed(b.dataset.served)));
  pane.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", async () => {
    const o = S.orders[b.dataset.cancel];
    if (o?.status !== "new") { toast("Oshpaz allaqachon boshlagan, bekor qilib bo'lmaydi", { kind: "error" }); return; }
    if (await confirmBox(`#${esc(shortNo(o))} buyurtmani bekor qilasizmi?`, "Bekor qilish", { danger: true })) store.removeOrder(o.id);
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
  return { new: "Yangi", cooking: "Tayyorlanmoqda", ready: "Tayyor ✓", served: "Berildi", closed: "Yopilgan" }[s] || s;
}

function nextNo() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = Object.values(S.orders).filter((o) => o.createdAt >= start.getTime());
  return Math.max(0, ...today.map((o) => Number(o.no) || 0)) + 1;
}

function confirmOrder(t) {
  const cart = getCart(t.id);
  if (!cart.length) return;
  const w = waiterById(tableWaiterId(t));
  const sum = cart.reduce((s, c) => s + c.price * c.qty, 0);
  let guests = activeOrders(t.id)[0]?.guests || Math.min(t.seats || 2, 2);
  modal(`
    <div class="modal-head"><h3>Buyurtmani tasdiqlang</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <div class="confirm-meta">
        <div><small>Stol</small><b>${esc(t.no)}</b></div>
        <div><small>Ofitsiant</small><b>${esc(fullName(w))}</b></div>
        <div><small>Mehmonlar</small><div class="stepper sm"><button data-g="-1">−</button><b id="guests">${guests}</b><button data-g="1">+</button></div></div>
      </div>
      <ul class="confirm-list">
        ${cart.map((c) => `<li><span><b>${c.qty} ×</b> ${esc(c.name)}${optsHtml(c)}${c.note ? `<small>📝 ${esc(c.note)}</small>` : ""}</span><span>${money(c.price * c.qty, cur())}</span></li>`).join("")}
      </ul>
      <label class="field"><span>Oshxona uchun umumiy izoh</span><input type="text" id="comment" placeholder="Masalan: avval salatlarni bering"></label>
      <div class="sum-row big"><span>Jami</span><b>${money(sum, cur())}</b></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-close>Tahrirlash</button>
      <button class="btn btn-primary btn-lg" id="send">🍳 Oshxonaga yuborish</button>
    </div>`, {
    onMount(m, close) {
      m.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", () => {
        guests = Math.max(1, guests + Number(b.dataset.g)); m.querySelector("#guests").textContent = guests;
      }));
      m.querySelector("#send").addEventListener("click", () => {
        const me = meW();
        const order = {
          id: newId(),
          no: nextNo(),
          tableId: t.id,
          tableNo: t.no,
          zone: t.zone || "",
          waiterId: w?.id || me.id,
          waiterName: fullName(w || me),
          sentBy: fullName(me),
          guests,
          comment: m.querySelector("#comment").value.trim(),
          items: cart.map(orderLine),
          status: "new",
          createdAt: Date.now()
        };
        store.putOrder(order);
        setCart(t.id, []);
        close();
        ui.cartOpen = false;
        toast(`✓ Stol ${esc(t.no)} buyurtmasi oshxonaga yuborildi`, { kind: "ok" });
        if (!S.online) toast("Aloqa yo'q: buyurtma aloqa tiklanishi bilan yuboriladi", { kind: "error", timeout: 6000 });
        ui.view = "tables";
        render();
      });
    }
  });
}

function markServed(id) {
  const o = S.orders[id];
  if (!o) return;
  store.updateOrder(id, { status: "served", servedAt: Date.now() });
  toast(`Stol ${esc(o.tableNo)}: taom mijozga berildi`, { kind: "ok" });
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
  const guests = orders[0]?.guests || 2;
  // Hisobni bo'lish: "none" | "equal" | "items"
  const split = { mode: "none", n: Math.max(2, guests), pick: {} };
  const pickSum = () => lines.reduce((s, l) => s + (split.pick[l.k] || 0) * l.price, 0);
  const withService = (x) => x + Math.round(x * rate / 100);

  const splitHtml = () => {
    if (split.mode === "equal") return `
      <div class="split-box">
        <div class="split-row"><span>Necha kishiga bo'linadi?</span><div class="stepper sm"><button data-n="-1">−</button><b>${split.n}</b><button data-n="1">+</button></div></div>
        <div class="split-each"><small>Har bir kishi to'laydi</small><b>${money(Math.ceil(total / split.n / 100) * 100, cur())}</b></div>
      </div>`;
    if (split.mode === "items") {
      const ps = pickSum();
      return `
      <div class="split-box">
        <p class="muted small">Bir mehmon to'laydigan taomlarni belgilang:</p>
        <ul class="pick-list">${lines.map((l) => `
          <li class="${split.pick[l.k] ? "on" : ""}">
            <span>${esc(l.name)}${l.opts ? ` <small>(${esc(l.opts)})</small>` : ""}<small>${money(l.price, cur())}</small></span>
            <div class="stepper sm"><button data-pk="${esc(l.k)}" data-d="-1">−</button><b>${split.pick[l.k] || 0}/${l.qty}</b><button data-pk="${esc(l.k)}" data-d="1">+</button></div>
          </li>`).join("")}</ul>
        <div class="split-each"><small>Shu mehmon to'laydi${rate ? ` (xizmat ${rate}% bilan)` : ""}</small><b>${money(withService(ps), cur())}</b></div>
        <button class="btn btn-ghost btn-block" data-act="print-part" ${ps ? "" : "disabled"}>🖨 Shu qism uchun chek</button>
      </div>`;
    }
    return "";
  };

  modal(`
    <div class="modal-head"><h3>Hisob · Stol ${esc(t.no)}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <div class="bill">
        <div class="bill-brand">${logoHtml(cfg().restaurant)}<b>${esc(cfg().restaurant.name)}</b></div>
        <ul>${lines.map((l) => `<li><span>${l.qty} × ${esc(l.name)}${l.opts ? ` <small>(${esc(l.opts)})</small>` : ""}</span><span>${money(l.qty * l.price, cur())}</span></li>`).join("")}</ul>
        <div class="sum-row"><span>Jami taomlar</span><b>${money(sub, cur())}</b></div>
        ${rate ? `<div class="sum-row"><span>Xizmat haqi ${rate}%</span><b>${money(service, cur())}</b></div>` : ""}
        <div class="sum-row big"><span>To'lov uchun</span><b>${money(total, cur())}</b></div>
        <p class="muted small">Ofitsiant: ${esc(fullName(w))} · ${clock()}</p>
      </div>
      ${notServed ? `<p class="warn-note">⚠️ ${notServed} ta chek hali mijozga berilmagan.</p>` : ""}
      <div class="label">Hisobni bo'lish</div>
      <div class="seg split-seg" id="splitSeg">
        <button class="on" data-sm="none">Bitta hisob</button><button data-sm="equal">Teng bo'lish</button><button data-sm="items">Taomlar bo'yicha</button>
      </div>
      <div id="splitBox"></div>
      <div class="label">To'lov turi</div>
      <div class="seg pay" id="pay">
        <button class="on" data-p="naqd">💵 Naqd</button><button data-p="karta">💳 Karta</button><button data-p="click">📱 Click/Payme</button>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-act="print">🖨 Chek</button>
      <button class="btn btn-ok btn-lg" id="close">✓ To'landi, stolni yopish</button>
    </div>`, {
    onMount(m, close) {
      let pay = "naqd";
      const drawSplit = () => {
        const box = m.querySelector("#splitBox");
        box.innerHTML = splitHtml();
        box.querySelectorAll("[data-n]").forEach((b) => b.addEventListener("click", () => { split.n = Math.min(30, Math.max(2, split.n + Number(b.dataset.n))); drawSplit(); }));
        box.querySelectorAll("[data-pk]").forEach((b) => b.addEventListener("click", () => {
          const l = lines.find((x) => x.k === b.dataset.pk);
          split.pick[l.k] = Math.min(l.qty, Math.max(0, (split.pick[l.k] || 0) + Number(b.dataset.d)));
          drawSplit();
        }));
        box.querySelector("[data-act=print-part]")?.addEventListener("click", () => {
          const part = lines.filter((l) => split.pick[l.k]).map((l) => ({ ...l, qty: split.pick[l.k] }));
          printReceipt({ t, w, orders, lines: part, pay, title: "Qisman hisob" });
        });
      };
      m.querySelectorAll("[data-sm]").forEach((b) => b.addEventListener("click", () => {
        split.mode = b.dataset.sm; m.querySelectorAll("[data-sm]").forEach((x) => x.classList.toggle("on", x === b)); drawSplit();
      }));
      m.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => {
        pay = b.dataset.p; m.querySelectorAll("[data-p]").forEach((x) => x.classList.toggle("on", x === b));
      }));
      m.querySelector("[data-act=print]").addEventListener("click", () => printReceipt({ t, w, orders, lines, pay, split: split.mode === "equal" ? split.n : 0 }));
      m.querySelector("#close").addEventListener("click", () => {
        const now = Date.now();
        orders.forEach((o) => store.updateOrder(o.id, { status: "closed", closedAt: now, servedAt: o.servedAt || now, serviceRate: rate, pay, closedBy: fullName(meW()), split: split.mode === "equal" ? split.n : undefined }));
        if (S.calls[t.id]) store.setCall(t.id, null);
        close();
        toast(`Stol ${esc(t.no)} yopildi · ${money(total, cur())}`, { kind: "ok" });
        ui.view = "tables";
        render();
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
      <tr><td class="sm">To'lov turi</td><td class="r sm">${esc(payName)}</td></tr>
    </table>
    <hr>
    <div class="c sm">${esc(r.receiptNote || "Rahmat! Yana kutib qolamiz")}</div>
    <div class="c sm" style="margin-top:4px">Smart Menyu</div>
  </body></html>`;
}

function printReceipt(opts) {
  const html = receiptHtml(opts);
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
  const list = readyForMe();
  modal(`
    <div class="modal-head"><h3>🔔 Tayyor buyurtmalar</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      ${list.length ? list.map((o) => `
        <div class="ready-item">
          <div><span class="check">✓</span><b>Stol ${esc(o.tableNo)}</b> <small>#${esc(shortNo(o))} · ${o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join(", ")}</small></div>
          <button class="btn btn-ok" data-served="${esc(o.id)}" data-close>Olib chiqdim</button>
        </div>`).join("") : `<div class="empty"><span class="big">🍽️</span>Hozircha tayyor buyurtma yo'q</div>`}
    </div>`, {
    onMount(m) { m.querySelectorAll("[data-served]").forEach((b) => b.addEventListener("click", () => markServed(b.dataset.served))); }
  });
}

function meMenu() {
  const me = meW();
  modal(`
    <div class="modal-head"><h3>${esc(fullName(me))}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <p class="muted">Restoran: <b>${esc(cfg().restaurant.name)}</b></p>
      <p class="muted">Sizga biriktirilgan stollar: <b>${cfg().tables.filter((t) => t.waiterId === me.id).map((t) => esc(t.no)).join(", ") || "yo'q"}</b></p>
      <button class="btn btn-ghost btn-block" data-act="sound">🔊 Ovozni sinash</button>
    </div>
    <div class="modal-actions"><button class="btn btn-danger" data-act="logout">Chiqish</button></div>`, {
    onMount(m, close) {
      m.querySelector("[data-act=sound]").addEventListener("click", () => { unlockAudio(); chime("ready"); vibrate(); });
      m.querySelector("[data-act=logout]").addEventListener("click", () => { saveMe(null); close(); ui.view = "tables"; render(); });
    }
  });
}

function bindCommon() {
  app.querySelector("[data-act=show-ready]")?.addEventListener("click", showReadyList);
  app.querySelector("[data-act=me]")?.addEventListener("click", meMenu);
  app.querySelectorAll(".ready-strip [data-served]").forEach((b) => b.addEventListener("click", () => markServed(b.dataset.served)));
}

// ---------- Realtime hodisalar ----------
store.on((evt) => {
  if (ui.guest) return guestEvent(evt);
  if (evt.type === "call" && !evt.local && evt.call && (!evt.prev || evt.prev.type !== evt.call.type || evt.prev.at !== evt.call.at)) {
    const c = evt.call;
    const t = tableById(evt.tableId);
    if (ui.me && t && (tableWaiterId(t) === ui.me.id || ui.filter === "all")) {
      chime("ready");
      vibrate([200, 100, 200]);
      toast(`<b>Stol ${esc(c.tableNo)}</b> ${callText(c)}`, { kind: "ready", timeout: 9000, onClick: () => openTable(evt.tableId) });
      flashTitle(`Stol ${c.tableNo}: ${c.type === "bill" ? "hisob" : "chaqiruv"}`);
    }
  }
  if (evt.type === "order" && !evt.local && evt.order.status === "ready" && evt.prev && evt.prev.status !== "ready") {
    const o = evt.order;
    const mine = o.waiterId === ui.me?.id;
    if (ui.me && (mine || ui.filter === "all")) {
      chime("ready");
      vibrate([300, 120, 300, 120, 300]);
      toast(`<b>✓ Stol ${esc(o.tableNo)}</b> buyurtmasi tayyor! Oshxonadan olib chiqing.`, { kind: "ready", timeout: 9000, onClick: () => openTable(o.tableId) });
      flashTitle(`✓ Stol ${o.tableNo} tayyor`);
    }
  }
  if (evt.type === "config" || evt.type === "stop") ui.menuDirty = true;
  if (evt.type !== "render") return;
  const active = document.activeElement;
  const typing = active && (active.id === "q" || active.closest?.(".modal"));
  if (ui.view === "table" && app.querySelector("#grid")) {
    // Menyu ochiq: qidiruv maydonini buzmaslik uchun faqat kerakli qismlarni yangilaymiz
    const pill = app.querySelector("[data-act=show-ready] b");
    if (pill) { const n = readyForMe().length; pill.textContent = n; pill.parentElement.classList.toggle("on", !!n); }
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
