// Tariflar va ularda ochiladigan funksiyalar.
//
// Tarifni egasi "Smart Menyu Egasi" ilovasida tanlaydi. U imzolangan ruxsatnoma (lic.plan) bilan planshetga
// keladi, shuning uchun restoran uni o'zi o'zgartira olmaydi. Egasi tarifni o'zgartirsa, yangi ruxsatnoma
// darhol keladi va boshqaruv oynasi o'zi yangilanadi (license.js "menyu-lic" hodisasi).
//
// Yangi funksiya qo'shish: FEATURES ga kalit va eng past tarifni yozing, kodda esa has("kalit", lic) bilan tekshiring.

export const PLANS = [
  { id: "start", name: "Start", tablets: 2, price: 299000 },
  { id: "standart", name: "Standart", tablets: 4, price: 440000 },
  { id: "biznes", name: "Biznes", tablets: 6, price: 599000 },
  { id: "premium", name: "Premium", tablets: 10, price: 950000 }
];

// Funksiya -> u ochiladigan eng past tarif (tarif kartochkalari asosida)
export const FEATURES = {
  // Standart
  reportPeriods: { plan: "standart", name: "Hafta, oy va istalgan sana bo'yicha hisobot" },
  reportExcel: { plan: "standart", name: "Hisobotni Excel'ga yuklab olish" },
  waiterStats: { plan: "standart", name: "Har ofitsiantning savdosi va reytingi" },
  serviceCharge: { plan: "standart", name: "Xizmat haqi avtomatik hisoblanadi" },
  topItems: { plan: "standart", name: "Eng ko'p sotilgan 10 taom" },
  // Biznes
  hourlyChart: { plan: "biznes", name: "Soatlar bo'yicha savdo grafigi" },
  payTypes: { plan: "biznes", name: "To'lov turlari: naqd, karta, Click/Payme" },
  cookTime: { plan: "biznes", name: "Taom tayyorlanish vaqti nazorati" },
  winback: { plan: "biznes", name: "Qayta tashrif: mijozni chegirma bilan qaytarish" },
  // Premium
  winbackAuto: { plan: "premium", name: "Qayta tashrif: kupon tugashidan 3 kun oldin avtomatik yuborish" }
};

const rank = (id) => PLANS.findIndex((p) => p.id === id);
export const planOf = (id) => PLANS.find((p) => p.id === id) || null;

// Restoranning amaldagi tarifi. Tarifi yozilmagan eski ruxsatnoma: hamma funksiya ochiq (avval ishlab turgan
// restoranlardan hech narsa yo'qolmasin, egasi tarifni tanlagach o'zgaradi). Namoyishda ?plan=start bilan ko'rish mumkin.
export function currentPlan(lic, demo = false) {
  if (demo) {
    const q = new URLSearchParams(location.search).get("plan");
    return planOf(q) ? q : "premium";
  }
  return planOf(lic?.plan) ? lic.plan : "premium";
}

export function has(feature, planId) {
  const f = FEATURES[feature];
  if (!f) return true;
  return rank(planId) >= rank(f.plan);
}

// Funksiya ochiladigan tarif nomi: "Biznes"
export const needPlan = (feature) => planOf(FEATURES[feature]?.plan)?.name || "";
