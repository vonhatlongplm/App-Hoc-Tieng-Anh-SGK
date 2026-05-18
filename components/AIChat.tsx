import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AppMode } from '../App';

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
      ? `Bạn là một chuyên gia gia sư AI. Tài liệu của sinh viên: \n\n${documentContent}\n\nNhiệm vụ của bạn là giảng dạy, giải thích từ vựng và ngữ pháp có trong phần tài liệu này. Khuyến khích người dùng đặt câu hỏi. Luôn định dạng nội dung bằng Markdown đẹp mắt.`
      : `Bạn là một giám khảo và gia sư chấm điểm luyện thi. Tài liệu (đề thi) của sinh viên: \n\n${documentContent}\n\nNhiệm vụ của bạn là trích xuất từng câu hỏi một trong đề thi, hỏi sinh viên, đợi họ trả lời, sau đó chấm điểm và giải thích chi tiết đáp án đúng sai, cuối cùng chuyển sang câu tiếp theo. Định dạng nội dung bằng Markdown.`;

  // Start the chat by letting the AI say something first
  useEffect(() => {
    if (messages.length === 0) {
        handleSend("Xin chào, hãy bắt đầu quá trình học/đánh giá với tôi nhé. Vui lòng cho tôi biết những gì bạn tìm thấy trong tài liệu để chúng ta bắt đầu.");
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

    if (!forcedInput) setInput('');

    // If it's a forced intro prompt, don't show it as a user message visually in an ideal app, 
    // but for simplicity here we just send it to backend and let the AI respond. 
    // Actually, if it's the very first automated prompt, we can just fetch without appending user message 
    // to the UI or append a silent one.
    const isFirstInitial = !!forcedInput && messages.length === 0;

    if (!isFirstInitial) {
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', text: textToSend }]);
    }
    
    setIsLoading(true);

    try {
      const chatHistory = [...messages];
      if (!isFirstInitial) {
          chatHistory.push({ id: 'temp', role: 'user', text: textToSend });
      }

      // Convert history to contents format for the SDK
      const contents = [];
      if (isFirstInitial) {
          contents.push({ role: 'user', parts: [{ text: textToSend }] });
      } else {
          for (let m of chatHistory) {
             contents.push({ role: m.role, parts: [{ text: m.text }] });
          }
      }

      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
        }),
      });

      if (!res.ok) throw new Error('API Error');

      const data = await res.json();
      
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'model', text: data.text },
      ]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'model', text: "❌ Đã có lỗi xảy ra khi kết nối với AI Gia sư." },
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
