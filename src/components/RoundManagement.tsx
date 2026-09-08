import React, { useState } from 'react';
import { Round } from '../types';
import { Calendar, Plus, Lock, Unlock, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface RoundManagementProps {
  rounds: Round[];
  onAddRound: (round: Omit<Round, 'status'>) => void;
  onToggleRoundStatus: (roundId: string) => void;
  onDeleteRound: (roundId: string) => void;
}

export const RoundManagement: React.FC<RoundManagementProps> = ({
  rounds,
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">입력 회차 생성 및 마감 관리</h2>
          <p className="text-sm text-slate-500">
            월별 2회씩 입력 회차(예: 9-1, 9-2)를 생성하고 마감 처리하여 부서별 입력 및 수정을 통제합니다.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          새 회차 생성
        </button>
      </div>

      {/* Rounds Excel Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0F2D59] text-white text-xs font-bold text-center">
                <th className="py-3 px-4 border-r border-blue-900 w-24">회차 ID</th>
                <th className="py-3 px-4 border-r border-blue-900 text-left w-36">회차 명칭</th>
                <th className="py-3 px-4 border-r border-blue-900 w-24">대상 월</th>
                <th className="py-3 px-4 border-r border-blue-900 w-56">입력 기간</th>
                <th className="py-3 px-4 border-r border-blue-900 w-56 min-w-[200px]">진행 상태</th>
                <th className="py-3 px-4 w-40">관리 작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {rounds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
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
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => onToggleRoundStatus(round.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors ${
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
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="회차 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Round Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">새 입력 회차 생성</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
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
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
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
