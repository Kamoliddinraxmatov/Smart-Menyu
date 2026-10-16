// Admin panel: restoran brendi, menyu, ofitsiantlar, stollar va hisobot
import { createStore, newId } from "./sync.js";
import { activate } from "./license.js";
import {
  getRid, saveFile, esc, money, fullName, initials, clock, orderTotal, applyBrand, logoHtml, itemVisual,
  toast, modal, confirmBox, connBadge, fileToDataUrl, cropImage, link, registerSW
} from "./common.js";
import { itemTr, catTr } from "./i18n.js";
import { fixUz, translate } from "./translate.js";

const ACT = await activate();
const rid = ACT.rid;
const store = createStore(rid, ACT);
const S = store.state;
const app = document.getElementById("app");

const ui = { tab: new URLSearchParams(location.search).has("owner") ? "brand" : "menu", unlocked: sessionStorage.getItem(`menyu.admin.${rid}`) === "1", catFilter: "all" };
const cfg = () => S.config;
const cur = () => cfg().restaurant.currency || "so'm";

// O'zgarishlar navbati: 0,4 soniyada bir marta saqlanadi. Shu orada boshqa qurilmadan yangi sozlama
// kelsa ham, bizning o'zgarishlarimiz o'sha yangisining ustiga qo'llanadi (hech narsa yo'qolmaydi).
let saveTimer = null;
const pendingFns = [];
let pendingMsg = "Saqlandi";
function save(_c, msg = "Saqlandi") {
  pendingMsg = msg;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!S.configLoaded) return;
    const c = structuredClone(S.config);
    for (const fn of pendingFns.splice(0)) fn(c);
    store.saveConfig(c);
    toast(`✓ ${pendingMsg}`, { kind: "ok", timeout: 1500 });
  }, 400);
}

function mutate(fn, msg) {
  if (!S.configLoaded) { toast("Ma'lumotlar hali yuklanmadi. Internetni tekshiring.", { kind: "error" }); return; }
  const c = structuredClone(cfg());
  fn(c);
  S.config = c;            // darhol ko'rsatish uchun
  pendingFns.push(fn);
  save(c, msg);
}

// "Restoran" (nom, logo, rang, PIN) bo'limi faqat egasi uchun: admin.html?owner=1 bilan ochiladi
const OWNER = new URLSearchParams(location.search).has("owner");
const TABS = [
  ...(OWNER ? [["brand", "🎨", "Restoran"]] : []),
  ["menu", "📋", "Menyu"],
  ["waiters", "🧑‍💼", "Ofitsiantlar"],
  ["tables", "🪑", "Stollar"],
  ["report", "📊", "Hisobot"],
  ["devices", "📱", "Qurilmalar"]
];

function render() {
  applyBrand(cfg().restaurant);
  document.title = `${cfg().restaurant.name} · Admin`;
  // Restoran sozlamalari serverdan kelmaguncha boshqaruvni ochmaymiz (aks holda namoyish menyusi ustiga yozilib ketishi mumkin)
  if (!S.configLoaded) {
    app.innerHTML = `<div class="adm-loading"><div class="lic-ico lic-spin">⏳</div><h2>Restoran ma'lumotlari yuklanmoqda...</h2><p>${S.online ? "Bir oz kuting." : "Internet yo'q. Planshet internetga ulanishi bilan davom etadi."}</p></div>`;
    return;
  }
  if (cfg().adminPin && !ui.unlocked) return renderLock();
  const r = cfg().restaurant;
  app.innerHTML = `
  <div class="admin">
    <aside class="side">
      <div class="side-brand">${logoHtml(r)}<div><b>${esc(r.name)}</b><small>Admin panel</small></div></div>
      <nav>${TABS.map(([id, ic, name]) => `<button class="${ui.tab === id ? "on" : ""}" data-tab="${id}"><span>${ic}</span>${name}</button>`).join("")}</nav>
      <div class="side-foot">${connBadge(S.online)}<a href="${link("index.html", rid)}">← Bosh sahifa</a></div>
    </aside>
    <main class="content" id="content"></main>
  </div>`;
  app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { ui.tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
  const c = app.querySelector("#content");
  ({ brand: tabBrand, menu: tabMenu, waiters: tabWaiters, tables: tabTables, report: tabReport, devices: tabDevices })[ui.tab](c);
}

function renderLock() {
  app.innerHTML = `
  <div class="lock">
    ${logoHtml(cfg().restaurant, "logo logo-xl")}
    <h2>${esc(cfg().restaurant.name)} · Admin</h2>
    <input type="password" inputmode="numeric" id="pin" placeholder="Admin PIN" autofocus>
    <button class="btn btn-primary btn-block" id="go">Kirish</button>
  </div>`;
  const go = () => {
    if (app.querySelector("#pin").value === String(cfg().adminPin)) {
      ui.unlocked = true; sessionStorage.setItem(`menyu.admin.${rid}`, "1"); render();
    } else toast("PIN noto'g'ri", { kind: "error" });
  };
  app.querySelector("#go").addEventListener("click", go);
  app.querySelector("#pin").addEventListener("keydown", (e) => e.key === "Enter" && go());
}

// ---------- Restoran (brend) ----------
function tabBrand(c) {
  const r = cfg().restaurant;
  c.innerHTML = `
  <div class="page-head"><h1>Restoran va brend</h1><p>Logo, nom va rang ofitsiant planshetida, oshxona ekranida va mijoz hisobida ko'rinadi.</p></div>
  <div class="cols">
    <div class="card">
      <div class="logo-edit">
        ${logoHtml(r, "logo logo-xl")}
        <div>
          <label class="btn btn-ghost">📷 Logo yuklash<input type="file" accept="image/*" id="logo" class="file-overlay"></label>
          ${r.logo ? `<button class="btn btn-ghost" id="rmLogo">O'chirish</button>` : ""}
          <p class="hint">Kvadrat PNG yoki JPG, avtomatik kichraytiriladi.</p>
        </div>
      </div>
      <label class="field"><span>Restoran nomi</span><input type="text" data-r="name" value="${esc(r.name)}"></label>
      <label class="field"><span>Shior</span><input type="text" data-r="slogan" value="${esc(r.slogan || "")}"></label>
      <div class="row2">
        <label class="field"><span>Brend rangi</span><div class="color-row"><input type="color" data-r="color" value="${esc(r.color)}"><div class="swatches">${["#B4232A", "#0E7C66", "#1F4E8C", "#C26A00", "#6B2FA3", "#1E1B18", "#A3195B", "#2E7D32"].map((x) => `<button style="background:${x}" data-color="${x}"></button>`).join("")}</div></div></label>
        <label class="field"><span>Xizmat haqi, %</span><input type="number" min="0" max="30" data-r="service" value="${esc(r.service)}"></label>
      </div>
      <div class="row2">
        <label class="field"><span>Valyuta</span><input type="text" data-r="currency" value="${esc(r.currency)}"></label>
        <label class="field"><span>Telefon</span><input type="tel" data-r="phone" value="${esc(r.phone || "")}"></label>
      </div>
      <label class="field"><span>Manzil</span><input type="text" data-r="address" value="${esc(r.address || "")}"></label>
      <div class="row2">
        <label class="field"><span>Chek kengligi (termoprinter)</span><select data-r="receiptWidth">${["80", "58"].map((w) => `<option value="${w}" ${String(r.receiptWidth || "80") === w ? "selected" : ""}>${w} mm</option>`).join("")}</select></label>
        <label class="field"><span>Chek pastidagi matn</span><input type="text" data-r="receiptNote" value="${esc(r.receiptNote || "")}" placeholder="Rahmat! Yana kutib qolamiz"></label>
      </div>
      <label class="field"><span>Admin PIN (bo'sh qoldirsangiz, parolsiz ochiladi)</span><input type="text" inputmode="numeric" id="adminPin" value="${esc(cfg().adminPin || "")}"></label>
    </div>
    <div class="preview">
      <div class="label">Ko'rinishi</div>
      <div class="pv-tablet">
        <div class="pv-bar">${logoHtml(r)}<div><b>${esc(r.name)}</b><small>${esc(r.slogan || "")}</small></div></div>
        <div class="pv-body">
          ${cfg().items.slice(0, 4).map((i) => `<div class="pv-item">${itemVisual(i, "thumb pv-img")}<b>${esc(i.name)}</b><span>${money(i.price, cur())}</span></div>`).join("")}
        </div>
        <div class="pv-btn">Buyurtmani tasdiqlash →</div>
      </div>
    </div>
  </div>`;
  c.querySelectorAll("[data-r]").forEach((inp) => inp.addEventListener(inp.type === "color" ? "input" : "change", () => {
    mutate((x) => { x.restaurant[inp.dataset.r] = inp.type === "number" ? Number(inp.value) : inp.value; });
    if (inp.type === "color" || inp.dataset.r === "name") render();
  }));
  c.querySelectorAll("[data-color]").forEach((b) => b.addEventListener("click", () => { mutate((x) => { x.restaurant.color = b.dataset.color; }); render(); }));
  c.querySelector("#adminPin").addEventListener("change", (e) => { mutate((x) => { x.adminPin = e.target.value.trim(); }, "Admin PIN saqlandi"); ui.unlocked = true; sessionStorage.setItem(`menyu.admin.${rid}`, "1"); });
  c.querySelector("#logo").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    let url;
    try { url = await fileToDataUrl(f, 256, 0.85); } catch { return toast("Bu rasmni ochib bo'lmadi. JPG yoki PNG tanlang.", { kind: "error" }); }
    mutate((x) => { x.restaurant.logo = url; }, "Logo saqlandi");
    render();
  });
  c.querySelector("#rmLogo")?.addEventListener("click", () => { mutate((x) => { x.restaurant.logo = ""; }); render(); });
}

// ---------- Menyu ----------
function tabMenu(c) {
  const cats = cfg().categories;
  const items = cfg().items.filter((i) => ui.catFilter === "all" || i.cat === ui.catFilter);
  c.innerHTML = `
  <div class="page-head row-between">
    <div><h1>Menyu</h1><p>${cfg().items.length} ta taom, ${cats.length} ta kategoriya</p></div>
    <div class="head-actions"><button class="btn btn-ghost" id="cats">🗂 Bo'limlar va fonlar</button><button class="btn btn-primary" id="add">+ Taom qo'shish</button></div>
  </div>
  <div class="chips-row">
    <button class="chip ${ui.catFilter === "all" ? "on" : ""}" data-f="all">Hammasi</button>
    ${cats.map((x) => `<button class="chip ${ui.catFilter === x.id ? "on" : ""}" data-f="${esc(x.id)}">${esc(x.emoji || "")} ${esc(x.name)}</button>`).join("")}
  </div>
  <div class="card list">
    ${items.map((i) => `
      <div class="li ${i.hidden ? "dim" : ""}" data-edit="${esc(i.id)}">
        ${itemVisual(i, "thumb li-img")}
        <div class="li-main"><b>${esc(i.name)} ${i.popular ? "⭐" : ""} ${i.hidden ? `<span class="badge b-served">yashirin</span>` : ""}</b><small>${esc(cats.find((x) => x.id === i.cat)?.name || "")} · ${esc(i.desc || "")}</small></div>
        <b class="li-price">${money(i.price, cur())}</b>
        <span class="li-arrow">›</span>
      </div>`).join("") || `<div class="empty">Bu kategoriyada taom yo'q</div>`}
  </div>`;
  c.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { ui.catFilter = b.dataset.f; render(); }));
  c.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => itemEditor(cfg().items.find((i) => i.id === b.dataset.edit))));
  c.querySelector("#add").addEventListener("click", () => itemEditor(null));
  c.querySelector("#cats").addEventListener("click", catEditor);
}

function itemEditor(item) {
  const isNew = !item;
  const it = item ? structuredClone(item) : { id: "i" + newId(), cat: ui.catFilter !== "all" ? ui.catFilter : cfg().categories[0]?.id, name: "", desc: "", price: 0, emoji: "🍽️", img: "", popular: false, time: 10 };
  modal(`
    <div class="modal-head"><h3>${isNew ? "Yangi taom" : "Taomni tahrirlash"}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <div class="img-edit">
        <div id="vis">${itemVisual(it, "thumb ie-img")}</div>
        <div>
          <label class="btn btn-ghost">📷 Rasm yuklash<input type="file" accept="image/*" id="img" class="file-overlay"></label>
          <button class="btn btn-ghost" id="rmImg" ${it.img ? "" : "hidden"}>Rasmni o'chirish</button>
          <label class="field"><span>Emoji (rasm bo'lmasa)</span><input type="text" id="emoji" value="${esc(it.emoji || "")}" maxlength="4"></label>
        </div>
      </div>
      <label class="field"><span>Nomi (o'zbekcha)</span><input type="text" id="name" value="${esc(it.name)}" placeholder="Masalan: To'y oshi"></label>
      <label class="field"><span>Tavsif (o'zbekcha)</span><input type="text" id="desc" value="${esc(it.desc || "")}"></label>
      <div class="opt-edit">
        <div>
          <div class="oe-head"><b>Porsiya / variantlar</b><small>Mijoz bittasini tanlaydi. Narx shu variant narxi bo'ladi.</small></div>
          <div id="vars"></div>
          <button class="btn btn-ghost btn-sm" id="addVar">+ Variant</button>
        </div>
        <div>
          <div class="oe-head"><b>Qo'shimchalar</b><small>Mijoz bir nechtasini tanlashi mumkin, narxi qo'shiladi.</small></div>
          <div id="exs"></div>
          <button class="btn btn-ghost btn-sm" id="addEx">+ Qo'shimcha</button>
        </div>
      </div>
      <div class="tr-box">
        <div class="tr-head"><b>🌐 Boshqa tillar</b><small>Taomni istalgan tilda yozing va o'sha tildagi tugmani bosing: qolgan ikki til o'zi to'ldiriladi. Kerak bo'lsa qo'lda tuzating.</small></div>
        <div class="tr-row"><b>UZ</b><span class="tr-note">Yuqoridagi nomi va tavsif</span><button class="btn btn-ghost tr-btn" data-tr-from="uz">🌐 Rus va ingliz tiliga</button></div>
        ${[["ru", "Русский", "🌐 O'zbek va ingliz tiliga"], ["en", "English", "🌐 O'zbek va rus tiliga"]].map(([l, label, btn]) => {
          const tr = itemTr(it, l);
          return `<div class="tr-row"><b>${l.toUpperCase()}</b>
            <div class="tr-fields"><input type="text" id="tr-${l}-name" value="${esc(tr.name)}" placeholder="${label}: nomi">
            <input type="text" id="tr-${l}-desc" value="${esc(tr.desc)}" placeholder="${label}: tavsif"></div>
            <button class="btn btn-ghost tr-btn" data-tr-from="${l}">${btn}</button></div>`;
        }).join("")}
        <p class="hint">Bo'sh qoldirilsa, o'zbekcha nomi ko'rinadi.</p>
      </div>
      <div class="row2">
        <label class="field"><span>Narxi (${esc(cur())})</span><input type="number" id="price" min="0" step="500" value="${esc(it.price)}"></label>
        <label class="field"><span>Kategoriya</span><select id="cat">${cfg().categories.map((x) => `<option value="${esc(x.id)}" ${x.id === it.cat ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
      </div>
      <div class="row2">
        <div>
          <label class="field"><span>Tayyorlash vaqti, daqiqa</span><input type="number" id="time" min="0" value="${esc(it.time || 0)}"></label>
          <label class="field"><span>Hajmi / og'irligi</span><input type="text" id="weight" value="${esc(it.weight || "")}" placeholder="300 g, 0,75 l, 8 dona"></label>
        </div>
        <div class="field checks">
          <label><input type="checkbox" id="popular" ${it.popular ? "checked" : ""}> ⭐ Mashhur</label>
          <label><input type="checkbox" id="hidden" ${it.hidden ? "checked" : ""}> Menyuda yashirish</label>
          <label><input type="checkbox" id="fit" ${it.fit === "contain" ? "checked" : ""}> Rasmni qirqmasdan ko'rsatish (butilka)</label>
        </div>
      </div>
    </div>
    <div class="modal-actions">
      ${isNew ? "" : `<button class="btn btn-danger" id="del">O'chirish</button>`}
      <button class="btn btn-primary" id="ok">Saqlash</button>
    </div>`, {
    wide: true,
    onMount(m, close) {
      const $ = (s) => m.querySelector(s);
      $("#img").addEventListener("change", async (e) => {
        const f = e.target.files[0]; e.target.value = ""; if (!f) return;
        const url = await cropImage(f, { ratio: 4 / 3, outW: 800, quality: 0.74, title: "Taom rasmini qirqish" });
        if (!url) return;
        it.img = url; delete it.fit;
        $("#vis").innerHTML = itemVisual(it, "thumb ie-img"); $("#rmImg").hidden = false;
      });
      const vars = structuredClone(it.variants || []);
      const exs = structuredClone(it.extras || []);
      const drawOpts = (box, list, ph) => {
        $(box).innerHTML = list.map((o, i) => `
          <div class="oe-row">
            <input type="text" data-o="${i}" data-f="name" value="${esc(o.name)}" placeholder="${ph}">
            <input type="number" data-o="${i}" data-f="price" value="${esc(o.price ?? "")}" min="0" step="500" placeholder="Narx">
            <button class="icon-btn" data-rm="${i}">✕</button>
          </div>`).join("");
        $(box).querySelectorAll("[data-o]").forEach((inp) => inp.addEventListener("input", () => {
          const o = list[inp.dataset.o]; o[inp.dataset.f] = inp.dataset.f === "price" ? Number(inp.value) || 0 : inp.value;
        }));
        $(box).querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { list.splice(+b.dataset.rm, 1); drawOpts(box, list, ph); }));
      };
      drawOpts("#vars", vars, "Masalan: 0,5 porsiya");
      drawOpts("#exs", exs, "Masalan: Pishloq");
      $("#addVar").addEventListener("click", () => { vars.push({ id: "v" + newId(), name: "", price: Number($("#price").value) || 0 }); drawOpts("#vars", vars, "Masalan: 0,5 porsiya"); });
      $("#addEx").addEventListener("click", () => { exs.push({ id: "e" + newId(), name: "", price: 0 }); drawOpts("#exs", exs, "Masalan: Pishloq"); });
      $("#rmImg").addEventListener("click", () => { it.img = ""; $("#vis").innerHTML = itemVisual(it, "thumb ie-img"); $("#rmImg").hidden = true; });
      // O'zbekcha matnning imlosini avtomatik tuzatish
      const fixField = (sel) => { const el = $(sel); const v = fixUz(el.value); if (v !== el.value) { el.value = v; el.classList.add("fixed"); setTimeout(() => el.classList.remove("fixed"), 1200); } };
      ["#name", "#desc"].forEach((sel) => $(sel).addEventListener("blur", () => fixField(sel)));
      const fld = (l, k) => (l === "uz" ? $(`#${k}`) : $(`#tr-${l}-${k}`));
      m.querySelectorAll("[data-tr-from]").forEach((b) => b.addEventListener("click", async () => {
        const from = b.dataset.trFrom;
        if (from === "uz") { fixField("#name"); fixField("#desc"); }
        if (!fld(from, "name").value.trim()) { toast(from === "uz" ? "Avval taom nomini yozing" : `Avval ${from.toUpperCase()} qatoriga nomini yozing`, { kind: "error" }); return; }
        const txt = b.textContent; b.disabled = true; b.textContent = "⏳ Tarjima qilinmoqda...";
        try {
          for (const to of ["uz", "ru", "en"].filter((x) => x !== from)) {
            const [n, d] = await Promise.all([translate(fld(from, "name").value, to, from), translate(fld(from, "desc").value, to, from)]);
            fld(to, "name").value = to === "uz" ? fixUz(n) : n;
            fld(to, "desc").value = to === "uz" ? fixUz(d) : d;
          }
          b.textContent = "✓ Tayyor";
        } catch {
          toast("Tarjima uchun internet kerak. Keyinroq qayta bosing.", { kind: "error", timeout: 5000 });
          b.textContent = txt;
        }
        b.disabled = false;
        setTimeout(() => { if (b.textContent === "✓ Tayyor") b.textContent = txt; }, 2000);
      }));
      $("#ok").addEventListener("click", () => {
        fixField("#name"); fixField("#desc");
        Object.assign(it, {
          name: $("#name").value.trim(), desc: $("#desc").value.trim(), price: Number($("#price").value) || 0,
          cat: $("#cat").value, time: Number($("#time").value) || 0, weight: $("#weight").value.trim(), emoji: $("#emoji").value.trim(),
          popular: $("#popular").checked, hidden: $("#hidden").checked, fit: $("#fit").checked ? "contain" : ""
        });
        const clean = (l) => l.filter((o) => String(o.name || "").trim()).map((o) => ({ ...o, name: o.name.trim(), price: Number(o.price) || 0 }));
        it.variants = clean(vars);
        it.extras = clean(exs);
        if (!it.variants.length) delete it.variants;
        if (!it.extras.length) delete it.extras;
        if (it.variants) it.price = Math.min(...it.variants.map((v) => v.price));
        it.tr = {};
        for (const l of ["ru", "en"]) {
          const name = $(`#tr-${l}-name`).value.trim(), desc = $(`#tr-${l}-desc`).value.trim();
          if (name || desc) it.tr[l] = { name, desc };
        }
        if (!it.name) { toast("Taom nomini kiriting", { kind: "error" }); return; }
        mutate((x) => {
          const i = x.items.findIndex((y) => y.id === it.id);
          if (i >= 0) x.items[i] = it; else x.items.push(it);
        }, isNew ? "Taom qo'shildi" : "Taom saqlandi");
        close(); render();
      });
      $("#del")?.addEventListener("click", async () => {
        if (!(await confirmBox(`"${esc(it.name)}" menyudan o'chirilsinmi?`, "O'chirish", { danger: true }))) return;
        mutate((x) => { x.items = x.items.filter((y) => y.id !== it.id); }, "Taom o'chirildi");
        close(); render();
      });
    }
  });
}

// Menyu foni uchun xiralashtirilgan kichik nusxa
function blurredDataUrl(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = 420, h = Math.round(img.height * w / img.width);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.filter = "blur(14px)";
      ctx.drawImage(img, -20, -20, w + 40, h + 40);
      resolve(c.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

// Bo'limni o'chirishda taomlari bilan nima qilish: undefined = bekor, null = taomlari ham o'chadi, id = shu bo'limga o'tkaziladi
function askDelCat(x, n, others) {
  return new Promise((resolve) => {
    let done = false;
    const end = (v) => { if (!done) { done = true; resolve(v); } };
    modal(`
      <div class="modal-head"><h3>"${esc(x.name)}" bo'limini o'chirish</h3><button class="icon-btn" data-close>✕</button></div>
      <div class="modal-body">
        <p class="confirm-text">Bu bo'limda <b>${n} ta taom</b> bor. Ular bilan nima qilamiz?</p>
        ${others.length ? `<label class="muted small">Taomlarni shu bo'limga o'tkazish:</label>
          <select id="dc-to">${others.map((y) => `<option value="${esc(y.id)}">${esc((y.emoji ? y.emoji + " " : "") + y.name)}</option>`).join("")}</select>
          <button class="btn btn-primary btn-block" id="dc-move" style="margin-top:10px">Taomlarni o'tkazib, bo'limni o'chirish</button>` : ""}
        <button class="btn btn-danger btn-block" id="dc-all" style="margin-top:10px">Bo'limni ${n} ta taomi bilan o'chirish</button>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Bekor qilish</button></div>`, {
      onMount(m, close) {
        m.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => end(undefined)));
        m.querySelector("#dc-move")?.addEventListener("click", () => { end(m.querySelector("#dc-to").value); close(); });
        m.querySelector("#dc-all").addEventListener("click", () => { end(null); close(); });
        m.parentElement.addEventListener("click", (e) => { if (e.target === m.parentElement) end(undefined); });
      }
    });
  });
}

function catEditor() {
  let cats = structuredClone(cfg().categories);
  const moves = {}; // o'chirilgan bo'lim -> taomlari qayerga (null: o'chadi)
  const finalCat = (c) => { const seen = new Set(); while (c && c in moves && !seen.has(c)) { seen.add(c); c = moves[c]; } return c; };
  const draw = (m) => {
    m.querySelector("#cl").innerHTML = cats.map((x, i) => `
      <div class="cat-card">
        <label class="cat-pic" title="Bo'lim rasmi" style="${x.hero || x.bg ? `background-image:url('${esc(x.hero || x.bg)}')` : ""}">
          ${x.hero || x.bg ? "" : "📷"}<input type="file" accept="image/*" data-pic="${i}" class="file-overlay">
        </label>
        <div class="cat-fields">
          <div class="cat-row">
            <input type="text" class="cat-emoji" data-i="${i}" data-k="emoji" value="${esc(x.emoji || "")}" maxlength="4">
            <input type="text" data-i="${i}" data-k="name" value="${esc(x.name)}" placeholder="Nomi">
          </div>
          <input type="text" data-i="${i}" data-k="tagline" value="${esc(x.tagline || "")}" placeholder="Shior, masalan: kechki kayfiyat uchun">
          ${["ru", "en"].map((l) => { const tr = x.tr?.[l] || catTr(x, l); return `<div class="cat-row tr-mini"><b>${l.toUpperCase()}</b>
            <input type="text" data-tr="${i}" data-l="${l}" data-k="name" value="${esc(tr.name || "")}" placeholder="Nomi">
            <input type="text" data-tr="${i}" data-l="${l}" data-k="tagline" value="${esc(tr.tagline || "")}" placeholder="Shior"></div>`; }).join("")}
          <label class="adult-chk"><input type="checkbox" data-adult="${i}" ${x.adult ? "checked" : ""}> 18+ (spirtli ichimliklar)</label>
        </div>
        <div class="cat-btns">
          <button class="icon-btn" data-up="${i}" ${i ? "" : "disabled"}>↑</button>
          <button class="icon-btn" data-del="${i}">🗑</button>
        </div>
      </div>`).join("");
    m.querySelectorAll("[data-i][data-k]").forEach((inp) => inp.addEventListener("input", () => { cats[inp.dataset.i][inp.dataset.k] = inp.value; }));
    m.querySelectorAll("[data-tr]").forEach((inp) => inp.addEventListener("input", () => {
      const x = cats[inp.dataset.tr];
      x.tr = x.tr || { ru: catTr(x, "ru"), en: catTr(x, "en") };
      x.tr[inp.dataset.l] = { ...(x.tr[inp.dataset.l] || {}), [inp.dataset.k]: inp.value.trim() };
    }));
    m.querySelectorAll("[data-adult]").forEach((cb) => cb.addEventListener("change", () => { cats[cb.dataset.adult].adult = cb.checked; }));
    m.querySelectorAll("[data-pic]").forEach((inp) => inp.addEventListener("change", async () => {
      const f = inp.files[0]; inp.value = ""; if (!f) return;
      const x = cats[inp.dataset.pic];
      const url = await cropImage(f, { ratio: 16 / 9, outW: 960, quality: 0.72, title: "Bo'lim rasmini qirqish" });
      if (!url) return;
      x.hero = url;
      x.bg = await blurredDataUrl(x.hero);
      draw(m);
    }));
    m.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => { const i = +b.dataset.up; [cats[i - 1], cats[i]] = [cats[i], cats[i - 1]]; draw(m); }));
    m.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      const x = cats[+b.dataset.del];
      const n = cfg().items.filter((i) => finalCat(i.cat) === x.id).length;
      if (n) {
        const to = await askDelCat(x, n, cats.filter((y) => y !== x));
        if (to === undefined) return;
        moves[x.id] = to; // null: taomlari ham o'chadi, aks holda shu bo'limga o'tadi
      }
      cats = cats.filter((y) => y !== x); draw(m);
      toast("O'zgarish \"Saqlash\" bosilganda kuchga kiradi");
    }));
  };
  modal(`
    <div class="modal-head"><h3>Bo'limlar</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body"><p class="muted small">Rasm bo'lim sarlavhasida va menyu fonida (xira holda) ko'rinadi.</p><button class="btn btn-ghost tr-btn cat-trall" id="trall">🌐 Bo'limlarni rus va ingliz tiliga tarjima qilish</button><div id="cl"></div><button class="btn btn-ghost btn-block" id="addc">+ Bo'lim qo'shish</button></div>
    <div class="modal-actions"><button class="btn btn-primary" id="ok">Saqlash</button></div>`, { wide: true,
    onMount(m, close) {
      draw(m);
      m.querySelector("#trall").addEventListener("click", async (e) => {
        const b = e.currentTarget, txt = b.textContent;
        b.disabled = true; b.textContent = "⏳ Tarjima qilinmoqda...";
        try {
          for (const x of cats) {
            x.name = fixUz(x.name); x.tagline = fixUz(x.tagline || "");
            x.tr = x.tr || {};
            for (const l of ["ru", "en"]) x.tr[l] = { name: await translate(x.name, l), tagline: await translate(x.tagline, l) };
          }
          draw(m); toast("Tarjima tayyor. Tekshirib, \"Saqlash\"ni bosing.", { kind: "ok" });
        } catch { toast("Tarjima uchun internet kerak.", { kind: "error" }); }
        b.disabled = false; b.textContent = txt;
      });
      m.querySelector("#addc").addEventListener("click", () => { cats.push({ id: "c" + newId(), name: "Yangi kategoriya", emoji: "🍽️" }); draw(m); });
      m.querySelector("#ok").addEventListener("click", () => {
        mutate((x) => {
          x.categories = cats.map((y) => ({ ...y, name: y.name.trim() || "Bo'lim" }));
          // O'chirilgan bo'limlarning taomlari: boshqa bo'limga o'tadi yoki o'chadi
          x.items = x.items.filter((i) => finalCat(i.cat) !== null).map((i) => (i.cat in moves ? { ...i, cat: finalCat(i.cat) } : i));
        }, "Bo'limlar saqlandi");
        close(); render();
      });
    }
  });
}

// QR kod qurilmaning o'zida yasaladi (internet shart emas)
function qrSrc(url) {
  try {
    const q = window.qrcode(0, "M");
    q.addData(url); q.make();
    return q.createDataURL(6, 2);
  } catch {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(url)}`;
  }
}

// ---------- Ofitsiantlar ----------
function tabWaiters(c) {
  c.innerHTML = `
  <div class="page-head row-between">
    <div><h1>Ofitsiantlar</h1><p>Har bir ofitsiant planshetga ismini tanlab, PIN-kod bilan kiradi. Stolga biriktirilgan ofitsiant buyurtmaga avtomatik yoziladi.</p></div>
    <button class="btn btn-primary" id="add">+ Ofitsiant qo'shish</button>
  </div>
  <div class="card list">
    ${cfg().waiters.map((w) => {
      const tables = cfg().tables.filter((t) => t.waiterId === w.id).map((t) => t.no);
      return `
      <div class="li" data-edit="${esc(w.id)}">
        <span class="avatar">${esc(initials(w))}</span>
        <div class="li-main"><b>${esc(fullName(w))}</b><small>PIN: ${w.pin ? "••••" : "yo'q"} · Stollar: ${tables.length ? tables.map(esc).join(", ") : "biriktirilmagan"}</small></div>
        <span class="li-arrow">›</span>
      </div>`;
    }).join("") || `<div class="empty">Hali ofitsiant yo'q</div>`}
  </div>`;
  c.querySelector("#add").addEventListener("click", () => waiterEditor(null));
  c.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => waiterEditor(cfg().waiters.find((w) => w.id === b.dataset.edit))));
}

function waiterEditor(w) {
  const isNew = !w;
  const x = w ? structuredClone(w) : { id: "w" + newId(), first: "", last: "", pin: String(Math.floor(1000 + Math.random() * 9000)) };
  modal(`
    <div class="modal-head"><h3>${isNew ? "Yangi ofitsiant" : "Ofitsiant"}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">
      <label class="field"><span>Ismi</span><input type="text" id="first" value="${esc(x.first)}"></label>
      <label class="field"><span>Familiyasi</span><input type="text" id="last" value="${esc(x.last)}"></label>
      <label class="field"><span>PIN-kod (4 raqam)</span><input type="text" inputmode="numeric" maxlength="4" id="pin" value="${esc(x.pin || "")}"></label>
    </div>
    <div class="modal-actions">
      ${isNew ? "" : `<button class="btn btn-danger" id="del">O'chirish</button>`}
      <button class="btn btn-primary" id="ok">Saqlash</button>
    </div>`, {
    onMount(m, close) {
      m.querySelector("#ok").addEventListener("click", () => {
        x.first = m.querySelector("#first").value.trim();
        x.last = m.querySelector("#last").value.trim();
        x.pin = m.querySelector("#pin").value.replace(/\D/g, "").slice(0, 4);
        if (!x.first) { toast("Ismni kiriting", { kind: "error" }); return; }
        if (x.pin && x.pin.length !== 4) { toast("PIN 4 ta raqam bo'lishi kerak", { kind: "error" }); return; }
        mutate((c) => { const i = c.waiters.findIndex((y) => y.id === x.id); if (i >= 0) c.waiters[i] = x; else c.waiters.push(x); }, "Ofitsiant saqlandi");
        close(); render();
      });
      m.querySelector("#del")?.addEventListener("click", async () => {
        if (!(await confirmBox(`${esc(fullName(x))} o'chirilsinmi? Uning stollari biriktirilmagan bo'lib qoladi.`, "O'chirish", { danger: true }))) return;
        mutate((c) => { c.waiters = c.waiters.filter((y) => y.id !== x.id); c.tables.forEach((t) => { if (t.waiterId === x.id) t.waiterId = ""; }); }, "Ofitsiant o'chirildi");
        close(); render();
      });
    }
  });
}

// ---------- Stollar ----------
function tabTables(c) {
  const ws = cfg().waiters;
  c.innerHTML = `
  <div class="page-head row-between">
    <div><h1>Stollar</h1><p>Stol mijozni o'tqazib buyurtma olgan ofitsiantniki bo'ladi. Bu yerda ofitsiantlar qilgan bronlarni ko'rish va bekor qilish mumkin.</p></div>
    <button class="btn btn-primary" id="add">+ Stol qo'shish</button>
  </div>
  <div class="card">
    <table class="tbl">
      <thead><tr><th>Stol</th><th>Joy (zal)</th><th>O'rinlar</th><th>Bron</th><th></th></tr></thead>
      <tbody>
        ${cfg().tables.map((t, i) => `
          <tr>
            <td><input type="text" data-i="${esc(t.id)}" data-k="no" value="${esc(t.no)}" class="in-no"></td>
            <td><input type="text" data-i="${esc(t.id)}" data-k="zone" value="${esc(t.zone || "")}"></td>
            <td><input type="number" data-i="${esc(t.id)}" data-k="seats" value="${esc(t.seats || "")}" class="in-seats"></td>
            <td>${S.reserves?.[t.id] ? `<span class="res-tag">🔖 ${esc(S.reserves[t.id].waiterName || "")} · ${clock(S.reserves[t.id].at)}${S.reserves[t.id].note ? ` · ${esc(S.reserves[t.id].note)}` : ""}</span> <button class="btn btn-ghost btn-sm" data-unres="${esc(t.id)}">Bekor qilish</button>` : `<span class="muted">—</span>`}</td>
            <td><button class="icon-btn" data-del="${esc(t.id)}">🗑</button></td>
          </tr>`).join("")}
      </tbody>
    </table>
  </div>`;
  c.querySelectorAll("[data-k]").forEach((inp) => inp.addEventListener("change", () => {
    mutate((x) => { const t = x.tables.find((y) => y.id === inp.dataset.i); if (t) t[inp.dataset.k] = inp.dataset.k === "seats" ? Number(inp.value) : inp.value; }, "Stol saqlandi");
  }));
  c.querySelectorAll("[data-unres]").forEach((b) => b.addEventListener("click", async () => {
    if (!(await confirmBox("Bron bekor qilinsinmi?", "Bekor qilish", { danger: true }))) return;
    store.setReserve(b.dataset.unres, null); toast("Bron bekor qilindi", { kind: "ok" }); render();
  }));
  c.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    const t = cfg().tables.find((y) => y.id === b.dataset.del);
    if (!t) return;
    if (Object.values(S.orders).some((o) => o.tableId === t.id && o.status !== "closed")) {
      toast(`Stol ${esc(t.no)} hozir band. Avval ofitsiant stolni yopsin.`, { kind: "error", timeout: 5000 }); return;
    }
    if (!(await confirmBox(`Stol ${esc(t.no)} o'chirilsinmi?`, "O'chirish", { danger: true }))) return;
    mutate((x) => { x.tables = x.tables.filter((y) => y.id !== t.id); }, "Stol o'chirildi"); render();
  }));
  c.querySelector("#add").addEventListener("click", () => {
    const nums = cfg().tables.map((t) => parseInt(t.no, 10)).filter((n) => !isNaN(n));
    const last = cfg().tables[cfg().tables.length - 1];
    mutate((x) => { x.tables.push({ id: "t" + newId(), no: String((nums.length ? Math.max(...nums) : 0) + 1), zone: last?.zone || "Zal", seats: 4, waiterId: last?.waiterId || "" }); }, "Stol qo'shildi");
    render();
  });
}

// ---------- Hisobot ----------
// ---------- Hisobot: kun / hafta / oy, Excel (CSV) ----------
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const PERIODS = [["today", "Bugun"], ["yesterday", "Kecha"], ["week", "7 kun"], ["month", "30 kun"], ["thismonth", "Shu oy"], ["custom", "Sana tanlash"]];
ui.period = ui.period || "today";

function periodRange() {
  const now = new Date(), today = dayStart(now);
  const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  switch (ui.period) {
    case "yesterday": return [add(today, -1), today];
    case "week": return [add(today, -6), add(today, 1)];
    case "month": return [add(today, -29), add(today, 1)];
    case "thismonth": return [new Date(now.getFullYear(), now.getMonth(), 1), add(today, 1)];
    case "custom": {
      const f = ui.from ? dayStart(new Date(ui.from)) : add(today, -6);
      const t = ui.to ? add(dayStart(new Date(ui.to)), 1) : add(today, 1);
      return [f, t];
    }
    default: return [today, add(today, 1)];
  }
}

// Arxiv (sales) + hali arxivga tushmagan yopilgan cheklar
function salesInRange(from, to) {
  const all = { ...S.sales };
  Object.values(S.orders).forEach((o) => {
    if (o.status !== "closed" || all[o.id]) return;
    const sum = orderTotal(o);
    all[o.id] = { id: o.id, no: o.no, day: ymd(new Date(o.closedAt || o.createdAt)), at: o.closedAt || o.createdAt, createdAt: o.createdAt, tableNo: o.tableNo, zone: o.zone || "",
      waiterId: o.waiterId, waiterName: o.waiterName, guests: o.guests || 0, pay: o.pay || "naqd", sum, svc: Math.round(sum * (o.serviceRate || 0) / 100),
      cook: o.readyAt ? o.readyAt - (o.startedAt || o.createdAt) : 0, byGuest: !!o.byGuest, items: o.items.map((it) => [it.name + (it.opts ? ` (${it.opts})` : ""), it.qty, it.price]) };
  });
  return Object.values(all).filter((x) => x.at >= from.getTime() && x.at < to.getTime()).sort((a, b) => a.at - b.at);
}

function tabReport(c) {
  store.loadSales();
  const [from, to] = periodRange();
  const list = salesInRange(from, to);
  const oneDay = to - from <= 86400000 + 3600000;
  const revenue = list.reduce((s, x) => s + x.sum + x.svc, 0);
  const svc = list.reduce((s, x) => s + x.svc, 0);
  const guests = list.reduce((s, x) => s + (x.guests || 0), 0);
  const cooks = list.filter((x) => x.cook > 0).map((x) => x.cook);
  const avgCook = cooks.length ? Math.round(cooks.reduce((a, b) => a + b, 0) / cooks.length / 60000) : 0;
  const openNow = Object.values(S.orders).filter((o) => o.status !== "closed");
  const openSum = openNow.reduce((s, o) => s + orderTotal(o), 0);

  // Grafik: bir kun bo'lsa soatlar, aks holda kunlar
  const buckets = [];
  if (oneDay) for (let h = 8; h <= 23; h++) buckets.push({ key: h, label: String(h).padStart(2, "0"), v: 0 });
  else for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) buckets.push({ key: ymd(d), label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`, v: 0 });
  list.forEach((x) => {
    const k = oneDay ? Math.min(23, Math.max(8, new Date(x.at).getHours())) : x.day;
    const b = buckets.find((y) => y.key === k); if (b) b.v += x.sum + x.svc;
  });
  const maxB = Math.max(1, ...buckets.map((b) => b.v));

  const byWaiter = {};
  list.forEach((x) => {
    const k = x.waiterId || "-";
    const w = (byWaiter[k] = byWaiter[k] || { name: x.waiterName || "—", n: 0, sum: 0, svc: 0, guests: 0 });
    w.n++; w.sum += x.sum + x.svc; w.svc += x.svc; w.guests += x.guests || 0;
  });
  const byItem = {};
  list.forEach((x) => x.items.forEach(([n, q, p]) => { const i = (byItem[n] = byItem[n] || { q: 0, sum: 0 }); i.q += q; i.sum += q * p; }));
  const top = Object.entries(byItem).sort((a, b) => b[1].q - a[1].q).slice(0, 10);
  const maxTop = top[0]?.[1].q || 1;
  const pays = {};
  list.forEach((x) => { pays[x.pay] = (pays[x.pay] || 0) + x.sum + x.svc; });
  const payName = { naqd: "💵 Naqd", karta: "💳 Karta", click: "📱 Click/Payme" };
  const fmtD = (d) => d.toLocaleDateString("ru-RU");
  const rangeTxt = oneDay ? fmtD(from) : `${fmtD(from)} — ${fmtD(new Date(to - 1))}`;

  c.innerHTML = `
  <div class="page-head row-between">
    <div><h1>Hisobot</h1><p>${rangeTxt} · ${S.salesLoaded ? "real vaqtda yangilanadi" : "arxiv yuklanmoqda…"}</p></div>
    <div class="head-actions">
      <button class="btn btn-ghost" data-csv="checks" ${list.length ? "" : "disabled"}>⬇ Cheklar (Excel)</button>
      <button class="btn btn-ghost" data-csv="items" ${list.length ? "" : "disabled"}>⬇ Taomlar (Excel)</button>
    </div>
  </div>
  <div class="chips-row period-row">
    ${PERIODS.map(([id, name]) => `<button class="chip ${ui.period === id ? "on" : ""}" data-period="${id}">${name}</button>`).join("")}
    ${ui.period === "custom" ? `<span class="range"><input type="date" id="from" value="${ymd(from)}"> — <input type="date" id="to" value="${ymd(new Date(to - 1))}"></span>` : ""}
  </div>
  <div class="kpis">
    <div class="kpi"><small>Tushum</small><b>${money(revenue, cur())}</b><span class="kpi-sub">xizmat haqi: ${money(svc, cur())}</span></div>
    <div class="kpi"><small>Cheklar</small><b>${list.length}</b><span class="kpi-sub">mehmonlar: ${guests}</span></div>
    <div class="kpi"><small>O'rtacha chek</small><b>${money(list.length ? revenue / list.length : 0, cur())}</b><span class="kpi-sub">1 mehmonga: ${money(guests ? revenue / guests : 0, cur())}</span></div>
    <div class="kpi"><small>O'rtacha tayyorlash</small><b>${avgCook} daq</b><span class="kpi-sub">hozir ochiq: ${openNow.length} ta · ${money(openSum, cur())}</span></div>
  </div>
  <div class="card">
    <h3>${oneDay ? "Soatlar bo'yicha tushum" : "Kunlar bo'yicha tushum"}</h3>
    <div class="chart">${buckets.map((b) => `<div class="col" title="${esc(b.label)}: ${money(b.v, cur())}"><i style="height:${Math.round((b.v / maxB) * 100)}%"></i><small>${esc(b.label)}</small></div>`).join("")}</div>
  </div>
  <div class="cols">
    <div class="card">
      <h3>Ofitsiantlar bo'yicha</h3>
      <table class="tbl"><thead><tr><th>Ofitsiant</th><th>Cheklar</th><th>Mehmon</th><th>Savdo</th><th>Xizmat haqi</th></tr></thead>
      <tbody>${Object.values(byWaiter).sort((a, b) => b.sum - a.sum).map((w) => `<tr><td><b>${esc(w.name)}</b></td><td>${w.n}</td><td>${w.guests}</td><td>${money(w.sum, cur())}</td><td>${money(w.svc, cur())}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Bu davrda yopilgan chek yo'q</td></tr>`}</tbody></table>
      ${Object.keys(pays).length ? `<h3 class="mt">To'lov turlari</h3><div class="pays">${Object.entries(pays).map(([k, v]) => `<span><small>${payName[k] || esc(k)}</small><b>${money(v, cur())}</b></span>`).join("")}</div>` : ""}
    </div>
    <div class="card">
      <h3>Eng ko'p sotilgan taomlar</h3>
      ${top.length ? top.map(([n, i]) => `<div class="bar"><span>${esc(n)}</span><div><i style="width:${(i.q / maxTop) * 100}%"></i></div><b>${i.q}</b></div>`).join("") : `<p class="muted">Ma'lumot yo'q</p>`}
    </div>
  </div>
  <div class="card">
    <h3>Cheklar ro'yxati</h3>
    <table class="tbl"><thead><tr><th>Vaqt</th><th>Chek</th><th>Stol</th><th>Ofitsiant</th><th>Taomlar</th><th>To'lov</th><th>Summa</th></tr></thead>
    <tbody>${list.slice().reverse().slice(0, 100).map((x) => `<tr><td>${oneDay ? clock(x.at) : `${fmtD(new Date(x.at))} ${clock(x.at)}`}</td><td>#${esc(String(x.no || x.id.slice(-4)))}</td><td>${esc(x.tableNo)}</td><td>${esc(x.waiterName || "")}</td><td class="muted">${x.items.reduce((s, i) => s + i[1], 0)} ta</td><td>${payName[x.pay] || esc(x.pay)}</td><td><b>${money(x.sum + x.svc, cur())}</b></td></tr>`).join("") || `<tr><td colspan="7" class="muted">Bo'sh</td></tr>`}</tbody></table>
    ${list.length > 100 ? `<p class="hint">Oxirgi 100 ta ko'rsatildi. To'liq ro'yxat Excel faylida.</p>` : ""}
  </div>`;

  c.querySelectorAll("[data-period]").forEach((b) => b.addEventListener("click", () => { ui.period = b.dataset.period; render(); }));
  c.querySelector("#from")?.addEventListener("change", (e) => { ui.from = e.target.value; render(); });
  c.querySelector("#to")?.addEventListener("change", (e) => { ui.to = e.target.value; render(); });
  c.querySelectorAll("[data-csv]").forEach((b) => b.addEventListener("click", () => {
    const name = `${cfg().restaurant.name.replace(/[^\w\-]+/g, "_")}_${ymd(from)}_${ymd(new Date(to - 1))}`;
    if (b.dataset.csv === "checks") {
      downloadCsv(`${name}_cheklar.csv`, [["Sana", "Vaqt", "Chek", "Stol", "Zona", "Ofitsiant", "Mehmonlar", "Taomlar", "Summa", "Xizmat haqi", "Jami", "To'lov turi"],
        ...list.map((x) => [fmtD(new Date(x.at)), clock(x.at), x.no || x.id, x.tableNo, x.zone, x.waiterName, x.guests, x.items.map(([n, q]) => `${q}x ${n}`).join(", "), x.sum, x.svc, x.sum + x.svc, x.pay])]);
    } else {
      downloadCsv(`${name}_taomlar.csv`, [["Taom", "Soni", "Summa"], ...Object.entries(byItem).sort((a, b) => b[1].sum - a[1].sum).map(([n, i]) => [n, i.q, i.sum])]);
    }
  }));
}

// Excel to'g'ri ochishi uchun: UTF-8 BOM va ";" ajratuvchi
function downloadCsv(filename, rows) {
  // Formulaga o'xshagan katakchalar (=, +, -, @) Excel'da formula bo'lib ishlamasin
  const cell = (v) => { let t = String(v ?? ""); if (/^[=+\-@]/.test(t) && typeof v !== "number") t = "'" + t; return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const csv = "\ufeff" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  saveFile(filename, csv, "text/csv;charset=utf-8");
}

// ---------- Qurilmalar ----------
function tabDevices(c) {
  c.innerHTML = `
  <div class="page-head"><h1>Yangi planshet qo'shish</h1><p>Har bir planshet (ofitsiant, oshxona yoki boshqaruv) Smart Menyu tomonidan tasdiqlanadi.</p></div>
  <div class="card dev-steps">
    <ol>
      <li>Planshetga <b>Smart Menyu</b> ilovasini o'rnating.</li>
      <li>Ilovani oching va restoran kodini kiriting: <b class="code big-code">${esc(rid)}</b></li>
      <li>Planshet ekranida chiqqan <b>planshet kodini</b> Smart Menyu'ga ayting. Tasdiqlangach ilova o'zi ochiladi.</li>
      <li>Planshetda kerakli bo'limni tanlang: <b>Ofitsiant</b>, <b>Oshxona ekrani</b> yoki <b>Boshqaruv</b>.</li>
    </ol>
    <p class="muted">Bu planshet: <b class="code">${esc(ACT.dev ? ACT.dev.id.slice(0, 4) + "-" + ACT.dev.id.slice(4) : "namoyish")}</b>${ACT.lic ? ` · Obuna: <b>${new Date(ACT.watcher?.lic?.until || ACT.lic.until).toLocaleDateString("ru-RU")}</b> gacha` : ""}</p>
  </div>`;
}

store.on((evt) => {
  if (evt.type !== "render") return;
  if (document.querySelector(".modal-back")) return;
  const a = document.activeElement;
  if (a && ["INPUT", "SELECT", "TEXTAREA"].includes(a.tagName)) return;
  if (ui.tab === "report" || evt.type === "render") render();
});

render();
registerSW();
