import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI SDK
const apiKey = process.env.GEMINI_API_KEY || '';
let genAI: GoogleGenAI | null = null;
if (apiKey) {
  try {
    genAI = new GoogleGenAI();
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI with env API key:', err);
  }
}

// In-memory cache for AI summaries with data hash/checksum to invalidate upon data modification
interface CachedSummary {
  summary: string;
  model: string;
  timestamp: string;
  expiresAt: number;
}
const aiSummaryCache = new Map<string, CachedSummary>();

// 1. AI Summary Endpoint
app.post('/api/ai-summary', async (req: Request, res: Response) => {
  try {
    const {
      role,
      department,
      currentRoundName,
      prevRoundName,
      roundMonths,
      summaryData,
      topVariances,
      pendingItemsCount,
      totalItemsCount,
      dataChecksum,
      forceRefresh,
    } = req.body;

    const isOperator = role === 'operator';
    const targetDept = isOperator ? '전사 부서 종합' : `${department} 부서`;
    const cacheKey = `${role}-${department || 'all'}-${currentRoundName || 'default'}-${dataChecksum || 'v0'}`;

    // Check cache if not forcing refresh
    if (!forceRefresh && aiSummaryCache.has(cacheKey)) {
      const cached = aiSummaryCache.get(cacheKey)!;
      if (Date.now() < cached.expiresAt) {
        return res.status(200).json({
          success: true,
          source: 'gemini',
          model: cached.model,
          summary: cached.summary,
          timestamp: cached.timestamp,
          fromCache: true,
        });
      }
    }

    // Rule-based fallback summary generator
    const generateRuleBasedSummary = () => {
      let text = `### 📋 [규칙 기반 자동 분석] ${targetDept} 선행추정 요약 리포트\n\n`;
      text += `> **안내**: Gemini AI API 호출 한도(429) 초과 또는 미설정으로 인해 사내 규칙 기반 분석 엔진으로 즉시 생성된 결과입니다.\n\n`;
      text += `#### 1. 💡 총괄 요약\n`;
      text += `- **분석 대상 회차**: **${currentRoundName}** (직전: ${prevRoundName || '비교 회차 없음'})\n`;
      text += `- **5개월 추정 총액 (입력분)**: **${summaryData?.enteredSum?.toLocaleString() || 0} 백만원**\n`;
      text += `- **직전 대비 차이**: **${summaryData?.diffFormatted || '비교 불가'}** *(동일 월·양쪽 입력 완료 항목 기준)*\n`;
      text += `- **입력 완료 현황**: 총 ${totalItemsCount}개 항목 중 ${totalItemsCount - (pendingItemsCount || 0)}건 완료 (미입력: ${pendingItemsCount || 0}건)\n\n`;

      text += `#### 2. ⚠️ 주요 증감 항목 (TOP 변동)\n`;
      if (topVariances && topVariances.length > 0) {
        topVariances.slice(0, 5).forEach((item: any, i: number) => {
          text += `${i + 1}. **[${item.dept}] ${item.glName} (${item.subItem})**\n`;
          text += `   - 변동: 직전 ${item.prevTotal?.toLocaleString() || 0}백만원 → 금번 ${item.curTotal?.toLocaleString() || 0}백만원 (차이: **${item.diffFormatted}**)\n`;
          text += `   - 사유: ${item.reason ? `"${item.reason}"` : '⚠️ 사유 미기재'}\n`;
        });
      } else {
        text += `- 직전 대비 유의미한 변동 항목이 없거나 비교 가능한 데이터가 부족합니다.\n`;
      }
      return text;
    };

    if (!genAI || !apiKey) {
      return res.status(200).json({
        success: false,
        source: 'rule_based',
        message: 'Gemini API 키가 설정되지 않아 규칙 기반 자동 분석으로 제공됩니다.',
        summary: generateRuleBasedSummary(),
        timestamp: new Date().toISOString(),
      });
    }

    const prompt = `
당신은 대한민국 최고 수준의 화학/소재 제조기업(LX MMA)의 최고재무책임자(CFO) 산하 경영관리팀 제조고정비 전문 수석 분석가입니다.
제공된 [제조고정비 5개월 선행추정 데이터]를 정밀 분석하여, 사용자(${isOperator ? '총괄 운영자 / 경영진' : `${department} 담당자`})에게 명확한 리포트를 한국어로 작성하세요.

[분석 개요]
- 분석 대상: ${targetDept}
- 금번 회차: ${currentRoundName}
- 직전 회차: ${prevRoundName || '직전 회차 없음'}
- 대상 5개월: ${Array.isArray(roundMonths) ? roundMonths.join('월, ') + '월' : '5개월'}
- 총 항목 수: ${totalItemsCount}건 (미입력 항목: ${pendingItemsCount}건)

[비즈니스 부호 체계]
- 차이금액 = 직전 추정값 - 금번 추정값
- 차이 부호:
  * 양수(+)이면 비용 절감(호전)이므로 백만원 뒤에 '(개선)' 표기
  * 음수(-)이면 비용 증가(악화)이므로 백만원 뒤에 '(악화)' 표기
  * 미입력 데이터는 0이 아니며 절감으로 취급하지 않습니다.

[집계 요약 데이터]
${JSON.stringify(summaryData, null, 2)}

[상위 주요 증감 항목]
${JSON.stringify(topVariances, null, 2)}

[작성 가이드라인]
1. 💡 **총괄 요약 및 추세 분석**:
   - 5개월 전체 제조고정비 추정 입력분 총액과 직전 회차 대비 증감 총액 요약 (동일 월·양쪽 입력 완료 항목 기준)
   - 월별 변동 추세의 특징
2. ⚠️ **주요 증감 항목 심층 분석**:
   - 변동폭이 큰 주요 GL계정/세목의 구체적 증감 내역과 사유 평가
   - 사유 미기재 항목에 대한 보완 요구

전문적이고 신뢰감 있는 비즈니스 어조로 마크다운 형식으로 작성해주세요.
`;

    // Candidate models: prioritize flash-lite to avoid 429 quota exhaustion
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let aiText = '';
    let selectedModel = '';

    for (const model of candidateModels) {
      try {
        const geminiPromise = genAI.models.generateContent({
          model,
          contents: prompt,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI 분석 응답 시간 초과 (15s)')), 15000)
        );

        const response: any = await Promise.race([geminiPromise, timeoutPromise]);
        if (response && response.text) {
          aiText = response.text;
          selectedModel = model === 'gemini-3.1-flash-lite' ? 'Gemini 3.1 Flash Lite' : 'Gemini 3.8 Flash';
          break;
        }
      } catch (err: any) {
        console.warn(`[AI Summary] Model ${model} unavailable or quota exceeded: ${err?.message || err}`);
      }
    }

    const now = new Date().toISOString();

    if (aiText) {
      aiSummaryCache.set(cacheKey, {
        summary: aiText,
        model: selectedModel,
        timestamp: now,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      return res.status(200).json({
        success: true,
        source: 'gemini',
        model: selectedModel,
        summary: aiText,
        timestamp: now,
      });
    }

    // Graceful fallback to rule-based analysis if AI quota is exhausted or API error
    return res.status(200).json({
      success: false,
      source: 'rule_based',
      model: '규칙 기반 자동 분석 엔진',
      message: 'Gemini AI 호출 한도 초과(429) 또는 네트워크 지연으로 규칙 기반 자동 분석 결과가 적용되었습니다.',
      summary: generateRuleBasedSummary(),
      timestamp: now,
    });
  } catch (error: any) {
    console.warn('[AI Summary] Unexpected failure, falling back to local engine:', error?.message || error);
    return res.status(200).json({
      success: false,
      source: 'rule_based',
      model: '규칙 기반 자동 분석 엔진',
      message: '분석 처리 중 일시적인 오류로 규칙 기반 자동 분석 결과가 적용되었습니다.',
      summary: '### 📋 규칙 기반 자동 분석 요약\n\n일시적인 네트워크 지연으로 AI 생성 리포트를 불러오지 못했습니다. 잠시 후 [AI 재분석]을 눌러주세요.',
      timestamp: new Date().toISOString(),
    });
  }
});

// Local Intelligence Answering Engine for Fixed Cost Q&A across ALL items
function generateLocalChatAnswer(
  question: string,
  itemsData: any[] = [],
  roundName = '',
  prevRoundName = ''
): string {
  const q = question.toLowerCase();

  // Distinguish entered vs unentered
  const enteredItems = itemsData.filter((it) => it.isEntered);
  const unenteredCount = itemsData.length - enteredItems.length;

  const totalCur = enteredItems.reduce((s, it) => s + (it.curTotal || 0), 0);

  // Compare only items where both cur and prev exist
  const comparableItems = itemsData.filter((it) => it.isComparable);
  const totalPrevComparable = comparableItems.reduce((s, it) => s + (it.prevTotal || 0), 0);
  const totalCurComparable = comparableItems.reduce((s, it) => s + (it.curTotal || 0), 0);
  const totalDiff = Number((totalPrevComparable - totalCurComparable).toFixed(1));
  const diffSign = totalDiff > 0 ? `+${totalDiff.toLocaleString()} 백만원(개선)` : totalDiff < 0 ? `${totalDiff.toLocaleString()} 백만원(악화)` : `0 백만원`;

  const sortedByAbsDiff = [...comparableItems].sort((a, b) => Math.abs(b.diffTotal || 0) - Math.abs(a.diffTotal || 0));
  const improvedItems = comparableItems.filter((it) => (it.diffTotal || 0) > 0).sort((a, b) => b.diffTotal - a.diffTotal);
  const worsenedItems = comparableItems.filter((it) => (it.diffTotal || 0) < 0).sort((a, b) => a.diffTotal - b.diffTotal);
  const missingReasonItems = comparableItems.filter((it) => Math.abs(it.diffTotal || 0) >= 3 && (!it.reason || it.reason.trim() === ''));

  if (q.includes('top') || q.includes('증감') || q.includes('가장 큰') || q.includes('변동')) {
    const top5 = sortedByAbsDiff.slice(0, 5);
    let md = `### 📊 ${roundName || '금번 회차'} 직전 대비 주요 증감 항목 (TOP 5)\n\n`;
    md += `직전 회차(${prevRoundName || '직전'}) 대비 변동폭이 가장 큰 상위 항목 분석 결과입니다 (동일 대상월·양쪽 입력 완료 기준):\n\n`;
    if (top5.length === 0) {
      md += `- 비교 가능한 변동 항목이 없습니다.\n`;
    } else {
      top5.forEach((item, idx) => {
        const diffFormatted = item.diffTotal > 0 ? `+${item.diffTotal} 백만원(개선)` : item.diffTotal < 0 ? `${item.diffTotal} 백만원(악화)` : `0 백만원`;
        md += `${idx + 1}. **[${item.dept}] ${item.glName} (${item.subItem})**\n`;
        md += `   - **담당자**: ${item.manager} | **귀속**: ${item.attribution}\n`;
        md += `   - **금액 변동**: 직전 ${item.prevTotal?.toLocaleString() || 0}백만원 → 금번 ${item.curTotal?.toLocaleString() || 0}백만원 (차이: **${diffFormatted}**)\n`;
        md += `   - **기재 사유**: ${item.reason ? `"${item.reason}"` : '⚠️ **사유 미기재** (보완 필요)'}\n\n`;
      });
    }
    return md;
  }

  if (q.includes('사유') || q.includes('누락') || q.includes('미기재') || q.includes('점검')) {
    let md = `### 🔍 차이사유 입력 점검 현황 (${roundName || '금번 회차'})\n\n`;
    if (missingReasonItems.length === 0) {
      md += `✅ **특이사항 없음**: 변동금액(절대값 3백만원 이상)이 발생한 모든 비교 항목에 대해 정상적으로 차이사유가 기재되어 있습니다.\n\n`;
    } else {
      md += `⚠️ **사유 미기재 고액 변동 항목 (${missingReasonItems.length}건)**:\n`;
      md += `회차 마감 전 아래 항목의 소명 사유 보완이 필요합니다:\n\n`;
      missingReasonItems.forEach((item, idx) => {
        const diffFormatted = item.diffTotal > 0 ? `+${item.diffTotal} 백만원(개선)` : `${item.diffTotal} 백만원(악화)`;
        md += `${idx + 1}. **[${item.dept}] ${item.glName} (${item.subItem})**\n`;
        md += `   - 담당자: **${item.manager}** | 차이: **${diffFormatted}**\n`;
        md += `   - 조치 필요: 상세 사유 미입력 상태\n\n`;
      });
    }
    return md;
  }

  if (q.includes('개선') || q.includes('악화') || q.includes('절감') || q.includes('증액')) {
    let md = `### 📈 직전 대비 개선(+) 및 악화(-) 항목 분석 (${roundName})\n\n`;
    md += `*(주의: 미입력 항목은 비용 절감으로 산정하지 않으며, 양쪽 입력 완료 항목만을 기준으로 비교합니다)*\n\n`;
    md += `#### 🟢 상위 개선(비용 절감) 항목 (TOP 3)\n`;
    if (improvedItems.length === 0) {
      md += `- 개선된 항목이 없습니다.\n`;
    } else {
      improvedItems.slice(0, 3).forEach((item, i) => {
        md += `${i + 1}. **[${item.dept}] ${item.glName} (${item.subItem})**: +${item.diffTotal} 백만원(개선) (사유: ${item.reason || '미기재'})\n`;
      });
    }

    md += `\n#### 🔴 상위 악화(비용 증가) 항목 (TOP 3)\n`;
    if (worsenedItems.length === 0) {
      md += `- 악화된 항목이 없습니다.\n`;
    } else {
      worsenedItems.slice(0, 3).forEach((item, i) => {
        md += `${i + 1}. **[${item.dept}] ${item.glName} (${item.subItem})**: ${item.diffTotal} 백만원(악화) (사유: ${item.reason || '미기재'})\n`;
      });
    }
    return md;
  }

  if (q.includes('부서') || q.includes('총액') || q.includes('요약') || q.includes('브리핑')) {
    // Dept breakdown
    const deptMap = new Map<string, { total: number; entered: number; cur: number; prevComp: number; curComp: number }>();
    itemsData.forEach((it) => {
      const d = it.dept || '기타';
      const cur = deptMap.get(d) || { total: 0, entered: 0, cur: 0, prevComp: 0, curComp: 0 };
      cur.total++;
      if (it.isEntered) {
        cur.entered++;
        cur.cur += it.curTotal || 0;
      }
      if (it.isComparable) {
        cur.prevComp += it.prevTotal || 0;
        cur.curComp += it.curTotal || 0;
      }
      deptMap.set(d, cur);
    });

    let md = `### 💡 ${roundName || '금번 회차'} 제조고정비 선행추정 총괄 분석 요약\n\n`;
    md += `- **5개월 추정 입력분 합계**: **${totalCur.toLocaleString()} 백만원** (전체 ${itemsData.length}건 중 ${enteredItems.length}건 완료, 미입력 ${unenteredCount}건)\n`;
    md += `- **직전 대비 차이**: **${diffSign}** *(양쪽 입력 완료 ${comparableItems.length}건 기준)*\n\n`;

    md += `| 부서명 | 전체 | 완료(건) | 입력분합계(백만원) | 비교차이(백만원) |\n`;
    md += `| :--- | :---: | :---: | :---: | :---: |\n`;

    deptMap.forEach((val, deptName) => {
      const dDiff = Number((val.prevComp - val.curComp).toFixed(1));
      const dDiffStr = val.prevComp > 0 || val.curComp > 0
        ? dDiff > 0 ? `+${dDiff.toLocaleString()}(개선)` : dDiff < 0 ? `${dDiff.toLocaleString()}(악화)` : `0`
        : `비교불가`;
      md += `| **${deptName}** | ${val.total} | ${val.entered} | ${val.cur.toLocaleString()} | ${dDiffStr} |\n`;
    });

    return md;
  }

  // Default query across all items (checking for specific GL or keyword match)
  const matched = itemsData.filter(
    (it) =>
      (it.glCode && it.glCode.toLowerCase().includes(q)) ||
      (it.glName && it.glName.toLowerCase().includes(q)) ||
      (it.subItem && it.subItem.toLowerCase().includes(q)) ||
      (it.manager && it.manager.toLowerCase().includes(q))
  );

  if (matched.length > 0 && matched.length <= 10) {
    let md = `### 🔍 "${question}" 검색 결과 (${matched.length}건)\n\n`;
    matched.forEach((it, i) => {
      const diffFormatted = it.isComparable
        ? it.diffTotal > 0 ? `+${it.diffTotal}백만원(개선)` : it.diffTotal < 0 ? `${it.diffTotal}백만원(악화)` : `0`
        : '비교불가(미입력 또는 직전자료없음)';
      md += `${i + 1}. **[${it.dept}] ${it.glCode} ${it.glName} (${it.subItem})**\n`;
      md += `   - 담당자: ${it.manager} | 귀속: ${it.attribution}\n`;
      md += `   - 금번 추정: ${it.isEntered ? `${it.curTotal?.toLocaleString()} 백만원` : '미입력'}\n`;
      md += `   - 직전 대비 차이: **${diffFormatted}**\n`;
      md += `   - 사유: ${it.reason || '사유 없음'}\n\n`;
    });
    return md;
  }

  // General response
  let md = `### 💬 [LX MMA 고정비 분석 AI] 데이터 조회 결과\n\n`;
  md += `**"${question}"** 에 대한 선행추정 데이터 종합 결과입니다:\n\n`;
  md += `- **기준 회차**: ${roundName || '현재 회차'} (직전: ${prevRoundName || '직전 회차'})\n`;
  md += `- **입력분 합계**: **${totalCur.toLocaleString()} 백만원** (전체 ${itemsData.length}개 항목 중 ${enteredItems.length}건 입력완료, ${unenteredCount}건 미입력)\n`;
  md += `- **직전 대비 변동 (양쪽 완료 항목 기준)**: **${diffSign}**\n\n`;
  md += `궁금하신 부서명(예: '노경', '구매'), GL계정명, 또는 'TOP 변동', '사유 누락' 등을 입력하시면 상세 내용을 확인하실 수 있습니다.\n`;
  return md;
}

// 2. Interactive AI Q&A Endpoint
app.post('/api/ai-chat', async (req: Request, res: Response) => {
  try {
    const {
      question,
      roundName,
      roundMonths = [9, 10, 11, 12, 1],
      prevRoundName,
      userRole,
      userDepartment,
      itemsData = [],
    } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ success: false, message: '질문 내용이 필요합니다.' });
    }

    const monthHeaders = Array.isArray(roundMonths) ? roundMonths.map((m: any) => `${m}월`).join(', ') : '5개월';

    // Summary statistics over the ENTIRE dataset
    const totalCount = itemsData.length;
    const enteredItems = itemsData.filter((it: any) => it.isEntered);
    const unenteredCount = totalCount - enteredItems.length;
    const totalCurSum = enteredItems.reduce((s: number, it: any) => s + (it.curTotal || 0), 0);

    const comparableItems = itemsData.filter((it: any) => it.isComparable);
    const totalDiffComparable = comparableItems.reduce((s: number, it: any) => s + (it.diffTotal || 0), 0);
    const totalDiffFormatted = Number(totalDiffComparable.toFixed(1));

    // Department summary table for full context
    const deptSummary: Record<string, { count: number; entered: number; sum: number }> = {};
    itemsData.forEach((it: any) => {
      const d = it.dept || '기타';
      if (!deptSummary[d]) deptSummary[d] = { count: 0, entered: 0, sum: 0 };
      deptSummary[d].count++;
      if (it.isEntered) {
        deptSummary[d].entered++;
        deptSummary[d].sum += it.curTotal || 0;
      }
    });

    // Format all items compactly so the model has the FULL picture
    const formattedData = itemsData.map((item: any, i: number) => {
      const diffFormatted = item.isComparable
        ? item.diffTotal > 0 ? `+${item.diffTotal}백만원(개선)` : item.diffTotal < 0 ? `${item.diffTotal}백만원(악화)` : `0백만원`
        : (item.isEntered ? '직전자료없음' : '미입력');

      return `${i + 1}. [${item.dept}] ${item.glCode} ${item.glName} (${item.subItem} / 담당:${item.manager})
   - 금번: ${item.isEntered ? `${item.curTotal}백만원` : '미입력'} | 직전: ${item.prevTotal !== null ? `${item.prevTotal}백만원` : '자료없음'} | 차이: ${diffFormatted}
   - 사유: ${item.reason || '사유 없음'}`;
    }).join('\n');

    const prompt = `
당신은 화학/소재 제조기업 LX MMA 최고재무책임자(CFO) 산하 경영관리팀 제조고정비 전문 수석 AI 분석가입니다.
사용자가 입력된 5개월 선행추정 전체 데이터에 대해 질문하고 있습니다.

[분석 기준 정보]
- 금번 회차: ${roundName || '현재 회차'}
- 직전 회차: ${prevRoundName || '직전 회차'}
- 대상 5개월: ${monthHeaders}
- 사용자 역할: ${userRole === 'operator' ? '총괄 운영자 (전사 총괄 권한)' : `${userDepartment} 담당자`}

[전사 집계 요약]
- 전체 관리 항목: ${totalCount}건 (입력 완료: ${enteredItems.length}건, 미입력: ${unenteredCount}건)
- 5개월 추정 입력분 합계: ${totalCurSum.toLocaleString()} 백만원
- 직전 대비 비교 차이 (양쪽 완료 항목 기준): ${totalDiffFormatted > 0 ? `+${totalDiffFormatted} 백만원(개선)` : totalDiffFormatted < 0 ? `${totalDiffFormatted} 백만원(악화)` : `0 백만원`}
- 부서별 현황: ${JSON.stringify(deptSummary)}

[비즈니스 부호 체계]
- 차이금액 = 직전 추정값 - 금번 추정값
- 양수(+)이면 비용 절감(개선) / 음수(-)이면 비용 증가(악화)
- 미입력 항목은 0이 아니므로 비용 절감으로 간주하지 마십시오.
- 직전 데이터가 없는 항목은 '비교 불가'입니다.

[전체 항목 데이터 (${totalCount}건)]:
${formattedData || '입력된 데이터가 없습니다.'}

사용자 질문:
${question}

질문에 대해 정확한 숫자와 부서, 담당자, 사유를 인용하여 명쾌하고 전문적인 마크다운 보고서로 답변하세요.
`;

    // Candidate models
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let aiAnswer = '';
    let usedModel = '';

    if (genAI && apiKey) {
      for (const model of candidateModels) {
        try {
          const geminiPromise = genAI.models.generateContent({
            model,
            contents: prompt,
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI 응답 시간 초과 (15s)')), 15000)
          );

          const response: any = await Promise.race([geminiPromise, timeoutPromise]);
          if (response && response.text) {
            aiAnswer = response.text;
            usedModel = model === 'gemini-3.1-flash-lite' ? 'Gemini 3.1 Flash Lite' : 'Gemini 3.8 Flash';
            break;
          }
        } catch (err: any) {
          console.warn(`[AI Chat] Model ${model} unavailable: ${err?.message || err}`);
        }
      }
    }

    // Local fallback if AI models not available or quota exceeded
    if (!aiAnswer) {
      aiAnswer = generateLocalChatAnswer(question, itemsData, roundName, prevRoundName);
      usedModel = '규칙 기반 지능형 분석 엔진';
    }

    return res.status(200).json({
      success: true,
      answer: aiAnswer,
      model: usedModel,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
    });
  } catch (error: any) {
    console.error('Error in /api/ai-chat:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'AI 질의응답 처리 중 오류가 발생했습니다.',
    });
  }
});

// Start dev or production server
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LXMMA Manufacturing Fixed Cost App running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
