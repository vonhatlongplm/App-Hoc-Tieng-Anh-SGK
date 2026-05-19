
// Import React to resolve 'Cannot find namespace React' errors.
import React from 'react';
import { Section, VocabularyWord } from '../types';
import { Map, BookText, Library, Headphones, Mic, Book, PenTool, Star, Bell, LogOut, Shield, History, ClipboardCheck, MessageSquareWarning, Trophy, Volume2, BookOpen, X } from 'lucide-react';

interface SidebarProps {
  currentSection: Section;
  setSection: (s: Section) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  words: VocabularyWord[];
  isDiagnosed: boolean;
  onLogout: () => void;
  isTeacher: boolean;
  onBackToUpload?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentSection, setSection, isOpen, toggleSidebar, words, isDiagnosed, onLogout, isTeacher, onBackToUpload }) => {
  const hasBacklog = words.some(w => w.isBacklogged);
  
  const baseMenuItems = [
    { id: Section.ROADMAP, icon: Map, label: Section.ROADMAP },
    { id: Section.TESTS, icon: ClipboardCheck, label: Section.TESTS },
    { id: Section.VOCABULARY, icon: Library, label: Section.VOCABULARY },
    { id: Section.GRAMMAR, icon: BookText, label: Section.GRAMMAR },
    { id: Section.LISTENING, icon: Headphones, label: Section.LISTENING },
    { id: Section.READING, icon: Book, label: Section.READING },
    { id: Section.WRITING, icon: PenTool, label: Section.WRITING },
    { id: Section.SPEAKING, icon: Mic, label: Section.SPEAKING },
    { id: Section.PHONICS, icon: Volume2, label: Section.PHONICS },
    { id: Section.MY_VOCABULARY, icon: Star, label: Section.MY_VOCABULARY, notification: hasBacklog },
    { id: Section.ERROR_LOG, icon: MessageSquareWarning, label: Section.ERROR_LOG },
    { id: Section.LEADERBOARD, icon: Trophy, label: Section.LEADERBOARD },
    { id: Section.MY_HISTORY, icon: History, label: Section.MY_HISTORY }
  ];

  const teacherMenuItem = { id: Section.ADMIN, icon: Shield, label: Section.ADMIN };
  
  let menuItems: Array<{id: Section; icon: React.ElementType; label: string; notification?: boolean;}>;

  if (isTeacher) {
    menuItems = baseMenuItems.filter(item => ![Section.MY_HISTORY, Section.TESTS, Section.ERROR_LOG].includes(item.id));
    menuItems.push(teacherMenuItem);
  } else {
    menuItems = baseMenuItems;
  }

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
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          return (
            <button
              key={item.id}
              onClick={() => {
                  setSection(item.id);
                  if(isOpen && window.innerWidth < 768) toggleSidebar();
              }}
              className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                currentSection === item.id 
                  ? 'bg-teal-700 text-white shadow-lg translate-x-1' 
                  : 'text-teal-100 hover:bg-teal-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={18} />
                <span className="font-medium text-sm text-left">{item.label}</span>
              </div>
              {item.notification && (
                <div className="relative">
                  <Bell size={14} className="text-amber-300" />
                  <span className="absolute -top-1 -right-1 block w-1.5 h-1.5 rounded-full bg-red-500 ring-1 ring-teal-700"></span>
                </div>
              )}
            </button>
          )
        })}

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
