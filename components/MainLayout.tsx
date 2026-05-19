import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import LessonView from './LessonView';
import Vocabulary from './Vocabulary';
import AdminDashboard from './AdminDashboard';
import SyllabusView from './SyllabusView';
import { LibraryView } from './LibraryView';
import { ResearchView } from './ResearchView';
import { SectionId, UserProgress, VocabularyWord, Message } from '../types';
import { createInitialDetailedProgress } from '../constants';
import Toast from './Toast';
import { saveProgressToFirebase } from '../services/firebase';

import { Menu, X, Loader2 } from 'lucide-react';

interface MainLayoutProps {
  initialProgress: UserProgress;
  onBackToUpload: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ initialProgress, onBackToUpload }) => {
  const [progress, setProgress] = useState<UserProgress>(initialProgress);
  const [currentSection, setCurrentSection] = useState<SectionId>(initialProgress.currentSection || SectionId.LIBRARY);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default false for mobile
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Auto-set sidebar open on desktop
  useEffect(() => {
    if (window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  // Sync to Firebase whenever progress changes
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    if (progress.uid) {
      setIsSaving(true);
      saveProgressToFirebase(progress.uid, progress)
        .catch(err => console.error("Auto-save failed:", err))
        .finally(() => {
            // Delay clear to avoid flicker
            setTimeout(() => setIsSaving(false), 800);
        });
    }
  }, [progress]);

  const handleUpdateProgress = (updates: Partial<UserProgress>) => {
    setProgress(prev => ({ ...prev, ...updates }));
  };

  const handleSaveWord = (word: VocabularyWord) => {
    const exists = progress.vocabulary?.some(w => w.word === word.word);
    if (!exists) {
        const newVocab = [...(progress.vocabulary || []), word];
        handleUpdateProgress({ vocabulary: newVocab });
        setToast({ message: `Đã lưu từ "${word.word}"`, type: 'success' });
    }
  };

  const handleUpdateWord = (updatedWord: VocabularyWord) => {
    const newVocab = progress.vocabulary?.map(w => w.word === updatedWord.word ? updatedWord : w) || [];
    handleUpdateProgress({ vocabulary: newVocab });
  };

  const handleDeleteWord = (wordStr: string) => {
    const newVocab = progress.vocabulary?.filter(w => w.word !== wordStr) || [];
    handleUpdateProgress({ vocabulary: newVocab });
  };

  const handleDeleteMaterial = (id: string) => {
    const updated = (progress.uploadedMaterials || []).filter(m => m.id !== id);
    handleUpdateProgress({ uploadedMaterials: updated });
    if (progress.currentMaterialId === id) {
      handleUpdateProgress({ currentMaterialId: updated[0]?.id || '' });
    }
  };

  const handleSelectMaterial = (id: string) => {
    const mat = progress.uploadedMaterials.find(m => m.id === id);
    if (mat) {
      const targetSection = progress.appMode === 'PRACTICE_EXAM' ? SectionId.TESTS : SectionId.RESEARCH;
      handleUpdateProgress({ 
        currentMaterialId: id,
        documentContent: mat.content,
        currentSection: targetSection
      });
      setCurrentSection(targetSection);
      setToast({ message: `Đang tải: ${mat.bookName} - ${mat.unit}`, type: 'success' });
    }
  };

  const renderContent = () => {
    switch (currentSection) {
      case SectionId.LIBRARY:
        return (
          <LibraryView 
            materials={progress.uploadedMaterials || []} 
            onSelectMaterial={handleSelectMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onAddNew={onBackToUpload}
          />
        );
      case SectionId.RESEARCH:
      case SectionId.VOCABULARY:
      case SectionId.GRAMMAR:
      case SectionId.READING:
      case SectionId.LISTENING:
      case SectionId.WRITING:
      case SectionId.SPEAKING:
        const currentMat = progress.uploadedMaterials?.find(m => m.id === progress.currentMaterialId) || progress.uploadedMaterials?.[0];
        if (!currentMat) return (
             <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                 <Loader2 className="animate-spin text-teal-600 mb-4" />
                 <p className="text-slate-500">Mời em chọn một giáo trình trong thư viện để bắt đầu nghiên cứu nhé!</p>
                 <button onClick={() => setCurrentSection(SectionId.LIBRARY)} className="mt-4 text-teal-600 font-bold hover:underline">Vào Thư viện</button>
             </div>
        );
        return (
          <ResearchView 
            material={currentMat}
            currentSection={currentSection}
            messages={progress.messages || []}
            addMessage={(msg) => {
                const newMessages = [...(progress.messages || []), msg];
                handleUpdateProgress({ messages: newMessages });
            }}
            setMessages={(msgs) => handleUpdateProgress({ messages: msgs as Message[] })}
            savedVocabulary={progress.vocabulary || []}
            onSaveWord={(wordData) => handleSaveWord(wordData as VocabularyWord)}
            onSaveCollocation={(p, c) => console.log("Save col", p, c)}
            onHintRequest={() => handleUpdateProgress({ hintUsageCount: (progress.hintUsageCount || 0) + 1 })}
            onLessonComplete={() => {}}
            onBackToSyllabus={() => setCurrentSection(SectionId.LIBRARY)}
            setToastMessage={(toastObj) => setToast(toastObj as any)}
            onRestart={() => handleUpdateProgress({ messages: [] })}
          />
        );
      case SectionId.MY_VOCABULARY:
        return <Vocabulary words={progress.vocabulary || []} onUpdateWord={handleUpdateWord} onDelete={handleDeleteWord} />;
      case SectionId.ADMIN:
        return <AdminDashboard />;
      default:
        return <LibraryView 
          materials={progress.uploadedMaterials || []} 
          onSelectMaterial={handleSelectMaterial}
          onDeleteMaterial={handleDeleteMaterial}
          onAddNew={onBackToUpload}
        />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden relative">
      {/* Mobile Toggle Button */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-slate-900 border border-slate-800 text-white rounded-lg shadow-lg hover:bg-slate-800 transition-colors"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar 
        currentSection={currentSection} 
        setSection={(sec) => {
          setCurrentSection(sec);
          handleUpdateProgress({ currentSection: sec });
        }} 
        isOpen={isSidebarOpen} 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        words={progress.vocabulary || []}
        isDiagnosed={progress.diagnosedLevel !== 'Undiagnosed'}
        onLogout={() => window.location.reload()}
        isTeacher={progress.isAdmin}
        onBackToUpload={onBackToUpload}
        currentMaterial={progress.uploadedMaterials?.find(m => m.id === progress.currentMaterialId)}
      />
      
      {isSaving && (
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-slate-700 shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
            <Loader2 size={12} className="animate-spin text-teal-400" />
            Đang đồng bộ...
        </div>
      )}
      
      <main className="flex-1 relative overflow-hidden flex flex-col lg:pl-64">
        {renderContent()}
      </main>

      <Toast 
        toast={toast} 
        onClose={() => setToast(null)} 
      />
    </div>
  );
};

export default MainLayout;
