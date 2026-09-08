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
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Code2,
  Copy,
  Check,
  HelpCircle,
  RefreshCw,
  LogIn,
  Settings,
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (userEmail: string, userName: string, role?: string, department?: string) => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Supabase Configuration State
  const [config, setConfig] = useState(getSupabaseConfig());
  const [dbUrl, setDbUrl] = useState(config.url);
  const [dbKey, setDbKey] = useState(config.anonKey);
  const [showKey, setShowKey] = useState(false);
  const [showConfigSection, setShowConfigSection] = useState(!isSupabaseConfigured);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    const current = getSupabaseConfig();
    setConfig(current);
    setDbUrl(current.url);
    setDbKey(current.anonKey);
  }, []);

  const formatAuthError = (err: any): string => {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
      return '이메일 또는 비밀번호가 일치하지 않습니다. 등록된 계정 정보를 다시 확인해주세요.';
    }
    if (msg.includes('email not confirmed')) {
      return '이메일 인증이 완료되지 않았습니다. Supabase 대시보드 [Authentication > Providers > Email]에서 [Confirm email] 옵션을 비활성화(OFF)하시거나, [Users] 탭에서 해당 사용자의 [Confirm email]을 눌러주세요.';
    }
    if (msg.includes('user already registered') || msg.includes('already registered')) {
      return '이미 등록된 이메일 계정입니다. 비밀번호를 입력해 로그인해주세요.';
    }
    if (msg.includes('password should be at least 6') || msg.includes('weak_password')) {
      return '비밀번호는 최소 6자 이상으로 설정해주세요.';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
      return 'Supabase 서버에 연결할 수 없습니다. Supabase URL과 인터넷 연결 상태를 확인해주세요.';
    }
    if (msg.includes('api key') || msg.includes('jwt') || msg.includes('apikey')) {
      return 'Supabase Anon Key(API 키)가 유효하지 않습니다. 운영자 설정을 확인해주세요.';
    }
    return err?.message || '인증 처리 중 오류가 발생했습니다.';
  };

  const handleTestConnection = async () => {
    if (!dbUrl.trim() || !dbKey.trim()) {
      setTestResult({ success: false, message: 'URL과 Key를 모두 입력해주세요.' });
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      if (!supabase) {
        setTestResult({ success: false, message: 'Supabase 클라이언트가 초기화되지 않았습니다. 설정을 먼저 저장해주세요.' });
        return;
      }
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      setTestResult({ success: true, message: 'Supabase 서버와 정상적으로 통신되었습니다.' });
    } catch (err: any) {
      setTestResult({ success: false, message: `연결 실패: ${err?.message || 'URL 또는 Key 확인 필요'}` });
    } finally {
      setTestingConnection(false);
    }
  };

  // 1. Supabase Auth Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase 연결 설정이 완료되지 않았습니다. 아래 [운영자 Supabase 연동 설정]에서 URL과 Anon Key를 먼저 설정해주세요.');
      setShowConfigSection(true);
      return;
    }

    if (!email.trim()) {
      setErrorMessage('이메일을 입력해주세요.');
      return;
    }
    if (!password) {
      setErrorMessage('비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) throw error;

      if (data?.user) {
        let userName = data.user.user_metadata?.name || cleanEmail.split('@')[0];
        let userDept = data.user.user_metadata?.department || '노경';
        let userRole = data.user.user_metadata?.role || (cleanEmail.includes('admin') || cleanEmail.includes('operator') ? 'operator' : 'dept_user');

        // Check authorized_users table in Supabase
        try {
          const { data: authUser } = await supabase
            .from('authorized_users')
            .select('*')
            .ilike('email', cleanEmail)
            .maybeSingle();

          if (authUser) {
            userName = authUser.name || userName;
            userDept = authUser.department || userDept;
            userRole = authUser.role === 'admin' ? 'operator' : authUser.role;
          }
        } catch (dbErr) {
          console.warn('authorized_users lookup notice:', dbErr);
        }

        setSuccessMessage(`로그인 성공! [${userName}]님 환영합니다.`);
        setTimeout(() => {
          onLoginSuccess(cleanEmail, userName, userRole, userDept);
        }, 300);
      } else {
        throw new Error('사용자 인증 세션을 가져오지 못했습니다.');
      }
    } catch (err: any) {
      setErrorMessage(formatAuthError(err));
    } finally {
      setLoading(false);
    }
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

-- 모든 사용자 읽기/쓰기 허용 정책 (Anon 및 Authenticated)
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
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50 my-6">
        {/* Header banner */}
        <div className="bg-[#0F2D59] px-8 py-7 text-white text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/15 rounded-full blur-2xl"></div>
          <div className="inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-md mb-3 border border-white/20">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">LXMMA 제조고정비 선행추정</h1>
          <p className="text-xs text-blue-200 mt-1">부서별 제조고정비 취합 및 추정 관리 시스템</p>

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
              {isSupabaseConfigured ? 'Supabase 인증 서버 연결됨' : 'Supabase 설정 필요 (운영자)'}
            </div>
          </div>
        </div>

        <div className="p-7 space-y-5">
          {/* Messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3 text-red-700 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
              <div className="flex-1">
                <div className="font-semibold text-red-800 mb-0.5">인증 오류 안내</div>
                <div>{errorMessage}</div>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3 text-emerald-700 text-xs leading-relaxed">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{successMessage}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">이메일 계정 (ID)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="user@lxmma.com"
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
              className="w-full py-2.5 rounded-xl bg-[#0F2D59] text-white font-semibold text-xs hover:bg-[#1B365D] shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-2 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{loading ? 'Supabase 인증 중...' : 'Supabase 인증 로그인'}</span>
            </button>
          </form>

          {/* Admin Supabase Configuration Section */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/70 pt-1">
            <button
              type="button"
              onClick={() => setShowConfigSection(!showConfigSection)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-100/80 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] font-semibold text-slate-700">
                  운영자 Supabase 연동 설정
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    isSupabaseConfigured
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isSupabaseConfigured ? '연동 완료' : '설정 필요'}
                </span>
              </div>
              {showConfigSection ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {showConfigSection && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-200 bg-white space-y-3">
                <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg text-[11px] text-blue-900 leading-relaxed">
                  <div className="font-bold mb-1">💡 사용자가 설정 입력을 안 하게 하려면?</div>
                  <div>
                    <strong>Vercel 대시보드</strong> &gt; <strong>Project Settings</strong> &gt; <strong>Environment Variables</strong>에 아래 두 변수를 등록하시면 모든 사용자에게 설정창 없이 바로 로그인 폼만 제공됩니다:
                    <ul className="list-disc pl-4 mt-1 font-mono text-[10px] text-blue-800 space-y-0.5">
                      <li><code>VITE_SUPABASE_URL</code></li>
                      <li><code>VITE_SUPABASE_ANON_KEY</code></li>
                    </ul>
                  </div>
                </div>

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
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0F2D59] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Supabase anon public key (API Key)
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        required
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        value={dbKey}
                        onChange={(e) => setDbKey(e.target.value)}
                        className="w-full pl-3 pr-10 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0F2D59] font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowSqlModal(true)}
                        className="inline-flex items-center space-x-1 text-[11px] text-blue-600 hover:underline font-medium"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>DB 스키마 SQL</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowHelpModal(true)}
                        className="inline-flex items-center space-x-1 text-[11px] text-blue-600 hover:underline font-medium"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>문제해결</span>
                      </button>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testingConnection}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${testingConnection ? 'animate-spin' : ''}`} />
                        <span>{testingConnection ? '확인 중' : '연결 테스트'}</span>
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-[#0F2D59] text-[11px] font-semibold text-white hover:bg-[#1B365D]"
                      >
                        설정 저장
                      </button>
                    </div>
                  </div>

                  {testResult && (
                    <div
                      className={`p-2 rounded-lg text-[11px] flex items-center space-x-2 ${
                        testResult.success
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}

                  {isSupabaseConfigured && (
                    <div className="pt-1 text-right">
                      <button
                        type="button"
                        onClick={handleClearConfig}
                        className="text-[10px] text-red-500 hover:underline cursor-pointer"
                      >
                        연동 정보 초기화
                      </button>
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SQL Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <Code2 className="w-5 h-5 text-[#0F2D59]" />
                <h3 className="font-bold text-slate-900 text-sm">Supabase 초기 테이블 생성 SQL 스크립트</h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-3">
              <p className="text-xs text-slate-600">
                Supabase 대시보드의 <strong>SQL Editor</strong> &gt; <strong>New Query</strong>에 붙여넣고 <strong>Run</strong>을 누르면 시스템에 필요한 테이블 6개와 인가 정책이 자동 생성됩니다.
              </p>
              <div className="relative">
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
                  {sqlCode}
                </pre>
                <button
                  onClick={copyToClipboard}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 flex items-center space-x-1 shadow-md"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? '복사됨' : 'SQL 복사'}</span>
                </button>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 text-right">
              <button
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Supabase 로그인 문제해결 가이드</h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs text-slate-700 leading-relaxed max-h-[75vh] overflow-y-auto">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <div className="font-bold text-amber-900 mb-1">1. "Email not confirmed" 오류 발생 시</div>
                <p className="text-amber-800">
                  Supabase 대시보드 &gt; <strong>Authentication</strong> &gt; <strong>Providers</strong> &gt; <strong>Email</strong>에서 <strong>"Confirm email"</strong> 스위치를 <strong>OFF</strong>로 끄고 Save를 눌러주세요. (이메일 인증 절차 없이 즉시 로그인 가능)
                </p>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div className="font-bold text-blue-900 mb-1">2. "Invalid login credentials" 오류 발생 시</div>
                <p className="text-blue-800">
                  해당 사용자가 Supabase Auth에 아직 등록되지 않았거나 비밀번호가 틀렸습니다. Supabase 대시보드 &gt; <strong>Authentication</strong> &gt; <strong>Users</strong>에서 <strong>Add user</strong>로 계정을 생성하거나 비밀번호를 확인해주세요.
                </p>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 mb-1">3. Vercel 환경변수 영구 등록 방법</div>
                <p className="text-slate-700">
                  Vercel 대시보드 &gt; Project Settings &gt; Environment Variables에 <code>VITE_SUPABASE_URL</code> 및 <code>VITE_SUPABASE_ANON_KEY</code>를 등록하고 Redeploy하시면 모든 사용자가 URL/Key 입력 없이 바로 로그인 폼만 보게 됩니다.
                </p>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 text-right">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl bg-[#0F2D59] text-white text-xs font-semibold hover:bg-[#1B365D]"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
