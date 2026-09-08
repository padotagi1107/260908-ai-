import React, { useState } from 'react';
import { Department, EntryData, MasterItem, Round, UserProfile } from '../types';
import { DEPARTMENTS } from '../initialData';
import { Lock, Unlock, Save } from 'lucide-react';

interface DataEntryViewProps {
  currentUser: UserProfile;
  rounds: Round[];
  masterItems: MasterItem[];
  entries: EntryData[];
  onSaveEntry: (entry: EntryData) => void;
  onBatchSaveEntries: (entries: EntryData[]) => void;
}

export const DataEntryView: React.FC<DataEntryViewProps> = ({
  currentUser,
  rounds,
  masterItems,
  entries,
  onSaveEntry,
  onBatchSaveEntries,
}) => {
  const [selectedRoundId, setSelectedRoundId] = useState<string>(
    rounds.find((r) => r.status === 'open')?.id || rounds[0]?.id || ''
  );

  const [selectedDept, setSelectedDept] = useState<Department | 'all'>(
    currentUser.role === 'dept_user' ? (currentUser.department || '노경') : 'all'
  );

  // Search & Filter conditions
  const [filterGlCode, setFilterGlCode] = useState('');
  const [filterGlName, setFilterGlName] = useState('');
  const [filterSubItem, setFilterSubItem] = useState('');
  const [filterAttribution, setFilterAttribution] = useState<'all' | '공통' | 'MTBE4' | 'P3'>('all');
  const [filterDept, setFilterDept] = useState<Department | 'all'>('all');
  const [filterManager, setFilterManager] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMinDiff, setFilterMinDiff] = useState<string>('');
  const [filterMaxDiff, setFilterMaxDiff] = useState<string>('');

  const currentRound = rounds.find((r) => r.id === selectedRoundId);
  const isClosed = currentRound?.status === 'closed';

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

  // Local draft state
  const [draftValues, setDraftValues] = useState<{ [key: string]: number | '' }>({});
  const [draftReasons, setDraftReasons] = useState<{ [key: string]: string }>({});

  // Multi-cell selection & Excel paste support
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [anchorCell, setAnchorCell] = useState<{ rIdx: number; mIdx: number } | null>(null);
  const [currentCell, setCurrentCell] = useState<{ rIdx: number; mIdx: number } | null>(null);

  const handleCellClick = (rIdx: number, mIdx: number, e: React.MouseEvent) => {
    const monthKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const master = filteredMasterItems[rIdx];
    if (!master) return;
    const mKey = monthKeys[mIdx];
    const cellKey = `${master.id}_${mKey}`;

    setCurrentCell({ rIdx, mIdx });

    if (e.shiftKey && anchorCell) {
      const minR = Math.min(anchorCell.rIdx, rIdx);
      const maxR = Math.max(anchorCell.rIdx, rIdx);
      const minM = Math.min(anchorCell.mIdx, mIdx);
      const maxM = Math.max(anchorCell.mIdx, mIdx);

      const newSelected = new Set<string>();
      for (let ri = minR; ri <= maxR; ri++) {
        for (let mi = minM; mi <= maxM; mi++) {
          const rm = filteredMasterItems[ri];
          if (rm) {
            newSelected.add(`${rm.id}_${monthKeys[mi]}`);
          }
        }
      }
      setSelectedCells(newSelected);
    } else {
      setAnchorCell({ rIdx, mIdx });
      setSelectedCells(() => {
        const next = new Set<string>();
        next.add(cellKey);
        return next;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const monthKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const activeTarget = e.target as HTMLElement;
    const isInput = activeTarget.tagName === 'INPUT';

    // Ctrl + C (Copy selected cells)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      if (selectedCells.size > 0) {
        e.preventDefault();
        let minR = Infinity, maxR = -Infinity, minM = Infinity, maxM = -Infinity;
        selectedCells.forEach(cellKey => {
          const [mId, mKey] = cellKey.split('_');
          const rIdx = filteredMasterItems.findIndex(m => m.id === mId);
          const mIdx = monthKeys.indexOf(mKey as any);
          if (rIdx !== -1 && mIdx !== -1) {
            if (rIdx < minR) minR = rIdx;
            if (rIdx > maxR) maxR = rIdx;
            if (mIdx < minM) minM = mIdx;
            if (mIdx > maxM) maxM = mIdx;
          }
        });

        if (minR <= maxR && minM <= maxM) {
          const rowsText: string[] = [];
          for (let ri = minR; ri <= maxR; ri++) {
            const rowVals: string[] = [];
            const rm = filteredMasterItems[ri];
            for (let mi = minM; mi <= maxM; mi++) {
              const mk = monthKeys[mi];
              const val = getCellValue(rm.id, mk);
              rowVals.push(val !== '' && val !== undefined && val !== null ? String(val) : '');
            }
            rowsText.push(rowVals.join('\t'));
          }
          navigator.clipboard.writeText(rowsText.join('\n'));
        }
      }
      return;
    }

    // Delete / Backspace (Clear values in selected cells)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedCells.size > 0 && !isClosed) {
        if (!isInput || (isInput && (activeTarget as HTMLInputElement).value === '')) {
          e.preventDefault();
          const newDrafts = { ...draftValues };
          selectedCells.forEach(cellKey => {
            newDrafts[cellKey] = '';
          });
          setDraftValues(newDrafts);
        }
      }
      return;
    }

    // Arrow navigation & Shift + Arrow range selection
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (isInput && !e.shiftKey) {
        return;
      }

      if (!currentCell && filteredMasterItems.length > 0) {
        setCurrentCell({ rIdx: 0, mIdx: 0 });
        setAnchorCell({ rIdx: 0, mIdx: 0 });
        setSelectedCells(new Set([`${filteredMasterItems[0].id}_m1`]));
        return;
      }

      if (currentCell) {
        e.preventDefault();
        let { rIdx, mIdx } = currentCell;
        if (e.key === 'ArrowUp') rIdx = Math.max(0, rIdx - 1);
        if (e.key === 'ArrowDown') rIdx = Math.min(filteredMasterItems.length - 1, rIdx + 1);
        if (e.key === 'ArrowLeft') mIdx = Math.max(0, mIdx - 1);
        if (e.key === 'ArrowRight') mIdx = Math.min(4, mIdx + 1);

        setCurrentCell({ rIdx, mIdx });

        if (e.shiftKey && anchorCell) {
          const minR = Math.min(anchorCell.rIdx, rIdx);
          const maxR = Math.max(anchorCell.rIdx, rIdx);
          const minM = Math.min(anchorCell.mIdx, mIdx);
          const maxM = Math.max(anchorCell.mIdx, mIdx);

          const newSelected = new Set<string>();
          for (let ri = minR; ri <= maxR; ri++) {
            for (let mi = minM; mi <= maxM; mi++) {
              const rm = filteredMasterItems[ri];
              if (rm) {
                newSelected.add(`${rm.id}_${monthKeys[mi]}`);
              }
            }
          }
          setSelectedCells(newSelected);
        } else {
          setAnchorCell({ rIdx, mIdx });
          const targetMaster = filteredMasterItems[rIdx];
          if (targetMaster) {
            setSelectedCells(new Set([`${targetMaster.id}_${monthKeys[mIdx]}`]));
          }
        }
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startMasterId: string, startMonthKey: 'm1'|'m2'|'m3'|'m4'|'m5') => {
    e.preventDefault();
    if (isClosed) return;
    const text = e.clipboardData.getData('text');
    if (!text) return;

    const rows = text.split(/\r?\n/).filter(r => r.length > 0);
    const parsedMatrix = rows.map(r => r.split('\t'));

    const monthKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const startMIdx = monthKeys.indexOf(startMonthKey);
    const startRIdx = filteredMasterItems.findIndex(m => m.id === startMasterId);

    if (startRIdx === -1 || startMIdx === -1) return;

    const newDrafts = { ...draftValues };

    parsedMatrix.forEach((rowVals, rOffset) => {
      const targetRIdx = startRIdx + rOffset;
      if (targetRIdx >= filteredMasterItems.length) return;
      const targetMaster = filteredMasterItems[targetRIdx];

      rowVals.forEach((valStr, cOffset) => {
        const targetMIdx = startMIdx + cOffset;
        if (targetMIdx >= monthKeys.length) return;
        const targetMKey = monthKeys[targetMIdx];

        const cleaned = valStr.trim().replace(/,/g, '');
        if (cleaned === '') {
          newDrafts[`${targetMaster.id}_${targetMKey}`] = '';
        } else if (!isNaN(Number(cleaned))) {
          newDrafts[`${targetMaster.id}_${targetMKey}`] = Number(cleaned);
        }
      });
    });

    setDraftValues(newDrafts);
  };

  const roundEntries = entries.filter((e) => e.roundId === selectedRoundId);

  // Find previous round for comparison:
  // e.g. 9-2차 comparison is 9-1차, 9-1차 comparison is 8-2차
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

  const getCellValue = (masterId: string, monthKey: 'm1' | 'm2' | 'm3' | 'm4' | 'm5') => {
    const draftKey = `${masterId}_${monthKey}`;
    if (draftKey in draftValues) return draftValues[draftKey];

    const entry = roundEntries.find((e) => e.masterId === masterId);
    if (!entry) return '';
    return entry[monthKey];
  };

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

  const filteredMasterItems = masterItems.filter((m) => {
    const userDeptCheck = currentUser.role === 'dept_user' ? currentUser.department : selectedDept;
    const matchesUserDept = userDeptCheck === 'all' || !userDeptCheck || m.dept === userDeptCheck;
    const matchesFilterDept = filterDept === 'all' || m.dept === filterDept;

    const matchesGl = (m.glCode || '').toLowerCase().includes((filterGlCode || '').toLowerCase());
    const matchesGlName = (m.glName || '').toLowerCase().includes((filterGlName || '').toLowerCase());
    const matchesSub = (m.subItem || '').toLowerCase().includes((filterSubItem || '').toLowerCase());
    const matchesAttr = filterAttribution === 'all' || m.attribution === filterAttribution;
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
        const curVal = getCellValue(m.id, mKey);
        const prevVal = getPrevMonthValue(m.id, mNum);
        const numCur = typeof curVal === 'number' ? curVal : parseFloat(String(curVal));
        if (!isNaN(numCur) && prevVal !== null) {
          const diff = numCur - prevVal;
          if (diff >= minD && diff <= maxD) {
            hasMatchingDiff = true;
          }
        }
      });
      matchesDiff = hasMatchingDiff;
    }

    return (
      matchesUserDept &&
      matchesFilterDept &&
      matchesGl &&
      matchesGlName &&
      matchesSub &&
      matchesAttr &&
      matchesManager &&
      matchesStatus &&
      matchesDiff
    );
  });

  const handleInputChange = (masterId: string, monthKey: 'm1' | 'm2' | 'm3' | 'm4' | 'm5', val: string) => {
    if (isClosed) {
      alert('현재 회차는 마감되어 데이터를 수정할 수 없습니다.');
      return;
    }
    // Allow empty string or valid decimal numbers (optionally up to 1 decimal place or standard numeric typing)
    if (val !== '' && isNaN(Number(val))) return;

    // If it has decimals, limit to 1 decimal place if user typed more than 1, or just store number
    let numericVal: number | '' = val === '' ? '' : Number(val);
    if (typeof numericVal === 'number' && !isNaN(numericVal)) {
      // round to 1 decimal place if needed or keep as typed
      const parts = val.split('.');
      if (parts.length === 2 && parts[1].length > 1) {
        numericVal = Number(Number(val).toFixed(1));
      }
    }

    setDraftValues((prev) => ({ ...prev, [`${masterId}_${monthKey}`]: numericVal }));
  };

  const handleReasonInput = (masterId: string, val: string) => {
    setDraftReasons((prev) => ({ ...prev, [masterId]: val }));
  };

  const getReasonForMaster = (masterId: string) => {
    if (masterId in draftReasons) return draftReasons[masterId];
    const entry = roundEntries.find((e) => e.masterId === masterId);
    return entry?.reason || '';
  };

  // Unit is 백만원. 1천만원 = 10 백만원.
  const hasLargeVariance = (masterId: string) => {
    const monthKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
    for (let idx = 0; idx < 5; idx++) {
      const val = getCellValue(masterId, monthKeys[idx]);
      const mNum = roundMonths[idx];
      const prevVal = getPrevMonthValue(masterId, mNum);
      if (val !== '' && prevVal !== null) {
        if (Math.abs(Number(val) - prevVal) >= 10) {
          return true;
        }
      }
    }
    return false;
  };

  const handleSaveAll = () => {
    if (isClosed) {
      alert('마감된 회차는 저장할 수 없습니다.');
      return;
    }

    const monthKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];

    for (const master of filteredMasterItems) {
      if (hasLargeVariance(master.id)) {
        const reason = getReasonForMaster(master.id);
        if (!reason || reason.trim() === '') {
          alert(
            `[저장 불가] 1천만원 이상 차이가 발생하는 항목이 존재합니다.\n\n- GL계정: ${master.glCode} (${master.glName} - ${master.subItem})\n- 사유 미입력 시 저장이 불가합니다. '차이사유' 열에 사유를 입력해 주세요.`
          );
          return;
        }
      }
    }

    const newEntriesMap = new Map<string, EntryData>();
    roundEntries.forEach((en) => newEntriesMap.set(en.masterId, { ...en }));

    filteredMasterItems.forEach((master) => {
      let entry = newEntriesMap.get(master.id);
      if (!entry) {
        entry = {
          id: `${selectedRoundId}_${master.id}`,
          roundId: selectedRoundId,
          masterId: master.id,
          dept: master.dept,
          m1: '',
          m2: '',
          m3: '',
          m4: '',
          m5: '',
          reason: '',
        };
      }

      monthKeys.forEach((mKey) => {
        const draftKey = `${master.id}_${mKey}`;
        if (draftKey in draftValues) {
          entry![mKey] = draftValues[draftKey];
        }
      });

      entry.reason = getReasonForMaster(master.id);
      entry.updatedAt = new Date().toISOString();
      entry.updatedBy = currentUser.name;
      newEntriesMap.set(master.id, entry);
    });

    onBatchSaveEntries(Array.from(newEntriesMap.values()));
    setDraftValues({});
    alert('저장되었습니다.');
  };

  return (
    <div className="max-w-[98rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner & Selectors */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#0F2D59] text-white tracking-wide">
              LX MMA CORPORATE
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-[#0F2D59]">
              (백만원)
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">부서별 데이터 입력 및 차이 비교</h2>
          <p className="text-sm text-slate-500">
            직전 회차({prevRound ? prevRound.name : '없음'})와 비교하여 5개월치 데이터를 입력하고 차이내역 및 사유를 작성합니다.
          </p>
        </div>

        {/* Round & Dept Selectors & Save Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">입력 회차:</span>
            <select
              value={selectedRoundId}
              onChange={(e) => {
                setSelectedRoundId(e.target.value);
                setDraftValues({});
              }}
              className="text-xs font-bold text-[#0F2D59] bg-[#0F2D59]/10 px-2.5 py-1 rounded border border-[#0F2D59]/20 focus:outline-hidden"
            >
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.status === 'open' ? '진행중' : '마감됨'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">부서:</span>
            {currentUser.role === 'dept_user' ? (
              <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded">
                {currentUser.department} (내 부서)
              </span>
            ) : (
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value as Department | 'all')}
                className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 focus:outline-hidden"
              >
                <option value="all">전체 부서 보기</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={handleSaveAll}
            disabled={isClosed}
            className={`inline-flex items-center px-4 py-2 rounded-xl font-medium text-xs shadow-xs transition-colors ${
              isClosed
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-[#0F2D59] text-white hover:bg-[#1B365D]'
            }`}
          >
            <Save className="w-4 h-4 mr-1.5" />
            저장하기
          </button>
        </div>
      </div>

      {/* Status Warning Banner */}
      {currentRound && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            currentRound.status === 'open'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center space-x-3">
            {currentRound.status === 'open' ? (
              <Unlock className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <Lock className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div>
              <p className="text-sm font-bold">
                [{currentRound.name}] 대상 월: {getMonthName(0)} ~ {getMonthName(4)} ({currentRound.status === 'open' ? '입력 및 수정 가능' : '마감됨'})
              </p>
              <p className="text-xs opacity-80">
                비교 대상 직전 회차: {prevRound ? prevRound.name : '없음'} | 1천만원(10백만원) 이상 차이 발생 시 '차이사유' 입력 필수
              </p>
            </div>
          </div>
          {currentRound.status === 'closed' && (
            <span className="text-xs font-semibold bg-amber-200/60 px-3 py-1 rounded-full text-amber-900">
              읽기 전용 모드
            </span>
          )}
        </div>
      )}

      {/* Filters Bar matching order: GL계정 / GL계정명 / 세목 / 귀속 / 주관부서 / 담당자 */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-700">검색 및 필터 조건 (GL계정 / GL계정명 / 세목 / 귀속 / 주관부서 / 담당자 / 상태)</span>
          <span className="text-xs text-slate-400">총 {filteredMasterItems.length}개 항목</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">GL계정</label>
            <input
              type="text"
              placeholder="GL코드..."
              value={filterGlCode}
              onChange={(e) => setFilterGlCode(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">GL계정명</label>
            <input
              type="text"
              placeholder="계정명..."
              value={filterGlName}
              onChange={(e) => setFilterGlName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">세목</label>
            <input
              type="text"
              placeholder="세목..."
              value={filterSubItem}
              onChange={(e) => setFilterSubItem(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">귀속</label>
            <select
              value={filterAttribution}
              onChange={(e) => setFilterAttribution(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            >
              <option value="all">전체/공통/MTBE4/P3</option>
              <option value="공통">공통</option>
              <option value="MTBE4">MTBE4</option>
              <option value="P3">P3</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">주관부서</label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            >
              <option value="all">전체 부서</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">담당자</label>
            <input
              type="text"
              placeholder="담당자..."
              value={filterManager}
              onChange={(e) => setFilterManager(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">차이금액 이상</label>
            <input
              type="number"
              placeholder="최소 차이..."
              value={filterMinDiff}
              onChange={(e) => setFilterMinDiff(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">차이금액 이하</label>
            <input
              type="number"
              placeholder="최대 차이..."
              value={filterMaxDiff}
              onChange={(e) => setFilterMaxDiff(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">입력상태</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            >
              <option value="all">전체보기</option>
              <option value="entered">입력완료</option>
              <option value="empty">미입력</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table with Horizontal Scroll & Year Grouping Headers */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#0F2D59]/30" tabIndex={0} onKeyDown={handleKeyDown}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1700px]">
            <thead>
              {/* Row 0: Section Group Header */}
              <tr className="bg-[#0F2D59] text-white text-xs font-bold text-center">
                <th colSpan={6} className="py-2.5 px-3 border-r border-blue-900 text-left">
                  기본 정보 (백만원)
                </th>
                <th colSpan={5} className="py-2.5 px-3 border-r border-blue-900 bg-[#14315F]">
                  {prevRound ? prevRound.name : '이전 회차'}
                </th>
                <th colSpan={5} className="py-2.5 px-3 border-r border-blue-900 bg-[#1B3A6B]">
                  {currentRound?.name || '금번 회차'}
                </th>
                <th colSpan={5} className="py-2.5 px-3 border-r border-blue-900 bg-[#102544]">
                  차이금액 (금번 - 이전)
                </th>
                <th className="py-2.5 px-3 bg-[#0B1D38]">차이사유</th>
              </tr>

              {/* Row 1: Year Grouping Header ( 26년, 27년 같이 요약 ) */}
              <tr className="bg-[#1A3865] text-white text-[11px] font-semibold text-center border-b border-blue-900">
                <th colSpan={6} className="border-r border-blue-900"></th>
                
                {yearSpans.map((span, sIdx) => (
                  <th key={`prev-y-${sIdx}`} colSpan={span.count} className={`border-r border-blue-900 bg-[#1F4075] py-1`}>
                    {String(span.year).slice(2)}년
                  </th>
                ))}
                
                {yearSpans.map((span, sIdx) => (
                  <th key={`cur-y-${sIdx}`} colSpan={span.count} className={`border-r border-blue-900 bg-[#244882] py-1`}>
                    {String(span.year).slice(2)}년
                  </th>
                ))}

                {yearSpans.map((span, sIdx) => (
                  <th key={`diff-y-${sIdx}`} colSpan={span.count} className={`border-r border-blue-900 bg-[#16335C] py-1`}>
                    {String(span.year).slice(2)}년 차이
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
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredMasterItems.length === 0 ? (
                <tr>
                  <td colSpan={23} className="py-12 text-center text-slate-400 font-sans">
                    조건에 해당하는 마스터 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredMasterItems.map((master, rIdx) => {
                  const monthKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
                  const reasonVal = getReasonForMaster(master.id);
                  const isOver10M = hasLargeVariance(master.id);

                  return (
                    <tr key={master.id} className="hover:bg-slate-50/80 transition-colors">
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

                      {/* 1. Previous 5 months (Read-only) */}
                      {[0, 1, 2, 3, 4].map((idx) => {
                        const mNum = roundMonths[idx];
                        const prevVal = getPrevMonthValue(master.id, mNum);
                        return (
                          <td key={`prev-${idx}`} className={`py-2 px-2 text-right bg-slate-50 font-mono text-xs text-slate-500 ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                            {prevVal !== null ? prevVal.toLocaleString() : '-'}
                          </td>
                        );
                      })}

                      {/* 2. Current 5 months (Editable) */}
                      {[0, 1, 2, 3, 4].map((idx) => {
                        const mKey = monthKeys[idx];
                        const val = getCellValue(master.id, mKey);
                        const isSelected = selectedCells.has(`${master.id}_${mKey}`);

                        return (
                          <td
                            key={`cur-${idx}`}
                            onClick={(e) => handleCellClick(rIdx, idx, e)}
                            className={`py-2 px-2 text-right ${idx === 4 ? 'border-r border-slate-300' : ''} ${isSelected ? 'bg-blue-100/60' : ''}`}
                          >
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={isClosed}
                              value={val}
                              onChange={(e) => handleInputChange(master.id, mKey, e.target.value)}
                              onPaste={(e) => handlePaste(e, master.id, mKey)}
                              placeholder="0"
                              className={`w-24 text-right px-2 py-1 text-xs font-mono font-bold rounded border ${
                                isClosed
                                  ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/30 text-slate-900'
                                  : 'bg-white border-slate-300 focus:border-[#0F2D59] focus:ring-2 focus:ring-[#0F2D59]/20 text-slate-900'
                              }`}
                            />
                          </td>
                        );
                      })}

                      {/* 3. Diff 5 months (Calculated) */}
                      {[0, 1, 2, 3, 4].map((idx) => {
                        const mKey = monthKeys[idx];
                        const mNum = roundMonths[idx];
                        const val = getCellValue(master.id, mKey);
                        const prevVal = getPrevMonthValue(master.id, mNum);

                        let diff: number | null = null;
                        if (val !== '' && prevVal !== null) {
                          diff = Number(val) - prevVal;
                        }

                        return (
                          <td key={`diff-${idx}`} className={`py-2 px-2 text-right font-mono text-xs ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                            {diff !== null ? (
                              <span
                                className={`font-semibold ${
                                  diff > 0 ? 'text-red-600' : diff < 0 ? 'text-blue-600' : 'text-slate-500'
                                }`}
                              >
                                {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Reason Column */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          disabled={isClosed}
                          placeholder={isOver10M ? '★ 1천만원 이상 차이사유 필수' : '차이사유 (선택)'}
                          value={reasonVal}
                          onChange={(e) => handleReasonInput(master.id, e.target.value)}
                          className={`w-full px-2.5 py-1.5 text-xs rounded border ${
                            isOver10M && (!reasonVal || reasonVal.trim() === '')
                              ? 'bg-red-50 border-red-400 text-red-900 placeholder-red-400 ring-2 ring-red-400/30 font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        />
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
