
import React, { useState } from 'react';
import { CorrectionEntry, Section } from '../types';
import { MessageSquareWarning, Search, Filter, Trash2, Calendar, BookOpen } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface ErrorLogProps {
  logs: CorrectionEntry[];
  onDelete: (id: string) => void;
}

const ErrorLog: React.FC<ErrorLogProps> = ({ logs, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState<Section | 'All'>('All');

  const filteredLogs = logs.filter(log => {
    const upgradedText = typeof log.upgraded === 'string' ? log.upgraded : '';
    const matchesSearch = log.original.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          upgradedText.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSection = selectedSection === 'All' || 
                           (typeof log.section === 'string' ? log.section === selectedSection : (log.section as any) === selectedSection);
    return matchesSearch && matchesSection;
  });

  const sections = Array.from(new Set(logs.map(log => typeof log.section === 'string' ? log.section : (log.section as any)))).filter(Boolean);

  return (
    <div className="p-0 md:p-6 space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto">
      <header className="mb-8 px-6 md:px-0">
        <h2 className="text-3xl font-bold text-slate-800 serif flex items-center gap-3">
          <MessageSquareWarning className="text-teal-600" />
          Sổ tay Sửa lỗi
        </h2>
        <p className="text-slate-500 mt-2">Nơi lưu lại các câu trả lời đã được AI nâng cấp lên trình độ B2/C.</p>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sticky top-0 z-10 mx-6 md:mx-0">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm nội dung lỗi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-500" />
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="All">Tất cả kỹ năng</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-6 md:px-0 pb-10">
        {filteredLogs.length > 0 ? (
          filteredLogs.slice().sort((a,b) => b.timestamp - a.timestamp).map(log => (
            <div key={log.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded">{log.section}</span>
                  <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(log.timestamp).toLocaleDateString('vi-VN')}</span>
                </div>
                <button onClick={() => onDelete(log.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1"><Trash2 size={16}/></button>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-red-600 uppercase">Câu của bạn (B1)</h4>
                  <div className="p-3 bg-red-50/50 rounded-lg text-sm text-slate-700 border border-red-100 italic">
                    {log.original}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-green-700 uppercase">Nâng cấp B2/C</h4>
                  <div className="p-3 bg-green-50/50 rounded-lg text-sm text-slate-800 border border-green-100 font-medium">
                    {log.upgraded}
                  </div>
                </div>
              </div>
              <div className="p-4 pt-0">
                <div className="p-3 bg-blue-50/30 rounded-lg border border-blue-100/50 text-sm">
                   <h4 className="text-xs font-bold text-blue-700 uppercase mb-2 flex items-center gap-1"><BookOpen size={12}/> Giải thích của giáo viên</h4>
                   <MarkdownRenderer text={log.explanation} />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
            <MessageSquareWarning className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 font-medium">Chưa có bản ghi sửa lỗi nào khớp với tìm kiếm.</p>
            <p className="text-sm text-slate-400">Hãy tiếp tục học, AI sẽ tự động lưu các gợi ý sửa lỗi vào đây.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorLog;
