import React, { useState, useRef } from 'react';
import { Department, MasterItem } from '../types';
import { DEPARTMENTS } from '../initialData';
import { Plus, Trash2, Edit2, Search, X, FileSpreadsheet, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface MasterManagementProps {
  masterItems: MasterItem[];
  onAddMasterItem: (item: Omit<MasterItem, 'id'>) => void;
  onUpdateMasterItem: (item: MasterItem) => void;
  onDeleteMasterItem: (id: string) => void;
}

export const MasterManagement: React.FC<MasterManagementProps> = ({
  masterItems,
  onAddMasterItem,
  onUpdateMasterItem,
  onDeleteMasterItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);

  const [glCode, setGlCode] = useState('');
  const [glName, setGlName] = useState('');
  const [subItem, setSubItem] = useState('');
  const [attribution, setAttribution] = useState<'공통' | 'MTBE4' | 'P3'>('공통');
  const [dept, setDept] = useState<Department>('노경');
  const [manager, setManager] = useState('');

  const handleOpenAdd = () => {
    setEditingItem(null);
    setGlCode('');
    setGlName('');
    setSubItem('');
    setAttribution('공통');
    setDept('노경');
    setManager('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: MasterItem) => {
    setEditingItem(item);
    setGlCode(item.glCode);
    setGlName(item.glName);
    setSubItem(item.subItem);
    setAttribution(item.attribution);
    setDept(item.dept);
    setManager(item.manager);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!glCode || !glName || !subItem || !attribution || !manager) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    if (editingItem) {
      onUpdateMasterItem({
        ...editingItem,
        glCode,
        glName,
        subItem,
        attribution,
        dept,
        manager,
      });
    } else {
      onAddMasterItem({
        glCode,
        glName,
        subItem,
        attribution,
        dept,
        manager,
      });
    }
    setIsModalOpen(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        let addedCount = 0;
        data.forEach((row) => {
          const glCode = String(row['GL계정'] || row['glCode'] || '');
          const glName = String(row['GL계정명'] || row['glName'] || '');
          const subItem = String(row['세목'] || row['subItem'] || '');
          let attribution = String(row['귀속'] || row['attribution'] || '공통') as any;
          if (!['공통', 'MTBE4', 'P3'].includes(attribution)) attribution = '공통';
          const dept = String(row['주관부서'] || row['dept'] || '노경') as Department;
          const manager = String(row['담당자'] || row['manager'] || '담당자');

          if (glCode && subItem) {
            onAddMasterItem({
              glCode,
              glName,
              subItem,
              attribution,
              dept: DEPARTMENTS.includes(dept) ? dept : '노경',
              manager,
            });
            addedCount++;
          }
        });
        alert(`총 ${addedCount}건의 마스터 데이터가 성공적으로 업로드되었습니다.`);
      } catch (err) {
        console.error(err);
        alert('엑셀 파일 읽기 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { GL계정: '51101000', GL계정명: '급여', 세목: '기본급 및 수당', 귀속: '공통', 주관부서: '노경', 담당자: '홍길동' },
      { GL계정: '52201000', GL계정명: '소모품비', 세목: '보호구 및 안전용품', 귀속: 'MTBE4', 주관부서: '환경안전', 담당자: '김철수' },
      { GL계정: '53301000', GL계정명: '지급수수료', 세목: '보안 S/W 라이선스', 귀속: '공통', 주관부서: 'IT보안팀', 담당자: '박민수' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '마스터등록양식');
    XLSX.writeFile(wb, '마스터_등록_양식.xlsx');
  };

  const filteredItems = masterItems.filter((item) => {
    const matchesSearch =
      (item.glCode || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (item.glName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (item.subItem || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (item.attribution || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (item.manager || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesDept = selectedDept === 'all' || item.dept === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">마스터 데이터 사전 등록 및 관리</h2>
          <p className="text-sm text-slate-500">
            사용자들이 데이터를 입력하기 전, GL계정, GL계정명, 세목~담당자 조합의 마스터 키 항목을 사전에 설정합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium text-xs hover:bg-slate-50 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
            엑셀 양식 다운로드
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 shadow-xs transition-colors"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            엑셀 업로드
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#0F2D59] text-white font-medium text-xs hover:bg-[#1B365D] shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            마스터 항목 추가
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="GL계정, 계정명, 세목, 귀속, 담당자 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">주관부서:</span>
          <button
            onClick={() => setSelectedDept('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedDept === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체 ({masterItems.length})
          </button>
          {DEPARTMENTS.map((d) => {
            const count = masterItems.filter((i) => i.dept === d).length;
            return (
              <button
                key={d}
                onClick={() => setSelectedDept(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedDept === d
                    ? 'bg-[#0F2D59] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Master Items Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">고유 KEY 번호</th>
                <th className="py-3 px-4">GL계정</th>
                <th className="py-3 px-4">GL계정명</th>
                <th className="py-3 px-4">세목</th>
                <th className="py-3 px-4">귀속</th>
                <th className="py-3 px-4">주관부서</th>
                <th className="py-3 px-4">담당자</th>
                <th className="py-3 px-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    등록된 마스터 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">
                      KEY-{String(index + 1).padStart(3, '0')}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">{item.glCode}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{item.glName}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{item.subItem}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {item.attribution}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-[#0F2D59]">
                        {item.dept}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{item.manager}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                          title="수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`"${item.subItem}" (${item.glCode}) 마스터 항목을 삭제하시겠습니까?`)) {
                              onDeleteMasterItem(item.id);
                            }
                          }}
                          className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {editingItem ? '마스터 항목 수정' : '새 마스터 항목 등록'}
              </h3>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GL계정 (코드)</label>
                  <input
                    type="text"
                    placeholder="예: 51101000"
                    value={glCode}
                    onChange={(e) => setGlCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GL계정명</label>
                  <input
                    type="text"
                    placeholder="예: 급여"
                    value={glName}
                    onChange={(e) => setGlName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">세목</label>
                <input
                  type="text"
                  placeholder="예: 기본급 및 수당"
                  value={subItem}
                  onChange={(e) => setSubItem(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">귀속</label>
                <select
                  value={attribution}
                  onChange={(e) => setAttribution(e.target.value as '공통' | 'MTBE4' | 'P3')}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white"
                >
                  <option value="공통">공통</option>
                  <option value="MTBE4">MTBE4</option>
                  <option value="P3">P3</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">주관부서</label>
                  <select
                    value={dept}
                    onChange={(e) => setDept(e.target.value as Department)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">담당자</label>
                  <input
                    type="text"
                    placeholder="예: 홍길동"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white"
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
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[#0F2D59] text-white hover:bg-[#1B365D] transition-colors shadow-sm"
                >
                  {editingItem ? '수정 완료' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
