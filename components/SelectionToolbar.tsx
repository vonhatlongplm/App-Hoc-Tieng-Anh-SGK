
import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Volume2, Languages, Loader2, X } from 'lucide-react';

interface SelectionToolbarProps {
  selectionData: {
    text: string;
    rect: {
        top: number;
        left: number;
        width: number;
        height: number;
        bottom: number;
    };
  };
  onLookup: (text: string) => void;
  onRead: (text: string) => void;
  onTranslate: (text: string) => void;
  onClose: () => void;
  isSpeaking: boolean;
}

const SelectionToolbar: React.FC<SelectionToolbarProps> = ({ selectionData, onLookup, onRead, onTranslate, onClose, isSpeaking }) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: -9999, left: -9999, opacity: 0 });

  const isSingleWord = selectionData.text.trim().split(/\s+/).length === 1 && 
                       /^[a-zA-Z'’]+$/.test(selectionData.text.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, ""));

  useEffect(() => {
    if (!selectionData || !toolbarRef.current) return;
    
    const toolbarHeight = window.innerWidth < 768 ? 72 : 52;
    const toolbarWidth = isSingleWord ? (window.innerWidth < 768 ? 240 : 190) : (window.innerWidth < 768 ? 180 : 140);
    
    // On mobile, try to position below the selection to avoid native menu overlap if possible
    const isMobile = window.innerWidth < 768;
    const isLandscape = window.innerWidth > window.innerHeight && isMobile;
    
    let top = isMobile 
      ? selectionData.rect.bottom + (isLandscape ? 8 : 14) 
      : selectionData.rect.top - toolbarHeight - 14;
    
    // Fallback if it goes off screen
    if (top < 10) top = selectionData.rect.bottom + 14;
    if (top + toolbarHeight > window.innerHeight - 10) top = selectionData.rect.top - toolbarHeight - 14;

    let left = selectionData.rect.left + (selectionData.rect.width / 2) - (toolbarWidth / 2);
    if (left < 10) left = 10;
    if (left + toolbarWidth > window.innerWidth - 10) {
        left = window.innerWidth - toolbarWidth - 10;
    }
    
    setPosition({ top, left, opacity: 1 });
  }, [selectionData, isSingleWord]);

  // Handler tối ưu ngăn chặn trình duyệt hủy vùng chọn và thực hiện hành động
  const handleAction = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent, callback: (t: string) => void) => {
    // Ngăn chặn mất vùng chọn
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    
    // Thực hiện hành động
    callback(selectionData.text);
  };

  const iconSize = window.innerWidth < 768 ? 28 : 24;

  return (
    <div
      ref={toolbarRef}
      style={{ 
        top: `${position.top}px`, 
        left: `${position.left}px`, 
        opacity: position.opacity,
        pointerEvents: position.opacity === 0 ? 'none' : 'auto',
        touchAction: 'none'
      }}
      onPointerDown={(e) => e.stopPropagation()} 
      onMouseDown={(e) => e.preventDefault()} // Ngăn chặn mất vùng chọn trên desktop
      onTouchStart={(e) => e.preventDefault()} // Ngăn chặn mất vùng chọn trên mobile
      className="fixed z-[9999] flex items-center gap-1 bg-slate-900/98 backdrop-blur-lg text-white p-2 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] border border-slate-700 transition-all duration-300 select-none"
    >
      {isSingleWord && (
        <>
          <button
            type="button"
            onPointerDown={(e) => handleAction(e, onLookup)}
            className="p-3 sm:p-3 rounded-xl hover:bg-teal-500/30 text-teal-400 transition-all active:scale-90 group"
            title="Tra cứu từ vựng"
          >
            <BookOpen size={iconSize} className="group-hover:scale-110 transition-transform" />
          </button>
          <div className="w-px h-8 bg-slate-700/50 mx-1"></div>
        </>
      )}
      
      <button
        type="button"
        onPointerDown={(e) => !isSpeaking && handleAction(e, onRead)}
        className={`p-3 sm:p-3 rounded-xl hover:bg-slate-700 transition-all active:scale-90 group ${isSpeaking ? 'text-teal-400' : 'text-yellow-400 bg-yellow-400/10'}`}
        title="Đọc văn bản"
        disabled={isSpeaking}
      >
        {isSpeaking ? <Loader2 size={iconSize} className="animate-spin" /> : <Volume2 size={iconSize} className="group-hover:scale-110 transition-transform" />}
      </button>

      <div className="w-px h-8 bg-slate-700/50 mx-1"></div>

      <button
        type="button"
        onPointerDown={(e) => handleAction(e, onTranslate)}
        className="p-3 sm:p-3 rounded-xl hover:bg-blue-500/30 text-blue-400 transition-all active:scale-90 group"
        title="Dịch văn bản"
      >
        <Languages size={iconSize} className="group-hover:scale-110 transition-transform" />
      </button>
      
      <div className="w-px h-8 bg-slate-700/50 mx-1"></div>

      <button
        type="button"
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
        className="p-3 sm:p-3 rounded-xl hover:bg-red-500/30 text-slate-400 hover:text-red-400 transition-all active:scale-90"
        title="Đóng"
      >
        <X size={iconSize - 2} />
      </button>
    </div>
  );
};

export default SelectionToolbar;
