// Ilovani ishga tushiruvchi (eski brauzerlar ham tushunadigan oddiy JavaScript, ES5).
// 1) Darhol "Yuklanmoqda" ekranini ko'rsatadi, qora ekran bo'lmaydi.
// 2) Yangi WebView'da js/<sahifa>.js ni, eski WebView'da (Chrome 55–97) js/legacy/<sahifa>.js ni yuklaydi.
// 3) Xato bo'lsa yoki ilova 15 soniyada ochilmasa, sababini va "Qayta urinish" tugmasini ko'rsatadi.
(function () {
  var me = document.currentScript;
  var entry = me && me.getAttribute("data-entry");
  var errs = [];
  var done = false, failed = false, mode = "", fellBack = false;

  var ua = navigator.userAgent;
  var m = ua.match(/Chrome\/(\d+)/);
  var chrome = m ? parseInt(m[1], 10) : 0;
  var android = (ua.match(/Android ([\d.]+)/) || [])[1] || "";

  var st = document.createElement("style");
  st.textContent =
    "#boot{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;background:#0D0B0A;color:#F5EFE6;" +
    "font:16px/1.5 system-ui,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;overflow:auto}" +
    "#boot .b-in{max-width:560px;width:100%;text-align:center}" +
    "#boot .b-logo{width:72px;height:72px;margin:0 auto 14px;border:2px solid #D6B370;border-radius:50%;color:#D6B370;font:700 38px/68px Georgia,serif}" +
    "#boot .b-t{font-size:22px;font-weight:700;margin:0 0 6px}" +
    "#boot .b-s{color:#A69C91;margin:0 0 16px}" +
    "#boot .b-spin{width:34px;height:34px;margin:8px auto;border:3px solid rgba(214,179,112,.25);border-top-color:#D6B370;border-radius:50%;animation:bspin 1s linear infinite}" +
    "@keyframes bspin{to{transform:rotate(360deg)}}" +
    "#boot .b-err{text-align:left;background:#1A1613;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px;margin:14px 0;font:13px/1.45 monospace;color:#F2B8A8;word-break:break-word;white-space:pre-wrap;max-height:40vh;overflow:auto}" +
    "#boot button{display:block;width:100%;margin:10px 0 0;padding:16px;border:0;border-radius:14px;font:700 18px system-ui,sans-serif;background:#D6B370;color:#1A140C}" +
    "#boot button.g{background:transparent;color:#D6B370;border:2px solid #D6B370}";
  document.head.appendChild(st);

  var box = document.createElement("div");
  box.id = "boot";
  document.body.appendChild(box);
  loading();

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"; }); }

  function loading() {
    box.innerHTML = '<div class="b-in"><div class="b-logo">M</div><p class="b-t">Smart Menyu</p><p class="b-s">Yuklanmoqda…</p><div class="b-spin"></div></div>';
  }

  function info() {
    return "Planshet: Android " + (android || "?") + ", WebView Chrome " + (chrome || "?") + ", rejim: " + (mode || "-") + "\nSahifa: " + location.pathname.split("/").pop();
  }

  function fail(title) {
    if (done) return;
    failed = true;
    var old = chrome && chrome < 55;
    var tip = old
      ? "Planshetdagi \"Android System WebView\" juda eski (Chrome " + chrome + "). Play Market'dan \"Android System WebView\" va \"Chrome\" ni yangilang, keyin ilovani qayta oching."
      : "Internet borligini tekshiring va \"Qayta urinish\" ni bosing. Bo'lmasa, shu ekranni rasmga olib yuboring.";
    box.innerHTML = '<div class="b-in"><div class="b-logo">M</div><p class="b-t">' + esc(title || "Ilova ochilmadi") + '</p>' +
      '<p class="b-s">' + esc(tip) + '</p>' +
      '<div class="b-err">' + esc((errs.length ? errs.join("\n") + "\n\n" : "") + info()) + '</div>' +
      '<button id="b-retry">Qayta urinish</button><button class="g" id="b-clean">Tozalab qayta ochish</button></div>';
    document.getElementById("b-retry").onclick = function () { location.reload(); };
    document.getElementById("b-clean").onclick = clean;
  }

  // Eski kesh (service worker) xalaqit bersa: keshni tozalab qayta yuklash. Restoran ma'lumotlari o'chmaydi.
  function clean() {
    var jobs = [];
    try { if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); })); } catch (e) {}
    try { if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })); } catch (e) {}
    Promise.all(jobs).then(go, go);
    function go() { location.reload(); }
  }

  function note(msg) {
    if (errs.length < 8 && errs.indexOf(msg) < 0) errs.push(msg);
    if (failed) fail();
  }

  window.__menyuBootError = function (e) { note("Xato: " + ((e && (e.stack || e.message)) || e)); fail(); };

  window.addEventListener("error", function (e) {
    if (e.target && e.target !== window && e.target.src) { note("Fayl yuklanmadi: " + e.target.src.split("/").slice(-2).join("/")); return; }
    var msg = (e.message || "Xato") + (e.filename ? " (" + e.filename.split("/").pop() + ":" + e.lineno + ")" : "");
    note(msg);
    // Yangi rejimda sintaksis tushunilmasa, eski brauzer nusxasiga o'tamiz (modul umuman ishga tushmagan bo'ladi)
    if (!done && mode === "modern" && !fellBack && /Syntax|Unexpected|unexpected|Invalid|reserved/.test(e.message || "")) { fellBack = true; load("legacy"); }
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    note("Xato: " + ((r && (r.message || r)) || "noma'lum"));
  });

  function add(src, module, then) {
    var s = document.createElement("script");
    if (module) s.type = "module";
    s.src = src;
    s.onload = then || null;
    s.onerror = function () { note("Fayl yuklanmadi: " + src.split("/").slice(-2).join("/")); fail(); };
    document.body.appendChild(s);
  }

  function load(kind) {
    mode = kind;
    if (kind === "modern") { add("js/" + entry + ".js", true); return; }
    // Eski WebView: CSS va MQTT kutubxonasining eski brauzer nusxalari
    var links = document.querySelectorAll('link[rel="stylesheet"][href^="css/"]');
    for (var i = 0; i < links.length; i++) links[i].href = links[i].getAttribute("href").replace(/^css\//, "css/legacy/");
    var start = function () { add("js/legacy/" + entry + ".js", false); };
    if (window.mqtt) start(); else add("vendor/legacy/mqtt.min.js", false, start);
  }

  // Ilova chizildimi: asosiy oyna to'ldi yoki faollashtirish ekrani chiqdi
  function rendered() {
    var app = document.getElementById("app");
    return (app && app.children.length > 0) || document.getElementById("lic-screen");
  }
  var started = Date.now();
  var timer = setInterval(function () {
    if (rendered()) {
      done = true; clearInterval(timer);
      if (box.parentNode) box.parentNode.removeChild(box);
      return;
    }
    if (!failed && Date.now() - started > 15000) fail("Ilova ochilmadi");
  }, 200);

  var q = location.search;
  var modern = typeof window.structuredClone === "function" && "noModule" in HTMLScriptElement.prototype && !/[?&]legacy=1/.test(q);

  // Yengil rejim: kuchsiz planshetda shaffof xira (blur) effektlar va soyalar o'chadi, menyu silliq suriladi.
  // ?lite=1 yoki ?lite=0 bilan qo'lda yoqish/o'chirish mumkin (eslab qoladi).
  var lite = !modern || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  var lq = q.match(/[?&]lite=([01])/);
  try {
    if (lq) localStorage.setItem("menyu.lite", lq[1]);
    var saved = localStorage.getItem("menyu.lite");
    if (saved === "1") lite = true; else if (saved === "0") lite = false;
  } catch (e) {}
  if (lite) document.documentElement.className += " lite";

  load(modern ? "modern" : "legacy");
})();
