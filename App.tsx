
import React, { useState } from 'react';
import { Login } from './components/Login';
import MainLayout from './components/MainLayout';
import { loadProgressFromFirebase, clearProgressFromFirebase } from './services/firebase';
import { UserProgress } from './types';
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
    scores: {},
    estimatedTimeToB2: '6 tháng',
    detailedProgress: createInitialDetailedProgress(),
    vocabulary: [],
    messages: [],
    appMode: 'LEARN_BOOK',
    documentContent: ''
  });

  const handleLogin = async (user: any) => {
    setCurrentUser(user);
    setIsSyncing(true);
    try {
      const saved = await loadProgressFromFirebase(user.uid);
      if (saved && saved.uid && saved.documentContent) {
        setProgress(saved);
        setCurrentScreen('RESUME_PROMPT');
      } else if (saved && saved.uid) {
        setProgress(saved);
        setCurrentScreen('UPLOAD');
      } else {
        setProgress(createDefaultProgress(user));
        setCurrentScreen('UPLOAD');
      }
    } catch (e) {
      console.error("Failed to load progress", e);
      setProgress(createDefaultProgress(user));
      setCurrentScreen('UPLOAD');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResume = () => {
    setCurrentScreen('MAIN');
  };

  const handleStartOver = async () => {
    if (currentUser?.uid) {
      await clearProgressFromFirebase(currentUser.uid, currentUser.email, currentUser.name);
    }
    const defaultProg = createDefaultProgress(currentUser);
    setProgress(defaultProg);
    setCurrentScreen('UPLOAD');
  };

  const handleStartStudy = (content: string, mode: AppMode) => {
    if (progress) {
      const updated = { ...progress, documentContent: content, appMode: mode };
      setProgress(updated);
      setCurrentScreen('MAIN');
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
                className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition transform active:scale-[0.98] shadow-lg shadow-teal-600/20"
              >
                Tiếp tục học phần trước
              </button>
              <button 
                onClick={handleStartOver}
                className="w-full py-3.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition transform active:scale-[0.98]"
              >
                Bắt đầu mới (Xóa tiến độ cũ)
              </button>
            </div>
          </div>
        </div>
      )}

      {currentScreen === 'UPLOAD' && (
        <UploadDocument onStart={handleStartStudy} />
      )}

      {currentScreen === 'MAIN' && progress && (
        <MainLayout initialProgress={progress} onBackToUpload={() => setCurrentScreen('UPLOAD')} />
      )}
    </div>
  );
};

export default App;
