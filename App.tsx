
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Login } from './components/Login';
import MainLayout from './components/MainLayout';
import { UploadDocument } from './components/UploadDocument';
import { loadProgressFromFirebase, clearProgressFromFirebase, saveProgressToFirebase, db } from './services/firebase';
import { doc, getDocFromServer } from 'firebase/firestore';
import { UserProgress, SectionId, AppMode } from './types';
import { createInitialDetailedProgress } from './constants';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'LOGIN' | 'RESUME_PROMPT' | 'UPLOAD' | 'MAIN'>('LOGIN');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<UserProgress | null>(null);

  const createDefaultProgress = (user: any): UserProgress => ({
    uid: user.uid,
    email: user.email,
    name: user.name,
    diagnosedLevel: 'Undiagnosed',
    completedLessons: 0,
    totalLessons: 180,
    scores: {
        'Vocabulary': 0,
        'Grammar': 0,
        'Reading': 0,
        'Listening': 0,
        'Speaking': 0,
        'Writing': 0
    },
    estimatedTimeToB2: '6 tháng',
    detailedProgress: createInitialDetailedProgress(),
    vocabulary: [],
    messages: [],
    uploadedMaterials: [],
    appMode: 'LEARN_BOOK',
    documentContent: '',
    updatedAt: Date.now()
  });

  const sanitizeProgress = (prog: any): UserProgress => {
    if (!prog) return prog;
    const getSafeMastery = (level: any) => {
      const num = typeof level === 'number' ? level : parseInt(level, 10);
      return isNaN(num) ? 0 : num;
    };
    return {
      ...prog,
      vocabulary: (prog.vocabulary || []).map((w: any) => ({
        ...w,
        masteryLevel: getSafeMastery(w.masteryLevel),
        collocations: w.collocations?.map((c: any) => ({
          ...c,
          masteryLevel: getSafeMastery(c.masteryLevel)
        })) || []
      }))
    };
  };

  const handleLogin = async (user: any) => {
    setCurrentUser(user);
    setIsSyncing(true);
    try {
      // Force loading from server to avoid stale cache issues
      const progressRef = doc(db, 'progress', user.uid);
      const snap = await getDocFromServer(progressRef).catch(() => null);
      const saved = snap?.exists() ? snap.data() as any : null;
      
      const defaultProg = createDefaultProgress(user);
      
      if (saved && saved.uid) {
        // Merge saved data with defaults
        const mergedProgress: UserProgress = {
          ...defaultProg,
          ...saved,
          scores: { ...defaultProg.scores, ...(saved.scores || {}) },
          detailedProgress: { ...defaultProg.detailedProgress, ...(saved.detailedProgress || {}) },
          vocabulary: saved.vocabulary || [],
          uploadedMaterials: saved.uploadedMaterials || [],
          currentMaterialId: saved.currentMaterialId || '',
          messages: saved.messages || []
        };
        
        setProgress(sanitizeProgress(mergedProgress));
        
        if (saved.documentContent || (saved.uploadedMaterials && saved.uploadedMaterials.length > 0)) {
          setCurrentScreen('RESUME_PROMPT');
        } else {
          setCurrentScreen('UPLOAD');
        }
      } else {
        setProgress(defaultProg);
        setCurrentScreen('UPLOAD');
      }
    } catch (e) {
      console.error("Failed to load progress from server, attempting fallback", e);
      const savedFallback = await loadProgressFromFirebase(user.uid);
      if (savedFallback) {
        setProgress(sanitizeProgress(savedFallback));
        setCurrentScreen('RESUME_PROMPT');
      } else {
        setProgress(createDefaultProgress(user));
        setCurrentScreen('UPLOAD');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResume = () => {
    setCurrentScreen('MAIN');
  };

  const [isStartingOver, setIsStartingOver] = useState(false);
  const handleStartOver = async () => {
    if (isStartingOver) return;
    setIsStartingOver(true);
    try {
      if (currentUser?.uid) {
        await clearProgressFromFirebase(currentUser.uid, currentUser.email, currentUser.name);
      }
      const defaultProg = createDefaultProgress(currentUser);
      setProgress(defaultProg);
      setCurrentScreen('UPLOAD');
    } catch (e) {
      console.error("Failed to clear progress", e);
      const defaultProg = createDefaultProgress(currentUser);
      setProgress(defaultProg);
      setCurrentScreen('UPLOAD');
    } finally {
      setIsStartingOver(false);
    }
  };

  const handleStartStudy = (content: string, mode: AppMode, metadata: { bookName: string, grade: string, unit: string }) => {
    const targetSection = mode === 'PRACTICE_EXAM' ? SectionId.TESTS : SectionId.RESEARCH;
    
    if (progress) {
      const newMaterial = {
        id: `mat-${Date.now()}`,
        ...metadata,
        content,
        uploadDate: Date.now()
      };
      
      const updatedMaterials = [...(progress.uploadedMaterials || []), newMaterial];
      const updated: UserProgress = { 
        ...progress, 
        documentContent: content, 
        appMode: mode,
        uploadedMaterials: updatedMaterials,
        currentMaterialId: newMaterial.id,
        currentSection: targetSection,
        updatedAt: Date.now()
      };
      
      setProgress(updated);
      // Wait for state to be set conceptually or just navigate immediately since progress is now non-null
      setCurrentScreen('MAIN');
      
      if (currentUser?.uid) {
        saveProgressToFirebase(currentUser.uid, updated).catch(err => {
          console.error("Failed to save start progress:", err);
        });
      }
    } else if (currentUser) {
      // Fallback if progress was lost
      const defaultProg = createDefaultProgress(currentUser);
      const newMaterial = {
        id: `mat-${Date.now()}`,
        ...metadata,
        content,
        uploadDate: Date.now()
      };
      const updated: UserProgress = { 
        ...defaultProg, 
        documentContent: content, 
        appMode: mode,
        uploadedMaterials: [newMaterial],
        currentMaterialId: newMaterial.id,
        currentSection: targetSection,
        updatedAt: Date.now()
      };
      setProgress(updated);
      setCurrentScreen('MAIN');
      
      if (currentUser.uid) {
        saveProgressToFirebase(currentUser.uid, updated).catch(console.error);
      }
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {currentScreen === 'LOGIN' && (
        <Login onLogin={handleLogin} />
      )}
      
      {currentScreen === 'RESUME_PROMPT' && (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center relative overflow-hidden">
            {isSyncing && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              </div>
            )}
            <h2 className="text-2xl font-bold mb-4 text-slate-800">Chào mừng trở lại!</h2>
            <p className="text-slate-600 mb-8">Bạn có một phiên học đang tiến hành. Bạn muốn tiếp tục hay bắt đầu một hành trình mới?</p>
            <div className="space-y-4 relative z-0">
              <button 
                onClick={handleResume}
                disabled={isStartingOver}
                className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition transform active:scale-[0.98] shadow-lg shadow-teal-600/20 disabled:opacity-50"
              >
                Tiếp tục học phần trước
              </button>
              <button 
                onClick={handleStartOver}
                disabled={isStartingOver}
                className="w-full py-3.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isStartingOver && <Loader2 className="animate-spin w-4 h-4" />}
                {isStartingOver ? 'Đang thiết lập lại...' : 'Bắt đầu mới (Xóa tiến độ cũ)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {currentScreen === 'UPLOAD' && (
        <UploadDocument onStart={handleStartStudy} />
      )}

      {currentScreen === 'MAIN' && (
        progress ? (
          <MainLayout initialProgress={progress} onBackToUpload={() => setCurrentScreen('UPLOAD')} onProgressUpdate={setProgress} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white grow">
            <div className="text-center">
              <Loader2 className="animate-spin w-10 h-10 text-teal-600 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Đang chuẩn bị không gian học tập...</p>
              <button 
                onClick={() => setCurrentScreen('LOGIN')}
                className="mt-4 text-teal-600 text-sm font-bold underline"
              >
                Quay lại đăng nhập nếu đợi quá lâu
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default App;
