
import React, { useState } from 'react';
import { LogOut, X, AlertCircle, ShieldCheck, RefreshCw, Trash2 } from 'lucide-react';

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: (clearLocalData?: boolean) => void;
}

const LogoutConfirmationModal: React.FC<LogoutConfirmationModalProps> = ({ isOpen, onClose, onLogout }) => {
  const [clearData, setClearData] = useState(false);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 m-4 relative animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
          aria-label="Đóng"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
             <LogOut size={32} />
          </div>
          <h2 id="logout-title" className="text-xl font-bold text-slate-800 serif">
            Xác nhận Đăng xuất?
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Mọi tiến trình học tập của bạn đã được <b>đồng bộ Cloud tự động</b>.
          </p>
        </div>

        <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center mt-1">
                    <input 
                        type="checkbox" 
                        checked={clearData} 
                        onChange={(e) => setClearData(e.target.checked)}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-300 bg-white checked:bg-red-600 checked:border-red-600 transition-all"
                    />
                    <Check className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white h-3 w-3 opacity-0 peer-checked:opacity-100" />
                </div>
                <div>
                    <span className="text-sm font-bold text-slate-700 group-hover:text-red-600 transition-colors">Xóa sạch dữ liệu máy (Recommended)</span>
                    <p className="text-[11px] text-slate-500 leading-tight mt-1">
                        Xóa bộ nhớ đệm trình duyệt để đảm bảo lần sau đăng nhập sẽ tải dữ liệu mới nhất từ Đám mây.
                    </p>
                </div>
            </label>
        </div>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => onLogout(clearData)}
            className={`w-full flex items-center justify-center gap-3 px-4 py-4 text-base font-bold text-white rounded-xl shadow-lg transition-all active:scale-95 ${clearData ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' : 'bg-slate-700 hover:bg-slate-800 shadow-slate-700/20'}`}
          >
            {clearData ? <Trash2 size={20} /> : <LogOut size={20} />}
            {clearData ? "Xóa & Đăng xuất" : "Đăng xuất"}
          </button>
          
          <button
            onClick={onClose}
            className="w-full px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Quay lại
          </button>
        </div>
        
        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-teal-600 font-bold uppercase tracking-widest opacity-60">
            <ShieldCheck size={14} />
            Hồ sơ Cloud đang ở trạng thái an toàn
        </div>
      </div>
    </div>
  );
};

// Helper internal component for checkbox
const Check: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

export default LogoutConfirmationModal;
