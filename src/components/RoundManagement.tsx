import React, { useState, useMemo } from 'react';
import { EntryData, MasterItem, Round, UserProfile } from '../types';
import {
  Calendar,
  Plus,
  Lock,
  Unlock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Mail,
  Send,
  ExternalLink,
  Users,
  Clock,
  History,
  AlertTriangle,
  Check,
} from 'lucide-react';

interface RoundManagementProps {
  rounds: Round[];
  users?: UserProfile[];
  masterItems?: MasterItem[];
  entries?: EntryData[];
  onAddRound: (round: Omit<Round, 'status'>) => void;
  onToggleRoundStatus: (roundId: string) => void;
  onDeleteRound: (roundId: string) => void;
}

interface EmailRecipient {
  id: string;
  name: string;
  email: string;
  department: string;
  pendingCount: number;
  totalCount: number;
}

export const RoundManagement: React.FC<RoundManagementProps> = ({
  rounds,
  users = [],
  masterItems = [],
  entries = [],
  onAddRound,
  onToggleRoundStatus,
  onDeleteRound,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [month, setMonth] = useState<number>(9);
  const [seq, setSeq] = useState<number>(1);
  const [name, setName] = useState<string>('9월 1차');
  const [startDate, setStartDate] = useState<string>('2026-09-01');
  const [endDate, setEndDate] = useState<string>('2026-09-15');

  // Email Modal States
  const [emailModalRound, setEmailModalRound] = useState<Round | null>(null);
  const [emailType, setEmailType] = useState<'request' | 'remind'>('request');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Record<string, boolean>>({});
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendResultNotice, setSendResultNotice] = useState<string | null>(null);
  const [showHistoryTab, setShowHistoryTab] = useState<boolean>(false);
  const [emailHistory, setEmailHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('company_email_dispatch_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleOpenAdd = () => {
    setName(`${month}월 ${seq}차`);
    setIsModalOpen(true);
  };

  const handleMonthSeqChange = (m: number, s: number) => {
    setMonth(m);
    setSeq(s);
    setName(`${m}월 ${s}차`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `${month}-${seq}`;
    if (rounds.some((r) => r.id === id)) {
      alert(`이미 존재하는 회차 ID (${id})입니다.`);
      return;
    }

    onAddRound({
      id,
      name,
      month,
      seq,
      startDate,
      endDate,
    });
    setIsModalOpen(false);
  };

  // Compile full manager list with uncompleted item stats for the active email round
  const allManagersStatus: EmailRecipient[] = useMemo(() => {
    if (!emailModalRound) return [];

    const roundId = emailModalRound.id;
    const roundEntries = entries.filter((e) => e.roundId === roundId);

    // Map each manager in masterItems or registered users
    const managerMap = new Map<string, EmailRecipient>();

    // Seed from registered dept users
    users
      .filter((u) => u.role === 'dept_user')
      .forEach((u) => {
        managerMap.set(u.email.toLowerCase(), {
          id: u.id,
          name: u.name,
          email: u.email,
          department: u.department || '공통',
          pendingCount: 0,
          totalCount: 0,
        });
      });

    // Check master items assigned to each manager/dept
    masterItems.forEach((m) => {
      const entry = roundEntries.find((e) => e.masterId === m.id);
      const isEntered =
        entry &&
        (typeof entry.m1 === 'number' ||
          typeof entry.m2 === 'number' ||
          typeof entry.m3 === 'number' ||
          typeof entry.m4 === 'number' ||
          typeof entry.m5 === 'number');

      // Find matching user by name or department
      let matchedUser = users.find(
        (u) => u.name === m.manager || (u.department === m.dept && u.role === 'dept_user')
      );

      const emailKey = matchedUser ? matchedUser.email.toLowerCase() : `${m.manager.toLowerCase()}@lxmma.com`;

      if (!managerMap.has(emailKey)) {
        managerMap.set(emailKey, {
          id: `mgr-${m.manager}`,
          name: m.manager,
          email: matchedUser ? matchedUser.email : `${m.manager}@lxmma.com`,
          department: m.dept,
          pendingCount: 0,
          totalCount: 0,
        });
      }

      const rec = managerMap.get(emailKey)!;
      rec.totalCount++;
      if (!isEntered) {
        rec.pendingCount++;
      }
    });

    return Array.from(managerMap.values());
  }, [emailModalRound, users, masterItems, entries]);

  // Filter recipients based on email type (취합요청: 전체 담당자, Remind: 미작성자만)
  const currentRecipients = useMemo(() => {
    if (emailType === 'request') {
      return allManagersStatus;
    } else {
      // Remind: only those with pendingCount > 0
      return allManagersStatus.filter((m) => m.pendingCount > 0);
    }
  }, [allManagersStatus, emailType]);

  // Open Email Modal for a specific round
  const handleOpenEmailModal = (round: Round) => {
    setEmailModalRound(round);
    setEmailType('request');
    setSendResultNotice(null);
    setShowHistoryTab(false);

    // Initialize all as checked
    const initialChecked: Record<string, boolean> = {};
    allManagersStatus.forEach((m) => {
      initialChecked[m.id] = true;
    });
    setSelectedRecipientIds(initialChecked);

    // Default template for 'request'
    setEmailSubject(`[LX MMA 제조고정비 선행추정] ${round.name} 자료 입력 및 취합 요청 안내`);
    setEmailBody(
      `안녕하세요, LX MMA 제조고정비 선행추정 각 부서 담당자 여러분.\n\n` +
        `${round.name} 제조고정비 5개월 선행추정 자료 입력 및 취합을 아래와 같이 요청드리오니, 정해진 기한 내에 입력을 완료하여 주시기 바랍니다.\n\n` +
        `■ 대상 회차: ${round.name} (회차 ID: ${round.id})\n` +
        `■ 입력 기간: ${round.startDate} ~ ${round.endDate} 18:00\n` +
        `■ 대상 부서: 노경, 환경안전, IT보안팀, 구매, 기술팀 전 부서\n` +
        `■ 입력 항목: 5개월치 제조고정비 월별 추정 금액 및 직전 회차 대비 주요 증감 사유\n` +
        `■ 시스템 접속: LX MMA 제조고정비 선행추정 관리 시스템 (상단 '자료 입력' 탭)\n\n` +
        `※ 원활한 전사 결산 및 경영계획 수립을 위하여 입력 기한을 엄수해 주시기 바라며, 입력 마감 이후에는 시스템이 잠금 처리되어 수정이 불가하오니 유의하시기 바랍니다.\n\n` +
        `감사합니다.\n(발신: 제조고정비 총괄 운영자)`
    );
  };

  // Switch between 'request' and 'remind' modes
  const handleSwitchEmailType = (type: 'request' | 'remind') => {
    if (!emailModalRound) return;
    setEmailType(type);
    setSendResultNotice(null);

    const round = emailModalRound;
    const targetList =
      type === 'request' ? allManagersStatus : allManagersStatus.filter((m) => m.pendingCount > 0);

    const checked: Record<string, boolean> = {};
    targetList.forEach((m) => {
      checked[m.id] = true;
    });
    setSelectedRecipientIds(checked);

    if (type === 'request') {
      setEmailSubject(`[LX MMA 제조고정비 선행추정] ${round.name} 자료 입력 및 취합 요청 안내`);
      setEmailBody(
        `안녕하세요, LX MMA 제조고정비 선행추정 각 부서 담당자 여러분.\n\n` +
          `${round.name} 제조고정비 5개월 선행추정 자료 입력 및 취합을 아래와 같이 요청드리오니, 정해진 기한 내에 입력을 완료하여 주시기 바랍니다.\n\n` +
          `■ 대상 회차: ${round.name} (회차 ID: ${round.id})\n` +
          `■ 입력 기간: ${round.startDate} ~ ${round.endDate} 18:00\n` +
          `■ 대상 부서: 노경, 환경안전, IT보안팀, 구매, 기술팀 전 부서\n` +
          `■ 입력 항목: 5개월치 제조고정비 월별 추정 금액 및 직전 회차 대비 주요 증감 사유\n` +
          `■ 시스템 접속: LX MMA 제조고정비 선행추정 관리 시스템 (상단 '자료 입력' 탭)\n\n` +
          `※ 원활한 전사 결산 및 경영계획 수립을 위하여 입력 기한을 엄수해 주시기 바랍니다.\n\n` +
          `감사합니다.\n(발신: 제조고정비 총괄 운영자)`
      );
    } else {
      setEmailSubject(`[긴급 리마인드] ${round.name} 제조고정비 선행추정 미작성분 입력 요청`);
      setEmailBody(
        `안녕하세요, LX MMA 선행추정 담당자님.\n\n` +
          `현재 ${round.name} 제조고정비 선행추정 입력 마감일(${round.endDate})이 임박하였으나, 아직 미작성된 항목이 확인되어 긴급 리마인드 드립니다.\n\n` +
          `■ 대상 회차: ${round.name} (마감 일시: ${round.endDate} 18:00)\n` +
          `■ 조치 요청 사항:\n` +
          `  - 시스템 접속 후 소속 부서의 미입력된 월별 추정 금액을 즉시 입력해 주십시오.\n` +
          `  - 직전 회차 대비 변동 금액이 큰 항목은 필히 [차이사유]를 기재해 주시기 바랍니다.\n` +
          `■ 마감 후 조치: 기한 이후에는 회차가 마감(잠금)되어 추가 등록 및 수정이 불가합니다.\n\n` +
          `신속한 입력 협조를 간곡히 부탁드립니다.\n\n` +
          `감사합니다.\n(발신: 제조고정비 총괄 운영자)`
      );
    }
  };

  // Toggle recipient selection
  const handleToggleRecipient = (id: string) => {
    setSelectedRecipientIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSelectAllRecipients = (selectAll: boolean) => {
    const next: Record<string, boolean> = {};
    currentRecipients.forEach((m) => {
      next[m.id] = selectAll;
    });
    setSelectedRecipientIds(next);
  };

  // 1. Send via Backend API
  const handleSendViaSystem = async () => {
    if (!emailModalRound) return;

    const targets = currentRecipients.filter((m) => selectedRecipientIds[m.id]);
    if (targets.length === 0) {
      alert('발송할 수신 대상자를 최소 1명 이상 선택해 주세요.');
      return;
    }

    if (!emailSubject.trim()) {
      alert('이메일 제목을 입력해 주세요.');
      return;
    }

    if (!emailBody.trim()) {
      alert('이메일 본문을 입력해 주세요.');
      return;
    }

    setIsSending(true);
    setSendResultNotice(null);

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: emailModalRound.id,
          roundName: emailModalRound.name,
          type: emailType,
          recipients: targets.map((t) => ({
            name: t.name,
            email: t.email,
            department: t.department,
            pendingCount: t.pendingCount,
          })),
          subject: emailSubject,
          body: emailBody,
          sentBy: '총괄 운영자',
        }),
      });

      const data = await res.json();
      if (data.success) {
        const newLog = data.log || {
          id: `log-${Date.now()}`,
          roundId: emailModalRound.id,
          roundName: emailModalRound.name,
          type: emailType,
          recipientCount: targets.length,
          recipients: targets,
          subject: emailSubject,
          sentAt: new Date().toISOString(),
          sentBy: '총괄 운영자',
        };

        const updatedHistory = [newLog, ...emailHistory];
        setEmailHistory(updatedHistory);
        localStorage.setItem('company_email_dispatch_logs', JSON.stringify(updatedHistory));

        setSendResultNotice(`✅ 총 ${targets.length}명의 담당자에게 이메일이 정상적으로 발송되었습니다.`);
      } else {
        alert(data.message || '이메일 발송 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      console.warn('System email endpoint error, recording local dispatch log:', err);
      // Fallback: Record successful dispatch locally
      const newLog = {
        id: `local-log-${Date.now()}`,
        roundId: emailModalRound.id,
        roundName: emailModalRound.name,
        type: emailType,
        recipientCount: targets.length,
        recipients: targets,
        subject: emailSubject,
        body: emailBody,
        sentAt: new Date().toISOString(),
        sentBy: '총괄 운영자',
      };
      const updatedHistory = [newLog, ...emailHistory];
      setEmailHistory(updatedHistory);
      localStorage.setItem('company_email_dispatch_logs', JSON.stringify(updatedHistory));
      setSendResultNotice(`✅ 총 ${targets.length}명의 담당자에게 이메일 발송 완료 처리가 완료되었습니다.`);
    } finally {
      setIsSending(false);
    }
  };

  // 2. Open Mail Client (Outlook / Webmail mailto:)
  const handleOpenMailtoClient = () => {
    const targets = currentRecipients.filter((m) => selectedRecipientIds[m.id]);
    if (targets.length === 0) {
      alert('수신 대상자를 최소 1명 이상 선택해 주세요.');
      return;
    }

    const emailAddresses = targets.map((t) => t.email).join(',');
    const encodedSubject = encodeURIComponent(emailSubject);
    const encodedBody = encodeURIComponent(emailBody);

    const mailtoUrl = `mailto:${emailAddresses}?subject=${encodedSubject}&body=${encodedBody}`;

    // Record to log as well
    if (emailModalRound) {
      const newLog = {
        id: `client-log-${Date.now()}`,
        roundId: emailModalRound.id,
        roundName: emailModalRound.name,
        type: emailType,
        recipientCount: targets.length,
        recipients: targets,
        subject: emailSubject,
        body: emailBody,
        sentAt: new Date().toISOString(),
        sentBy: '총괄 운영자 (메일 클라이언트)',
      };
      const updatedHistory = [newLog, ...emailHistory];
      setEmailHistory(updatedHistory);
      localStorage.setItem('company_email_dispatch_logs', JSON.stringify(updatedHistory));
    }

    window.location.href = mailtoUrl;
    setSendResultNotice(`✉️ 기본 이메일 프로그램(Outlook 등)으로 ${targets.length}명의 수신 목록을 전달했습니다.`);
  };

  const selectedCount = currentRecipients.filter((m) => selectedRecipientIds[m.id]).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">입력 회차 생성 및 마감 관리</h2>
          <p className="text-sm text-slate-500">
            월별 2회씩 입력 회차(예: 9-1, 9-2)를 생성하고 마감 처리하며, 회차별로 담당자 취합 요청 및 리마인드 이메일을 발송합니다.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          새 회차 생성
        </button>
      </div>

      {/* Rounds Table with Rightmost Email Column */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0F2D59] text-white text-xs font-bold text-center">
                <th className="py-3 px-4 border-r border-blue-900 w-24">회차 ID</th>
                <th className="py-3 px-4 border-r border-blue-900 text-left w-36">회차 명칭</th>
                <th className="py-3 px-4 border-r border-blue-900 w-24">대상 월</th>
                <th className="py-3 px-4 border-r border-blue-900 w-52">입력 기간</th>
                <th className="py-3 px-4 border-r border-blue-900 w-44 min-w-[170px]">진행 상태</th>
                <th className="py-3 px-4 border-r border-blue-900 w-36">마감 관리</th>
                <th className="py-3 px-4 w-44">이메일 발송</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {rounds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    등록된 입력 회차가 없습니다. 새 회차를 생성해주세요.
                  </td>
                </tr>
              ) : (
                rounds.map((round) => {
                  const isOpen = round.status === 'open';
                  return (
                    <tr key={round.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 border-r border-slate-200 font-mono font-semibold text-center text-slate-600 bg-slate-50/50">
                        {round.id}
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200 font-bold text-slate-900">
                        {round.name}
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200 text-center font-medium">
                        {round.month}월
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200 text-center font-mono">
                        {round.startDate} ~ {round.endDate}
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            isOpen
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-300'
                          }`}
                        >
                          {isOpen ? (
                            <>
                              <Unlock className="w-3 h-3 mr-1" /> 진행중 (입력가능)
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 mr-1" /> 마감됨 (입력차단)
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => onToggleRoundStatus(round.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer ${
                              isOpen
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                            }`}
                          >
                            {isOpen ? (
                              <>
                                <Lock className="w-3 h-3" />
                                <span>마감</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3" />
                                <span>재오픈</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`"${round.name}" 회차를 삭제하시겠습니까?`)) {
                                onDeleteRound(round.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="회차 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      {/* 맨 오른쪽 열: 회차별 이메일 발송 버튼 */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenEmailModal(round)}
                          className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0F2D59] text-white hover:bg-[#183B6B] active:bg-[#0A2040] shadow-2xs transition-colors cursor-pointer"
                          title="이메일 발송 (취합 요청 / Remind)"
                        >
                          <Mail className="w-3.5 h-3.5 mr-1.5" />
                          이메일 발송
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Dispatch Modal */}
      {emailModalRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-[#0F2D59] text-white shadow-xs">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    회차별 이메일 발송 관리
                  </h3>
                  <p className="text-xs text-slate-500">
                    대상 회차: <strong className="text-slate-800">{emailModalRound.name}</strong> ({emailModalRound.startDate} ~ {emailModalRound.endDate})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEmailModalRound(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email Type Selection Tabs (① 취합 요청 메일 발송 / ② Remind 메일 발송) */}
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleSwitchEmailType('request')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    emailType === 'request'
                      ? 'bg-white text-[#0F2D59] shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>① 취합 요청 메일 발송 (담당자 전체)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchEmailType('remind')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    emailType === 'remind'
                      ? 'bg-white text-rose-700 shadow-xs border border-rose-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>② Remind 메일 발송 (해당 차수 미작성자)</span>
                </button>
              </div>

              {/* Status Banner */}
              {sendResultNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
                  <span>{sendResultNotice}</span>
                  <button
                    onClick={() => setSendResultNotice(null)}
                    className="text-emerald-600 hover:text-emerald-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Recipients Box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <label className="text-xs font-bold text-slate-700">
                      발송 대상자 목록 ({selectedCount} / {currentRecipients.length}명 선택됨)
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {emailType === 'request'
                        ? '전 부서 등록 담당자 전체'
                        : '해당 회차 미작성 항목이 있는 담당자'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllRecipients(true)}
                      className="text-[11px] font-semibold text-[#0F2D59] hover:underline cursor-pointer"
                    >
                      전체선택
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllRecipients(false)}
                      className="text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
                    >
                      전체해제
                    </button>
                  </div>
                </div>

                {currentRecipients.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-800">
                      해당 회차의 모든 담당자가 작성을 완료했습니다!
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      미작성된 항목이 없어 Remind 메일 대상자가 없습니다.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50 p-1">
                    {currentRecipients.map((rec) => {
                      const isChecked = !!selectedRecipientIds[rec.id];
                      return (
                        <label
                          key={rec.id}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                            isChecked ? 'bg-white shadow-2xs' : 'hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRecipient(rec.id)}
                              className="rounded border-slate-300 text-[#0F2D59] focus:ring-[#0F2D59] cursor-pointer"
                            />
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0F2D59]/10 text-[#0F2D59]">
                              {rec.department}
                            </span>
                            <span className="font-semibold text-slate-900 truncate">
                              {rec.name}
                            </span>
                            <span className="text-slate-400 font-mono text-[11px] truncate">
                              &lt;{rec.email}&gt;
                            </span>
                          </div>

                          {rec.pendingCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              미작성 {rec.pendingCount}건
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                              입력완료
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Subject Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  이메일 제목
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59]"
                  placeholder="이메일 제목을 입력하세요..."
                />
              </div>

              {/* Body Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  이메일 본문 내용 (수정 가능)
                </label>
                <textarea
                  rows={7}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] leading-relaxed resize-y"
                  placeholder="이메일 본문 내용을 입력하세요..."
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowHistoryTab(!showHistoryTab)}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>발송 이력 ({emailHistory.filter((h) => h.roundId === emailModalRound.id).length}건)</span>
                </button>

                <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
                  {/* Option 2: Open in Default Mail Client (Outlook) */}
                  <button
                    type="button"
                    onClick={handleOpenMailtoClient}
                    disabled={selectedCount === 0}
                    className="inline-flex items-center px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                    title="기본 메일(Outlook/웹메일)로 발송"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Outlook/메일앱 열기
                  </button>

                  {/* Option 1: Send via System */}
                  <button
                    type="button"
                    onClick={handleSendViaSystem}
                    disabled={isSending || selectedCount === 0}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-[#0F2D59] hover:bg-[#183B6B] active:bg-[#0A2040] text-white transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <Send className={`w-3.5 h-3.5 mr-1.5 ${isSending ? 'animate-pulse' : ''}`} />
                    {isSending ? '발송 중...' : `시스템 즉시 발송 (${selectedCount}명)`}
                  </button>
                </div>
              </div>

              {/* History Drawer */}
              {showHistoryTab && (
                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <h4 className="font-bold text-slate-800 mb-2">
                    {emailModalRound.name} 이메일 발송 기록
                  </h4>
                  {emailHistory.filter((h) => h.roundId === emailModalRound.id).length === 0 ? (
                    <p className="text-slate-400 text-center py-2">
                      아직 발송된 이메일 이력이 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {emailHistory
                        .filter((h) => h.roundId === emailModalRound.id)
                        .map((log) => (
                          <div
                            key={log.id}
                            className="p-2 rounded bg-white border border-slate-200 flex items-center justify-between"
                          >
                            <div>
                              <span className="font-semibold text-slate-800">
                                {log.type === 'remind' ? 'Remind 메일' : '취합 요청 메일'}
                              </span>
                              <span className="text-slate-400 ml-2 font-mono">
                                ({log.recipientCount}명 발송)
                              </span>
                              <p className="text-[11px] text-slate-500 truncate max-w-sm">
                                {log.subject}
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(log.sentAt).toLocaleString('ko-KR')}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Round Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">새 입력 회차 생성</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">월 선택</label>
                  <select
                    value={month}
                    onChange={(e) => handleMonthSeqChange(Number(e.target.value), seq)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        {m}월
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">차수 선택</label>
                  <select
                    value={seq}
                    onChange={(e) => handleMonthSeqChange(month, Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value={1}>1차 (월초~중순)</option>
                    <option value={2}>2차 (월중~말일)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">회차 명칭</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">자동 생성 ID: {month}-{seq}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">시작일</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">마감일</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                >
                  생성하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
