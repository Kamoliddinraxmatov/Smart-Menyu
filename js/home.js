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

// Bosh ekran tili: o'zbek yoki rus (faqat shu ekran uchun, mijoz menyusi tiliga ta'sir qilmaydi)
let L = "uz";
try { L = localStorage.getItem("menyu.homeLang") === "ru" ? "ru" : "uz"; } catch {}
const TX = {
  rest: ["Restoran", "Ресторан"],
  demo: ["Namoyish rejimi", "Демо-режим"],
  connect: ["Restoranimni ulash", "Подключить мой ресторан"],
  code: ["Kod", "Код"],
  tablet: ["Planshet", "Планшет"],
  sub: ["Obuna", "Подписка"],
  days: ["kun", "дн."],
  on: ["Onlayn", "Онлайн"],
  off: ["Aloqa yo'q", "Нет связи"],
  open: ["Ochish →", "Открыть →"],
  waiter: ["Ofitsiant va menyu", "Официант и меню"],
  waiterT: ["Stollar, chiroyli menyu, buyurtma. Planshetni mijozga berish mumkin.", "Столы, красивое меню, заказы. Планшет можно передать гостю."],
  kitchen: ["Oshxona ekrani", "Экран кухни"],
  kitchenT: ["Buyurtmalar bir zumda tushadi. \"Tayyor\" ofitsiantga xabar beradi.", "Заказы приходят мгновенно. «Готово» сразу уведомляет официанта."],
  admin: ["Boshqaruv", "Управление"],
  adminT: ["Logo, rang, menyu, narxlar, stollar, ofitsiantlar va hisobot.", "Логотип, цвет, меню, цены, столы, официанты и отчёты."],
  f1: ["Mijoz rejimi", "Режим гостя"], f1t: ["Planshet stolda qoladi, mijoz o'zi tanlaydi", "Планшет остаётся на столе, гость выбирает сам"],
  f2: ["Xavfsiz", "Безопасно"], f2t: ["Har restoran ma'lumoti o'z kaliti bilan shifrlangan", "Данные каждого ресторана зашифрованы своим ключом"],
  f3: ["3 til", "3 языка"], f3t: ["O'zbek, rus va ingliz tillarida menyu", "Меню на узбекском, русском и английском"],
  f4: ["Realtime", "Мгновенно"], f4t: ["Oshxona va ofitsiant bir soniyada xabardor", "Кухня и официант узнают за секунду"],
  how: ["Qanday ishlaydi", "Как это работает"],
  h1: ["<b>Ofitsiant</b> stolni tanlaydi, mijoz bilan menyudan taom tanlaydi yoki planshetni mijozga beradi.", "<b>Официант</b> выбирает стол и вместе с гостем выбирает блюда в меню или передаёт планшет гостю."],
  h2: ["Buyurtma bir zumda <b>oshxona ekraniga</b> tushadi: stol raqami, ofitsiant ismi, taomlar, porsiya va izohlar.", "Заказ мгновенно появляется на <b>экране кухни</b>: номер стола, имя официанта, блюда, порции и комментарии."],
  h3: ["Oshpaz <b>Boshlash</b>, keyin <b>Tayyor</b> tugmasini bosadi.", "Повар нажимает <b>Начать</b>, затем <b>Готово</b>."],
  h4: ["Stolga biriktirilgan ofitsiantning planshetiga <b>\"Stol N tayyor ✓\"</b> xabari ovoz va tebranish bilan keladi.", "Официант этого стола получает на планшет сообщение <b>«Стол N готов ✓»</b> со звуком и вибрацией."],
  foot: ["Restoranlar uchun elektron menyu", "Электронное меню для ресторанов"]
};
const tr = (k) => TX[k][L === "ru" ? 1 : 0];

function render() {
  const r = S.config.restaurant;
  applyBrand(r);
  app.innerHTML = `
  <div class="home">
    <div class="h-bg"></div>
    <header class="h-top">
      <div class="h-logo"><img src="img/icon.svg" alt=""><b>Smart Menyu</b></div>
      <div class="h-top-r">
        <div class="h-lang" role="group" aria-label="Til / Язык">${["uz", "ru"].map((l) => `<button data-lang="${l}" class="${L === l ? "on" : ""}">${l.toUpperCase()}</button>`).join("")}</div>
        ${connBadge(S.online).replace(/>(Onlayn|Aloqa yo'q)</, `>${tr(S.online ? "on" : "off")}<`)}
      </div>
    </header>
    <section class="h-rest">
      ${logoHtml(r, "logo logo-xl")}
      <div>
        <small>${tr("rest")}</small>
        <h1>${esc(r.name)}</h1>
        <p>${esc(r.slogan || "")}</p>
        ${ACT.demo
          ? `<p class="h-code">${tr("demo")} · <button class="link" id="activate">${tr("connect")}</button></p>`
          : ""}
      </div>
    </section>
    <section class="h-apps">
      <a class="h-app a-waiter" href="${link("waiter.html", rid)}" style="--pic:url('${new URL("img/m/steak-veg.jpg", location.href)}')">
        <span class="h-ic">🧑‍💼</span><b>${tr("waiter")}</b><small>${tr("waiterT")}</small><i>${tr("open")}</i>
      </a>
      <a class="h-app a-kitchen" href="${link("kitchen.html", rid)}" style="--pic:url('${new URL("img/m/ramen3.jpg", location.href)}')">
        <span class="h-ic">👨‍🍳</span><b>${tr("kitchen")}</b><small>${tr("kitchenT")}</small><i>${tr("open")}</i>
      </a>
      <a class="h-app a-admin" href="${link("admin.html", rid)}" style="--pic:url('${new URL("img/m/negroni.jpg", location.href)}')">
        <span class="h-ic">⚙️</span><b>${tr("admin")}</b><small>${tr("adminT")}</small><i>${tr("open")}</i>
      </a>
    </section>
    <section class="h-feats">
      ${[
        ["📱", tr("f1"), tr("f1t")],
        ["🔒", tr("f2"), tr("f2t")],
        ["🌐", tr("f3"), tr("f3t")],
        ["⚡", tr("f4"), tr("f4t")]
      ].map(([i, b, t]) => `<div class="h-feat"><span>${i}</span><b>${b}</b><small>${t}</small></div>`).join("")}
    </section>
    <section class="h-how">
      <h2>${tr("how")}</h2>
      <ol>${["h1", "h2", "h3", "h4"].map((k) => `<li>${tr(k)}</li>`).join("")}</ol>
    </section>
    <footer class="h-foot">Smart Menyu © ${new Date().getFullYear()} · ${tr("foot")}</footer>
  </div>`;
  app.querySelector("#activate")?.addEventListener("click", leaveDemo);
  app.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => {
    L = b.dataset.lang;
    try { localStorage.setItem("menyu.homeLang", L); } catch {}
    document.documentElement.lang = L;
    render();
  }));
}

store.on((e) => { if (e.type === "render" && !document.querySelector(".modal-back")) render(); });
document.documentElement.lang = L;
render();
registerSW();
