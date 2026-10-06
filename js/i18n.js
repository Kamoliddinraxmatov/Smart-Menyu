// Mijozga ko'rinadigan menyu uchun uch til: o'zbek, rus, ingliz.
// Oshxona va ofitsiant ichki ekranlari o'zbek tilida qoladi: oshxonaga taom nomi doim o'zbekcha boradi.

export const LANGS = [
  { id: "uz", label: "O'zbek", short: "UZ" },
  { id: "ru", label: "Русский", short: "RU" },
  { id: "en", label: "English", short: "EN" }
];

const STR = {
  cur: { uz: "so'm", ru: "сум", en: "UZS" },
  all: { uz: "Hammasi", ru: "Все", en: "All" },
  popular: { uz: "Mashhur", ru: "Популярное", en: "Popular" },
  popularTitle: { uz: "Mashhur taomlar", ru: "Популярные блюда", en: "Popular dishes" },
  popularTag: { uz: "mehmonlarimiz tanlovi", ru: "выбор наших гостей", en: "our guests' choice" },
  dishes: { uz: "ta taom", ru: "блюд", en: "dishes" },
  search: { uz: "Taom qidirish…", ru: "Поиск блюда…", en: "Search dishes…" },
  searchRes: { uz: "qidiruv natijalari", ru: "результаты поиска", en: "search results" },
  notFound: { uz: "Hech narsa topilmadi", ru: "Ничего не найдено", en: "Nothing found" },
  soldOut: { uz: "Tugagan", ru: "Нет в наличии", en: "Sold out" },
  soldOutMsg: { uz: "hozircha tugagan", ru: "временно нет в наличии", en: "is sold out for now" },
  menu: { uz: "Menyu", ru: "Меню", en: "Menu" },
  yourWaiter: { uz: "Ofitsiantingiz", ru: "Ваш официант", en: "Your waiter" },
  welcome: { uz: "Xush kelibsiz!", ru: "Добро пожаловать!", en: "Welcome!" },
  table: { uz: "Stol", ru: "Стол", en: "Table" },
  callWaiter: { uz: "🙋 Ofitsiantni chaqirish", ru: "🙋 Позвать официанта", en: "🙋 Call waiter" },
  waiterComing: { uz: "✓ Ofitsiant kelmoqda", ru: "✓ Официант идёт", en: "✓ Waiter is coming" },
  askBill: { uz: "🧾 Hisobni so'rash", ru: "🧾 Попросить счёт", en: "🧾 Ask for the bill" },
  billComing: { uz: "✓ Hisob olib kelinmoqda", ru: "✓ Счёт несут", en: "✓ Bill is on its way" },
  called: { uz: "✓ Ofitsiant chaqirildi. Hozir keladi.", ru: "✓ Официант вызван. Сейчас подойдёт.", en: "✓ Your waiter has been called." },
  billAsked: { uz: "✓ Hisob so'raldi. Ofitsiant hozir olib keladi.", ru: "✓ Счёт запрошен. Официант сейчас принесёт.", en: "✓ Bill requested. Your waiter will bring it." },
  callCancelled: { uz: "Chaqiruv bekor qilindi", ru: "Вызов отменён", en: "Call cancelled" },
  cart: { uz: "Savatingiz", ru: "Ваш заказ", en: "Your order" },
  emptyCart: { uz: "Menyudan taom tanlang", ru: "Выберите блюда из меню", en: "Choose dishes from the menu" },
  yourOrders: { uz: "Buyurtmalaringiz", ru: "Ваши заказы", en: "Your orders" },
  newOrder: { uz: "Yangi buyurtma", ru: "Новый заказ", en: "New order" },
  tableBill: { uz: "Stol hisobi", ru: "Счёт стола", en: "Table total" },
  placeOrder: { uz: "Buyurtma berish →", ru: "Заказать →", en: "Place order →" },
  view: { uz: "Ko'rish →", ru: "Открыть →", en: "View →" },
  pcs: { uz: "ta", ru: "шт", en: "pcs" },
  confirmTitle: { uz: "Buyurtmangiz", ru: "Ваш заказ", en: "Your order" },
  wishes: { uz: "Istaklaringiz (ixtiyoriy)", ru: "Пожелания (необязательно)", en: "Special requests (optional)" },
  wishesPh: { uz: "Masalan: taomlarni birga olib keling", ru: "Например: подать всё вместе", en: "E.g. serve everything together" },
  total: { uz: "Jami", ru: "Итого", en: "Total" },
  moreChoose: { uz: "Yana tanlash", ru: "Выбрать ещё", en: "Keep browsing" },
  send: { uz: "Buyurtma berish ✓", ru: "Заказать ✓", en: "Place order ✓" },
  sent: { uz: "✓ Buyurtmangiz oshxonaga yuborildi. Yoqimli ishtaha!", ru: "✓ Заказ отправлен на кухню. Приятного аппетита!", en: "✓ Your order is in the kitchen. Enjoy your meal!" },
  ready: { uz: "✓ Buyurtmangiz tayyor, hozir olib kelinadi!", ru: "✓ Ваш заказ готов, сейчас принесут!", en: "✓ Your order is ready and on its way!" },
  noteForChef: { uz: "Izoh oshpaz uchun", ru: "Комментарий для повара", en: "Note for the chef" },
  otherNote: { uz: "Boshqa izoh…", ru: "Другой комментарий…", en: "Other note…" },
  toCart: { uz: "Savatga", ru: "В заказ", en: "Add" },
  min: { uz: "daq", ru: "мин", en: "min" },
  st_new: { uz: "Qabul qilindi", ru: "Принят", en: "Received" },
  st_cooking: { uz: "Tayyorlanmoqda", ru: "Готовится", en: "Cooking" },
  st_ready: { uz: "Tayyor ✓", ru: "Готов ✓", en: "Ready ✓" },
  st_served: { uz: "Berildi", ru: "Подан", en: "Served" },
  options: { uz: "Tanlang", ru: "Выберите", en: "Choose" },
  extras: { uz: "Qo'shimchalar", ru: "Добавки", en: "Extras" },
  waiterMode: { uz: "🔒 Ofitsiant rejimi", ru: "🔒 Режим официанта", en: "🔒 Waiter mode" },
  waiterPin: { uz: "Bu tugma ofitsiant uchun. PIN-kodni kiriting.", ru: "Эта кнопка для официанта. Введите PIN-код.", en: "This button is for staff. Enter the PIN." }
};

// Tezkor izohlar: oshxonaga o'zbekcha boradi, mijozga o'z tilida ko'rinadi
const NOTES = {
  "Achchiq": { ru: "Острое", en: "Spicy" },
  "Achchiq emas": { ru: "Не острое", en: "Not spicy" },
  "Piyozsiz": { ru: "Без лука", en: "No onion" },
  "Ko'katsiz": { ru: "Без зелени", en: "No herbs" },
  "Tuzi kam": { ru: "Меньше соли", en: "Less salt" },
  "Tezroq": { ru: "Побыстрее", en: "Quicker please" },
  "Bolalar uchun": { ru: "Для ребёнка", en: "For a child" },
  "Olib ketish": { ru: "С собой", en: "To go" }
};

// Demo menyu tarjimalari (restoran o'zgartirmagan bo'lsa ishlatiladi)
const CAT_TR = {
  hot: { ru: ["Горячие блюда", "с огня прямо к столу"], en: ["Hot dishes", "straight from the grill"] },
  milliy: { ru: ["Национальная кухня", "традиционная узбекская кухня"], en: ["Uzbek classics", "traditional Uzbek cuisine"] },
  pasta: { ru: ["Ризотто и паста", "в итальянском духе"], en: ["Risotto & pasta", "in the Italian spirit"] },
  salad: { ru: ["Салаты", "лёгкие и свежие"], en: ["Salads", "light and fresh"] },
  sushi: { ru: ["Суши и роллы", "японская традиция"], en: ["Sushi & rolls", "Japanese tradition"] },
  ramen: { ru: ["Рамен", "горячо и сытно"], en: ["Ramen", "warm and hearty"] },
  dessert: { ru: ["Десерты", "сладкий финал"], en: ["Desserts", "a sweet finish"] },
  cocktail: { ru: ["Коктейли", "для вечернего настроения"], en: ["Cocktails", "for the evening mood"] },
  wine: { ru: ["Вина", "с виноградников Италии"], en: ["Wines", "from Italian vineyards"] },
  drinks: { ru: ["Чай и напитки", "прохладные и тёплые"], en: ["Tea & drinks", "cool and warm"] }
};

const ITEM_TR = {
  h1: { ru: ["Стейк из говядины", "Стейк на гриле с овощами и соусом из чёрного перца."], en: ["Beef steak", "Grilled steak with vegetables and black pepper sauce."] },
  h2: { ru: ["Каре ягнёнка", "Каре ягнёнка на гриле, печёный чеснок и овощи гриль."], en: ["Rack of lamb", "Grilled rack of lamb, roasted garlic and grilled vegetables."] },
  h3: { ru: ["Филе-миньон", "Говяжья вырезка, соус роти и картофель по-деревенски."], en: ["Filet mignon", "Beef tenderloin, roti sauce and rustic potatoes."] },
  h4: { ru: ["Лосось на гриле", "Филе лосося, овощи на сливочном масле и лимонный рис."], en: ["Grilled salmon", "Salmon fillet, buttered vegetables and lemon rice."] },
  h5: { ru: ["Запечённый лосось", "Лосось в корочке из специй со свежей зеленью."], en: ["Baked salmon", "Spice-crusted salmon with fresh greens."] },
  h6: { ru: ["Курица гриль", "Маринованная курица, картофель фри, коул-слоу и соус."], en: ["Grilled chicken", "Marinated chicken, fries, coleslaw and brown sauce."] },
  h7: { ru: ["Куриная отбивная", "Хрустящая курица, картофель фри и коул-слоу."], en: ["Chicken chop", "Crispy chicken, fries and coleslaw."] },
  h8: { ru: ["Курица пармиджана", "Хрустящая курица под сыром, фри и салат."], en: ["Chicken parmigiana", "Crispy chicken baked under cheese, fries and salad."] },
  h9: { ru: ["Куриный рулет с рикоттой", "Куриная грудка с рикоттой и картофельное пюре."], en: ["Ricotta chicken roll", "Chicken breast stuffed with ricotta, mashed potatoes."] },
  i1: { ru: ["Свадебный плов", "Рис девзира, баранина, жёлтая морковь, нут и изюм."], en: ["Wedding plov", "Devzira rice, lamb, yellow carrots, chickpeas and raisins."] },
  m1: { ru: ["Жаркое из телятины", "Телятина с тушёными овощами и зеленью."], en: ["Veal stew", "Veal with braised vegetables and herbs."] },
  i3: { ru: ["Лагман", "Тянутая вручную лапша, говядина и овощи."], en: ["Lagman", "Hand-pulled noodles, beef and vegetables."] },
  i2: { ru: ["Манты", "На пару, с бараниной и луком. 5 шт."], en: ["Manti", "Steamed dumplings with lamb and onion. 5 pcs."] },
  i14: { ru: ["Самса", "Из тандыра, с мясом. 1 шт."], en: ["Samsa", "Tandoor-baked meat pastry. 1 pc."] },
  p1: { ru: ["Ризотто с грибами", "Рис арборио, свежие грибы, белое вино и пармезан."], en: ["Mushroom risotto", "Arborio rice, fresh mushrooms, white wine and parmesan."] },
  p2: { ru: ["Ньокки", "Домашние ньокки, сливочный соус и мускатный орех."], en: ["Gnocchi", "Homemade gnocchi, cream sauce and nutmeg."] },
  p3: { ru: ["Лазанья с баклажаном", "Баклажан, домашний соус и сыр бри."], en: ["Eggplant lasagna", "Eggplant, house sauce and brie."] },
  s1: { ru: ["Сунономо", "Огурец с кунжутом, кисло-сладкий соус."], en: ["Sunomono", "Sesame cucumber, sweet and sour dressing."] },
  s2: { ru: ["Весенний салат", "Свежие овощи, руккола и лимонное оливковое масло."], en: ["Spring salad", "Fresh vegetables, arugula and lemon olive oil."] },
  s3: { ru: ["Салат от шефа", "Сезонные овощи и фирменный соус."], en: ["Chef's salad", "Seasonal vegetables and signature dressing."] },
  u1: { ru: ["Блэк ролл", "Рис, нори, сливочный сыр, угорь, огурец, чёрная икра."], en: ["Black roll", "Rice, nori, cream cheese, eel, cucumber, black caviar."] },
  u2: { ru: ["Эби краб", "Креветка в панко, снежный краб, зелёный лук, острый соус."], en: ["Ebi crab", "Panko shrimp, snow crab, green onion, spicy sauce."] },
  u3: { ru: ["Филадельфия с авокадо", "Рис, нори, сливочный сыр, лосось, авокадо, огурец."], en: ["Philadelphia with avocado", "Rice, nori, cream cheese, salmon, avocado, cucumber."] },
  u4: { ru: ["Нигири с лососем", "Совершенство в простоте. 2 шт."], en: ["Salmon nigiri", "Perfection in simplicity. 2 pcs."] },
  u5: { ru: ["Нигири с тунцом", "Тунец, зелёный лук и лимон. 2 шт."], en: ["Tuna nigiri", "Tuna, green onion and lemon. 2 pcs."] },
  u6: { ru: ["Сет Йокогама", "Ассорти нигири от шефа. 8 шт."], en: ["Yokohama set", "Chef's nigiri selection. 8 pcs."] },
  r1: { ru: ["Шою рамен", "Говяжий бульон, яйцо и зелень."], en: ["Shoyu ramen", "Beef broth, egg and greens."] },
  r2: { ru: ["Мисо рамен", "Бульон мисо, мясо, яйцо и бамбук."], en: ["Miso ramen", "Miso broth, meat, egg and bamboo."] },
  r3: { ru: ["Рамен с курицей", "Куриный бульон, зелёный лук и кунжут."], en: ["Chicken ramen", "Chicken broth, green onion and sesame."] },
  d1: { ru: ["Шоколадный торт", "Слоёный шоколад, орехи и малиновый соус."], en: ["Chocolate cake", "Layered chocolate, nuts and raspberry sauce."] },
  d2: { ru: ["Малиновая гранита", "Топлёное молоко, грейпфрут и корица."], en: ["Raspberry granita", "Baked milk, grapefruit and cinnamon."] },
  i18: { ru: ["Чак-чак", "С мёдом и орехами."], en: ["Chak-chak", "With honey and nuts."] },
  c1: { ru: ["Негрони", "Джин, красный вермут и биттер. Классика."], en: ["Negroni", "Gin, red vermouth and bitter. A classic."] },
  c2: { ru: ["Апероль Шприц", "Апероль, просекко и содовая с долькой апельсина."], en: ["Aperol Spritz", "Aperol, prosecco and soda with an orange slice."] },
  c3: { ru: ["Маргарита", "Текила, апельсиновый ликёр и сок лайма."], en: ["Margarita", "Tequila, orange liqueur and lime juice."] },
  c4: { ru: ["Олд Фэшн", "Бурбон, биттер, слива и эстрагон."], en: ["Old Fashioned", "Bourbon, bitters, plum and tarragon."] },
  c5: { ru: ["Мохито", "Ром, мята, лайм и содовая. Есть безалкогольный."], en: ["Mojito", "Rum, mint, lime and soda. Alcohol-free on request."] },
  w1: { ru: ["Вальполичелла Классико", "Красное сухое, Италия. Корвина, Рондинелла. 13,4%."], en: ["Valpolicella Classico", "Dry red, Italy. Corvina, Rondinella. 13.4%."] },
  w2: { ru: ["Амароне делла Вальполичелла", "Красное сухое, Италия. К дичи и сырам. 15,8%."], en: ["Amarone della Valpolicella", "Dry red, Italy. Pairs with game and cheese. 15.8%."] },
  w3: { ru: ["Красное вино, бокал", "Вино дня от сомелье."], en: ["Red wine, glass", "Sommelier's wine of the day."] },
  w4: { ru: ["Белое вино, бокал", "Охлаждённое белое сухое."], en: ["White wine, glass", "Chilled dry white."] },
  i15: { ru: ["Зелёный чай", "Чайник, 1 литр."], en: ["Green tea", "Teapot, 1 litre."] },
  i16: { ru: ["Чёрный чай с лимоном", "Чайник, 1 литр."], en: ["Black tea with lemon", "Teapot, 1 litre."] },
  i17: { ru: ["Компот", "Домашний компот, 1 литр."], en: ["Kompot", "Homemade fruit drink, 1 litre."] }
};

// Demo tarjimasi faqat restoran o'sha taomni o'zgartirmagan bo'lsa ishlatiladi (o'zbekcha nomi demo bilan bir xil)
import { DEFAULT_CONFIG } from "./defaults.js";
const DEF_ITEMS = Object.fromEntries(DEFAULT_CONFIG.items.map((i) => [i.id, i]));
const DEF_CATS = Object.fromEntries(DEFAULT_CONFIG.categories.map((c) => [c.id, c]));

let lang = "uz";
export function getLang() { return lang; }
export function setLang(l) {
  lang = LANGS.some((x) => x.id === l) ? l : "uz";
  document.documentElement.lang = lang;
}

export function t(key) {
  const s = STR[key];
  return s ? s[lang] || s.uz : key;
}

export function noteLabel(n) {
  return lang === "uz" ? n : NOTES[n]?.[lang] || n;
}

export function itemName(i) {
  if (!i || lang === "uz") return i?.name || "";
  return i.tr?.[lang]?.name || (DEF_ITEMS[i.id]?.name === i.name && ITEM_TR[i.id]?.[lang]?.[0]) || i.name;
}
export function itemDesc(i) {
  if (!i || lang === "uz") return i?.desc || "";
  return i.tr?.[lang]?.desc || (DEF_ITEMS[i.id]?.desc === i.desc && ITEM_TR[i.id]?.[lang]?.[1]) || i.desc || "";
}
export function catName(c) {
  if (!c || lang === "uz") return c?.name || "";
  return c.tr?.[lang]?.name || (DEF_CATS[c.id]?.name === c.name && CAT_TR[c.id]?.[lang]?.[0]) || c.name;
}
export function catTagline(c) {
  if (!c || lang === "uz") return c?.tagline || "";
  return c.tr?.[lang]?.tagline || (DEF_CATS[c.id]?.tagline === c.tagline && CAT_TR[c.id]?.[lang]?.[1]) || c.tagline || "";
}
export function weightText(w) {
  if (!w || lang === "uz") return w || "";
  return w.replace(/\bdona\b/, lang === "ru" ? "шт" : "pcs");
}

// Admin uchun: tanlangan tildagi joriy tarjimani olish (demo tarjimalari ham)
function withLang(l, fn) { const prev = lang; lang = l; try { return fn(); } finally { lang = prev; } }
export function itemTr(i, l) { return withLang(l, () => ({ name: itemName(i) === i.name ? "" : itemName(i), desc: itemDesc(i) === (i.desc || "") ? "" : itemDesc(i) })); }
export function catTr(c, l) { return withLang(l, () => ({ name: catName(c) === c.name ? "" : catName(c), tagline: catTagline(c) === (c.tagline || "") ? "" : catTagline(c) })); }
