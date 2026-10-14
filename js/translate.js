// Taom nomlarini tuzatish va tarjima qilish (boshqaruv uchun).
//  - fixUz: o'zbekcha matndagi keng tarqalgan imlo xatolarini tuzatadi (internetsiz ishlaydi)
//  - translate: uch til (uz, ru, en) o'rtasida tarjima (Google Tarjimon, kalit talab qilinmaydi)

// Ko'p uchraydigan xato yozuvlar -> to'g'ri yozuv (kichik harflarda)
const WORDS = {
  goshti: "go'shti", gosht: "go'sht", goshtli: "go'shtli", goshtidan: "go'shtidan", goshtdan: "go'shtdan",
  qoy: "qo'y", qoyi: "qo'y", tayorlangan: "tayyorlangan", tayyorlanga: "tayyorlangan", tayorlanadi: "tayyorlanadi", tayor: "tayyor",
  lagmon: "lag'mon", lagman: "lag'mon", "lag'man": "lag'mon", plov: "palov", osh: "osh", toy: "to'y", "toy oshi": "to'y oshi",
  shashlyk: "shashlik", somsa: "somsa", samsa: "somsa", manti: "manti", chuchvara: "chuchvara", chuchvra: "chuchvara",
  norin: "norin", qozon: "qozon", kabob: "kabob", kabab: "kabob", kebab: "kabob", dimlama: "dimlama", mastava: "mastava",
  shorva: "sho'rva", shurva: "sho'rva", "sho'rba": "sho'rva", moshxurda: "moshxo'rda", moshxorda: "moshxo'rda", "moshxurda": "moshxo'rda",
  tovuq: "tovuq", tovuk: "tovuq", baliq: "baliq", balik: "baliq", guruch: "guruch", noxat: "no'xat", nohat: "no'xat",
  sabzi: "sabzi", piyoz: "piyoz", piez: "piyoz", pomidor: "pomidor", bodring: "bodring", karam: "karam", kok: "ko'k", koklar: "ko'katlar", kokat: "ko'kat", kokatlar: "ko'katlar",
  qaymoq: "qaymoq", kaymoq: "qaymoq", qatiq: "qatiq", katik: "qatiq", suzma: "suzma", sut: "sut", sutli: "sutli", shakar: "shakar", shakarsiz: "shakarsiz",
  muzqaymoq: "muzqaymoq", morojnoe: "muzqaymoq", sharbat: "sharbat", kompot: "kompot", choy: "choy", choi: "choy", kok_choy: "ko'k choy", qora: "qora",
  qahva: "qahva", kofe: "kofe", non: "non", tandir: "tandir", tandirda: "tandirda", issiq: "issiq", isiq: "issiq", sovuq: "sovuq", sovuk: "sovuq",
  salat: "salat", achchiq: "achchiq", achiq: "achchiq", shirin: "shirin", tuzlangan: "tuzlangan", qovurilgan: "qovurilgan", kovurilgan: "qovurilgan",
  pishirilgan: "pishirilgan", qaynatilgan: "qaynatilgan", bugda: "bug'da", bugdoy: "bug'doy", yogli: "yog'li", yog: "yog'", dumba: "dumba",
  mol: "mol", buzoq: "buzoq", qozi: "qo'zi", "qozi go'shti": "qo'zi go'shti", jigar: "jigar", qiyma: "qiyma", kiyma: "qiyma", tuxum: "tuxum", tuhum: "tuxum",
  qovun: "qovun", tarvuz: "tarvuz", uzum: "uzum", olma: "olma", anor: "anor", orik: "o'rik", yongoq: "yong'oq", bodom: "bodom", mayiz: "mayiz",
  porsiya: "porsiya", porcia: "porsiya", portsiya: "porsiya", gramm: "gramm", dona: "dona", bilan: "bilan", va: "va", uchun: "uchun",
  ozbek: "o'zbek", ozbekcha: "o'zbekcha", ozbekiston: "o'zbekiston", toshkent: "toshkent", samarqand: "samarqand", buxoro: "buxoro", fargona: "farg'ona", xorazm: "xorazm",
  gijduvon: "g'ijduvon", "g'ijduvon": "g'ijduvon", kola: "kola", limon: "limon", limonad: "limonad", mineral: "mineral", suv: "suv", gazli: "gazli", gazsiz: "gazsiz"
};
const PROPER = new Set(["o'zbekiston", "toshkent", "samarqand", "buxoro", "farg'ona", "xorazm", "g'ijduvon"]);

export function fixUz(text) {
  let s = String(text || "")
    .replace(/[ʻʼ‘’`´ʹ′]/g, "'")
    .replace(/([OoGg])\s*'\s*/g, "$1'")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,.!?;:])(?=[^\s\d])/g, "$1 ")
    .trim();
  s = s.replace(/[A-Za-z']+/g, (w) => {
    const low = w.toLowerCase();
    let fixed = WORDS[low];
    if (!fixed) return w;
    if (PROPER.has(fixed)) fixed = fixed[0].toUpperCase() + fixed.slice(1);
    // Asl so'z bosh harf bilan yozilgan bo'lsa, saqlaymiz
    return w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;
  });
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

const cache = new Map();
export async function translate(text, to, from = "uz") {
  const q = String(text || "").trim();
  if (!q) return "";
  const k = `${from}>${to}|${q}`;
  if (cache.has(k)) return cache.get(k);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(q)}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    let out = (j?.[0] || []).map((p) => p?.[0] || "").join("").trim();
    if (out) out = out[0].toUpperCase() + out.slice(1);
    cache.set(k, out);
    return out;
  } finally {
    clearTimeout(timer);
  }
}
