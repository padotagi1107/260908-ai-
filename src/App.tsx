import React, { useState, useEffect } from 'react';
import { ActiveTab, EntryData, MasterItem, Round, UserProfile } from './types';
import { INITIAL_MASTER_ITEMS, INITIAL_ROUNDS, INITIAL_USERS } from './initialData';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { DataEntryView } from './components/DataEntryView';
import { MasterManagement } from './components/MasterManagement';
import { RoundManagement } from './components/RoundManagement';
import { UserManagement } from './components/UserManagement';

export function App() {
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

  const [entries, setEntries] = useState<EntryData[]>(() => {
    const saved = localStorage.getItem('company_platform_entries');
    if (saved) return JSON.parse(saved);
    // Initial dummy entry data for 9-1
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
    localStorage.setItem('company_platform_entries', JSON.stringify(entries));
  }, [entries]);

  const currentUser = users.find((u) => u.id === currentUserId) || users[0];

  // Master Handlers
  const handleAddMasterItem = (item: Omit<MasterItem, 'id'>) => {
    const newItem: MasterItem = { ...item, id: `m-${Date.now()}` };
    setMasterItems([...masterItems, newItem]);
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
    if (users.length <= 1) {
      alert('최소 1명의 사용자가 필요합니다.');
      return;
    }
    setUsers(users.filter((u) => u.id !== userId));
    if (currentUserId === userId) {
      const remaining = users.filter((u) => u.id !== userId);
      setCurrentUserId(remaining[0].id);
    }
  };

  // Entry Handlers
  const handleSaveEntry = (newEntry: EntryData) => {
    setEntries((prev) => {
      const index = prev.findIndex((e) => e.roundId === newEntry.roundId && e.masterId === newEntry.masterId);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = newEntry;
        return copy;
      }
      return [...prev, newEntry];
    });
  };

  const handleBatchSaveEntries = (batch: EntryData[]) => {
    setEntries((prev) => {
      const map = new Map<string, EntryData>();
      prev.forEach((e) => map.set(`${e.roundId}_${e.masterId}`, e));
      batch.forEach((e) => map.set(`${e.roundId}_${e.masterId}`, e));
      return Array.from(map.values());
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        users={users}
        onSwitchUser={setCurrentUserId}
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
        {activeTab === 'master' && currentUser.role === 'operator' && (
          <MasterManagement
            masterItems={masterItems}
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
