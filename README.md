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

## Step 2'da nima bor

4. **Rollarni keskin ajratish (maxfiylik)**
   - **Ustoz:** guruhlar, to'liq o'quvchilar ro'yxati, ota-ona telefonlari, davomat, baholar jurnali.
   - **O'quvchi:** faqat **o'z portali** — boshqa o'quvchilarning ismlari, telefonlari va guruh boshqaruvi HECH QACHON ko'rinmaydi. Boshqa ekranlarga urinish avtomatik bloklanadi (`canAccess()`).
5. **O'quvchi portali:** ism + sinf + guruh, "Mening baholarim" (sana, ball, izoh), "O'rtacha baho" badge, "Mening davomatim", "To'lov holati" (To'langan / Muddati o'tdi), "Speaking vaqtim".
6. **Baholar jurnali (10 ballik, faqat ustoz):** guruh va sinf tanlagich, 5 ta dars sanasi ustuni, rangli ballar (8–10 yashil, 6–7 ko'k, 1–5 qizil), oxirida "O'rtacha" + "Jami ball", katakchaga bosib 1-tap baho editori (1–10, vazifa turi, izoh).
7. **Tezkor davomat (faqat ustoz):** guruh + sana (bugun), [✓ Keldi] [✕ Kelmadi] [? Sababli], "Davomatni saqlash" tasdiqi.

## Ishga tushirish

```bash
npm install      # test uchun (jsdom)
npm test         # interaktiv smoke-test (119 tekshiruv)
npm start        # http://localhost:3000
```

## Tuzilishi

```
index.html        — ilova qobigi
css/styles.css    — Telegram tema o'zgaruvchilari bilan (yorug'/qorong'i)
js/data.js        — mock ma'lumotlar (baholar, davomat, to'lov, speaking)
js/app.js         — auth, rollar, portal, jurnal, davomat
test/smoke.js     — jsdom asosida butun oqimni sinovdan o'tkazadi
.nojekyll         — GitHub Pages'ga Jekyll'siz to'g'ridan-to'g'ri serverlash
```

## GitHub Pages

Sayt `main` ildizidan serverlanadi: https://revilend.github.io/EnglishappMuzaffar/

Ma'lumotlar brauzer `localStorage`'ida saqlanadi (Step 1 uchun mock).
