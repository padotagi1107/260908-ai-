import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Department, EntryData, MasterItem, Round, UserProfile } from '../types';
import { DEPARTMENTS } from '../initialData';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  HelpCircle,
  Clock,
  Layers,
  ChevronRight,
  TrendingUp,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface AIChatViewProps {
  currentUser: UserProfile;
  rounds: Round[];
  masterItems: MasterItem[];
  entries: EntryData[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  timestamp: string;
}

export const AIChatView: React.FC<AIChatViewProps> = ({
  currentUser,
  rounds,
  masterItems,
  entries,
}) => {
  const isOperator = currentUser.role === 'operator';

  // Selected round for AI context
  const [selectedRoundId, setSelectedRoundId] = useState<string>(() => {
    return rounds.length > 0 ? rounds[rounds.length - 1].id : '';
  });

  // Selected department scope
  const [selectedDept, setSelectedDept] = useState<string>(() => {
    return isOperator ? 'all' : currentUser.department || 'all';
  });

  const currentRound = rounds.find((r) => r.id === selectedRoundId);

  // Find previous round for comparison
  const prevRound = useMemo(() => {
    if (!currentRound) return undefined;
    const currentIndex = rounds.findIndex((r) => r.id === currentRound.id);
    if (currentIndex > 0 && currentIndex < rounds.length) {
      return rounds[currentIndex - 1];
    }
    return undefined;
  }, [rounds, currentRound]);

  // Round months (5 target months)
  const roundMonths = useMemo(() => {
    if (!currentRound) return [9, 10, 11, 12, 1];
    const startM = currentRound.month;
    const months: number[] = [];
    for (let i = 0; i < 5; i++) {
      let m = startM + i;
      if (m > 12) m -= 12;
      months.push(m);
    }
    return months;
  }, [currentRound]);

  // Helper to get previous month value
  const getPrevMonthValue = (masterId: string, monthNum: number): number => {
    if (!prevRound) return 0;
    const prevMonths: number[] = [];
    for (let i = 0; i < 5; i++) {
      let m = prevRound.month + i;
      if (m > 12) m -= 12;
      prevMonths.push(m);
    }
    const prevIdx = prevMonths.indexOf(monthNum);
    if (prevIdx === -1) return 0;

    const prevEntry = entries.find((e) => e.roundId === prevRound.id && e.masterId === masterId);
    if (!prevEntry) return 0;

    const keys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const val = prevEntry[keys[prevIdx]];
    if (typeof val === 'number' && !isNaN(val)) return val;
    return 0;
  };

  // Compile items data for AI context
  const itemsData = useMemo(() => {
    if (!currentRound) return [];

    let targetMasters = masterItems;
    if (selectedDept !== 'all') {
      targetMasters = targetMasters.filter((m) => m.dept === selectedDept);
    }

    const mKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const curEntries = entries.filter((e) => e.roundId === currentRound.id);

    return targetMasters.map((m) => {
      const entry = curEntries.find((e) => e.masterId === m.id);

      let itemCurTotal = 0;
      let itemPrevTotal = 0;

      const mValues = roundMonths.map((mNum, idx) => {
        const rawCur = entry?.[mKeys[idx]];
        const curVal = typeof rawCur === 'number' && !isNaN(rawCur) ? rawCur : 0;
        const prevVal = getPrevMonthValue(m.id, mNum);

        itemCurTotal += curVal;
        itemPrevTotal += prevVal;
        return curVal;
      });

      // 차이금액 = 직전추정 - 금번추정 (+이면 개선, -이면 악화)
      const diffTotal = Number((itemPrevTotal - itemCurTotal).toFixed(1));

      return {
        id: m.id,
        dept: m.dept,
        manager: m.manager,
        glCode: m.glCode,
        glName: m.glName,
        subItem: m.subItem,
        attribution: m.attribution,
        prevTotal: Number(itemPrevTotal.toFixed(1)),
        curTotal: Number(itemCurTotal.toFixed(1)),
        diffTotal,
        m1: mValues[0],
        m2: mValues[1],
        m3: mValues[2],
        m4: mValues[3],
        m5: mValues[4],
        reason: entry?.reason || '',
      };
    });
  }, [currentRound, prevRound, roundMonths, masterItems, entries, selectedDept]);

  // Initial greeting
  const initialMessages: ChatMessage[] = useMemo(() => {
    const welcome = isOperator
      ? `안녕하세요! **LX MMA 제조고정비 전사 선행추정 AI 분석 도우미**입니다. 
현재 **${currentRound?.name || '최신 회차'}** 기준 전사 5개 부서의 모든 GL계정/세목 데이터가 탑재되어 있습니다.

궁금하신 점을 편하게 질문해 주시면, 입력된 수치와 기재된 사유를 정밀 대조하여 즉시 답변해 드립니다.
아래 추천 질문을 클릭하시거나, 하단 입력창에 직접 질문을 입력하세요!`
      : `안녕하세요! **LX MMA 제조고정비 선행추정 AI 분석 도우미**입니다.
현재 **${currentRound?.name || '최신 회차'}** 기준 **[${currentUser.department}]** 소관 GL계정 및 비용 추정 데이터가 로드되어 있습니다.

직전 대비 증감 내역, 월별 추세, 미기재 사유 등 궁금한 점을 질문하시면 즉시 분석해 드립니다.`;

    return [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: welcome,
        model: 'Gemini AI',
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  }, [isOperator, currentRound?.name, currentUser.department]);

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Preset question list
  const presetQuestions = [
    '직전 대비 가장 큰 변동(증감) 상위 항목 TOP 5와 사유를 알려줘',
    '변동금액이 발생했으나 차이사유가 누락된 항목을 점검해줘',
    '직전 대비 비용이 개선(+)된 항목과 악화(-)된 항목들을 비교 분석해줘',
    '부서별 5개월 고정비 추정 합계표와 특징을 요약해줘',
    '경영진/CFO 보고용 3줄 핵심 요약 브리핑을 작성해줘',
    '특정 월(m1~m5)에 금액이 비정상적으로 집중된 항목이 있는지 알려줘',
  ];

  // Send question handler
  const handleSendMessage = async (textToSend?: string) => {
    const question = (textToSend || inputValue).trim();
    if (!question || isSending) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsSending(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          roundName: currentRound?.name || '',
          roundMonths,
          prevRoundName: prevRound?.name || '',
          userRole: currentUser.role,
          userDepartment: currentUser.department,
          itemsData,
        }),
      });

      const data = await res.json();
      if (data.success && data.answer) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          model: data.model || 'Gemini 3.1 Flash Lite AI',
          timestamp: data.timestamp || new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ 일시적으로 답변을 생성하지 못했습니다. (${data.message || '다시 시도해 주세요'})`,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ 네트워크 오류로 답변을 불러오지 못했습니다. 다시 시도해 주세요.`,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setMessages(initialMessages);
  };

  // Simple Markdown-like formatter for UI rendering
  const renderFormattedContent = (content: string) => {
    // Split by lines to render cleanly
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-sm font-bold text-slate-900 mt-3 mb-1.5 flex items-center gap-1.5">
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('#### ')) {
        return (
          <h5 key={idx} className="text-xs font-bold text-slate-800 mt-2 mb-1">
            {line.replace('#### ', '')}
          </h5>
        );
      }
      // Table rows
      if (line.trim().startsWith('|')) {
        return (
          <div key={idx} className="font-mono text-[11px] text-slate-700 bg-slate-100/60 px-2 py-0.5 rounded my-0.5 overflow-x-auto whitespace-pre">
            {line}
          </div>
        );
      }
      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const text = line.trim().replace(/^[-*]\s+/, '');
        return (
          <div key={idx} className="flex items-start space-x-1.5 my-1 text-xs text-slate-700">
            <span className="text-[#0F2D59] font-bold">•</span>
            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(text) }} />
          </div>
        );
      }
      // Numbered lists
      if (/^\d+\.\s+/.test(line.trim())) {
        return (
          <div
            key={idx}
            className="my-1.5 text-xs text-slate-800 font-medium pl-1 border-l-2 border-[#0F2D59]/30"
            dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }}
          />
        );
      }
      // Normal empty line
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      // Default text line
      return (
        <p
          key={idx}
          className="text-xs text-slate-700 leading-relaxed my-0.5"
          dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }}
        />
      );
    });
  };

  const formatInlineMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<b class="font-bold text-slate-900">$1</b>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-800">$1</code>');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      {/* Top Banner / Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-purple-600/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  AI 제조고정비 선행추정 질의응답 (Q&A)
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  대화형 분석
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                입력된 고정비 선행추정 데이터(GL계정, 담당자, 부서, 5개월 추정금액, 직전 대비 차이, 변동사유)를 기반으로 AI가 즉시 답변합니다.
              </p>
            </div>
          </div>

          {/* Context Control Selectors */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <span className="text-slate-500 font-medium">기준 회차:</span>
              <select
                value={selectedRoundId}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] cursor-pointer"
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.status === 'open' ? '진행중' : '마감됨'})
                  </option>
                ))}
              </select>
            </div>

            {isOperator && (
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                <span className="text-slate-500 font-medium">부서 범위:</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] cursor-pointer"
                >
                  <option value="all">전체 부서 (전사 통합)</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleResetChat}
              className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              title="대화 내용을 처음으로 초기화합니다"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>대화 초기화</span>
            </button>
          </div>
        </div>

        {/* Dataset Scope Info Badge */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center space-x-1 text-slate-600">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>분석 탑재 데이터: <b>{itemsData.length}건</b> 항목</span>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              기준 5개월: <b>{roundMonths.map((m) => `${m}월`).join(', ')}</b>
            </span>
            {prevRound && (
              <>
                <span className="text-slate-300">|</span>
                <span>
                  비교 대상: <b>{prevRound.name}</b>
                </span>
              </>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            * 차이 부호: +는 비용절감(개선), -는 비용증가(악화) 기준 적용
          </span>
        </div>
      </div>

      {/* Preset Question Chips Strip */}
      <div className="space-y-1.5">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 px-1">
          <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
          <span>자주 묻는 원클릭 추천 질문</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {presetQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(q)}
              disabled={isSending}
              className="text-xs bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 hover:border-purple-300 rounded-xl px-3 py-1.5 transition-all text-left shadow-2xs disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
            >
              <ChevronRight className="w-3 h-3 text-purple-500 shrink-0" />
              <span>{q}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Stream Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[560px] overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                    isUser
                      ? 'bg-[#0F2D59] text-white'
                      : 'bg-gradient-to-tr from-purple-600 to-blue-600 text-white'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className={`max-w-[85%] sm:max-w-[75%] space-y-1`}>
                  <div
                    className={`flex items-center space-x-2 text-[10px] text-slate-400 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span className="font-semibold text-slate-700">
                      {isUser ? currentUser.name : (msg.model || 'Gemini AI')}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    className={`rounded-2xl p-4 shadow-2xs ${
                      isUser
                        ? 'bg-[#0F2D59] text-white rounded-tr-xs'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                    }`}
                  >
                    {isUser ? (
                      <p className="text-xs sm:text-sm font-medium whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <div className="prose-xs text-slate-800 leading-relaxed">
                          {renderFormattedContent(msg.content)}
                        </div>

                        {/* Message Action Strip */}
                        <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-end">
                          <button
                            onClick={() => handleCopyText(msg.id, msg.content)}
                            className="inline-flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-700 transition-colors px-1.5 py-0.5 rounded cursor-pointer"
                            title="답변 내용 복사"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600 font-semibold">복사됨</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>복사</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing/Loading State */}
          {isSending && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-4 shadow-2xs">
                <div className="flex items-center space-x-2 text-xs text-purple-700 font-semibold">
                  <div className="flex space-x-1">
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>입력 데이터를 정밀 분석하여 답변을 구성하고 있습니다...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar Area */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end space-x-2"
          >
            <div className="flex-1 bg-slate-50 border border-slate-200 focus-within:border-[#0F2D59] focus-within:ring-2 focus-within:ring-[#0F2D59]/10 rounded-xl px-3 py-2 transition-all">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="입력 데이터에 대해 궁금한 점을 질문해 보세요 (예: 노경 부서의 가장 큰 변동 사유는 무엇인가요?)"
                rows={2}
                disabled={isSending}
                className="w-full bg-transparent resize-none text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden leading-relaxed"
              />
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-400">
                <span>Enter 키를 눌러 전송 (줄바꿈은 Shift+Enter)</span>
                <span>{inputValue.length} 자</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className="h-14 px-4 bg-[#0F2D59] hover:bg-[#183B6B] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">질문 전송</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
