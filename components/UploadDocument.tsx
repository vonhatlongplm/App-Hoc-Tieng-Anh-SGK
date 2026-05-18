import React, { useState } from 'react';
import { Upload, BookOpen, FileText } from 'lucide-react';
import { AppMode } from '../App';

interface UploadDocumentProps {
  onStart: (content: string, mode: AppMode) => void;
}

export const UploadDocument: React.FC<UploadDocumentProps> = ({ onStart }) => {
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<AppMode>('LEARN_BOOK');

  const handleStart = () => {
    if (!content.trim()) return;
    onStart(content, mode);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-start p-6 bg-slate-50 overflow-y-auto pb-16">
      <div className="max-w-3xl w-full flex flex-col items-center mt-8 sm:mt-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
            AI Gia sư Cá nhân của bạn
          </h1>
          <p className="text-lg text-slate-600 mb-2">
            Copy nội dung bài học, đoạn văn bản từ Sách Giáo Khoa hoặc Đề thi và dán vào bên dưới.
          </p>
          <p className="text-md text-slate-500">
            Hệ thống hỗ trợ dạng văn bản (text). Bạn hãy bôi đen nội dung trong PDF/Word, nhấn Copy (Ctrl+C) và Paste (Ctrl+V) vào khung dưới đây.
          </p>
        </div>

        <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden text-left p-8">
          <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">
            Nội dung bài học / Đề thi
          </label>
          <textarea
            className="w-full h-48 sm:h-64 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition resize-y mb-8 font-mono text-sm leading-relaxed"
            placeholder="Ví dụ: Copy một bài Reading tiếng Anh lớp 10 và dán vào đây..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          <label className="block text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">
            Chế độ học
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => setMode('LEARN_BOOK')}
              className={`flex flex-col items-start p-6 rounded-2xl border-2 transition-all ${
                mode === 'LEARN_BOOK'
                  ? 'border-teal-500 bg-teal-50 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
              }`}
            >
              <div className={`p-3 rounded-xl mb-4 ${mode === 'LEARN_BOOK' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Học theo sách</h3>
              <p className="text-sm text-slate-600">
                AI giảng giải chi tiết tài liệu, trích xuất từ vựng và ngữ pháp trọng tâm.
              </p>
            </button>

            <button
              onClick={() => setMode('PRACTICE_EXAM')}
              className={`flex flex-col items-start p-6 rounded-2xl border-2 transition-all ${
                mode === 'PRACTICE_EXAM'
                  ? 'border-indigo-500 bg-indigo-50 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
              }`}
            >
              <div className={`p-3 rounded-xl mb-4 ${mode === 'PRACTICE_EXAM' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Luyện giải đề</h3>
              <p className="text-sm text-slate-600">
                AI trích xuất từng câu hỏi để bạn tự làm, sau đó chấm điểm và chữa chi tiết.
              </p>
            </button>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleStart}
              disabled={!content.trim()}
              className="bg-slate-900 text-white rounded-full px-10 py-4 font-semibold text-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-105 active:scale-95 shadow-xl shadow-slate-900/20"
            >
              Bắt đầu học ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
