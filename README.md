# English Tutor — Telegram Mini App

Ingliz tili offline ustozlari uchun boshqaruv paneli va o'quvchi kabineti.
**Butun interfeys o'zbek tilida.** Moliyaviy ma'lumotlar (narx, to'lov) butunlay yo'q — faqat o'quv jarayoni.
Telefon raqamlari ham olib tashlangan; sinflar **faqat 5–11-sinf**; **Speaking qarzi** va **ovozli topshirish** mavjud.

## Nima bor

### 0. Brending (Muzaffar Amirov) va toza start
- Ustoz nomi ilova va botda bir xil: **Muzaffar Amirov** — salom *"Xush kelibsiz,
  Muzaffar Amirov!"*, menyu tugmasi *"📱 Muzaffar Amirov Paneli"*.
- Ustoz logini qat'iy **`m_amirov`**. Login ekranida demo kartalar/chiplar/badgelar
  **yo'q** — faqat **Login**, **Parol (👁)** va **"Kirish"**.
- **Demo ma'lumot avtomatik SEED qilinmaydi** — ilova toza boshlanadi va faqat
  Supabase'dagi haqiqiy guruh/o'quvchi ma'lumotlaridan ishlaydi.

### 1. Moliya yo'q
Guruhlarda, dashboardda va o'quvchi profilida narx/to'lov/qarz kartalari **olib tashlangan**.

### 2. Ustoz boshqaradigan login/parol tizimi
- Kirish ekrani: **Login** + **Parol (👁 ko'zgusi)** + "Kirish" — ortiqcha hech narsa yo'q
- Ustoz (Muzaffar Amirov): `m_amirov` / `123` — O'quvchi: Supabase'dagi login/parol (masalan `jasur` / `123`)
- O'quvchi qo'shishda ustoz **Login** va **Dastlabki parol** belgilaydi (masalan `jasur09` / `1234`)
- O'quvchi: profilda **"Parolni o'zgartirish"** modali
- Ustoz: har bir o'quvchi kartasida **"Parolni yangilash"** (parolni unutgan uchun qayta tiklash)
- **Parollar Supabase'ga saqlanadi:** o'quvchi paroli → `students.password`,
  ustoz paroli → `bot_settings` (`key: 'teacher_password'`). Kirishda **aynan bazadagi
  parol** tekshiriladi — eski parol bilan qayta kirib bo'lmaydi.

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

### 8b. Jonli qidiruv va guruh → o'quvchi filtri
- O'quvchilar ekranida **🔍 O'quvchi ismini kiriting...** — har harf yozilishi bilan
  darhol filtr (Enter bosish shart emas).
- Guruhlar ekranida **guruh kartasini bosish** → darhol faqat shu guruh o'quvchilari;
  **[Barcha o'quvchilar]** tugmasi bilan filtr bir zumda tozalanadi.

### 9. Speaking qarzi (counter)
- **Ustoz:** o'quvchilar ro'yxatida va Speaking ekranida har biri uchun **[ − ] / [ + ]** nazorat
- **O'quvchi:** kabinetda **"Speaking qarzingiz: X ta"** badge (yoki "qarzingiz yo'q")

### 10. Speaking topshirish — faqat Telegram orqali (lightweight)
- **Brauzer yozgich YO'Q** — ilova yengil: o'quvchi Telegram botga 🎙 ovozli xabar
  (voice), 📹 krujok (video note) yoki MP4 yuboradi.
- **Ustoz ruxsati:** har bir o'quvchi kartasida **"🎙 Ovozli topshirishga ruxsat"**
  kaliti → `students.voice_allowed`. Yopiq bo'lsa bot rad etadi:
  *"⛔ Kechirasiz! Ustoz hozircha sizga ovozli topshirishga ruxsat bermagan. Darsda topshiring."*
- **Bot qabul qilganda:** `speaking_submissions` jadvaliga yoziladi —
  **speaking qarzi HECH QACHON +1 BO'LMAYDI** (faqat baholash kamaytiradi) — va
  ustozga **[📝 Mini App'da Baholash]** tugmasi bilan forward qilinadi.
- **Ustoz (Speaking → Telegram topshiriklari):** **1–10 ball** + izoh qo'yadi —
  **qarz avtomatik 1 ga kamayadi**, ball baholar jurnaliga ("Speaking") tushadi.
- **Jonli INBOX (realtime, qayta yuklashsiz):** yangi topshirik **Speaking**
  ekranida darhol paydo bo'ladi; baho qo'yganda (botda yoki saytda) karta
  **silliq** chiqib ketadi; `students.speaking_debt` o'zgarsa badge (masalan 2 → 1)
  **sahifani yangilashmasdan** jonli yangilanadi.

### 11. Ko'p qurilmali bulut sinxronizatsiyasi (Supabase) ✅ JOYIDA ULANGAN
Ilova **haqiqiy Supabase jadvallariga to'g'ridan-to'g'ri** o'qiydi va yozadi:

| Jadval | Nima saqlanadi |
|---|---|
| `students` | ism, sinf, guruh, login, parol, **speaking qarz** |
| `groups` | guruh nomi, kunlar, vaqt |
| `attendance` | sana + o'quvchi + holat (Keldi/Kelmadi/Sababli) |
| `grades` | sana, ball (1–10), kategoriya, izoh |
| `messages` | ustoz ↔ o'quvchi chati (real-time) |
| `homework` | uyga vazifalar (mavzu, tavsif, muddat) — bot guruhga xabar qiladi |
| `speaking_submissions` | Telegram voice/video topshiriklar (holat, ball) |
| `audio_submissions` | eski brauzer topshiriklari (zaxira uchun) |
| `bot_settings` | tizim sozlamalari — ustoz paroli (`teacher_password`) |

- **Loyiha ulanishi** `index.html` ichida: `window.SUPABASE_URL` +
  `window.SUPABASE_ANON_KEY` (publishable kalit).
- **Login paytida** barcha jadvallar tortib olinadi → boshqa telefonda/PC da
  **bir xil login/parol** bilan kirilsa o'sha ma'lumotlar to'liq tiklanadi.
- Har bir o'zgarish (o'quvchi, baho, davomat, qarz, xabar, uyga vazifa) **darhol**
  bulutga yoziladi; **5 soniyalik polling loop olib tashlangan** — real-time obuna
  va login/ekran ochilgandagi bir martalik pull ishlatiladi (cheksiz yangilanish yo'q).
- Toza start: demo guruh/o'quvchi **avtomatik SEED qilinmaydi** — jadvallar bo'sh
  bo'lsa ilova bo'sh boshlanadi, ma'lumotni ustoz o'zi qo'shadi.

**Sozlash (1 qadam):** `supabase.sql` faylini Supabase Dashboard → SQL Editor'da
**Run** bosing (hammasi idempotent — qayta ishga tushirish xavfsiz). Yangi qo'shimcha:
`homework` jadvali, `students.telegram_chat_id` va `voice_allowed` ustunlari.

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
- **O'quvchi:** kabinetida **"Muzaffar Amirov bilan Chat"** bo'limi — ustoz xabarlarini o'qiydi
  va javob yozadi (faqat o'z suhbati, boshqa o'quvchilarniki ko'rinmaydi).
- **Real-time:** supabase realtime obunasi + ochiq chat 5 sekundda bir avtomatik
  yangilanadi.

### 14. Ma'lumotlar bazasi zaxirasi (Backup & Restore)

**Veb ilovada (Ustoz → Profil → "Ma'lumotlar Bazasi Zaxirasi"):**

- **📥 Bazani yuklab olish (Backup)** — barcha jadvallar (`groups`, `students`,
  `attendance`, `grades`, `messages`, `speaking_submissions`) bitta vaqt muhrli
  JSON faylga yig'iladi va yuklab oladi: `english_crm_backup_2026-10-13.json`.
- **📤 Bazani qayta tiklash (Restore)** — saqlangan JSON faylni tanlang → tasdiq
  modali: *"Haqiqatan ham bazani ushbu fayldan qayta tiklamoqchimisiz? Hozirgi
  ma'lumotlar yangilanadi."* → **[Bekor qilish] [Ha, tiklash]** → jadvallar
  tozalanib, ID saqlangan holda qayta yoziladi, UI darhol yangilanadi.
- **ID va FK xavfsizligi:** string/g-/s- ko'rinishidagi lokal ID raqamga
  aylantiriladi, yaroqsiz va bog'lanishi yo'q qatorlar tashlanadi.
- Bulut ulanmagan bo'lsa (offline) — lokal ma'lumotlardan zaxira olinadi.

**Telegram botda (faqat ADMIN_ID):**

- **`/start`** — ustozga inline tugma: **[📥 Barcha ma'lumotlarni yuklab olish (Backup)]**.
- **`/backup`** — barcha jadvallar (`groups`, `students`, `attendance`, `grades`,
  `messages`, `speaking_submissions`, ...) timestamped fayl sifatida ustozga
  yuboriladi: `english_crm_backup_YYYY-MM-DD.json` + kaptorda o'quvchi/guruh/baho
  soni ko'rsatiladi.
- Zaxira faylini botga yuboring (yoki avval `/restore` yozing) → bot tasdiq
  tugmalarini ko'rsatadi: **[✅ Bazani qayta tiklash] [❌ Bekor qilish]** → tasdiqdan
  keyin baza qayta tiklanadi va natija hisoboti yuboriladi.
- Barcha backup/restore buyruqlari **faqat ustoz** uchun (boshqalariga rad etiladi).

### 15. Uyga vazifalar (homework) + Telegram xabarnomasi
- **Ustoz (Bosh ekran → "+ Uyga vazifa"):** guruh, **Mavzu**, **Vazifa (tavsif)**,
  **Topshirish muddati** → `homework` jadvaliga saqlanadi.
- **Bot** yangi vazifa paydo bo'lishini kuzatadi va **guruh barcha o'quvchilariga**
  (Telegram'ga ulanganlarga) darhol yuboradi:
  `📚 YANGI UYGA VAZIFA! / Guruh / Mavzu / Vazifa / Topshirish muddati` +
  **[📱 Ilovani ochish]** tugmasi.
- **O'quvchi portali:** "📚 Uyga vazifalar" — faqat **o'z guruhi** vazifalari.
- O'quvchi botga `/login jasur 123` yozib hisobini ulaydi — shundan keyin unga
  xabar boradi (`students.telegram_chat_id`).

### 16. Tozalash (avval zaxira — xavfsiz)
- **Profil → Ma'lumotlar Bazasi Zaxirasi → Tozalash:** jadval tanlanadi
  (Baholar / Davomat / Xabarlar / Topshiriklar).
- **Avval barcha jadvallar to'liq JSON zaxira fayl sifatida yuklab olinadi**,
  keyin tasdiq modali: *"Eski ma'lumotlar fayl ko'rinishida yuklandi. Bazani
  tozalashni tasdiqlaysizmi?"* → **[Bekor qilish] [Ha, tozalash]**.
- Tasdiqlangach tanlangan jadval Supabase'da va lokalda tozalanadi.
  (Botda zaxirani Telegram'ga olish uchun `/backup` buyrug'i bor.)

### 17. Bosiladigan stat kartalar va har kun uchun alohida dars vaqtlari
- Dashboardning **3 ta yuqori stat kartasi** bosiladi (`cursor-pointer`, bosilganda `scale-0.95`):
  **Guruhlar** → Guruhlar ekrani, **O'quvchilar** → O'quvchilar ekrani,
  **Sinflar** → O'quvchilar ekrani + **sinf filtri** chiplari animatsiya bilan ajratib ko'rsatiladi.
- **"Guruh qo'shish"** modali: haftaning istalgan kunlari (Dushanba–Yakshanba) belgilanadi va
  **har bir tanlangan kun uchun alohida `<input type="time">`** paydo bo'ladi —
  vaqt hardcode qilinmasdan ustoz istagan vaqtni tanlaydi (masalan Dushanba 09:15, Shanba 11:00).
  Kun o'chirilsa, o'sha kunning vaqt picker ham yo'qoladi.
- Guruh kartasi jadvalni dinamik formatda ko'rsatadi: **"Dushanba 09:15 • Shanba 11:00"**.
  Eski guruhlar (kunlar + bitta `time`) avvalgi ko'rinishida qoladi; `groups` jadvali ustunlari
  **o'zgarmagan** — kun+vaqt `days` ustunida saqlanadi, yangi migration shart emas.
- **"Guruhni tahrirlash"** modali: guruh kartasidagi **Tahrirlash** tugmasi orqali ochiladi —
  kunlar belgilangan holda, har bir kun uchun alohida vaqt picker prefilled bo'ladi
  (eski guruhlar uchun — bitta `time` qiymati barcha kunlarga avtomatik tarqatiladi).
  Saqlangach `groups.days` "kun+vaqt" formatida yangilanadi va Supabase'ga push qilinadi.
- **O'quvchini tahrirlash / guruhini almashtirish**: o'quvchi kartasidagi **Tahrirlash** —
  ism, sinf (5–11) va yangi guruh tanlanadi; `students.group_id` Supabase'da yangilanadi,
  mavjud **baholar va davomat tarixi saqlanadi** (student_id bo'yicha jadvallar tegilmaydi).

### 18. Xavfsizlik va speaking jurnali
- **Anti-brute-force**: 5 ta ketma-ket xato → login **5 daqiqa qulflanadi**, jonli `mm:ss`
  hisoblagich va "Xavfsizlik: 5 marta xato kiritildi..." xabari; "Kirish" tugmasi o'chiriladi.
- **Bot honeypot**: login va "O'quvchi qo'shish" modallarida yashirin `bot_check_field`
  maydoni bor — to'ldirilsa, ariza jimjimrad rad etiladi.
- **XSS**: barcha foydalanuvchi matnlari `esc()` orqali (`< > " ' &`) escape qilinadi.
- **Telegram WebApp initData**: `user` id ↔ `initDataUnsafe.user.id` mosligi, `hash`
  mavjudligi va `auth_date` yangiligi (24 soat) tekshiriladi — soxtalanish rad etiladi
  (to'liq HMAC tekshiruvi bot tokeni bilan serverda amalga oshiriladi).
- **Speaking sessiyalar jurnali**: bir xil sana uchun ko'p baholash — avvalgi sessiya
  yo'qolmaydi (note ga qo'shiladi + `et_speak_log` jurnalida saqlanadi); har bir
  baholash `speaking_debt` ni 1 ga kamaytiradi (0 dan past tushmaydi) va Supabase'ga yoziladi.

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

**Zaxira buyruqlari** (`bot.py`): buyruq | Vazifasi

| Buyruq | Vazifasi |
|---|---|
| `/login <login> <parol>` | O'quvchini Telegram hisobiga ulaydi (broadcast + speaking uchun) |
| `/start` (ustoz) | Menyu: **[🚀 Muzaffar Amirov Panelini ochish]** + **[📥 Barcha ma'lumotlarni yuklab olish (Backup)]** |
| `/backup` | Barcha jadvallarni `english_crm_backup_YYYY-MM-DD.json` fayl sifatida ADMIN_ID ga yuboradi (sonlar kaptorda) |
| `/restore` | Zaxira faylini yuborishni so'raydi (keyin tasdiq tugmalari chiqadi) |
| JSON fayl (document) | *"Haqiqatan ham bazani ushbu fayldan qayta tiklamoqchimisiz?"* → [✅ Bazani qayta tiklash] [❌ Bekor qilish] |

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
npm test         # interaktiv smoke-test (278 tekshiruv)
npm start        # http://localhost:3000
```

## Tuzilishi

```
index.html        — ilova qobigi
css/styles.css    — Telegram tema o'zgaruvchilari bilan (yorug'/qorong'i)
js/data.js        — statik konfiguratsiya (sinflar, kunlar, kategoriyalar — demo ma'lumot YO'Q)
js/app.js         — kirish, rollar, kabinet, jurnal, davomat, speaking
test/smoke.js     — jsdom asosida butun oqimni sinovdan o'tkazadi (278 tekshiruv)
supabase.sql      — messages/homework/speaking_submissions + telegram_chat_id (SQL Editor'da Run)
bot.py            — Telegram bot (aiogram 3.x): /start + xabar funksiyalari
config.py         — BOT_TOKEN, WEBAPP_URL, ADMIN_ID
requirements.txt  — aiogram>=3.13.0, aiohttp>=3.9.0
.nojekyll         — GitHub Pages uchun
```

Ma'lumotlar avval brauzer `localStorage`'ida saqlanadi; **Supabase konfiguratsiya qilinsa** bulutga sinxronlanadi.

## GitHub Pages

https://revilend.github.io/EnglishappMuzaffar/
