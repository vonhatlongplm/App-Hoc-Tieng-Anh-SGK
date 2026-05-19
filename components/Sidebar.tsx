
// Import React to resolve 'Cannot find namespace React' errors.
import React from 'react';
import { SectionId, VocabularyWord, TextbookMetadata } from '../types';
import { Library, BookText, Headphones, Mic, Book, PenTool, Star, Bell, LogOut, Shield, History, ClipboardCheck, MessageSquareWarning, Trophy, Volume2, BookOpen, X, Sword, ChevronRight } from 'lucide-react';

interface SidebarProps {
  currentSection: SectionId;
  setSection: (s: SectionId) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  words: VocabularyWord[];
  isDiagnosed: boolean;
  onLogout: () => void;
  isTeacher: boolean;
  onBackToUpload?: () => void;
  currentMaterial?: TextbookMetadata;
}

const Sidebar: React.FC<SidebarProps> = ({ currentSection, setSection, isOpen, toggleSidebar, words = [], isDiagnosed, onLogout, isTeacher, onBackToUpload, currentMaterial }) => {
  const hasBacklog = (words || []).some(w => w.isBacklogged);
  
  const baseMenuItems = [
    { id: SectionId.LIBRARY, icon: Library, label: 'Thư viện giáo trình' },
    { id: SectionId.RESEARCH, icon: BookOpen, label: 'Phòng nghiên cứu' },
  ];

  const unitMenuItems = [
    { id: SectionId.VOCABULARY, icon: BookText, label: 'Từ vựng Unit' },
    { id: SectionId.GRAMMAR, icon: Sword, label: 'Ngữ pháp Unit' },
    { id: SectionId.READING, icon: Book, label: 'Bài đọc Unit' },
    { id: SectionId.LISTENING, icon: Headphones, label: 'Bài nghe Unit' },
    { id: SectionId.WRITING, icon: PenTool, label: 'Bài viết Unit' },
    { id: SectionId.SPEAKING, icon: Mic, label: 'Luyện nói Unit' },
  ];

  const extraMenuItems = [
    { id: SectionId.TESTS, icon: ClipboardCheck, label: 'Luyện đề thi (Unit)' },
    { id: SectionId.MY_VOCABULARY, icon: Star, label: 'Tháp từ vựng', notification: hasBacklog },
    { id: SectionId.ERROR_LOG, icon: MessageSquareWarning, label: 'Nhật ký lỗi' },
    { id: SectionId.LEADERBOARD, icon: Trophy, label: 'Bảng xếp hạng' },
    { id: SectionId.MY_HISTORY, icon: History, label: 'Lịch sử học' }
  ];

  const teacherMenuItem = { id: SectionId.ADMIN, icon: Shield, label: 'Quản trị' };
  
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out shadow-2xl border-r border-slate-800`}>
      <div className="p-6 border-b border-slate-800 bg-slate-950/20 relative">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <span className="text-teal-400">Omni</span>English
        </h1>
        <p className="text-[10px] text-slate-500 mt-1.5 uppercase tracking-widest font-bold">AI Tutor Ecosystem</p>
        
        {/* Mobile close button */}
        <button 
          onClick={toggleSidebar}
          className="lg:hidden absolute top-6 right-4 text-slate-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>
      
      <nav className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
        {/* Library Section */}
        <div>
           <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Thư viện của em</p>
           {baseMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                  setSection(item.id);
                  if(isOpen && window.innerWidth < 768) toggleSidebar();
              }}
              className={`w-full flex items-center justify-between gap-3 px-4 py-2 rounded-lg transition-all duration-200 mb-1 ${
                currentSection === item.id 
                  ? 'bg-teal-700 text-white shadow-lg' 
                  : 'text-teal-100 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={18} />
                <span className="font-bold text-sm text-left">{item.label}</span>
              </div>
            </button>
           ))}
        </div>

        {/* Dynamic Unit Section */}
        {currentMaterial && (
          <div className="animate-in slide-in-from-left duration-500">
             <p className="px-4 text-[10px] font-black text-teal-500 uppercase tracking-widest mb-2 flex items-center gap-2">
               <ChevronRight size={10} /> Nội dung {currentMaterial.unit}
             </p>
             <div className="bg-slate-800/30 rounded-xl p-1.5 border border-slate-800/50">
               {unitMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                        setSection(item.id);
                        if(isOpen && window.innerWidth < 768) toggleSidebar();
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-all duration-200 mb-1 ${
                      currentSection === item.id 
                        ? 'bg-teal-500 text-white' 
                        : 'text-slate-400 hover:text-teal-400 hover:bg-teal-400/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={16} />
                      <span className="font-medium text-xs text-left">{item.label}</span>
                    </div>
                  </button>
               ))}
               <button
                  onClick={() => setSection(SectionId.TESTS)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-all duration-200 mt-2 border border-dashed ${
                    currentSection === SectionId.TESTS 
                      ? 'border-indigo-400 bg-indigo-400/10 text-indigo-400' 
                      : 'border-slate-700 text-slate-500 hover:border-indigo-400 hover:text-indigo-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ClipboardCheck size={16} />
                    <span className="font-black text-[10px] uppercase tracking-wider text-left">Luyện giải đề</span>
                  </div>
                </button>
             </div>
          </div>
        )}

        {/* Learning History & stats */}
        <div>
           <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Hồ sơ & Cộng đồng</p>
           {extraMenuItems.filter(i => i.id !== SectionId.TESTS).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                  setSection(item.id);
                  if(isOpen && window.innerWidth < 768) toggleSidebar();
              }}
              className={`w-full flex items-center justify-between gap-3 px-4 py-2 rounded-lg transition-all duration-200 mb-1 ${
                currentSection === item.id 
                  ? 'bg-teal-700 text-white shadow-lg' 
                  : 'text-teal-100/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={18} />
                <span className="font-bold text-sm text-left">{item.label}</span>
              </div>
              {item.notification && (
                <div className="relative">
                  <Bell size={14} className="text-amber-300" />
                  <span className="absolute -top-1 -right-1 block w-1.5 h-1.5 rounded-full bg-red-500 ring-1 ring-teal-700"></span>
                </div>
              )}
            </button>
           ))}
           {isTeacher && (
             <button
              onClick={() => setSection(SectionId.ADMIN)}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 ${
                currentSection === SectionId.ADMIN 
                  ? 'bg-teal-700 text-white shadow-lg' 
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Shield size={18} />
              <span className="font-bold text-sm">Quản trị</span>
            </button>
           )}
        </div>

        {/* Separator and Logout Button Integrated into Scroll */}
        <div className="pt-4 mt-4 border-t border-slate-800/50 space-y-1">
          {onBackToUpload && (
            <button
                onClick={onBackToUpload}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-300 hover:bg-teal-500/10 hover:text-teal-400 transition-all duration-200 group"
            >
                <BookOpen size={18} className="group-hover:scale-110 transition-transform" />
                <span className="font-bold text-sm">Đổi tài liệu học</span>
            </button>
          )}
          
          <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group"
          >
              <LogOut size={18} className="group-hover:rotate-12 transition-transform" />
              <span className="font-bold text-sm">Đăng xuất</span>
          </button>
        </div>
      </nav>
      
      <div className="px-6 py-4 bg-teal-950/30 text-[10px] text-teal-500 uppercase tracking-widest font-bold">
          v2.5 • AI-Native Experience
      </div>
    </aside>
  );
};

export default Sidebar;
