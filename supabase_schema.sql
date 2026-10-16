-- =====================================================================
-- LX MMA 제조고정비 선행추정 관리 시스템 - Supabase Database Schema
-- =====================================================================

-- 1. 인가된 사용자 테이블 (authorized_users)
create table if not exists public.authorized_users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  name text not null,
  department text not null,
  role text check (role in ('admin', 'manager', 'viewer')) default 'manager',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. GL 계정 마스터 테이블 (gl_master_items)
create table if not exists public.gl_master_items (
  id text primary key,
  gl_code text unique not null,
  gl_name text not null,
  category text default '제조고정비',
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. 마스터 항목 사전 테이블 (master_items)
create table if not exists public.master_items (
  id text primary key,
  key_no integer,
  gl_code text not null,
  gl_name text not null,
  sub_item text not null,
  attribution text not null,
  dept text not null,
  manager text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. 입력 회차 관리 테이블 (rounds)
create table if not exists public.rounds (
  id text primary key,
  name text not null,
  month integer not null,
  seq integer default 1,
  start_date text not null,
  end_date text not null,
  status text check (status in ('open', 'closed')) default 'open',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. 선행추정 부서별 데이터 입력 테이블 (entries)
create table if not exists public.entries (
  id text primary key, -- `${round_id}_${master_id}`
  round_id text references public.rounds(id) on delete cascade,
  master_id text references public.master_items(id) on delete cascade,
  dept text not null,
  m1 numeric,
  m2 numeric,
  m3 numeric,
  m4 numeric,
  m5 numeric,
  reason text, -- 1천만원 이상 차이사유 등
  updated_by text, -- 최근 수정한 사용자명
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. CSV 백업/누적 저장 테이블 (csv_uploads)
create table if not exists public.csv_uploads (
  id uuid default gen_random_uuid() primary key,
  file_name text not null,
  uploaded_by text not null,
  record_count integer not null,
  data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Row Level Security) 활성화
alter table public.authorized_users enable row level security;
alter table public.gl_master_items enable row level security;
alter table public.master_items enable row level security;
alter table public.rounds enable row level security;
alter table public.entries enable row level security;
alter table public.csv_uploads enable row level security;

-- 누구나 읽기/쓰기 허용 정책 (인증 키 또는 anon key 사용 환경)
create policy "Allow all operations for authorized_users"
  on public.authorized_users for all using (true) with check (true);

create policy "Allow all operations for gl_master_items"
  on public.gl_master_items for all using (true) with check (true);

create policy "Allow all operations for master_items"
  on public.master_items for all using (true) with check (true);

create policy "Allow all operations for rounds"
  on public.rounds for all using (true) with check (true);

create policy "Allow all operations for entries"
  on public.entries for all using (true) with check (true);

create policy "Allow all operations for csv_uploads"
  on public.csv_uploads for all using (true) with check (true);

-- 초기 관리자 기본 등록
insert into public.authorized_users (email, name, department, role)
values ('admin@lxmma.com', '시스템관리자', 'IT보안팀', 'admin')
on conflict (email) do nothing;
