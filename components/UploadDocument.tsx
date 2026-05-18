import React, { useState, useRef } from 'react';
import { Upload, BookOpen, FileText, Loader2, File as FileIcon, X, Plus } from 'lucide-react';
import { AppMode } from '../App';

interface UploadDocumentProps {
  onStart: (content: string, mode: AppMode) => void;
}

type UploadItem = 
  | { type: 'text'; content: string }
  | { type: 'file'; uri: string; mime: string; name: string };

export const UploadDocument: React.FC<UploadDocumentProps> = ({ onStart }) => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [textInput, setTextInput] = useState('');
  const [mode, setMode] = useState<AppMode>('LEARN_BOOK');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStart = () => {
    let finalItems = [...items];
    if (textInput.trim()) {
      finalItems.push({ type: 'text', content: textInput.trim() });
    }
    if (finalItems.length === 0) return;
    
    // Convert logic to string for backward compatibility
    onStart(JSON.stringify(finalItems), mode);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (items.length + files.length > 20) {
      alert("Bạn chỉ có thể tải lên tối đa 20 mục cùng lúc.");
      return;
    }

    setIsUploading(true);

    try {
      const results: UploadItem[] = [];
      const fileArray = Array.from(files);
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        
        // Vercel limit is 4.5MB, Base64 adds ~33% overhead.
        // Approx limit for raw file is ~3MB to be safe for Vercel.
        // For AI Studio environment, it can be higher.
        if (file.size > 20 * 1024 * 1024) {
          alert(`Tệp ${file.name} quá lớn (tối đa 20MB).`);
          continue;
        }

        setUploadStatus(`Đang chuẩn bị ${i + 1}/${fileArray.length}: ${file.name}...`);
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);
        formData.append('mimeType', file.type);

        setUploadStatus(`Đang tải lên ${i + 1}/${fileArray.length}: ${file.name}...`);

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
          
          if (res.status === 413) {
            errMsg = "Tệp quá dung lượng cho phép của server (Gợi ý: Chia nhỏ tệp hoặc dùng tệp < 4MB if Vercel).";
          }
          
          throw new Error(`Lỗi tải tệp ${file.name} (Status ${res.status}): ${errMsg}`);
        }
        
        const data = JSON.parse(responseText);
        results.push({ type: 'file' as const, uri: data.fileUri, mime: data.mimeType, name: data.name });
      }

      setItems(prev => [...prev, ...results]);
    } catch (err: any) {
      console.error(err);
      alert(`Tải lên tệp thất bại: ${err.message || 'Vui lòng thử lại'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddText = () => {
    if (textInput.trim()) {
      setItems(prev => [...prev, { type: 'text', content: textInput.trim() }]);
      setTextInput('');
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-start p-6 bg-slate-50 overflow-y-auto pb-16">
      <div className="max-w-3xl w-full flex flex-col items-center mt-8 sm:mt-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
            AI Gia sư Cá nhân của bạn
          </h1>
          <p className="text-lg text-slate-600 mb-2">
            Tải lên Sách Giáo Khoa, Sách Bài Tập, Sách Giáo Viên hoặc copy dán văn bản để bắt đầu.
          </p>
        </div>

        <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden text-left p-8">
          
          <div className="mb-8">
            <label className="block text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">
              Nội dung bài học / Đề thi
            </label>

            {items.length > 0 && (
              <div className="space-y-3 mb-6">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-teal-100 rounded-lg text-teal-600">
                        {item.type === 'file' ? <FileIcon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                      </div>
                      <div>
                        {item.type === 'file' ? (
                          <>
                            <h4 className="font-semibold text-slate-800">{item.name}</h4>
                            <p className="text-sm text-teal-600">Đã tải lên tệp</p>
                          </>
                        ) : (
                          <>
                            <h4 className="font-semibold text-slate-800">Đoạn văn bản</h4>
                            <p className="text-sm text-teal-600 truncate max-w-xs">{item.content.slice(0, 50)}...</p>
                          </>
                        )}
                      </div>
                    </div>
                    <button onClick={() => removeItem(index)} className="p-2 text-slate-400 hover:text-red-500 transition">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4">
               <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || items.length >= 20}
                className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center hover:bg-slate-50 hover:border-teal-400 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isUploading ? (
                   <div className="flex flex-col items-center text-teal-600">
                      <Loader2 className="w-10 h-10 animate-spin mb-3" />
                      <span className="font-medium">{uploadStatus || 'Đang tải lên và xử lý...'}</span>
                      <p className="text-xs mt-2 text-slate-400">Vui lòng giữ trình duyệt mở</p>
                   </div>
                 ) : (
                   <div className="flex flex-col items-center text-slate-500">
                      <Upload className="w-10 h-10 mb-3 text-slate-400" />
                      <span className="font-medium text-slate-700 mb-1">Click để tải lên (Có thể chọn nhiều tệp)</span>
                      <span className="text-sm">Hỗ trợ PDF, Word, Ảnh... Sách GK, Sách BT, Sách GV...</span>
                   </div>
                 )}
               </button>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 onChange={handleFileUpload}
                 className="hidden" 
                 accept="application/pdf,image/*,.doc,.docx,text/plain" 
                 multiple
               />

               <div className="flex items-center gap-4 text-slate-400">
                  <div className="flex-1 h-px bg-slate-200"></div>
                  <span className="text-sm font-medium">Hoặc Dán Văn Bản</span>
                  <div className="flex-1 h-px bg-slate-200"></div>
               </div>

               <div className="relative">
                 <textarea
                  className="w-full h-32 p-4 pb-14 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition resize-y font-mono text-sm leading-relaxed"
                  placeholder="Ví dụ: Copy một bài Reading tiếng Anh lớp 10 và dán vào đây..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                 />
                 <div className="absolute bottom-3 right-3">
                   <button 
                    onClick={handleAddText}
                    disabled={!textInput.trim()}
                    className="flex items-center gap-1 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50 transition"
                   >
                      <Plus className="w-4 h-4" /> Thêm văn bản
                   </button>
                 </div>
               </div>
            </div>
          </div>

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
              disabled={(!textInput.trim() && items.length === 0) || isUploading}
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
