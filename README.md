# English Tutor — Telegram Mini App

Ingliz tili offline ustozlari uchun boshqaruv paneli va o'quvchi kabineti.
**Butun interfeys o'zbek tilida.** Moliyaviy ma'lumotlar (narx, to'lov, qarz) butunlay yo'q — faqat o'quv jarayoni.

## Nima bor

### 1. Moliya yo'q
Guruhlarda, dashboardda va o'quvchi profilida narx/to'lov/qarz kartalari **olib tashlangan**.

### 2. Ustoz boshqaradigan login/parol tizimi
- Kirish ekrani: **Login** + **Parol** + "Kirish"
- Ustoz: `admin` / `123` — O'quvchi: `jasur` / `123`
- O'quvchi qo'shishda ustoz **Login** va **Dastlabki parol** belgilaydi (masalan `jasur09` / `1234`)
- O'quvchi: profilda **"Parolni o'zgartirish"** modali
- Ustoz: har bir o'quvchi kartasida **"Parolni yangilash"** (parolni unutgan uchun qayta tiklash)

### 3. Tezkor davomat
Guruh + sana (bugun) → [✓ Keldi] [✕ Kelmadi] [? Sababli] → "Davomatni saqlash" + toast.

### 4. 10 ballik baholar jurnali
- Guruh va sinf tanlagichlari
- Qatorlar: o'quvchilar (sinf badge), ustunlar: dars sanalari (02.10, 05.10 …)
- Ranglar: **8–10 yashil (A'lo)**, **6–7 ko'k (Yaxshi)**, **1–5 qizil (Qoniqarsiz)**
- Oxirida avtomatik **"O'rtacha baho"** va **Jami ball**
- Katakchaga bosib **1-tap** baho: 1–10 tugmalari + vazifa turi (Darsdagi javob / Lug'at / Uyga vazifa) + izoh
- Jadval gorizontal siljiydi, birinchi ustun `sticky`

### 5. Speaking (1-on-1) jadvali
- Ustoz maxsus vaqt slotlari yaratadi (masalan `14:00 – 14:20`, `14:20 – 14:40`)
- Har slotga bitta o'quvchi tayinlanadi
- "Baholash" → 1–10 ball → **o'quvchining baholar jurnaliga darhol yoziladi**

### 6. Rollarni keskin ajratish
**Ustoz:** guruhlar, o'quvchilar ro'yxati, telefonlar, davomat, jurnal, speaking.
**O'quvchi (kabinet):** faqat o'zi — ism, sinf, guruh, o'z baholari + o'rtacha, o'z davomati, o'z speaking vaqti, parol o'zgartirish.
Boshqa o'quvchilarning ismlari/telefonlari hech qachon ko'rinmaydi; boshqa ekranlarga urinish `canAccess()` bilan bloklanadi.

## Ishga tushirish

```bash
npm install      # test uchun (jsdom)
npm test         # interaktiv smoke-test (114 tekshiruv)
npm start        # http://localhost:3000
```

## Tuzilishi

```
index.html        — ilova qobigi
css/styles.css    — Telegram tema o'zgaruvchilari bilan (yorug'/qorong'i)
js/data.js        — mock ma'lumotlar (hisoblar, baholar, davomat, speaking)
js/app.js         — kirish, rollar, kabinet, jurnal, davomat, speaking
test/smoke.js     — jsdom asosida butun oqimni sinovdan o'tkazadi
.nojekyll         — GitHub Pages uchun
```

Ma'lumotlar brauzer `localStorage`'ida saqlanadi (demo uchun).

## GitHub Pages

https://revilend.github.io/EnglishappMuzaffar/
