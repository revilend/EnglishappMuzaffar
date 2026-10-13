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
- **Neytral dizayn:** rangli badge'lar yo'q — toza dark-slate raqam, yumshoq kulrang
  fon va nozik ramka; legendada faqat matn (`8–10 / 6–7 / 1–5`)
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

### 11. Ko'p qurilmali bulut sinxronizatsiyasi (Supabase) ✅ JOYIDA ULANGAN
Ilova **haqiqiy Supabase jadvallariga to'g'ridan-to'g'ri** o'qiydi va yozadi:

| Jadval | Nima saqlanadi |
|---|---|
| `students` | ism, sinf, guruh, login, parol, **speaking qarz** |
| `groups` | guruh nomi, kunlar, vaqt |
| `attendance` | sana + o'quvchi + holat (Keldi/Kelmadi/Sababli) |
| `grades` | sana, ball (1–10), kategoriya, izoh |
| `messages` | ustoz ↔ o'quvchi chati (real-time) |
| `audio_submissions` | ovozli topshiriklar (ixtiyoriy, `supabase.sql`) |

- **Loyiha ulanishi** `index.html` ichida: `window.SUPABASE_URL` +
  `window.SUPABASE_ANON_KEY` (publishable kalit).
- **Login paytida** barcha jadvallar tortib olinadi → boshqa telefonda/PC da
  **bir xil login/parol** bilan kirilsa o'sha ma'lumotlar to'liq tiklanadi.
- Har bir o'zgarish (o'quvchi, baho, davomat, qarz, xabar) **darhol** bulutga yoziladi.
- Birinchi marta jadvallar bo'sh bo'lsa, demo ma'lumot avtomatik seed qilinadi.

**Sozlash (1 qadam):** `supabase.sql` faylini Supabase Dashboard → SQL Editor'da
**Run** bosing (messages allaqachon bor — qayta yaratish xavfsiz).

> ⚠️ Konfiguratsiya olib tashlansa ilova **localStorage** rejimida ishlayveradi
> (graceful fallback). Publishing kaliti xavfsiz (faqat o'qish/yozish uchun;
> production'da RLS qat'iylashtirish shart).

### 12. O'chirish (tasdiq bilan)
- **O'quvchi:** har kartada **🗑 O'chirish** → tasdiq modali
  ("Haqiqatan ham [Ism]ni o'chirmoqchimisiz? Uning barcha baholari va davomat
  tarixi ham o'chiriladi.") → **[Bekor qilish] / [Ha, o'chirish]**.
  Tasdiqlansa: lokal va Supabase'dan **o'quvchi + baholar + davomat + xabarlar +
  audio** o'chiriladi, login hisobi ham tozalanadi → toast "O'quvchi muvaffaqiyatli
  o'chirildi".
- **Guruh:** har kartada **🗑 O'chirish** → tasdiq modali → Supabase `groups`
  jadvalidan o'chiriladi, o'quvchilari `group_id = null` bo'ladi → toast
  "Guruh muvaffaqiyatli o'chirildi".

### 13. To'g'ridan-to'g'ri chat (Ustoz ↔ O'quvchi)
- **Ustoz:** har bir o'quvchi kartasida **"💬 Xabar yozish"** → modaldagi suhbat:
  xabar yozish, Enter bilan yuborish, xabarlar `messages` jadvaliga yoziladi.
- **O'quvchi:** kabinetida **"Ustoz bilan Chat"** bo'limi — ustoz xabarlarini o'qiydi
  va javob yozadi (faqat o'z suhbati, boshqa o'quvchilarniki ko'rinmaydi).
- **Real-time:** supabase realtime obunasi + ochiq chat 5 sekundda bir avtomatik
  yangilanadi.

## Telegram bot (aiogram 3.x)

`bot.py` — bu ilovaning xabar yuborish boti. `/start` buyrug'i pastki chapdagi
doimiy menyu tugmasini WebApp ga sozlaydi ("📱 Ilovani ochish") va inline tugma
bilan xush kelib bildirishnoma yuboradi.

**Telegram'da gaplashish (voice/video):** o'quvchi botga **ovozli (voice)** yoki
**dumaloq video (video_note)** xabar yuboradi → fayl `speaking_submissions`
jadvaliga yoziladi va ustozga (**ADMIN_ID**) **"🎙 YANGI SPEAKING TOPSHIRILDI!"**
xabari "📝 Mini App'da Baholash" tugmasi bilan tushadi.

**Render.com'da 24/7 ishga tushirish (Background Worker):**

1. Repo'ni **Render** ga ulang → **New → Background Worker**
   (yoki CLI: `render.yaml` o'rniga Manual: Docker/Python environment).
2. **Environment** qo'shing (hammasi `config.py` dagi env nomlari bilan bir xil):

   | Variable | Qiymat |
   |---|---|
   | `BOT_TOKEN` | @BotFather tokeni |
   | `ADMIN_ID` | Ustozning Telegram ID raqami |
   | `WEBAPP_URL` | `https://revilend.github.io/EnglishappMuzaffar/` |
   | `SUPABASE_URL` | `https://mvjoeqyqaylfccqcnwwe.supabase.co` |
   | `SUPABASE_KEY` | Supabase publishable kalit |

3. **Build Command:** `pip install -r requirements.txt`
   **Start Command:** `python bot.py`
4. Deploy — worker doimiy polling rejimida ishlaydi (24/7).

**Lokal ishga tushirish — 3 qadam:**

1. Telegram'da **@BotFather** ga kiring → `/newbot` → bot nomini yozing va
   berilgan **tokenni** nusxalang.
2. Tokenni muhit o'zgaruvchisi qiling: `export BOT_TOKEN="123456:AAH..."`
   (yoki `config.py` ni vaqtincha almashtiring — env qiymat ustunlik qiladi).
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
npm test         # interaktiv smoke-test (194 tekshiruv)
npm start        # http://localhost:3000
```

## Tuzilishi

```
index.html        — ilova qobigi
css/styles.css    — Telegram tema o'zgaruvchilari bilan (yorug'/qorong'i)
js/data.js        — mock ma'lumotlar (hisoblar, baholar, davomat, speaking)
js/app.js         — kirish, rollar, kabinet, jurnal, davomat, speaking
test/smoke.js     — jsdom asosida butun oqimni sinovdan o'tkazadi (194 tekshiruv)
supabase.sql      — messages/audio_submissions jadvallari (SQL Editor'da Run)
bot.py            — Telegram bot (aiogram 3.x): /start + xabar funksiyalari
config.py         — BOT_TOKEN, WEBAPP_URL, ADMIN_ID
requirements.txt  — aiogram>=3.13.0, aiohttp>=3.9.0
.nojekyll         — GitHub Pages uchun
```

Ma'lumotlar avval brauzer `localStorage`'ida saqlanadi; **Supabase konfiguratsiya qilinsa** bulutga sinxronlanadi.

## GitHub Pages

https://revilend.github.io/EnglishappMuzaffar/
