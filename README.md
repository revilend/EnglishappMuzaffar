# English Tutor — Telegram Mini App (Step 1)

Ingliz tili ustozlari va o'quvchilari uchun Telegram Mini App. Butun interfeys o'zbek tilida.

## Step 1'da nima bor

1. **Telegram WebApp integratsiyasi** — `window.Telegram.WebApp` SDK, mobil layout: toza header, kartalar, bottom nav. Sarlavha: **English Tutor**.
2. **Telefon (+998) + PIN autentikatsiyasi**
   - Login `+998 XX XXX-XX-XX` formatida, raqam avtomatik aniqlanadi (demo).
   - Birinchi kirish → 4 xonali PIN yaratish (tasdiqlash bilan).
   - Boshqa Telegram hisobidan kirish → PIN talab qilinadi.
   - Rol tanlash: **Ustoz** / **O'quvchi**.
3. **Guruhlar va o'quvchilar**
   - Guruh: nom, dars kunlari, vaqt, oylik to'lov (so'm).
   - O'quvchi: ism familiya, telefon, ota-ona telefoni, maktab sinfi, guruh.
   - Sinf bo'yicha filtr + ism bo'yicha qidiruv.

Demo ma'lumotlar: **2 guruh, 6 o'quvchi** (`js/data.js`).

## Ishga tushirish

```bash
npm install      # test uchun (jsdom)
npm test         # interaktiv smoke-test (56 tekshiruv)
npm start        # http://localhost:3000
```

## Tuzilishi

```
index.html        — ilova qobigi
css/styles.css    — Telegram tema o'zgaruvchilari bilan (yorug'/qorong'i)
js/data.js        — mock ma'lumotlar
js/app.js         — auth, ekranlar, guruh/o'quvchi boshqaruvi
test/smoke.js     — jsdom asosida butun oqimni sinovdan o'tkazadi
.nojekyll         — GitHub Pages'ga Jekyll'siz to'g'ridan-to'g'ri serverlash
```

## GitHub Pages

Sayt `main` ildizidan serverlanadi: https://revilend.github.io/EnglishappMuzaffar/

Ma'lumotlar brauzer `localStorage`'ida saqlanadi (Step 1 uchun mock).
