-- =====================================================================
-- LX MMA 예산/실적 관리 시스템 - Supabase Database Schema & RLS Setup
-- =====================================================================

-- 1. Authorized Users Table (인가된 사용자 관리 테이블)
create table if not exists public.authorized_users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  name text not null,
  department text not null,
  role text check (role in ('admin', 'manager', 'viewer')) default 'manager',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Master Items Table (마스터 항목 사전 테이블)
create table if not exists public.master_items (
  id text primary key,
  gl_code text not null,
  gl_name text not null,
  sub_item text not null,
  attribution text not null,
  dept text not null,
  manager text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. GL Master Table (GL 계정 마스터 테이블)
create table if not exists public.gl_master_items (
  id text primary key,
  code text unique not null,
  name text not null,
  category text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Rounds Table (입력 회차 관리 테이블)
create table if not exists public.rounds (
  id text primary key,
  name text not null,
  month integer not null,
  start_date text not null,
  end_date text not null,
  status text check (status in ('open', 'closed')) default 'open',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Entries Table (부서별 데이터 입력 테이블)
create table if not exists public.entries (
  id text primary key,
  round_id text references public.rounds(id) on delete cascade,
  master_id text references public.master_items(id) on delete cascade,
  dept text not null,
  m1 numeric default 0,
  m2 numeric default 0,
  m3 numeric default 0,
  m4 numeric default 0,
  m5 numeric default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. CSV Uploads Table (CSV 누적 저장소 테이블)
create table if not exists public.csv_uploads (
  id uuid default gen_random_uuid() primary key,
  file_name text not null,
  uploaded_by text not null,
  record_count integer not null,
  data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on all tables
alter table public.authorized_users enable row level security;
alter table public.master_items enable row level security;
alter table public.gl_master_items enable row level security;
alter table public.rounds enable row level security;
alter table public.entries enable row level security;
alter table public.csv_uploads enable row level security;

-- Basic RLS Policies (Allow authenticated access)
create policy "Allow authenticated users access to authorized_users"
  on public.authorized_users for all to authenticated using (true) with check (true);

create policy "Allow authenticated users access to master_items"
  on public.master_items for all to authenticated using (true) with check (true);

create policy "Allow authenticated users access to gl_master_items"
  on public.gl_master_items for all to authenticated using (true) with check (true);

create policy "Allow authenticated users access to rounds"
  on public.rounds for all to authenticated using (true) with check (true);

create policy "Allow authenticated users access to entries"
  on public.entries for all to authenticated using (true) with check (true);

create policy "Allow authenticated users access to csv_uploads"
  on public.csv_uploads for all to authenticated using (true) with check (true);

-- Insert sample authorized user
insert into public.authorized_users (email, name, department, role)
values ('admin@lxmma.com', '시스템관리자', 'IT보안팀', 'admin')
on conflict (email) do nothing;
