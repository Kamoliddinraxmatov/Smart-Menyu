// Kalitlarni telefondan qo'yish: Kamoliddin kalitni ofis botiga yuboradi, bot uni serverdagi DATA_DIR/sozlama.json ga
// yozadi (faqat shu serverda, fayl 600 huquqli), xabarni chatdan o'chiradi va ofisni qayta ishga tushiradi.
// Kalit hech qachon AI'ga, logga yoki GitHub'ga ketmaydi. sozlama.json dagi qiymat office.env dagidan ustun.
//
// Bu modul office.mjs da birinchi import qilinadi: boshqa modullar process.env ni o'qishidan oldin kalitlar yuklanadi.
import fs from "node:fs";
import path from "node:path";

const DATA = process.env.DATA_DIR || "/data/office";
const FILE = path.join(DATA, "sozlama.json");

// Kalit turini boshidan taniymiz: Kamoliddin buyruqsiz shunchaki joylasa ham, kalit AI'ga topshiriq bo'lib ketmaydi.
export const SECRET_KEYS = {
  GITHUB_TOKEN: { re: /^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/, label: "GitHub tokeni" },
  GEMINI_API_KEY: { re: /^AIza[0-9A-Za-z_-]{30,}$/, label: "Gemini kaliti" },
  GROQ_API_KEY: { re: /^gsk_[A-Za-z0-9]{20,}$/, label: "Groq kaliti" },
  OPENROUTER_API_KEY: { re: /^sk-or-[A-Za-z0-9_-]{20,}$/, label: "OpenRouter kaliti" }
};
// Kalit bo'lmagan oddiy sozlamalar (/sozlama NOM qiymat).
export const PLAIN_KEYS = {
  LLM_DAILY_LIMIT: { re: /^\d{1,5}$/, label: "Kunlik AI so'rovlari chegarasi" },
  GEMINI_MODEL: { re: /^[a-z0-9.\-]{3,60}$/, label: "Gemini modeli" }
};
// OFFICE_BOT_TOKEN va OWNER_CHAT_ID ataylab yo'q: ular xato yozilsa bot butunlay o'chadi va telefondan tuzatib bo'lmaydi.

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; }
}
for (const [k, v] of Object.entries(read())) if ((SECRET_KEYS[k] || PLAIN_KEYS[k]) && v) process.env[k] = String(v);

// Matn kalitga o'xshaydimi? Ha bo'lsa, uning nomi (masalan GITHUB_TOKEN), aks holda null.
export function detectSecret(text) {
  const t = String(text || "").trim();
  for (const [k, { re }] of Object.entries(SECRET_KEYS)) if (re.test(t)) return k;
  return null;
}
// Xabar ichida biror joyda kalit bormi (topshiriq matniga adashib qo'shilgan bo'lsa ham)?
export function containsSecret(text) {
  return String(text || "").split(/\s+/).some((w) => detectSecret(w));
}

// Tekshiradi va saqlaydi. Natija: { ok, label, error }.
export function saveSetting(name, value) {
  const key = String(name || "").toUpperCase();
  const spec = SECRET_KEYS[key] || PLAIN_KEYS[key];
  const v = String(value || "").trim();
  if (!spec) return { ok: false, error: `«${name}» sozlamasini bot orqali o'zgartirib bo'lmaydi.` };
  if (!spec.re.test(v)) return { ok: false, error: `${spec.label} noto'g'ri ko'rinishda.` };
  const all = read();
  all[key] = v;
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE + ".tmp", JSON.stringify(all), { mode: 0o600 });
  fs.renameSync(FILE + ".tmp", FILE);
  process.env[key] = v;
  return { ok: true, label: spec.label };
}

export function settingLabel(key) {
  return (SECRET_KEYS[key] || PLAIN_KEYS[key] || {}).label || key;
}
