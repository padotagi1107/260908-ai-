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
  ExternalLink,
  Users,
  Clock,
  History,
  AlertTriangle,
  Check,
  Settings,
  RotateCcw,
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

export interface EmailTemplateConfig {
  subject: string;
  body: string;
}

export interface EmailTemplatesState {
  request: EmailTemplateConfig;
  remind: EmailTemplateConfig;
}

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplatesState = {
  request: {
    subject: '[LX MMA 제조고정비 선행추정] {roundName} 자료 입력 및 취합 요청 안내',
    body:
`안녕하세요, LX MMA 제조고정비 선행추정 각 부서 담당자 여러분.

{roundName} 제조고정비 5개월 선행추정 자료 입력 및 취합을 아래와 같이 요청드리오니, 정해진 기한 내에 입력을 완료하여 주시기 바랍니다.

■ 대상 회차: {roundName} (회차 ID: {roundId})
■ 입력 기간: {startDate} ~ {endDate} 18:00
■ 대상 부서: 노경, 환경안전, IT보안팀, 구매, 기술팀 전 부서
■ 입력 항목: 5개월치 제조고정비 월별 추정 금액 및 직전 회차 대비 주요 증감 사유
■ 시스템 접속: LX MMA 제조고정비 선행추정 관리 시스템 (상단 '자료 입력' 탭)

※ 원활한 전사 결산 및 경영계획 수립을 위하여 입력 기한을 엄수해 주시기 바라며, 입력 마감 이후에는 시스템이 잠금 처리되어 수정이 불가하오니 유의하시기 바랍니다.

감사합니다.
(발신: 제조고정비 총괄 운영자)`,
  },
  remind: {
    subject: '[긴급 리마인드] {roundName} 제조고정비 선행추정 미작성분 입력 요청',
    body:
`안녕하세요, LX MMA 선행추정 담당자님.

현재 {roundName} 제조고정비 선행추정 입력 마감일({endDate})이 임박하였으나, 아직 미작성된 항목이 확인되어 긴급 리마인드 드립니다.

■ 대상 회차: {roundName} (마감 일시: {endDate} 18:00)
■ 조치 요청 사항:
  - 시스템 접속 후 소속 부서의 미입력된 월별 추정 금액을 즉시 입력해 주십시오.
  - 직전 회차 대비 변동 금액이 큰 항목은 필히 [차이사유]를 기재해 주시기 바랍니다.
■ 마감 후 조치: 기한 이후에는 회차가 마감(잠금)되어 추가 등록 및 수정이 불가합니다.

신속한 입력 협조를 간곡히 부탁드립니다.

감사합니다.
(발신: 제조고정비 총괄 운영자)`,
  },
};

export const resolveEmailTemplate = (template: string, round: Round): string => {
  return template
    .replace(/{roundName}/g, round.name)
    .replace(/{roundId}/g, round.id)
    .replace(/{startDate}/g, round.startDate)
    .replace(/{endDate}/g, round.endDate);
};

export const RoundManagement: React.FC<RoundManagementProps> = ({
  rounds,
  users = [],
  masterItems = [],
  entries = [],
  onAddRound,
  onToggleRoundStatus,
  onDeleteRound,
}) => {
  // New Round modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [seq, setSeq] = useState<number>(1);
  const [name, setName] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Email Template Settings modal state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateModalType, setTemplateModalType] = useState<'request' | 'remind'>('request');
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplatesState>(() => {
    const saved = localStorage.getItem('company_email_templates');
    return saved ? JSON.parse(saved) : DEFAULT_EMAIL_TEMPLATES;
  });
  const [editingTemplates, setEditingTemplates] = useState<EmailTemplatesState>(emailTemplates);
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState(false);

  // Email Composer modal state
  const [emailModalRound, setEmailModalRound] = useState<Round | null>(null);
  const [emailType, setEmailType] = useState<'request' | 'remind'>('request');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Record<string, boolean>>({});
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [showHistoryTab, setShowHistoryTab] = useState(false);

  // Email request logs (Local storage log of compose requests)
  const [emailHistory, setEmailHistory] = useState<Array<{
    id: string;
    roundId: string;
    roundName: string;
    type: 'request' | 'remind';
    recipientCount: number;
    recipients: Array<{ name: string; email: string; department?: string; pendingCount?: number }>;
    subject: string;
    body: string;
    requestedAt: string;
    status: string;
  }>>(() => {
    const saved = localStorage.getItem('company_email_compose_requests');
    return saved ? JSON.parse(saved) : [];
  });

  const handleOpenAdd = () => {
    const currentM = new Date().getMonth() + 1;
    setMonth(currentM);
    setSeq(1);
    setName(`${currentM}월 1차`);
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 5);
    setEndDate(nextWeek.toISOString().split('T')[0]);

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

  // Open Template Management Modal
  const handleOpenTemplateModal = () => {
    setEditingTemplates(JSON.parse(JSON.stringify(emailTemplates)));
    setTemplateModalType('request');
    setTemplateSaveSuccess(false);
    setIsTemplateModalOpen(true);
  };

  // Save Configured Templates
  const handleSaveTemplates = () => {
    setEmailTemplates(editingTemplates);
    localStorage.setItem('company_email_templates', JSON.stringify(editingTemplates));
    setTemplateSaveSuccess(true);
    setTimeout(() => {
      setTemplateSaveSuccess(false);
      setIsTemplateModalOpen(false);
    }, 700);
  };

  // Reset Template to Default
  const handleResetTemplateToDefault = (type: 'request' | 'remind') => {
    const label = type === 'request' ? '취합 요청 메일' : 'Remind 메일';
    if (confirm(`'${label}'의 문구를 초기 기본값으로 복원하시겠습니까?`)) {
      setEditingTemplates((prev) => ({
        ...prev,
        [type]: { ...DEFAULT_EMAIL_TEMPLATES[type] },
      }));
    }
  };

  // Compile full manager list with uncompleted item stats for the active email round
  // An item is completed ONLY if all 5 months are entered!
  const allManagersStatus: EmailRecipient[] = useMemo(() => {
    if (!emailModalRound) return [];

    const roundId = emailModalRound.id;
    const roundEntries = entries.filter((e) => e.roundId === roundId);

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
      // All 5 months must be entered numbers to be completed
      const mKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
      const isEntered =
        entry &&
        mKeys.every((k) => typeof entry[k] === 'number' && !isNaN(entry[k] as number));

      const matchedUser = users.find(
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

  // Current recipient candidates according to email type
  const currentRecipients = useMemo(() => {
    if (emailType === 'remind') {
      return allManagersStatus.filter((m) => m.pendingCount > 0);
    }
    return allManagersStatus;
  }, [emailType, allManagersStatus]);

  // Open email dispatch modal
  const handleOpenEmailModal = (round: Round) => {
    setEmailModalRound(round);
    setEmailType('request');
    setNoticeMessage(null);
    setShowHistoryTab(false);

    // Initialize all as checked
    const initialChecked: Record<string, boolean> = {};
    allManagersStatus.forEach((m) => {
      initialChecked[m.id] = true;
    });
    setSelectedRecipientIds(initialChecked);

    // Load configured template for 'request'
    const templ = emailTemplates.request;
    setEmailSubject(resolveEmailTemplate(templ.subject, round));
    setEmailBody(resolveEmailTemplate(templ.body, round));
  };

  // Switch between 'request' and 'remind' modes
  const handleSwitchEmailType = (type: 'request' | 'remind') => {
    if (!emailModalRound) return;
    setEmailType(type);
    setNoticeMessage(null);

    const round = emailModalRound;
    const targetList =
      type === 'request' ? allManagersStatus : allManagersStatus.filter((m) => m.pendingCount > 0);

    const checked: Record<string, boolean> = {};
    targetList.forEach((m) => {
      checked[m.id] = true;
    });
    setSelectedRecipientIds(checked);

    // Apply configured template
    const templ = emailTemplates[type];
    setEmailSubject(resolveEmailTemplate(templ.subject, round));
    setEmailBody(resolveEmailTemplate(templ.body, round));
  };

  // Reload current email subject and body from saved template
  const handleReloadSavedTemplate = () => {
    if (!emailModalRound) return;
    const templ = emailTemplates[emailType];
    setEmailSubject(resolveEmailTemplate(templ.subject, emailModalRound));
    setEmailBody(resolveEmailTemplate(templ.body, emailModalRound));
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

  // Open Default Mail Client (Outlook / Webmail via mailto:)
  const handleOpenMailtoClient = () => {
    if (!emailModalRound) return;

    const targets = currentRecipients.filter((m) => selectedRecipientIds[m.id]);
    if (targets.length === 0) {
      alert('수신 대상자를 최소 1명 이상 선택해 주세요.');
      return;
    }

    if (!emailSubject.trim()) {
      alert('이메일 제목을 입력해 주세요.');
      return;
    }

    const emailAddresses = targets.map((t) => t.email).join(',');
    const encodedSubject = encodeURIComponent(emailSubject);
    const encodedBody = encodeURIComponent(emailBody);

    const mailtoUrl = `mailto:${emailAddresses}?subject=${encodedSubject}&body=${encodedBody}`;

    // Record request to local history (without claiming delivery completed)
    const newLog = {
      id: `compose-req-${Date.now()}`,
      roundId: emailModalRound.id,
      roundName: emailModalRound.name,
      type: emailType,
      recipientCount: targets.length,
      recipients: targets,
      subject: emailSubject,
      body: emailBody,
      requestedAt: new Date().toISOString(),
      status: '메일 작성창 호출 완료 (전송 여부는 확인 불가)',
    };
    const updatedHistory = [newLog, ...emailHistory];
    setEmailHistory(updatedHistory);
    localStorage.setItem('company_email_compose_requests', JSON.stringify(updatedHistory));

    // Open user's default email client
    window.location.href = mailtoUrl;

    // Display clear guide
    setNoticeMessage(
      `✉️ 기본 메일 프로그램(Outlook 등)에 수신자 ${targets.length}명, 제목, 본문이 전달되었습니다.\n메일 프로그램에서 내용을 확인하신 후 직접 전송해 주세요.`
    );
  };

  const selectedCount = currentRecipients.filter((m) => selectedRecipientIds[m.id]).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">입력 회차 생성 및 마감 관리</h2>
          <p className="text-sm text-slate-500">
            월별 2회씩 입력 회차(예: 9-1, 9-2)를 생성하고 마감 처리하며, 회차별 담당자에게 취합 요청 및 리마인드 메일을 작성할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 이메일 문구 설정 버튼 */}
          <button
            onClick={handleOpenTemplateModal}
            className="inline-flex items-center justify-center px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
            title="취합 요청 및 Remind 메일의 기본 제목과 본문 문구를 고정 및 설정합니다"
          >
            <Settings className="w-4 h-4 mr-1.5 text-slate-500" />
            이메일 문구 설정
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-xs sm:text-sm hover:bg-blue-700 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            새 회차 생성
          </button>
        </div>
      </div>

      {/* Rounds Table */}
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
                <th className="py-3 px-4 w-44">이메일 작성</th>
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
                    <tr key={round.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 text-center">
                        {round.id}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {round.name}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-600">
                        {round.month}월
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-center">
                        {round.startDate} ~ {round.endDate}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOpen ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Unlock className="w-3.5 h-3.5 mr-1" />
                            진행중 (입력 가능)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <Lock className="w-3.5 h-3.5 mr-1" />
                            마감됨 (수정 불가)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => onToggleRoundStatus(round.id)}
                            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                              isOpen
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {isOpen ? (
                              <>
                                <Lock className="w-3 h-3 mr-1" />
                                회차 마감
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3 mr-1" />
                                마감 해제
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`'${round.name}' 회차를 완전히 삭제하시겠습니까?`)) {
                                onDeleteRound(round.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="회차 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenEmailModal(round)}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0F2D59]/10 text-[#0F2D59] hover:bg-[#0F2D59] hover:text-white border border-[#0F2D59]/30 transition-all cursor-pointer shadow-2xs"
                          title="이메일 작성창을 열어 안내 메일을 작성합니다"
                        >
                          <Mail className="w-3.5 h-3.5 mr-1.5" />
                          메일 작성
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

      {/* 1. Modal: Email Template Management (이메일 문구 설정) */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">이메일 발송 기본 문구 설정</h3>
                  <p className="text-xs text-slate-500">
                    회차별 메일 발송 시 자동으로 채워질 기본 제목과 본문을 고정 관리합니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Type Tabs */}
            <div className="mt-4 flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setTemplateModalType('request')}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-bold border-b-2 text-center transition-colors cursor-pointer ${
                  templateModalType === 'request'
                    ? 'border-[#0F2D59] text-[#0F2D59] bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                ① 취합 요청 메일
              </button>
              <button
                type="button"
                onClick={() => setTemplateModalType('remind')}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-bold border-b-2 text-center transition-colors cursor-pointer ${
                  templateModalType === 'remind'
                    ? 'border-[#0F2D59] text-[#0F2D59] bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                ② Remind 메일
              </button>
            </div>

            {/* Placeholders Guide */}
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              <span className="font-bold text-slate-800 block mb-1">치환 변수 안내:</span>
              <p className="text-[11px] leading-relaxed text-slate-500">
                본문이나 제목에 아래 변수를 입력하면 발송 대상 회차의 정보로 자동 치환됩니다.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2 font-mono text-[11px]">
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-blue-700">{`{roundName}`}</span>
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-blue-700">{`{roundId}`}</span>
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-blue-700">{`{startDate}`}</span>
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-blue-700">{`{endDate}`}</span>
              </div>
            </div>

            {/* Form Fields for Active Template */}
            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  이메일 제목
                </label>
                <input
                  type="text"
                  value={editingTemplates[templateModalType].subject}
                  onChange={(e) =>
                    setEditingTemplates((prev) => ({
                      ...prev,
                      [templateModalType]: { ...prev[templateModalType], subject: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  이메일 본문
                </label>
                <textarea
                  rows={9}
                  value={editingTemplates[templateModalType].body}
                  onChange={(e) =>
                    setEditingTemplates((prev) => ({
                      ...prev,
                      [templateModalType]: { ...prev[templateModalType], body: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 font-mono text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] leading-relaxed resize-y"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleResetTemplateToDefault(templateModalType)}
                className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-400" />
                기본 문구로 초기화
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplates}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#0F2D59] hover:bg-[#183B6B] transition-colors shadow-sm cursor-pointer"
                >
                  {templateSaveSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      저장 완료
                    </>
                  ) : (
                    '설정 저장'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Email Composer (메일 작성창 열기) */}
      {emailModalRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full p-6 animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-[#0F2D59]/10 text-[#0F2D59]">
                  <Mail className="w-5 h-5 text-[#0F2D59]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    [{emailModalRound.name}] 취합 안내 메일 작성
                  </h3>
                  <p className="text-xs text-slate-500">
                    기본 메일 프로그램(Outlook, 웹메일 등)에 수신자와 제목, 본문을 전달하여 직접 전송합니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEmailModalRound(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email Type Tabs: Subtitle suffixes removed */}
            <div className="mt-4 flex border-b border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => handleSwitchEmailType('request')}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-bold border-b-2 text-center transition-colors cursor-pointer ${
                  emailType === 'request'
                    ? 'border-[#0F2D59] text-[#0F2D59] bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                ① 취합 요청 메일
              </button>
              <button
                type="button"
                onClick={() => handleSwitchEmailType('remind')}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-bold border-b-2 text-center transition-colors cursor-pointer ${
                  emailType === 'remind'
                    ? 'border-[#0F2D59] text-[#0F2D59] bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                ② Remind 메일
              </button>
            </div>

            {/* Notice Message */}
            {noticeMessage && (
              <div className="mt-3 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 whitespace-pre-line shrink-0">
                {noticeMessage}
              </div>
            )}

            {/* Modal Body */}
            <div className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Recipient Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">
                      수신 담당자 선택 ({selectedCount}/{currentRecipients.length}명 선택됨)
                    </span>
                  </div>
                  <div className="space-x-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => handleSelectAllRecipients(true)}
                      className="text-blue-600 hover:underline cursor-pointer"
                    >
                      전체 선택
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllRecipients(false)}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      선택 해제
                    </button>
                  </div>
                </div>

                {currentRecipients.length === 0 ? (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 text-center">
                    🎉 모든 부서 담당자의 작성이 완료되었습니다! (Remind 대상자 없음)
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl p-2 max-h-36 overflow-y-auto bg-slate-50 space-y-1">
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    이메일 제목
                  </label>
                  <button
                    type="button"
                    onClick={handleReloadSavedTemplate}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
                    title="설정된 기본 문구로 본문과 제목을 다시 채웁니다"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>기본 문구 불러오기</span>
                  </button>
                </div>
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

              {/* Guidance Box */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-900">
                <span className="font-bold block mb-0.5">안내 사항:</span>
                아래 <b>[메일 작성창 열기]</b> 버튼을 누르면 기본 메일 프로그램(Outlook 또는 웹메일)의 새 편지 작성창이 열립니다. 내용을 확인하신 후 직접 전송해 주십시오. (시스템 내에서 임의로 발송 완료 처리되지 않습니다.)
              </div>

              {/* History Drawer */}
              {showHistoryTab && (
                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-800">
                      [{emailModalRound.name}] 메일 작성 요청 이력
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      ※ 실제 전송 여부는 외부 메일 프로그램에서 처리되므로 확인할 수 없습니다.
                    </span>
                  </div>
                  {emailHistory.filter((h) => h.roundId === emailModalRound.id).length === 0 ? (
                    <p className="text-slate-400 text-center py-4">
                      기록된 메일 작성 요청 이력이 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto">
                      {emailHistory
                        .filter((h) => h.roundId === emailModalRound.id)
                        .map((log) => (
                          <div
                            key={log.id}
                            className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-slate-800">
                                  {log.type === 'remind' ? 'Remind 메일' : '취합 요청 메일'}
                                </span>
                                <span className="text-slate-500 text-[11px]">
                                  (수신자 {log.recipientCount}명 대상 작성창 호출)
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 truncate max-w-md mt-0.5">
                                {log.subject}
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(log.requestedAt).toLocaleString('ko-KR')}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 mt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowHistoryTab(!showHistoryTab)}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>메일 작성 요청 이력 ({emailHistory.filter((h) => h.roundId === emailModalRound.id).length}건)</span>
              </button>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setEmailModalRound(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleOpenMailtoClient}
                  disabled={selectedCount === 0}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-[#0F2D59] hover:bg-[#183B6B] active:bg-[#0A2040] text-white transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  메일 작성창 열기 ({selectedCount}명)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Add New Round */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">새 회차 생성</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">대상 월</label>
                  <select
                    value={month}
                    onChange={(e) => handleMonthSeqChange(Number(e.target.value), seq)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        {m}월
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">차수</label>
                  <select
                    value={seq}
                    onChange={(e) => handleMonthSeqChange(month, Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value={1}>1차</option>
                    <option value={2}>2차</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">회차 명칭</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">시작일</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">종료일</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors font-medium cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors font-medium shadow-sm cursor-pointer"
                >
                  회차 생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
