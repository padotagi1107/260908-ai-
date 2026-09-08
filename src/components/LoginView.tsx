import React, { useState, useEffect } from 'react';
import {
  supabase,
  isSupabaseConfigured,
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
} from '../lib/supabase';
import {
  Lock,
  Mail,
  Key,
  ShieldCheck,
  Database,
  AlertCircle,
  CheckCircle2,
  Settings,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Code2,
  Copy,
  Check,
  UserPlus,
  LogIn,
  Building2,
  User,
} from 'lucide-react';
import { DEPARTMENTS } from '../initialData';
import { Department } from '../types';

interface LoginViewProps {
  onLoginSuccess: (userEmail: string, userName: string, role?: string, department?: string) => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState<Department>('노경');
  const [role, setRole] = useState<'admin' | 'manager' | 'viewer'>('manager');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Supabase Configuration State
  const [config, setConfig] = useState(getSupabaseConfig());
  const [dbUrl, setDbUrl] = useState(config.url);
  const [dbKey, setDbKey] = useState(config.anonKey);
  const [showKey, setShowKey] = useState(false);
  const [showConfigSection, setShowConfigSection] = useState(!isSupabaseConfigured);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    const current = getSupabaseConfig();
    setConfig(current);
    setDbUrl(current.url);
    setDbKey(current.anonKey);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase 연결 정보가 설정되지 않았습니다. 아래 [Supabase 연결 설정]에서 URL과 Key를 먼저 등록해주세요.');
      setShowConfigSection(true);
      return;
    }

    if (!email || !password) {
      setErrorMessage('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Supabase Auth 로그인 요청
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) throw error;

      if (data.user) {
        let userName = data.user.user_metadata?.name || cleanEmail.split('@')[0];
        let userDept = data.user.user_metadata?.department || '노경';
        let userRole = cleanEmail.includes('admin') || cleanEmail.includes('operator') ? 'admin' : 'manager';

        // 2. authorized_users 테이블 인가 여부 확인 (있으면 해당 정보 적용, 없으면 자동 인가 및 등록)
        try {
          const { data: authUser, error: authError } = await supabase
            .from('authorized_users')
            .select('*')
            .ilike('email', cleanEmail)
            .maybeSingle();

          if (authUser) {
            userName = authUser.name || userName;
            userDept = authUser.department || userDept;
            userRole = authUser.role || userRole;
          } else {
            // 테이블에 아직 등록되어 있지 않은 경우, 자동으로 인가 등록 시도
            await supabase.from('authorized_users').upsert(
              {
                email: cleanEmail,
                name: userName,
                department: userDept,
                role: userRole,
              },
              { onConflict: 'email' }
            );
          }
        } catch (dbErr) {
          // DB 테이블 미생성 등의 경우에도 Supabase Auth 로그인은 허용
          console.warn('authorized_users table check/upsert skipped:', dbErr);
        }

        setSuccessMessage(`로그인 성공: ${userName}님 환영합니다.`);
        setTimeout(() => {
          onLoginSuccess(cleanEmail, userName, userRole, userDept);
        }, 300);
      }
    } catch (err: any) {
      setErrorMessage(err.message || '로그인 중 오류가 발생했습니다. 이메일과 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase 연결 정보가 설정되지 않았습니다. 아래 [Supabase 연결 설정]에서 URL과 Key를 먼저 등록해주세요.');
      setShowConfigSection(true);
      return;
    }

    if (!email || !password || !name) {
      setErrorMessage('이메일, 비밀번호, 이름을 모두 입력해주세요.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('비밀번호는 최소 6자리 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Supabase Auth 계정 생성
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: name.trim(),
            department: department,
            role: role,
          },
        },
      });

      if (error) throw error;

      // 2. authorized_users 테이블에 사용자 정보 등록 시도
      try {
        await supabase.from('authorized_users').upsert(
          {
            email: cleanEmail,
            name: name.trim(),
            department: department,
            role: role,
          },
          { onConflict: 'email' }
        );
      } catch (dbErr) {
        console.warn('authorized_users table insert note:', dbErr);
      }

      if (data.session || data.user) {
        setSuccessMessage('계정이 성공적으로 등록되었습니다. 바로 로그인됩니다.');
        setTimeout(() => {
          onLoginSuccess(cleanEmail, name.trim(), role, department);
        }, 500);
      } else {
        setSuccessMessage('계정 등록이 완료되었습니다. (이메일 인증이 필요한 경우 메일함을 확인해주세요) 이제 로그인해주세요.');
        setAuthMode('login');
      }
    } catch (err: any) {
      setErrorMessage(err.message || '계정 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    onLoginSuccess('admin@lxmma.com', '시스템관리자 (데모)', 'admin', 'IT보안팀');
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUrl.trim() || !dbKey.trim()) {
      alert('Supabase URL과 Anon Key를 모두 입력해주세요.');
      return;
    }
    saveSupabaseConfig(dbUrl, dbKey);
  };

  const handleClearConfig = () => {
    if (confirm('저장된 Supabase 연동 정보를 초기화하시겠습니까?')) {
      clearSupabaseConfig();
    }
  };

  const sqlCode = `-- =====================================================================
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

-- Row Level Security (RLS) 활성화
alter table public.authorized_users enable row level security;
alter table public.master_items enable row level security;
alter table public.gl_master_items enable row level security;
alter table public.rounds enable row level security;
alter table public.entries enable row level security;
alter table public.csv_uploads enable row level security;

-- 기본 RLS 정책 등록 (익명 및 인증 사용자 권한 허용)
create policy "Allow all access to authorized_users"
  on public.authorized_users for all using (true) with check (true);

create policy "Allow all access to master_items"
  on public.master_items for all using (true) with check (true);

create policy "Allow all access to gl_master_items"
  on public.gl_master_items for all using (true) with check (true);

create policy "Allow all access to rounds"
  on public.rounds for all using (true) with check (true);

create policy "Allow all access to entries"
  on public.entries for all using (true) with check (true);

create policy "Allow all access to csv_uploads"
  on public.csv_uploads for all using (true) with check (true);

-- 초기 관리자 계정 인가 등록
insert into public.authorized_users (email, name, department, role)
values ('admin@lxmma.com', '시스템관리자', 'IT보안팀', 'admin')
on conflict (email) do nothing;`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0F2D59] to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50 my-6">
        {/* Header banner */}
        <div className="bg-[#0F2D59] px-8 py-7 text-white text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/15 rounded-full blur-2xl"></div>
          <div className="inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-md mb-3 border border-white/20">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">LX MMA 예산·실적 통합 플랫폼</h1>
          <p className="text-xs text-blue-200 mt-1">Supabase 연동 인증 및 데이터 관리 시스템</p>

          {/* Connection Status Badge */}
          <div className="mt-4 flex items-center justify-center space-x-2">
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md ${
                isSupabaseConfigured
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full mr-1.5 ${
                  isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              {isSupabaseConfigured ? 'Supabase 연동 완료' : 'Supabase 설정 필요'}
            </div>
          </div>
        </div>

        <div className="p-7 space-y-5">
          {/* Messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3 text-red-700 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3 text-emerald-700 text-xs leading-relaxed">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{successMessage}</div>
            </div>
          )}

          {/* 1. Supabase Configuration Section (Accordion / Card) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/70">
            <button
              type="button"
              onClick={() => setShowConfigSection(!showConfigSection)}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/80 transition-colors"
            >
              <div className="flex items-center space-x-2.5">
                <Database className="w-4 h-4 text-[#0F2D59]" />
                <span className="text-xs font-bold text-slate-800">Supabase 연결 설정</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    isSupabaseConfigured
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {isSupabaseConfigured ? '연동됨' : '미설정'}
                </span>
              </div>
              {showConfigSection ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {showConfigSection && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-200 bg-white">
                <p className="text-[11px] text-slate-500 mb-3">
                  Supabase 대시보드의 Project Settings &gt; API에서 확인 가능한 Project URL과 anon public key를 등록하세요.
                </p>

                <form onSubmit={handleSaveConfig} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Supabase Project URL
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="https://your-project.supabase.co"
                      value={dbUrl}
                      onChange={(e) => setDbUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Supabase Anon / Public Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        required
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        value={dbKey}
                        onChange={(e) => setDbKey(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white text-slate-900 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setShowSqlModal(true)}
                      className="inline-flex items-center space-x-1 text-[11px] text-[#0F2D59] hover:underline font-medium"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>DB 테이블 SQL 가이드</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      {isSupabaseConfigured && (
                        <button
                          type="button"
                          onClick={handleClearConfig}
                          className="px-2.5 py-1.5 text-[11px] text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors"
                        >
                          초기화
                        </button>
                      )}
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 text-[11px] font-semibold text-white bg-[#0F2D59] hover:bg-[#1B365D] rounded-lg shadow-xs transition-all"
                      >
                        설정 저장 및 적용
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* 2. Login & Sign Up Tab Selection */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 flex items-center justify-center space-x-1.5 transition-colors ${
                authMode === 'login'
                  ? 'border-[#0F2D59] text-[#0F2D59]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>로그인</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 flex items-center justify-center space-x-1.5 transition-colors ${
                authMode === 'signup'
                  ? 'border-[#0F2D59] text-[#0F2D59]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>신규 계정 등록</span>
            </button>
          </div>

          {/* 3. Login or Sign Up Form */}
          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">이메일 계정</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="example@lxmma.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white transition-all text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">비밀번호</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white transition-all text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#0F2D59] text-white font-semibold text-xs hover:bg-[#1B365D] shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{loading ? '인증 확인 중...' : '로그인 (Supabase Auth)'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">사용자 이름</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="홍길동"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white transition-all text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">이메일 계정</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="user@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white transition-all text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">비밀번호 (6자 이상)</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white transition-all text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">소속 부서</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as Department)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] text-slate-900 font-medium"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">권한 등급</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] text-slate-900 font-medium"
                  >
                    <option value="manager">부서 담당자 (manager)</option>
                    <option value="admin">총괄 관리자 (admin)</option>
                    <option value="viewer">조회 전용 (viewer)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#0F2D59] text-white font-semibold text-xs hover:bg-[#1B365D] shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-3"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{loading ? '계정 등록 중...' : '계정 등록 및 인가 완료'}</span>
              </button>
            </form>
          )}

          {/* Quick Demo Login */}
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={handleQuickDemoLogin}
              className="w-full py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium text-xs hover:bg-emerald-100 transition-colors flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>빠른 체험 로그인 (관리자 권한 데모)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SQL Script Guide Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2 text-[#0F2D59]">
                <Database className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900">Supabase 테이블 생성 SQL 스크립트</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1"
              >
                닫기
              </button>
            </div>

            <p className="text-xs text-slate-600 my-3">
              Supabase 대시보드 &gt; <b>SQL Editor</b>에서 아래 코드를 붙여넣고 실행(RUN)하여 테이블과 RLS 정책을 생성하세요.
            </p>

            <div className="relative flex-1 overflow-auto bg-slate-900 rounded-xl p-4 text-[11px] font-mono text-emerald-400 leading-relaxed border border-slate-800">
              <button
                onClick={copyToClipboard}
                className="sticky top-0 right-0 float-right px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] flex items-center space-x-1 border border-slate-700 shadow-sm"
              >
                {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSql ? '복사됨!' : '전체 복사'}</span>
              </button>
              <pre>{sqlCode}</pre>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2D59] rounded-lg hover:bg-[#1B365D]"
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
