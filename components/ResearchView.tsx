import React, { useState, useRef } from 'react';
import { TextbookMetadata, Message, VocabularyWord, SectionId } from '../types';
import LessonView from './LessonView';
import { Book, FileText, ChevronRight, ChevronLeft, Search, Plus, Loader2, AlertCircle } from 'lucide-react';

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
  onUpdateMaterial?: (materialId: string, updatedContent: string) => void;
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingExt, setIsUploadingExt] = useState(false);
  const [uploadStatusExt, setUploadStatusExt] = useState('');
  const [errorMsgExt, setErrorMsgExt] = useState<string | null>(null);

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setErrorMsgExt(null);

    setIsUploadingExt(true);
    try {
      const fileArray = Array.from(files);
      const newlyUploaded: any[] = [];
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        if (file.size > 10 * 1024 * 1024) {
          setErrorMsgExt(`Tệp ${file.name} quá lớn (tối đa 10MB).`);
          continue;
        }

        setUploadStatusExt(`Đang tải lên ${i + 1}/${fileArray.length}: ${file.name}...`);
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);
        formData.append('mimeType', file.type);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const responseText = await res.text();
        if (!res.ok) {
          let errMsg = responseText;
          try {
            const js = JSON.parse(responseText);
            errMsg = js.error || JSON.stringify(js);
          } catch(e) {}
          throw new Error(errMsg);
        }
        
        const data = JSON.parse(responseText);
        newlyUploaded.push({
          type: 'file',
          uri: data.fileUri,
          mime: data.mimeType,
          name: data.name
        });
      }

      if (newlyUploaded.length > 0) {
        // Appends to the currently active items
        const updatedItems = [...items, ...newlyUploaded];
        const newContentString = JSON.stringify(updatedItems);
        
        if (props.onUpdateMaterial) {
          props.onUpdateMaterial(material.id, newContentString);
          props.setToastMessage({
            message: `Đã thêm thành công ${newlyUploaded.length} tệp nghiên cứu mới!`,
            type: 'success'
          });
          
          props.addMessage({
            id: `ai-notice-${Date.now()}`,
            role: 'model',
            text: `📝 **[Hệ thống]** Thầy/Cô đã tiếp nhận thêm ${newlyUploaded.length} tài liệu học tập mới vào bài học "${material.bookName} - ${material.unit}". Thầy/Cô sẽ kết hợp các thông tin từ tài liệu mới này để hướng dẫn và giải bài cho em nhé!`,
            timestamp: Date.now()
          });
        }
      }
    } catch (err: any) {
      console.error("Add files to active material error:", err);
      setErrorMsgExt(`Không thể thêm tệp: ${err.message || err}`);
    } finally {
      setIsUploadingExt(false);
      setUploadStatusExt('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* Document Panel */}
      <div className={`${isDocPanelOpen ? 'w-1/3' : 'w-0'} transition-all duration-300 border-r border-slate-200 flex flex-col bg-slate-50 relative overflow-hidden`}>
         <header className="p-4 border-b border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="text-teal-600 shrink-0" size={18} />
                <h3 className="font-bold text-sm text-slate-800 truncate pr-1" title={`${material.bookName} - ${material.unit}`}>{material.bookName} - {material.unit}</h3>
            </div>
            
            {props.onUpdateMaterial && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingExt}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-teal-600 hover:text-white bg-teal-50 hover:bg-teal-600 active:scale-95 disabled:opacity-50 rounded-lg transition-all shrink-0 cursor-pointer"
                title="Thêm tệp (Đáp án, Sách bài tập...) vào phiên học này"
              >
                <Plus size={13} />
                <span>Thêm tệp</span>
              </button>
            )}
         </header>
         
         <div className="flex-1 overflow-y-auto p-6 space-y-8 select-text">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAddFiles}
              className="hidden" 
              accept="application/pdf,image/*,.doc,.docx,text/plain" 
              multiple
            />

            {isUploadingExt && (
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin text-teal-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-teal-800 uppercase tracking-wider">Đang cập nhật giáo trình...</p>
                   <p className="text-xs text-slate-600 truncate">{uploadStatusExt}</p>
                </div>
              </div>
            )}

            {errorMsgExt && (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-2.5 text-rose-700 text-xs font-medium">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">Lỗi thêm tài liệu</p>
                  <p className="mt-0.5 opacity-90">{errorMsgExt}</p>
                </div>
                <button onClick={() => setErrorMsgExt(null)} className="text-rose-400 hover:text-rose-600 font-bold shrink-0">✕</button>
              </div>
            )}

            {items.map((item, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group relative">
                    {item.type === 'file' ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Book size={12} /> {item.name || `Tệp ${idx + 1}`}
                                </p>
                                <button 
                                    onClick={() => props.addMessage({ id: `user-req-${Date.now()}`, role: 'user', text: `Hãy giúp em nghiên cứu và học tập dựa trên nội dung của tệp "${item.name || `Tệp ${idx + 1}`}" này nhé.`, type: 'text', timestamp: Date.now(), context: { section: props.currentSection, lessonNumber: 1 } })}
                                    className="text-[10px] font-bold text-teal-600 hover:text-teal-700 bg-teal-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <Search size={10} /> Nghiên cứu tệp này
                                </button>
                            </div>
                            {item.mime.startsWith('image/') ? (
                                <img src={item.uri} alt="Page content" className="w-full rounded-xl shadow-inner border border-slate-100" />
                            ) : (
                                <div className="p-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
                                    <FileText size={40} className="mb-2 opacity-20" />
                                    <p className="text-xs font-medium italic text-center">Nội dung tệp "{item.name}" đã hoàn tất trích xuất.</p>
                                    <p className="text-[10px] mt-1 opacity-60">Em nhấn nút "Nghiên cứu tệp này" để thầy cô hướng dẫn nhé.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Search size={12} /> Trích đoạn văn bản
                                </p>
                                <button 
                                    onClick={() => props.addMessage({ id: `user-req-${Date.now()}`, role: 'user', text: `Em muốn học kỹ phần này: \n"${item.content.substring(0, 500)}${item.content.length > 500 ? '...' : ''}"\n\nThầy/Cô hãy giải thích, dịch và dạy em phát âm các câu trong đoạn này nhé.`, type: 'text', timestamp: Date.now(), context: { section: props.currentSection, lessonNumber: 1 } })}
                                    className="text-[10px] font-bold text-teal-600 hover:text-teal-700 bg-teal-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <Book size={10} /> Học đoạn này
                                </button>
                            </div>
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
