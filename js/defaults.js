// Yangi restoran uchun boshlang'ich (demo) sozlamalar.
// Admin panelda o'zgartirilgan sozlamalar realtime kanal orqali barcha qurilmalarga tarqaladi.
export const DEFAULT_CONFIG = {
  v: 1,
  updatedAt: 0,
  restaurant: {
    name: "Demo Restoran",
    slogan: "Milliy taomlar, samimiy xizmat",
    logo: "",
    color: "#B4232A",
    currency: "so'm",
    service: 10,
    address: "Toshkent sh., Amir Temur ko'chasi, 1",
    phone: "+998 90 123 45 67"
  },
  categories: [
    { id: "milliy", name: "Milliy taomlar", emoji: "🍲" },
    { id: "kabob", name: "Kaboblar", emoji: "🍢" },
    { id: "salat", name: "Salatlar", emoji: "🥗" },
    { id: "shorva", name: "Sho'rvalar", emoji: "🥣" },
    { id: "non", name: "Non va pishiriqlar", emoji: "🫓" },
    { id: "ichimlik", name: "Ichimliklar", emoji: "🫖" },
    { id: "shirinlik", name: "Shirinliklar", emoji: "🍰" }
  ],
  items: [
    { id: "i1", cat: "milliy", name: "To'y oshi", desc: "Devzira guruch, qo'y go'shti, sariq sabzi, no'xat va mayiz.", price: 45000, emoji: "🍛", img: "", popular: true, time: 10 },
    { id: "i2", cat: "milliy", name: "Manti", desc: "Bug'da pishirilgan, qo'y go'shti va piyozli. 5 dona.", price: 35000, emoji: "🥟", img: "", time: 20 },
    { id: "i3", cat: "milliy", name: "Lag'mon", desc: "Qo'lda cho'zilgan xamir, mol go'shti, sabzavotlar.", price: 38000, emoji: "🍜", img: "", popular: true, time: 15 },
    { id: "i4", cat: "milliy", name: "Dimlama", desc: "Go'sht, kartoshka, karam va sabzavotlar o'z bug'ida.", price: 42000, emoji: "🥘", img: "", time: 25 },
    { id: "i5", cat: "milliy", name: "Qozon kabob", desc: "Qozonda qovurilgan qo'y go'shti va kartoshka.", price: 55000, emoji: "🍖", img: "", time: 25 },
    { id: "i6", cat: "kabob", name: "Qiyma kabob", desc: "Mol va qo'y go'shti qiymasi. 1 six.", price: 18000, emoji: "🍢", img: "", popular: true, time: 15 },
    { id: "i7", cat: "kabob", name: "Jigar kabob", desc: "Qo'y jigari va dumba. 1 six.", price: 16000, emoji: "🍢", img: "", time: 15 },
    { id: "i8", cat: "kabob", name: "Tovuq kabob", desc: "Marinadlangan tovuq go'shti. 1 six.", price: 17000, emoji: "🍗", img: "", time: 15 },
    { id: "i9", cat: "salat", name: "Achchiq-chuchuk", desc: "Pomidor, piyoz, achchiq qalampir va rayhon.", price: 15000, emoji: "🍅", img: "", time: 5 },
    { id: "i10", cat: "salat", name: "Toshkent salati", desc: "Turp, mol go'shti, tuxum va qovurilgan piyoz.", price: 28000, emoji: "🥗", img: "", time: 8 },
    { id: "i11", cat: "shorva", name: "Sho'rva", desc: "Qo'y go'shti, kartoshka, sabzi va ko'katlar.", price: 32000, emoji: "🥣", img: "", time: 10 },
    { id: "i12", cat: "shorva", name: "Mastava", desc: "Guruchli sho'rva, qatiq bilan tortiladi.", price: 30000, emoji: "🍲", img: "", time: 10 },
    { id: "i13", cat: "non", name: "Tandir non", desc: "Issiq, tandirdan yangi uzilgan.", price: 5000, emoji: "🫓", img: "", time: 2 },
    { id: "i14", cat: "non", name: "Somsa", desc: "Tandirda pishgan, go'shtli. 1 dona.", price: 9000, emoji: "🥐", img: "", popular: true, time: 5 },
    { id: "i15", cat: "ichimlik", name: "Ko'k choy", desc: "Choynakda, 1 litr.", price: 8000, emoji: "🫖", img: "", time: 2 },
    { id: "i16", cat: "ichimlik", name: "Limonli qora choy", desc: "Choynakda, 1 litr.", price: 12000, emoji: "🍋", img: "", time: 2 },
    { id: "i17", cat: "ichimlik", name: "Kompot", desc: "Uy kompoti, 1 litr.", price: 15000, emoji: "🥤", img: "", time: 1 },
    { id: "i18", cat: "shirinlik", name: "Chak-chak", desc: "Asal va yong'oq bilan.", price: 20000, emoji: "🍯", img: "", time: 2 },
    { id: "i19", cat: "shirinlik", name: "Napoleon", desc: "Qatlamli tort, 1 bo'lak.", price: 22000, emoji: "🍰", img: "", time: 2 }
  ],
  waiters: [
    { id: "w1", first: "Aziz", last: "Karimov", pin: "1111" },
    { id: "w2", first: "Dilnoza", last: "Rahimova", pin: "2222" },
    { id: "w3", first: "Jasur", last: "Toshmatov", pin: "3333" }
  ],
  tables: [
    { id: "t1", no: "1", zone: "Zal", seats: 4, waiterId: "w1" },
    { id: "t2", no: "2", zone: "Zal", seats: 4, waiterId: "w1" },
    { id: "t3", no: "3", zone: "Zal", seats: 6, waiterId: "w1" },
    { id: "t4", no: "4", zone: "Zal", seats: 4, waiterId: "w2" },
    { id: "t5", no: "5", zone: "Zal", seats: 2, waiterId: "w2" },
    { id: "t6", no: "6", zone: "Zal", seats: 8, waiterId: "w2" },
    { id: "t7", no: "7", zone: "Ayvon", seats: 6, waiterId: "w3" },
    { id: "t8", no: "8", zone: "Ayvon", seats: 6, waiterId: "w3" },
    { id: "t9", no: "VIP-1", zone: "VIP xona", seats: 12, waiterId: "w3" }
  ],
  kitchenPin: ""
};
