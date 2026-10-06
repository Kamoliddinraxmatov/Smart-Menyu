// Bosh sahifa: restoran tanlash va ilovalarni ochish
import { createStore } from "./sync.js";
import { getRid, esc, link, applyBrand, logoHtml, connBadge, modal, toast, registerSW } from "./common.js";

const rid = getRid();
const store = createStore(rid);
const S = store.state;
const app = document.getElementById("app");

function render() {
  const r = S.config.restaurant;
  applyBrand(r);
  app.innerHTML = `
  <div class="home">
    <header class="h-top">
      <div class="h-logo"><img src="img/icon.svg" alt=""><b>Smart Menyu</b></div>
      ${connBadge(S.online)}
    </header>
    <section class="h-rest">
      ${logoHtml(r, "logo logo-xl")}
      <div>
        <small>Restoran</small>
        <h1>${esc(r.name)}</h1>
        <p>Kod: <b class="code">${esc(rid)}</b> · <button class="link" id="switch">Boshqa restoran</button></p>
      </div>
    </section>
    <section class="h-apps">
      <a class="h-app a-waiter" href="${link("waiter.html", rid)}">
        <span class="h-ic">🧑‍💼</span><b>Ofitsiant</b><small>Menyu, stollar va buyurtma berish. Planshet uchun.</small><i>Ochish →</i>
      </a>
      <a class="h-app a-kitchen" href="${link("kitchen.html", rid)}">
        <span class="h-ic">👨‍🍳</span><b>Oshxona</b><small>Buyurtmalar realtime tushadi, "Tayyor" tugmasi ofitsiantga xabar beradi.</small><i>Ochish →</i>
      </a>
      <a class="h-app a-admin" href="${link("admin.html", rid)}">
        <span class="h-ic">⚙️</span><b>Admin</b><small>Logo, rang, menyu, narxlar, stollar, ofitsiantlar va hisobot.</small><i>Ochish →</i>
      </a>
    </section>
    <section class="h-how">
      <h2>Qanday ishlaydi</h2>
      <ol>
        <li><b>Ofitsiant</b> stolni tanlaydi, mijoz bilan menyudan taom tanlaydi va buyurtmani tasdiqlaydi.</li>
        <li>Buyurtma bir zumda <b>oshxona ekraniga</b> tushadi: stol raqami, ofitsiant ismi, taomlar va izohlar.</li>
        <li>Oshpaz <b>Boshlash</b>, keyin <b>Tayyor</b> tugmasini bosadi.</li>
        <li>Stolga biriktirilgan ofitsiantning planshetiga <b>"Stol N tayyor ✓"</b> xabari ovoz va tebranish bilan keladi.</li>
      </ol>
      <button class="btn btn-primary" id="new">+ Yangi restoran ochish</button>
    </section>
    <footer class="h-foot">Smart Menyu © ${new Date().getFullYear()} · Restoranlar uchun elektron menyu</footer>
  </div>`;
  app.querySelector("#switch").addEventListener("click", switchRest);
  app.querySelector("#new").addEventListener("click", newRest);
}

function go(code) {
  location.href = `index.html?r=${encodeURIComponent(code)}`;
}

function switchRest() {
  modal(`
    <div class="modal-head"><h3>Restoran kodi</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body"><label class="field"><span>Kodni kiriting</span><input type="text" id="code" placeholder="masalan: demo"></label></div>
    <div class="modal-actions"><button class="btn btn-primary" id="ok">Ulanish</button></div>`, {
    onMount(m) { m.querySelector("#ok").addEventListener("click", () => { const v = m.querySelector("#code").value.trim().toLowerCase(); if (v) go(v); }); }
  });
}

function slug(s) {
  const map = { "o'": "o", "g'": "g", "sh": "sh", "ch": "ch", "ʻ": "", "’": "", "'": "" };
  let x = s.toLowerCase();
  for (const [k, v] of Object.entries(map)) x = x.split(k).join(v);
  return x.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "restoran";
}

function newRest() {
  modal(`
    <div class="modal-head"><h3>Yangi restoran</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <label class="field"><span>Restoran nomi</span><input type="text" id="name" placeholder="Masalan: Rayhon"></label>
      <p class="muted small">Restoranga alohida kod beriladi. Keyin admin panelda logo, menyu, ofitsiant va stollarni kiritasiz.</p>
    </div>
    <div class="modal-actions"><button class="btn btn-primary" id="ok">Yaratish</button></div>`, {
    onMount(m) {
      m.querySelector("#ok").addEventListener("click", () => {
        const name = m.querySelector("#name").value.trim();
        if (!name) { toast("Nomini kiriting", { kind: "error" }); return; }
        const code = `${slug(name)}-${Math.random().toString(36).slice(2, 6)}`;
        // Yangi restoran demo menyu bilan boshlanadi; nomini darhol saqlaymiz
        const s2 = createStoreFor(code);
        const c = structuredClone(S.config);
        c.restaurant = { ...c.restaurant, name, logo: "", slogan: "" };
        c.adminPin = "";
        setTimeout(() => { s2.saveConfig(c); setTimeout(() => { location.href = `admin.html?r=${encodeURIComponent(code)}`; }, 800); }, 600);
      });
    }
  });
}

function createStoreFor(code) {
  return createStore(code);
}

store.on((e) => { if (e.type === "render" && !document.querySelector(".modal-back")) render(); });
render();
registerSW();
