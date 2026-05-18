import React from 'react';
import { DiagnosticAttempt } from '../types';
import { History, ClipboardList, Eye, RefreshCw } from 'lucide-react';

interface TestHistoryViewProps {
  attempts: DiagnosticAttempt[];
  onViewResult: (attempt: DiagnosticAttempt) => void;
  onRetakeTest: () => void;
}

const TestHistoryView: React.FC<TestHistoryViewProps> = ({ attempts, onViewResult, onRetakeTest }) => {
  const sortedAttempts = [...attempts].sort((a, b) => b.completedOn - a.completedOn);

  return (
    <div className="p-6 h-full flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="w-full max-w-3xl">
        <header className="text-center mb-8">
            <ClipboardList className="mx-auto text-teal-600 mb-2" size={48} />
            <h2 className="text-3xl font-bold text-slate-800 serif">Lịch sử Bài kiểm tra</h2>
            <p className="text-slate-500 mt-2">Xem lại kết quả các lần làm bài hoặc thực hiện một bài kiểm tra mới.</p>
        </header>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-700 flex items-center gap-2">
                <History size={20}/> Các lần làm bài đã ghi nhận
            </h3>
            <ul className="space-y-3">
                {sortedAttempts.map((attempt) => (
                    <li key={attempt.completedOn} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div>
                            <p className="font-semibold text-slate-800">
                                Hoàn thành lúc: {new Date(attempt.completedOn).toLocaleString('vi-VN')}
                            </p>
                            <p className="text-sm text-slate-500">
                                Kết quả đạt được: <span className="font-bold text-teal-700">{attempt.diagnosedLevel}</span>
                            </p>
                        </div>
                        <button 
                            onClick={() => onViewResult(attempt)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                            <Eye size={16} /> Xem chi tiết
                        </button>
                    </li>
                ))}
            </ul>
        </div>

        <div className="text-center">
             <button
                onClick={onRetakeTest}
                className="flex items-center justify-center gap-3 w-full max-w-md mx-auto rounded-lg bg-teal-600 px-6 py-4 text-lg font-semibold text-white shadow-md transition-transform duration-200 hover:scale-105 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            >
                <RefreshCw className="h-6 w-6" /> Làm lại bài kiểm tra
            </button>
            <p className="text-xs text-slate-400 mt-3">Làm lại bài kiểm tra sẽ tạo một lộ trình học mới dựa trên kết quả mới nhất.</p>
        </div>

      </div>
    </div>
  );
};

export default TestHistoryView;
