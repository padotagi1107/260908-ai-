import React, { useState } from 'react';
import { supabase, isSupabaseConfigured, saveSupabaseConfig } from '../lib/supabase';
import { Lock, Mail, Key, ShieldCheck, Database, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (userEmail: string, userName: string) => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Supabase connection settings modal state
  const [showConfigModal, setShowConfigModal] = useState(!isSupabaseConfigured);
  const [dbUrl, setDbUrl] = useState('');
  const [dbKey, setDbKey] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase 환경 변수 또는 연결 정보가 설정되지 않았습니다. 설정 버튼을 눌러 연동 정보를 입력해주세요.');
      setShowConfigModal(true);
      return;
    }

    if (!email || !password) {
      setErrorMessage('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      // 1. Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // 2. Check if user is authorized in authorized_users table
        const { data: authUser, error: authError } = await supabase
          .from('authorized_users')
          .select('*')
          .eq('email', email)
          .single();

        if (authError || !authUser) {
          await supabase.auth.signOut();
          throw new Error('인가되지 않은 사용자 계정입니다. 시스템 관리자에게 문의하세요.');
        }

        onLoginSuccess(authUser.email, authUser.name);
      }
    } catch (err: any) {
      setErrorMessage(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    // Demo login for quick testing
    onLoginSuccess('admin@lxmma.com', '시스템관리자 (데모)');
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUrl || !dbKey) {
      alert('Supabase URL과 Anon Key를 모두 입력해주세요.');
      return;
    }
    saveSupabaseConfig(dbUrl, dbKey);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0F2D59] to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50">
        {/* Header banner */}
        <div className="bg-[#0F2D59] px-8 py-8 text-white text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl"></div>
          <div className="inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-md mb-4 border border-white/20">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">LX MMA 예산·실적 통합 플랫폼</h1>
          <p className="text-xs text-blue-200 mt-1">Supabase 인증 및 데이터 누적 관리 시스템</p>
        </div>

        <div className="p-8">
          {errorMessage && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">이메일 주소</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="admin@lxmma.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white transition-all text-slate-900"
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
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white transition-all text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#0F2D59] text-white font-semibold text-sm hover:bg-[#1B365D] shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{loading ? '로그인 인증 중...' : '로그인 (Supabase Auth)'}</span>
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
            <button
              onClick={handleQuickDemoLogin}
              className="w-full py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium text-xs hover:bg-emerald-100 transition-colors flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>빠른 체험 로그인 (관리자 권한 우회)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="text-xs text-slate-500 hover:text-[#0F2D59] underline text-center"
            >
              Supabase 프로젝트 연동 설정 변경하기
            </button>
          </div>
        </div>
      </div>

      {/* Supabase Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-xl bg-blue-50 text-[#0F2D59]">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Supabase 연결 설정</h3>
                <p className="text-xs text-slate-500">프로젝트의 Supabase URL 및 Anon Key를 입력해주세요.</p>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supabase URL</label>
                <input
                  type="text"
                  required
                  placeholder="https://your-project.supabase.co"
                  value={dbUrl}
                  onChange={(e) => setDbUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2D59]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supabase Anon / Public Key</label>
                <input
                  type="password"
                  required
                  placeholder="eyJhbGciOi..."
                  value={dbKey}
                  onChange={(e) => setDbKey(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2D59]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  닫기
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2D59] rounded-lg hover:bg-[#1B365D]"
                >
                  저장 및 적용
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
