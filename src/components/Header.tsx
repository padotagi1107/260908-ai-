import React from 'react';
import { ActiveTab, UserProfile } from '../types';
import { Building2, Calendar, FileSpreadsheet, Lock, Settings, ShieldCheck, Users, BarChart3, Edit3, BookOpen, LogOut } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: UserProfile;
  users: UserProfile[];
  onSwitchUser: (userId: string) => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  users,
  onSwitchUser,
  onLogout,
}) => {
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
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">LX MMA 사내 데이터 취합 플랫폼</h1>
              <p className="text-xs text-slate-500">부서별 데이터 공유 및 회차 마감 통제 시스템</p>
            </div>
          </div>

          {/* User Switcher & Logout */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
              <div className="px-2.5 py-1 flex items-center space-x-1.5">
                {currentUser.role === 'operator' ? (
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                ) : (
                  <Users className="w-4 h-4 text-blue-600" />
                )}
                <span className="text-xs font-semibold text-slate-700">
                  {currentUser.role === 'operator' ? '운영자' : `${currentUser.department} 담당자`}
                </span>
              </div>
              <select
                value={currentUser.id}
                onChange={(e) => onSwitchUser(e.target.value)}
                className="text-xs bg-white text-slate-700 font-medium py-1 px-2 rounded border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                title="사용자 모드 변경"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === 'operator' ? '운영자' : u.department})
                  </option>
                ))}
              </select>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors border border-slate-200"
                title="로그아웃"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto pb-px border-t border-slate-100 pt-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
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
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
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
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
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
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
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
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
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
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
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
