import React, { useState, useMemo, useRef } from 'react';
import { Department, EntryData, MasterItem, Round, UserProfile } from '../types';
import { DEPARTMENTS } from '../initialData';
import { Lock, Unlock, Save, FileSpreadsheet, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

// Helper to format numbers with thousand separator commas
export const formatWithCommas = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val).trim();
  if (str === '-' || str === '.' || str === '-.' || str === '-0') return str;

  const clean = str.replace(/,/g, '');
  if (clean === '' || clean === '-' || clean === '.' || clean === '-.') return clean;

  const parts = clean.split('.');
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? parts[1] : undefined;

  const isNegative = integerPart.startsWith('-');
  const absInt = isNegative ? integerPart.slice(1) : integerPart;

  const formattedInt = (isNegative ? '-' : '') + absInt.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (decimalPart !== undefined) {
    return `${formattedInt}.${decimalPart}`;
  }
  return formattedInt;
};

interface DataEntryViewProps {
  currentUser: UserProfile;
  rounds: Round[];
  masterItems: MasterItem[];
  entries: EntryData[];
  onSaveEntry: (entry: EntryData) => Promise<{ success: boolean; error?: string }>;
  onBatchSaveEntries: (entries: EntryData[]) => Promise<{ success: boolean; error?: string }>;
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
    rounds.length > 0 ? rounds[rounds.length - 1].id : ''
  );

  React.useEffect(() => {
    if (!selectedRoundId && rounds.length > 0) {
      setSelectedRoundId(rounds[rounds.length - 1].id);
    }
  }, [rounds, selectedRoundId]);

  const [selectedDept, setSelectedDept] = useState<Department | 'all'>(
    currentUser.role === 'dept_user' ? (currentUser.department || '노경') : 'all'
  );

  // Search & Filter conditions
  const [filterGlCode, setFilterGlCode] = useState('');
  const [filterSubItem, setFilterSubItem] = useState('');
  const [filterAttribution, setFilterAttribution] = useState('');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterManager, setFilterManager] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMinDiff, setFilterMinDiff] = useState<string>('');
  const [filterMaxDiff, setFilterMaxDiff] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);

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
    setFilterDept('all');
    setFilterManager('');
    setFilterMinDiff('');
    setFilterMaxDiff('');
    setFilterStatus('all');
  };

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

  // Local draft state for modified cells only
  const [draftValues, setDraftValues] = useState<{ [key: string]: number | string }>({});
  const [draftReasons, setDraftReasons] = useState<{ [key: string]: string }>({});

  // Multi-cell selection & Excel paste support
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [anchorCell, setAnchorCell] = useState<{ rIdx: number; mIdx: number } | null>(null);
  const [currentCell, setCurrentCell] = useState<{ rIdx: number; mIdx: number } | null>(null);

  const monthKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];

  const handleCellClick = (rIdx: number, mIdx: number, e: React.MouseEvent) => {
    const master = filteredMasterItems[rIdx];
    if (!master) return;
    const cellKey = `${master.id}_${monthKeys[mIdx]}`;

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
      setCurrentCell({ rIdx, mIdx });
    } else {
      setAnchorCell({ rIdx, mIdx });
      setCurrentCell({ rIdx, mIdx });
      setSelectedCells(new Set([cellKey]));
    }
  };

  const handleCellFocus = (rIdx: number, mIdx: number) => {
    const master = filteredMasterItems[rIdx];
    if (!master) return;
    setAnchorCell({ rIdx, mIdx });
    setCurrentCell({ rIdx, mIdx });
    setSelectedCells(new Set([`${master.id}_${monthKeys[mIdx]}`]));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const activeTarget = document.activeElement;
    const isInput = activeTarget && activeTarget.tagName.toLowerCase() === 'input';

    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      if (selectedCells.size > 0) {
        let minR = Infinity, maxR = -Infinity, minM = Infinity, maxM = -Infinity;
        filteredMasterItems.forEach((m, rIdx) => {
          monthKeys.forEach((mKey, mIdx) => {
            if (selectedCells.has(`${m.id}_${mKey}`)) {
              minR = Math.min(minR, rIdx);
              maxR = Math.max(maxR, rIdx);
              minM = Math.min(minM, mIdx);
              maxM = Math.max(maxM, mIdx);
            }
          });
        });

        if (minR !== Infinity) {
          const rowsText: string[] = [];
          for (let ri = minR; ri <= maxR; ri++) {
            const rm = filteredMasterItems[ri];
            const rowVals: string[] = [];
            for (let mi = minM; mi <= maxM; mi++) {
              const val = getCellValue(rm.id, monthKeys[mi]);
              rowVals.push(val !== '' && val !== undefined && val !== null ? String(val) : '');
            }
            rowsText.push(rowVals.join('\t'));
          }
          navigator.clipboard.writeText(rowsText.join('\n'));
        }
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedCells.size > 0 && !isClosed) {
        const shouldClearSelection =
          e.key === 'Delete' ||
          selectedCells.size > 1 ||
          !isInput ||
          (isInput && (activeTarget as HTMLInputElement).value === '');

        if (shouldClearSelection) {
          e.preventDefault();
          const newDrafts = { ...draftValues };
          selectedCells.forEach(cellKey => {
            newDrafts[cellKey] = '';
          });
          setDraftValues(newDrafts);
          return;
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
          newDrafts[`${targetMaster.id}_${targetMKey}`] = Number(Number(cleaned).toFixed(1));
        }
      });
    });

    setDraftValues(newDrafts);
  };

  const roundEntries = entries.filter((e) => e.roundId === selectedRoundId);

  // Find previous round for comparison
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
    return entry[monthKey] !== null && entry[monthKey] !== undefined ? entry[monthKey] : '';
  };

  // Requirement 3: Return null when no data in previous round (비교 불가)
  const getPrevMonthValue = (masterId: string, currentMonthNum: number): number | null => {
    if (!prevRound) return null;
    const prevRoundMonths = getRoundMonths(prevRound);
    const prevMonthIdx = prevRoundMonths.indexOf(currentMonthNum);
    if (prevMonthIdx === -1) return null;

    const prevEntry = prevRoundEntries.find((e) => e.masterId === masterId);
    if (!prevEntry) return null;

    const keys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const key = keys[prevMonthIdx];
    const val = prevEntry[key];
    if (val === '' || val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  };

  const filteredMasterItems = masterItems.filter((m) => {
    const userDeptCheck = currentUser.role === 'dept_user' ? currentUser.department : selectedDept;
    const matchesUserDept = userDeptCheck === 'all' || !userDeptCheck || m.dept === userDeptCheck;
    const matchesFilterDept = !filterDept || filterDept === 'all' || (m.dept || '').toLowerCase().includes(filterDept.toLowerCase());

    const glQuery = (filterGlCode || '').trim().toLowerCase();
    const matchesGl = !glQuery || (m.glCode || '').toLowerCase().includes(glQuery) || (m.glName || '').toLowerCase().includes(glQuery);
    const matchesSub = (m.subItem || '').toLowerCase().includes((filterSubItem || '').toLowerCase());
    const matchesAttr = !filterAttribution || filterAttribution === 'all' || (m.attribution || '').toLowerCase().includes(filterAttribution.toLowerCase());
    const matchesManager = (m.manager || '').toLowerCase().includes((filterManager || '').toLowerCase());

    const entry = roundEntries.find((e) => e.masterId === m.id);
    // Requirement 3: An item is completed ONLY IF all 5 months are entered!
    const isCompleted = entry && monthKeys.every((k) => typeof entry[k] === 'number' && !isNaN(entry[k] as number));

    let matchesStatus = true;
    if (filterStatus === 'entered') matchesStatus = !!isCompleted;
    if (filterStatus === 'empty') matchesStatus = !isCompleted;

    let matchesDiff = true;
    if (filterMinDiff !== '' || filterMaxDiff !== '') {
      const minD = filterMinDiff !== '' ? Number(filterMinDiff) : -Infinity;
      const maxD = filterMaxDiff !== '' ? Number(filterMaxDiff) : Infinity;

      let hasMatchingDiff = false;
      [0, 1, 2, 3, 4].forEach((idx) => {
        const mKey = monthKeys[idx];
        const mNum = roundMonths[idx];
        const curVal = getCellValue(m.id, mKey);
        const prevVal = getPrevMonthValue(m.id, mNum);
        const cleanCur = typeof curVal === 'string' ? curVal.replace(/,/g, '').trim() : curVal;
        const numCur = typeof curVal === 'number' ? curVal : parseFloat(String(cleanCur));

        // Requirement 3: Only compare if BOTH exist as numbers
        if (cleanCur !== '' && !isNaN(numCur) && prevVal !== null) {
          const diff = prevVal - numCur;
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
    const rawVal = val.replace(/,/g, '').trim();

    if (rawVal === '' || rawVal === '-' || rawVal === '.' || rawVal === '-.') {
      setDraftValues((prev) => ({ ...prev, [`${masterId}_${monthKey}`]: rawVal }));
      return;
    }

    if (!/^-?\d*(\.\d{0,1})?$/.test(rawVal)) {
      return;
    }

    const formatted = formatWithCommas(rawVal);
    setDraftValues((prev) => ({ ...prev, [`${masterId}_${monthKey}`]: formatted }));
  };

  const handleInputBlur = (masterId: string, monthKey: 'm1' | 'm2' | 'm3' | 'm4' | 'm5') => {
    const key = `${masterId}_${monthKey}`;
    const cur = draftValues[key];
    if (cur !== undefined) {
      const raw = String(cur).replace(/,/g, '').trim();
      if (raw === '' || raw === '.' || raw === '-' || raw === '-.') {
        setDraftValues((prev) => ({ ...prev, [key]: '' }));
      } else {
        const num = parseFloat(raw);
        if (isNaN(num)) {
          setDraftValues((prev) => ({ ...prev, [key]: '' }));
        } else {
          const normalized = Number(num.toFixed(1));
          setDraftValues((prev) => ({ ...prev, [key]: formatWithCommas(normalized) }));
        }
      }
    }
  };

  const handleReasonInput = (masterId: string, val: string) => {
    setDraftReasons((prev) => ({ ...prev, [masterId]: val }));
  };

  const getReasonForMaster = (masterId: string) => {
    if (masterId in draftReasons) return draftReasons[masterId];
    const entry = roundEntries.find((e) => e.masterId === masterId);
    return entry?.reason || '';
  };

  // Requirement 3: Check variance ONLY when BOTH prev and cur are numbers!
  const hasLargeVariance = (masterId: string) => {
    for (let idx = 0; idx < 5; idx++) {
      const val = getCellValue(masterId, monthKeys[idx]);
      const mNum = roundMonths[idx];
      const prevVal = getPrevMonthValue(masterId, mNum);
      if (val !== '' && val !== '.' && val !== '-' && val !== '-.' && val !== undefined && val !== null && prevVal !== null) {
        const cleanVal = String(val).replace(/,/g, '').trim();
        const numVal = Number(cleanVal);
        if (!isNaN(numVal) && Math.abs(prevVal - numVal) >= 10) {
          return true;
        }
      }
    }
    return false;
  };

  // Requirement 2: Save ONLY changed items, do not overwrite other items, verify DB success
  const handleSaveAll = async () => {
    if (isClosed) {
      alert('마감된 회차는 저장할 수 없습니다.');
      return;
    }

    // Identify which master items were modified in drafts
    const modifiedMasterIds = new Set<string>();
    Object.keys(draftValues).forEach((key) => {
      const mId = key.split('_')[0];
      if (mId) modifiedMasterIds.add(mId);
    });
    Object.keys(draftReasons).forEach((mId) => modifiedMasterIds.add(mId));

    if (modifiedMasterIds.size === 0) {
      alert('수정되거나 변경된 항목이 없습니다.');
      return;
    }

    // Check large variance reason for modified items
    for (const masterId of modifiedMasterIds) {
      const master = masterItems.find((m) => m.id === masterId);
      if (master && hasLargeVariance(masterId)) {
        const reason = getReasonForMaster(masterId);
        if (!reason || reason.trim() === '') {
          alert(
            `[저장 불가] 1천만원 이상 차이가 발생하는 항목이 존재합니다.\n\n- GL계정: ${master.glCode} (${master.glName} - ${master.subItem})\n- 사유 미입력 시 저장이 불가합니다. '차이사유' 열에 사유를 입력해 주세요.`
          );
          return;
        }
      }
    }

    setIsSaving(true);

    try {
      // Build ONLY changed EntryData objects
      const changedEntries: EntryData[] = [];
      modifiedMasterIds.forEach((masterId) => {
        const master = masterItems.find((m) => m.id === masterId);
        if (!master) return;

        const existing = roundEntries.find((e) => e.masterId === masterId);

        const getValueForMonth = (mKey: 'm1' | 'm2' | 'm3' | 'm4' | 'm5'): number | '' => {
          const draftKey = `${masterId}_${mKey}`;
          if (draftKey in draftValues) {
            const raw = draftValues[draftKey];
            if (raw === '' || raw === '.' || raw === '-' || raw === '-.') return '';
            const num = Number(String(raw).replace(/,/g, '').trim());
            return isNaN(num) ? '' : Number(num.toFixed(1));
          }
          return existing && existing[mKey] !== undefined && existing[mKey] !== null ? existing[mKey] : '';
        };

        const entry: EntryData = {
          id: `${selectedRoundId}_${master.id}`,
          roundId: selectedRoundId,
          masterId: master.id,
          dept: master.dept,
          m1: getValueForMonth('m1'),
          m2: getValueForMonth('m2'),
          m3: getValueForMonth('m3'),
          m4: getValueForMonth('m4'),
          m5: getValueForMonth('m5'),
          reason: getReasonForMaster(masterId),
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.name,
        };

        changedEntries.push(entry);
      });

      const result = await onBatchSaveEntries(changedEntries);

      if (result.success) {
        // Clear only the drafts of successfully saved items
        const newDraftValues = { ...draftValues };
        const newDraftReasons = { ...draftReasons };
        modifiedMasterIds.forEach((mId) => {
          monthKeys.forEach((k) => delete newDraftValues[`${mId}_${k}`]);
          delete newDraftReasons[mId];
        });
        setDraftValues(newDraftValues);
        setDraftReasons(newDraftReasons);

        alert(`총 ${changedEntries.length}개 항목이 데이터베이스에 안전하게 저장되었습니다.`);
      } else {
        // Keep drafts so user does not lose data!
        alert(`[저장 실패] 데이터베이스 저장 중 오류가 발생했습니다: ${result.error || '통신 오류'}\n\n입력하신 내용은 화면에 유지되고 있으니 잠시 후 다시 시도해 주세요.`);
      }
    } catch (err: any) {
      alert(`[오류 발생] 저장 처리 중 예외가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExcelDownload = () => {
    if (!currentRound) return;

    const exportData = filteredMasterItems.map((master) => {
      const row: Record<string, any> = {
        'GL계정': master.glCode,
        'GL계정명': master.glName,
        '세목': master.subItem,
        '귀속': master.attribution,
        '주관부서': master.dept,
        '담당자': master.manager,
      };

      // Previous round columns
      if (prevRound) {
        roundMonths.forEach((mNum) => {
          const prevVal = getPrevMonthValue(master.id, mNum);
          row[`[직전_${prevRound.name}] ${mNum}월`] = prevVal !== null ? prevVal : '';
        });
      }

      // Current round input columns
      roundMonths.forEach((mNum, idx) => {
        const mKey = monthKeys[idx];
        const curVal = getCellValue(master.id, mKey);
        const cleanVal = typeof curVal === 'string' ? curVal.replace(/,/g, '').trim() : curVal;
        row[`[금번_${currentRound.name}] ${mNum}월`] = typeof curVal === 'number' ? curVal : (cleanVal || '');
      });

      // Variance columns (반대로 계산: 지난추정 - 금번추정)
      if (prevRound) {
        roundMonths.forEach((mNum, idx) => {
          const mKey = monthKeys[idx];
          const curVal = getCellValue(master.id, mKey);
          const prevVal = getPrevMonthValue(master.id, mNum);
          const cleanCur = typeof curVal === 'string' ? curVal.replace(/,/g, '').trim() : curVal;
          const numCur = typeof curVal === 'number' ? curVal : parseFloat(String(cleanCur));

          if (cleanCur === '' || cleanCur === undefined || cleanCur === null) {
            row[`[차이] ${mNum}월`] = '미입력';
          } else if (prevVal === null) {
            row[`[차이] ${mNum}월`] = '비교불가';
          } else if (!isNaN(numCur)) {
            row[`[차이] ${mNum}월`] = Number((prevVal - numCur).toFixed(1));
          } else {
            row[`[차이] ${mNum}월`] = '';
          }
        });
      }

      row['차이사유'] = getReasonForMaster(master.id) || '';
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    const sheetName = `${currentRound.name.replace(/[\\/*?:[\]]/g, '')}_입력데이터`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

    const fileName = `${currentRound.name}_${selectedDept === 'all' ? '전체부서' : selectedDept}_비용추정_입력자료.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isClosed) {
      alert('마감된 회차에는 데이터를 업로드할 수 없습니다.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        if (!rawData || rawData.length === 0) {
          alert('엑셀 파일에 데이터가 비어있습니다.');
          return;
        }

        const newDrafts = { ...draftValues };
        const newReasons = { ...draftReasons };
        let matchedCount = 0;

        rawData.forEach((row) => {
          let glCode = String(row['GL계정'] || row['GL코드'] || row['계정코드'] || '').trim();
          let glName = String(row['GL계정명'] || row['계정명'] || row['계정과목'] || '').trim();
          let subItem = String(row['세목'] || row['비용세목'] || row['항목'] || '').trim();

          const matchedMaster = masterItems.find((m) => {
            if (glCode && subItem && m.glCode.trim() === glCode && m.subItem.trim() === subItem) {
              return true;
            }
            if (glName && subItem && m.glName.trim() === glName && m.subItem.trim() === subItem) {
              return true;
            }
            return false;
          });

          if (matchedMaster) {
            let rowHasData = false;

            roundMonths.forEach((mNum, idx) => {
              const mKey = monthKeys[idx];
              let foundVal: any = undefined;

              for (const colKey of Object.keys(row)) {
                const k = colKey.trim();
                if (k.includes('직전') || k.includes('차이')) continue;

                if (
                  k === `${mNum}월` ||
                  k.endsWith(`] ${mNum}월`) ||
                  k.includes(`_${mNum}월`) ||
                  k.includes(`금번_${mNum}월`) ||
                  k.includes(`금번 ${mNum}월`) ||
                  k.toLowerCase() === `m${idx + 1}`
                ) {
                  foundVal = row[colKey];
                  break;
                }
              }

              if (foundVal !== undefined && foundVal !== null && String(foundVal).trim() !== '') {
                const cleaned = String(foundVal).trim().replace(/,/g, '');
                if (!isNaN(Number(cleaned))) {
                  newDrafts[`${matchedMaster.id}_${mKey}`] = Number(Number(cleaned).toFixed(1));
                  rowHasData = true;
                } else if (cleaned === '') {
                  newDrafts[`${matchedMaster.id}_${mKey}`] = '';
                  rowHasData = true;
                }
              }
            });

            for (const colKey of Object.keys(row)) {
              const k = colKey.trim();
              if (k === '차이사유' || k === '사유' || k === '차이 사유' || k.toLowerCase() === 'reason') {
                const rVal = row[colKey];
                if (rVal !== undefined && rVal !== null && String(rVal).trim() !== '') {
                  newReasons[matchedMaster.id] = String(rVal).trim();
                  rowHasData = true;
                }
                break;
              }
            }

            if (rowHasData) {
              matchedCount++;
            }
          }
        });

        setDraftValues(newDrafts);
        setDraftReasons(newReasons);

        if (matchedCount > 0) {
          alert(`총 ${matchedCount}개 항목의 데이터를 엑셀에서 불러왔습니다.\n\n수정된 수치를 검토하신 후, [저장하기] 버튼을 눌러 확정해 주세요.`);
        } else {
          alert('일치하는 GL계정/세목 항목을 찾을 수 없거나 데이터가 비어있습니다. 양식을 확인해 주세요.');
        }
      } catch (err) {
        console.error(err);
        alert('엑셀 파일 분석 중 오류가 발생했습니다.');
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const modifiedCount = useMemo(() => {
    const ids = new Set<string>();
    Object.keys(draftValues).forEach((k) => ids.add(k.split('_')[0]));
    Object.keys(draftReasons).forEach((k) => ids.add(k));
    return ids.size;
  }, [draftValues, draftReasons]);

  return (
    <div className="max-w-[98rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Selectors & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">입력 회차:</span>
            <select
              value={selectedRoundId}
              onChange={(e) => {
                if (modifiedCount > 0) {
                  if (!confirm('저장되지 않은 변경 사항이 있습니다. 회차를 전환하시겠습니까?')) {
                    return;
                  }
                }
                setSelectedRoundId(e.target.value);
                setDraftValues({});
                setDraftReasons({});
              }}
              className="text-xs font-bold text-[#0F2D59] bg-[#0F2D59]/10 px-2.5 py-1 rounded border border-[#0F2D59]/20 focus:outline-hidden cursor-pointer"
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
                className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 focus:outline-hidden cursor-pointer"
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
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleExcelUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            onClick={handleExcelDownload}
            className="inline-flex items-center px-3.5 py-2 rounded-xl font-medium text-xs bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
            title="현재 조회 중인 입력 양식 및 기존 데이터를 엑셀 파일로 다운로드합니다."
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
            엑셀 다운로드
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isClosed}
            className={`inline-flex items-center px-3.5 py-2 rounded-xl font-medium text-xs shadow-xs transition-colors cursor-pointer ${
              isClosed
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
            title="엑셀 파일로 작성된 비용추정 입력 데이터를 일괄 업로드합니다."
          >
            <Upload className="w-4 h-4 mr-1.5" />
            엑셀 업로드
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isClosed || isSaving}
            className={`inline-flex items-center px-4 py-2 rounded-xl font-medium text-xs shadow-xs transition-colors cursor-pointer ${
              isClosed
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-[#0F2D59] text-white hover:bg-[#1B365D]'
            }`}
          >
            <Save className={`w-4 h-4 mr-1.5 ${isSaving ? 'animate-pulse' : ''}`} />
            {isSaving ? '저장 중...' : modifiedCount > 0 ? `저장하기 (${modifiedCount}건 수정됨)` : '저장하기'}
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
                [{currentRound.name}] 대상 5개월: {getMonthName(0)} ~ {getMonthName(4)} ({currentRound.status === 'open' ? '입력 및 수정 가능' : '마감됨'})
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                비교 대상 직전 회차: {prevRound ? prevRound.name : '없음'} | 1천만원(10백만원) 이상 차이 발생 시 '차이사유' 입력 필수
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Conditions */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-700">검색 및 상세 필터</span>
          <button
            onClick={handleResetFilters}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
          >
            필터 초기화
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">GL계정</label>
            <input
              type="text"
              list="entry-gl-accounts"
              placeholder="코드 또는 계정명..."
              value={filterGlCode}
              onChange={(e) => setFilterGlCode(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            />
            <datalist id="entry-gl-accounts">
              {distinctGlAccounts.map((gl) => (
                <option key={gl.glCode} value={gl.glCode}>
                  {gl.glCode} - {gl.glName}
                </option>
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">세목</label>
            <input
              type="text"
              list="entry-sub-items"
              placeholder="세목 입력..."
              value={filterSubItem}
              onChange={(e) => setFilterSubItem(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            />
            <datalist id="entry-sub-items">
              {distinctSubItems.map((sub) => (
                <option key={sub} value={sub} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">귀속</label>
            <select
              value={filterAttribution}
              onChange={(e) => setFilterAttribution(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden cursor-pointer"
            >
              <option value="all">전체</option>
              {distinctAttributions.map((attr) => (
                <option key={attr} value={attr}>
                  {attr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">주관부서</label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden cursor-pointer"
            >
              <option value="all">전체</option>
              {distinctDepartments.map((d) => (
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
              list="entry-managers"
              placeholder="담당자명..."
              value={filterManager}
              onChange={(e) => setFilterManager(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            />
            <datalist id="entry-managers">
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
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">입력상태</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden cursor-pointer"
            >
              <option value="all">전체보기</option>
              <option value="entered">5개월 완료</option>
              <option value="empty">미입력/미완료</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#0F2D59]/30" tabIndex={0} onKeyDown={handleKeyDown}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1700px]">
            <thead>
              {/* Row 0: Section Group Header */}
              <tr className="bg-[#0F2D59] text-white text-xs font-bold text-center">
                <th colSpan={5} className="py-2.5 px-3 border-r border-blue-900 text-left">
                  기본 정보 (단위: 백만원)
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

              {/* Row 1: Year Grouping Header */}
              <tr className="bg-[#1A3865] text-white text-[11px] font-semibold text-center border-b border-blue-900">
                <th colSpan={5} className="border-r border-blue-900"></th>
                
                {yearSpans.map((span, sIdx) => (
                  <th key={`prev-y-${sIdx}`} colSpan={span.count} className="border-r border-blue-900 bg-[#1F4075] py-1">
                    {span.year}년
                  </th>
                ))}
                
                {yearSpans.map((span, sIdx) => (
                  <th key={`cur-y-${sIdx}`} colSpan={span.count} className="border-r border-blue-900 bg-[#244882] py-1">
                    {span.year}년
                  </th>
                ))}

                {yearSpans.map((span, sIdx) => (
                  <th key={`diff-y-${sIdx}`} colSpan={span.count} className="border-r border-blue-900 bg-[#16335C] py-1">
                    {span.year}년
                  </th>
                ))}

                <th className="bg-[#0F2D59]"></th>
              </tr>

              {/* Row 2: Month Sub-Headers */}
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
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredMasterItems.length === 0 ? (
                <tr>
                  <td colSpan={22} className="py-12 text-center text-slate-400 font-sans">
                    조건에 해당하는 마스터 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredMasterItems.map((master, rIdx) => {
                  const reasonVal = getReasonForMaster(master.id);
                  const isOver10M = hasLargeVariance(master.id);

                  return (
                    <tr key={master.id} className="hover:bg-slate-50/80 transition-colors">
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
                              value={formatWithCommas(val)}
                              onChange={(e) => handleInputChange(master.id, mKey, e.target.value)}
                              onBlur={() => handleInputBlur(master.id, mKey)}
                              onFocus={() => handleCellFocus(rIdx, idx)}
                              onKeyDown={handleKeyDown}
                              onPaste={(e) => handlePaste(e, master.id, mKey)}
                              placeholder="-"
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

                      {/* 3. Diff 5 months: ONLY when BOTH are numbers! */}
                      {[0, 1, 2, 3, 4].map((idx) => {
                        const mKey = monthKeys[idx];
                        const mNum = roundMonths[idx];
                        const val = getCellValue(master.id, mKey);
                        const prevVal = getPrevMonthValue(master.id, mNum);

                        let diff: number | null = null;
                        let statusText = '-';

                        const cleanVal = typeof val === 'string' ? val.replace(/,/g, '').trim() : val;
                        const hasCurNum = cleanVal !== '' && cleanVal !== '.' && cleanVal !== '-' && cleanVal !== '-.' && cleanVal !== undefined && cleanVal !== null && !isNaN(Number(cleanVal));

                        if (!hasCurNum) {
                          statusText = '미입력';
                        } else if (prevVal === null) {
                          statusText = '비교불가';
                        } else {
                          const numVal = Number(cleanVal);
                          diff = Number((prevVal - numVal).toFixed(1));
                        }

                        return (
                          <td key={`diff-${idx}`} className={`py-2 px-2 text-right font-mono text-xs ${idx === 4 ? 'border-r border-slate-300' : ''}`}>
                            {diff !== null ? (
                              <span
                                className={`font-semibold ${
                                  diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-500'
                                }`}
                              >
                                {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] font-sans">{statusText}</span>
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
