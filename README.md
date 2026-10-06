# Smart Menyu — restoranlar uchun elektron menyu va oshxona tizimi

Restoran brendidagi (logo, rang) menyu planshetda ochiladi, ofitsiant mijoz bilan taom tanlaydi va buyurtmani tasdiqlaydi.
Buyurtma bir zumda oshxona ekraniga tushadi, oshpaz "Tayyor" tugmasini bosgach stolga biriktirilgan ofitsiantning planshetiga
"Stol N tayyor ✓" xabari ovoz va tebranish bilan keladi.

## Ilovalar
| Sahifa | Kim uchun | Nima qiladi |
|---|---|---|
| `waiter.html` | Ofitsiant planshetlari | Ism + PIN bilan kirish, stollar xaritasi, menyu, savat, izohlar, tasdiqlash, "tayyor" xabarlari, hisob va stolni yopish |
| `kitchen.html` | Oshxona ekrani | Realtime cheklar, taymer (10 daq sariq, 20 daq qizil), Boshlash/Tayyor, taomni belgilash, umumiy hisob (Σ), stop-list, ovozli signal |
| `admin.html` | Restoran egasi | Logo, nom, rang, xizmat haqi, menyu va rasmlar, kategoriyalar, ofitsiantlar, stollarni ofitsiantga biriktirish, kunlik hisobot, QR havolalar |
| `index.html` | Hammasi | Restoranni tanlash, yangi restoran ochish |

Bir nechta restoran: har bir restoranning o'z kodi bor (`?r=kod`). Hamma qurilmalar shu kod orqali ulanadi.

## Texnik
- Oddiy HTML/CSS/JS, build kerak emas. GitHub Pages'da ishlaydi.
- Realtime aloqa: MQTT over WebSocket (`js/sync.js`), standart broker `wss://broker.emqx.io:8084/mqtt`.
  Har bir buyurtma "retained" xabar sifatida saqlanadi, shuning uchun yangi ulangan qurilma joriy holatni darhol oladi.
  Boshqa broker: `?broker=wss://...` parametri.
- Ochiq (public) broker sinov uchun. Haqiqiy savdoga chiqishda o'z serverimiz yoki Firebase/Supabase'ga o'tkaziladi (faqat `js/sync.js` o'zgaradi).

## Lokal ishga tushirish
```
python3 -m http.server 8000
```
va `http://localhost:8000/?r=demo` ni oching.
