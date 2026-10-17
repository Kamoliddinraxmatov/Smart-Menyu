// Ilovani yangilash (faqat planshet ilovasida, oddiy JavaScript ES5 — eski WebView ham tushunadi).
// GitHub'da yangi versiya chiqsa, pastda "Yangi versiya bor" oynasi chiqadi. "Yangilash" bosilsa,
// ilova yangi APK'ni yuklab oladi va Android'ning o'rnatish oynasi ochiladi (u yerda "Yangilash" bosiladi).
(function () {
  var C = window.Capacitor;
  var U = C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Updater;
  if (!U || window.__menyuUpdate) return;
  window.__menyuUpdate = true;

  var LATER = "menyu.updateLater";
  var box = null, info = null, busy = false;

  var st = document.createElement("style");
  st.textContent =
    "#upd{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147482000;width:calc(100% - 32px);max-width:440px;box-sizing:border-box;" +
    "background:#1A1613;color:#F5EFE6;border:1px solid #D6B370;border-radius:18px;padding:16px;font:16px/1.4 system-ui,Roboto,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)}" +
    "#upd b{display:block;font-size:18px;margin:0 0 4px;color:#D6B370}" +
    "#upd p{margin:0 0 12px;color:#C9BFB3}" +
    "#upd .u-row{display:flex;gap:10px}" +
    "#upd button{flex:1;padding:14px;border:0;border-radius:12px;font:700 17px system-ui,sans-serif;background:#D6B370;color:#1A140C}" +
    "#upd button.g{flex:0 0 auto;background:transparent;color:#D6B370;border:2px solid #D6B370}" +
    "#upd .u-bar{height:8px;border-radius:4px;background:rgba(214,179,112,.2);overflow:hidden;margin:4px 0 0}" +
    "#upd .u-bar i{display:block;height:100%;width:0;background:#D6B370}";
  document.head.appendChild(st);

  function later() { try { return +localStorage.getItem(LATER) || 0; } catch (e) { return 0; } }

  function show(html) {
    if (!box) { box = document.createElement("div"); box.id = "upd"; document.body.appendChild(box); }
    box.innerHTML = html;
  }
  function hide() { if (box && box.parentNode) box.parentNode.removeChild(box); box = null; }

  function offer() {
    show('<b>Yangi versiya bor</b><p>Smart Menyu ilovasini yangilang. Restoran ma\'lumotlari o\'chmaydi.</p>' +
      '<div class="u-row"><button id="u-go">Yangilash</button><button class="g" id="u-later">Keyinroq</button></div>');
    document.getElementById("u-go").onclick = install;
    document.getElementById("u-later").onclick = function () {
      try { localStorage.setItem(LATER, String(Date.now() + 6 * 3600e3)); } catch (e) {}
      hide();
    };
  }

  function install() {
    if (busy) return;
    busy = true;
    show('<b>Yuklanmoqda…</b><p id="u-p">0%</p><div class="u-bar"><i id="u-i"></i></div>');
    U.install({ tag: info.tag }).then(function (r) {
      busy = false;
      if (r && r.needPermission) {
        show('<b>Bir marta ruxsat bering</b><p>Ochilgan oynada "Smart Menyu" uchun ruxsatni yoqing, keyin orqaga qaytib "Yangilash" ni bosing.</p>' +
          '<div class="u-row"><button id="u-go">Yangilash</button></div>');
        document.getElementById("u-go").onclick = install;
        return;
      }
      show('<b>O\'rnatish oynasi ochildi</b><p>Unda "Yangilash" (yoki "O\'rnatish") ni bosing.</p>' +
        '<div class="u-row"><button id="u-go">Qayta ochish</button><button class="g" id="u-x">Yopish</button></div>');
      document.getElementById("u-go").onclick = install;
      document.getElementById("u-x").onclick = hide;
    }, function (e) {
      busy = false;
      show('<b>Yuklab bo\'lmadi</b><p>Internetni tekshirib, qayta urinib ko\'ring.</p>' +
        '<div class="u-row"><button id="u-go">Qayta urinish</button><button class="g" id="u-x">Yopish</button></div>');
      document.getElementById("u-go").onclick = install;
      document.getElementById("u-x").onclick = hide;
    });
  }

  try {
    U.addListener("progress", function (d) {
      var p = document.getElementById("u-p"), i = document.getElementById("u-i");
      if (p) p.textContent = d.percent + "%";
      if (i) i.style.width = d.percent + "%";
    });
  } catch (e) {}

  function check() {
    if (busy || box || Date.now() < later()) return;
    U.check().then(function (r) {
      if (r && r.update) { info = r; offer(); }
    }, function () {});
  }

  setTimeout(check, 8000);
  setInterval(check, 3 * 3600e3);
})();
