import React, { useState, useMemo } from 'react';
import { Department, EntryData, MasterItem, Round, UserProfile } from '../types';
import { DEPARTMENTS } from '../initialData';
import { BarChart3, ChevronDown, ChevronRight, CheckCircle2, FileSpreadsheet, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DashboardViewProps {
  currentUser: UserProfile;
  rounds: Round[];
  masterItems: MasterItem[];
  entries: EntryData[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ currentUser, rounds, masterItems, entries }) => {
  const [selectedRoundId, setSelectedRoundId] = useState<string>(
    rounds.length > 0 ? rounds[rounds.length - 1].id : ''
  );

  React.useEffect(() => {
    if (!selectedRoundId && rounds.length > 0) {
      setSelectedRoundId(rounds[rounds.length - 1].id);
    }
  }, [rounds, selectedRoundId]);
  
  const isDeptUser = currentUser.role === 'dept_user';

  // Filters matching order: GL계정 / 세목 / 귀속 / 주관부서 / 담당자 / 차이금액 / 입력상태
  const [filterDept, setFilterDept] = useState<string>(isDeptUser ? currentUser.department : 'all');
  const [filterGlCode, setFilterGlCode] = useState<string>('');
  const [filterSubItem, setFilterSubItem] = useState<string>('');
  const [filterAttribution, setFilterAttribution] = useState<string>('');
  const [filterManager, setFilterManager] = useState<string>('');
  const [filterMinDiff, setFilterMinDiff] = useState<string>('');
  const [filterMaxDiff, setFilterMaxDiff] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // 'all' | 'entered' | 'empty'

  const effectiveDept = isDeptUser ? currentUser.department : filterDept;
  const currentRound = rounds.find((r) => r.id === selectedRoundId);

  // Distinct DB options for filters with both code and name
  const distinctGlAccounts = useMemo(() => {
    const map = new Map<string, { glCode: string; glName: string }>();
    masterItems.forEach((m) => {
      if (m.glCode && !map.has(m.glCode)) {
        map.set(m.glCode, { glCode: m.glCode, glName: m.glName || '' });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.glCode.localeCompare(b.glCode));
  }, [masterItems]);

  const distinctSubItems = useMemo(() => {
    return Array.from(new Set(masterItems.map((m) => m.subItem).filter(Boolean))).sort();
  }, [masterItems]);

  const distinctAttributions = useMemo(() => {
    return Array.from(new Set(masterItems.map((m) => m.attribution).filter(Boolean))).sort();
  }, [masterItems]);

  const distinctDepartments = useMemo(() => {
    return Array.from(new Set(masterItems.map((m) => m.dept).filter(Boolean))).sort();
  }, [masterItems]);

  const distinctManagers = useMemo(() => {
    return Array.from(new Set(masterItems.map((m) => m.manager).filter(Boolean))).sort();
  }, [masterItems]);

  const handleResetFilters = () => {
    setFilterGlCode('');
    setFilterSubItem('');
    setFilterAttribution('');
    if (!isDeptUser) setFilterDept('all');
    setFilterManager('');
    setFilterMinDiff('');
    setFilterMaxDiff('');
    setFilterStatus('all');
  };

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
    const completedMgrList: string[] = [];
    const pendingMgrList: string[] = [];

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
        completedMgrList.push(mgr as string);
      } else {
        pendingMgrList.push(mgr as string);
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
      pendingMgrList,
    };
  });

  // Sort department summary so incomplete departments appear on the left
  const sortedDeptSummary = useMemo(() => {
    return [...deptSummary].sort((a, b) => {
      if (a.isComplete !== b.isComplete) {
        return a.isComplete ? 1 : -1; // incomplete first
      }
      if (a.completionRate !== b.completionRate) {
        return a.completionRate - b.completionRate; // lower completion rate first
      }
      return a.dept.localeCompare(b.dept);
    });
  }, [deptSummary]);

  // Calculate overall completion metrics
  const totalDepts = deptSummary.length;
  const completedDepts = deptSummary.filter((d) => d.isComplete).length;
  const totalManagersAll = deptSummary.reduce((acc, d) => acc + d.totalManagers, 0);
  const completedManagersAll = deptSummary.reduce((acc, d) => acc + d.completedManagers, 0);
  const isAllComplete = completedDepts === totalDepts && totalDepts > 0;

  // Summary calculation restricted to COMPLETED departments only
  const completedDeptSummaries = useMemo(() => {
    const monthKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
    
    // Only completed departments
    const completedDeptsList = deptSummary.filter((d) => d.isComplete);

    return completedDeptsList.map((d) => {
      const deptMasters = masterItems.filter((m) => m.dept === d.dept);
      const managers = Array.from(new Set(deptMasters.map((m) => m.manager))).sort();

      // Manager-level breakdown
      const managerSummaries = managers.map((mgr) => {
        const mgrMasters = deptMasters.filter((m) => m.manager === mgr);
        const count = mgrMasters.length;

        // Prev 5 months (N차)
        const prevMonths = roundMonths.map((mNum) => {
          return mgrMasters.reduce((sum, m) => {
            const val = getPrevMonthValue(m.id, mNum);
            return sum + (val !== null ? val : 0);
          }, 0);
        });
        const prevTotal = Number(prevMonths.reduce((a, b) => a + b, 0).toFixed(1));

        // Current 5 months (N+1차)
        const curMonths = monthKeys.map((mKey) => {
          return mgrMasters.reduce((sum, m) => {
            const entry = roundEntries.find((e) => e.masterId === m.id);
            const val = entry?.[mKey];
            return sum + (typeof val === 'number' && !isNaN(val) ? val : 0);
          }, 0);
        });
        const curTotal = Number(curMonths.reduce((a, b) => a + b, 0).toFixed(1));

        // Diff 5 months
        const diffMonths = [0, 1, 2, 3, 4].map((idx) => Number((curMonths[idx] - prevMonths[idx]).toFixed(1)));
        const diffTotal = Number((curTotal - prevTotal).toFixed(1));

        return {
          manager: mgr,
          count,
          prevMonths: prevMonths.map((v) => Number(v.toFixed(1))),
          prevTotal,
          curMonths: curMonths.map((v) => Number(v.toFixed(1))),
          curTotal,
          diffMonths,
          diffTotal,
        };
      });

      // Dept-level totals
      const count = deptMasters.length;
      const prevMonths = [0, 1, 2, 3, 4].map((idx) =>
        Number(managerSummaries.reduce((sum, ms) => sum + ms.prevMonths[idx], 0).toFixed(1))
      );
      const prevTotal = Number(prevMonths.reduce((a, b) => a + b, 0).toFixed(1));

      const curMonths = [0, 1, 2, 3, 4].map((idx) =>
        Number(managerSummaries.reduce((sum, ms) => sum + ms.curMonths[idx], 0).toFixed(1))
      );
      const curTotal = Number(curMonths.reduce((a, b) => a + b, 0).toFixed(1));

      const diffMonths = [0, 1, 2, 3, 4].map((idx) => Number((curMonths[idx] - prevMonths[idx]).toFixed(1)));
      const diffTotal = Number((curTotal - prevTotal).toFixed(1));

      return {
        dept: d.dept,
        count,
        managerSummaries,
        prevMonths,
        prevTotal,
        curMonths,
        curTotal,
        diffMonths,
        diffTotal,
      };
    });
  }, [deptSummary, masterItems, roundEntries, roundMonths, prevRound, prevRoundEntries, selectedRoundId]);

  // Grand summary across all completed departments
  const grandCompletedSummary = useMemo(() => {
    const count = completedDeptSummaries.reduce((sum, d) => sum + d.count, 0);
    const prevMonths = [0, 1, 2, 3, 4].map((idx) =>
      Number(completedDeptSummaries.reduce((sum, d) => sum + d.prevMonths[idx], 0).toFixed(1))
    );
    const prevTotal = Number(prevMonths.reduce((a, b) => a + b, 0).toFixed(1));

    const curMonths = [0, 1, 2, 3, 4].map((idx) =>
      Number(completedDeptSummaries.reduce((sum, d) => sum + d.curMonths[idx], 0).toFixed(1))
    );
    const curTotal = Number(curMonths.reduce((a, b) => a + b, 0).toFixed(1));

    const diffMonths = [0, 1, 2, 3, 4].map((idx) => Number((curMonths[idx] - prevMonths[idx]).toFixed(1)));
    const diffTotal = Number((curTotal - prevTotal).toFixed(1));

    return {
      count,
      prevMonths,
      prevTotal,
      curMonths,
      curTotal,
      diffMonths,
      diffTotal,
    };
  }, [completedDeptSummaries]);

  // Track expanded department rows in the summary table (default all open)
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({
    노경: true,
    환경안전: true,
    IT보안팀: true,
    구매: true,
    기술팀: true,
  });

  const toggleDeptExpanded = (deptName: string) => {
    setExpandedDepts((prev) => ({
      ...prev,
      [deptName]: prev[deptName] === false ? true : false,
    }));
  };

  const handleExpandAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    DEPARTMENTS.forEach((d) => {
      next[d] = expand;
    });
    setExpandedDepts(next);
  };

  const handleDownloadSummaryExcel = () => {
    if (!currentRound || completedDeptSummaries.length === 0) {
      alert('작성완료된 부서 데이터가 없습니다.');
      return;
    }

    const rows: Record<string, any>[] = [];

    completedDeptSummaries.forEach((d) => {
      // Dept summary row
      const deptRow: Record<string, any> = {
        '구분': d.dept,
        '담당자': '부서 합계',
        '작성건수': d.count,
      };
      // Previous round columns
      roundMonths.forEach((mNum, idx) => {
        deptRow[`[${prevRound?.name || '직전'}] ${mNum}월`] = d.prevMonths[idx];
      });

      // Current round columns
      roundMonths.forEach((mNum, idx) => {
        deptRow[`[${currentRound.name}] ${mNum}월`] = d.curMonths[idx];
      });

      // Variance columns
      roundMonths.forEach((mNum, idx) => {
        deptRow[`[차이금액] ${mNum}월`] = d.diffMonths[idx];
      });

      rows.push(deptRow);

      // Manager rows
      d.managerSummaries.forEach((ms) => {
        const mgrRow: Record<string, any> = {
          '구분': `└ ${d.dept}`,
          '담당자': ms.manager,
          '작성건수': ms.count,
        };
        roundMonths.forEach((mNum, idx) => {
          mgrRow[`[${prevRound?.name || '직전'}] ${mNum}월`] = ms.prevMonths[idx];
        });

        roundMonths.forEach((mNum, idx) => {
          mgrRow[`[${currentRound.name}] ${mNum}월`] = ms.curMonths[idx];
        });

        roundMonths.forEach((mNum, idx) => {
          mgrRow[`[차이금액] ${mNum}월`] = ms.diffMonths[idx];
        });

        rows.push(mgrRow);
      });
    });

    // Grand total
    const grandRow: Record<string, any> = {
      '구분': '작성완료 부서 총계',
      '담당자': `총 ${completedDeptSummaries.length}개 부서`,
      '작성건수': grandCompletedSummary.count,
    };
    roundMonths.forEach((mNum, idx) => {
      grandRow[`[${prevRound?.name || '직전'}] ${mNum}월`] = grandCompletedSummary.prevMonths[idx];
    });

    roundMonths.forEach((mNum, idx) => {
      grandRow[`[${currentRound.name}] ${mNum}월`] = grandCompletedSummary.curMonths[idx];
    });

    roundMonths.forEach((mNum, idx) => {
      grandRow[`[차이금액] ${mNum}월`] = grandCompletedSummary.diffMonths[idx];
    });

    rows.push(grandRow);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '작성완료_부서별요약');
    XLSX.writeFile(wb, `${currentRound.name}_작성완료_부서별요약집계.xlsx`);
  };

  const filteredMasterItems = masterItems.filter((m) => {
    const matchesDept = !filterDept || filterDept === 'all' || (m.dept || '').toLowerCase().includes(filterDept.toLowerCase());
    const glQuery = (filterGlCode || '').trim().toLowerCase();
    const matchesGl = !glQuery || (m.glCode || '').toLowerCase().includes(glQuery) || (m.glName || '').toLowerCase().includes(glQuery);
    const matchesSub = (m.subItem || '').toLowerCase().includes((filterSubItem || '').toLowerCase());
    const matchesAttr = !filterAttribution || filterAttribution === 'all' || (m.attribution || '').toLowerCase().includes(filterAttribution.toLowerCase());
    const matchesManager = (m.manager || '').toLowerCase().includes((filterManager || '').toLowerCase());

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

    let matchesDiff = true;
    if (filterMinDiff !== '' || filterMaxDiff !== '') {
      const minD = filterMinDiff !== '' ? Number(filterMinDiff) : -Infinity;
      const maxD = filterMaxDiff !== '' ? Number(filterMaxDiff) : Infinity;

      const monthKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
      let hasMatchingDiff = false;
      [0, 1, 2, 3, 4].forEach((idx) => {
        const mKey = monthKeys[idx];
        const mNum = roundMonths[idx];
        const curVal = entry?.[mKey];
        const prevVal = getPrevMonthValue(m.id, mNum);
        if (typeof curVal === 'number' && !isNaN(curVal) && prevVal !== null) {
          const diff = curVal - prevVal;
          if (diff >= minD && diff <= maxD) {
            hasMatchingDiff = true;
          }
        }
      });
      matchesDiff = hasMatchingDiff;
    }

    return (
      matchesDept &&
      matchesGl &&
      matchesSub &&
      matchesAttr &&
      matchesManager &&
      matchesStatus &&
      matchesDiff
    );
  });

  return (
    <div className="max-w-[98rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Round Selector (Left-aligned) */}
      <div className="flex items-center justify-start gap-4">
        <div className="flex items-center space-x-3 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">조회 회차:</span>
          <select
            value={selectedRoundId}
            onChange={(e) => setSelectedRoundId(e.target.value)}
            className="text-xs font-bold text-[#0F2D59] bg-[#0F2D59]/10 px-2.5 py-1 rounded border border-[#0F2D59]/20 focus:outline-hidden cursor-pointer"
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.status === 'open' ? '진행중' : '마감됨'})
              </option>
            ))}
          </select>
        </div>
      </div>



      {/* Department Breakdown Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-base font-bold text-slate-900">
              부서별 완료현황
            </h3>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isAllComplete
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isAllComplete ? 'bg-emerald-600' : 'bg-amber-600'}`}></span>
              {isAllComplete
                ? `총 완료 (5개 부서 전원 완료)`
                : `총 진행중 (완료 ${completedDepts}/${totalDepts}개 부서, 담당자 ${completedManagersAll}/${totalManagersAll}명)`}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            * 미완료 부서가 왼쪽에 우선 배치됩니다.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {sortedDeptSummary.map((ds) => {
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
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full ${ds.isComplete ? 'bg-emerald-600' : 'bg-[#0F2D59]'}`}
                      style={{ width: `${ds.completionRate}%` }}
                    ></div>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-0.5 border-t border-slate-100 pt-1.5">
                    <div className="text-slate-500 truncate" title={ds.pendingMgrList.join(', ')}>
                      <span className="font-semibold text-slate-700">미저장:</span> {ds.pendingMgrList.length > 0 ? ds.pendingMgrList.join(', ') : '없음 (전원 완료)'}
                    </div>
                  </div>
                  <div className="text-right mt-1 text-[10px] text-slate-400 font-mono">
                    {ds.completionRate}% 완료
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Department & Manager Summary Table (Only for Completed Departments) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#0F2D59]/10 text-[#0F2D59] rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-900">
                      부서별 요약 (작성완료 부서 한정)
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      작성완료 {completedDeptSummaries.length} / {DEPARTMENTS.length}개 부서
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    * 작성완료(모든 담당자 입력 완료)된 부서에 한정하여 부서별 및 담당자별 작성 건수, 직전/금번 회차 월별 금액 및 차이금액 합계를 표시합니다. (단위: 백만원)
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleExpandAll(true)}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                전체 펼치기
              </button>
              <button
                onClick={() => handleExpandAll(false)}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                전체 접기
              </button>
              <button
                onClick={handleDownloadSummaryExcel}
                disabled={completedDeptSummaries.length === 0}
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                  completedDeptSummaries.length === 0
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
                title="작성완료 부서별/담당자별 요약 집계 데이터를 엑셀로 다운로드합니다."
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                요약 엑셀 다운로드
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              {/* Top Header Grouping */}
              <tr className="bg-[#0F2D59] text-white text-xs font-bold divide-x divide-[#1B365D]">
                <th colSpan={2} className="py-2.5 px-3 text-center">
                  구분
                </th>
                <th rowSpan={2} className="py-2.5 px-3 text-center w-20 border-b border-[#1B365D]">
                  작성건수
                </th>
                <th colSpan={5} className="py-2.5 px-3 text-center bg-[#183B6B]">
                  {prevRound?.name || '직전 회차'}
                </th>
                <th colSpan={5} className="py-2.5 px-3 text-center bg-[#1F4A85]">
                  {currentRound?.name || '금번 회차'}
                </th>
                <th colSpan={5} className="py-2.5 px-3 text-center bg-[#2B5F9E]">
                  차이금액
                </th>
              </tr>
              {/* Sub Header for Months */}
              <tr className="bg-slate-100 text-[11px] font-semibold text-slate-700 border-b border-slate-300 divide-x divide-slate-200">
                <th className="py-2 px-3 text-center w-24">부서</th>
                <th className="py-2 px-3 text-center w-24">담당자</th>

                {/* N차 5 months */}
                {[0, 1, 2, 3, 4].map((idx) => (
                  <th key={`hdr-prev-${idx}`} className={`py-2 px-2 text-right bg-slate-50 font-mono w-20 ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                    {getMonthName(idx)}
                  </th>
                ))}

                {/* N+1차 5 months */}
                {[0, 1, 2, 3, 4].map((idx) => (
                  <th key={`hdr-cur-${idx}`} className={`py-2 px-2 text-right bg-blue-50/50 font-mono text-[#0F2D59] w-20 ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                    {getMonthName(idx)}
                  </th>
                ))}

                {/* Diff 5 months */}
                {[0, 1, 2, 3, 4].map((idx) => (
                  <th key={`hdr-diff-${idx}`} className="py-2 px-2 text-right bg-slate-50 font-mono w-20">
                    {getMonthName(idx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {completedDeptSummaries.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-12 text-center text-slate-500 bg-slate-50/50">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-200/70 flex items-center justify-center text-slate-400">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">현재 작성완료된 부서가 없습니다.</p>
                      <p className="text-xs text-slate-500">
                        부서 내 모든 담당자가 비용추정 입력을 완료하면 해당 부서의 요약 집계가 자동으로 표시됩니다.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                completedDeptSummaries.map((d) => {
                  const isExpanded = expandedDepts[d.dept] !== false;

                  return (
                    <React.Fragment key={d.dept}>
                      {/* Department Summary Row */}
                      <tr className="bg-slate-100/90 font-semibold text-slate-900 hover:bg-slate-200/70 transition-colors border-t-2 border-slate-300">
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => toggleDeptExpanded(d.dept)}
                            className="flex items-center space-x-1.5 text-left font-bold text-slate-900 hover:text-[#0F2D59] cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-600" />
                            )}
                            <span>{d.dept}</span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-normal">
                          <span className="inline-block bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                            부서 합계
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                          {d.count}건
                        </td>

                        {/* N차 5 months */}
                        {d.prevMonths.map((val, idx) => (
                          <td key={`dept-prev-${idx}`} className={`py-2 px-2 text-right font-mono bg-slate-50/60 ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                            {val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                          </td>
                        ))}

                        {/* N+1차 5 months */}
                        {d.curMonths.map((val, idx) => (
                          <td key={`dept-cur-${idx}`} className={`py-2 px-2 text-right font-mono text-[#0F2D59] bg-blue-50/40 font-bold ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                            {val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                          </td>
                        ))}

                        {/* Diff 5 months */}
                        {d.diffMonths.map((diff, idx) => (
                          <td key={`dept-diff-${idx}`} className="py-2 px-2 text-right font-mono">
                            <span
                              className={
                                diff > 0
                                  ? 'text-red-600 font-bold'
                                  : diff < 0
                                  ? 'text-blue-600 font-bold'
                                  : 'text-slate-500'
                              }
                            >
                              {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                            </span>
                          </td>
                        ))}
                      </tr>

                      {/* Manager Rows (when expanded) */}
                      {isExpanded &&
                        d.managerSummaries.map((ms) => (
                          <tr key={`${d.dept}-${ms.manager}`} className="bg-white hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 pl-8 text-slate-400 text-[11px]">
                              ↳ {d.dept}
                            </td>
                            <td className="py-2 px-3 text-slate-800 font-medium">
                              {ms.manager}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-slate-600 text-xs">
                              {ms.count}건
                            </td>

                            {/* Manager N차 5 months */}
                            {ms.prevMonths.map((val, idx) => (
                              <td key={`mgr-prev-${idx}`} className={`py-2 px-2 text-right font-mono text-slate-500 bg-slate-50/30 ${idx === 4 ? 'border-r border-slate-200' : ''}`}>
                                {val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                              </td>
                            ))}

                            {/* Manager N+1차 5 months */}
                            {ms.curMonths.map((val, idx) => (
                              <td key={`mgr-cur-${idx}`} className={`py-2 px-2 text-right font-mono font-medium text-slate-800 bg-blue-50/20 ${idx === 4 ? 'border-r border-slate-200' : ''}`}>
                                {val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                              </td>
                            ))}

                            {/* Manager Diff 5 months */}
                            {ms.diffMonths.map((diff, idx) => (
                              <td key={`mgr-diff-${idx}`} className="py-2 px-2 text-right font-mono">
                                <span
                                  className={
                                    diff > 0
                                      ? 'text-red-600 font-semibold'
                                      : diff < 0
                                      ? 'text-blue-600 font-semibold'
                                      : 'text-slate-400'
                                  }
                                >
                                  {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Grand Total Footer for all Completed Depts */}
            {completedDeptSummaries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-900">
                  <td colSpan={2} className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span>작성완료 부서 총계</span>
                      <span className="text-[11px] font-normal text-slate-300">
                        (총 {completedDeptSummaries.length}개 부서)
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-amber-300">
                    {grandCompletedSummary.count}건
                  </td>

                  {/* Grand N차 5 months */}
                  {grandCompletedSummary.prevMonths.map((val, idx) => (
                    <td key={`grand-prev-${idx}`} className={`py-3 px-2 text-right font-mono text-slate-300 bg-slate-800/80 ${idx === 4 ? 'border-r border-slate-700' : ''}`}>
                      {val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                    </td>
                  ))}

                  {/* Grand N+1차 5 months */}
                  {grandCompletedSummary.curMonths.map((val, idx) => (
                    <td key={`grand-cur-${idx}`} className={`py-3 px-2 text-right font-mono text-white bg-slate-800/80 font-bold ${idx === 4 ? 'border-r border-slate-700' : ''}`}>
                      {val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                    </td>
                  ))}

                  {/* Grand Diff 5 months */}
                  {grandCompletedSummary.diffMonths.map((diff, idx) => (
                    <td key={`grand-diff-${idx}`} className="py-3 px-2 text-right font-mono bg-slate-800/80">
                      <span
                        className={
                          diff > 0
                            ? 'text-red-400 font-bold'
                            : diff < 0
                            ? 'text-blue-400 font-bold'
                            : 'text-slate-400'
                        }
                      >
                        {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                      </span>
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Detailed Consolidated Table with Horizontal Scroll & Year Grouping Headers */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-base font-bold text-slate-900">
              비용추정 세부내역
            </h3>
            <span className="text-xs text-slate-500">
              * 직전 회차({prevRound ? prevRound.name : '없음'})와 금번 회차({currentRound?.name}) 비교 (단위: 백만원)
            </span>
          </div>

          {/* Filters Bar with Datalists (직접입력 및 목록상자 선택 가능) */}
          <div className="bg-slate-50/70 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700">
                검색 및 필터 조건 (직접입력 및 목록상자 선택 가능)
              </span>
              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-400">총 {filteredMasterItems.length}개 항목</span>
                {(filterGlCode || filterSubItem || filterAttribution || (filterDept !== 'all' && !isDeptUser) || filterManager || filterMinDiff !== '' || filterMaxDiff !== '' || filterStatus !== 'all') && (
                  <button
                    onClick={handleResetFilters}
                    className="text-[11px] text-red-600 hover:text-red-700 font-semibold cursor-pointer underline"
                  >
                    필터 초기화
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">GL계정</label>
                <input
                  type="text"
                  list="dash-gl-codes"
                  placeholder="GL코드 선택/입력..."
                  value={filterGlCode}
                  onChange={(e) => setFilterGlCode(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                />
                <datalist id="dash-gl-codes">
                  {distinctGlAccounts.map((item) => (
                    <option key={item.glCode} value={item.glCode}>
                      {item.glCode} ({item.glName})
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">세목</label>
                <input
                  type="text"
                  list="dash-sub-items"
                  placeholder="세목 선택/입력..."
                  value={filterSubItem}
                  onChange={(e) => setFilterSubItem(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                />
                <datalist id="dash-sub-items">
                  {distinctSubItems.map((sub) => (
                    <option key={sub} value={sub} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">귀속</label>
                <input
                  type="text"
                  list="dash-attributions"
                  placeholder="귀속 선택/입력..."
                  value={filterAttribution}
                  onChange={(e) => setFilterAttribution(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                />
                <datalist id="dash-attributions">
                  {distinctAttributions.map((attr) => (
                    <option key={attr} value={attr} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">주관부서</label>
                {isDeptUser ? (
                  <div className="w-full text-xs bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 font-bold truncate">
                    {currentUser.department}
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      list="dash-depts"
                      placeholder="부서 선택/입력..."
                      value={filterDept === 'all' ? '' : filterDept}
                      onChange={(e) => setFilterDept(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                    />
                    <datalist id="dash-depts">
                      {distinctDepartments.map((dept) => (
                        <option key={dept} value={dept} />
                      ))}
                    </datalist>
                  </>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">담당자</label>
                <input
                  type="text"
                  list="dash-managers"
                  placeholder="담당자 선택/입력..."
                  value={filterManager}
                  onChange={(e) => setFilterManager(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                />
                <datalist id="dash-managers">
                  {distinctManagers.map((mgr) => (
                    <option key={mgr} value={mgr} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">차이금액 이상</label>
                <input
                  type="number"
                  placeholder="최소 차이..."
                  value={filterMinDiff}
                  onChange={(e) => setFilterMinDiff(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">차이금액 이하</label>
                <input
                  type="number"
                  placeholder="최대 차이..."
                  value={filterMaxDiff}
                  onChange={(e) => setFilterMaxDiff(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">입력상태</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden cursor-pointer"
                >
                  <option value="all">전체보기</option>
                  <option value="entered">입력완료</option>
                  <option value="empty">미입력</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal Scrollable Table Wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1700px]">
            <thead>
              {/* Row 0: Section Group Header */}
              <tr className="bg-[#0F2D59] text-white text-xs font-bold text-center">
                <th colSpan={5} className="py-2.5 px-3 border-r border-blue-900 text-left">
                  기본 정보 (백만원)
                </th>
                <th colSpan={5} className="py-2.5 px-3 border-r border-blue-900 bg-[#14315F]">
                  {prevRound ? prevRound.name : '이전 회차'}
                </th>
                <th colSpan={5} className="py-2.5 px-3 border-r border-blue-900 bg-[#1B3A6B]">
                  {currentRound?.name || '금번 회차'}
                </th>
                <th colSpan={5} className="py-2.5 px-3 border-r border-blue-900 bg-[#102544] leading-tight">
                  <div>차이금액</div>
                  <div className="text-[10px] font-normal text-blue-200 mt-0.5">(+개선, △악화)</div>
                </th>
                <th className="py-2.5 px-3 bg-[#0B1D38]">차이사유</th>
              </tr>

              {/* Row 1: Year Grouping Header ( 26년, 27년 같이 요약 ) */}
              <tr className="bg-[#1A3865] text-white text-[11px] font-semibold text-center border-b border-blue-900">
                <th colSpan={5} className="border-r border-blue-900"></th>
                
                {/* Prev Round Years */}
                {yearSpans.map((span, sIdx) => (
                  <th key={`prev-y-${sIdx}`} colSpan={span.count} className={`border-r border-blue-900 bg-[#1F4075] py-1`}>
                    {String(span.year).slice(2)}년
                  </th>
                ))}
                
                {/* Cur Round Years */}
                {yearSpans.map((span, sIdx) => (
                  <th key={`cur-y-${sIdx}`} colSpan={span.count} className={`border-r border-blue-900 bg-[#244882] py-1`}>
                    {String(span.year).slice(2)}년
                  </th>
                ))}

                {/* Diff Years */}
                {yearSpans.map((span, sIdx) => (
                  <th key={`diff-y-${sIdx}`} colSpan={span.count} className={`border-r border-blue-900 bg-[#16335C] py-1`}>
                    {String(span.year).slice(2)}년
                  </th>
                ))}

                <th className="bg-[#0F2D59]"></th>
              </tr>

              {/* Row 2: Month Sub-Headers with GL계정 / 세목 / 귀속 / 주관부서 / 담당자 */}
              <tr className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-700 text-center">
                <th className="py-2 px-3 text-left">GL계정</th>
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
                  <td colSpan={22} className="py-12 text-center text-slate-400 font-sans">
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
                      <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono text-xs">
                        <div>{master.glCode}</div>
                        <div className="text-[11px] font-normal text-slate-500 font-sans truncate max-w-[130px]" title={master.glName}>{master.glName}</div>
                      </td>
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
