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

-- 9) Speaking slotlari (1-on-1) — barcha qurilmalarda bir xil
create table if not exists public.speaking_slots (
  id         bigint generated always as identity primary key,
  date       date not null,
  start_time text not null default '',
  end_time   text not null default '',
  student_id bigint references public.students (id) on delete set null,
  score      smallint check (score between 1 and 10),
  created_at timestamptz not null default now()
);
create index if not exists speaking_slots_date_idx
  on public.speaking_slots (date, start_time);
alter table public.speaking_slots enable row level security;
drop policy if exists "demo speaking_slots all" on public.speaking_slots;
create policy "demo speaking_slots all" on public.speaking_slots
  for all using (true) with check (true);

-- 10) Login takrorlanmasligi (bir xil login ikki o'quvchida bo'lmasin).
--     Agar bazada allaqachon dublikat login bo'lsa, avval ularni tuzating —
--     aks holda bu qator xato beradi.
create unique index if not exists students_login_unique
  on public.students (lower(login))
  where login is not null and login <> '';

-- Realtime (ixtiyoriy): chat xabarlarini jonli yangilash uchun
-- Supabase Dashboard → Database → Replication → "messages" jadvalini yoqing.
--
-- Eslatma: hozirgi publishable kalit faqat o'qish/yozish beradi (DDL yo'q),
-- shuning uchun shu faylni bir marta ishga tushirish shart:

-- ============================================================
-- UYGA VAZIFA MEDIA (rasm/video/audio FAQAT saytda)
-- ============================================================
alter table homework add column if not exists media_url text;
alter table homework add column if not exists media_type text;

-- ============================================================
-- OYLIK TO'LOV VA O'QUVCHI QARZI
-- ============================================================
alter table groups add column if not exists monthly_fee bigint not null default 0;
alter table students add column if not exists payment_debt bigint not null default 0;

-- ============================================================
-- TELEGRAM OUTBOX: sayt yozadi, bot yuboradi (chek / eslatma)
-- ============================================================
create table if not exists telegram_outbox (
  id bigint generated always as identity primary key,
  student_id bigint references students(id) on delete cascade,
  chat_id bigint,
  text text not null,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists telegram_outbox_pending_idx on telegram_outbox (status, id);
alter table telegram_outbox enable row level security;
drop policy if exists "telegram_outbox_all" on telegram_outbox;
create policy "telegram_outbox_all" on telegram_outbox for all using (true) with check (true);

-- ============================================================
-- STORAGE: homework-media bucket (public o'qish, sayt yozadi/o'chiradi)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('homework-media', 'homework-media', true)
on conflict (id) do update set public = true;

drop policy if exists "homework_media_read" on storage.objects;
create policy "homework_media_read" on storage.objects
  for select using (bucket_id = 'homework-media');

drop policy if exists "homework_media_insert" on storage.objects;
create policy "homework_media_insert" on storage.objects
  for insert with check (bucket_id = 'homework-media');

drop policy if exists "homework_media_update" on storage.objects;
create policy "homework_media_update" on storage.objects
  for update using (bucket_id = 'homework-media');

drop policy if exists "homework_media_delete" on storage.objects;
create policy "homework_media_delete" on storage.objects
  for delete using (bucket_id = 'homework-media');

-- ============================================================
-- TO'LOVLAR TARIXI + AVTOMATIK OYLIK HISOB
-- ============================================================
alter table students add column if not exists fee_period text;

create table if not exists payments (
  id bigint generated always as identity primary key,
  student_id bigint references students(id) on delete cascade,
  amount bigint not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists payments_student_idx on payments (student_id, created_at);
alter table payments enable row level security;
drop policy if exists "payments_all" on payments;
create policy "payments_all" on payments for all using (true) with check (true);

-- ============================================================
-- GURUH TURI: 'school' (maktab, bepul) | 'tutoring' (repetitorlik)
-- Faqat ustoz panelida ko'rinadi — o'quvchilarga KO'RSATILMAYDI.
-- Maktab guruhi o'quvchilariga pul/to'lov/qarz haqidagi hech narsa chiqmaydi.
-- ============================================================
-- Mavjud guruhlar repetitorlik bo'lib qoladi (to'lovlari yashirilmaydi).
-- Yangi guruh qo'shishda ustoz panelida standart 'school' tanlanadi.
alter table groups add column if not exists group_type text not null default 'tutoring';
do $$ begin
  alter table groups add constraint groups_group_type_chk
    check (group_type in ('school', 'tutoring'));
exception when duplicate_object then null; end $$;
