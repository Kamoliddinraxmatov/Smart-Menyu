// Umumiy yordamchi funksiyalar: format, brend ranglari, ovoz, bildirishnomalar.

export function getRid() {
  const p = new URLSearchParams(location.search);
  let rid = (p.get("r") || "").trim();
  if (!rid) { try { rid = localStorage.getItem("menyu.rid") || ""; } catch {} }
  rid = (rid || "demo").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "demo";
  try { localStorage.setItem("menyu.rid", rid); } catch {}
  return rid;
}

export function link(page, rid) {
  return `${page}?r=${encodeURIComponent(rid)}`;
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function money(n, cur = "so'm") {
  return `${Math.round(n || 0).toLocaleString("ru-RU").replace(/,/g, " ")} ${cur}`;
}

export function fullName(w) {
  return w ? `${w.first || ""} ${w.last || ""}`.trim() : "";
}

export function initials(w) {
  return w ? `${(w.first || "?")[0] || ""}${(w.last || "")[0] || ""}`.toUpperCase() : "?";
}

export function mins(ms) {
  return Math.max(0, Math.floor(ms / 60000));
}

export function ago(ts) {
  const m = mins(Date.now() - ts);
  if (m < 1) return "hozir";
  if (m < 60) return `${m} daq`;
  return `${Math.floor(m / 60)} soat ${m % 60} daq`;
}

export function clock(ts = Date.now()) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function shortNo(order) {
  return (order.no || order.id.slice(-4)).toString().toUpperCase();
}

export function orderTotal(order) {
  return (order.items || []).reduce((s, it) => s + it.price * it.qty, 0);
}

// Hex rangni ochroq/to'qroq qilish
function shade(hex, amt) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const n = parseInt(c, 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function applyBrand(restaurant) {
  const color = /^#[0-9a-f]{3,6}$/i.test(restaurant?.color || "") ? restaurant.color : "#B4232A";
  const root = document.documentElement.style;
  root.setProperty("--brand", color);
  root.setProperty("--brand-dark", shade(color, -0.25));
  root.setProperty("--brand-soft", shade(color, 0.88));
  root.setProperty("--brand-mid", shade(color, 0.6));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = color;
}

export function logoHtml(restaurant, cls = "logo") {
  if (restaurant?.logo) return `<img class="${cls}" src="${esc(restaurant.logo)}" alt="">`;
  const letter = (restaurant?.name || "M").trim()[0] || "M";
  return `<span class="${cls} logo-letter">${esc(letter.toUpperCase())}</span>`;
}

export function itemVisual(item, cls = "thumb") {
  if (item.img) return `<div class="${cls}" style="background-image:url('${esc(item.img)}')"></div>`;
  return `<div class="${cls} thumb-emoji"><span>${esc(item.emoji || "🍽️")}</span></div>`;
}

// --- Ovoz (Web Audio) ---
let audioCtx = null;
export function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch {}
}
export function chime(kind = "new") {
  if (!audioCtx) return;
  const notes = kind === "ready" ? [784, 988, 1319] : kind === "error" ? [300, 200] : [660, 880, 660, 880];
  const step = kind === "ready" ? 0.16 : 0.12;
  const t0 = audioCtx.currentTime;
  notes.forEach((f, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + i * step);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + i * step + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * step + step * 1.6);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0 + i * step);
    o.stop(t0 + i * step + step * 1.8);
  });
}

export function vibrate(pattern = [200, 100, 200]) {
  try { navigator.vibrate?.(pattern); } catch {}
}

// Ekran o'chib qolmasligi uchun (planshet va oshxona ekrani)
let wakeLock = null;
export async function keepAwake() {
  try {
    if ("wakeLock" in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    }
  } catch {}
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && wakeLock === null) keepAwake(); });

// --- Toast xabarlar ---
export function toast(html, { kind = "info", timeout = 3500, onClick } = {}) {
  let wrap = document.getElementById("toasts");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toasts";
    document.body.appendChild(wrap);
  }
  const t = document.createElement("div");
  t.className = `toast toast-${kind}`;
  t.innerHTML = html;
  if (onClick) { t.style.cursor = "pointer"; t.addEventListener("click", () => { onClick(); t.remove(); }); }
  wrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  if (timeout) setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, timeout);
  return t;
}

// --- Modal oyna ---
export function modal(html, { onMount, wide = false, closable = true } = {}) {
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal ${wide ? "modal-wide" : ""}" role="dialog">${html}</div>`;
  document.body.appendChild(back);
  requestAnimationFrame(() => back.classList.add("show"));
  const close = () => { back.classList.remove("show"); setTimeout(() => back.remove(), 200); };
  if (closable) back.addEventListener("click", (e) => { if (e.target === back) close(); });
  back.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  onMount?.(back.querySelector(".modal"), close);
  return close;
}

export function confirmBox(text, okText = "Ha", { danger = false } = {}) {
  return new Promise((resolve) => {
    modal(`
      <div class="modal-body"><p class="confirm-text">${text}</p></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close>Bekor qilish</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${okText}</button>
      </div>`, {
      onMount(m, close) {
        m.querySelector("[data-ok]").addEventListener("click", () => { resolve(true); close(); });
        m.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => resolve(false)));
      }
    });
  });
}

export function connBadge(online) {
  return `<span class="conn ${online ? "on" : "off"}" title="${online ? "Ulangan" : "Aloqa yo'q, qayta ulanmoqda"}"><i></i>${online ? "Onlayn" : "Aloqa yo'q"}</span>`;
}

// Rasmni kichraytirib dataURL qilish (logo va taom rasmlari uchun)
export function fileToDataUrl(file, max = 360, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const png = file.type === "image/png" || file.type === "image/svg+xml";
      resolve(c.toDataURL(png ? "image/png" : "image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function registerSW() {
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
