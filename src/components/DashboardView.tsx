import React, { useState } from 'react';
import { Department, EntryData, MasterItem, Round, UserProfile } from '../types';
import { DEPARTMENTS } from '../initialData';
import { BarChart3 } from 'lucide-react';

interface DashboardViewProps {
  currentUser: UserProfile;
  rounds: Round[];
  masterItems: MasterItem[];
  entries: EntryData[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ currentUser, rounds, masterItems, entries }) => {
  const [selectedRoundId, setSelectedRoundId] = useState<string>(rounds[0]?.id || '');
  
  const isDeptUser = currentUser.role === 'dept_user';

  // Filters matching order: 주관부서 / GL계정 / GL계정명 / 세목 / 귀속 / 상태
  const [filterDept, setFilterDept] = useState<string>(isDeptUser ? currentUser.department : 'all');
  const [filterGlCode, setFilterGlCode] = useState<string>('');
  const [filterGlName, setFilterGlName] = useState<string>('');
  const [filterSubItem, setFilterSubItem] = useState<string>('');
  const [filterAttribution, setFilterAttribution] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // 'all' | 'entered' | 'empty'

  const effectiveDept = isDeptUser ? currentUser.department : filterDept;
  const currentRound = rounds.find((r) => r.id === selectedRoundId);

  // Helper to get 5 target months for a round
  const getRoundMonths = (round: Round | undefined) => {
    if (!round) return [9, 10, 11, 12, 1];
    const startM = round.month;
    const months = [];
    for (let i = 0; i < 5; i++) {
      let m = startM + i;
      if (m > 12) m -= 12;
      months.push(m);
    }
    return months;
  };

  const roundMonths = getRoundMonths(currentRound);

  const getMonthName = (monthIndex: number) => {
    if (!currentRound) return '';
    return `${roundMonths[monthIndex]}월`;
  };

  const getYearSpans = () => {
    if (!currentRound) return [{ year: 2026, count: 5 }];
    const startM = currentRound.month;
    let baseY = 2026;
    if (currentRound.name.includes('27년')) baseY = 2027;
    else if (currentRound.name.includes('26년')) baseY = 2026;

    const spans: { year: number; count: number }[] = [];
    let lastYear = -1;
    roundMonths.forEach((m) => {
      const y = m < startM ? baseY + 1 : baseY;
      if (y !== lastYear) {
        spans.push({ year: y, count: 1 });
        lastYear = y;
      } else {
        spans[spans.length - 1].count++;
      }
    });
    return spans;
  };

  const yearSpans = getYearSpans();

  // Filter entries for selected round
  const roundEntries = entries.filter((e) => e.roundId === selectedRoundId);

  // Find previous round for comparison (e.g. 9-2 comparison is 9-1, 9-1 comparison is 8-2)
  const getPreviousRound = () => {
    if (!currentRound) return undefined;
    const currentIndex = rounds.findIndex((r) => r.id === currentRound.id);
    if (currentIndex > 0 && currentIndex < rounds.length) {
      return rounds[currentIndex - 1];
    }
    return undefined;
  };

  const prevRound = getPreviousRound();
  const prevRoundEntries = prevRound ? entries.filter((e) => e.roundId === prevRound.id) : [];

  const getPrevMonthValue = (masterId: string, currentMonthNum: number) => {
    if (!prevRound) return null;
    const prevRoundMonths = getRoundMonths(prevRound);
    const prevMonthIdx = prevRoundMonths.indexOf(currentMonthNum);
    if (prevMonthIdx === -1) return null;

    const prevEntry = prevRoundEntries.find((e) => e.masterId === masterId);
    if (!prevEntry) return null;

    const keys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const key = keys[prevMonthIdx];
    const val = prevEntry[key];
    return typeof val === 'number' ? val : null;
  };

  // Calculate department totals & completion counts based on managers
  const deptSummary = DEPARTMENTS.map((dept) => {
    const deptMasters = masterItems.filter((m) => m.dept === dept);
    const totalCount = deptMasters.length;
    
    const managers = Array.from(new Set(deptMasters.map((m) => m.manager)));
    const totalManagers = managers.length;

    let completedManagers = 0;
    managers.forEach((mgr) => {
      const mgrMasters = deptMasters.filter((m) => m.manager === mgr);
      const allMgrEntered = mgrMasters.every((m) => {
        const entry = roundEntries.find((e) => e.masterId === m.id);
        return entry && (
          (typeof entry.m1 === 'number' && !isNaN(entry.m1)) ||
          (typeof entry.m2 === 'number' && !isNaN(entry.m2)) ||
          (typeof entry.m3 === 'number' && !isNaN(entry.m3)) ||
          (typeof entry.m4 === 'number' && !isNaN(entry.m4)) ||
          (typeof entry.m5 === 'number' && !isNaN(entry.m5))
        );
      });
      if (allMgrEntered) {
        completedManagers++;
      }
    });

    const completionRate = totalManagers > 0 ? Math.round((completedManagers / totalManagers) * 100) : 0;
    const isComplete = totalManagers > 0 && completedManagers === totalManagers;

    return {
      dept,
      totalCount,
      totalManagers,
      completedManagers,
      completionRate,
      isComplete,
    };
  });

  const filteredMasterItems = masterItems.filter((m) => {
    const matchesDept = effectiveDept === 'all' || m.dept === effectiveDept;
    const matchesGl = (m.glCode || '').toLowerCase().includes((filterGlCode || '').toLowerCase());
    const matchesGlName = (m.glName || '').toLowerCase().includes((filterGlName || '').toLowerCase());
    const matchesSub = (m.subItem || '').toLowerCase().includes((filterSubItem || '').toLowerCase());
    const matchesAttr = filterAttribution === 'all' || m.attribution === filterAttribution;

    const entry = roundEntries.find((e) => e.masterId === m.id);
    const hasData = entry && (
      (typeof entry.m1 === 'number' && !isNaN(entry.m1)) ||
      (typeof entry.m2 === 'number' && !isNaN(entry.m2)) ||
      (typeof entry.m3 === 'number' && !isNaN(entry.m3)) ||
      (typeof entry.m4 === 'number' && !isNaN(entry.m4)) ||
      (typeof entry.m5 === 'number' && !isNaN(entry.m5))
    );

    let matchesStatus = true;
    if (filterStatus === 'entered') matchesStatus = !!hasData;
    if (filterStatus === 'empty') matchesStatus = !hasData;

    return matchesDept && matchesGl && matchesGlName && matchesSub && matchesAttr && matchesStatus;
  });

  return (
    <div className="max-w-[98rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner & Round Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#0F2D59] text-white tracking-wide">
              LX MMA CORPORATE
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-[#0F2D59]">
              단위: 백만원
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">전사 예산 집행 및 실적 비교 대시보드</h2>
          <p className="text-sm text-slate-500">
            회차별 실적 데이터 집계 현황 및 직전 회차({prevRound ? prevRound.name : '없음'}) 대비 변동 내역을 실시간으로 모니터링합니다.
          </p>
        </div>

        <div className="flex items-center space-x-3 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">조회 회차:</span>
          <select
            value={selectedRoundId}
            onChange={(e) => setSelectedRoundId(e.target.value)}
            className="text-xs font-bold text-[#0F2D59] bg-[#0F2D59]/10 px-2.5 py-1 rounded border border-[#0F2D59]/20 focus:outline-hidden"
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.status === 'open' ? '진행중' : '마감됨'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">선택 회차 상태</p>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              {currentRound?.name} ({currentRound?.status === 'open' ? '진행중' : '마감됨'})
            </h3>
            <p className="text-xs text-slate-400 mt-1">대상 기간: {getMonthName(0)} ~ {getMonthName(4)}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0F2D59] flex items-center justify-center font-mono font-bold text-lg">
            {currentRound?.month}M
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">직전 비교 회차</p>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              {prevRound ? prevRound.name : '비교 회차 없음'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">차이 분석 기준 회차</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">권한 모드</p>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              {isDeptUser ? `${currentUser.department} 전용 조회` : '전사 관리자 (전체 조회)'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">{currentUser.name} ({currentUser.role})</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-[#E50012] flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Department Breakdown Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-1">
          부서별 담당자 완료 현황 (전체 부서)
        </h3>
        <p className="text-xs text-slate-500 mb-4">각 부서별 담당자의 입력 완료 여부로 부서 완료 상태가 결정됩니다. (카드 클릭 시 해당 부서 필터)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {deptSummary.map((ds) => {
              return (
                <div
                  key={ds.dept}
                  onClick={() => setFilterDept(filterDept === ds.dept ? 'all' : ds.dept)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    effectiveDept === ds.dept
                      ? 'border-[#0F2D59] bg-[#0F2D59]/5 ring-2 ring-[#0F2D59]/20'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">{ds.dept}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        ds.isComplete
                          ? 'bg-emerald-100 text-emerald-800'
                          : ds.completedManagers > 0
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {ds.isComplete ? '완료' : ds.completedManagers > 0 ? '진행중' : '미입력'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs text-slate-500">담당자 완료</span>
                    <span className="text-sm font-mono font-bold text-slate-900">
                      {ds.completedManagers} / {ds.totalManagers} 명
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ds.isComplete ? 'bg-emerald-600' : 'bg-[#0F2D59]'}`}
                      style={{ width: `${ds.completionRate}%` }}
                    ></div>
                  </div>
                  <div className="text-right mt-1 text-[10px] text-slate-400 font-mono">
                    {ds.completionRate}% 완료
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Detailed Consolidated Table with Horizontal Scroll & Year Grouping Headers */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h3 className="text-base font-bold text-slate-900">
              {isDeptUser ? `${currentUser.department} 상세 데이터 내역` : '상세 데이터 취합 및 차이 비교 내역'} ({filteredMasterItems.length}건)
            </h3>
            <span className="text-xs text-slate-500">
              * 직전 회차({prevRound ? prevRound.name : '없음'})와 금번 회차({currentRound?.name}) 비교 (단위: 백만원)
            </span>
          </div>

          {/* Filters Bar matching order: 주관부서 / GL계정 / GL계정명 / 세목 / 귀속 / 상태 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">주관부서 필터</label>
              {isDeptUser ? (
                <div className="w-full text-xs bg-slate-100 text-slate-800 px-3 py-2 rounded-lg border border-slate-200 font-bold">
                  {currentUser.department} (내 부서 전용)
                </div>
              ) : (
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="w-full text-xs bg-slate-50 text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden"
                >
                  <option value="all">전체 부서</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">GL계정</label>
              <input
                type="text"
                placeholder="GL코드..."
                value={filterGlCode}
                onChange={(e) => setFilterGlCode(e.target.value)}
                className="w-full text-xs bg-slate-50 text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">GL계정명</label>
              <input
                type="text"
                placeholder="계정명..."
                value={filterGlName}
                onChange={(e) => setFilterGlName(e.target.value)}
                className="w-full text-xs bg-slate-50 text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">세목</label>
              <input
                type="text"
                placeholder="세목..."
                value={filterSubItem}
                onChange={(e) => setFilterSubItem(e.target.value)}
                className="w-full text-xs bg-slate-50 text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">귀속</label>
              <select
                value={filterAttribution}
                onChange={(e) => setFilterAttribution(e.target.value)}
                className="w-full text-xs bg-slate-50 text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden"
              >
                <option value="all">전체/공통/MTBE4/P3</option>
                <option value="공통">공통</option>
                <option value="MTBE4">MTBE4</option>
                <option value="P3">P3</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">입력데이터</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full text-xs bg-slate-50 text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden"
              >
                <option value="all">전체보기</option>
                <option value="entered">입력완료</option>
                <option value="empty">미입력</option>
              </select>
            </div>
          </div>
        </div>

        {/* Horizontal Scrollable Table Wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1700px]">
            <thead>
              {/* Row 0: Section Group Header */}
              <tr className="bg-[#0F2D59] text-white text-xs font-bold text-center">
                <th colSpan={6} className="py-2.5 px-3 border-r border-blue-900 text-left">
                  기본 정보 (단위: 백만원)
                </th>
                <th colSpan={5} className="py-2.5 px-3 border-r border-blue-900 bg-[#14315F]">
                  {prevRound ? prevRound.name : '이전 회차'} 실적 (5개 월)
                </th>
                <th colSpan={5} className="py-2.5 px-3 border-r border-blue-900 bg-[#1B3A6B]">
                  {currentRound?.name || '금번 회차'} 실적 (5개 월)
                </th>
                <th colSpan={5} className="py-2.5 px-3 border-r border-blue-900 bg-[#102544]">
                  차이금액 (금번 - 이전)
                </th>
                <th className="py-2.5 px-3 bg-[#0B1D38]">차이사유</th>
              </tr>

              {/* Row 1: Year Grouping Header ( 26년, 27년 같이 요약 ) */}
              <tr className="bg-[#1A3865] text-white text-[11px] font-semibold text-center border-b border-blue-900">
                <th colSpan={6} className="border-r border-blue-900"></th>
                
                {/* Prev Round Years */}
                {yearSpans.map((span, sIdx) => (
                  <th key={`prev-y-${sIdx}`} colSpan={span.count} className={`border-r border-blue-900 bg-[#1F4075] py-1`}>
                    {span.year}년
                  </th>
                ))}
                
                {/* Cur Round Years */}
                {yearSpans.map((span, sIdx) => (
                  <th key={`cur-y-${sIdx}`} colSpan={span.count} className={`border-r border-blue-900 bg-[#244882] py-1`}>
                    {span.year}년
                  </th>
                ))}

                {/* Diff Years */}
                {yearSpans.map((span, sIdx) => (
                  <th key={`diff-y-${sIdx}`} colSpan={span.count} className={`border-r border-blue-900 bg-[#16335C] py-1`}>
                    {span.year}년 차이
                  </th>
                ))}

                <th className="bg-[#0F2D59]"></th>
              </tr>

              {/* Row 2: Month Sub-Headers with GL계정 / GL계정명 / 세목 / 귀속 / 주관부서 / 담당자 */}
              <tr className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-700 text-center">
                <th className="py-2 px-3 text-left">GL계정</th>
                <th className="py-2 px-3 text-left">GL계정명</th>
                <th className="py-2 px-3 text-left">세목</th>
                <th className="py-2 px-3 text-left">귀속</th>
                <th className="py-2 px-3 text-left">주관부서</th>
                <th className="py-2 px-3 text-left border-r border-slate-200">담당자</th>

                {/* Prev 5 months */}
                {[0, 1, 2, 3, 4].map((idx) => (
                  <th key={`prev-${idx}`} className={`py-2 px-1 text-right bg-slate-200/70 text-slate-700 text-[11px] font-mono ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                    {getMonthName(idx)}
                  </th>
                ))}

                {/* Cur 5 months */}
                {[0, 1, 2, 3, 4].map((idx) => (
                  <th key={`cur-${idx}`} className={`py-2 px-1 text-right bg-blue-50 text-[#0F2D59] text-[11px] font-mono ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                    {getMonthName(idx)}
                  </th>
                ))}

                {/* Diff 5 months */}
                {[0, 1, 2, 3, 4].map((idx) => (
                  <th key={`diff-${idx}`} className={`py-2 px-1 text-right bg-slate-100 text-slate-800 text-[11px] font-mono ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                    {getMonthName(idx)}
                  </th>
                ))}

                <th className="py-2 px-3 text-left min-w-[220px]">차이사유</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700 font-mono">
              {filteredMasterItems.length === 0 ? (
                <tr>
                  <td colSpan={23} className="py-12 text-center text-slate-400 font-sans">
                    {isDeptUser
                      ? `${currentUser.department} 부서에 조건에 해당하는 데이터가 없습니다.`
                      : '조건에 해당하는 데이터가 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredMasterItems.map((master) => {
                  const entry = roundEntries.find((e) => e.masterId === master.id);
                  const monthKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];

                  return (
                    <tr key={master.id} className="hover:bg-slate-50/80 transition-colors font-sans">
                      <td className="py-3 px-3 font-semibold text-slate-900 font-mono text-xs">{master.glCode}</td>
                      <td className="py-3 px-3 font-medium text-slate-800 text-xs">{master.glName}</td>
                      <td className="py-3 px-3 font-medium text-slate-800 text-xs">{master.subItem}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {master.attribution}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#0F2D59]">
                          {master.dept}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-xs border-r border-slate-200">{master.manager}</td>

                      {/* 1. Previous 5 months */}
                      {[0, 1, 2, 3, 4].map((idx) => {
                        const mNum = roundMonths[idx];
                        const prevVal = getPrevMonthValue(master.id, mNum);
                        return (
                          <td key={`prev-${idx}`} className={`py-2 px-2 text-right bg-slate-50 font-mono text-xs text-slate-500 ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                            {prevVal !== null ? prevVal.toLocaleString() : '-'}
                          </td>
                        );
                      })}

                      {/* 2. Current 5 months */}
                      {[0, 1, 2, 3, 4].map((idx) => {
                        const mKey = monthKeys[idx];
                        const curVal = entry?.[mKey];
                        return (
                          <td key={`cur-${idx}`} className={`py-2 px-2 text-right bg-blue-50/30 font-mono text-xs font-semibold text-slate-800 ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                            {typeof curVal === 'number' && !isNaN(curVal) ? curVal.toLocaleString() : '-'}
                          </td>
                        );
                      })}

                      {/* 3. Diff 5 months */}
                      {[0, 1, 2, 3, 4].map((idx) => {
                        const mKey = monthKeys[idx];
                        const mNum = roundMonths[idx];
                        const curVal = entry?.[mKey];
                        const prevVal = getPrevMonthValue(master.id, mNum);
                        let diff: number | null = null;
                        if (typeof curVal === 'number' && !isNaN(curVal) && prevVal !== null) {
                          diff = curVal - prevVal;
                        }

                        return (
                          <td key={`diff-${idx}`} className={`py-2 px-2 text-right font-mono text-xs ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                            {diff !== null ? (
                              <span className={diff > 0 ? 'text-red-600 font-bold' : diff < 0 ? 'text-blue-600 font-bold' : 'text-slate-500'}>
                                {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Reason Column */}
                      <td className="py-2 px-3 text-xs text-slate-700">
                        {entry?.reason ? (
                          <span className="bg-amber-50 text-amber-900 px-2 py-1 rounded block border border-amber-200">
                            {entry.reason}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
