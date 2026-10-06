// Admin panel: restoran brendi, menyu, ofitsiantlar, stollar va hisobot
import { createStore, newId } from "./sync.js";
import {
  getRid, esc, money, fullName, initials, clock, orderTotal, applyBrand, logoHtml, itemVisual,
  toast, modal, confirmBox, connBadge, fileToDataUrl, link, registerSW
} from "./common.js";
import { itemTr, catTr } from "./i18n.js";

const rid = getRid();
const store = createStore(rid);
const S = store.state;
const app = document.getElementById("app");

const ui = { tab: "brand", unlocked: sessionStorage.getItem(`menyu.admin.${rid}`) === "1", catFilter: "all" };
const cfg = () => S.config;
const cur = () => cfg().restaurant.currency || "so'm";

let saveTimer = null;
function save(c = cfg(), msg = "Saqlandi") {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    store.saveConfig(structuredClone(c));
    toast(`✓ ${msg}`, { kind: "ok", timeout: 1500 });
  }, 400);
}
function mutate(fn, msg) {
  const c = structuredClone(cfg());
  fn(c);
  S.config = c;            // darhol ko'rsatish uchun
  save(c, msg);
}

const TABS = [
  ["brand", "🎨", "Restoran"],
  ["menu", "📋", "Menyu"],
  ["waiters", "🧑‍💼", "Ofitsiantlar"],
  ["tables", "🪑", "Stollar"],
  ["report", "📊", "Hisobot"],
  ["devices", "📱", "Qurilmalar"]
];

function render() {
  applyBrand(cfg().restaurant);
  document.title = `${cfg().restaurant.name} · Admin`;
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
          <label class="btn btn-ghost">📷 Logo yuklash<input type="file" accept="image/*" id="logo" hidden></label>
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
    const url = await fileToDataUrl(f, 256, 0.85);
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
          <label class="btn btn-ghost">📷 Rasm yuklash<input type="file" accept="image/*" id="img" hidden></label>
          <button class="btn btn-ghost" id="rmImg" ${it.img ? "" : "hidden"}>Rasmni o'chirish</button>
          <label class="field"><span>Emoji (rasm bo'lmasa)</span><input type="text" id="emoji" value="${esc(it.emoji || "")}" maxlength="4"></label>
        </div>
      </div>
      <label class="field"><span>Nomi</span><input type="text" id="name" value="${esc(it.name)}" placeholder="Masalan: To'y oshi"></label>
      <label class="field"><span>Tavsif</span><input type="text" id="desc" value="${esc(it.desc || "")}"></label>
      <details class="tr-box" ${isNew ? "" : "open"}>
        <summary>🌐 Tarjimalar (mijoz menyuda tilni almashtirsa ko'rinadi)</summary>
        ${[["ru", "Русский"], ["en", "English"]].map(([l, label]) => {
          const tr = itemTr(it, l);
          return `<div class="tr-row"><b>${l.toUpperCase()}</b>
            <input type="text" id="tr-${l}-name" value="${esc(tr.name)}" placeholder="${label}: nomi">
            <input type="text" id="tr-${l}-desc" value="${esc(tr.desc)}" placeholder="${label}: tavsif"></div>`;
        }).join("")}
        <p class="hint">Bo'sh qoldirilsa, o'zbekcha nomi ko'rinadi.</p>
      </details>
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
        const f = e.target.files[0]; if (!f) return;
        it.img = await fileToDataUrl(f, 560, 0.72);
        $("#vis").innerHTML = itemVisual(it, "thumb ie-img"); $("#rmImg").hidden = false;
      });
      $("#rmImg").addEventListener("click", () => { it.img = ""; $("#vis").innerHTML = itemVisual(it, "thumb ie-img"); $("#rmImg").hidden = true; });
      $("#ok").addEventListener("click", () => {
        Object.assign(it, {
          name: $("#name").value.trim(), desc: $("#desc").value.trim(), price: Number($("#price").value) || 0,
          cat: $("#cat").value, time: Number($("#time").value) || 0, weight: $("#weight").value.trim(), emoji: $("#emoji").value.trim(),
          popular: $("#popular").checked, hidden: $("#hidden").checked, fit: $("#fit").checked ? "contain" : ""
        });
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

function catEditor() {
  let cats = structuredClone(cfg().categories);
  const draw = (m) => {
    m.querySelector("#cl").innerHTML = cats.map((x, i) => `
      <div class="cat-card">
        <label class="cat-pic" title="Bo'lim rasmi" style="${x.hero || x.bg ? `background-image:url('${esc(x.hero || x.bg)}')` : ""}">
          ${x.hero || x.bg ? "" : "📷"}<input type="file" accept="image/*" data-pic="${i}" hidden>
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
      const f = inp.files[0]; if (!f) return;
      const x = cats[inp.dataset.pic];
      x.hero = await fileToDataUrl(f, 720, 0.72);
      x.bg = await blurredDataUrl(x.hero);
      draw(m);
    }));
    m.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => { const i = +b.dataset.up; [cats[i - 1], cats[i]] = [cats[i], cats[i - 1]]; draw(m); }));
    m.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      const x = cats[+b.dataset.del];
      if (cfg().items.some((i) => i.cat === x.id)) { toast("Avval bu kategoriyadagi taomlarni boshqasiga o'tkazing", { kind: "error" }); return; }
      cats.splice(+b.dataset.del, 1); draw(m);
    }));
  };
  modal(`
    <div class="modal-head"><h3>Bo'limlar</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-body"><p class="muted small">Rasm bo'lim sarlavhasida va menyu fonida (xira holda) ko'rinadi.</p><div id="cl"></div><button class="btn btn-ghost btn-block" id="addc">+ Bo'lim qo'shish</button></div>
    <div class="modal-actions"><button class="btn btn-primary" id="ok">Saqlash</button></div>`, { wide: true,
    onMount(m, close) {
      draw(m);
      m.querySelector("#addc").addEventListener("click", () => { cats.push({ id: "c" + newId(), name: "Yangi kategoriya", emoji: "🍽️" }); draw(m); });
      m.querySelector("#ok").addEventListener("click", () => { mutate((x) => { x.categories = cats.filter((y) => y.name.trim()); }, "Kategoriyalar saqlandi"); close(); render(); });
    }
  });
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
    <div><h1>Stollar</h1><p>Har bir stolga ofitsiant biriktiring. Shu stoldan tushgan buyurtma avtomatik o'sha ofitsiantga yoziladi va tayyor bo'lganda unga xabar boradi.</p></div>
    <button class="btn btn-primary" id="add">+ Stol qo'shish</button>
  </div>
  <div class="card">
    <table class="tbl">
      <thead><tr><th>Stol</th><th>Joy (zal)</th><th>O'rinlar</th><th>Ofitsiant</th><th></th></tr></thead>
      <tbody>
        ${cfg().tables.map((t, i) => `
          <tr>
            <td><input type="text" data-i="${i}" data-k="no" value="${esc(t.no)}" class="in-no"></td>
            <td><input type="text" data-i="${i}" data-k="zone" value="${esc(t.zone || "")}"></td>
            <td><input type="number" data-i="${i}" data-k="seats" value="${esc(t.seats || "")}" class="in-seats"></td>
            <td><select data-i="${i}" data-k="waiterId"><option value="">— biriktirilmagan —</option>${ws.map((w) => `<option value="${esc(w.id)}" ${w.id === t.waiterId ? "selected" : ""}>${esc(fullName(w))}</option>`).join("")}</select></td>
            <td><button class="icon-btn" data-del="${i}">🗑</button></td>
          </tr>`).join("")}
      </tbody>
    </table>
  </div>`;
  c.querySelectorAll("[data-k]").forEach((inp) => inp.addEventListener("change", () => {
    mutate((x) => { const t = x.tables[+inp.dataset.i]; t[inp.dataset.k] = inp.dataset.k === "seats" ? Number(inp.value) : inp.value; }, "Stol saqlandi");
  }));
  c.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    const t = cfg().tables[+b.dataset.del];
    if (!(await confirmBox(`Stol ${esc(t.no)} o'chirilsinmi?`, "O'chirish", { danger: true }))) return;
    mutate((x) => { x.tables.splice(+b.dataset.del, 1); }, "Stol o'chirildi"); render();
  }));
  c.querySelector("#add").addEventListener("click", () => {
    const nums = cfg().tables.map((t) => parseInt(t.no, 10)).filter((n) => !isNaN(n));
    const last = cfg().tables[cfg().tables.length - 1];
    mutate((x) => { x.tables.push({ id: "t" + newId(), no: String((nums.length ? Math.max(...nums) : 0) + 1), zone: last?.zone || "Zal", seats: 4, waiterId: last?.waiterId || "" }); }, "Stol qo'shildi");
    render();
  });
}

// ---------- Hisobot ----------
function tabReport(c) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = Object.values(S.orders).filter((o) => o.createdAt >= start.getTime());
  const closed = today.filter((o) => o.status === "closed");
  const revenue = closed.reduce((s, o) => s + orderTotal(o), 0);
  const service = closed.reduce((s, o) => s + Math.round(orderTotal(o) * (o.serviceRate || 0) / 100), 0);
  const cookTimes = today.filter((o) => o.readyAt && o.createdAt).map((o) => o.readyAt - o.createdAt);
  const avgCook = cookTimes.length ? Math.round(cookTimes.reduce((a, b) => a + b, 0) / cookTimes.length / 60000) : 0;
  const byWaiter = {};
  today.forEach((o) => {
    const k = o.waiterId || "-";
    byWaiter[k] = byWaiter[k] || { name: o.waiterName || "—", orders: 0, sum: 0, service: 0, tables: new Set() };
    byWaiter[k].orders++;
    byWaiter[k].tables.add(o.tableNo);
    if (o.status === "closed") { byWaiter[k].sum += orderTotal(o); byWaiter[k].service += Math.round(orderTotal(o) * (o.serviceRate || 0) / 100); }
  });
  const byItem = {};
  today.forEach((o) => o.items.forEach((i) => { byItem[i.name] = (byItem[i.name] || 0) + i.qty; }));
  const top = Object.entries(byItem).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxTop = top[0]?.[1] || 1;
  const pays = {};
  closed.forEach((o) => { pays[o.pay || "naqd"] = (pays[o.pay || "naqd"] || 0) + orderTotal(o) * (1 + (o.serviceRate || 0) / 100); });

  c.innerHTML = `
  <div class="page-head"><h1>Bugungi hisobot</h1><p>${new Date().toLocaleDateString("uz-UZ")} · real vaqtda yangilanadi</p></div>
  <div class="kpis">
    <div class="kpi"><small>Tushum (yopilgan)</small><b>${money(revenue + service, cur())}</b></div>
    <div class="kpi"><small>Cheklar</small><b>${today.length}</b></div>
    <div class="kpi"><small>O'rtacha chek</small><b>${money(closed.length ? (revenue + service) / closed.length : 0, cur())}</b></div>
    <div class="kpi"><small>O'rtacha tayyorlash</small><b>${avgCook} daq</b></div>
  </div>
  <div class="cols">
    <div class="card">
      <h3>Ofitsiantlar bo'yicha</h3>
      <table class="tbl"><thead><tr><th>Ofitsiant</th><th>Cheklar</th><th>Stollar</th><th>Savdo</th><th>Xizmat haqi</th></tr></thead>
      <tbody>${Object.values(byWaiter).map((w) => `<tr><td><b>${esc(w.name)}</b></td><td>${w.orders}</td><td>${w.tables.size}</td><td>${money(w.sum, cur())}</td><td>${money(w.service, cur())}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Bugun hali buyurtma yo'q</td></tr>`}</tbody></table>
      ${Object.keys(pays).length ? `<h3>To'lov turlari</h3><div class="pays">${Object.entries(pays).map(([k, v]) => `<span><small>${esc(k)}</small><b>${money(v, cur())}</b></span>`).join("")}</div>` : ""}
    </div>
    <div class="card">
      <h3>Eng ko'p buyurtma qilingan</h3>
      ${top.length ? top.map(([n, q]) => `<div class="bar"><span>${esc(n)}</span><div><i style="width:${(q / maxTop) * 100}%"></i></div><b>${q}</b></div>`).join("") : `<p class="muted">Ma'lumot yo'q</p>`}
    </div>
  </div>`;
}

// ---------- Qurilmalar ----------
function tabDevices(c) {
  const base = location.href.replace(/admin\.html.*$/, "");
  const links = [
    ["🧑‍💼", "Ofitsiant planshetlari", "waiter.html", "Har bir ofitsiant planshetida shu havolani oching va ismini tanlasin."],
    ["👨‍🍳", "Oshxona ekrani", "kitchen.html", "Oshxonadagi planshet yoki televizorda oching."],
    ["⚙️", "Admin panel", "admin.html", "Menyu, narx va stollarni boshqarish."]
  ];
  c.innerHTML = `
  <div class="page-head"><h1>Qurilmalarni ulash</h1><p>Restoran kodi: <b class="code">${esc(rid)}</b>. Barcha qurilmalar shu kod orqali bir-biriga ulanadi.</p></div>
  <div class="dev-grid">
    ${links.map(([ic, name, page, hint]) => {
      const url = base + link(page, rid);
      return `<div class="card dev">
        <div class="dev-ic">${ic}</div><h3>${name}</h3><p class="muted">${hint}</p>
        <img class="qr" alt="QR" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(url)}">
        <div class="url">${esc(url)}</div>
        <div class="dev-actions"><button class="btn btn-ghost" data-copy="${esc(url)}">📋 Nusxa olish</button><a class="btn btn-primary" href="${esc(url)}" target="_blank">Ochish</a></div>
      </div>`;
    }).join("")}
  </div>
  <div class="card danger-zone">
    <h3>Tozalash</h3>
    <p class="muted">Sinov paytida yuborilgan barcha buyurtmalarni o'chiradi (menyu va sozlamalar saqlanib qoladi).</p>
    <button class="btn btn-danger" id="wipe">Barcha buyurtmalarni o'chirish</button>
  </div>`;
  c.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast("Nusxa olindi", { kind: "ok" }); } catch { prompt("Havola:", b.dataset.copy); }
  }));
  c.querySelector("#wipe").addEventListener("click", async () => {
    if (!(await confirmBox("Barcha buyurtmalar o'chirilsinmi?", "O'chirish", { danger: true }))) return;
    Object.keys(S.orders).forEach((id) => store.removeOrder(id));
    toast("Buyurtmalar tozalandi", { kind: "ok" });
  });
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
