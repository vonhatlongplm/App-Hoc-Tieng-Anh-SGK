import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import LessonView from './LessonView';
import Vocabulary from './Vocabulary';
import AdminDashboard from './AdminDashboard';
import SyllabusView from './SyllabusView';
import { SectionId, UserProgress, VocabularyWord, Message } from '../types';
import { createInitialDetailedProgress } from '../constants';
import Toast from './Toast';
import { saveProgressToFirebase } from '../services/firebase';

interface MainLayoutProps {
  initialProgress: UserProgress;
}

const MainLayout: React.FC<MainLayoutProps> = ({ initialProgress }) => {
  const [progress, setProgress] = useState<UserProgress>(initialProgress);
  const [currentSection, setCurrentSection] = useState<SectionId>(SectionId.ROADMAP);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Sync to Firebase whenever progress changes
  useEffect(() => {
    if (progress.uid) {
      saveProgressToFirebase(progress.uid, progress);
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

  const renderContent = () => {
    switch (currentSection) {
      case SectionId.ROADMAP:
        return <Dashboard progress={progress} onStartLesson={(section) => setCurrentSection(section)} />;
      case SectionId.MY_VOCABULARY:
        return <Vocabulary words={progress.vocabulary || []} onUpdateWord={handleUpdateWord} />;
      case SectionId.ADMIN:
        return <AdminDashboard />;
      case SectionId.GRAMMAR:
      case SectionId.VOCAB:
      case SectionId.LISTENING:
      case SectionId.READING:
      case SectionId.WRITING:
      case SectionId.SPEAKING:
        // For simplicity, if we don't have a specific lesson selected, show syllabus
        // In a real app we'd have a nested state for lesson number
        return (
          <LessonView 
            section={currentSection}
            lessonNumber={1}
            lessonTitle="Bài học trọng tâm"
            messages={progress.messages || []}
            addMessage={(msg) => {
                const newMessages = [...(progress.messages || []), msg];
                handleUpdateProgress({ messages: newMessages });
            }}
            setMessages={(msgs) => handleUpdateProgress({ messages: msgs as Message[] })}
            savedVocabulary={progress.vocabulary || []}
            onSaveWord={handleSaveWord}
            onSaveCollocation={(c) => console.log("Save col", c)}
            onHintRequest={() => handleUpdateProgress({ hintUsageCount: (progress.hintUsageCount || 0) + 1 })}
            onLessonComplete={() => {}}
            onBackToSyllabus={() => setCurrentSection(SectionId.ROADMAP)}
            setToastMessage={(msg) => setToast({ message: msg, type: 'success' })}
            onRestart={() => handleUpdateProgress({ messages: [] })}
          />
        );
      default:
        return <Dashboard progress={progress} onStartLesson={(section) => setCurrentSection(section)} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <Sidebar 
        currentSection={currentSection} 
        setSection={setCurrentSection} 
        isOpen={isSidebarOpen} 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        words={progress.vocabulary || []}
        isDiagnosed={progress.diagnosedLevel !== 'Undiagnosed'}
        onLogout={() => window.location.reload()}
        isTeacher={progress.isAdmin}
      />
      
      <main className="flex-1 relative overflow-hidden flex flex-col">
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
