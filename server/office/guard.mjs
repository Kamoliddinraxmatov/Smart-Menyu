// Mijozga ketadigan har bir matn shu tekshiruvdan o'tadi. Bu AI'ga ishonib qo'yilmagan, oddiy kod:
// taqiqlangan va'da yoki ro'yxatda yo'q narx bo'lsa, matn Kamoliddinga ham bormaydi, qayta yoziladi.
// redact() esa AI'ga yuborishdan oldin telefon raqam va emaillarni yashiradi (shaxsiy ma'lumot serverdan chiqmaydi).

// Tasdiqlangan narxlar (so'm). Yangi narx paydo bo'lsa, shu yerga va facts.md ga birga qo'shing.
export const PRICES = [299000, 440000, 599000, 950000, 1100000, 550000, 1050000, 1200000, 300000];

const FORBIDDEN = [
  [/\b14\s*(kun|kunlik|дн|day)/i, "\"14 kun\" va'da qilinmaydi"],
  [/bepul\s+sinov|sinov\s+bepul|tekin\s+sinov/i, "bepul sinov va'da qilinmaydi"],
  [/free\s+trial|trial\s+period/i, "bepul sinov va'da qilinmaydi"],
  [/бесплатн\w*\s+(тест|проб|период)|пробн\w*\s+период/i, "bepul sinov va'da qilinmaydi"],
  [/(chegirma|скидк|discount)[^.\n]{0,40}\d+\s*%|\d+\s*%[^.\n]{0,40}(chegirma|скидк|discount)/i, "AI chegirma taklif qilmaydi"],
  [/\b(fiskal|фискал|fiscal)/i, "fiskal kassa hozir yo'q"],
  [/(chek\s+printer|printer|принтер)/i, "chek printeri hozir yo'q"],
  [/(payme|click)\s*(orqali|bilan)?\s*(to'lov|оплат|payment)/i, "Payme/Click to'lovi hozir yo'q"],
  [/(iiko|r-?keeper|poster)\s*(bilan|integr|интегр)/i, "iiko/R-Keeper/Poster integratsiyasi yo'q"],
  [/kafolat|гарант|guarantee/i, "kafolat berilmaydi"]
];

// "440 000 so'm", "440 ming", "440000 сум" kabi narxlarni topadi.
function prices(text) {
  const out = [];
  const re = /(\d[\d\s.,]*\d|\d)\s*(ming|тыс|k\b)?\s*(so'm|so‘m|сум|sum|uzs)?/gi;
  for (const m of text.matchAll(re)) {
    if (!m[2] && !m[3]) continue;
    let n = Number(m[1].replace(/[\s.,]/g, ""));
    if (m[2]) n *= 1000;
    out.push(n);
  }
  return out;
}

// Matndagi muammolar ro'yxati. Bo'sh ro'yxat = matn toza.
export function check(text) {
  const problems = [];
  for (const [re, why] of FORBIDDEN) if (re.test(text)) problems.push(why);
  for (const n of prices(text)) if (!PRICES.includes(n)) problems.push(`ro'yxatda yo'q narx: ${n.toLocaleString("ru-RU")} so'm`);
  return [...new Set(problems)];
}

export function redact(text) {
  return String(text)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s()-]{7,}\d/g, "[raqam]");
}
