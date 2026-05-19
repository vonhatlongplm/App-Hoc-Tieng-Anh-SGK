import React, { useState } from 'react';
import { TextbookMetadata, Message, VocabularyWord, SectionId } from '../types';
import LessonView from './LessonView';
import { Book, FileText, ChevronRight, ChevronLeft, Search } from 'lucide-react';

interface ResearchViewProps {
  material: TextbookMetadata;
  messages: Message[];
  addMessage: (msg: Message) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  savedVocabulary: VocabularyWord[];
  onSaveWord: (word: any) => void;
  onSaveCollocation: (parent: string, col: any) => void;
  onHintRequest: (task: string, sec: SectionId) => void;
  onLessonComplete: (sec: SectionId, num: number) => void;
  onBackToSyllabus: () => void;
  setToastMessage: (t: any) => void;
  onRestart: () => void;
  currentSection: SectionId;
}

export const ResearchView: React.FC<ResearchViewProps> = (props) => {
  const [isDocPanelOpen, setIsDocPanelOpen] = useState(true);
  const { material } = props;

  // Try to parse content if it's JSON from UploadDocument
  let items: any[] = [];
  try {
    items = JSON.parse(material.content);
  } catch (e) {
    items = [{ type: 'text', content: material.content }];
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* Document Panel */}
      <div className={`${isDocPanelOpen ? 'w-1/3' : 'w-0'} transition-all duration-300 border-r border-slate-200 flex flex-col bg-slate-50 relative overflow-hidden`}>
         <header className="p-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="text-teal-600 shrink-0" size={18} />
                <h3 className="font-bold text-sm text-slate-800 truncate">{material.bookName} - {material.unit}</h3>
            </div>
         </header>
         
         <div className="flex-1 overflow-y-auto p-6 space-y-8 select-text">
            {items.map((item, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group relative">
                    {item.type === 'file' ? (
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Book size={12} /> Trang {idx + 1}
                            </p>
                            {item.mime.startsWith('image/') ? (
                                <img src={item.uri} alt="Page content" className="w-full rounded-xl shadow-inner border border-slate-100" />
                            ) : (
                                <div className="p-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
                                    <FileText size={40} className="mb-2 opacity-20" />
                                    <p className="text-xs font-medium italic">Nội dung tệp PDF/Doc đã được AI trích xuất để giảng dạy.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Search size={12} /> Trích đoạn văn bản
                            </p>
                            <div className="text-slate-700 leading-relaxed font-serif text-sm whitespace-pre-wrap">
                                {item.content}
                            </div>
                        </div>
                    )}
                </div>
            ))}
            <div className="h-20" />
         </div>

         {/* Resize handle toggle */}
         <button 
           onClick={() => setIsDocPanelOpen(false)}
           className="absolute right-0 top-1/2 -translate-y-1/2 bg-white border border-slate-200 p-1 rounded-l-md shadow-sm hover:text-teal-600 transition-colors z-10"
         >
            <ChevronLeft size={16} />
         </button>
      </div>

      {!isDocPanelOpen && (
        <button 
          onClick={() => setIsDocPanelOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 bg-white border border-slate-200 p-1 rounded-r-md shadow-sm hover:text-teal-600 transition-colors z-50 border-l-0"
        >
           <ChevronRight size={16} />
        </button>
      )}

      {/* Tutor Panel */}
      <div className="flex-1 min-w-0 bg-white">
        <LessonView 
          {...props}
          section={props.currentSection}
          lessonNumber={1}
          lessonTitle={`${material.unit}: ${props.currentSection}`}
          documentContent={material.content}
        />
      </div>
    </div>
  );
};
