import React, { useState, useEffect, useMemo } from 'react';
import { Department, EntryData, MasterItem, Round, UserProfile } from '../types';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
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
}

interface VarianceItem {
  id: string;
  dept: Department;
  manager: string;
  glCode: string;
  glName: string;
  subItem: string;
  attribution: string;
  prevTotal: number;
  curTotal: number;
  diffTotal: number;
  monthlyDiffs: number[];
  reason: string;
  hasMissingReason: boolean;
  hasSpike: boolean;
}

export const AISummaryCard: React.FC<AISummaryCardProps> = ({
  currentUser,
  currentRound,
  prevRound,
  roundMonths,
  masterItems,
  entries,
  getPrevMonthValue,
}) => {
  const isOperator = currentUser.role === 'operator';
  const targetDept = isOperator ? '전사' : currentUser.department;

  const [aiReport, setAiReport] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string>('');
  const [aiSource, setAiSource] = useState<'gemini' | 'engine'>('engine');
  const [aiModelName, setAiModelName] = useState<string>('Gemini AI');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Filter master items according to user role
  const relevantMasterItems = useMemo(() => {
    if (isOperator) {
      return masterItems;
    }
    return masterItems.filter((m) => m.dept === currentUser.department);
  }, [masterItems, isOperator, currentUser.department]);

  // Round entries for selected round
  const roundEntries = useMemo(() => {
    if (!currentRound) return [];
    return entries.filter((e) => e.roundId === currentRound.id);
  }, [entries, currentRound]);

  // Compute variance and audit items
  const {
    totalItems,
    enteredItems,
    pendingItems,
    totalPrev5M,
    totalCur5M,
    totalDiff5M,
    monthlyTotals,
    topVariances,
    attentionItems,
  } = useMemo(() => {
    let prevSum = 0;
    let curSum = 0;
    const mKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const curMonthly = [0, 0, 0, 0, 0];
    const prevMonthly = [0, 0, 0, 0, 0];
    const diffMonthly = [0, 0, 0, 0, 0];

    let enteredCount = 0;
    const varianceList: VarianceItem[] = [];
    const needAttentionList: VarianceItem[] = [];

    relevantMasterItems.forEach((m) => {
      const entry = roundEntries.find((e) => e.masterId === m.id);
      const hasAnyData =
        entry &&
        (typeof entry.m1 === 'number' ||
          typeof entry.m2 === 'number' ||
          typeof entry.m3 === 'number' ||
          typeof entry.m4 === 'number' ||
          typeof entry.m5 === 'number');

      if (hasAnyData) enteredCount++;

      let itemCurTotal = 0;
      let itemPrevTotal = 0;
      const itemMonthlyDiffs: number[] = [];

      roundMonths.forEach((mNum, idx) => {
        const k = mKeys[idx];
        const curVal = entry && typeof entry[k] === 'number' && !isNaN(entry[k] as number) ? (entry[k] as number) : 0;
        const prevVal = getPrevMonthValue(m.id, mNum) || 0;

        curMonthly[idx] += curVal;
        prevMonthly[idx] += prevVal;
        diffMonthly[idx] += prevVal - curVal;

        itemCurTotal += curVal;
        itemPrevTotal += prevVal;
        itemMonthlyDiffs.push(Number((prevVal - curVal).toFixed(1)));
      });

      prevSum += itemPrevTotal;
      curSum += itemCurTotal;

      const itemDiffTotal = Number((itemPrevTotal - itemCurTotal).toFixed(1));
      const hasMissingReason = Math.abs(itemDiffTotal) >= 5 && (!entry?.reason || entry.reason.trim() === '');

      // Check for single month spike (variance > 10 in any single month)
      const hasSpike = itemMonthlyDiffs.some((d) => Math.abs(d) >= 10);

      const itemRecord: VarianceItem = {
        id: m.id,
        dept: m.dept,
        manager: m.manager,
        glCode: m.glCode,
        glName: m.glName,
        subItem: m.subItem,
        attribution: m.attribution,
        prevTotal: Number(itemPrevTotal.toFixed(1)),
        curTotal: Number(itemCurTotal.toFixed(1)),
        diffTotal: itemDiffTotal,
        monthlyDiffs: itemMonthlyDiffs,
        reason: entry?.reason || '',
        hasMissingReason,
        hasSpike,
      };

      if (Math.abs(itemDiffTotal) > 0 || hasMissingReason || hasSpike) {
        varianceList.push(itemRecord);
      }

      if (hasMissingReason || hasSpike || !hasAnyData) {
        needAttentionList.push(itemRecord);
      }
    });

    // Sort by absolute difference descending
    varianceList.sort((a, b) => Math.abs(b.diffTotal) - Math.abs(a.diffTotal));

    return {
      totalItems: relevantMasterItems.length,
      enteredItems: enteredCount,
      pendingItems: relevantMasterItems.length - enteredCount,
      totalPrev5M: Number(prevSum.toFixed(1)),
      totalCur5M: Number(curSum.toFixed(1)),
      totalDiff5M: Number((prevSum - curSum).toFixed(1)),
      monthlyTotals: {
        cur: curMonthly.map((v) => Number(v.toFixed(1))),
        prev: prevMonthly.map((v) => Number(v.toFixed(1))),
        diff: diffMonthly.map((v) => Number(v.toFixed(1))),
      },
      topVariances: varianceList.slice(0, 5),
      attentionItems: needAttentionList.slice(0, 6),
    };
  }, [relevantMasterItems, roundEntries, roundMonths, getPrevMonthValue]);

  // Generate fallback structured analysis
  const fallbackAnalysis = useMemo(() => {
    if (!currentRound) return '';

    const roundName = currentRound.name;
    const prevName = prevRound ? prevRound.name : '직전 회차';
    const varianceDirection = totalDiff5M > 0 ? '감소(절감)' : totalDiff5M < 0 ? '증가(증액)' : '동일';
    const absDiff = Math.abs(totalDiff5M).toLocaleString();

    let text = `### 💡 ${targetDept} 선행추정 총괄 분석 요약 (${roundName})\n`;
    text += `- **5개월 추정 총액**: **${totalCur5M.toLocaleString()} 백만원** (직전 ${prevName} 대비 **${absDiff} 백만원 ${varianceDirection}**)\n`;
    text += `- **진척률**: 대상 항목 총 ${totalItems}건 중 **${enteredItems}건 완료** (${totalItems > 0 ? Math.round((enteredItems / totalItems) * 100) : 0}% 입력 완료, 미입력 ${pendingItems}건)\n\n`;

    text += `### ⚠️ 주요 증감 항목 분석 (상위 변동)\n`;
    if (topVariances.length === 0) {
      text += `- 직전 회차 대비 유의미한 변동 금액이 발견되지 않았습니다.\n\n`;
    } else {
      topVariances.forEach((item, i) => {
        const sign = item.diffTotal > 0 ? `+${item.diffTotal}` : `${item.diffTotal}`;
        const dir = item.diffTotal > 0 ? '절감(-)' : '증액(+)';
        text += `${i + 1}. **[${item.dept}] ${item.glName} (${item.subItem} / ${item.manager})**\n`;
        text += `   - 직전: ${item.prevTotal.toLocaleString()}백만원 → 금번: ${item.curTotal.toLocaleString()}백만원 (차이: **${sign}백만원**, ${dir})\n`;
        text += `   - 사유: ${item.reason ? `"${item.reason}"` : '⚠️ **사유 미기재** (확인 필요)'}\n`;
      });
      text += `\n`;
    }

    text += `### 🔍 추가 점검이 필요한 요소\n`;
    const missingReasons = topVariances.filter((v) => v.hasMissingReason);
    if (missingReasons.length > 0) {
      text += `- 🚨 **사유 미입력 고액 변동건**: ${missingReasons.map((m) => `[${m.glName}/${m.subItem}]`).join(', ')} 항목은 변동 폭이 크나 상세 사유가 누락되어 있어 보완 입력이 시급합니다.\n`;
    }
    if (pendingItems > 0) {
      text += `- ⏳ **미입력 항목**: 총 ${pendingItems}개 항목의 추정치가 아직 등록되지 않았습니다. 회차 마감 전 담당자 입력 독려가 필요합니다.\n`;
    }
    const spikeItems = topVariances.filter((v) => v.hasSpike);
    if (spikeItems.length > 0) {
      text += `- 📈 **특정 월 급변(Spike) 항목**: ${spikeItems.map((s) => `[${s.subItem}]`).join(', ')} 항목의 특정 월 추정치가 급변하여 월별 편차 원인 파악이 권장됩니다.\n`;
    }
    if (missingReasons.length === 0 && pendingItems === 0 && spikeItems.length === 0) {
      text += `- 현재 모든 대상 항목의 입력이 완료되었으며, 주요 변동 항목에 타당한 사유가 기재되어 있어 안정적입니다.\n`;
    }

    text += `\n### 📋 조치 및 관리 권고사항\n`;
    if (isOperator) {
      text += `- **총괄 운영자 권고**: 변동 규모가 큰 부서 담당자에게 세부 증빙 및 사유 보완을 요청하고, 미입력 부서(${pendingItems > 0 ? '미작성 부서 존재' : '전원 완료'})에 대한 마감 통제를 진행해 주십시오.\n`;
    } else {
      text += `- **${currentUser.department} 담당자 권고**: 변동 항목의 기재 사유가 명확한지 재확인하시고, 경영계획 및 실적 추세와 정합성을 최종 검토한 후 마감 승인을 요청하시기 바랍니다.\n`;
    }

    return text;
  }, [currentRound, prevRound, totalCur5M, totalDiff5M, totalItems, enteredItems, pendingItems, targetDept, topVariances, isOperator, currentUser.department]);

  // Function to call AI API
  const fetchAISummary = async (forceRefresh = false) => {
    if (!currentRound) return;
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: currentUser.role,
          department: currentUser.department,
          currentRoundName: currentRound.name,
          prevRoundName: prevRound ? prevRound.name : '',
          roundMonths,
          forceRefresh,
          summaryData: {
            scope: targetDept,
            totalItems,
            enteredItems,
            pendingItems,
            totalCur5M,
            totalPrev5M,
            totalDiff5M,
            monthlyTotals,
          },
          topVariances: topVariances.map((v) => ({
            dept: v.dept,
            glCode: v.glCode,
            glName: v.glName,
            subItem: v.subItem,
            manager: v.manager,
            prevTotal: v.prevTotal,
            curTotal: v.curTotal,
            diffTotal: v.diffTotal,
            reason: v.reason || '사유 미기재',
            hasMissingReason: v.hasMissingReason,
          })),
          pendingItemsCount: pendingItems,
          totalItemsCount: totalItems,
        }),
      });

      const data = await res.json();
      if (data.success && data.summary) {
        setAiReport(data.summary);
        setAiSource('gemini');
        if (data.model) {
          setAiModelName(data.model.includes('flash-lite') ? 'Gemini 3.1 Flash Lite AI' : 'Gemini AI');
        }
        setLastAnalyzedAt(new Date().toLocaleTimeString('ko-KR'));
      } else {
        // Fallback to local intelligence
        setAiReport(fallbackAnalysis);
        setAiSource('engine');
        setLastAnalyzedAt(new Date().toLocaleTimeString('ko-KR'));
      }
    } catch (err) {
      console.warn('AI summary API call failed, using rule engine summary:', err);
      setAiReport(fallbackAnalysis);
      setAiSource('engine');
      setLastAnalyzedAt(new Date().toLocaleTimeString('ko-KR'));
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch / update on round change
  useEffect(() => {
    fetchAISummary(false);
  }, [currentRound?.id, currentUser.role, currentUser.department]);

  const activeContent = aiReport || fallbackAnalysis;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-[#0F2D59] to-slate-900 rounded-2xl shadow-md border border-blue-900/40 text-white overflow-hidden transition-all mb-6">
      {/* Header Bar */}
      <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 shadow-sm mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {isOperator
                  ? 'AI 전사 제조고정비 선행추정 종합 분석 리포트'
                  : `AI [${currentUser.department}] 5개월 선행추정 분석 및 요약 리포트`}
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                {aiSource === 'gemini' ? aiModelName : '지능형 분석 엔진'}
              </span>
              {currentRound && (
                <span className="text-xs text-slate-300 font-mono bg-white/10 px-2 py-0.5 rounded">
                  {currentRound.name} 기준
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {isOperator
                ? '전체 5개 부서의 선행추정 데이터를 통합 분석하여 대형 증감 항목과 추가 점검 요소를 도출합니다.'
                : `${currentUser.department} 소관 비용 항목의 직전 대비 증감 내역과 마감 전 필수 점검 사항을 요약합니다.`}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end md:self-center">
          {lastAnalyzedAt && (
            <span className="text-[11px] text-slate-300 font-mono hidden sm:inline-flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
              {lastAnalyzedAt} 분석
            </span>
          )}
          <button
            onClick={() => fetchAISummary(true)}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 active:bg-white/30 text-white border border-white/20 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            title="AI 심층 분석을 새로고침합니다"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? '분석 생성 중...' : 'AI 분석 새로고침'}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isExpanded ? '리포트 접기' : '리포트 펼치기'}
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* KPI Quick Badges Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/10 border-b border-white/10 bg-black/20 text-xs">
        <div className="p-3.5 text-center">
          <span className="text-slate-400 block text-[11px] mb-0.5">5개월 추정 총액</span>
          <span className="text-sm sm:text-base font-bold font-mono text-white">
            {totalCur5M.toLocaleString()}{' '}
            <span className="text-[10px] font-normal text-slate-400">백만원</span>
          </span>
        </div>
        <div className="p-3.5 text-center">
          <span className="text-slate-400 block text-[11px] mb-0.5">직전 대비 차이</span>
          <span
            className={`text-sm sm:text-base font-bold font-mono ${
              totalDiff5M > 0 ? 'text-rose-400' : totalDiff5M < 0 ? 'text-cyan-400' : 'text-slate-300'
            }`}
          >
            {totalDiff5M > 0 ? `+${totalDiff5M.toLocaleString()}` : totalDiff5M.toLocaleString()}{' '}
            <span className="text-[10px] font-normal text-slate-400">백만원</span>
          </span>
        </div>
        <div className="p-3.5 text-center">
          <span className="text-slate-400 block text-[11px] mb-0.5">진척 현황</span>
          <span className="text-sm sm:text-base font-bold font-mono text-emerald-400">
            {enteredItems} / {totalItems}{' '}
            <span className="text-[10px] font-normal text-slate-400">
              ({totalItems > 0 ? Math.round((enteredItems / totalItems) * 100) : 0}%)
            </span>
          </span>
        </div>
        <div className="p-3.5 text-center">
          <span className="text-slate-400 block text-[11px] mb-0.5">점검 필요 항목</span>
          <span
            className={`text-sm sm:text-base font-bold font-mono ${
              attentionItems.length > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {attentionItems.length}{' '}
            <span className="text-[10px] font-normal text-slate-400">건</span>
          </span>
        </div>
      </div>

      {/* Main Report Body */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Top Variances & Attention Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. Large Variances Box */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 backdrop-blur-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold text-slate-200">
                    증감 내역이 큰 주요 항목 (Top Variances)
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">상위 {topVariances.length}건</span>
              </div>

              {topVariances.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  직전 회차 대비 큰 변동 항목이 없습니다.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {topVariances.map((item) => {
                    const isDiffPlus = item.diffTotal > 0;
                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-black/25 border border-white/5 hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            {isOperator && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-slate-300">
                                {item.dept}
                              </span>
                            )}
                            <span className="text-xs font-bold text-white truncate">
                              {item.glName} ({item.subItem})
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              담당: {item.manager}
                            </span>
                          </div>
                          <span
                            className={`font-mono font-bold text-xs shrink-0 ${
                              isDiffPlus ? 'text-rose-400' : 'text-cyan-400'
                            }`}
                          >
                            {isDiffPlus ? `+${item.diffTotal.toLocaleString()}` : item.diffTotal.toLocaleString()} 백만원
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between text-[11px] text-slate-300">
                          <span className="text-slate-400">
                            직전: {item.prevTotal.toLocaleString()} → 금번: {item.curTotal.toLocaleString()}
                          </span>
                          {item.reason ? (
                            <span className="text-amber-200/90 truncate max-w-[60%] text-right font-light" title={item.reason}>
                              사유: {item.reason}
                            </span>
                          ) : (
                            <span className="text-rose-400 font-medium">⚠️ 사유 미기재</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Items Needing Attention / Audit Box */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 backdrop-blur-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <h4 className="text-xs font-bold text-slate-200">
                    추가적인 점검이 필요한 요소 (Risk & Audit Check)
                  </h4>
                </div>
                <span className="text-[11px] text-amber-300 font-semibold">
                  {attentionItems.length}건 감지
                </span>
              </div>

              {attentionItems.length === 0 ? (
                <div className="py-4 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1 opacity-80" />
                  <p className="text-xs text-emerald-300 font-medium">
                    추가적인 점검 요소가 없습니다. 모든 항목이 안정적입니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {attentionItems.map((item) => (
                    <div
                      key={`att-${item.id}`}
                      className="p-2.5 rounded-lg bg-black/25 border border-rose-500/20 hover:border-rose-400/40 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-rose-200 truncate">
                          [{item.dept}] {item.glName} ({item.subItem})
                        </span>
                        <div className="flex items-center space-x-1 shrink-0">
                          {item.hasMissingReason && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              사유누락
                            </span>
                          )}
                          {item.hasSpike && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              월별급변
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        담당: <span className="text-white font-medium">{item.manager}</span> | 차이금액:{' '}
                        <span className="font-mono text-white">{item.diffTotal.toLocaleString()}백만원</span>
                        {item.hasMissingReason && (
                          <span className="text-rose-300 ml-1.5 block sm:inline">
                            → 변동폭 대비 상세 소명 사유 입력이 필요합니다.
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI Comprehensive Analysis Narrative */}
          <div className="bg-black/30 rounded-xl p-5 border border-white/10 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
              <FileText className="w-4 h-4" />
              <span>AI 종합 분석 및 실무 제언</span>
            </div>

            <div className="text-xs leading-relaxed text-slate-200 space-y-2 font-sans whitespace-pre-line border-t border-white/10 pt-3">
              {activeContent}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
