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

-- Realtime (ixtiyoriy): chat xabarlarini jonli yangilash uchun
-- Supabase Dashboard → Database → Replication → "messages" jadvalini yoqing.
--
-- Eslatma: hozirgi publishable kalit faqat o'qish/yozish beradi (DDL yo'q),
-- shuning uchun shu faylni bir marta ishga tushirish shart:
