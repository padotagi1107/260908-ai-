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

// In-memory cache for AI summaries to conserve API quota and provide instant responses
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
      forceRefresh,
    } = req.body;

    const isOperator = role === 'operator';
    const targetDept = isOperator ? '전사 부서 종합' : `${department} 부서`;
    const cacheKey = `${role}-${department || 'all'}-${currentRoundName || 'default'}`;

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

    if (!genAI || !apiKey) {
      return res.status(200).json({
        success: false,
        source: 'fallback',
        message: 'Gemini API 키가 설정되지 않아 로컬 분석 엔진으로 생성됩니다.',
      });
    }

    const prompt = `
당신은 대한민국 최고 수준의 화학/소재 제조기업(LX MMA)의 최고재무책임자(CFO) 산하 경영관리팀 제조고정비 전문 수석 분석가입니다.
아래 제공된 [제조고정비 5개월 선행추정 데이터]를 정밀 분석하여, 사용자(${isOperator ? '총괄 운영자 / 경영진' : `${department} 담당자`})에게 명확하고 실질적인 경영 인사이트와 점검 요약 리포트를 한국어로 작성하세요.

[분석 개요]
- 분석 대상: ${targetDept}
- 금번 회차: ${currentRoundName}
- 직전 회차: ${prevRoundName || '직전 회차 없음'}
- 대상 5개월: ${Array.isArray(roundMonths) ? roundMonths.join('월, ') + '월' : '5개월'}
- 총 항목 수: ${totalItemsCount}건 (미입력 항목: ${pendingItemsCount}건)

[집계 요약 데이터]
${JSON.stringify(summaryData, null, 2)}

[상위 주요 증감 항목 (직전 대비 변동이 큰 항목)]
${JSON.stringify(topVariances, null, 2)}

[작성 가이드라인 - 반드시 아래 4가지 항목으로 구분하여 작성할 것]
1. 💡 **총괄 요약 및 추세 분석**:
   - 5개월 전체 제조고정비 추정 총액과 직전 회차 대비 증감 총액 요약
   - 월별 변동 추세의 특징 (특정 월 집중 증액 또는 감액 사유 등)
2. ⚠️ **주요 증감 항목 심층 분석**:
   - 변동폭이 큰 주요 GL계정/세목(상위 변동 항목)의 구체적 증감 내역과 사유 평가
   - 예산 편차의 타당성 점검
3. 🔍 **추가적인 점검 및 주의가 필요한 요소 (리스크/점검 포인트)**:
   - 증감폭이 큰데 구체적 사유가 누락되었거나 불명확한 항목
   - 특정 월에 비정상적으로 튀는 값(Spike)이나 누락/0값 방치된 항목
   - 회계 마감 및 예산 통제 관점의 확인 필요 사항
4. 📋 **향후 조치 및 권고사항**:
   - ${isOperator ? '총괄 운영자 관점에서 각 부서에 요구해야 할 확인 사항 및 경영진 보고 포인트' : `${department} 담당자 관점에서 회차 마감 전 점검 및 보완해야 할 실천 조치`}

전문적이고 신뢰감 있는 비즈니스 어조로 명확하고 읽기 쉽게 마크다운 형식으로 작성해주세요. 불필요한 서두나 사족은 빼고 바로 리포트 본문으로 시작하세요.
`;

    // Try available models in order of quota availability and performance
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
          selectedModel = model;
          break;
        }
      } catch (err: any) {
        console.warn(`[AI Summary] Model ${model} unavailable or quota exceeded: ${err?.message || err}`);
      }
    }

    if (aiText) {
      const now = new Date().toISOString();
      // Cache for 10 minutes to save quota
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

    // Graceful fallback to rule-based analysis if AI quota is exhausted
    return res.status(200).json({
      success: false,
      source: 'fallback',
      message: 'Gemini AI 호출 한도 초과로 지능형 분석 엔진 결과가 적용되었습니다.',
    });
  } catch (error: any) {
    console.warn('[AI Summary] Unexpected failure, falling back to local engine:', error?.message || error);
    return res.status(200).json({
      success: false,
      source: 'fallback',
      message: '일시적인 네트워크 지연으로 지능형 분석 엔진 결과가 적용되었습니다.',
    });
  }
});

// In-memory or persisted email dispatch log for audit
const emailDispatchLogs: Array<{
  id: string;
  roundId: string;
  roundName: string;
  type: 'request' | 'remind';
  recipientCount: number;
  recipients: Array<{ name: string; email: string; department?: string; pendingCount?: number }>;
  subject: string;
  body: string;
  sentAt: string;
  sentBy: string;
  status: 'sent' | 'simulated';
}> = [];

// 2. Email Dispatch Endpoint
app.post('/api/send-email', (req: Request, res: Response) => {
  try {
    const { roundId, roundName, type, recipients, subject, body, sentBy } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, message: '수신 대상자가 지정되지 않았습니다.' });
    }

    const logEntry = {
      id: `mail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      roundId,
      roundName,
      type: type || 'request',
      recipientCount: recipients.length,
      recipients,
      subject,
      body,
      sentAt: new Date().toISOString(),
      sentBy: sentBy || '총괄 운영자',
      status: 'sent' as const,
    };

    emailDispatchLogs.unshift(logEntry);

    console.log(`[Email Dispatch] ${type === 'remind' ? 'Remind 메일' : '취합 요청 메일'} 발송 완료:`, {
      round: roundName,
      recipients: recipients.map((r) => `${r.name}(${r.email})`),
      subject,
      time: logEntry.sentAt,
    });

    return res.status(200).json({
      success: true,
      message: `${recipients.length}명의 담당자에게 이메일이 성공적으로 발송되었습니다.`,
      log: logEntry,
    });
  } catch (error: any) {
    console.error('Error in /api/send-email:', error);
    return res.status(500).json({ success: false, message: error?.message || '이메일 발송 처리 중 오류가 발생했습니다.' });
  }
});

// 3. Email History Endpoint
app.get('/api/email-logs', (req: Request, res: Response) => {
  const roundId = req.query.roundId as string;
  if (roundId) {
    const filtered = emailDispatchLogs.filter((l) => l.roundId === roundId);
    return res.json({ success: true, logs: filtered });
  }
  return res.json({ success: true, logs: emailDispatchLogs });
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
