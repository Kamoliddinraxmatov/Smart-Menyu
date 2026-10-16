// Oddiy offline kesh: ilova fayllari internet sekin bo'lsa ham tez ochiladi
const CACHE = "menyu-v69";
const FILES = ["./", "index.html", "waiter.html", "kitchen.html", "admin.html", "css/base.css", "css/waiter.css", "css/kitchen.css", "css/admin.css", "css/home.css",
  "js/common.js", "js/sync.js", "js/defaults.js", "js/i18n.js", "js/waiter.js", "js/kitchen.js", "js/admin.js", "js/home.js", "js/license.js", "js/crypto.js", "js/owner-key.js", "js/translate.js", "js/boot.js", "js/legacy/home.js", "js/legacy/waiter.js", "js/legacy/kitchen.js", "js/legacy/admin.js", "owner.html", "js/owner.js", "css/owner.css", "vendor/mqtt.min.js", "vendor/qrcode.js", "css/lux.css", "img/icon.svg", "img/cloche.png", "img/serve.png", "manifest.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Avval tarmoqdan, bo'lmasa keshdan (yangilanishlar darhol ko'rinadi)
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // cache: "no-cache" — brauzerning 10 daqiqalik HTTP keshini chetlab o'tib, har safar serverdan tekshiradi
  e.respondWith(fetch(new Request(e.request.url, { cache: "no-cache", credentials: "same-origin" })).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
