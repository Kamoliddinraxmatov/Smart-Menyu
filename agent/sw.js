// Agent kalkulyatori: avval keshdan (internetsiz to'liq ishlaydi), orqada yangilanadi
const CACHE = "agent-v2";
const FILES = ["./", "index.html", "app.html", "version.json", "manifest.webmanifest", "logo-192.png", "logo-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("agent-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  const fresh = fetch(new Request(e.request.url, { cache: "no-cache" })).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; });
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fresh));
  e.waitUntil(fresh.catch(() => {}));
});
