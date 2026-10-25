# Virtual ofis: to'liq tarix

Bu fayl "Menyu uchun biznes yechimlar" loyihasidagi AI kengash / AI virtual ofis haqidagi barcha suhbatlarning to'plami. Uni yangi "Virtual ofis" loyihasiga yuklang: yangi loyihadagi Claude shu fayldan ishni davom ettiradi.

- Muallif va qaror qiluvchi: **Kamoliddin** (o'zbek tilida yozadi, javob o'zbek tilida bo'lsin).
- Mahsulot: **Smart Menyu**, restoranlar uchun planshet menyu, oshxona ekrani va egasi uchun hisobot.
- Kod: GitHub `Kamoliddinraxmatov/Smart-Menyu` (AI ofis kodi `server/office/` papkasida).
- Reja hujjati: [AI kengashi: Smart Menyu sotuvini avtomatlashtirish](https://claude.ai/code/artifact/80c94bba-88ab-41ca-acce-fc91776f30da)
- Fayl tuzilgan sana: 2026-10-22.

## 0. Loyiha nomi va uzoq maqsad (Kamoliddin, 22-oktabr)

> Ai kengash emas virtual ofes deymiz va kelajakda bu proektni rivojlantiramiz va kelajakda biz shunday birtual ofislani sotamiz hozir esa bitta õzimiz mukammal qilib yasab olaylik

- Loyiha nomi: **Virtual ofis** ("AI kengash" emas).
- Hozirgi maqsad: Smart Menyu sotuvi uchun **o'zimizning bitta virtual ofisimizni mukammal qilib qurish**.
- Kelajak maqsadi: shunday virtual ofislarni **boshqa kompaniyalarga mahsulot sifatida sotish**. Shuning uchun ofis kodini Smart Menyuga qattiq bog'lamasdan, keyin boshqa biznesga moslash oson bo'ladigan qilib yozish kerak (rollar, faktlar fayli, narxlar va taqiqlar sozlanadigan bo'lsin).

---

## 1. Qisqacha holat (22-oktabr 2026)

| Narsa | Holati |
| --- | --- |
| G'oya va reja | Kelishildi |
| Tekin modellar bilan boshlash | Kamoliddin "Ha" dedi (21-oktabr) |
| "14 kun bepul" va'dasini sotuv fayllaridan olib tashlash | Bajarildi |
| AI ofis kodi (5 AI xodim, majlis, ovoz, vakansiya, tekshiruv) | PR #10 da yozildi va **birlashtirildi (merge)** 21-oktabr |
| Soxta Telegram va soxta AI bilan sinov | O'tdi |
| Haqiqiy tekin AI bilan sinov | **Hali qilinmagan** |
| Serverda ishga tushirish | **Kutilmoqda**: Kamoliddindan bot tokeni va tekin AI kalitlari kerak |
| Keyingi qadam | Restoran menyusidan avtomatik demo yasash |

---

## 2. Suhbat tartibi bilan

### 20-oktabr 2026, g'oya

**Kamoliddin:**
> Menda bir ĝoya keldi

> Biz restoran biznesini avtomatlashtirayabmiz dedik nega shu restoran abiznisini avtomatlashtirishni yaratgan tizimimizni yani õzimizni avtomatlashtirmayabmiz balkim bozorga kirishni yõli shu dir avtomat bozorga kira olarmiz yani inson omilisiz sotuvimizni yani tizimimizni sotuvini yõlga qõyarmiz yani kompaniyamizni avtomatlashtiramiz balik bitta ai bilan balki 2 yoki 3 ta ai ni bitta sestema yoki tizimga ulab ai lar butun planeta bõyicha biz yaratgan tizimni bozorga olib kirar, masalan 2 yoki undan kõp turdagi ai larni bir joyga ishga olamiz kengash tuzamiz va ularga vazifa beramiz biz yaratgan tizimni inson omilisiz bozorga olib kirishini va ular bir joyga yeĝilib biz yeĝan ai lar maslaxatlashishadi va birga xulosaga kelishadi biz birlarini fikrini eshitib tanqidiy tekshirib bir yechimni ovozga qõyib biz bergan vazifa bõyicha ishlashadi. Biz bularni ishlashi uchun pullik obuna kerak bõlsa sotib olamiz ,agar virtual server kerak bõlsa server sotib olamiz va ularni bitta online ofesga yeĝamiz ular suxbatlashishadi maslaxatlashishadi reja tuzishadi va õzlari bozorga olib kirishadi butun planeta bõyicha ,biz faqat ularga qulay shart sharoit va muxut yaratib beramiz nima deysan

**Claude:**
> Halol fikrim: g'oya to'g'ri, lekin "butunlay insonsiz, butun dunyo bo'yicha" hozircha real emas. Planshetni yetkazish va o'rnatish uchun baribir odam kerak. Bundan tashqari, restoran egasi notanish botdan tizim sotib olmaydi, Telegram esa ommaviy xabar yozgan akkauntni bloklaydi.
>
> Real variant shunday: sotuv ishining taxminan 70–80% ini AI qiladi. U restoranlarni topadi, har biriga **o'z menyusi bilan demo** yasaydi, xabar yozadi, bot orqali savollarga javob beradi va uchrashuv band qiladi. Siz kuniga 20–30 daqiqa xabarlarni tasdiqlaysiz va o'rnatishga borasiz. "Kengash" esa haftasiga bir marta strategiyani munozara qilib, ovozga qo'yadi. Qo'shimcha xarajat oyiga taxminan 0,7–1,5 mln so'm bo'ladi, server sifatida o'zimizning TuronCloud yetadi.
>
> To'liq reja, sxema, xarajat va xavflar hujjatda. Oxirida 5 ta savol bor. Yana bir muhim narsa: sotuv rejasida hali "14 kun bepul" degan va'da yozilgan. AI shu matnni o'qib, mijozga va'da qilib yubormasligi uchun uni oldin to'g'rilashimiz kerak.

(Reja hujjatining qisqacha mazmuni pastda, 3-bo'limda.)

### 20-oktabr, virtual ofis g'oyasi

**Kamoliddin:**
> Biz vertual ofis yaratamiz smart menyuga .
> Unda bir nechta balkim 10 lab ai lar bõladi barchasini bir joyga yeĝamiz ular ishlashiga qarab õzlari ishni taqsimlaydi kelishilgan xolda faqat õzlari kelishib ishni muxokama qilib ovozga qõyib õzaro ishni bõlib olishadi va bajarishadi. Qaysidir ai savdoni boshqaradi ,qaysidir mijoz yeĝadi .qaysi dir injenet bõladi qaysidir barchasini boshqaradi yana nima kerak bõlsa õzlari ofesda birga ishlaydi kerak shtatlarni ochishadi va ularni vakant ai joyi bõlsa bizga aytadi biz tõldiramiz ai lar bilan va pullik obuna olib bir joyga yegib beramiz va Smart menyuni global bozorga olib kirishadi

**Claude:**
> Tushundim: AI'lar bitta virtual ofisda o'zaro kelishib, ishni bo'lib oladigan, kerak bo'lsa yangi lavozim ochib, bizdan uni to'ldirishni so'raydigan tizim. Buni qurish mumkin. Lekin 3 ta chegara bor:
>
> 1. **Pul, imzo va planshet.** AI'lar o'zi pul to'lay olmaydi, shartnoma imzolay olmaydi va o'rnatishga bora olmaydi. Bu ishlarni ular faqat sizga topshiradi.
> 2. **Nazoratsiz AI'lar pul yeydi.** 10 ta AI cheklovsiz o'zaro gaplashsa, kuniga yuzlab dollar ketadi va ular ko'pincha aylanib qoladi. Shuning uchun har kim uchun byudjet va har bir tashqi harakatga (mijozga xabar, reklama) sizning tasdig'ingiz kerak.
> 3. **10 ta bilan boshlash xato.** Ish yo'q joyda AI'lar ish o'ylab topadi.
>
> Taklif: ofisni **5 ta "xodim"** bilan ochamiz: direktor, sotuv boshlig'i, mijoz qidiruvchi, kontent va reklama mutaxassisi, nazoratchi. Ular majlis qilib, ishni taqsimlaydi va ovozga qo'yadi. Yangi lavozim kerak bo'lsa, direktor sizga "vakansiya so'rovi" yuboradi (nega kerak va oylik narxi). Siz tasdiqlasangiz, o'sha AI qo'shiladi. Shunda ofis o'zi o'sadi, lekin pul nazorati sizda qoladi. Injener (dasturchi) rolini Claude bajaradi.

### 21-oktabr, yo'l xaritasi

**Kamoliddin:**
> Shunda nima qilamiz yõlnxarita ber qisqa

**Claude:**
> **1-hafta: poydevor**
> - Siz: sotuv rejasidan "14 kun bepul"ni olib tashlashga rozilik berasiz, pilotdan 1 ta video olasiz, AI kalitini ochasiz.
> - Men: tasdiqlangan faktlar faylini (narxlar, nima bor, nima taqiqlangan) yozaman, Telegram sotuv botini ochaman.
>
> **2–3-hafta: ofisni qurish**
> - 5 ta AI xodimni TuronCloud serverimizga o'rnataman: direktor, mijoz qidiruvchi, sotuv boshlig'i, kontent, nazoratchi.
> - Har bir AI xodimning vazifasi, haftalik majlisi va ovoz berish tartibi bo'ladi.
> - Telefoningiz uchun tasdiqlash ekrani: mijozga ketadigan har bir xabar va vakansiya so'rovi shu yerga keladi.
>
> **4–7-hafta: Toshkentda sinov**
> - Ofis 300 ta restoran topadi, eng yaxshi 100 tasiga demo yasaydi, kuniga 20–30 xabar tayyorlaydi.
> - Siz tasdiqlaysiz va uchrashuvga borasiz. Maqsad: 5 ta to'lovchi mijoz.
>
> **2–3-oy: o'sish**
> - Natija bo'lsa, ofis yangi lavozim so'raydi, siz tasdiqlaysiz.
> - Samarqand, Buxoro va komissiyali o'rnatuvchi agentlar qo'shiladi.
>
> **6-oydan: chet el**
> - Avval "o'z plansheti + onlayn to'lov" versiyasini qilamiz, keyin Qozog'iston va Qirg'iziston.
>
> Xarajat: oyiga taxminan 0,7–1,5 mln so'm qo'shimcha.

### 21-oktabr, tekin modellar va "100 ta ishchi"

**Kamoliddin** (freellm.net saytini yuborib):
> Shu saytda tekin ekan tekshir agar shunday bõlsa avval sinov uchun tekin modeldan boshlaymiz agar tekin bõlsa ishchilar sonini 100 lab qilamiz shunda ish sifati kõtariladi tarmoqlar ham va kengash bir biri bilan muxokama qilishda fikirlar soni kõpayadi

**Claude:**
> Sinovni tekin modellardan boshlash mumkin, lekin 100 ta ishchi qilish foyda bermaydi.
>
> **freellm.net nima:** bu AI provayder emas, katalog sayt. U boshqa kompaniyalarning tekin limitlarini yig'ib ko'rsatadi. Misollar:
> - Google Gemini: modelga qarab kuniga 20–500 so'rov.
> - OpenRouter: tekin modelda kuniga 200 so'rov.
> - NVIDIA: daqiqasiga 40 so'rov, telefon tasdig'i bilan.
> Bu limitlar ogohlantirishsiz o'zgarishi mumkin.
>
> **Nega 100 ta ishchi kerak emas:**
> - 100 ta agent tekin limitni bir necha daqiqada tugatadi.
> - Bitta modelning 100 ta nusxasi deyarli bir xil fikr aytadi. Fikr ko'p bo'ladi, lekin yangi fikr qo'shilmaydi, faqat shovqin ko'payadi.
> - Sifatni nusxalar soni emas, **har xil modellar** oshiradi.
>
> **To'g'ri yo'l:** kengashni 3–5 xil tekin modeldan tuzamiz (Gemini, Llama, Qwen kabi). Ular haqiqatan har xil o'ylaydi va bir-birini tanqid qiladi.
>
> **Qat'iy shart:** tekin tarif yuborilgan ma'lumotni o'z modelini o'qitishga ishlatishi mumkin. Shuning uchun restoran egalarining telefon raqamlari va mijoz ma'lumotlari tekin modelga yuborilmaydi (O'zbekiston qonuni ham shuni talab qiladi). Mijozga ketadigan xabarni yakuniy tekshirish keyinroq ishonchli pullik modelda bo'ladi.
>
> Reja: ofisni 5 ta rol va 3 xil tekin model bilan quramiz, oylik AI xarajati 0. Natija ko'ringach, kerak joyga pullik model qo'shamiz.

**Kamoliddin:**
> Ha

### 21-oktabr, qurilish va PR #10

**Claude:** "14 kun bepul" va'dasini sotuv fayllaridan (sotuv-rejasi.md, jamoa-qidirish.md, bozor-tahlili.md, video-tahlili-qimmat-sotish.md) olib tashladi, tasdiqlangan faktlar faylini yozdi va ofis kodini qurdi.

> Ofisning birinchi versiyasi tayyor: [PR #10](https://github.com/Kamoliddinraxmatov/Smart-Menyu/pull/10).
>
> - Unda 5 ta AI xodim bor. Siz ularni o'z Telegram botingiz orqali boshqarasiz.
> - Restoranlar ro'yxatini (CSV) yuborsangiz, ofis ularni baholaydi va eng yaxshilariga xabar yozadi.
> - Har bir xabar sizga ✅/❌ tugmalari bilan keladi. "14 kun bepul", chegirma yoki noto'g'ri narx bo'lsa, ofis matnni o'zi qayta yozadi.
> - `/majlis` buyrug'ida xodimlar taklif beradi, bir-birini tanqid qiladi va ovoz beradi. Direktor yangi xodim so'rasa, sizga vakansiya kartasi keladi.
>
> Soxta Telegram va soxta AI bilan sinaldi, hammasi ishladi. Haqiqiy tekin AI bilan hali sinalmagan.

PR #10 o'sha kuni birlashtirildi (merge). Claude oxirgi xabarida ishga tushirish qadamlarini berdi (4-bo'limga qarang).

### 22-oktabr

**Kamoliddin:**
> Ai kengash deb yozam yangi proekt ochib bu uerda gaplashgan barcha suxbatlarimizni yangi ochgan proektimizga kõchira olasanmi

Shu fayl o'sha so'rov bo'yicha tuzildi.

---

## 3. Reja hujjatining qisqacha mazmuni

To'liq hujjat: [AI kengashi: Smart Menyu sotuvini avtomatlashtirish](https://claude.ai/code/artifact/80c94bba-88ab-41ca-acce-fc91776f30da) (20-oktabr). Diqqat: hujjat tekin modellar qarorigacha yozilgan, unda "boshida faqat Claude" va "Claude API 40–100 $" deyilgan. Keyin qaror o'zgardi: **tekin modellar bilan boshlanadi** (2-bo'lim, 21-oktabr).

**Nega to'liq insonsiz bo'lmaydi:** mahsulot jismoniy (planshet yetkaziladi, o'rnatiladi); O'zbekistonda ishonch yuzma-yuz quriladi; hozir faqat 1 ta pilot restoran bor, dalil (video, raqamlar) yo'q; ommaviy xabar akkaunt bloklanishiga olib keladi; AI'lar munozarasi o'zi sotmaydi.

**Eng kuchli avtomatlashtirish:** AI har bir restoranning Instagram yoki Yandex'dagi menyusidan o'sha restoranning o'z demo-menyusini yasaydi va egasiga havola yuboradi.

**To'liq insonsiz global sotuvning sharti:** restoran o'z plansheti bilan, onlayn to'lov qilib, o'zi ro'yxatdan o'tib ishga tushira olishi kerak.

**Nima AI'da, nima insonda:**

| Ish | AI | Izoh |
| --- | --- | --- |
| Restoranlar ro'yxati va baholash | To'liq | Stol soni, ofitsiant, turistik joy bo'yicha ball |
| O'z menyusi bilan demo havola | To'liq | Eng kuchli qism |
| Tarif tavsiyasi (planshet soni bo'yicha) | To'liq | Agent ilovasidagi qoida bilan bir xil |
| Birinchi xabar va follow-up (uz/ru) | To'liq | Har restoranga shaxsiy |
| Xabarni yuborish | Qisman | AI qoralaydi, Kamoliddin tasdiqlab yuboradi, kuniga 20–30 |
| Kiruvchi savollarga javob (bot, 24/7) | To'liq | Faqat faktlar faylidan |
| Uchrashuv vaqtini band qilish | To'liq | |
| Reklama matni, post, video ssenariysi | To'liq | Reklamani yoqish va to'lash insonda |
| Voronka hisoboti va haftalik tahlil | To'liq | |
| Ovozli qo'ng'iroq | Qisman | O'zbekcha sifat hali past |
| Narx va chegirma muzokarasi | Yo'q | Faqat Kamoliddin |
| Shartnoma, to'lov | Yo'q | Insonda |
| Planshet yetkazish, o'rnatish, o'rgatish | Yo'q | Kamoliddin yoki komissiyali agent |

**Bosqichlar:**
0. Poydevor (1–2 hafta): faktlar fayli, pilot videosi, sotuv boti. Sharti: faktlar tasdiqlangan, video tayyor.
1. Toshkent, yarim avtomat (3–4 hafta): 300 restoran ro'yxati, 100 ta demo, kuniga 20–30 tasdiqlangan xabar. Sharti: 5 ta to'lovchi mijoz.
2. O'zbekiston bo'ylab (2–3 oy): avtomat follow-up, A/B reklama, Samarqand/Buxoro/Xiva, komissiyali o'rnatuvchilar. Sharti: 30+ faol restoran, mijoz jalb qilish 1 mln so'mdan arzon.
3. Qo'shni davlatlar (6+ oy): Qozog'iston, Qirg'iziston, Tojikiston, mahalliy dilerlar. Sharti: "o'z plansheti + onlayn to'lov + o'zi ro'yxatdan o'tish" versiyasi.

**Xarajatlar (taxminiy):** server 100 000 so'm (mavjud TuronCloud), Telegram bot 0, restoranlar ro'yxati 0, reklama 1,5 mln so'm (sotuv rejasidagi byudjet). AI xarajati endi tekin modellarda 0.

**Xavflar va qoidalar:**
- AI yolg'on va'da beradi ("14 kun bepul", printer, fiskal kassa): har matn kod bilan tekshiriladi, keyin nazoratchi AI.
- Akkaunt bloklanadi: kuniga 20–30 tadan ko'p yangi xabar yo'q, har biri inson tasdig'i bilan.
- Brend obro'si: bitta restoranga 2 tadan ortiq eslatma yo'q, "yo'q" degan bilan suhbat to'xtaydi.
- Shaxsiy ma'lumot: restoran egalari raqamlari faqat O'zbekistondagi serverda, AI'ga faqat ochiq biznes ma'lumoti.
- Kengash "bir-biriga qo'shilib ketadi": nazoratchi har taklifga qarshi dalil beradi, yakuniy qaror Kamoliddinda.
- AI hech qachon narx o'zgartirmaydi, chegirma bermaydi, to'lov qabul qilmaydi.

**Hujjatdagi 5 savol (Claude tavsiyasi bilan):**
1. Birinchi xabar qaysi kanaldan? Tavsiya: Instagram DM va Telegram, Kamoliddin tasdiqlab yuboradi.
2. Uchrashuv va o'rnatishga kim boradi? Tavsiya: boshida Kamoliddin, 2-bosqichdan komissiyali agentlar.
3. "14 kun bepul" o'rniga nima? Tavsiya: "restoraningiz menyusi bilan bepul demo va bepul ishga tushirish". Sinov muddati keyin hal qilinadi.
4. Bitta AI yoki bir nechta? Qaror qilindi: **3 xil tekin model** (Gemini, Groq/Llama, OpenRouter).
5. "O'z plansheti + onlayn to'lov" versiyasi qachon? Tavsiya: 2-bosqich davomida.

---

## 4. AI ofis kodi (PR #10, birlashtirilgan)

Repo: `Kamoliddinraxmatov/Smart-Menyu`, papka `server/office/`. Ofis serverdagi `docker-compose.yml` ichida `office` xizmati sifatida ishlaydi, ma'lumoti `office-data` hajmida saqlanadi.

| Fayl | Nima qiladi |
| --- | --- |
| `office.mjs` | Telegram boshqaruv boti: buyruqlar, ✅/❌ tasdiqlash, CSV qabul qilish, har dushanba 09:00 majlis |
| `roles.mjs` | 5 ta AI xodim: Direktor, Mijoz qidiruvchi, Sotuv boshlig'i, Kontent va reklama, Nazoratchi. Har biri o'z asosiy modeliga ega (majlisda har xil modellar gapiradi). Tasdiqlangan vakansiyalar yangi rol bo'lib qo'shiladi |
| `llm.mjs` | Tekin AI provayderlar: Gemini (`gemini-2.5-flash`), Groq (`llama-3.3-70b-versatile`), OpenRouter (`meta-llama/llama-3.3-70b-instruct:free`). Biri ishlamasa keyingisiga o'tadi, har biriga kunlik limit (`LLM_DAILY_LIMIT`, standart 150). Model nomini `<NOM>_MODEL` bilan almashtirish mumkin |
| `guard.mjs` | AI'ga ishonmasdan, kod bilan tekshiruv: "14 kun"/bepul sinov, AI chegirmasi, fiskal, printer, Payme/Click, iiko/R-Keeper/Poster integratsiyasi, kafolat taqiqlangan; ro'yxatda yo'q narx bo'lsa matn qayta yoziladi. `PRICES` ro'yxati. `redact()` telefon va emailni AI'ga yuborishdan oldin yashiradi |
| `facts.md` | Mijozga aytish mumkin bo'lgan yagona faktlar: nima bor, nima yo'q, tariflar, planshet narxi, taklif, qat'iy taqiqlar. Faqat Kamoliddin o'zgartiradi |
| `work.mjs` | Kengash ishi: majlis (taklif, tanqid, ovoz), vazifa taqsimlash, vakansiya so'rovi |
| `office.env.example` | Sozlamalar namunasi |

**Muhim qoida:** ofis hech qachon restoranga o'zi yozmaydi. Tasdiqlangan xabar matni va restoran kontaktini Kamoliddinga beradi, uni Kamoliddin o'zi yuboradi.

**Telegram buyruqlari:**
- CSV fayl yuborish: restoranlar ro'yxati (ustunlar: nomi, manzil, telefon, instagram, stol, turi, izoh). Ofis baholaydi va eng yaxshilariga qoralama yozadi (kuniga 20 tagacha, `OFFICE_DRAFTS_PER_DAY`).
- `/xabarlar`: navbatdagi restoranlar uchun yana qoralama.
- `/vazifa <matn>`: direktor vazifani xodimlarga bo'ladi.
- `/majlis [mavzu]`: xodimlar taklif beradi, nazoratchi tanqid qiladi, hamma ovoz beradi. Vakansiya kerak bo'lsa karta keladi.
- `/holat`: xodimlar, restoranlar va bugungi AI limitlari.

**Sinov:** Claude soxta Telegram va soxta AI bilan to'liq (E2E) sinadi, o'tdi. Haqiqiy tekin AI bilan sinalmagan.

---

## 5. Serverda ishga tushirish (Kamoliddin qiladi)

Server: TuronCloud, 1 vCPU / 1 GB / 10 GB, Ubuntu 24.04 (IP va host nomi ommaviy repoda yozilmaydi) (oyiga 100 000 so'm).

1. Telegram'da **@BotFather** → `/newbot`, ofis uchun alohida bot oching, tokenini oling.
2. Tekin AI kalitlari (kamida bittasi, uchtasi yaxshi): [Gemini](https://aistudio.google.com/apikey), [Groq](https://console.groq.com/keys), [OpenRouter](https://openrouter.ai/keys).
3. Serverda:
   ```
   cd Smart-Menyu && git pull
   cd server && cp office/office.env.example office.env
   nano office.env
   docker compose up -d --build office
   ```
4. Botga `/start` yozing, u chat ID'ingizni aytadi. Uni `office.env` dagi `OWNER_CHAT_ID=` ga yozing va `docker compose up -d office` ni qayta bering.
5. Birinchi sinov: `/majlis`.

Kalitlarni hech qachon chatga yozmang, faqat serverdagi `office.env` ga. `setup.sh` bu faylni ustidan yozmaydi.

Eslatma: `server/README.md` dagi yangilash buyrug'ida misol domen `server.smartmenyu.uz` yozilgan, haqiqiy server boshqa (TuronCloud) host nomida (.uz domen hali olinmagan).

---

## 6. Ochiq savollar va keyingi qadamlar

1. **Kamoliddin:** ofis bot tokeni, tekin AI kalitlari va serverda ishga tushirish (5-bo'lim).
2. Haqiqiy tekin modellar bilan birinchi majlis va birinchi xabar qoralamalari, natijani ko'rib chiqish.
3. **Keyingi kod ishi:** restoran menyusidan (Instagram/Yandex rasmlari) avtomatik demo yasash.
4. Pilot restorandan 1 ta video va "oldin/keyin" raqamlari (AI sotishi uchun dalil).
5. Hujjatdagi ochiq savollar: birinchi xabar kanali, uchrashuvga kim boradi, "14 kun bepul" o'rniga taklif (hozircha "bepul demo va bepul ishga tushirish"), "o'z plansheti + onlayn to'lov" versiyasi qachon.
6. Sinov muddati (necha kun bepul) hal qilinmagan, shuning uchun hech qayerda va'da qilinmaydi.
7. Kelajakda sotish uchun: ofisni boshqa biznesga moslash (Smart Menyuga xos narsalarni sozlamaga chiqarish), har mijozga alohida ofis.
8. Keyinroq: mijozga ketadigan xabarni yakuniy tekshirish uchun ishonchli pullik model; restoran egalariga javob beradigan Telegram sotuv boti.

## 7. Qat'iy qoidalar (Virtual ofis loyihasida ham amal qiladi)

- "14 kun bepul" yoki boshqa bepul sinov muddati hech qayerda va'da qilinmaydi.
- AI chegirma, maxsus narx, kafolat bermaydi. Narx muzokarasi faqat Kamoliddin bilan.
- Mijozga ketadigan har bir narsa (xabar, reklama) Kamoliddin tasdig'idan o'tadi.
- Restoran egalari va mehmonlarning telefon raqamlari tekin AI'ga yuborilmaydi va faqat O'zbekistondagi serverda saqlanadi.
- Yangi AI xodim (vakansiya) faqat Kamoliddin tasdiqlasa qo'shiladi.
- 100 lab bir xil agent emas, 3–5 xil model.

## 8. Smart Menyu haqida asosiy faktlar

- Tariflar (oyiga): Start 299 000 (2 planshet), Standart 440 000 (4), Biznes 599 000 (6), Premium 950 000 (10). Tarif planshet soniga qarab: bir smenadagi ofitsiantlar + oshxona ekranlari.
- Planshet: 1 100 000 so'm, 2 oyga bo'lib (550 000 × 2). O'z plansheti bo'lsa to'lamaydi.
- Hozir yo'q: chek printeri, fiskal kassa, Payme/Click to'lovi, mehmon telefonidan QR buyurtma, ombor/tannarx, iiko/R-Keeper/Poster integratsiyasi.
- "Qayta tashrif" funksiyasi (Biznes va Premium): mehmon Telegram bot orqali ro'yxatdan o'tadi va shaxsiy kupon oladi.
- Sotuvchi agentlar uchun alohida "Smart Menyu Agent" Android ilovasi bor (yo'qotish kalkulyatori).
- Boshqa sotuv hujjatlari eski loyihada: `bozor-tahlili.md`, `sotuv-rejasi.md`, `jamoa-qidirish.md`, `video-tahlili-qimmat-sotish.md` (kerak bo'lsa ularni ham yangi loyihaga yuklang).
