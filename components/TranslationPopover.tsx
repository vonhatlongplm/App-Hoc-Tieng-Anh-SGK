import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';

interface TranslationPopoverProps {
  data: {
    text: string;
    position: { top: number; left: number };
    isLoading: boolean;
  };
  onClose: () => void;
}

const TranslationPopover: React.FC<TranslationPopoverProps> = ({ data, onClose }) => {
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
      .replace(/--- (.*?) ---/g, '\n\n$1\n') // Format my custom headers
      .trim();
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