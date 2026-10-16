import React, { useState, useEffect } from 'react';
import { ActiveTab, EntryData, MasterItem, GLMasterItem, Round, UserProfile, Department } from './types';
import { INITIAL_MASTER_ITEMS, INITIAL_GL_MASTER_ITEMS, INITIAL_ROUNDS, INITIAL_USERS } from './initialData';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { DataEntryView } from './components/DataEntryView';
import { MasterManagement } from './components/MasterManagement';
import { GLMasterManagement } from './components/GLMasterManagement';
import { RoundManagement } from './components/RoundManagement';
import { UserManagement } from './components/UserManagement';
import { AIChatView } from './components/AIChatView';
import { LoginView } from './components/LoginView';
import {
  isSupabaseConfigured,
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  supabase,
  syncUserToSupabase,
  deleteUserFromSupabase,
  fetchAuthorizedUsersFromSupabase,
  fetchEntriesFromSupabase,
  upsertEntriesToSupabase,
  fetchRoundsFromSupabase,
  upsertRoundToSupabase,
  deleteRoundFromSupabase,
  fetchMasterItemsFromSupabase,
  upsertMasterItemToSupabase,
  deleteMasterItemFromSupabase,
  fetchGLMasterFromSupabase,
  upsertGLMasterToSupabase,
  deleteGLMasterFromSupabase,
  migrateLocalDataToSupabase,
} from './lib/supabase';
import { Database, X, Check, Copy, AlertTriangle, ArrowUpRight } from 'lucide-react';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('company_platform_auth') === 'true';
  });
  const [authEmail, setAuthEmail] = useState<string>(() => {
    return localStorage.getItem('company_platform_auth_email') || '';
  });

  // Load state from localStorage or initial defaults
  const [users, setUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('company_platform_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem('company_platform_current_user');
    return saved || INITIAL_USERS[0].id;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const [rounds, setRounds] = useState<Round[]>(() => {
    const saved = localStorage.getItem('company_platform_rounds');
    return saved ? JSON.parse(saved) : INITIAL_ROUNDS;
  });

  const [masterItems, setMasterItems] = useState<MasterItem[]>(() => {
    const saved = localStorage.getItem('company_platform_master');
    return saved ? JSON.parse(saved) : INITIAL_MASTER_ITEMS;
  });

  const [glMasterItems, setGlMasterItems] = useState<GLMasterItem[]>(() => {
    const saved = localStorage.getItem('company_platform_gl_master');
    return saved ? JSON.parse(saved) : INITIAL_GL_MASTER_ITEMS;
  });

  const [entries, setEntries] = useState<EntryData[]>(() => {
    const saved = localStorage.getItem('company_platform_entries');
    if (saved) return JSON.parse(saved);
    return [
      { id: '9-1_m-1', roundId: '9-1', masterId: 'm-1', dept: '노경', m1: 1500000, m2: 1550000, m3: 1600000, m4: 1620000, m5: 1650000, reason: '' },
      { id: '9-1_m-3', roundId: '9-1', masterId: 'm-3', dept: '환경안전', m1: 450000, m2: 480000, m3: 500000, m4: 520000, m5: 530000, reason: '' },
      { id: '9-1_m-5', roundId: '9-1', masterId: 'm-5', dept: 'IT보안팀', m1: 890000, m2: 890000, m3: 950000, m4: 950000, m5: 980000, reason: '' },
      { id: '9-1_m-7', roundId: '9-1', masterId: 'm-7', dept: '구매', m1: 3200000, m2: 3400000, m3: 3100000, m4: 3500000, m5: 3600000, reason: '' },
      { id: '9-1_m-9', roundId: '9-1', masterId: 'm-9', dept: '기술팀', m1: 1200000, m2: 1250000, m3: 1300000, m4: 1350000, m5: 1400000, reason: '' },
    ];
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);

  // Local sync to localStorage as cache
  useEffect(() => {
    localStorage.setItem('company_platform_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('company_platform_current_user', currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem('company_platform_rounds', JSON.stringify(rounds));
  }, [rounds]);

  useEffect(() => {
    localStorage.setItem('company_platform_master', JSON.stringify(masterItems));
  }, [masterItems]);

  useEffect(() => {
    localStorage.setItem('company_platform_gl_master', JSON.stringify(glMasterItems));
  }, [glMasterItems]);

  useEffect(() => {
    localStorage.setItem('company_platform_entries', JSON.stringify(entries));
  }, [entries]);

  // Load latest data from Supabase DB
  const loadRemoteData = async (showNotification = false) => {
    if (!isSupabaseConfigured) {
      if (showNotification) {
        alert(
          '현재 로컬 모드입니다. 상단 [로컬 모드 (DB 설정)]에서 Supabase URL과 Key를 설정하시면 다른 PC와 실시간 공동 취합이 활성화됩니다.'
        );
      }
      return;
    }

    setIsRefreshing(true);
    try {
      const [remoteRounds, remoteMasters, remoteGL, remoteEntries, remoteUsers] = await Promise.all([
        fetchRoundsFromSupabase(),
        fetchMasterItemsFromSupabase(),
        fetchGLMasterFromSupabase(),
        fetchEntriesFromSupabase(),
        fetchAuthorizedUsersFromSupabase(),
      ]);

      const stats: string[] = [];

      if (remoteRounds && remoteRounds.length > 0) {
        setRounds(remoteRounds);
        stats.push(`회차 ${remoteRounds.length}건`);
      }
      if (remoteMasters && remoteMasters.length > 0) {
        setMasterItems(remoteMasters);
        stats.push(`마스터 ${remoteMasters.length}건`);
      }
      if (remoteGL && remoteGL.length > 0) {
        setGlMasterItems(remoteGL);
        stats.push(`GL ${remoteGL.length}건`);
      }
      if (remoteEntries && remoteEntries.length > 0) {
        setEntries(remoteEntries);
        stats.push(`입력값 ${remoteEntries.length}건`);
      }
      if (remoteUsers && remoteUsers.length > 0) {
        setUsers((prevUsers) => {
          let changed = false;
          const updated = [...prevUsers];
          remoteUsers.forEach((ru: any) => {
            const email = (ru.email || '').trim().toLowerCase();
            if (!email) return;
            const idx = updated.findIndex((u) => u.email.trim().toLowerCase() === email);
            const role: 'operator' | 'dept_user' = ru.role === 'admin' ? 'operator' : 'dept_user';
            const dept = role === 'operator' ? undefined : (ru.department as Department);

            if (idx >= 0) {
              if (dept && updated[idx].department !== dept) {
                updated[idx] = { ...updated[idx], department: dept, role };
                changed = true;
              }
            } else {
              updated.push({
                id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                name: ru.name || email.split('@')[0],
                email: ru.email,
                role: role,
                department: dept,
              });
              changed = true;
            }
          });
          return changed ? updated : prevUsers;
        });
      }

      if (showNotification) {
        if (stats.length > 0) {
          alert(`최신 데이터를 데이터베이스에서 성공적으로 불러왔습니다.\n\n- 동기화 내역: ${stats.join(', ')}`);
        } else {
          alert('데이터베이스에 연결되었습니다. (아직 등록된 원격 데이터가 없어 로컬 데이터를 유지합니다)');
        }
      }
    } catch (err: any) {
      console.warn('Failed to load remote data from Supabase:', err);
      if (showNotification) {
        alert(`데이터 불러오기 중 오류가 발생했습니다: ${err?.message || err}`);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    loadRemoteData(false);
  }, []);

  const handleLoginSuccess = (email: string, name: string, role?: string, department?: string) => {
    setIsAuthenticated(true);
    setAuthEmail(email);
    localStorage.setItem('company_platform_auth', 'true');
    localStorage.setItem('company_platform_auth_email', email);

    const isOperator =
      role === 'admin' ||
      role === 'operator' ||
      email.toLowerCase().includes('admin') ||
      email.toLowerCase().includes('operator');

    const existingIndex = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existingIndex >= 0) {
      const existingUser = users[existingIndex];
      const finalDept: Department | undefined = isOperator
        ? undefined
        : (existingUser.department || (department as Department) || '노경');

      const updatedUsers = [...users];
      updatedUsers[existingIndex] = {
        ...existingUser,
        name: name || existingUser.name,
        role: isOperator ? 'operator' : (existingUser.role || 'dept_user'),
        department: finalDept,
      };
      setUsers(updatedUsers);
      setCurrentUserId(updatedUsers[existingIndex].id);
    } else {
      let determinedDept = department as Department | undefined;
      if (!determinedDept && !isOperator) {
        const matchedMaster = masterItems.find(
          (m) =>
            m.manager &&
            (email.toLowerCase().includes(m.manager.toLowerCase()) ||
              (name && m.manager.trim() === name.trim()))
        );
        if (matchedMaster?.dept) {
          determinedDept = matchedMaster.dept;
        }
      }
      if (!determinedDept && !isOperator) {
        determinedDept = '노경';
      }

      const newUser: UserProfile = {
        id: `usr-${Date.now()}`,
        name: name || email.split('@')[0],
        email: email,
        role: isOperator ? 'operator' : 'dept_user',
        department: isOperator ? undefined : determinedDept,
      };
      setUsers((prev) => [...prev, newUser]);
      setCurrentUserId(newUser.id);
    }

    // Refresh DB data upon login
    loadRemoteData(false);
  };

  const handleLogout = async () => {
    setIsAuthenticated(false);
    setAuthEmail('');
    localStorage.removeItem('company_platform_auth');
    localStorage.removeItem('company_platform_auth_email');
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase sign out:', err);
      }
    }
  };

  // Identify logged in user
  const realAuthenticatedUser: UserProfile = users.find(
    (u) => u.email.toLowerCase() === authEmail.toLowerCase()
  ) || {
    id: 'usr-op',
    name: '총괄 운영자',
    email: authEmail || 'operator@company.com',
    role: 'operator',
  };

  const isRealAdmin =
    realAuthenticatedUser.role === 'operator' ||
    authEmail.toLowerCase().includes('admin') ||
    authEmail.toLowerCase().includes('operator');

  const currentUser: UserProfile = isRealAdmin
    ? users.find((u) => u.id === currentUserId) || realAuthenticatedUser
    : realAuthenticatedUser;

  const handleSwitchUser = (userId: string) => {
    if (!isRealAdmin) return;
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser) {
      setCurrentUserId(userId);
      if (
        targetUser.role !== 'operator' &&
        ['gl_master', 'master', 'rounds', 'users'].includes(activeTab)
      ) {
        setActiveTab('entry');
      }
    }
  };

  // If not authenticated, render LoginView
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // GL Master Handlers
  const handleAddGLMasterItem = async (item: Omit<GLMasterItem, 'id'>) => {
    const newItem: GLMasterItem = { ...item, id: `gl-${Date.now()}` };
    setGlMasterItems([...glMasterItems, newItem]);
    if (isSupabaseConfigured) {
      await upsertGLMasterToSupabase(newItem);
    }
  };

  const handleUpdateGLMasterItem = async (updated: GLMasterItem) => {
    setGlMasterItems(glMasterItems.map((g) => (g.id === updated.id ? updated : g)));
    if (isSupabaseConfigured) {
      await upsertGLMasterToSupabase(updated);
    }
  };

  const handleDeleteGLMasterItem = async (id: string) => {
    setGlMasterItems(glMasterItems.filter((g) => g.id !== id));
    if (isSupabaseConfigured) {
      await deleteGLMasterFromSupabase(id);
    }
  };

  // Master Handlers
  const handleAddMasterItem = async (item: Omit<MasterItem, 'id'>) => {
    const newItem: MasterItem = { ...item, id: `m-${Date.now()}` };
    setMasterItems([...masterItems, newItem]);
    if (isSupabaseConfigured) {
      await upsertMasterItemToSupabase(newItem);
    }
  };

  const handleUpdateMasterItem = async (updated: MasterItem) => {
    setMasterItems(masterItems.map((m) => (m.id === updated.id ? updated : m)));
    if (isSupabaseConfigured) {
      await upsertMasterItemToSupabase(updated);
    }
  };

  const handleDeleteMasterItem = async (id: string) => {
    setMasterItems(masterItems.filter((m) => m.id !== id));
    if (isSupabaseConfigured) {
      await deleteMasterItemFromSupabase(id);
    }
  };

  // Round Handlers
  const handleAddRound = async (round: Omit<Round, 'status'>) => {
    const newRound: Round = { ...round, status: 'open' };
    setRounds([newRound, ...rounds]);
    if (isSupabaseConfigured) {
      await upsertRoundToSupabase(newRound);
    }
  };

  const handleToggleRoundStatus = async (roundId: string) => {
    const target = rounds.find((r) => r.id === roundId);
    if (!target) return;
    const nextStatus = target.status === 'open' ? 'closed' : 'open';
    const updatedRound: Round = { ...target, status: nextStatus };
    setRounds(rounds.map((r) => (r.id === roundId ? updatedRound : r)));
    if (isSupabaseConfigured) {
      await upsertRoundToSupabase(updatedRound);
    }
  };

  const handleDeleteRound = async (roundId: string) => {
    setRounds(rounds.filter((r) => r.id !== roundId));
    if (isSupabaseConfigured) {
      await deleteRoundFromSupabase(roundId);
    }
  };

  // User Handlers
  const handleAddUser = (user: Omit<UserProfile, 'id'>) => {
    const newUser: UserProfile = { ...user, id: `usr-${Date.now()}` };
    setUsers([...users, newUser]);
    syncUserToSupabase(newUser);
  };

  const handleUpdateUser = (updated: UserProfile) => {
    setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
    syncUserToSupabase(updated);
  };

  const handleDeleteUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (userId === currentUserId || target?.email.toLowerCase() === authEmail.toLowerCase()) {
      alert('현재 로그인 중인 계정은 삭제할 수 없습니다.');
      return;
    }
    if (users.length <= 1) {
      alert('최소 1명의 사용자가 필요합니다.');
      return;
    }
    setUsers(users.filter((u) => u.id !== userId));
    if (target?.email) {
      deleteUserFromSupabase(target.email);
    }
  };

  // Requirement 2: Entry Batch Save (Saves ONLY changed items, checks DB confirmation)
  const handleBatchSaveEntries = async (batch: EntryData[]): Promise<{ success: boolean; error?: string }> => {
    if (batch.length === 0) return { success: true };

    // 1. If Supabase is configured, attempt remote DB upsert
    if (isSupabaseConfigured) {
      const res = await upsertEntriesToSupabase(batch);
      if (!res.success) {
        return { success: false, error: res.error };
      }
    }

    // 2. Update local state and localStorage cache
    setEntries((prev) => {
      const map = new Map<string, EntryData>();
      prev.forEach((e) => map.set(`${e.roundId}_${e.masterId}`, e));
      batch.forEach((e) => map.set(`${e.roundId}_${e.masterId}`, e));
      return Array.from(map.values());
    });

    return { success: true };
  };

  const handleSaveEntry = async (newEntry: EntryData): Promise<{ success: boolean; error?: string }> => {
    return handleBatchSaveEntries([newEntry]);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        realAdminUser={realAuthenticatedUser}
        isRealAdmin={isRealAdmin}
        users={users}
        onSwitchUser={isRealAdmin ? handleSwitchUser : undefined}
        onLogout={handleLogout}
        onRefreshData={() => loadRemoteData(true)}
        isRefreshing={isRefreshing}
        isSupabaseConnected={isSupabaseConfigured}
        onOpenDbConfig={() => setIsDbModalOpen(true)}
      />

      <main className="flex-1 pb-16">
        {activeTab === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            rounds={rounds}
            masterItems={masterItems}
            entries={entries}
            onNavigateToAiChat={() => setActiveTab('ai_chat')}
          />
        )}
        {activeTab === 'entry' && (
          <DataEntryView
            currentUser={currentUser}
            rounds={rounds}
            masterItems={masterItems}
            entries={entries}
            onSaveEntry={handleSaveEntry}
            onBatchSaveEntries={handleBatchSaveEntries}
          />
        )}
        {activeTab === 'ai_chat' && (
          <AIChatView
            currentUser={currentUser}
            rounds={rounds}
            masterItems={masterItems}
            entries={entries}
          />
        )}
        {activeTab === 'gl_master' && currentUser.role === 'operator' && (
          <GLMasterManagement
            glMasterItems={glMasterItems}
            onAddGLMasterItem={handleAddGLMasterItem}
            onUpdateGLMasterItem={handleUpdateGLMasterItem}
            onDeleteGLMasterItem={handleDeleteGLMasterItem}
          />
        )}
        {activeTab === 'master' && currentUser.role === 'operator' && (
          <MasterManagement
            masterItems={masterItems}
            glMasterItems={glMasterItems}
            onAddMasterItem={handleAddMasterItem}
            onUpdateMasterItem={handleUpdateMasterItem}
            onDeleteMasterItem={handleDeleteMasterItem}
          />
        )}
        {activeTab === 'rounds' && currentUser.role === 'operator' && (
          <RoundManagement
            rounds={rounds}
            users={users}
            masterItems={masterItems}
            entries={entries}
            onAddRound={handleAddRound}
            onToggleRoundStatus={handleToggleRoundStatus}
            onDeleteRound={handleDeleteRound}
          />
        )}
        {activeTab === 'users' && currentUser.role === 'operator' && (
          <UserManagement
            currentUser={currentUser}
            users={users}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onSwitchUser={isRealAdmin ? handleSwitchUser : undefined}
          />
        )}
      </main>

      {/* Supabase DB Connection & Environment Settings Modal */}
      {isDbModalOpen && (
        <DbConfigModal
          isOpen={isDbModalOpen}
          onClose={() => setIsDbModalOpen(false)}
          onMigrate={async () => {
            const res = await migrateLocalDataToSupabase(rounds, masterItems, glMasterItems, entries);
            alert(res.message);
            if (res.success) {
              loadRemoteData(false);
            }
          }}
        />
      )}
    </div>
  );
}

// Subcomponent: DB Configuration & Migration Modal
function DbConfigModal({
  isOpen,
  onClose,
  onMigrate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onMigrate: () => Promise<void>;
}) {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [isMigrating, setIsMigrating] = useState(false);

  const handleSave = () => {
    if (!url.trim() || !anonKey.trim()) {
      alert('URL과 Anon Key를 모두 입력해 주세요.');
      return;
    }
    saveSupabaseConfig(url, anonKey);
  };

  const handleClear = () => {
    if (confirm('설정된 Supabase 접속 정보를 삭제하고 로컬 모드로 전환하시겠습니까?')) {
      clearSupabaseConfig();
    }
  };

  const handleRunMigration = async () => {
    if (!isSupabaseConfigured) {
      alert('먼저 Supabase URL과 Key를 설정한 후 마이그레이션을 진행해 주세요.');
      return;
    }
    if (confirm('현재 로컬에 저장된 회차, 마스터, 입력 데이터를 Supabase 원격 DB로 업로드하시겠습니까?')) {
      setIsMigrating(true);
      try {
        await onMigrate();
      } finally {
        setIsMigrating(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">클라우드 데이터베이스 (Supabase) 연동 설정</h3>
              <p className="text-xs text-slate-500">
                여러 사용자와 PC 간 실제 데이터 공동 취합을 위한 환경변수 설정
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {/* Status Box */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isSupabaseConfigured
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              {isSupabaseConfigured ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>
                <b>현재 상태</b>: {isSupabaseConfigured ? 'Supabase DB 연동 활성화 (클라우드 공동 취합 작동 중)' : '로컬 모드 (Supabase 미연동 - 환경변수 필요)'}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Supabase Project URL (VITE_SUPABASE_URL)
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59]"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Supabase Anon Public API Key (VITE_SUPABASE_ANON_KEY)
            </label>
            <input
              type="password"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59]"
            />
          </div>

          {/* Guide & Schema Notice */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 leading-relaxed text-[11px]">
            <p className="font-bold text-slate-800 mb-1">💡 공동 취합 DB 테이블 안내:</p>
            <p>
              Supabase의 SQL Editor에서 프로젝트 루트의 <b>supabase_schema.sql</b> 스크립트를 실행하여 <code className="bg-white px-1 border rounded">entries</code>, <code className="bg-white px-1 border rounded">rounds</code>, <code className="bg-white px-1 border rounded">master_items</code>, <code className="bg-white px-1 border rounded">gl_master_items</code> 테이블을 생성하시면 즉시 모든 담당자와 공동 취합이 가능합니다.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-5 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {isSupabaseConfigured && (
            <button
              type="button"
              onClick={handleRunMigration}
              disabled={isMigrating}
              className="inline-flex items-center text-xs font-semibold text-blue-700 hover:text-blue-900 border border-blue-300 bg-blue-50/50 hover:bg-blue-100/50 px-3 py-2 rounded-lg transition-colors cursor-pointer"
              title="로컬 샘플/기존 데이터를 DB로 안전하게 업로드합니다"
            >
              <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
              {isMigrating ? '마이그레이션 중...' : '로컬 데이터 → DB로 초기 업로드'}
            </button>
          )}

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {isSupabaseConfigured && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                연동 해제
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#0F2D59] hover:bg-[#183B6B] transition-colors shadow-sm cursor-pointer"
            >
              설정 저장 및 연결
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
