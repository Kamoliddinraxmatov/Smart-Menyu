// Bosh sahifa: restoran ma'lumoti va ilovalarni ochish (yangi restoranni faqat egasi ochadi)
import { createStore } from "./sync.js";
import { activate, leaveDemo, daysLeft } from "./license.js";
import { prettyId } from "./crypto.js";
import { getRid, esc, link, applyBrand, logoHtml, connBadge, modal, toast, registerSW } from "./common.js";

const ACT = await activate();
const rid = ACT.rid;
const store = createStore(rid, ACT);
const S = store.state;
const app = document.getElementById("app");

function render() {
  const r = S.config.restaurant;
  applyBrand(r);
  app.innerHTML = `
  <div class="home">
    <div class="h-bg"></div>
    <header class="h-top">
      <div class="h-logo"><img src="img/icon.svg" alt=""><b>Smart Menyu</b></div>
      ${connBadge(S.online)}
    </header>
    <section class="h-rest">
      ${logoHtml(r, "logo logo-xl")}
      <div>
        <small>Restoran</small>
        <h1>${esc(r.name)}</h1>
        <p>${esc(r.slogan || "")}</p>
        ${ACT.demo
          ? `<p class="h-code">Namoyish rejimi · <button class="link" id="activate">Restoranimni ulash</button></p>`
          : `<p class="h-code">Kod: <b class="code">${esc(rid)}</b> · Planshet: <b class="code">${prettyId(ACT.dev.id)}</b> · Obuna: <b>${daysLeft(ACT.watcher?.lic || ACT.lic)} kun</b></p>`}
      </div>
    </section>
    <section class="h-apps">
      <a class="h-app a-waiter" href="${link("waiter.html", rid)}" style="--pic:url('${new URL("img/m/steak-veg.jpg", location.href)}')">
        <span class="h-ic">🧑‍💼</span><b>Ofitsiant va menyu</b><small>Stollar, chiroyli menyu, buyurtma. Planshetni mijozga berish mumkin.</small><i>Ochish →</i>
      </a>
      <a class="h-app a-kitchen" href="${link("kitchen.html", rid)}" style="--pic:url('${new URL("img/m/ramen3.jpg", location.href)}')">
        <span class="h-ic">👨‍🍳</span><b>Oshxona ekrani</b><small>Buyurtmalar bir zumda tushadi. "Tayyor" ofitsiantga xabar beradi.</small><i>Ochish →</i>
      </a>
      <a class="h-app a-admin" href="${link("admin.html", rid)}" style="--pic:url('${new URL("img/m/negroni.jpg", location.href)}')">
        <span class="h-ic">⚙️</span><b>Boshqaruv</b><small>Logo, rang, menyu, narxlar, stollar, ofitsiantlar va hisobot.</small><i>Ochish →</i>
      </a>
    </section>
    <section class="h-feats">
      ${[
        ["📱", "Mijoz rejimi", "Planshet stolda qoladi, mijoz o'zi tanlaydi"],
        ["🔒", "Xavfsiz", "Har restoran ma'lumoti o'z kaliti bilan shifrlangan"],
        ["🌐", "3 til", "O'zbek, rus va ingliz tillarida menyu"],
        ["⚡", "Realtime", "Oshxona va ofitsiant bir soniyada xabardor"]
      ].map(([i, b, t]) => `<div class="h-feat"><span>${i}</span><b>${b}</b><small>${t}</small></div>`).join("")}
    </section>
    <section class="h-how">
      <h2>Qanday ishlaydi</h2>
      <ol>
        <li><b>Ofitsiant</b> stolni tanlaydi, mijoz bilan menyudan taom tanlaydi yoki planshetni mijozga beradi.</li>
        <li>Buyurtma bir zumda <b>oshxona ekraniga</b> tushadi: stol raqami, ofitsiant ismi, taomlar, porsiya va izohlar.</li>
        <li>Oshpaz <b>Boshlash</b>, keyin <b>Tayyor</b> tugmasini bosadi.</li>
        <li>Stolga biriktirilgan ofitsiantning planshetiga <b>"Stol N tayyor ✓"</b> xabari ovoz va tebranish bilan keladi.</li>
      </ol>
    </section>
    <footer class="h-foot">Smart Menyu © ${new Date().getFullYear()} · Restoranlar uchun elektron menyu</footer>
  </div>`;
  app.querySelector("#activate")?.addEventListener("click", leaveDemo);
}

store.on((e) => { if (e.type === "render" && !document.querySelector(".modal-back")) render(); });
render();
registerSW();
