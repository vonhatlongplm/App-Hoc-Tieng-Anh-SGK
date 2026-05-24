import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Loader2, Check, Plus } from 'lucide-react';

interface TranslationPopoverProps {
  data: {
    text: string;
    position: { top: number; left: number };
    isLoading: boolean;
    originalText?: string;
  };
  onClose: () => void;
  onSaveWord?: (wordData: { word: string; ipa: string; partOfSpeech: string; meaning: string; irregularForms?: string }) => void;
  savedVocabulary?: any[];
}

const TranslationPopover: React.FC<TranslationPopoverProps> = ({ data, onClose, onSaveWord, savedVocabulary }) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(data.position);
  const isDraggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setPosition(data.position);
  }, [data.position]);

  const cleanText = (text: string) => {
    return text
      .replace(/\*\*/g, '') // Remove bold markers
      .replace(/^\s*>\s*/gm, '') // Remove blockquote markers at start of lines
      .replace(/^\s*[\*\-]\s+/gm, '• ') // Convert markdown bullets to nice bullets
      .replace(/--- (.*?) ---/g, '\n\n$1\n') // Format headers
      .trim();
  };

  const cleanMeaningForVocab = (rawText: string) => {
    let text = rawText
      .replace(/\*\*/g, '')
      .replace(/^\s*>\s*/gm, '')
      .trim();
    
    // Strip introductory phrases like "Trong tiếng Việt, [xxx] có nghĩa là:"
    text = text.replace(/^trong tiếng việt,?\s+("[^"]+"|[a-z0-9\s]+)?\s*(bản dịch là|có thể được dịch là|có nghĩa là|nghĩa là):?\s*/i, '');
    return text.trim();
  };

  const isAlreadySaved = data.originalText && savedVocabulary ? savedVocabulary.some(
    (v: any) => v.word.toLowerCase() === data.originalText!.toLowerCase()
  ) : false;

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSaveWord || !data.originalText) return;
    
    const cleanedMeaning = cleanMeaningForVocab(data.text);
    onSaveWord({
      word: data.originalText,
      ipa: '/.../',
      partOfSpeech: data.originalText.includes(' ') ? 'phrase' : 'word',
      meaning: cleanedMeaning,
    });
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setPosition({
      top: clientY - offsetRef.current.y,
      left: clientX - offsetRef.current.x,
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    window.removeEventListener('touchmove', handleDragMove);
    window.removeEventListener('touchend', handleDragEnd);
  }, [handleDragMove]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isDraggingRef.current = true;
    const rect = popoverRef.current!.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    offsetRef.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    document.body.style.userSelect = 'none';
    if ('touches' in e) {
        window.addEventListener('touchmove', handleDragMove);
        window.addEventListener('touchend', handleDragEnd);
    } else {
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
    }
  }, [handleDragMove, handleDragEnd]);

  return (
    <div
      ref={popoverRef}
      style={{ position: 'fixed', top: position.top, left: position.left }}
      className="z-[102] w-72 md:w-80 bg-slate-900/95 backdrop-blur-xl text-white p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 animate-in fade-in zoom-in-95 duration-150 cursor-move interactive-popup"
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
    >
      {data.isLoading ? (
        <div className="flex items-center justify-center gap-3 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
          <span className="text-sm font-medium text-slate-300">Đang dịch...</span>
        </div>
      ) : (
        <div className="relative">
          <div className="pr-6">
            <p className="text-[13px] md:text-sm text-slate-100 leading-relaxed whitespace-pre-wrap pointer-events-none font-medium">
              {cleanText(data.text)}
            </p>
            
            {data.originalText && onSaveWord && (
              <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isAlreadySaved}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase rounded-xl transition-all shadow-md cursor-pointer ${
                    isAlreadySaved 
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                      : 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-900/30 active:scale-95 border border-teal-500/30'
                  }`}
                >
                  {isAlreadySaved ? (
                    <>
                      <Check size={14} />
                      Đã lưu tháp
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      Lưu Tháp từ vựng
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute -top-1 -right-1 p-1.5 rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default TranslationPopover;
