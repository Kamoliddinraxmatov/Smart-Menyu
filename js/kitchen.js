// Oshxona ekrani (KDS): buyurtmalar realtime tushadi, oshpaz "Boshlash" va "Tayyor" tugmalarini bosadi
import { createStore } from "./sync.js";
import {
  getRid, esc, fullName, clock, shortNo, applyBrand, logoHtml,
  unlockAudio, chime, keepAwake, toast, modal, connBadge, registerSW, link
} from "./common.js";

const rid = getRid();
const store = createStore(rid);
const S = store.state;
const app = document.getElementById("app");

const WARN_MIN = 10;   // shu daqiqadan keyin sariq
const LATE_MIN = 20;   // shu daqiqadan keyin qizil

const ui = {
  started: sessionStorage.getItem("menyu.kds.started") === "1",
  tab: "active",       // active | ready
  allDay: localStorage.getItem("menyu.kds.allday") !== "0",
  sound: localStorage.getItem("menyu.kds.sound") !== "0",
  fresh: new Set()
};

const cfg = () => S.config;

function active() {
  return Object.values(S.orders).filter((o) => o.status === "new" || o.status === "cooking").sort((a, b) => a.createdAt - b.createdAt);
}
function readyList() {
  const since = Date.now() - 12 * 3600 * 1000;
  return Object.values(S.orders).filter((o) => ["ready", "served", "closed"].includes(o.status) && (o.readyAt || 0) > since).sort((a, b) => (b.readyAt || 0) - (a.readyAt || 0));
}

function mmss(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function late(o) {
  const m = (Date.now() - o.createdAt) / 60000;
  return m >= LATE_MIN ? "late" : m >= WARN_MIN ? "warn" : "";
}

function render() {
  applyBrand(cfg().restaurant);
  document.title = `${cfg().restaurant.name} · Oshxona`;
  if (!ui.started) return renderStart();
  const list = active();
  const nNew = list.filter((o) => o.status === "new").length;
  const nCook = list.filter((o) => o.status === "cooking").length;
  const stopCount = Object.keys(S.stop).length;

  app.innerHTML = `
  <header class="kbar">
    <div class="kbrand">${logoHtml(cfg().restaurant)}<div><b>${esc(cfg().restaurant.name)}</b><small>Oshxona ekrani</small></div></div>
    <div class="kstats">
      <span class="ks ks-new"><b>${nNew}</b>Yangi</span>
      <span class="ks ks-cook"><b>${nCook}</b>Tayyorlanmoqda</span>
    </div>
    <div class="ktabs">
      <button class="${ui.tab === "active" ? "on" : ""}" data-tab="active">Faol buyurtmalar</button>
      <button class="${ui.tab === "ready" ? "on" : ""}" data-tab="ready">Tayyorlar</button>
    </div>
    <div class="kright">
      ${connBadge(S.online)}
      <button class="kbtn" data-act="stop">⛔ Stop-list${stopCount ? ` <i>${stopCount}</i>` : ""}</button>
      <button class="kbtn ${ui.allDay ? "on" : ""}" data-act="allday" title="Umumiy hisob">Σ</button>
      <button class="kbtn" data-act="sound" title="Ovoz">${ui.sound ? "🔔" : "🔕"}</button>
      <button class="kbtn" data-act="fs" title="To'liq ekran">⛶</button>
      <span class="kclock" id="kclock">${clock()}</span>
    </div>
  </header>
  <div class="kmain ${ui.allDay && ui.tab === "active" ? "with-side" : ""}">
    <section class="kboard" id="board">${ui.tab === "active" ? boardActive(list) : boardReady()}</section>
    ${ui.allDay && ui.tab === "active" ? `<aside class="allday">${allDay(list)}</aside>` : ""}
  </div>`;

  app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { ui.tab = b.dataset.tab; render(); }));
  app.querySelector("[data-act=stop]").addEventListener("click", stopList);
  app.querySelector("[data-act=allday]").addEventListener("click", () => { ui.allDay = !ui.allDay; localStorage.setItem("menyu.kds.allday", ui.allDay ? "1" : "0"); render(); });
  app.querySelector("[data-act=sound]").addEventListener("click", () => { ui.sound = !ui.sound; localStorage.setItem("menyu.kds.sound", ui.sound ? "1" : "0"); if (ui.sound) chime("new"); render(); });
  app.querySelector("[data-act=fs]").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  bindBoard();
}

function renderStart() {
  const r = cfg().restaurant;
  app.innerHTML = `
  <div class="kstart" style="--kbg:url('${esc(absUrl(cfg().categories.find((c) => c.hero)?.hero || ""))}')">
    ${logoHtml(r, "logo logo-xl")}
    <h1>${esc(r.name)}</h1>
    <p>Oshxona ekrani</p>
    <button class="btn btn-primary btn-lg" id="go">▶ Ishni boshlash</button>
    <small>Yangi buyurtmalarda ovozli signal chalinadi. ${connBadge(S.online)}</small>
    <a href="${link("index.html", rid)}">Bosh sahifa</a>
  </div>`;
  app.querySelector("#go").addEventListener("click", () => {
    unlockAudio();
    keepAwake();
    ui.started = true;
    sessionStorage.setItem("menyu.kds.started", "1");
    render();
  });
}

function boardActive(list) {
  if (!list.length) return `<div class="kempty"><span>👨‍🍳</span><h2>Hozircha buyurtma yo'q</h2><p>Ofitsiant buyurtmani tasdiqlashi bilan shu yerda paydo bo'ladi.</p></div>`;
  return list.map(ticket).join("");
}

function ticket(o) {
  const done = o.items.filter((i) => i.done).length;
  return `
  <article class="kt st-${o.status} ${late(o)} ${ui.fresh.has(o.id) ? "fresh" : ""}" data-id="${esc(o.id)}">
    <header class="kt-head">
      <div class="kt-table"><small>STOL</small><b>${esc(o.tableNo)}</b>${o.extra ? `<em class="kt-extra">+ qo'shimcha</em>` : ""}</div>
      <div class="kt-info">
        ${o.status === "new" ? `<span class="kt-flag">YANGI</span>` : ""}
        <span class="kt-no">#${esc(shortNo(o))} · ${clock(o.createdAt)}${o.guests ? ` · 👤${o.guests}` : ""}</span>
        <span class="kt-waiter">🧑‍💼 ${esc(o.waiterName || "")}${o.byGuest ? " · 📱 Mijoz o'zi" : ""}</span>
      </div>
      <div class="kt-timer" data-timer="${o.createdAt}">${mmss(Date.now() - o.createdAt)}</div>
    </header>
    <ul class="kt-items">
      ${o.items.map((it, idx) => `
        <li class="${it.done ? "done" : ""}" data-item="${idx}">
          <span class="kt-qty">${it.qty}</span>
          ${thumb(it)}
          <span class="kt-name">${esc(it.name)}<em class="kt-opts">${esc(portionText(it.opts))}</em>${it.note ? `<em>📝 ${esc(it.note)}</em>` : ""}</span>
        </li>`).join("")}
    </ul>
    ${o.comment ? `<div class="kt-comment">💬 ${esc(o.comment)}</div>` : ""}
    <footer class="kt-foot">
      ${o.status === "new"
        ? `<button class="btn btn-warn btn-lg btn-block" data-start>▶ Boshlash</button>`
        : `<button class="btn btn-ok btn-lg btn-block" data-ready>✓ TAYYOR ${done ? `<small>${done}/${o.items.length}</small>` : ""}</button>`}
    </footer>
  </article>`;
}

const absUrl = (u) => (u && !/^(data:|https?:)/.test(u) ? new URL(u, location.href).href : u || "");
function thumb(it) {
  const item = cfg().items.find((i) => i.id === it.itemId);
  const img = item?.img;
  return img ? `<span class="kt-img ${item.fit === "contain" ? "contain" : ""}" style="background-image:url('${esc(absUrl(img))}')"></span>` : `<span class="kt-img">${esc(it.emoji || item?.emoji || "🍽️")}</span>`;
}

function boardReady() {
  const list = readyList();
  if (!list.length) return `<div class="kempty"><span>✅</span><h2>Tayyor buyurtmalar shu yerda ko'rinadi</h2></div>`;
  return `<div class="kready">${list.map((o) => `
    <div class="kr-row">
      <div class="kr-table">Stol <b>${esc(o.tableNo)}</b></div>
      <div class="kr-items">${o.items.map((i) => `${i.qty}× ${esc(i.name)}${i.opts ? ` (${esc(i.opts)})` : ""}`).join(", ")}<small>#${esc(shortNo(o))} · ${esc(o.waiterName || "")} · tayyorlash ${mmss((o.readyAt || 0) - (o.startedAt || o.createdAt))}</small></div>
      <span class="badge ${o.status === "ready" ? "b-ready" : "b-served"}">${o.status === "ready" ? "Ofitsiant kutilmoqda" : "Olib chiqildi"}</span>
      <div class="kr-time">${clock(o.readyAt)}</div>
      ${o.status === "ready" ? `<button class="btn btn-ghost" data-recall="${esc(o.id)}">↺ Qaytarish</button>` : ""}
    </div>`).join("")}</div>`;
}

function allDay(list) {
  const agg = {};
  const imgs = {};
  list.forEach((o) => o.items.forEach((it) => {
    if (it.done) return;
    const k = it.name + (it.opts ? ` (${it.opts})` : "");
    agg[k] = (agg[k] || 0) + it.qty;
    imgs[k] = imgs[k] || it;
  }));
  const rows = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  return `
    <h3>Σ Umumiy</h3>
    <p>Hamma faol cheklardagi tayyorlanishi kerak bo'lgan taomlar</p>
    ${rows.length ? `<ul>${rows.map(([n, q]) => `<li><b>${q}</b>${thumb(imgs[n])}<span>${esc(n)}</span></li>`).join("")}</ul>` : `<p class="muted">Bo'sh</p>`}`;
}

function bindBoard() {
  const board = app.querySelector("#board");
  board.querySelectorAll(".kt").forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll("[data-item]").forEach((li) => li.addEventListener("click", () => {
      const idx = Number(li.dataset.item);
      store.updateOrder(id, (o) => {
        o.items[idx].done = !o.items[idx].done;
        if (o.status === "new") { o.status = "cooking"; o.startedAt = Date.now(); }
        return o;
      });
    }));
    card.querySelector("[data-start]")?.addEventListener("click", () => {
      ui.fresh.delete(id);
      store.updateOrder(id, { status: "cooking", startedAt: Date.now() });
    });
    card.querySelector("[data-ready]")?.addEventListener("click", () => {
      const o = S.orders[id];
      card.classList.add("leaving");
      setTimeout(() => {
        store.updateOrder(id, (x) => ({ ...x, status: "ready", readyAt: Date.now(), items: x.items.map((i) => ({ ...i, done: true })) }));
        toast(`✓ Stol ${esc(o.tableNo)} tayyor — ofitsiant ${esc(o.waiterName || "")}ga xabar ketdi`, { kind: "ok" });
      }, 220);
    });
  });
  board.querySelectorAll("[data-recall]").forEach((b) => b.addEventListener("click", () => {
    store.updateOrder(b.dataset.recall, { status: "cooking", readyAt: null });
    ui.tab = "active";
    render();
  }));
}

function stopList() {
  const draw = (m) => {
    m.querySelector("#sl").innerHTML = cfg().categories.map((c) => {
      const items = cfg().items.filter((i) => i.cat === c.id);
      if (!items.length) return "";
      return `<h4>${esc(c.emoji || "")} ${esc(c.name)}</h4>${items.map((i) => `
        <label class="sl-row ${S.stop[i.id] ? "off" : ""}">
          <span>${esc(i.emoji || "")} ${esc(i.name)}</span>
          <span class="sl-state">${S.stop[i.id] ? "Tugagan" : "Bor"}</span>
          <input type="checkbox" ${S.stop[i.id] ? "" : "checked"} data-stop="${esc(i.id)}">
          <i class="switch"></i>
        </label>`).join("")}`;
    }).join("");
    m.querySelectorAll("[data-stop]").forEach((cb) => cb.addEventListener("change", () => {
      store.setStop(cb.dataset.stop, !cb.checked);
      draw(m);
    }));
  };
  modal(`
    <div class="modal-head"><h3>⛔ Stop-list</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body"><p class="muted">Tugagan taomni o'chiring: ofitsiant planshetida u "Tugagan" bo'lib ko'rinadi va buyurtma qilib bo'lmaydi.</p><div id="sl" class="sl"></div></div>`,
  { onMount: (m) => draw(m), wide: true });
}

// Oshpaz porsiyani doim ko'rsin: porsiya tanlanmagan taom — "1 porsiya"
const portionText = (opts) => (!opts ? "1 porsiya" : /porsiya/i.test(opts) ? opts : `1 porsiya, ${opts}`);

// ---------- Realtime ----------
store.on((evt) => {
  if (evt.type === "order" && !evt.local && evt.order.status === "new" && !evt.prev) {
    // Faqat haqiqatan yangi (oxirgi 2 daqiqada yuborilgan) buyurtma uchun signal
    if (Date.now() - evt.order.createdAt < 120000) {
      ui.fresh.add(evt.order.id);
      setTimeout(() => { ui.fresh.delete(evt.order.id); }, 8000);
      if (ui.sound && ui.started) chime("new");
      if (ui.started) toast(`🔔 Yangi buyurtma: <b>Stol ${esc(evt.order.tableNo)}</b> · ${esc(evt.order.waiterName || "")}`, { timeout: 5000 });
    }
  }
  if (evt.type === "render" && !document.querySelector(".modal-back")) render();
  if (evt.type === "render" && document.querySelector(".modal-back")) {
    const board = app.querySelector("#board");
    if (board) { board.innerHTML = ui.tab === "active" ? boardActive(active()) : boardReady(); bindBoard(); }
  }
});

// Taymerlar
setInterval(() => {
  const now = Date.now();
  app.querySelectorAll("[data-timer]").forEach((el) => {
    const t = Number(el.dataset.timer);
    el.textContent = mmss(now - t);
    const card = el.closest(".kt");
    const m = (now - t) / 60000;
    card.classList.toggle("warn", m >= WARN_MIN && m < LATE_MIN);
    card.classList.toggle("late", m >= LATE_MIN);
  });
  const c = document.getElementById("kclock");
  if (c) c.textContent = clock();
}, 1000);

// Signal faqat yangi buyurtma kelganda bir marta chalinadi (takroriy eslatma yo'q — oshpazni bezovta qilmasin)

document.addEventListener("pointerdown", unlockAudio);
store.cleanup();
render();
registerSW();
