import React, { useState, useMemo, useEffect } from 'react';
import { Department, EntryData, MasterItem, Round, UserProfile } from '../types';
import {
  Sparkles,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  MessageSquareText,
  ArrowRight,
  Bot,
  RefreshCw,
  Clock,
  Layers,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface AISummaryCardProps {
  currentUser: UserProfile;
  currentRound: Round | undefined;
  prevRound: Round | undefined;
  roundMonths: number[];
  masterItems: MasterItem[];
  entries: EntryData[];
  getPrevMonthValue: (masterId: string, monthNum: number) => number | null;
  onNavigateToAiChat?: () => void;
}

interface VarianceItem {
  id: string;
  dept: Department;
  manager: string;
  glCode: string;
  glName: string;
  subItem: string;
  attribution: string;
  prevTotal: number | null;
  curTotal: number | null;
  diffTotal: number | null;
  isComparable: boolean;
  reason: string;
}

export const AISummaryCard: React.FC<AISummaryCardProps> = ({
  currentUser,
  currentRound,
  prevRound,
  roundMonths,
  masterItems,
  entries,
  getPrevMonthValue,
  onNavigateToAiChat,
}) => {
  const isOperator = currentUser.role === 'operator';

  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Generative AI Analysis State
  const [aiAnalysisStatus, setAiAnalysisStatus] = useState<'idle' | 'loading' | 'success' | 'rule_based' | 'error'>('idle');
  const [aiSummaryText, setAiSummaryText] = useState<string>('');
  const [aiModelName, setAiModelName] = useState<string>('');
  const [aiTimestamp, setAiTimestamp] = useState<string>('');
  const [aiDataChecksum, setAiDataChecksum] = useState<string>('');
  const [aiNotice, setAiNotice] = useState<string>('');

  // Filter master items relevant to user
  const relevantMasterItems = useMemo(() => {
    if (isOperator) return masterItems;
    return masterItems.filter((m) => m.dept === currentUser.department);
  }, [masterItems, isOperator, currentUser.department]);

  // Round entries for selected round
  const roundEntries = useMemo(() => {
    if (!currentRound) return [];
    return entries.filter((e) => e.roundId === currentRound.id);
  }, [entries, currentRound]);

  // Generate a lightweight checksum of current round entries to detect modifications
  const currentDataChecksum = useMemo(() => {
    if (!currentRound) return '';
    const relevantIds = new Set(relevantMasterItems.map((m) => m.id));
    const targetEntries = roundEntries.filter((e) => relevantIds.has(e.masterId));
    return targetEntries
      .map((e) => `${e.masterId}:${e.m1},${e.m2},${e.m3},${e.m4},${e.m5}:${e.reason || ''}`)
      .join('|');
  }, [currentRound, relevantMasterItems, roundEntries]);

  // If underlying data changed since last AI generation, mark as stale
  const isAiDataStale = Boolean(
    aiAnalysisStatus !== 'idle' &&
    aiDataChecksum &&
    aiDataChecksum !== currentDataChecksum
  );

  // Exact Calculation logic adhering strictly to:
  // - 빈칸: '미입력'
  // - 0: '실제 0'
  // - 직전 데이터 없음: '비교 불가'
  // - 양쪽 모두 숫자인 경우에만 차이 계산
  // - 5개월 전체 입력 시에만 완료로 카운트
  const {
    totalItems,
    fullyEnteredItems,
    unenteredItems,
    enteredSum5M,
    comparableDiff5M,
    comparableCount,
    topVariances,
  } = useMemo(() => {
    let completedCount = 0;
    let totalEnteredSum = 0;
    let prevComparableSum = 0;
    let curComparableSum = 0;
    let comparablePairCount = 0;

    const varianceList: VarianceItem[] = [];
    const mKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];

    relevantMasterItems.forEach((m) => {
      const entry = roundEntries.find((e) => e.masterId === m.id);

      let itemEnteredMonths = 0;
      let itemCurSum = 0;
      let itemPrevSum = 0;
      let itemDiffSum = 0;
      let itemHasComparableMonth = false;

      roundMonths.forEach((mNum, idx) => {
        const key = mKeys[idx];
        const rawCur = entry?.[key];

        // Current month status
        const hasCur =
          rawCur !== undefined &&
          rawCur !== null &&
          rawCur !== '' &&
          !isNaN(Number(rawCur));
        const numCur = hasCur ? Number(rawCur) : null;

        if (hasCur) {
          itemEnteredMonths++;
          itemCurSum += numCur!;
          totalEnteredSum += numCur!;
        }

        // Prev month status
        const rawPrev = getPrevMonthValue(m.id, mNum);
        const hasPrev = rawPrev !== null && rawPrev !== undefined && !isNaN(rawPrev);
        const numPrev = hasPrev ? Number(rawPrev) : null;

        if (hasPrev) {
          itemPrevSum += numPrev!;
        }

        // Only calculate diff when BOTH are numbers!
        if (hasCur && hasPrev) {
          itemHasComparableMonth = true;
          const diff = Number((numPrev! - numCur!).toFixed(1));
          itemDiffSum += diff;
          prevComparableSum += numPrev!;
          curComparableSum += numCur!;
          comparablePairCount++;
        }
      });

      // Fully completed only if all 5 months entered
      if (itemEnteredMonths === 5) {
        completedCount++;
      }

      if (itemHasComparableMonth) {
        const roundedDiff = Number(itemDiffSum.toFixed(1));
        const itemRecord: VarianceItem = {
          id: m.id,
          dept: m.dept,
          manager: m.manager,
          glCode: m.glCode,
          glName: m.glName,
          subItem: m.subItem,
          attribution: m.attribution,
          prevTotal: Number(itemPrevSum.toFixed(1)),
          curTotal: Number(itemCurSum.toFixed(1)),
          diffTotal: roundedDiff,
          isComparable: true,
          reason: entry?.reason || '',
        };

        if (Math.abs(roundedDiff) > 0) {
          varianceList.push(itemRecord);
        }
      }
    });

    // Sort by absolute difference descending
    varianceList.sort((a, b) => Math.abs(b.diffTotal || 0) - Math.abs(a.diffTotal || 0));

    return {
      totalItems: relevantMasterItems.length,
      fullyEnteredItems: completedCount,
      unenteredItems: relevantMasterItems.length - completedCount,
      enteredSum5M: Number(totalEnteredSum.toFixed(1)),
      comparableDiff5M: comparablePairCount > 0 ? Number((prevComparableSum - curComparableSum).toFixed(1)) : null,
      comparableCount: comparablePairCount,
      topVariances: varianceList.slice(0, 6),
    };
  }, [relevantMasterItems, roundEntries, roundMonths, getPrevMonthValue]);

  // Format difference text: +이면 '(개선)', -이면 '(악화)'
  const formatDiffText = (diff: number | null) => {
    if (diff === null) return '비교 불가 (데이터 부족)';
    if (diff > 0) {
      return `+${diff.toLocaleString()} 백만원(개선)`;
    } else if (diff < 0) {
      return `${diff.toLocaleString()} 백만원(악화)`;
    } else {
      return `0 백만원`;
    }
  };

  // Handler to trigger Generative AI analysis
  const handleGenerateAiAnalysis = async (force = false) => {
    if (!currentRound) return;
    setAiAnalysisStatus('loading');
    setAiNotice('');

    try {
      const topVariancesPayload = topVariances.map((v) => ({
        dept: v.dept,
        glCode: v.glCode,
        glName: v.glName,
        subItem: v.subItem,
        manager: v.manager,
        prevTotal: v.prevTotal,
        curTotal: v.curTotal,
        diffTotal: v.diffTotal,
        diffFormatted: formatDiffText(v.diffTotal),
        reason: v.reason,
      }));

      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: currentUser.role,
          department: currentUser.department,
          currentRoundName: currentRound.name,
          prevRoundName: prevRound?.name || '',
          roundMonths,
          summaryData: {
            enteredSum: enteredSum5M,
            diff: comparableDiff5M,
            diffFormatted: formatDiffText(comparableDiff5M),
            completedCount: fullyEnteredItems,
            uncompletedCount: unenteredItems,
            comparableCount,
          },
          topVariances: topVariancesPayload,
          pendingItemsCount: unenteredItems,
          totalItemsCount: totalItems,
          dataChecksum: currentDataChecksum,
          forceRefresh: force,
        }),
      });

      const data = await res.json();

      if (data.success && data.source === 'gemini') {
        setAiAnalysisStatus('success');
        setAiSummaryText(data.summary);
        setAiModelName(data.model || 'Gemini 3.1 Flash Lite');
        setAiTimestamp(data.timestamp ? new Date(data.timestamp).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR'));
        setAiDataChecksum(currentDataChecksum);
      } else {
        // Fallback to rule-based analysis
        setAiAnalysisStatus('rule_based');
        setAiSummaryText(data.summary || '');
        setAiModelName(data.model || '규칙 기반 자동 분석 엔진');
        setAiNotice(data.message || 'Gemini API 호출 한도 초과 또는 미설정으로 규칙 기반 자동 분석으로 제공되었습니다.');
        setAiTimestamp(data.timestamp ? new Date(data.timestamp).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR'));
        setAiDataChecksum(currentDataChecksum);
      }
    } catch (err: any) {
      console.warn('Network error calling AI summary, falling back to local analysis:', err);
      let localSummary = `### 📋 규칙 기반 자동 분석 요약 (${currentRound.name})\n\n`;
      localSummary += `- **5개월 추정 입력분 합계**: **${enteredSum5M.toLocaleString()} 백만원** (${relevantMasterItems.length}개 항목 중 ${fullyEnteredItems}건 완료, ${unenteredItems}건 미입력)\n`;
      localSummary += `- **직전 대비 비교 차이**: **${formatDiffText(comparableDiff5M)}** *(동일 대상월·양쪽 입력 완료 ${comparableCount}건 기준)*\n\n`;
      if (topVariances.length > 0) {
        localSummary += `#### 🔍 주요 변동 항목 (TOP 5)\n`;
        topVariances.slice(0, 5).forEach((v, idx) => {
          localSummary += `${idx + 1}. **[${v.dept}] ${v.glName} (${v.subItem})**: ${formatDiffText(v.diffTotal)} (사유: ${v.reason || '사유 미기재'})\n`;
        });
      }
      setAiAnalysisStatus('rule_based');
      setAiSummaryText(localSummary);
      setAiModelName('규칙 기반 자동 분석 엔진 (로컬)');
      setAiNotice('서버 네트워크 지연으로 로컬 규칙 기반 자동 분석 결과가 즉시 생성되었습니다.');
      setAiTimestamp(new Date().toLocaleString('ko-KR'));
      setAiDataChecksum(currentDataChecksum);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all mb-6">
      {/* 1. Header Bar: Explicitly titled '추정 현황 및 주요 변동 요약 (자동 집계)' */}
      <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-[#0F2D59]/10 text-[#0F2D59] shadow-2xs mt-0.5">
            <TrendingUp className="w-5 h-5 text-[#0F2D59]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {isOperator
                  ? '추정 현황 및 주요 변동 요약 (전사 종합)'
                  : `추정 현황 및 주요 변동 요약 [${currentUser.department}]`}
              </h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                자동 집계 데이터
              </span>
              {currentRound && (
                <span className="text-xs text-slate-600 font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                  {currentRound.name} 기준
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              미입력 항목은 0으로 취급하지 않으며, 동일 대상 월에 직전/금번 수치가 모두 입력 완료된 항목만을 기준으로 비교 산출합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end md:self-center">
          {onNavigateToAiChat && (
            <button
              onClick={onNavigateToAiChat}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0F2D59] hover:bg-[#0c2347] text-white shadow-xs transition-colors cursor-pointer"
              title="전체 데이터를 기반으로 AI와 질문하고 답변할 수 있는 화면으로 이동합니다"
            >
              <MessageSquareText className="w-3.5 h-3.5 mr-1.5" />
              <span>AI 질의응답 (Q&A)</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title={isExpanded ? '리포트 접기' : '리포트 펼치기'}
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 2. KPI Badges Strip (입력분 합계 / 직전 대비 차이 / 5개월 전체 입력 완료율) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/70 text-xs">
        <div className="p-4 text-center">
          <span className="text-slate-500 block text-xs mb-1 font-medium">
            5개월 추정 입력분 합계
          </span>
          <span className="text-base sm:text-lg font-bold font-mono text-slate-900 block">
            {enteredSum5M.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">백만원</span>
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            (미입력 항목 {unenteredItems}건 제외)
          </span>
        </div>

        <div className="p-4 text-center">
          <span className="text-slate-500 block text-xs mb-1 font-medium">
            직전 대비 차이
          </span>
          <span
            className={`text-base sm:text-lg font-bold font-mono block ${
              comparableDiff5M && comparableDiff5M > 0
                ? 'text-emerald-600'
                : comparableDiff5M && comparableDiff5M < 0
                ? 'text-rose-600'
                : 'text-slate-600'
            }`}
          >
            {formatDiffText(comparableDiff5M)}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            ※ 동일 월·양쪽 입력 완료 {comparableCount}개 월 기준
          </span>
        </div>

        <div className="p-4 text-center">
          <span className="text-slate-500 block text-xs mb-1 font-medium">
            5개월 전체 입력 완료율
          </span>
          <span className="text-base sm:text-lg font-bold font-mono text-slate-900 block">
            {fullyEnteredItems} / {totalItems}{' '}
            <span className="text-xs font-semibold text-emerald-600">
              ({totalItems > 0 ? Math.round((fullyEnteredItems / totalItems) * 100) : 0}%)
            </span>
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            (5개월 전월 입력 완료된 항목만 인정)
          </span>
        </div>
      </div>

      {/* 3. Main Report Body */}
      {isExpanded && (
        <div className="p-6 space-y-6 bg-white">
          {/* Top Variances Box */}
          <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded-md bg-amber-100 text-amber-700">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  직전 대비 주요 증감 항목 (양쪽 입력 완료 항목 기준 TOP 6)
                </h4>
              </div>
              <span className="text-xs text-slate-500 font-medium">상위 {topVariances.length}건</span>
            </div>

            {topVariances.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center bg-white rounded-lg border border-dashed border-slate-200">
                직전 회차와 동일 대상 월에 데이터가 모두 입력된 비교 가능 항목이 없거나 유의미한 변동이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {topVariances.map((item) => {
                  const isDiffPlus = (item.diffTotal || 0) > 0;
                  const isDiffMinus = (item.diffTotal || 0) < 0;
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            {isOperator && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                {item.dept}
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-900 truncate" title={`${item.glName} (${item.subItem})`}>
                              {item.glName} <span className="text-slate-500 font-normal">({item.subItem})</span>
                            </span>
                          </div>
                          <span
                            className={`font-mono font-bold text-xs shrink-0 ${
                              isDiffPlus ? 'text-emerald-600' : isDiffMinus ? 'text-rose-600' : 'text-slate-600'
                            }`}
                          >
                            {formatDiffText(item.diffTotal)}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                          <span className="text-slate-500 font-mono text-[11px]">
                            직전: {item.prevTotal !== null ? item.prevTotal.toLocaleString() : '-'} → 금번: {item.curTotal !== null ? item.curTotal.toLocaleString() : '-'} 백만원
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            담당: <b className="text-slate-800">{item.manager}</b>
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs">
                        {item.reason ? (
                          <div className="text-slate-700 bg-amber-50/70 p-2 rounded-lg border border-amber-200/60 text-[11px]" title={item.reason}>
                            <span className="font-semibold text-amber-900">사유:</span> {item.reason}
                          </div>
                        ) : (
                          <div className="text-rose-600 font-medium bg-rose-50/80 p-1.5 rounded-lg border border-rose-200/60 text-[11px] flex items-center gap-1">
                            <span>⚠️ 사유 미기재</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Separate Generative AI Analysis Section */}
          <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/50 p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3.5 mb-4 border-b border-slate-200 gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      생성형 AI 심층 분석 리포트
                    </h4>
                    {aiAnalysisStatus === 'success' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        {aiModelName}
                      </span>
                    )}
                    {aiAnalysisStatus === 'rule_based' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        규칙 기반 자동 분석
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    경영관리/CFO 관점에서 선행추정 데이터의 증감 원인과 주의 항목을 AI가 심층 분석합니다.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleGenerateAiAnalysis(true)}
                  disabled={aiAnalysisStatus === 'loading'}
                  className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-bold bg-[#0F2D59] hover:bg-[#183B6B] text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${aiAnalysisStatus === 'loading' ? 'animate-spin' : ''}`} />
                  {aiAnalysisStatus === 'idle'
                    ? 'AI 분석 생성'
                    : aiAnalysisStatus === 'loading'
                    ? 'AI 분석 생성 중...'
                    : '최신 데이터로 재분석'}
                </button>
              </div>
            </div>

            {/* Stale Warning Banner */}
            {isAiDataStale && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-800">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <b>데이터 변경 감지</b>: 분석 생성 이후 입력 수치가 변경되었습니다. 최신 수치를 반영하려면 [최신 데이터로 재분석]을 눌러주세요.
                  </span>
                </div>
              </div>
            )}

            {/* Notice if rule-based fallback */}
            {aiNotice && (
              <div className="mb-4 p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600">
                <b>안내</b>: {aiNotice}
              </div>
            )}

            {/* Analysis State Body */}
            {aiAnalysisStatus === 'idle' && (
              <div className="py-8 text-center text-xs text-slate-500 bg-white rounded-lg border border-dashed border-slate-200">
                <Sparkles className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-700 mb-1">
                  아직 생성된 AI 분석 리포트가 없습니다.
                </p>
                <p className="text-slate-400">
                  우측 상단의 <b>[AI 분석 생성]</b> 버튼을 누르면 전체 데이터를 종합 분석하여 경영 인사이트를 제공합니다.
                </p>
              </div>
            )}

            {aiAnalysisStatus === 'loading' && (
              <div className="py-12 text-center text-xs text-slate-600 bg-white rounded-lg border border-slate-200 space-y-3">
                <div className="w-8 h-8 mx-auto border-3 border-[#0F2D59] border-t-transparent rounded-full animate-spin" />
                <p className="font-bold text-slate-800">
                  선행추정 데이터 및 사유를 정밀 분석하고 있습니다...
                </p>
                <p className="text-slate-400 text-[11px]">
                  (최대 10~15초 소요될 수 있습니다)
                </p>
              </div>
            )}

            {(aiAnalysisStatus === 'success' || aiAnalysisStatus === 'rule_based') && (
              <div className="space-y-3">
                {/* Meta details bar */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-mono">
                  <span>기준 회차: <b className="text-slate-800">{currentRound?.name}</b></span>
                  <span>•</span>
                  <span>분석 범위: <b className="text-slate-800">{isOperator ? '전사 5개 부서 종합' : `${currentUser.department} 소관`}</b></span>
                  <span>•</span>
                  <span>분석 시각: <b className="text-slate-800">{aiTimestamp}</b></span>
                  <span>•</span>
                  <span>엔진: <b className="text-slate-800">{aiModelName}</b></span>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                  {aiSummaryText}
                </div>
              </div>
            )}

            {aiAnalysisStatus === 'error' && (
              <div className="py-6 text-center text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-200">
                <AlertCircle className="w-6 h-6 mx-auto mb-1 text-rose-500" />
                <p className="font-semibold mb-1">AI 분석 생성에 실패했습니다.</p>
                <p className="text-rose-500 mb-3">{aiNotice}</p>
                <button
                  type="button"
                  onClick={() => handleGenerateAiAnalysis(true)}
                  className="px-3 py-1.5 bg-rose-600 text-white font-semibold rounded-lg text-xs hover:bg-rose-700"
                >
                  재시도
                </button>
              </div>
            )}
          </div>

          {/* 5. AI Q&A Call-to-action Banner */}
          {onNavigateToAiChat && (
            <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-slate-50 via-blue-50/40 to-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="p-2 rounded-xl bg-white text-[#0F2D59] shadow-2xs border border-slate-200">
                  <MessageSquareText className="w-5 h-5 text-[#0F2D59]" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>전체 데이터 기반 대화형 AI 질의응답 (Q&A)</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0F2D59]/10 text-[#0F2D59] border border-[#0F2D59]/20">
                      상시 조회
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    특정 GL계정, 부서별 비교, 미기재 사유 등 데이터 전반에 대해 실시간으로 질문하고 상세 답변을 조회할 수 있습니다.
                  </p>
                </div>
              </div>

              <button
                onClick={onNavigateToAiChat}
                className="shrink-0 inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0F2D59] text-white hover:bg-[#0c2347] transition-colors shadow-xs cursor-pointer"
              >
                <span>AI에게 질문하기</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
