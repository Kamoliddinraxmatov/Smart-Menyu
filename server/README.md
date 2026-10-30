# Smart Menyu: o'z serveringizni ishga tushirish

Hozir ilova bepul umumiy serverda ishlaydi. Ma'lumotlar shifrlangan, shuning uchun begona odam ularni o'qiy olmaydi. Lekin bepul server ma'lumotni qancha saqlashiga kafolat bermaydi va uni hamma ishlatadi. Ko'p restoranga sotishdan oldin o'z serveringizga o'ting.

## Nima kerak
1. **VPS server**: oyiga taxminan 5$. Masalan Hetzner (CX22), DigitalOcean yoki O'zbekistondagi hosting (ahost.uz, uzhost.uz). Tizim: **Ubuntu 24.04**, 1 GB RAM yetadi.
2. **Domen**: masalan `smartmenyu.uz`. Uning ichida bitta nom, masalan `server.smartmenyu.uz`.

## O'rnatish (bir marta, taxminan 15 daqiqa)
1. Domen sozlamalarida **A yozuv** qo'shing: `server.smartmenyu.uz` → serveringiz IP manzili.
2. Serverga kiring (hosting sizga login va parol beradi):
   ```
   ssh root@SERVER_IP
   ```
3. Quyidagi uch buyruqni ketma-ket yozing:
   ```
   git clone https://github.com/Kamoliddinraxmatov/Smart-Menyu.git
   cd Smart-Menyu/server
   sudo bash setup.sh server.smartmenyu.uz
   ```
4. Oxirida ekranda **server manzili, login va parol** chiqadi. Ularni yozib oling.

## Planshetlarni yangi serverga o'tkazish
1. **Smart Menyu Egasi** ilovasini oching.
2. ⚙️ **Sozlamalar** → **Server** bo'limiga server manzili, login va parolni kiriting.
3. **Serverni saqlash** tugmasini bosing.

Ilova avval yangi serverga ulanib ko'radi. Ulana olmasa, hech narsa o'zgarmaydi. Ulana olsa:
- barcha restoranlarning menyusi, buyurtmalari va hisobotlari yangi serverga ko'chiriladi;
- ishlab turgan planshetlar o'zi yangi serverga o'tadi;
- yangi o'rnatilgan planshetlar ham yangi serverni o'zi topadi.

## Xavfsizlik
- Server faqat login va parol bilan ishlaydi.
- Restoran ma'lumotlarini faqat shu restoranning tasdiqlangan planshetlari o'qiy oladi. Server egasi ham o'qiy olmaydi.

## Telegram botlar ("Qayta tashrif")
Serverda restoranlarning Telegram botlarini yurituvchi xizmat ham ishga tushadi (`bot/`). Uni alohida sozlash shart emas.
1. Restoran uchun Telegram'da **@BotFather** → `/newbot` bilan bot oching va tokenini nusxalang.
2. **Smart Menyu Egasi** ilovasida restoran sahifasidagi **Telegram bot** bo'limiga tokenni qo'ying va **Saqlash**ni bosing.
3. Bir necha soniyada "✓ @bot_nomi ishlayapti" chiqadi. Restoran boshqaruvida **Qayta tashrif → Stollar uchun QR kodlar** orqali stol QR kodlarini chop eting.

Bot faqat Biznes va Premium tariflarida ishlaydi: tarif tushirilsa yoki restoran to'xtatilsa, o'zi to'xtaydi.
Token faqat shu serverdagi bot xizmati o'qiy oladigan shaklda shifrlanib yuboriladi.

## AI ofis (sotuvga yordamchi)
Serverda Smart Menyu sotuvini tayyorlaydigan AI ofis ham ishga tushadi (`office/`). Unda 5 ta AI xodim bor: direktor, mijoz qidiruvchi, sotuv boshlig'i, kontent va nazoratchi. Ular tekin AI modellarda ishlaydi, siz ularni Telegram orqali boshqarasiz.

**Ofis o'zi hech kimga yozmaydi.** Har bir xabar avval tekshiriladi: "14 kun bepul", chegirma, kafolat va ro'yxatda yo'q narx bo'lsa, matn qayta yoziladi. Keyin xabar sizga ✅/❌ tugmalari bilan keladi. Tasdiqlasangiz, bot matnni va restoran kontaktini beradi, uni o'zingiz yuborasiz.

1. Telegram'da **@BotFather** → `/newbot` bilan ofis uchun alohida bot oching.
2. Tekin AI kalitlarini oling (kamida bittasi kerak, uchtasi bo'lsa majlisda 3 xil model gapiradi): [Gemini](https://aistudio.google.com/apikey), [Groq](https://console.groq.com/keys), [OpenRouter](https://openrouter.ai/keys).
3. Serverda:
   ```
   cd Smart-Menyu/server
   cp office/office.env.example office.env
   nano office.env        # bot tokeni va kalitlarni yozing
   docker compose up -d --build office
   ```
4. Botga `/start` yozing. U chat ID'ingizni aytadi: uni `office.env` dagi `OWNER_CHAT_ID=` ga yozing va `docker compose up -d office` ni qayta bering. Shundan keyin ofis faqat sizni tinglaydi.

Buyruqlar:
- **CSV fayl** yuborish: restoranlar ro'yxati (ustunlar: nomi, manzil, telefon, instagram, stol, turi, izoh). Ofis ularni baholaydi va eng yaxshilariga xabar qoralamasini yozadi (kuniga 20 tagacha).
- `/xabarlar`: navbatdagi restoranlar uchun yana qoralama yozadi.
- `/vazifa <matn>`: direktor vazifani xodimlarga bo'lib beradi, masalan `/vazifa Samarqand restoranlari uchun Instagram post`.
- `/majlis [mavzu]`: xodimlar taklif beradi, nazoratchi tanqid qiladi, hamma ovoz beradi. Direktor yangi xodim kerak deb hisoblasa, vakansiya kartasi keladi: tasdiqlasangiz, yangi AI xodim qo'shiladi.
- `/raqamlar <matn>`: haftalik raqamlarni yozasiz, masalan `/raqamlar sotuv 12 mln, xarajat 8 mln, yangi mijoz 4, demo 3`. Kengash shularga qarab gapiradi.
- `/kengash [mavzu]`: boshqaruv kengashi yig'iladi. A'zolar taklif beradi va ovoz beradi, direktor g'olib qarorni keyingi hafta uchun 3-5 ta vazifaga bo'ladi. Tasdiqlasangiz, qaror va vazifalar xotiraga yoziladi va keyingi majlisda tekshiriladi. Har dushanba 09:00 da kengash o'zi yig'iladi.

**Boshqaruv kengashi.** Kengash a'zolari dunyoga mashhur rahbarlarning ochiq tamoyillaridan (intervyu, xat, nutqlar) ilhomlangan AI uslublar, haqiqiy odamlar emas: ularning nomi ishlatilmaydi. Kutubxona `office/board.json` da (har a'zoning tamoyillari ro'yxati). Kim kengashda o'tirishi `office/profile.json` dagi `board` ro'yxatida. Shu faylda kompaniya nomi, egasi va AI xodimlar ham bor: boshqa biznes uchun ofis ochish uchun `profile.json` va `facts.md` ni almashtirish kifoya.
- `/holat`: xodimlar, restoranlar va bugungi AI limitlari.

Mijozga nimalar aytilishi mumkinligi `office/facts.md` faylida yozilgan. Narx yoki mahsulot o'zgarsa, shu faylni (va narx bo'lsa `office/guard.mjs` dagi `PRICES`ni) yangilang. Telefon raqamlar faqat shu serverda saqlanadi va AI'ga yuborilmaydi.

Yangilash (yangi versiya chiqqanda): serverda `cd Smart-Menyu && git pull && cd server && sudo bash setup.sh server.smartmenyu.uz`.
