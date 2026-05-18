import React, { useEffect, useState } from 'react';
import { Section } from '../types';
import { History, X, Check, Home } from 'lucide-react';

interface WelcomeBackToastProps {
  section: Section;
  onContinueLastSession: () => void;
  onStartNew: () => void;
}

const WelcomeBackToast: React.FC<WelcomeBackToastProps> = ({ section, onContinueLastSession, onStartNew }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true); // Trigger fade-in animation
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onStartNew, 300); // Allow time for fade-out animation
  };

  const handleContinue = () => {
    setVisible(false);
    setTimeout(onContinueLastSession, 300);
  };
  
  const handleStartNew = () => {
    setVisible(false);
    setTimeout(onStartNew, 300);
  };

  return (
    <div 
        className={`fixed bottom-5 right-5 z-50 w-full max-w-sm rounded-xl shadow-2xl bg-slate-800 text-white p-4 border border-slate-700 transform transition-all duration-300 ease-out
            ${visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`
        }
        role="alert"
        aria-live="assertive"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 p-2 bg-blue-500/20 rounded-full">
          <History className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-grow">
          <p className="font-semibold text-sm mb-1 text-slate-100">Chào mừng bạn quay trở lại!</p>
          <p className="text-sm text-slate-300">Bạn muốn tiếp tục học phần <strong className="font-bold text-teal-400">{section}</strong> hay bắt đầu nội dung mới?</p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleContinue}
              className="flex-1 text-sm flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 rounded-md px-3 py-2 transition-colors font-semibold"
            >
              <Check size={16} /> Tiếp tục
            </button>
             <button
              onClick={handleStartNew}
              className="flex-1 text-sm flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 rounded-md px-3 py-2 transition-colors font-semibold"
            >
              <Home size={16} /> Học phần mới
            </button>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors absolute top-2 right-2"
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default WelcomeBackToast;