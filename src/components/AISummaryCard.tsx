import React, { useState, useMemo } from 'react';
import { Department, EntryData, MasterItem, Round, UserProfile } from '../types';
import {
  Sparkles,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  MessageSquareText,
  ArrowRight,
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
  prevTotal: number;
  curTotal: number;
  diffTotal: number;
  monthlyDiffs: number[];
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

  // Calculate variances and totals
  const {
    totalItems,
    enteredItems,
    totalCur5M,
    totalDiff5M,
    topVariances,
  } = useMemo(() => {
    let enteredCount = 0;
    let prevSum = 0;
    let curSum = 0;

    const varianceList: VarianceItem[] = [];

    relevantMasterItems.forEach((m) => {
      const entry = roundEntries.find((e) => e.masterId === m.id);
      const mKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];

      const hasAnyData =
        entry &&
        mKeys.some((k) => typeof entry[k] === 'number' && !isNaN(entry[k] as number));

      if (hasAnyData) {
        enteredCount++;
      }

      let itemCurTotal = 0;
      let itemPrevTotal = 0;
      const itemMonthlyDiffs: number[] = [];

      roundMonths.forEach((mNum, idx) => {
        const key = mKeys[idx];
        const rawCur = entry?.[key];
        const curVal = typeof rawCur === 'number' && !isNaN(rawCur) ? rawCur : 0;
        const prevVal = getPrevMonthValue(m.id, mNum) || 0;

        itemCurTotal += curVal;
        itemPrevTotal += prevVal;
        itemMonthlyDiffs.push(Number((prevVal - curVal).toFixed(1)));
      });

      prevSum += itemPrevTotal;
      curSum += itemCurTotal;

      // 차이금액 = 지난추정 - 금번추정 (+이면 개선, -이면 악화)
      const itemDiffTotal = Number((itemPrevTotal - itemCurTotal).toFixed(1));

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
      };

      if (Math.abs(itemDiffTotal) > 0) {
        varianceList.push(itemRecord);
      }
    });

    // Sort by absolute difference descending
    varianceList.sort((a, b) => Math.abs(b.diffTotal) - Math.abs(a.diffTotal));

    return {
      totalItems: relevantMasterItems.length,
      enteredItems: enteredCount,
      totalPrev5M: Number(prevSum.toFixed(1)),
      totalCur5M: Number(curSum.toFixed(1)),
      totalDiff5M: Number((prevSum - curSum).toFixed(1)),
      topVariances: varianceList.slice(0, 6),
    };
  }, [relevantMasterItems, roundEntries, roundMonths, getPrevMonthValue]);

  // Format difference: +이면 '(개선)', -이면 '(악화)'
  const formatDiffText = (diff: number) => {
    if (diff > 0) {
      return `+${diff.toLocaleString()} 백만원(개선)`;
    } else if (diff < 0) {
      return `${diff.toLocaleString()} 백만원(악화)`;
    } else {
      return `0 백만원`;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all mb-6">
      {/* Header Bar */}
      <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-[#0F2D59]/10 text-[#0F2D59] shadow-2xs mt-0.5">
            <Sparkles className="w-5 h-5 text-[#0F2D59]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {isOperator
                  ? 'AI 전사 제조고정비 선행추정 분석 및 요약 리포트'
                  : `AI [${currentUser.department}] 5개월 선행추정 분석 및 요약 리포트`}
              </h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F2D59]/10 text-[#0F2D59] border border-[#0F2D59]/20">
                선행추정 분석
              </span>
              {currentRound && (
                <span className="text-xs text-slate-600 font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                  {currentRound.name} 기준
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isOperator
                ? '전체 5개 부서의 선행추정 데이터를 분석하여 직전 대비 증감 내역과 핵심 변동 항목을 요약합니다.'
                : `${currentUser.department} 소관 비용 항목의 직전 대비 증감 내역과 주요 변동 항목을 요약합니다.`}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end md:self-center">
          {onNavigateToAiChat && (
            <button
              onClick={onNavigateToAiChat}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0F2D59] hover:bg-[#0c2347] text-white shadow-xs transition-colors cursor-pointer"
              title="입력 데이터를 기반으로 AI와 질문하고 답변할 수 있는 화면으로 이동합니다"
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

      {/* KPI Quick Badges Strip (3 Items: 5개월 추정 총액 / 직전 대비 차이 / 진척 현황) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/70 text-xs">
        <div className="p-4 text-center">
          <span className="text-slate-500 block text-xs mb-1 font-medium">5개월 추정 총액</span>
          <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
            {totalCur5M.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">백만원</span>
          </span>
        </div>
        <div className="p-4 text-center">
          <span className="text-slate-500 block text-xs mb-1 font-medium">직전 대비 차이</span>
          <span
            className={`text-base sm:text-lg font-bold font-mono ${
              totalDiff5M > 0 ? 'text-emerald-600' : totalDiff5M < 0 ? 'text-rose-600' : 'text-slate-600'
            }`}
          >
            {formatDiffText(totalDiff5M)}
          </span>
        </div>
        <div className="p-4 text-center">
          <span className="text-slate-500 block text-xs mb-1 font-medium">진척 현황</span>
          <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
            {enteredItems} / {totalItems}{' '}
            <span className="text-xs font-semibold text-emerald-600">
              ({totalItems > 0 ? Math.round((enteredItems / totalItems) * 100) : 0}%)
            </span>
          </span>
        </div>
      </div>

      {/* Main Report Body */}
      {isExpanded && (
        <div className="p-6 space-y-5 bg-white">
          {/* Large Variances Box (Full Width) */}
          <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded-md bg-amber-100 text-amber-700">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  직전 대비 증감 내역이 큰 주요 항목 (Top Variances)
                </h4>
              </div>
              <span className="text-xs text-slate-500 font-medium">상위 {topVariances.length}건</span>
            </div>

            {topVariances.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center bg-white rounded-lg border border-dashed border-slate-200">
                직전 회차 대비 유의미한 변동 금액이 발견되지 않았습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {topVariances.map((item) => {
                  const isDiffPlus = item.diffTotal > 0;
                  const isDiffMinus = item.diffTotal < 0;
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
                            직전: {item.prevTotal.toLocaleString()} → 금번: {item.curTotal.toLocaleString()} 백만원
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

          {/* AI Q&A Call-to-action Banner */}
          {onNavigateToAiChat && (
            <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-slate-50 via-blue-50/40 to-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="p-2 rounded-xl bg-white text-[#0F2D59] shadow-2xs border border-slate-200">
                  <MessageSquareText className="w-5 h-5 text-[#0F2D59]" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>입력 데이터 기반 AI 질의응답 (Q&A)</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0F2D59]/10 text-[#0F2D59] border border-[#0F2D59]/20">
                      신규 추가
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    입력된 선행추정 금액, 부서별 증감률, 사유 누락 현황 등 궁금한 점을 AI에게 자유롭게 질문해 보세요.
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
