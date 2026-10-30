# AI kengashi: Smart Menyu sotuvini avtomatlashtirish

20-oktabr 2026 · Kamoliddin

> **Eslatma:** bu eski reja, tekin modellar qarorigacha yozilgan ("boshida faqat Claude", "Claude API 40–100 $"). 21-oktabrdan keyin qaror: tekin modellar bilan boshlanadi (qarang: [tarix.md](tarix.md)). "Embedded content" o'rnida asl hujjatda diagramma bor edi.

## Halol fikr

Yo'nalish to'g'ri, lekin "inson omilisiz, butun planeta bo'yicha" bugun real emas. Real maqsad: **sotuv ishining 70–80% ini AI qiladi, inson kuniga 20–30 daqiqa tasdiqlaydi va faqat o'rnatishga boradi.**

Nega to'liq insonsiz bo'lmaydi:

- **Mahsulot jismoniy.** Planshet yetkaziladi, o'rnatiladi, ofitsiantlar o'rgatiladi. Buni AI qila olmaydi.
- **O'zbekistonda ishonch yuzma-yuz quriladi.** Restoran egasi notanish botdan oyiga 440 ming so'mlik tizim olmaydi, odamni ko'rishni xohlaydi.
- **AI sotadigan dalil hali yo'q.** Hozir 1 ta pilot restoran bor. Video va raqamlar bo'lmasa, eng yaxshi AI ham ishontira olmaydi.
- **Ommaviy xabar = blok.** Telegram va Instagram notanish odamlarga avtomatik yozgan akkauntlarni bloklaydi. Kichik bozorda bitta spam to'lqini brendni buzadi.
- **AI'lar munozarasi o'zi sotmaydi.** Sotuvni xabar, uchrashuv va o'rnatish qiladi. Kengash kuniga emas, haftasiga bir marta strategiya uchun kerak, aks holda ko'p pul yeydi va foyda bermaydi.

Eng kuchli avtomatlashtirish imkoniyati: **AI har bir restoranning Instagram yoki Yandex'dagi menyusidan o'sha restoranning o'z demo-menyusini avtomatik yasaydi** va egasiga havola yuboradi. Bu sotuv rejasidagi eng kuchli "wow" lahzasi, va uni qo'lda qilish 10–15 daqiqa oladi, AI esa 1 daqiqada qiladi.

To'liq insonsiz global sotuvning sharti mahsulotda: restoran **o'z plansheti bilan**, **onlayn to'lov** qilib, **o'zi ro'yxatdan o'tib** ishga tushira olishi kerak. Bu bo'lmaguncha har mamlakatda o'rnatuvchi odam yoki hamkor kerak.

## Nima avtomatlashadi, nima insonda qoladi

Sotuv zanjirining 13 ishidan 8 tasini AI bugun to'liq qila oladi, 2 tasini qisman, 3 tasi insonda qoladi.

| Ish | AI | Izoh |
| --- | --- | --- |
| Restoranlar ro'yxati (2GIS, Yandex, Instagram) va ularni baholash | To'liq | Stol soni, ofitsiant bormi, turistik joymi bo'yicha ball qo'yadi |
| Har restoran uchun o'z menyusi bilan demo havola | To'liq | Eng kuchli qism. Menyu rasmlaridan taom, narx, rasm ajratib, demo yasaydi |
| Tarif tavsiyasi (planshet soni bo'yicha) | To'liq | Agent ilovasidagi qoida bilan bir xil |
| Birinchi xabar va follow-up matni (uz/ru) | To'liq | Har restoranga shaxsiy matn |
| Xabarni yuborish | Qisman | AI qoralama tayyorlaydi, Kamoliddin bir tugma bilan tasdiqlab yuboradi. Kuniga 20–30 ta |
| Kiruvchi savollarga javob (Telegram bot, 24/7) | To'liq | Faqat tasdiqlangan faktlar faylidan javob beradi |
| Uchrashuv vaqtini band qilish | To'liq | Bot bo'sh vaqtlarni taklif qiladi |
| Reklama matni, post, video ssenariysi | To'liq | Reklamani yoqish va to'lash inson qo'lida |
| Voronka hisoboti va haftalik tahlil | To'liq | Qaysi xabar ishladi, qaysi hudud yaxshi |
| Ovozli qo'ng'iroq | Qisman | Texnik mumkin, lekin o'zbek tilida sifat va ishonch hozircha past. Keyinroq |
| Narx va chegirma muzokarasi | Yo'q | Faqat Kamoliddin |
| Shartnoma, to'lov, hisob-faktura | Yo'q | Yuridik imzo va pul insonda |
| Planshet yetkazish, o'rnatish, o'rgatish | Yo'q | Kamoliddin yoki komissiyali agent |

Boshqa davlatlarga chiqishda AI bozor tahlili, tarjima va lid qidirishni qiladi. Lekin har mamlakatning to'lov tizimi, shartnomasi, ma'lumot saqlash qonuni va planshet logistikasi bor, ular uchun mahalliy hamkor kerak.

## AI kengashi tuzilishi

Kundalik ishni 4 ta AI agent ketma-ket qiladi, haftalik strategiyani 3 agentdan iborat kengash munozara va ovoz bilan hal qiladi. Ikki joyda albatta inson turadi: xabarni tasdiqlash va o'rnatish.

&#91;embedded content: AI sotuv bo'limi · 8 AI roli, 2 inson qadami\]

Kengash bot va voronka hisobotini o'qiydi, keyingi hafta qaysi hudud va qaysi xabar varianti sinalishini taklif qiladi. Tanqidchi har taklifga qarshi dalil beradi, ko'pchilik ovozi bilan qaror chiqadi, lekin u Kamoliddin tasdiqlamaguncha kuchga kirmaydi. Agentlar bitta modelning turli rollari bo'ladi, kengashga keyin ikkinchi AI provayder qo'shish mumkin.

## Bosqichli reja

Toshkentdan boshlaymiz, har bosqichga faqat oldingisining sharti bajarilganda o'tamiz.

1. **0-bosqich: poydevor (1–2 hafta).** Tasdiqlangan faktlar fayli: narxlar, nima bor va nima yo'q, taqiqlangan va'dalar. Pilotdan 1 ta video va "oldin/keyin" raqamlari. Sotuv boti uchun alohida Telegram bot.
   - O'tish sharti: faktlar fayli Kamoliddin tomonidan tasdiqlangan, pilot videosi tayyor.
2. **1-bosqich: Toshkent, yarim avtomat (3–4 hafta).** AI 300 ta restoran ro'yxatini tuzadi va baholaydi, eng yaxshi 100 tasiga demo havola yasaydi, xabar qoralamasini yozadi. Kamoliddin telefonida kuniga 20–30 tasini tasdiqlab yuboradi. Bot javob beradi va uchrashuv band qiladi. Kamoliddin yoki agent uchrashuvga boradi.
   - O'tish sharti: kamida 5 ta to'lovchi mijoz va qaysi xabar ishlashini ko'rsatadigan raqamlar.
3. **2-bosqich: ko'proq avtomat, O'zbekiston bo'ylab (2–3 oy).** Follow-up'lar avtomat ketadi, AI reklama matnlarini sinab ko'radi (A/B), Samarqand, Buxoro, Xiva qo'shiladi. O'rnatishni komissiyali agentlar qiladi (jamoa-qidirish.md, A model). Kamoliddin faqat muzokara va pul.
   - O'tish sharti: 30+ faol restoran, bitta mijozni jalb qilish 1 mln so'mdan arzon.
4. **3-bosqich: qo'shni davlatlar (6+ oy).** Qozog'iston, Qirg'iziston, Tojikiston: rus tilli, o'xshash restoran madaniyati. AI lid va kontent qiladi, mahalliy diler o'rnatadi va komissiya oladi.
   - Shart: "o'z plansheti bilan + onlayn to'lov + o'zi ro'yxatdan o'tish" versiyasi. Busiz uzoq davlatga chiqib bo'lmaydi.

AI kengashining o'zini qurish (agentlar, tasdiqlash ekrani, bot) taxminan 2–3 hafta ish. Kodni men shu loyiha ichida yozaman.

## Xarajatlar

1-bosqichda qo'shimcha xarajat oyiga taxminan **0,7–1,5 mln so'm**. Bu bitta sotuvchining fiks maoshidan (2 mln) arzon, lekin o'rnatuvchi odamni almashtirmaydi.

| Narsa | Oyiga | Izoh |
| --- | --- | --- |
| Claude API (agentlar ishlashi uchun) | \~40–100 $ (\~0,5–1,2 mln so'm) | Kundalik ish arzon modelda, haftalik kengash kuchli modelda. API'da oylik chegara qo'yamiz |
| Server | 100 000 so'm (mavjud TuronCloud) | Agentlar faqat API chaqiradi, server og'ir emas. Yuklama oshsa 2 GB RAM ga ko'taramiz |
| Telegram sotuv boti | 0 Nd | Bepul |
| Restoranlar ro'yxati | 0 | Boshida AI + qo'lda. Pullik xarita API faqat 2-bosqichda, kerak bo'lsa |
| Ikkinchi AI provayder (ixtiyoriy) | \~20–50 $ | Faqat haftalik kengashda boshqa nuqtai nazar uchun. Boshida shart emas |
| Reklama | 1,5 mln so'm | Sotuv rejasidagi byudjet, o'zgarmaydi |

API narxlari va dollar kursi taxminiy, tekshirilmagan. Haqiqiy xarajatni 1-bosqichning birinchi oyida o'lchaymiz.

## Xavflar va qat'iy qoidalar

Eng katta xavf AI'ning yolg'on va'da berishi va spam. Ikkalasi ham qoidani kodga yozib, AI'ga ishonib qo'ymasdan yopiladi.

| Xavf | Qoida |
| --- | --- |
| AI "14 kun bepul", soxta raqam yoki yo'q funksiya (printer, fiskal kassa) va'da qiladi | Har chiquvchi matn taqiqlangan iboralar ro'yxatidan kod bilan o'tadi, keyin Nazoratchi agent tekshiradi. Bot faqat faktlar faylidagi narsani aytadi |
| Telegram yoki Instagram akkaunt bloklanadi | Shaxsiy akkauntdan kuniga 20–30 tadan ko'p yangi xabar yo'q, har biri inson tasdig'i bilan. Bot faqat o'ziga yozgan odamga javob beradi (Telegram botlari o'zi birinchi yoza olmaydi) |
| Brend obro'si (kichik bozor) | Bitta restoranga 2 ta follow-up'dan ko'p yozilmaydi. "Yo'q" degan bilan suhbat to'xtaydi |
| Shaxsiy ma'lumot qonuni | Restoran egalari raqamlari faqat O'zbekistondagi serverda saqlanadi. AI'ga faqat ochiq biznes ma'lumoti beriladi |
| AI xarajati portlashi | API'da oylik chegara va kengash faqat haftasiga 1 marta |
| Kengash "bir-biriga qo'shilib ketadi" | Tanqidchi rolidagi agent har taklifga qarshi dalil berishga majbur. Yakuniy qaror baribir Kamoliddinda |
| Pul va shartnoma | AI hech qachon narx o'zgartirmaydi, chegirma bermaydi, to'lov qabul qilmaydi |

**E'tibor:** `sotuv-rejasi.md` va sotuvchi vakansiyasida hali "14 kun bepul sinov" yozilgan. AI shu fayllarni o'qisa, uni va'da qilib yuboradi. Bu matnlarni oldin to'g'rilash kerak.

## Kelishib olishimiz kerak bo'lgan savollar

Qurishni boshlashdan oldin shu 5 ta savolga javob kerak. Har birida mening tavsiyam bor.

1. **Birinchi xabar qaysi kanaldan ketadi?** Tavsiya: Instagram DM va Telegram, Kamoliddin tasdiqlab yuboradi.
2. **Uchrashuv va o'rnatishga kim boradi?** Tavsiya: boshida Kamoliddin, 2-bosqichdan komissiyali agentlar.
3. **"14 kun bepul" o'rniga nima taklif qilamiz?** Tavsiya: "restoraningiz menyusi bilan bepul demo va bepul ishga tushirish". Sinov muddati keyin hal qilinadi.
4. **Bitta AI bilanmi yoki boshidan 2 xil AI bilanmi?** Tavsiya: boshida faqat Claude, rollar har xil. Ikkinchi provayder kengash natija bermasa qo'shiladi.
5. **"O'z plansheti bilan + onlayn to'lov" versiyasini qachon qilamiz?** Tavsiya: 2-bosqich davomida, chunki xalqaro bozorning kaliti shu.
