// Eski Android planshetlar (eski WebView, Chrome 55–97) uchun ilova nusxasini yig'adi: js/legacy/<sahifa>.js
// Ishga tushirish: npm i --no-save esbuild@0.24.0 && node tools/build-legacy.mjs
// js/ ichida biror narsa o'zgarsa, shu buyruqni qayta ishga tushirib, natijani commit qiling (CI tekshiradi).
import { build, transform } from "esbuild";
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";

const ENTRIES = ["home", "waiter", "kitchen", "admin"];
// Planshet sahifalariga egasi kalitining faqat ochiq qismi kiradi (shifrlangan maxfiy qism kerak emas)
const { OWNER } = await import("../js/owner-key.js");
const pubOnly = {
  name: "owner-pub-only",
  setup(b) {
    b.onLoad({ filter: /owner-key\.js$/ }, () => ({ contents: `export const OWNER = ${JSON.stringify({ pub: OWNER.pub })};`, loader: "js" }));
  },
};
const TARGET = ["chrome55", "safari11"];
// Eski brauzerda yo'q funksiyalar o'rnini bosuvchilar (structuredClone: ilova faqat oddiy JSON ma'lumotni nusxalaydi)
const POLY = [
  `if(typeof globalThis==="undefined"){window.globalThis=window;}`,
  `if(typeof structuredClone!=="function"){window.structuredClone=function(v){return v===undefined?v:JSON.parse(JSON.stringify(v));};}`,
  `if(!Object.fromEntries){Object.fromEntries=function(it){var o={};Array.from(it).forEach(function(p){o[p[0]]=p[1];});return o;};}`,
  `if(typeof AbortController==="undefined"){window.AbortController=function(){this.signal=undefined;this.abort=function(){};};}`,
].join("\n") + "\n";

mkdirSync("js/legacy", { recursive: true });
for (const name of ENTRIES) {
  // 1) Bitta faylga yig'amiz (yuqori darajadagi await saqlanadi)
  const r = await build({ entryPoints: [`js/${name}.js`], bundle: true, format: "esm", target: "es2022", write: false, charset: "utf8", legalComments: "none", plugins: [pubOnly] });
  // 2) Yig'ilgan fayl hech narsa eksport qilmaydi, shuning uchun uni async funksiyaga o'rash xavfsiz
  const wrapped = `(async () => {\n${r.outputFiles[0].text}\n})().catch((e) => { window.__menyuBootError && window.__menyuBootError(e); });\n`;
  // 3) Eski brauzer tushunadigan sintaksisga o'giramiz
  const t = await transform(wrapped, { loader: "js", format: "iife", target: TARGET, charset: "utf8", minify: true, legalComments: "none" });
  writeFileSync(`js/legacy/${name}.js`, `// Avtomatik yig'ilgan (tools/build-legacy.mjs). Qo'lda o'zgartirmang.\n${POLY}${t.code}`);
  console.log(`js/legacy/${name}.js`, t.code.length);
}

// MQTT kutubxonasi ham yangi sintaksisda: eski nusxasi vendor/legacy/mqtt.min.js
mkdirSync("vendor/legacy", { recursive: true });
const mq = await transform(readFileSync("vendor/mqtt.min.js", "utf8"), { loader: "js", target: TARGET, minify: true, charset: "utf8", legalComments: "none" });
writeFileSync("vendor/legacy/mqtt.min.js", mq.code);
console.log("vendor/legacy/mqtt.min.js", mq.code.length);

// CSS: "inset" kabi yangi xossalarni eski brauzer tushunadigan ko'rinishga o'giramiz: css/legacy/<fayl>.css
mkdirSync("css/legacy", { recursive: true });
for (const f of readdirSync("css").filter((n) => n.endsWith(".css"))) {
  const c = await transform(readFileSync(`css/${f}`, "utf8"), { loader: "css", target: TARGET, charset: "utf8", legalComments: "none" });
  writeFileSync(`css/legacy/${f}`, c.code);
}
console.log("css/legacy/*.css");
