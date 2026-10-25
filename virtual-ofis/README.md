# Virtual ofis

Smart Menyu sotuvi uchun AI xodimlardan iborat virtual ofis. Kod: [`server/office/`](../server/office/).
Kelajak maqsadi: shunday virtual ofislarni boshqa kompaniyalarga sotish, shuning uchun kod Smart Menyuga qattiq bog'lanmaydi (rollar, faktlar, narxlar va taqiqlar sozlanadi).

Egasi: Kamoliddin. Barcha hujjatlar o'zbek tilida.

## Fayllar

| Fayl | Nima |
| --- | --- |
| [tarix.md](tarix.md) | Loyihaning to'liq tarixi: qarorlar, kod, sinov, serverda ishga tushirish, ochiq savollar |
| [kengash-reja.md](kengash-reja.md) | AI boshqaruv kengashi: g'oya va reja (22-okt) |
| [eski-reja.md](eski-reja.md) | Birinchi reja: Smart Menyu sotuvini avtomatlashtirish (20-okt, tekin modellar qarorigacha) |

## Hozirgi holat (25-oktabr 2026)

- **PR #10** (21-okt, birlashtirilgan): virtual ofis, 5 AI xodim: Direktor, Mijoz qidiruvchi, Sotuv boshlig'i, Kontent/reklama, Nazoratchi. Telegram buyruqlari: CSV yuklash, `/xabarlar`, `/vazifa`, `/majlis`, `/holat`.
- **PR #11** (25-okt, ochiq, birlashtirish Kamoliddinda): 6 a'zoli AI boshqaruv kengashi (top rahbarlar tamoyillaridan ilhomlangan, haqiqiy ismsiz), `/raqamlar`, `/kengash`, dushanba 09:00 avtomatik majlis. Kompaniya, egasi, xodimlar va kengash `profile.json` da, kengash a'zolari `board.json` da.
- Tekin modellar: Gemini 2.5 flash, Groq llama-3.3-70b, OpenRouter llama (free); biri ishlamasa keyingisiga o'tadi, `LLM_DAILY_LIMIT=150`.
- Server: TuronCloud 1 vCPU / 1 GB, Ubuntu 24.04, docker compose `office` xizmati, sozlamalar `office.env` da. IP va host nomi ommaviy repoda yozilmaydi.
- Soxta Telegram/AI bilan sinov o'tdi; haqiqiy tekin AI bilan hali sinalmagan. Kutilmoqda: ofis bot tokeni, AI kalitlari va serverda ishga tushirish.

## Qat'iy qoidalar

- "14 kun bepul" yoki har qanday bepul sinov va'da qilinmaydi.
- AI chegirma, maxsus narx yoki kafolat bermaydi; narx faqat Kamoliddin bilan.
- Mijozga ketadigan hamma narsa Kamoliddin tasdig'idan o'tadi; ofis restoranga o'zi yozmaydi.
- Telefon raqamlar tekin AI'ga yuborilmaydi, faqat O'zbekistondagi serverda saqlanadi.
- Yangi AI xodim faqat Kamoliddin tasdiqlasa qo'shiladi.
- 100 ta bir xil nusxa emas, 3–5 xil model.
- Kalit va tokenlar chatga ham, bu repoga ham yozilmaydi, faqat serverdagi `office.env` ga.
- Kengashda haqiqiy shaxs ismi, surati yoki brendi ishlatilmaydi, faqat ochiq tamoyillardan ilhomlangan rollar.

## Smart Menyu faktlari

- Tariflar (oyiga): Start 299 000 (2 planshet), Standart 440 000 (4), Biznes 599 000 (6), Premium 950 000 (10) so'm.
- Planshet 1 100 000 so'm (550 000 × 2 oy); restoranning o'z plansheti bo'lsa to'lanmaydi.
- Yo'q: chek printer, fiskal kassa, Payme/Click, QR buyurtma, ombor, iiko/R-Keeper/Poster integratsiyasi.

## Keyingi qadamlar

1. Kamoliddin: ofis bot tokeni, tekin AI kalitlari, serverda ishga tushirish; PR #11 ni ko'rib birlashtirish.
2. Restoran menyusidan (Instagram/Yandex) avtomatik demo yasash.
3. Pilot restorandan video va "oldin/keyin" raqamlari.
4. Keyin: mijozga ketadigan xabarni yakuniy tekshiradigan pullik model, sotuv boti, ofisni boshqa biznesga moslash.

## Ochiq savollar

- Birinchi xabar kanali (tavsiya: Instagram DM + Telegram).
- Uchrashuvga kim boradi (boshida Kamoliddin).
- Sinov muddati hal qilinmagan.
- "O'z plansheti + onlayn to'lov" versiyasi qachon.
- Kengash: birinchi soha, a'zolar soni (5 yoki 7), mahsulot nomi, yurist maslahati.
