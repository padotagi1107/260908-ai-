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
import { LoginView } from './components/LoginView';
import { saveCsvDataToSupabase } from './lib/supabase';

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
      { id: '9-1_m-1', roundId: '9-1', masterId: 'm-1', dept: '노경', m1: 1500000, m2: 1550000, m3: 1600000, m4: 1620000, m5: 1650000 },
      { id: '9-1_m-3', roundId: '9-1', masterId: 'm-3', dept: '환경안전', m1: 450000, m2: 480000, m3: 500000, m4: 520000, m5: 530000 },
      { id: '9-1_m-5', roundId: '9-1', masterId: 'm-5', dept: 'IT보안팀', m1: 890000, m2: 890000, m3: 950000, m4: 950000, m5: 980000 },
      { id: '9-1_m-7', roundId: '9-1', masterId: 'm-7', dept: '구매', m1: 3200000, m2: 3400000, m3: 3100000, m4: 3500000, m5: 3600000 },
      { id: '9-1_m-9', roundId: '9-1', masterId: 'm-9', dept: '기술팀', m1: 1200000, m2: 1250000, m3: 1300000, m4: 1350000, m5: 1400000 },
    ];
  });

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

    // Sync with users list
    const existingIndex = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existingIndex >= 0) {
      const updatedUsers = [...users];
      updatedUsers[existingIndex] = {
        ...updatedUsers[existingIndex],
        name: name || updatedUsers[existingIndex].name,
        role: isOperator ? 'operator' : 'dept_user',
        department: isOperator ? undefined : ((department as Department) || updatedUsers[existingIndex].department || '노경'),
      };
      setUsers(updatedUsers);
      setCurrentUserId(updatedUsers[existingIndex].id);
    } else {
      const newUser: UserProfile = {
        id: `usr-${Date.now()}`,
        name: name || email.split('@')[0],
        email: email,
        role: isOperator ? 'operator' : 'dept_user',
        department: isOperator ? undefined : (department as Department) || '노경',
      };
      setUsers((prev) => [...prev, newUser]);
      setCurrentUserId(newUser.id);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthEmail('');
    localStorage.removeItem('company_platform_auth');
    localStorage.removeItem('company_platform_auth_email');
  };

  const currentUser = users.find((u) => u.id === currentUserId) || users[0];

  // If not authenticated via Supabase / Auth, render LoginView
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // GL Master Handlers
  const handleAddGLMasterItem = (item: Omit<GLMasterItem, 'id'>) => {
    const newItem: GLMasterItem = { ...item, id: `gl-${Date.now()}` };
    const updated = [...glMasterItems, newItem];
    setGlMasterItems(updated);
    saveCsvDataToSupabase('gl_master_upload.csv', authEmail, updated);
  };

  const handleUpdateGLMasterItem = (updated: GLMasterItem) => {
    const next = glMasterItems.map((g) => (g.id === updated.id ? updated : g));
    setGlMasterItems(next);
  };

  const handleDeleteGLMasterItem = (id: string) => {
    setGlMasterItems(glMasterItems.filter((g) => g.id !== id));
  };

  // Master Handlers
  const handleAddMasterItem = (item: Omit<MasterItem, 'id'>) => {
    const newItem: MasterItem = { ...item, id: `m-${Date.now()}` };
    const updated = [...masterItems, newItem];
    setMasterItems(updated);
    saveCsvDataToSupabase('master_items_upload.csv', authEmail, updated);
  };

  const handleUpdateMasterItem = (updated: MasterItem) => {
    setMasterItems(masterItems.map((m) => (m.id === updated.id ? updated : m)));
  };

  const handleDeleteMasterItem = (id: string) => {
    setMasterItems(masterItems.filter((m) => m.id !== id));
  };

  // Round Handlers
  const handleAddRound = (round: Omit<Round, 'status'>) => {
    const newRound: Round = { ...round, status: 'open' };
    setRounds([newRound, ...rounds]);
  };

  const handleToggleRoundStatus = (roundId: string) => {
    setRounds(
      rounds.map((r) =>
        r.id === roundId ? { ...r, status: r.status === 'open' ? 'closed' : 'open' } : r
      )
    );
  };

  const handleDeleteRound = (roundId: string) => {
    setRounds(rounds.filter((r) => r.id !== roundId));
  };

  // User Handlers
  const handleAddUser = (user: Omit<UserProfile, 'id'>) => {
    const newUser: UserProfile = { ...user, id: `usr-${Date.now()}` };
    setUsers([...users, newUser]);
  };

  const handleUpdateUser = (updated: UserProfile) => {
    setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === currentUserId || users.find((u) => u.id === userId)?.email.toLowerCase() === authEmail.toLowerCase()) {
      alert('현재 로그인 중인 계정은 삭제할 수 없습니다.');
      return;
    }
    if (users.length <= 1) {
      alert('최소 1명의 사용자가 필요합니다.');
      return;
    }
    setUsers(users.filter((u) => u.id !== userId));
  };

  // Entry Handlers
  const handleSaveEntry = (newEntry: EntryData) => {
    setEntries((prev) => {
      const index = prev.findIndex((e) => e.roundId === newEntry.roundId && e.masterId === newEntry.masterId);
      let updated: EntryData[];
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = newEntry;
        updated = copy;
      } else {
        updated = [...prev, newEntry];
      }
      saveCsvDataToSupabase('entries_accumulative.csv', authEmail, updated);
      return updated;
    });
  };

  const handleBatchSaveEntries = (batch: EntryData[]) => {
    setEntries((prev) => {
      const map = new Map<string, EntryData>();
      prev.forEach((e) => map.set(`${e.roundId}_${e.masterId}`, e));
      batch.forEach((e) => map.set(`${e.roundId}_${e.masterId}`, e));
      const updated = Array.from(map.values());
      saveCsvDataToSupabase('batch_entries_accumulative.csv', authEmail, updated);
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="flex-1 pb-16">
        {activeTab === 'dashboard' && (
          <DashboardView currentUser={currentUser} rounds={rounds} masterItems={masterItems} entries={entries} />
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
          />
        )}
      </main>
    </div>
  );
}

export default App;
