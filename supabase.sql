-- ============================================================
-- English Tutor — Supabase jadvallari (Step 5: chat + audio)
-- Supabase Dashboard → SQL Editor → "New query" → shu faylni
-- joylashtirib → "Run" bosing.
--
-- Mavjud jadvallar: students, groups, attendance, grades, messages
-- Quyida faqat yetishmayotgan jadvallar yaratiladi (idempotent).
-- ============================================================

-- 1) Ovozli topshiriklar (Speaking audio inbox)
create table if not exists public.audio_submissions (
  id          bigint generated always as identity primary key,
  student_id  bigint not null references public.students (id) on delete cascade,
  date        date not null,
  url         text not null,              -- data URL (base64 audio)
  status      text not null default 'pending' check (status in ('pending', 'graded')),
  score       smallint check (score between 1 and 10),
  feedback    text,
  created_at  timestamptz not null default now()
);

create index if not exists audio_submissions_student_idx
  on public.audio_submissions (student_id, created_at);

-- 2) Xabarlar (chat) — agar allaqachon bo'lsa, e'tibor bermaydi
create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  student_id  bigint not null references public.students (id) on delete cascade,
  sender      text not null check (sender in ('teacher', 'student')),
  text        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists messages_student_idx
  on public.messages (student_id, created_at);

-- 3) Telegram bot speaking topshiriklari (voice/video fayl IDlari)
create table if not exists public.speaking_submissions (
  id               bigint generated always as identity primary key,
  student_id       bigint references public.students (id) on delete cascade,
  media_type       text not null check (media_type in ('voice', 'video_note', 'video')),
  telegram_file_id text not null,
  status           text not null default 'kutilmoqda',
  score            smallint check (score between 1 and 10),
  feedback         text,
  created_at       timestamptz not null default now()
);

create index if not exists speaking_submissions_status_idx
  on public.speaking_submissions (status, created_at);
create index if not exists speaking_submissions_student_idx
  on public.speaking_submissions (student_id, created_at);

-- 3b) Agar jadval allaqachon eski ko'rinishda bo'lsa — yetishmayotgan
--     ustunlar qo'shiladi (idempotent, mavjud ma'lumotga tegmaydi)
alter table public.speaking_submissions add column if not exists student_id bigint references public.students (id) on delete cascade;
alter table public.speaking_submissions add column if not exists score smallint check (score between 1 and 10);
alter table public.speaking_submissions add column if not exists feedback text;

-- 4) Uyga vazifalar (homework) — ustoz qo'shadi, bot guruhga xabar qiladi
create table if not exists public.homework (
  id          bigint generated always as identity primary key,
  group_id    bigint not null references public.groups (id) on delete cascade,
  title       text not null,
  description text not null default '',
  due_date    date,
  media_url   text,      -- Rasm/video/audio faylining Supabase Storage havolasi
  media_type  text,        -- 'image', 'video', 'audio'
  created_at  timestamptz not null default now()
);

create index if not exists homework_group_idx
  on public.homework (group_id, created_at);
alter table public.homework enable row level security;
drop policy if exists "demo homework all" on public.homework;
create policy "demo homework all" on public.homework
  for all using (true) with check (true);

-- 5) O'quvchining Telegram hisobi (bot /login orqali ulanadi) va
--    ovozli topshirishga ruxsat bayrog'i
alter table public.students add column if not exists telegram_chat_id bigint;
alter table public.students add column if not exists voice_allowed boolean not null default true;
alter table public.students add column if not exists payment_debt integer not null default 0;

-- Guruh oylik tolamasi
alter table public.groups add column if not exists monthly_fee integer not null default 0;

-- 5c) XAVFSIZLIK ESIZTMALARI
--   * public.students.password — SHA-256 xesh (64 ta hex belgi) ko'rinishida saqlanadi.
--     Yangi qo'shilgan yoki o'zgartirilgan parollar faqat xesh sifatida yoziladi.
--     Eski ochiq parollar orqaga moslik uchun qabul qilinadi (login paytida).
--   * Media fayllar: Supabase Storage'dagi 'homework_media' bucket (public read).
--     Dashboard → Storage → New bucket → nomi: homework_media → Public: ON.
--   * Fayl yuklash faqat sayt orqali; bot og'ir media fayllarni yubormaydi.

-- 6) RLS — demo uchun ochiq (anon kalit bilan to'liq o'qish/yozish)
alter table public.audio_submissions enable row level security;
alter table public.speaking_submissions enable row level security;
alter table public.messages enable row level security;
alter table public.homework enable row level security;

drop policy if exists "demo audio all" on public.audio_submissions;
create policy "demo audio all" on public.audio_submissions
  for all using (true) with check (true);

drop policy if exists "demo speaking_submissions all" on public.speaking_submissions;
create policy "demo speaking_submissions all" on public.speaking_submissions
  for all using (true) with check (true);

drop policy if exists "demo messages all" on public.messages;
create policy "demo messages all" on public.messages
  for all using (true) with check (true);

-- 6) Tizim sozlamalari — ustoz paroli shu jadvalda saqlanadi
--    (key: 'teacher_password' → login ekranida shu qiymat tekshiriladi)
create table if not exists public.bot_settings (
  key   text primary key,
  value text not null default ''
);
alter table public.bot_settings enable row level security;
drop policy if exists "demo bot_settings all" on public.bot_settings;
create policy "demo bot_settings all" on public.bot_settings
  for all using (true) with check (true);

-- 7) O'quvchining oxirgi kirgan qurilmasi va vaqti (nazorat)
--    brauzer navigator.userAgent dan yoziladi: 'Android (Chrome)', 'iPhone (Safari)'
alter table public.students add column if not exists last_device text;
alter table public.students add column if not exists last_seen timestamptz;

-- 8) Faol qurilmalar (Telegram kabi seanslar) — uzokdan chiqarib yuborish uchun
--    id: localStorage'dagi takrorlanmas session_id (UUID)
--    user_id: hisob logini (ustoz: 'm_amirov', o'quvchi: jadvaldagi login)
create table if not exists public.user_sessions (
  id          uuid primary key,
  user_type   text not null check (user_type in ('teacher', 'student')),
  user_id     text not null,
  device_name text not null default '',
  last_active timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists user_sessions_user_idx
  on public.user_sessions (user_type, user_id);
alter table public.user_sessions enable row level security;
drop policy if exists "demo user_sessions all" on public.user_sessions;
create policy "demo user_sessions all" on public.user_sessions
  for all using (true) with check (true);

-- Realtime (ixtiyoriy): chat xabarlarini jonli yangilash uchun
-- Supabase Dashboard → Database → Replication → "messages" jadvalini yoqing.
--
-- Eslatma: hozirgi publishable kalit faqat o'qish/yozish beradi (DDL yo'q),
-- shuning uchun shu faylni bir marta ishga tushirish shart:


-- ============================================================
-- 9) Eng yangi qo'shilgan ustunlar va jadvallar (Moliya, To'lovlar, Outbox)
-- ============================================================

-- Guruhlar (maktab / repetitorlik va oylik to'lov)
alter table public.groups add column if not exists monthly_fee numeric default 0;
alter table public.groups add column if not exists group_type text default 'school';

-- O'quvchilar (to'lov qarzi, oxirgi to'lov tafsilotlari, xesh)
alter table public.students add column if not exists payment_debt numeric default 0;
alter table public.students add column if not exists last_paid_month text;
alter table public.students add column if not exists last_payment_info text;
alter table public.students add column if not exists password_hash text;
alter table public.students add column if not exists fee_period text;

-- Uyga vazifalar (ko'p faylli biriktirmalar: video, audio, rasm, pdf, doc)
alter table public.homework add column if not exists attachments jsonb default '[]'::jsonb;
alter table public.homework add column if not exists media_url text;
alter table public.homework add column if not exists media_type text;

-- 10) Telegram Outbox (Saytdan bot orqali o'quvchilarga to'lov/eslatma xabarlari yuborish)
create table if not exists public.telegram_outbox (
  id          bigint generated always as identity primary key,
  chat_id     text,
  student_id  bigint references public.students (id) on delete set null,
  text        text not null,
  status      text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at  timestamptz not null default now()
);
create index if not exists telegram_outbox_status_idx on public.telegram_outbox (status, created_at);
alter table public.telegram_outbox enable row level security;
drop policy if exists "demo telegram_outbox all" on public.telegram_outbox;
create policy "demo telegram_outbox all" on public.telegram_outbox
  for all using (true) with check (true);

-- 11) To'lovlar tarixi (payments / student_payments)
create table if not exists public.payments (
  id          bigint generated always as identity primary key,
  student_id  bigint not null references public.students (id) on delete cascade,
  amount      numeric not null default 0,
  note        text,
  period      text,
  created_at  timestamptz not null default now()
);
create index if not exists payments_student_idx on public.payments (student_id, created_at);
alter table public.payments enable row level security;
drop policy if exists "demo payments all" on public.payments;
create policy "demo payments all" on public.payments
  for all using (true) with check (true);

create table if not exists public.student_payments (
  id          bigint generated always as identity primary key,
  student_id  bigint not null references public.students (id) on delete cascade,
  group_id    bigint references public.groups (id) on delete set null,
  month_key   text,
  month_name  text,
  amount_due  numeric default 0,
  amount_paid numeric default 0,
  is_paid     boolean default false,
  paid_at     timestamptz,
  note        text,
  created_at  timestamptz default now()
);
alter table public.student_payments enable row level security;
drop policy if exists "demo student_payments all" on public.student_payments;
create policy "demo student_payments all" on public.student_payments
  for all using (true) with check (true);

-- 12) Oylik to'lovlar jadvali (monthly_fees — har bir oy uchun guruh narxi)
create table if not exists public.monthly_fees (
  id          bigint generated always as identity primary key,
  group_id    bigint not null references public.groups (id) on delete cascade,
  period      text not null,
  month_key   text,
  amount      numeric not null default 0,
  created_at  timestamptz not null default now(),
  unique (group_id, period)
);
create index if not exists monthly_fees_group_idx on public.monthly_fees (group_id, period);
alter table public.monthly_fees enable row level security;
drop policy if exists "demo monthly_fees all" on public.monthly_fees;
create policy "demo monthly_fees all" on public.monthly_fees
  for all using (true) with check (true);

-- 13) 1-on-1 Speaking Slotlari (speaking_slots)
create table if not exists public.speaking_slots (
  id          bigint generated always as identity primary key,
  date        date not null,
  start_time  text not null,
  end_time    text not null,
  student_id  bigint references public.students (id) on delete set null,
  score       smallint check (score between 1 and 10),
  created_at  timestamptz not null default now()
);
create index if not exists speaking_slots_date_idx on public.speaking_slots (date);
alter table public.speaking_slots enable row level security;
drop policy if exists "demo speaking_slots all" on public.speaking_slots;
create policy "demo speaking_slots all" on public.speaking_slots
  for all using (true) with check (true);
