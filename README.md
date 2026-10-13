# English Tutor — Telegram Mini App

Ingliz tili offline ustozlari uchun boshqaruv paneli va o'quvchi kabineti.
**Butun interfeys o'zbek tilida.** Moliyaviy ma'lumotlar (narx, to'lov) butunlay yo'q — faqat o'quv jarayoni.
Telefon raqamlari ham olib tashlangan; sinflar **faqat 5–11-sinf**; **Speaking qarzi** va **ovozli topshirish** mavjud.

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

### 7. Telefon raqamlari yo'q
Ro'yxat, forma va kartalarda telefon maydoni **umuman yo'q**. Majburiy maydonlar:
**Ism familiya, Maktab sinfi, Login, Parol** (guruh — ixtiyoriy).

### 8. Sinflar faqat 5–11
Barcha sinf variantlari va filtrlari qat'iy: `5-sinf, 6-sinf, 7-sinf, 8-sinf, 9-sinf, 10-sinf, 11-sinf`.

### 9. Speaking qarzi (counter)
- **Ustoz:** o'quvchilar ro'yxatida va Speaking ekranida har biri uchun **[ − ] / [ + ]** nazorat
- **O'quvchi:** kabinetda **"Speaking qarzingiz: X ta"** badge (yoki "qarzingiz yo'q")

### 10. Ovozli topshirish (ovoz yozish)
- **O'quvchi kabinetida:** "🎙 Ovoz yozish" → tinglash → "📤 Yuborish" (brauzer `MediaRecorder`)
- **Ustoz (Speaking → Ovozli topshiriklar):** ijrochini eshitadi, **1–10 ball** va izoh qoldiradi
- **Baholash avtomatik ravishda Speaking qarzini 1 ga kamaytiradi** va ball o'quvchi
  baholar jurnaliga (kategoriyasi "Speaking") yoziladi

### 11. Ko'p qurilmali bulut sinxronizatsiyasi (Supabase)
Barcha ma'lumotlar (hisoblar, guruhlar, o'quvchilar, baholar, davomat, speaking, audio)
markaziy bulut bazasiga yoziladi — boshqa telefonda **bir xil login/parol** bilan kirilsa,
o'sha ma'lumotlar tiklanadi.

**Sozlash (3 qadam):**
1. [supabase.com](https://supabase.com) → yangi loyiha → SQL Editor'da yarating:
   ```sql
   create table app_state (key text primary key, value jsonb, updated_at timestamptz);
   alter table app_state enable row level security;
   create policy "rw" on app_state for all using (true) with check (true);
   ```
   (Demo uchun `anon` kaliti bilan; haqiqiy xavfsizlik uchun RLS qat'iyroq bo'lsin.)
2. `index.html` ichidagi `window.SUPABASE_URL` va `window.SUPABASE_ANON_KEY` qiymatlarini kiriting.
3. Sahifani yangilang — `CloudSync` avtomatik ishga tushadi.

> ⚠️ Konfiguratsiya kiritilmasa ilova **localStorage** rejimida ishlayveradi (graceful fallback).

## Telegram bot (aiogram 3.x)

`bot.py` — bu ilovaning xabar yuborish boti. `/start` buyrug'i pastki chapdagi
doimiy menyu tugmasini WebApp ga sozlaydi ("📱 Ilovani ochish") va inline tugma
bilan xush kelib bildirishnoma yuboradi.

**O'rnatish — 3 qadam:**

1. Telegram'da **@BotFather** ga kiring → `/newbot` → bot nomini yozing va
   berilgan **tokenni** nusxalang.
2. Tokenni `config.py` ichidagi `BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"` o'rniga
   joylang (yoki `export BOT_TOKEN="123456:AAH..."` bering — env qiymat ustunlik qiladi).
3. Bog'lab ishga tushiring:

```bash
pip3 install -r requirements.txt
python3 bot.py
```

> ⚠️ **Xavfsizlik:** bu repo ochiq va GitHub Pages orqali `config.py` ham ommaga
> ko'rinadi. Haqiqiy tokenni faylga yozmang — `BOT_TOKEN` muhit o'zgaruvchisi orqali
> bering yoki tokenni hech qachon `main` ga push qilmang.

> 💡 Menyu tugmasi ishlashi uchun **BotFather → Bot Settings → Configure Mini App**
> bo'limida Mini App'ni yoqib, shu URL'ni kiriting.

**Xabar yuborish funksiyalari** (`bot.py`):

| Funksiya | Xabar |
|---|---|
| `send_absence_alert(chat_id, student_name, date)` | ⚠️ Davomat xabarnomasi: ... darsda qatnashmadi |
| `send_speaking_reminder(chat_id, student_name, time)` | 🎙 Speaking eslatmasi: ... yakkama-yakka darsingiz bor |
| `send_grade_alert(chat_id, subject, grade)` | 📝 Yangi baho: ... {grade}/10 ball qo'yildi |
| `send_credentials(chat_id, student_name, login, password)` | 🔑 Tizimga kirish ma'lumotlari: ... |

Hammasi o'zbek tilida, HTML formatlash bilan (`<b>`, `<code>`), qiymatlar esa
HTML uchun xavfsiz escaped qilinadi.

## Ishga tushirish

```bash
npm install      # test uchun (jsdom)
npm test         # interaktiv smoke-test (149 tekshiruv)
npm start        # http://localhost:3000
```

## Tuzilishi

```
index.html        — ilova qobigi
css/styles.css    — Telegram tema o'zgaruvchilari bilan (yorug'/qorong'i)
js/data.js        — mock ma'lumotlar (hisoblar, baholar, davomat, speaking)
js/app.js         — kirish, rollar, kabinet, jurnal, davomat, speaking
test/smoke.js     — jsdom asosida butun oqimni sinovdan o'tkazadi
bot.py            — Telegram bot (aiogram 3.x): /start + xabar funksiyalari
config.py         — BOT_TOKEN, WEBAPP_URL, ADMIN_ID
requirements.txt  — aiogram>=3.13.0, aiohttp>=3.9.0
.nojekyll         — GitHub Pages uchun
```

Ma'lumotlar avval brauzer `localStorage`'ida saqlanadi; **Supabase konfiguratsiya qilinsa** bulutga sinxronlanadi.

## GitHub Pages

https://revilend.github.io/EnglishappMuzaffar/
