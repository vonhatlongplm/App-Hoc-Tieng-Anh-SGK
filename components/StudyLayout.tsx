import React, { useState, useEffect, useRef } from 'react';
import { AIChat } from './AIChat';
import { ArrowLeft, BookOpen, Send } from 'lucide-react';
import { AppMode } from '../App';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface StudyLayoutProps {
  documentContent: string;
  mode: AppMode;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onReset: () => void;
}

export const StudyLayout: React.FC<StudyLayoutProps> = ({ documentContent, mode, messages, setMessages, onReset }) => {
  return (
    <div className="flex w-full h-full text-slate-900">
      {/* Left panel: Document Viewer */}
      <div className="hidden lg:flex w-1/2 flex-col bg-white border-r border-slate-200 h-full">
        <header className="h-16 border-b border-slate-200 flex items-center px-6 shrink-0 justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onReset}
              className="p-2 hover:bg-slate-100 rounded-full transition"
              title="Quay lại"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-teal-600" />
              <h2 className="font-semibold text-slate-800">Tài liệu học tập</h2>
            </div>
          </div>
          <div className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-full">
            {mode === 'LEARN_BOOK' ? 'Chế độ: Học sách' : 'Chế độ: Luyện đề'}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto font-serif text-lg leading-relaxed text-slate-800 break-words whitespace-pre-wrap">
            {documentContent}
          </div>
        </div>
      </div>

      {/* Right panel: Chat Interface */}
      <div className="w-full lg:w-1/2 h-full flex flex-col bg-slate-50 relative">
        <header className="lg:hidden h-16 border-b border-slate-200 flex items-center px-4 shrink-0 bg-white">
          <button onClick={onReset} className="p-2 mr-2">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <span className="font-semibold text-slate-800">Chat cùng AI Gia sư</span>
        </header>
        <AIChat documentContent={documentContent} mode={mode} messages={messages} setMessages={setMessages} />
      </div>
    </div>
  );
};
