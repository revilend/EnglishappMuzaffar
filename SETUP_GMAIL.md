# Gmail bildirishnomalari + Supabase migratsiyasi — sozlash qo'llanmasi

Ushbu qo'llanma 3 ta muhit o'zgaruvchisini (`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ADMIN_EMAIL`)
va `supabase.sql` migratsiyasini noldan sozlashni ko'rsatadi. Taxminiy vaqt: **15–20 daqiqa**.

Kerak bo'ladi:
- ustozning **Gmail** hisobi (xatlar shu manzildan yuboriladi),
- **Supabase** loyihasi (Dashboard'ga kirish huquqi),
- **Render** akkaunti va mavjud **Background Worker** (bot),
- **ustozning Telegram ID** raqami (`ADMIN_ID` uchun) — @userinfobot orqali olinadi.

> ⚠️ **Oltin qoida:** `GMAIL_APP_PASSWORD` — bu **maxfiy kalit**. Uni chatga, GitHub'ga,
> `config.py` ga yoki skrinshotga **yozmang**. Faqat Render dashboard'dagi Environment
> bo'limiga (yoki lokal kompyuterda gitignore qilingan `.env` fayliga) kiriting.

---

## 1-qadam. Gmail: App Password olish

Google oddiy hisob paroli bilan SMTP'ga ruxsat bermaydi — **16 belgili App Password** kerak.

1. https://myaccount.google.com/security → **2-Step Verification**ni yoqing
   (App Password faqat 2 bosqichli tasdiqlash yoqilganda paydo bo'ladi).
2. https://myaccount.google.com/apppasswords sahifasini oching.
3. **App name** maydoniga `english-tutor-bot` yozing → **Create**.
4. Ekranda chiqqan **16 belgili** parolni nusxalang (masalan `abcd efgh ijkl mnop`).
   Bo'shliqlarni olib tashlash shart emas — bot ularni o'zi tozalaydi
   (`GMAIL_APP_PASSWORD.strip()`), lekin nusxalashda ehtiyot bo'ling.
5. Bu parolni **bir marta** ko'rsatadi. Yo'qotib qo'ysangiz — o'sha sahifada o'chirib,
   yangisini yaratasiz.

**Muhim:** Agar hisob Google Workspace (korporativ `@sizningdomen.uz`) bo'lsa, administrator
App Password'ni bloklagan bo'lishi mumkin. Bunday holatda shaxsiy `@gmail.com` hisobidan
foydalaning yoki administratorga ruxsatni yoqishni ayting.

**`GMAIL_USER`** — xat yuboruvchi to'liq manzil: `muzaffar.amirov@gmail.com` (faqat `muzaffar` emas).

---

## 2-qadam. Supabase: SQL migratsiyasini yurgizish

Migratsiya **idempotent** — qayta yurgizish xavfsiz (mavjud ma'lumot o'chmaydi).

1. https://supabase.com/dashboard → loyihangizni tanlang.
2. Chap menyudan **SQL Editor** → **New query**.
3. Repo'dagi `supabase.sql` faylini to'liq ochib, **hammasini** nusxalab SQL oynasiga qo'ying.
4. **Run** (yoki `Ctrl+Enter`) bosing. Oxirida `Success. No rows returned` chiqadi.
5. Faylning oxirgi qatoridagi `notify pgrst, 'reload schema';` PostgREST keshini yangilaydi —
   yangi jadvallar saytga darhol ko'rinadi (ba'zan 5–10 soniya kerak bo'ladi).

Bu migratsiya quyidagilarni qo'shadi (15- va 16-bo'limlar):

| Obyekt | Nima uchun |
|---|---|
| `students.phone`, `students.email` | o'quvchi telefoni / Gmail manzili |
| `auth_codes` | ustoz 2FA va eski usul parol tiklash kodlari (3 daqiqa) |
| `email_outbox` | sayt yozadigan xatlar navbati (`status = 'pending'`) |
| `password_resets` | Telegram orqali parol tiklash OTP kodlari (5 daqiqa) |

### Tekshirish (SQL Editor'da)

```sql
-- 1) jadvallar mavjudmi?
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('auth_codes', 'email_outbox', 'password_resets');

-- 2) ustunlar qo'shilganmi?
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'students'
  and column_name in ('phone', 'email');

-- 3) RLS yoqilganmi? (rowsecurity = true bo'lishi kerak)
select relname, relrowsecurity
from pg_class
where relname in ('auth_codes', 'email_outbox', 'password_resets');

-- 4) xatlar navbati bo'shmi?
select count(*) as pending from public.email_outbox where status = 'pending';
```

1-so'rovda **3 qator**, 2-so'rovda **2 qator** qaytishi kerak.

---

## 3-qadam. Render: Environment o'zgaruvchilari

Botni Render'da **Background Worker** sifatida ishga tushirasiz (README'dagi 4-qadam bilan bir xil).

1. https://dashboard.render.com → xizmatni (**Background Worker**) tanlang.
2. Chap menyudan **Environment** (yoki **Environment → Environment Variables**).
3. **Add Environment Variable** orqali uchtasini qo'shing:

| Key | Value (namuna) | Izoh |
|---|---|---|
| `GMAIL_USER` | `muzaffar.amirov@gmail.com` | to'liq Gmail manzil |
| `GMAIL_APP_PASSWORD` | `abcdefghijklmnop` | 1-qadamda olingan 16 belgili parol |
| `ADMIN_EMAIL` | `muzaffar.amirov@gmail.com` | ustozga ketadigan xatlar; **bo'sh qoldirsangiz** `GMAIL_USER` ishlatiladi |

4. Allaqachon mavjud bo'lishi kerak bo'lganlar (tekshirib qo'ying):
   `BOT_TOKEN`, `ADMIN_ID`, `WEBAPP_URL`, `SUPABASE_URL`, `SUPABASE_KEY`.
5. **Save Changes** → Render avtomatik **qayta deploy** qiladi (yoki **Manual Deploy →
   Deploy latest commit** bosing).
6. Deploy tugagach **Logs** bo'limini oching: `Application startup complete` / aiogram polling
   xabari ko'rinishi kerak. Xatolar bo'lsa pastdagi jadvalga qarang.

> Eslatma: `ADMIN_ID` — ustozning **raqamli** Telegram ID'si. Sayt ustozga kod yuborganda
> `telegram_outbox` ga `chat_id = 'ADMIN'` yozadi, bot esa uni aynan `ADMIN_ID` ga almashtiradi.
> `ADMIN_ID` noto'g'ri bo'lsa 2FA kodi ustozga yetib bormaydi.

### Lokal sinov (ixtiyoriy)

```bash
# loyiha ildizida
printf 'GMAIL_USER=muzaffar.amirov@gmail.com\nGMAIL_APP_PASSWORD=abcdefghijklmnop\n' > .env
export $(grep -v '^#' .env | xargs)   # yoki: set -a; . ./.env; set +a
python3 bot.py
```

`.env` fayli `.gitignore`da — hech qachon commit qilinmaydi.

---

## 4-qadam. Uchdan-uchiga tekshirish

1. **Saytni yangilang:** `https://teachermuzaffar.uz/` (yoki mini app) — keshni tozalash
   uchun `Ctrl+F5`. `js/app.js?v=20261114_reset2` yuklanishi kerak.
2. **Ustoz 2FA:** login `m_amirov` + parol + CAPTCHA → 6 xonali kod modal chiqadi.
   - Telefonda Telegram xabari kelishi kerak (bot orqali).
   - Gmail manziliga xat kelishi kerak (30 soniya ichida).
3. **Bazada tekshirish** (SQL Editor):

```sql
select id, to_email, subject, status, created_at
from public.email_outbox
order by id desc limit 5;

select id, purpose, contact, used, expires_at
from public.auth_codes
order by id desc limit 5;
```

`email_outbox`da `status = 'sent'`, `auth_codes`da `used = true` ko'rinishi kerak.

4. **Render logida** quyidagi qator bo'ladi:

```
Email outbox sent #12 -> muzaffar.amirov@gmail.com
```

Xato bo'lsa:

```
email send error row 12 -> ...: (535, b'5.7.8 Username and Password not accepted ...')
```

5. **Parolni tiklash:** login ekranida **Parolni unutdingizmi?** → o'quvchi logini.
   - Telegram ulanmagan o'quvchi: *"Telegram botga ulanmagansiz, parolni tiklash uchun ustozga
     murojaat qiling"* — bu **normal** holat, kod yuborilmaydi.
   - Telegram ulangan o'quvchi: Telegramga kod keladi, kod + yangi parol bilan kiriladi.

---

## Nosozliklar va yechimlar

| Belgi | Sabab | Yechim |
|---|---|---|
| `RuntimeError: GMAIL_USER / GMAIL_APP_PASSWORD sozlanmagan` | env qo'shilmagan yoki bo'sh | Render → Environment'da ikkala qiymatni to'ldiring va qayta deploy qiling |
| `(535, b'5.7.8 Username and Password not accepted')` | noto'g'ri parol / App Password emas / 2SV o'chirilgan | 1-qadamni takrorlang, **yangi** App Password yarating |
| `email_outbox` navbati `failed` bo'lib qolyapti | manzil xato (`@` yo'q) yoki SMTP bloklangan | `email_outbox.to_email`ni tekshiring; logdagi aniq xatoni o'qing |
| `PGRST205` / `Could not find the table 'public.email_outbox'` | SQL migratsiyasi yurgizilmagan yoki kesh eski | 2-qadamni bajaring; `notify pgrst, 'reload schema';` ni qayta yurgizing |
| Xat kelmayapti, log jim | `ADMIN_EMAIL` bo'sh va `GMAIL_USER` ham bo'sh | ikkalasidan bittasini to'ldiring |
| Ustoz 2FA kodi Telegramga kelmayapti | `ADMIN_ID` raqamli emas yoki noto'g'ri | @userinfobot'dan ID ni qayta oling, Render'da `ADMIN_ID`ni yangilang |
| Gmail'da "App passwords" sahifasi yo'q | 2-Step Verification o'chirilgan yoki Workspace bloklagan | 2SV yoqing / administratorga murojaat qiling |
| Kod kiritdim, "eskirgan yoki allaqachon ishlatilgan" | kod 5 daqiqada o'tib ketdi yoki ikki marta ishlatilgan | **Kod yuborish**ni qaytadan bosing |

---

## Xavfsizlik eslatmalari

- App Password — Gmail hisobingizning to'liq huquqli kaliti. Faqat Render env / lokal `.env`da saqlang.
- Kerak bo'lmasa App Password'ni https://myaccount.google.com/apppasswords sahifasida **o'chirib**
  qo'ying — bot xat yuborishni to'xtatadi, boshqa hech narsa buzilmaydi.
- `supabase.sql`dagi RLS siyosatlari demo darajada (`using (true)`) — publishable kalit ochiq.
  Bu loyihaning umumiy cheklovi; qat'iylashtirish alohida bosqich sifatida rejalashtirilgan.
- `GMAIL_APP_PASSWORD`ni hech qachon `index.html`, `js/app.js` yoki `config.py` ga yozmang —
  repo ommaviy va GitHub Pages orqali hamma ko'radi.
