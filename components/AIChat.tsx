import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AppMode } from '../types';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface AIChatProps {
  documentContent: string;
  mode: AppMode;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export const AIChat: React.FC<AIChatProps> = ({ documentContent, mode, messages, setMessages }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const systemInstruction = 
    mode === 'LEARN_BOOK' 
      ? `Bạn là một Giáo viên Tiếng Anh lớp 10 toàn năng. Nhiệm vụ của bạn là giảng dạy và hướng dẫn học viên dựa trên các tài liệu được cung cấp (thường bao gồm Sách Giáo Khoa, Sách Bài Tập, và Sách Giáo Viên).
         - Hãy kết hợp thông tin từ tất cả tài liệu để đưa ra lời giải thích đầy đủ nhất.
         - Trích xuất từ vựng, ngữ pháp trọng tâm và giải thích dễ hiểu với ví dụ.
         - Sau mỗi phần lý thuyết, hãy đưa ra 1-2 câu hỏi tương tác để kiểm tra.
         - Sử dụng tiếng Việt làm ngôn ngữ chính, ví dụ giữ nguyên tiếng Anh. Luôn dùng Markdown.`
      : `Bạn là một giám khảo và gia sư luyện thi Tiếng Anh lớp 10. Nhiệm vụ của bạn là:
         - Nhận diện các câu hỏi trong đề thi.
         - Hiển thị từng câu (hoặc cụm câu) để học sinh làm.
         - Chấm điểm, giải thích chi tiết Tại sao đúng/sai, dịch nghĩa và chỉ ra lỗ hổng kiến thức.
         - Định dạng Markdown đẹp mắt.`;

  let parsedItems: any[] = [];
  try {
      parsedItems = JSON.parse(documentContent);
  } catch (e) {
      if (documentContent.startsWith('FILE_URI::')) {
          const split = documentContent.split('::');
          parsedItems = [{ type: 'file', uri: split[1], mime: split[2], name: split[3] }];
      } else {
          parsedItems = [{ type: 'text', content: documentContent }];
      }
  }

  const rawTextContent = parsedItems.filter((i: any) => i.type === 'text').map((i: any) => i.content).join('\n---\n');
  const finalSystemInstruction = rawTextContent 
    ? `${systemInstruction}\n\nTài liệu tham khảo dạng text của sinh viên: \n\n${rawTextContent}`
    : systemInstruction;

  // Start the chat by letting the AI say something first
  useEffect(() => {
    if (messages.length === 0) {
        // Initial greeting from user (auto-sent)
        handleSend("Xin chào, hãy bắt đầu quá trình học/đánh giá với tôi nhé. Vui lòng đọc tài liệu (nếu có) để chúng ta bắt đầu.");
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (forcedInput?: string) => {
    const textToSend = forcedInput || input;
    if (!textToSend.trim()) return;

    if (input.trim() || forcedInput) setInput('');

    const isFirstInitial = !!forcedInput && messages.length === 0;

    // Always add the user message to the UI
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', text: textToSend }]);
    
    setIsLoading(true);

    try {
      const historyToGen = [...messages, { id: 'temp', role: 'user', text: textToSend }];
      const contents: any[] = [];
      const documentParts = parsedItems
            .filter((i: any) => i.type === 'file')
            .map((i: any) => ({ fileData: { fileUri: i.uri, mimeType: i.mime } }));

      // Attach documentParts to the first user message in history
      let docsAttached = false;
      for (const m of historyToGen) {
        if (!docsAttached && m.role === 'user' && documentParts.length > 0) {
          contents.push({
            role: 'user',
            parts: [{ text: m.text }, ...documentParts]
          });
          docsAttached = true;
        } else {
          contents.push({
            role: m.role,
            parts: [{ text: m.text }]
          });
        }
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: finalSystemInstruction,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error (Status ${res.status})`);
      }

      const data = await res.json();
      
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'model', text: data.text },
      ]);
    } catch (e: any) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'model', text: `❌ ${e.message || "Đã có lỗi xảy ra khi kết nối với AI Gia sư."}` },
      ]);
    } finally {

      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-4 ${
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-full flex justify-center items-center ${
                msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-teal-600 text-white'
              }`}
            >
              {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>
            
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-white border text-slate-800 border-slate-200 rounded-tr-sm'
                  : 'bg-white border text-slate-800 border-teal-100 rounded-tl-sm'
              }`}
            >
              <div className="markdown-body prose prose-slate prose-sm md:prose-base leading-relaxed break-words">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-full bg-teal-600 text-white flex justify-center items-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-white border border-teal-100 rounded-2xl rounded-tl-sm px-6 py-5 shadow-sm flex items-center gap-3 text-slate-500 font-medium">
               <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
               Gia sư đang suy nghĩ...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200 shrink-0">
        <div className="max-w-4xl mx-auto relative flex items-center">
          <textarea
            className="w-full bg-slate-100 border border-transparent focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200 rounded-full pl-6 pr-14 py-4 text-slate-800 outline-none transition resize-none overflow-hidden"
            rows={1}
            placeholder="Nhập câu trả lời hoặc câu hỏi của bạn..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2.5 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-50 disabled:hover:bg-teal-600 transition"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
