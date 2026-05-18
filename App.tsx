
import React, { useState, useEffect } from 'react';
import { UploadDocument } from './components/UploadDocument';
import { StudyLayout } from './components/StudyLayout';
import { Login } from './components/Login';
import { saveProgressToFirebase, loadProgressFromFirebase, clearProgressFromFirebase, Message } from './services/firebase';

export type AppMode = 'LEARN_BOOK' | 'PRACTICE_EXAM';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'LOGIN' | 'RESUME_PROMPT' | 'UPLOAD' | 'STUDY'>('LOGIN');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [documentContent, setDocumentContent] = useState<string>('');
  const [appMode, setAppMode] = useState<AppMode>('LEARN_BOOK');
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [loadedProgressContent, setLoadedProgressContent] = useState<string>('');
  const [loadedAppMode, setLoadedAppMode] = useState<AppMode>('LEARN_BOOK');
  const [loadedMessages, setLoadedMessages] = useState<Message[]>([]);

  // Load from Firebase when user changes
  useEffect(() => {
    const fetchProgress = async () => {
      if (currentUser?.uid) {
        setIsSyncing(true);
        try {
          const saved = await loadProgressFromFirebase(currentUser.uid);
          if (saved && saved.documentContent) {
            setHasSavedProgress(true);
            setLoadedProgressContent(saved.documentContent);
            setLoadedAppMode(saved.appMode);
            setLoadedMessages(saved.messages || []);
          } else {
            setHasSavedProgress(false);
          }
        } catch (e) {
          console.error("Failed to fetch progress", e);
        } finally {
          setIsSyncing(false);
        }
      }
    };
    fetchProgress();
  }, [currentUser]);

  // Save to Firebase when state changes
  useEffect(() => {
    // Only save if we are actually studying and have started something
    if (currentScreen === 'STUDY' && currentUser?.uid && documentContent) {
      saveProgressToFirebase(
        currentUser.uid,
        currentUser.email,
        documentContent,
        appMode,
        messages
      ).catch(e => console.error("Failed to save progress", e));
    }
  }, [documentContent, appMode, messages, currentScreen, currentUser]);

  const handleLogin = async (user: any) => {
    setCurrentUser(user);
    setIsSyncing(true);
    const saved = await loadProgressFromFirebase(user.uid);
    setIsSyncing(false);
    if (saved && saved.documentContent) {
      setLoadedProgressContent(saved.documentContent);
      setLoadedAppMode(saved.appMode);
      setLoadedMessages(saved.messages || []);
      setCurrentScreen('RESUME_PROMPT');
    } else {
      setCurrentScreen('UPLOAD');
    }
  };

  const handleResume = () => {
    setDocumentContent(loadedProgressContent);
    setAppMode(loadedAppMode);
    setMessages(loadedMessages);
    setCurrentScreen('STUDY');
  };

  const handleStartOver = async () => {
    if (currentUser?.uid) {
      await clearProgressFromFirebase(currentUser.uid, currentUser.email);
    }
    setDocumentContent('');
    setMessages([]);
    setCurrentScreen('UPLOAD');
  };

  const handleStartStudy = (content: string, mode: AppMode) => {
    setDocumentContent(content);
    setAppMode(mode);
    setMessages([]); // Reset messages on new doc
    setCurrentScreen('STUDY');
  };

  const handleReset = () => {
    setDocumentContent('');
    setMessages([]);
    setCurrentScreen('UPLOAD');
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
            <h2 className="text-2xl font-bold mb-4">Chào mừng trở lại!</h2>
            <p className="text-slate-600 mb-8">Bạn có một phiên học đang tiến hành. Bạn muốn tiếp tục hay bắt đầu một bài học mới?</p>
            <div className="space-y-4 relative z-0">
              <button 
                onClick={handleResume}
                className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition"
              >
                Tiếp tục học phần trước
              </button>
              <button 
                onClick={handleStartOver}
                className="w-full py-3.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition"
              >
                Bắt đầu bài mới (Xóa cũ)
              </button>
            </div>
          </div>
        </div>
      )}

      {currentScreen === 'UPLOAD' && (
        <UploadDocument onStart={handleStartStudy} />
      )}
      
      {currentScreen === 'STUDY' && (
        <StudyLayout 
          documentContent={documentContent} 
          mode={appMode} 
          messages={messages}
          setMessages={setMessages}
          onReset={handleReset} 
        />
      )}
    </div>
  );
};

export default App;
