import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

interface ToastProps {
  toast: { message: string; type: 'success' | 'error' } | null;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setVisible(true);
      const timer = setTimeout(() => {
        handleClose();
      }, 3500); // Auto-close after 3.5 seconds
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [toast]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300); // Allow time for fade-out animation
  };
  
  if (!toast) return null;

  const isError = toast.type === 'error';
  const Icon = isError ? AlertTriangle : CheckCircle;
  const iconBg = isError ? 'bg-red-500/20' : 'bg-green-500/20';
  const iconColor = isError ? 'text-red-400' : 'text-green-400';
  const title = isError ? 'Lỗi' : 'Thành công!';

  return (
    <div 
        className={`fixed bottom-5 right-5 z-50 w-full max-w-sm rounded-xl shadow-2xl bg-slate-800 text-white p-4 border border-slate-700 transform transition-all duration-300 ease-out
            ${visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`
        }
        role="alert"
        aria-live="assertive"
    >
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 p-2 ${iconBg} rounded-full`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-grow">
          <p className="font-semibold text-sm mb-1 text-slate-100">{title}</p>
          <p className="text-sm text-slate-300">{toast.message}</p>
        </div>
        <button
          onClick={handleClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Toast;