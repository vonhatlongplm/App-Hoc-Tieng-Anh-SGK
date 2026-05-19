import React from 'react';
import { Book, Trash2, Search, Clock, ExternalLink } from 'lucide-react';
import { TextbookMetadata, SectionId } from '../types';

interface LibraryViewProps {
  materials: TextbookMetadata[];
  onSelectMaterial: (id: string) => void;
  onDeleteMaterial: (id: string) => void;
  onAddNew: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ materials, onSelectMaterial, onDeleteMaterial, onAddNew }) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredMaterials = materials.filter(m => 
    m.bookName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.unit.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => b.uploadDate - a.uploadDate);

  // Group by Grade and then Book
  const grouped: Record<string, Record<string, TextbookMetadata[]>> = {};
  filteredMaterials.forEach(m => {
    const grade = m.grade || 'Khác';
    if (!grouped[grade]) grouped[grade] = {};
    if (!grouped[grade][m.bookName]) grouped[grade][m.bookName] = [];
    grouped[grade][m.bookName].push(m);
  });

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 serif">Thư viện giáo trình</h2>
          <p className="text-slate-500 mt-2">Nghiên cứu và tra cứu kiến thức từ các tài liệu bạn đã tải lên.</p>
        </div>
        <button 
          onClick={onAddNew}
          className="bg-teal-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-teal-700 transition shadow-lg shadow-teal-600/20 flex items-center gap-2 w-fit"
        >
          Tải thêm giáo trình
        </button>
      </header>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text"
          placeholder="Tìm kiếm sách, lớp, unit..."
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none shadow-sm transition"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
          <Book className="w-16 h-16 text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">Bạn chưa tải lên giáo trình nào.</p>
          <button onClick={onAddNew} className="mt-4 text-teal-600 font-bold hover:underline">Bắt đầu tải lên ngay</button>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(grouped).sort().map(([grade, books]) => (
            <div key={grade} className="space-y-4">
              <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest px-2">{grade}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(books).map(([bookName, units]) => (
                  <div key={bookName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-50 bg-slate-50/50">
                      <div className="flex items-center gap-3 mb-1">
                        <Book className="w-5 h-5 text-teal-600" />
                        <h4 className="font-bold text-slate-800 truncate">{bookName}</h4>
                      </div>
                      <p className="text-xs text-slate-500">{units.length} Unit có sẵn</p>
                    </div>
                    <div className="p-2 flex-1">
                      {units.map(unit => (
                        <div 
                          key={unit.id}
                          className="group flex items-center justify-between p-3 hover:bg-teal-50 rounded-xl transition cursor-pointer"
                          onClick={() => onSelectMaterial(unit.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:text-teal-600 group-hover:border-teal-200 transition">
                              {unit.unit.match(/\d+/)?.[0] || 'U'}
                            </div>
                            <span className="text-sm font-medium text-slate-700 group-hover:text-teal-700">{unit.unit}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button 
                              onClick={(e) => { e.stopPropagation(); onDeleteMaterial(unit.id); }}
                              className="p-1.5 text-slate-400 hover:text-red-500 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ExternalLink className="w-4 h-4 text-teal-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
