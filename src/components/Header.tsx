import React from 'react';
import { ActiveTab, UserProfile } from '../types';
import {
  Building2,
  Calendar,
  FileSpreadsheet,
  Users,
  BarChart3,
  Edit3,
  BookOpen,
  LogOut,
  ShieldCheck,
  Eye,
  RotateCcw,
  UserCheck,
} from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: UserProfile;
  realAdminUser?: UserProfile;
  isRealAdmin?: boolean;
  users?: UserProfile[];
  onSwitchUser?: (userId: string) => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  realAdminUser,
  isRealAdmin = false,
  users = [],
  onSwitchUser,
  onLogout,
}) => {
  const isSimulating = isRealAdmin && realAdminUser && currentUser.id !== realAdminUser.id;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F2D59] flex items-center justify-center text-white shadow-md shadow-[#0F2D59]/20 relative">
              <Building2 className="w-5 h-5" />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#E50012] rounded-full border-2 border-white"></span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">LXMMA 제조고정비 선행추정</h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#0F2D59] border border-blue-200">
                  사내 통합 플랫폼
                </span>
              </div>
            </div>
          </div>

          {/* User Profile, Admin Switcher & Logout */}
          <div className="flex items-center space-x-3">
            {/* System Admin User Switcher (Only visible to authenticated system admins) */}
            {isRealAdmin && onSwitchUser && (
              <div className="flex items-center space-x-2 bg-amber-50/80 border border-amber-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <div className="flex items-center space-x-1.5 text-amber-900 text-xs font-semibold">
                  <Eye className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden sm:inline text-[11px]">사용자/권한 전환:</span>
                </div>
                <select
                  value={currentUser.id}
                  onChange={(e) => onSwitchUser(e.target.value)}
                  className="text-xs font-bold bg-white text-slate-800 border border-amber-300 rounded-lg px-2 py-1 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.role === 'operator'
                        ? `👑 ${u.name} (총괄 운영자)`
                        : `👤 ${u.name} [${u.department}]`}
                    </option>
                  ))}
                </select>

                {isSimulating && realAdminUser && (
                  <button
                    onClick={() => onSwitchUser(realAdminUser.id)}
                    className="inline-flex items-center space-x-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-bold transition-colors shadow-2xs cursor-pointer"
                    title="원래 관리자 권한으로 즉시 복귀"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>관리자 복귀</span>
                  </button>
                )}
              </div>
            )}

            {/* Current Active Profile Badge */}
            <div
              className={`flex items-center rounded-xl px-3 py-1.5 border space-x-2.5 ${
                isSimulating
                  ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/30'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  currentUser.role === 'operator'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-[#0F2D59]'
                }`}
              >
                {currentUser.role === 'operator' ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <UserCheck className="w-4 h-4" />
                )}
              </div>

              <div className="flex flex-col text-left">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-slate-800">{currentUser.name}</span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      currentUser.role === 'operator'
                        ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-700 border border-blue-500/20'
                    }`}
                  >
                    {currentUser.role === 'operator' ? '운영자' : `${currentUser.department} 담당자`}
                  </span>
                  {isSimulating && (
                    <span className="text-[9px] font-bold px-1 py-0.2 bg-amber-500 text-white rounded">
                      시점 전환
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono leading-tight">
                  {currentUser.email}
                </span>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors border border-slate-200 text-xs font-medium cursor-pointer"
                title="로그아웃"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            )}
          </div>
        </div>

        {/* Impersonation Banner Alert for Admins */}
        {isSimulating && (
          <div className="bg-amber-100/90 border border-amber-300 rounded-lg px-3 py-1.5 mb-2 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <b>[사용자 권한 화면 시뮬레이션 중]</b> 현재 <b>{currentUser.name} ({currentUser.department} 담당자)</b> 권한으로 화면을 확인하고 있습니다. 해당 부서의 입력 데이터만 수정 및 조회가 가능하며 관리자 전용 메뉴는 숨김 처리됩니다.
              </span>
            </div>
            {realAdminUser && (
              <button
                onClick={() => onSwitchUser && onSwitchUser(realAdminUser.id)}
                className="text-amber-800 underline font-bold hover:text-amber-950 shrink-0 ml-3 cursor-pointer"
              >
                관리자 화면으로 돌아가기
              </button>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto pb-px border-t border-slate-100 pt-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium rounded-t-lg transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#0F2D59]/10 text-[#0F2D59] border-b-2 border-[#0F2D59] font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>종합 대시보드</span>
          </button>

          <button
            onClick={() => setActiveTab('entry')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium rounded-t-lg transition-all cursor-pointer ${
              activeTab === 'entry'
                ? 'bg-[#0F2D59]/10 text-[#0F2D59] border-b-2 border-[#0F2D59] font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>부서별 자료 입력 및 수정</span>
          </button>

          {currentUser.role === 'operator' && (
            <>
              <button
                onClick={() => setActiveTab('gl_master')}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium rounded-t-lg transition-all cursor-pointer ${
                  activeTab === 'gl_master'
                    ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>GL계정 마스터</span>
              </button>

              <button
                onClick={() => setActiveTab('master')}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium rounded-t-lg transition-all cursor-pointer ${
                  activeTab === 'master'
                    ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>마스터 등록/관리</span>
              </button>

              <button
                onClick={() => setActiveTab('rounds')}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium rounded-t-lg transition-all cursor-pointer ${
                  activeTab === 'rounds'
                    ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>입력 회차 관리</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium rounded-t-lg transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>사용자 및 권한 관리</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

