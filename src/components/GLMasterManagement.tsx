import React, { useState, useRef } from 'react';
import { GLMasterItem } from '../types';
import { Plus, Trash2, Edit2, Search, X, FileSpreadsheet, Upload, BookOpen } from 'lucide-react';
import * as XLSX from 'xlsx';

interface GLMasterManagementProps {
  glMasterItems: GLMasterItem[];
  onAddGLMasterItem: (item: Omit<GLMasterItem, 'id'>) => void;
  onUpdateGLMasterItem: (item: GLMasterItem) => void;
  onDeleteGLMasterItem: (id: string) => void;
}

export const GLMasterManagement: React.FC<GLMasterManagementProps> = ({
  glMasterItems,
  onAddGLMasterItem,
  onUpdateGLMasterItem,
  onDeleteGLMasterItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GLMasterItem | null>(null);

  const [glCode, setGlCode] = useState('');
  const [glName, setGlName] = useState('');

  const handleOpenAdd = () => {
    setEditingItem(null);
    setGlCode('');
    setGlName('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: GLMasterItem) => {
    setEditingItem(item);
    setGlCode(item.glCode);
    setGlName(item.glName);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!glCode || !glName) {
      alert('GL계정과 GL계정명을 모두 입력해주세요.');
      return;
    }

    if (editingItem) {
      onUpdateGLMasterItem({
        ...editingItem,
        glCode,
        glName,
      });
    } else {
      onAddGLMasterItem({
        glCode,
        glName,
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
          const code = String(row['GL계정'] || row['glCode'] || row['GL코드'] || '');
          const name = String(row['GL계정명'] || row['glName'] || '');

          if (code && name) {
            onAddGLMasterItem({
              glCode: code,
              glName: name,
            });
            addedCount++;
          }
        });
        alert(`총 ${addedCount}건의 GL계정 마스터 데이터가 성공적으로 업로드되었습니다.`);
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
      { GL계정: '51101000', GL계정명: '급여' },
      { GL계정: '51102000', GL계정명: '복리후생비' },
      { GL계정: '52201000', GL계정명: '소모품비' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GL계정마스터양식');
    XLSX.writeFile(wb, 'GL계정_마스터_등록_양식.xlsx');
  };

  const filteredItems = glMasterItems.filter((item) => {
    const matchesSearch =
      (item.glCode || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (item.glName || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#0F2D59] text-white tracking-wide">
              MASTER DATA
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">GL계정 및 계정명 마스터 관리</h2>
          <p className="text-sm text-slate-500">
            사내 회계 기준 GL계정번호와 GL계정명을 관리합니다. 마스터 항목 등록 시 자동으로 연동됩니다.
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
            GL계정 추가
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="GL계정번호 또는 GL계정명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          등록된 GL계정: <span className="font-bold text-[#0F2D59]">{glMasterItems.length}</span>건
        </div>
      </div>

      {/* GL Master Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-6 w-24">번호</th>
                <th className="py-3 px-6">GL계정 (코드)</th>
                <th className="py-3 px-6">GL계정명</th>
                <th className="py-3 px-6 text-center w-32">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    등록된 GL계정 마스터 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-6 font-mono text-xs text-slate-500">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3 px-6 font-mono font-bold text-slate-900 flex items-center space-x-2">
                      <BookOpen className="w-4 h-4 text-[#0F2D59]" />
                      <span>{item.glCode}</span>
                    </td>
                    <td className="py-3 px-6 font-bold text-slate-800 text-base">{item.glName}</td>
                    <td className="py-3 px-6 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                          title="수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`GL계정 "${item.glCode} (${item.glName})" 항목을 삭제하시겠습니까?`)) {
                              onDeleteGLMasterItem(item.id);
                            }
                          }}
                          className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors"
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
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {editingItem ? 'GL계정 마스터 수정' : '새 GL계정 마스터 등록'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GL계정 (코드)</label>
                <input
                  type="text"
                  placeholder="예: 51101000"
                  value={glCode}
                  onChange={(e) => setGlCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0F2D59] focus:bg-white"
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
