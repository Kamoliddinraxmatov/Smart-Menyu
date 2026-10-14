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
