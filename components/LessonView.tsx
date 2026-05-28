
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Message, Section, UserProgress, VocabularyWord, DiagnosticAttempt, SkillScore, SectionId } from '../types';
import { ArrowLeft, Send, Lightbulb, CheckCircle, Loader2, User, Bot, Volume2, Save, Paperclip, X, Languages, Check, RefreshCw, Play, Pause, Download, Sparkles, Keyboard, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import AudioRecorder from './AudioRecorder';
import SelectionToolbar from './SelectionToolbar';
import TranslationPopover from './TranslationPopover';
import MarkdownRenderer from './MarkdownRenderer';
import * as geminiService from '../services/geminiService';
import { DIAGNOSTIC_PROMPT_EN, DIAGNOSTIC_PROMPT_VI, LESSON_DATA } from '../constants';

interface LessonViewProps {
  section: SectionId;
  lessonNumber: number;
  lessonTitle: string;
  messages: Message[];
  documentContent?: string;
  addMessage: (msg: Message) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  savedVocabulary: VocabularyWord[];
  onSaveWord: (wordData: { word: string; ipa: string; partOfSpeech: string; meaning: string; irregularForms?: string }) => void;
  onSaveCollocation: (parentWord: string, collocation: { phrase: string; meaning: string }) => void;
  onHintRequest: (taskDescription: string, section: SectionId) => void;
  onLessonComplete: (section: SectionId, lessonNumber: number, result?: any) => void;
  onBackToSyllabus: () => void;
  setToastMessage: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  onRestart?: () => void;
  isReviewMode?: boolean;
  onSectionChange?: (sec: SectionId) => void;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function createWavHeader(dataSize: number, sampleRate: number, numChannels: number, bitsPerSample: number) {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataSize, true); // ChunkSize
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // ByteRate
    view.setUint16(32, numChannels * (bitsPerSample / 8), true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true); // Subchunk2Size
    return new Uint8Array(header);
}

const downloadAudio = (base64: string, filename: string) => {
    const pcmData = decode(base64);
    const wavHeader = createWavHeader(pcmData.length, 24000, 1, 16);
    const blob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

const WordPopover: React.FC<any> = ({ popoverData, onClose, onSave, onSaveCollocation, onPlayAudio, isSpeaking, savedVocabulary }) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState(popoverData.position);
    const isDraggingRef = useRef(false);
    const offsetRef = useRef({ x: 0, y: 0 });

    const isCollocationSaved = (phrase: string) => {
        const wordInVocab = savedVocabulary.find((v: any) => v.word.toLowerCase() === popoverData.word.toLowerCase());
        return wordInVocab?.collocations?.some((c: any) => c.phrase.toLowerCase() === phrase.toLowerCase()) || false;
    };

    const handleDragMove = useCallback((e: any) => {
        if (!isDraggingRef.current) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setPosition({ top: clientY - offsetRef.current.y, left: clientX - offsetRef.current.x });
    }, []);

    const handleDragEnd = useCallback(() => {
        isDraggingRef.current = false;
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
    }, [handleDragMove]);

    const handleDragStart = useCallback((e: any) => {
        if (e.type === 'mousedown') e.preventDefault();
        isDraggingRef.current = true;
        document.body.style.userSelect = 'none';
        const rect = popoverRef.current!.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        offsetRef.current = { x: clientX - rect.left, y: clientY - rect.top };
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchmove', handleDragMove);
        window.addEventListener('touchend', handleDragEnd);
    }, [handleDragMove, handleDragEnd]);

    return (
        <div 
            ref={popoverRef} 
            style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 110 }} 
            className="w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 interactive-popup overflow-hidden select-none cursor-move"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
        >
            <div className="flex justify-between items-center p-4 bg-slate-50 border-b">
                 <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-x-2 flex-wrap">
                        <h4 className="font-black text-xl text-slate-800">{popoverData.word}</h4>
                        <p className="font-mono text-sm text-teal-600 font-bold">/{popoverData.ipa}/</p>
                    </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2 rounded-full hover:bg-slate-200 text-slate-400"><X size={18} /></button>
            </div>
            <div className="p-5 max-h-72 overflow-y-auto">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-teal-700 font-black uppercase tracking-widest bg-teal-100 px-2.5 py-1 rounded-full inline-block">{popoverData.partOfSpeech}</span>
                    {popoverData.irregularForms && (
                        <span className="text-[10px] text-amber-700 font-black uppercase tracking-widest bg-amber-100 px-2.5 py-1 rounded-full inline-block">
                            {popoverData.irregularForms}
                        </span>
                    )}
                </div>
                <p className="text-slate-700 mt-3 text-sm leading-relaxed font-medium">{popoverData.meaning}</p>
                {popoverData.collocations?.length > 0 && (
                     <div className="mt-4 pt-4 border-t border-slate-100">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cụm từ rèn luyện (Collocations)</h5>
                        <ul className="space-y-3">
                            {popoverData.collocations.map((col: any) => {
                                const saved = isCollocationSaved(col.phrase);
                                return (
                                    <li key={col.phrase} className="flex justify-between items-start text-sm group">
                                        <div className="min-w-0 flex-1 mr-3">
                                            <p className="font-bold text-slate-800 group-hover:text-teal-700 transition-colors">{col.phrase}</p>
                                            <p className="text-slate-500 italic text-xs mt-0.5">{col.meaning}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); if(!saved) onSaveCollocation(popoverData, col); }} 
                                            disabled={saved}
                                            className={`flex-shrink-0 px-2.5 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${saved ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600 hover:bg-teal-500 hover:text-white'}`}
                                        >
                                            {saved ? <Check size={12} className="inline mr-1" /> : 'Lưu'}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between bg-slate-50 p-3 px-5 rounded-b-2xl border-t">
                <button onClick={(e) => { e.stopPropagation(); onPlayAudio(popoverData.word); }} disabled={isSpeaking} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-teal-600 transition-colors">
                    {isSpeaking ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />} Phát âm
                </button>
                <button onClick={(e) => { e.stopPropagation(); onSave(popoverData); }} disabled={popoverData.isSaved} className={`flex items-center gap-2 px-5 py-2 text-sm font-black uppercase rounded-xl transition-all shadow-sm ${popoverData.isSaved ? 'bg-green-100 text-green-700' : 'bg-teal-600 text-white hover:bg-teal-700 shadow-teal-600/20 active:scale-95'}`}>
                    {popoverData.isSaved ? <><Check size={18} /> Đã có</> : <><Save size={18} /> Lưu tháp</>}
                </button>
            </div>
        </div>
    );
};

const MessageBubble: React.FC<any> = ({ message, onWordDoubleClick, onTranslate, isTranslating, speechRate, onSpeechRateChange, speechVoice, onSpeechVoiceChange, onPlayEnglishTTS, onPlayTranslatedTTS, isSpeakingMessageId, isPaused }) => {
    const isUser = message.role === 'user';
    const isSpeakingOriginal = isSpeakingMessageId === message.id;
    const isSpeakingTranslation = isSpeakingMessageId === `trans-${message.id}`;
    
    return (
        <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'} w-full animate-in slide-in-from-bottom-2 duration-300`}>
            {!isUser && <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 mt-1"><Bot size={22} /></div>}
            <div className={`flex-1 min-w-0 p-4.5 rounded-2xl shadow-sm border ${isUser ? 'bg-blue-600 text-white rounded-br-none border-blue-500 shadow-blue-600/10 ml-12' : 'bg-white text-slate-800 rounded-bl-none border-slate-200 mr-12'}`}>
                <div data-message-id={message.id} className="interactive-message-content">
                    <MarkdownRenderer text={message.text} onWordDoubleClick={onWordDoubleClick} />
                </div>
                
                {message.imageUrls?.map((url: string, i: number) => (
                    <div key={i} className="mt-4 rounded-xl overflow-hidden shadow-md border border-white/20">
                        <img src={url} alt="Educational Aid" className="w-full object-cover max-h-96" />
                    </div>
                ))}
                
                {message.audioBase64 && (
                    <div className="mt-4 p-3 bg-slate-50/50 rounded-xl border border-slate-200">
                        <audio controls src={`data:audio/webm;base64,${message.audioBase64}`} className="w-full h-8" />
                    </div>
                )}
                
                {!isUser && message.type === 'text' && (
                     <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                        <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-200">
                            <button onClick={(e) => { e.stopPropagation(); onPlayEnglishTTS(message); }} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${isSpeakingOriginal ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-teal-600'}`}>
                                {isSpeakingOriginal && !isPaused ? <Pause size={14} /> : isSpeakingOriginal && isPaused ? <Play size={14} /> : <Volume2 size={14} />}
                                {isSpeakingOriginal ? (isPaused ? 'Tiếp tục' : 'Tạm dừng') : 'Đọc câu này'}
                            </button>
                            <div className="w-px h-4 bg-slate-200 mx-1"></div>
                            <select value={speechRate} onChange={(e) => onSpeechRateChange(Number(e.target.value))} className="text-[10px] bg-transparent border-none focus:ring-0 text-slate-500 font-bold px-1"><option value="0.75">0.75x</option><option value="1">1.0x</option><option value="1.25">1.25x</option></select>
                        </div>

                        <button onClick={(e) => { e.stopPropagation(); onTranslate(message.id, message.text); }} disabled={isTranslating} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${message.showTranslation ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-600'}`}>
                            {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />} {message.showTranslation ? 'Ẩn dịch' : 'Dịch Việt'}
                        </button>
                        
                        {message.englishAudio && (
                            <button onClick={(e) => { e.stopPropagation(); downloadAudio(message.englishAudio, 'lesson_audio'); }} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-teal-600 transition-colors" title="Tải âm thanh">
                                <Download size={14} />
                            </button>
                        )}
                     </div>
                )}
                 {message.showTranslation && message.translation && (
                    <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600 bg-slate-50/80 p-4 rounded-xl animate-in slide-in-from-top-1 duration-300">
                        <MarkdownRenderer text={message.translation} />
                        <div className="flex items-center gap-2 mt-3">
                            <button onClick={(e) => { e.stopPropagation(); onPlayTranslatedTTS(message); }} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isSpeakingTranslation ? 'bg-teal-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:border-teal-300'}`}>
                                {isSpeakingTranslation && !isPaused ? <Pause size={14} /> : isSpeakingTranslation && isPaused ? <Play size={14} /> : <Volume2 size={14} />}
                                Đọc bản dịch
                            </button>
                        </div>
                    </div>
                 )}
            </div>
             {isUser && <div className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shadow-md mt-1 font-bold text-xs uppercase">Me</div>}
        </div>
    );
};

import { useTTS } from '../hooks/useTTS';

const LessonView: React.FC<LessonViewProps> = ({ section, lessonNumber, lessonTitle, messages, documentContent, addMessage, setMessages, savedVocabulary, onSaveWord, onSaveCollocation, onHintRequest, onLessonComplete, onBackToSyllabus, setToastMessage, onRestart, isReviewMode = false, onSectionChange }) => {
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isProcessingAudio, setIsProcessingAudio] = useState(false);
    const [diagnosticStep, setDiagnosticStep] = useState<any>('grammar');
    const [diagnosticGrammarAnswers, setDiagnosticGrammarAnswers] = useState<string | null>(null);
    const [diagnosticWritingAnswer, setDiagnosticWritingAnswer] = useState<string | null>(null);
    const [startLessonFailed, setStartLessonFailed] = useState(false);
    const [replyFailedMessageId, setReplyFailedMessageId] = useState<string | null>(null);
    
    const [selectionData, setSelectionData] = useState<any>(null);
    const [popoverData, setPopoverData] = useState<any>(null);
    const [translationPopoverData, setTranslationPopoverData] = useState<any>(null);
    const [isSpeakingMessageId, setIsSpeakingMessageId] = useState<string | null>(null);
    const [speechRate, setSpeechRate] = useState(1);
    const [speechVoice, setSpeechVoice] = useState<'Puck' | 'Zephyr' | 'Kore' | 'Fenrir'>('Zephyr');
    const [translatingMessageIds, setTranslatingMessageIds] = useState<Set<string>>(new Set());
    const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(true);
    
    const [stagedImage, setStagedImage] = useState<{ file: File; base64: string } | null>(null);
    const [stagedAudio, setStagedAudio] = useState<{ file: Blob; base64: string } | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setToastMessage({ message: "Vui lòng chỉ tải lên tài liệu hình ảnh bài học.", type: "error" });
            return;
        }

        try {
            const base64 = await blobToBase64(file);
            setStagedImage({ file, base64: `data:${file.type};base64,${base64}` });
            setToastMessage({ message: "Đã chọn hình ảnh tải lên thành công! Em hãy ghi câu hỏi bổ sung rồi bấm Gửi nhé.", type: "success" });
        } catch (err: any) {
            console.error("Image Upload Error:", err);
            setToastMessage({ message: "Lỗi xử lý hình ảnh tải lên.", type: "error" });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    
    const { playTTS, stopTTS, isTtsLoading } = useTTS();
    const [ttsMode, setTtsMode] = useState<'ai' | 'browser'>(() => {
        return (localStorage.getItem('vocab_tts_mode') as 'ai' | 'browser') || 'ai';
    });

    const toggleTtsMode = () => {
        const newMode = ttsMode === 'ai' ? 'browser' : 'ai';
        setTtsMode(newMode);
        localStorage.setItem('vocab_tts_mode', newMode);
    };

    // Persistent translation cache
    const getCachedTranslation = (text: string) => {
        try {
            const cache = JSON.parse(localStorage.getItem('aptis_translation_cache') || '{}');
            return cache[text];
        } catch { return null; }
    };
    
    const setCachedTranslation = (text: string, translation: string) => {
        try {
            const cache = JSON.parse(localStorage.getItem('aptis_translation_cache') || '{}');
            cache[text] = translation;
            localStorage.setItem('aptis_translation_cache', JSON.stringify(cache));
        } catch { /* ignore */ }
    };

    const [suggestedTransition, setSuggestedTransition] = useState<{
        targetSection: SectionId;
        name: string;
        countdown: number;
    } | null>(null);

    const [isSectionCompleted, setIsSectionCompleted] = useState(false);

    const checkIsSectionCompleted = useCallback(() => {
        try {
            const list = JSON.parse(localStorage.getItem('completed_sections') || '[]');
            setIsSectionCompleted(list.includes(section));
        } catch (e) {
            setIsSectionCompleted(false);
        }
    }, [section]);

    useEffect(() => {
        checkIsSectionCompleted();
    }, [section, messages, checkIsSectionCompleted]);

    const SEQUENTIAL_FLOW: Record<string, SectionId | null> = {
      [SectionId.VOCABULARY]: SectionId.GRAMMAR,
      [SectionId.GRAMMAR]: SectionId.READING,
      [SectionId.READING]: SectionId.LISTENING,
      [SectionId.LISTENING]: SectionId.WRITING,
      [SectionId.WRITING]: SectionId.SPEAKING,
      [SectionId.SPEAKING]: SectionId.TESTS,
    };

    const SECTION_NAMES: Record<string, string> = {
      [SectionId.VOCABULARY]: "Từ vựng Unit",
      [SectionId.GRAMMAR]: "Ngữ pháp Unit",
      [SectionId.READING]: "Bài đọc Unit",
      [SectionId.LISTENING]: "Bài nghe Unit",
      [SectionId.WRITING]: "Bài viết Unit",
      [SectionId.SPEAKING]: "Luyện nói Unit",
      [SectionId.TESTS]: "Luyện giải đề (Unit)"
    };

    const detectSectionTransition = (text: string, currentSec: SectionId): SectionId | null => {
        if (!text) return null;
        const lowercaseText = text.toLowerCase();

        // Key phrases that signal moving to another section
        const transitionIndicators = [
            "chuyển sang phần", "chuyển qua phần", "bước sang phần", "đi tiếp sang phần", "tiếp theo chúng ta",
            "tiếp theo, chúng ta", "tiếp theo là phần", "học tiếp sang", "học sang phần", "sang phần",
            "tiếp tục với phần", "bắt đầu với phần", "học phần ngữ pháp", "học phần từ vựng",
            "học phần bài đọc", "học phần bài nghe", "học phần bài viết", "học phần luyện nói",
            "làm bài kiểm tra", "thiết kế đề", "luyện giải đề", "move to the", "switch to the",
            "proceed to the", "next part", "let's move to", "chuyển sang"
        ];

        const hasTransitionWord = transitionIndicators.some(word => lowercaseText.includes(word));
        if (!hasTransitionWord) return null;

        // Force sequential structure - only the immediate next sequential section is allowed, no skipping or jumping
        const nextSec = SEQUENTIAL_FLOW[currentSec];
        if (!nextSec) return null;

        return nextSec;
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const viewContainerRef = useRef<HTMLDivElement>(null);

    const isDiagnosticTest = section === SectionId.PHONICS || section === SectionId.TESTS;
    const filteredMessages = useMemo(() => messages.filter(msg => (isDiagnosticTest ? msg.context?.section === SectionId.TESTS : (msg.context?.section === section && msg.context?.lessonNumber === lessonNumber))), [messages, section, lessonNumber, isDiagnosticTest]);
    
    // Auto-start lesson if empty
    const hasStartedRef = useRef(false);
    const lastRespondedMsgId = useRef<string | null>(null);
    
    // Reset refs when lesson changes
    useEffect(() => {
        hasStartedRef.current = false;
        lastRespondedMsgId.current = null;
        setStartLessonFailed(false);
        setReplyFailedMessageId(null);
    }, [section, lessonNumber]);

    useEffect(() => {
        if (filteredMessages.length === 0 && !isReviewMode && !isThinking && !hasStartedRef.current && !startLessonFailed) {
            hasStartedRef.current = true;
            const startLesson = async () => {
                if (isDiagnosticTest) {
                    addMessage({ id: `init-diagnostic-${Date.now()}`, role: 'model', text: DIAGNOSTIC_PROMPT_EN, type: 'text', timestamp: Date.now(), context: { section: 'tests', lessonNumber: 0 } });
                } else {
                    setIsThinking(true);
                    try {
                        console.log("Starting lesson with Gemini...");
                        const responseText = await geminiService.sendMessageToGemini([], `Chào Thầy/Cô. Em muốn bắt đầu học bài ${lessonNumber}: ${lessonTitle}. Thầy/Cô hãy giới thiệu tổng quan và bắt đầu nhé.`, section as any, documentContent);
                        addMessage({ id: `msg-${Date.now()}`, role: 'model', text: responseText, type: 'text', timestamp: Date.now(), context: { section, lessonNumber } });
                        setStartLessonFailed(false);
                    } catch (e: any) {
                        console.error("Start Lesson Error:", e);
                        setToastMessage({ 
                            message: `Lỗi khi bắt đầu: ${e.message || "Gia sư không phản hồi."} (Vui lòng thử tải lại trang hoặc kiểm tra kết nối mạng.)`, 
                            type: "error" 
                        });
                        setStartLessonFailed(true);
                    } finally {
                        setIsThinking(false);
                    }
                }
            };
            startLesson();
        } else if (filteredMessages.length > 0 && !isReviewMode && !isThinking) {
            const lastMsg = filteredMessages[filteredMessages.length - 1];
            if (lastMsg.role === 'user' && !lastMsg.text.includes("[Đã gửi bài ghi âm") && lastMsg.id !== lastRespondedMsgId.current && replyFailedMessageId !== lastMsg.id) {
                lastRespondedMsgId.current = lastMsg.id;
                // Trigger AI response for external user messages (like from ResearchView buttons)
                const getReply = async () => {
                    setIsThinking(true);
                    try {
                        const responseText = await geminiService.sendMessageToGemini(
                            filteredMessages.slice(0, -1).map(m => ({ role: m.role, text: m.text })), 
                            lastMsg.text, 
                            section as any, 
                            documentContent
                        );
                        addMessage({ id: `msg-${Date.now()}`, role: 'model', text: responseText, type: 'text', timestamp: Date.now(), context: { section, lessonNumber } });
                        setReplyFailedMessageId(null);
                    } catch (e: any) {
                        console.error("AI Error:", e);
                        // Store the failed message ID to allow inline retry, but do NOT clear lastRespondedMsgId to avoid infinite loops
                        setReplyFailedMessageId(lastMsg.id);
                        setToastMessage({ message: `Lỗi: ${e.message || "Gia sư gặp lỗi khi phản hồi"}`, type: "error" });
                    } finally {
                        setIsThinking(false);
                    }
                };
                getReply();
            }
        }
    }, [filteredMessages, isDiagnosticTest, isReviewMode, lessonNumber, lessonTitle, section, addMessage, setToastMessage, isThinking, documentContent, startLessonFailed, replyFailedMessageId]);

    const prevMsgLength = useRef(filteredMessages.length);
    useEffect(() => { 
        if (filteredMessages.length > prevMsgLength.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
            
            // Check for section transitions suggested by the tutor
            const lastMsg = filteredMessages[filteredMessages.length - 1];
            if (lastMsg && lastMsg.role === 'model' && lastMsg.text) {
                const msgId = lastMsg.id;
                try {
                    const list = JSON.parse(localStorage.getItem('processed_transitions') || '[]');
                    if (!list.includes(msgId)) {
                        // Mark processed instantly
                        list.push(msgId);
                        localStorage.setItem('processed_transitions', JSON.stringify(list));
                        
                        const targetSec = detectSectionTransition(lastMsg.text, section);
                        if (targetSec && onSectionChange) {
                            setSuggestedTransition({
                                targetSection: targetSec,
                                name: SECTION_NAMES[targetSec] || String(targetSec),
                                countdown: 8
                            });
                        }
                    }
                } catch (e) {
                    console.error("Transition check failed:", e);
                }
            }
        }
        prevMsgLength.current = filteredMessages.length;
    }, [filteredMessages, section, onSectionChange]);

    useEffect(() => {
        if (!suggestedTransition) return;

        if (suggestedTransition.countdown <= 0) {
            const target = suggestedTransition.targetSection;
            setSuggestedTransition(null);
            if (onSectionChange) {
                // Save current section as completed
                try {
                    const list = JSON.parse(localStorage.getItem('completed_sections') || '[]');
                    if (!list.includes(section)) {
                        list.push(section);
                        localStorage.setItem('completed_sections', JSON.stringify(list));
                    }
                } catch (e) {}

                onSectionChange(target);
                setToastMessage({
                    message: `Đã tự động chuyển sang phần ${SECTION_NAMES[target]} theo hướng dẫn của gia sư!`,
                    type: "success"
                });
            }
            return;
        }

        const timer = setTimeout(() => {
            setSuggestedTransition(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
        }, 1000);

        return () => clearTimeout(timer);
    }, [suggestedTransition, onSectionChange, section]);
    
    const closeAllPopups = useCallback(() => {
        setPopoverData(null);
        setTranslationPopoverData(null);
        setSelectionData(null);
    }, []);

    useEffect(() => {
        return () => {
            stopTTS();
        };
    }, []); // Run only on unmount to prevent premature cancels on state changes

    useEffect(() => {
        let selectionTimeout: any;
        
        const handleSelectionChange = () => {
            clearTimeout(selectionTimeout);
            selectionTimeout = setTimeout(() => {
                const selection = window.getSelection();
                const selectedText = selection?.toString().trim();
                
                if (selectedText && selectedText.length > 0 && selection!.rangeCount > 0) {
                    try {
                        const range = selection!.getRangeAt(0);
                        const rect = range.getBoundingClientRect();
                        
                        // Only show if selection is within the container and has a valid rect
                        if (rect.width > 0 && viewContainerRef.current?.contains(selection!.anchorNode)) {
                            setSelectionData({ 
                                text: selectedText, 
                                rect: { 
                                    top: rect.top, 
                                    left: rect.left, 
                                    width: rect.width, 
                                    height: rect.height, 
                                    bottom: rect.bottom, 
                                    right: rect.right 
                                } 
                            });
                            return;
                        }
                    } catch (e) {
                        // Range might be invalid
                    }
                }
                
                // Don't clear automatically. Only clear when "X" is clicked in the toolbar.
                // This allows the toolbar to persist even if the browser's native menu interferes.
            }, 100);
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
            clearTimeout(selectionTimeout);
        };
    }, []);

    const handlePlayEnglishTTS = (message: Message | { id: string; text: string }) => {
        const isCurrentSelectionSpeaking = isSpeakingMessageId?.startsWith('sel-') && message.id.startsWith('sel-');
        if (isSpeakingMessageId === message.id || isCurrentSelectionSpeaking) {
            stopTTS();
            setIsSpeakingMessageId(null);
            return;
        }

        setIsSpeakingMessageId(message.id);
        playTTS(message.text, ttsMode, () => {
            setIsSpeakingMessageId(null);
        });
    };

    const handlePlayTranslatedTTS = (message: Message) => {
        if (!message.translation) return;
        const playId = `trans-${message.id}`;
        if (isSpeakingMessageId === playId) {
            stopTTS();
            setIsSpeakingMessageId(null);
            return;
        }

        setIsSpeakingMessageId(playId);
        // Force browser TTS for Vietnamese translation
        playTTS(message.translation, 'browser', () => {
            setIsSpeakingMessageId(null);
        });
    };

    const handleSendMessage = async (text: string) => {
        if (isThinking || isProcessingAudio || isReviewMode) return;
        
        const trimmedText = text.trim();
        // If nothing is entered and there are no attachments, do nothing unless in diagnostic speaking
        if (!trimmedText && !stagedImage && !stagedAudio && !(section === SectionId.TESTS && diagnosticStep === 'speaking')) {
            return;
        }

        setIsThinking(true);
        setInput('');

        // 1. TEXT + IMAGE STAGED FLOW
        if (stagedImage) {
            let userMessage: Message | null = null;
            const finalImage = stagedImage;
            setStagedImage(null); // Clear stage

            const messageText = trimmedText || "Em gửi hình ảnh bài học này, thầy/cô giúp em nghiên cứu nhé.";

            try {
                userMessage = { 
                    id: `msg-img-${Date.now()}`, 
                    role: 'user', 
                    text: messageText, 
                    type: 'text', 
                    timestamp: Date.now(), 
                    imageUrls: [finalImage.base64],
                    context: { section, lessonNumber } 
                };
                addMessage(userMessage);
                lastRespondedMsgId.current = userMessage.id;
                setReplyFailedMessageId(null);

                const prompt = trimmedText 
                    ? `Dựa trên cả hình ảnh đính kèm và câu hỏi này: "${trimmedText}". Thầy/Cô hãy phân tích nội dung hình ảnh, dịch nghĩa và giải đáp tận tình về từ vựng/ngữ pháp/phát âm cho em nhé.`
                    : "Dựa trên hình ảnh em gửi, Thầy/Cô hãy phân tích nội dung, dịch nghĩa và hướng dẫn em học các từ vựng/ngữ pháp/phát âm có trong ảnh này nhé.";

                const responseText = await geminiService.sendMessageToGemini(
                    filteredMessages.map(m => ({ role: m.role, text: m.text, imageUrls: m.imageUrls })), 
                    prompt, 
                    section as any, 
                    documentContent,
                    userMessage.imageUrls
                );
                addMessage({ id: `msg-res-${Date.now()}`, role: 'model', text: responseText, type: 'text', timestamp: Date.now() + 1, context: { section, lessonNumber } });
            } catch (err: any) {
                console.error("Staged Image Analysis Error:", err);
                if (userMessage) {
                    setReplyFailedMessageId(userMessage.id);
                }
                setToastMessage({ message: `Lỗi: ${err.message || "Không thể phân tích hình ảnh đính kèm."}`, type: "error" });
            } finally {
                setIsThinking(false);
            }
            return;
        }

        // 2. TEXT + AUDIO STAGED FLOW
        if (stagedAudio) {
            const finalAudio = stagedAudio;
            setStagedAudio(null); // Clear stage
            setIsProcessingAudio(true);

            // Handle diagnostic speaking step specially
            if (section === SectionId.PHONICS && diagnosticStep === 'speaking') {
                setDiagnosticStep('submitting');
                addMessage({ 
                    id: `msg-${Date.now()}`, 
                    role: 'user', 
                    text: "[Đã gửi bài ghi âm chẩn đoán]", 
                    type: 'audio_feedback', 
                    timestamp: Date.now(), 
                    audioBase64: finalAudio.base64, 
                    context: { section: SectionId.TESTS, lessonNumber: 0 } 
                });
                try {
                    const result = await geminiService.analyzeDiagnostic(diagnosticGrammarAnswers!, diagnosticWritingAnswer!, finalAudio.base64, "Học viên");
                    onLessonComplete(section, lessonNumber, result);
                } catch (e: any) { 
                    setToastMessage({ message: e.message || "Lỗi phân tích bài thi. Hãy thử lại.", type: "error" });
                    setDiagnosticStep('speaking'); 
                } finally {
                    setIsProcessingAudio(false);
                    setIsThinking(false);
                }
                return;
            }

            const messageText = trimmedText || "[Gửi ghi âm phát âm]";

            // Store current message as user speaking message
            const userMessage: Message = { 
                id: `msg-audio-${Date.now()}`, 
                role: 'user', 
                text: messageText, 
                type: 'audio_feedback', 
                timestamp: Date.now(), 
                audioBase64: finalAudio.base64, 
                context: { section, lessonNumber } 
            };
            addMessage(userMessage);
            lastRespondedMsgId.current = userMessage.id;
            setReplyFailedMessageId(null);

            try {
                const analysis = await geminiService.analyzeSpeakingAudio(finalAudio.base64, finalAudio.file.type, trimmedText || undefined);
                addMessage({ id: `msg-${Date.now()}`, role: 'model', text: analysis, type: 'audio_feedback', timestamp: Date.now(), audioBase64: finalAudio.base64, context: { section, lessonNumber } });
            } catch (e: any) {
                console.error("Audio Speak Analysis Error:", e);
                setReplyFailedMessageId(userMessage.id);
                setToastMessage({ message: `Lỗi phân tích phát âm: ${e.message || "Gia sư không phản hồi. Hãy thử ghi âm lại."}`, type: "error" });
            } finally {
                setIsProcessingAudio(false);
                setIsThinking(false);
            }
            return;
        }

        // 3. TEXT-ONLY FLOW (Default)
        if (section === SectionId.TESTS && diagnosticStep !== 'speaking' && !trimmedText) {
            setIsThinking(false);
            return;
        }

        const userMessage: Message = { id: `msg-${Date.now()}`, role: 'user', text: trimmedText, type: 'text', timestamp: Date.now(), context: { section, lessonNumber } };
        addMessage(userMessage);
        lastRespondedMsgId.current = userMessage.id;
        setReplyFailedMessageId(null);

        if (section === SectionId.TESTS) {
            if (diagnosticStep === 'grammar') {
                setDiagnosticGrammarAnswers(trimmedText);
                addMessage({ id: `msg-${Date.now()+1}`, role: 'model', text: "Hệ thống ghi nhận. Tiếp theo, hãy viết một đoạn văn ngắn (20-30 từ) mô tả về sở thích hoặc gia đình của bạn.", type: 'text', timestamp: Date.now()+1, context: { section: SectionId.TESTS, lessonNumber: 0 } });
                setDiagnosticStep('writing');
            } else if (diagnosticStep === 'writing') {
                setDiagnosticWritingAnswer(trimmedText);
                addMessage({ id: `msg-${Date.now()+1}`, role: 'model', text: "Tuyệt vời. Bước cuối cùng, bạn hãy nhấn nút Micro và ghi âm giới thiệu bản thân bằng tiếng Anh trong khoảng 45-60 giây nhé.", type: 'text', timestamp: Date.now()+1, context: { section: SectionId.TESTS, lessonNumber: 0 } });
                setDiagnosticStep('speaking');
            }
            setIsThinking(false);
            return;
        }
        
        try {
            const responseText = await geminiService.sendMessageToGemini(filteredMessages.map(m => ({ role: m.role, text: m.text })), trimmedText, section as any, documentContent);
            addMessage({ id: `msg-${Date.now()+1}`, role: 'model', text: responseText, type: 'text', timestamp: Date.now() + 1, context: { section, lessonNumber } });
            setReplyFailedMessageId(null);
        } catch (e: any) {
            console.error("AI Send Message Error:", e);
            setReplyFailedMessageId(userMessage.id);
            setToastMessage({ message: `Lỗi: ${e.message || "Gia sư gặp lỗi khi phản hồi"}`, type: "error" });
        } finally {
            setIsThinking(false);
        }
    };

    const handleAudioRecorded = async (audioBlob: Blob) => {
        try {
            const base64 = await blobToBase64(audioBlob);
            setStagedAudio({ file: audioBlob, base64 });
            setToastMessage({ message: "Đã ghi âm thành công! Em hãy đặt câu hỏi bổ sung (nếu có) rồi bấm nút Gửi để hoàn tất nhé.", type: "success" });
        } catch (err: any) {
            console.error("Audio Recorded Convert Error:", err);
            setToastMessage({ message: "Lỗi chuẩn bị tệp âm thanh ghi âm.", type: "error" });
        }
    };

    const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        if (isReviewMode || isThinking) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        let imageFile: File | null = null;
        let audioFile: File | null = null;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                imageFile = item.getAsFile();
                break; // Prioritize image pasting
            } else if (item.type.startsWith('audio/')) {
                audioFile = item.getAsFile();
            }
        }

        if (imageFile) {
            e.preventDefault();
            try {
                const base64 = await blobToBase64(imageFile);
                setStagedImage({ file: imageFile, base64: `data:${imageFile.type};base64,${base64}` });
                setToastMessage({ message: "Đã dán ảnh thành công! Em hãy viết câu hỏi bổ sung rồi bấm Gửi nhé.", type: "success" });
            } catch (err: any) {
                console.error("Paste Image Convert Error:", err);
                setToastMessage({ message: "Lỗi dán hình ảnh.", type: "error" });
            }
        } else if (audioFile) {
            e.preventDefault();
            try {
                const base64 = await blobToBase64(audioFile);
                setStagedAudio({ file: audioFile, base64 });
                setToastMessage({ message: "Đã dán âm thanh thành công! Em hãy viết câu hỏi rồi bấm Gửi nhé.", type: "success" });
            } catch (err: any) {
                console.error("Paste Audio Convert Error:", err);
                setToastMessage({ message: "Lỗi dán âm thanh.", type: "error" });
            }
        }
    };

    const handleRetryStartLesson = () => {
        setStartLessonFailed(false);
        hasStartedRef.current = false;
    };

    const handleRetryReply = async (messageId: string) => {
        const failedMsg = filteredMessages.find(m => m.id === messageId);
        if (!failedMsg) return;

        setIsThinking(true);
        setReplyFailedMessageId(null);
        lastRespondedMsgId.current = failedMsg.id;
        
        try {
            const indexOfFailed = filteredMessages.findIndex(m => m.id === messageId);
            const contextHistory = indexOfFailed !== -1 
                ? filteredMessages.slice(0, indexOfFailed) 
                : filteredMessages;

            const responseText = await geminiService.sendMessageToGemini(
                contextHistory.map(m => ({ role: m.role, text: m.text, imageUrls: m.imageUrls })), 
                failedMsg.text, 
                section as any, 
                documentContent,
                failedMsg.imageUrls
            );
            addMessage({ id: `msg-${Date.now()}`, role: 'model', text: responseText, type: 'text', timestamp: Date.now(), context: { section, lessonNumber } });
            setReplyFailedMessageId(null);
        } catch (e: any) {
            console.error("Retry Reply Error:", e);
            setReplyFailedMessageId(failedMsg.id);
            setToastMessage({ message: `Lỗi: ${e.message || "Gia sư vẫn gặp lỗi khi phản hồi. Hãy đợi vài giây và thử lại!"}`, type: "error" });
        } finally {
            setIsThinking(false);
        }
    };

    const handleWordDoubleClick = async (event: any, word: string) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        try {
            const result = await geminiService.lookupWord(word);
            setPopoverData({ ...result, position: { top: rect.top - 10, left: rect.left }, isSaved: savedVocabulary.some(v => v.word.toLowerCase() === word.toLowerCase()) });
            setSelectionData(null);
        } catch (e: any) {
            setToastMessage({ message: e.message || "Lỗi tra cứu từ vựng.", type: "error" });
        }
    };

    const handleSelectionLookup = async (text: string) => {
        if (!selectionData) return;
        const cleanedText = text.trim()
            .replace(/^[.,/#!$%^&*¿?;:{}=\-_`~()"\s]+|[.,/#!$%^&*¿?;:{}=\-_`~()"\s]+$/g, "");
        if (!cleanedText) return;
        const rect = selectionData.rect;
        try {
            const result = await geminiService.lookupWord(cleanedText);
            setPopoverData({ 
                ...result, 
                position: { top: rect.top - 10, left: rect.left }, 
                isSaved: savedVocabulary.some(v => v.word.toLowerCase() === cleanedText.toLowerCase()) 
            });
            setSelectionData(null);
        } catch (e: any) {
            setToastMessage({ message: e.message || "Không thể tra cứu cụm từ này.", type: "error" });
        }
    };

    const handleSelectionRead = (text: string) => {
        handlePlayEnglishTTS({ id: `sel-${Date.now()}`, text: text });
    };

    const handleSelectionTranslate = async (text: string) => {
        if (!selectionData) return;
        const pos = { top: selectionData.rect.top - 10, left: selectionData.rect.left };
        
        // Check cache first
        const cached = getCachedTranslation(text);
        if (cached) {
            setTranslationPopoverData({ text: cached, position: pos, isLoading: false, originalText: text });
            return;
        }

        setTranslationPopoverData({ text: '', position: pos, isLoading: true, originalText: text });
        try {
            const translation = await geminiService.translateToVietnamese(text);
            setCachedTranslation(text, translation);
            setTranslationPopoverData({ text: translation, position: pos, isLoading: false, originalText: text });
        } catch (e: any) {
            setToastMessage({ message: e.message || "Lỗi kết nối dịch thuật.", type: "error" });
            setTranslationPopoverData(null);
        }
    };
    
    const handleTranslateMessage = async (messageId: string, text: string) => {
        const msg = messages.find(m => m.id === messageId);
        if (msg?.translation) {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, showTranslation: !m.showTranslation } : m));
            return;
        }

        // Check global cache
        const cached = getCachedTranslation(text);
        if (cached) {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, translation: cached, showTranslation: true } : m));
            return;
        }

        setTranslatingMessageIds(prev => new Set(prev).add(messageId));
        try {
            const translation = await geminiService.translateToVietnamese(text);
            setCachedTranslation(text, translation);
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, translation: translation, showTranslation: true } : m));
        } catch (e: any) {
            setToastMessage({ message: e.message || "Lỗi dịch bài học.", type: "error" });
        } finally {
            setTranslatingMessageIds(prev => { const next = new Set(prev); next.delete(messageId); return next; });
        }
    };

    return (
        <div ref={viewContainerRef} className="flex flex-col h-full h-[100dvh] w-full bg-slate-50 overflow-hidden relative overscroll-none">
            <header className="flex items-center justify-between p-3 px-4 sm:p-4 sm:px-6 border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-40 shrink-0 landscape:py-1.5">
                <button onClick={onBackToSyllabus} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-500 hover:text-slate-800 font-bold transition-colors"><ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" /> <span className="hidden sm:inline">Quay lại</span></button>
                <div className="text-center min-w-0 px-2">
                    <h3 className="text-sm sm:text-base font-black text-slate-800 line-clamp-1 serif landscape:text-xs">{lessonTitle}</h3>
                    <p className="text-[9px] sm:text-[10px] text-teal-600 font-bold uppercase tracking-widest landscape:hidden">{section}</p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-3">
                    <button 
                        onClick={toggleTtsMode}
                        className={`p-2 rounded-xl transition-all ${
                            ttsMode === 'ai' 
                                ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' 
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                        title={ttsMode === 'ai' ? "Đang dùng giọng AI (Click để đổi sang giọng máy)" : "Đang dùng giọng máy (Click để đổi sang giọng AI)"}
                    >
                        {ttsMode === 'ai' ? <Sparkles size={16} /> : <Keyboard size={16} />}
                    </button>
                    {filteredMessages.length > 5 && (
                        <button 
                            onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
                            className={`p-2 rounded-xl transition-all ${
                                isHistoryCollapsed 
                                    ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                            title={isHistoryCollapsed ? "Hiện toàn bộ tin nhắn đã ẩn" : "Thu gọn bớt các tin nhắn cũ"}
                        >
                            {isHistoryCollapsed ? <ChevronsUpDown size={16} /> : <ChevronsDownUp size={16} />}
                        </button>
                    )}
                    {onRestart && (
                        <button 
                            onClick={() => {
                                hasStartedRef.current = false;
                                setStartLessonFailed(false);
                                setReplyFailedMessageId(null);
                                onRestart();
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-all"
                            title="Làm mới cuộc trò chuyện (Xóa tin nhắn cũ để bắt đầu học phần mới)"
                        >
                            <RefreshCw size={16} />
                        </button>
                    )}
                    <button 
                        onClick={() => {
                            try {
                                const list = JSON.parse(localStorage.getItem('completed_sections') || '[]');
                                if (!list.includes(section)) {
                                    list.push(section);
                                    localStorage.setItem('completed_sections', JSON.stringify(list));
                                }
                            } catch (e) {}
                            setIsSectionCompleted(true);
                            onLessonComplete(section, lessonNumber);

                            const nextSec = SEQUENTIAL_FLOW[section];
                            if (nextSec) {
                                setSuggestedTransition({
                                    targetSection: nextSec,
                                    name: SECTION_NAMES[nextSec] || String(nextSec),
                                    countdown: 8
                                });
                            } else {
                                setToastMessage({
                                    message: "Chúc mừng em đã hoàn thành toàn bộ lộ trình học của Unit này! Xuất sắc lắm!",
                                    type: "success"
                                });
                            }
                        }} 
                        className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black uppercase text-white bg-green-600 rounded-xl hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all active:scale-95"
                    >
                        <CheckCircle size={14} className="sm:w-4 sm:h-4" /> <span>Xong</span>
                    </button>
                </div>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 messages-container bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]">
                {startLessonFailed && filteredMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto my-12 space-y-4 bg-white rounded-2xl border border-slate-200 shadow-md">
                        <div className="p-4 bg-amber-50 rounded-full text-amber-500 border border-amber-200 animate-pulse">
                            <Bot size={28} />
                        </div>
                        <h4 className="text-sm font-black text-slate-800">Không thể kết nối với Gia sư AI</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Hiện tại hệ thống AI đang chịu tải trọng cao hoặc tạm thời hết lượt truy cập. Em vui lòng bấm nút dưới đây để kết nối thử lại nhé!
                        </p>
                        <button 
                            onClick={handleRetryStartLesson}
                            className="flex items-center gap-1.5 px-5 py-2 text-xs font-black uppercase text-white bg-teal-600 rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-600/20 active:scale-95 transition-all cursor-pointer"
                        >
                            <RefreshCw size={12} /> Thử lại ngay
                        </button>
                    </div>
                )}
                {isHistoryCollapsed && filteredMessages.length > 5 ? (
                    <>
                        <MessageBubble message={filteredMessages[0]} onWordDoubleClick={handleWordDoubleClick} onTranslate={handleTranslateMessage} isTranslating={translatingMessageIds.has(filteredMessages[0].id)} speechRate={speechRate} onSpeechRateChange={setSpeechRate} speechVoice={speechVoice} onSpeechVoiceChange={setSpeechVoice} onPlayEnglishTTS={handlePlayEnglishTTS} onPlayTranslatedTTS={handlePlayTranslatedTTS} isSpeakingMessageId={isSpeakingMessageId} isPaused={isPaused} />
                        
                        <div className="flex flex-col items-center justify-center p-6 bg-slate-100/50 hover:bg-slate-100/80 border border-slate-200/60 rounded-2xl max-w-xl mx-auto my-4 transition-all shadow-sm">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
                                <p className="text-[10px] text-teal-700 font-extrabold uppercase tracking-widest">Đã thu gọn lịch sử thảo luận</p>
                            </div>
                            <span className="text-sm font-semibold text-slate-700 text-center mb-3">
                                Hệ thống tự động ẩn bớt <strong>{filteredMessages.length - 4} phản hồi cũ</strong> để màn hình rộng rãi, tập trung hơn.
                            </span>
                            <button 
                                onClick={() => setIsHistoryCollapsed(false)}
                                className="flex items-center gap-1.5 px-4.5 py-2 text-xs font-black uppercase tracking-wider bg-white border border-teal-200 text-teal-700 shadow-sm hover:bg-teal-50 hover:text-teal-800 rounded-xl transition-all cursor-pointer"
                            >
                                <ChevronsUpDown size={14} className="text-teal-500 animate-bounce" />
                                <span>Xem thêm {filteredMessages.length - 4} tin nhắn cũ hơn</span>
                            </button>
                        </div>

                        {filteredMessages.slice(-3).map((msg) => (
                            <React.Fragment key={msg.id}>
                                <MessageBubble message={msg} onWordDoubleClick={handleWordDoubleClick} onTranslate={handleTranslateMessage} isTranslating={translatingMessageIds.has(msg.id)} speechRate={speechRate} onSpeechRateChange={setSpeechRate} speechVoice={speechVoice} onSpeechVoiceChange={setSpeechVoice} onPlayEnglishTTS={handlePlayEnglishTTS} onPlayTranslatedTTS={handlePlayTranslatedTTS} isSpeakingMessageId={isSpeakingMessageId} isPaused={isPaused} />
                                {replyFailedMessageId === msg.id && (
                                    <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 border border-red-200 text-red-500 flex items-center justify-center shadow-sm"><Bot size={18} /></div>
                                        <div className="p-4 rounded-2xl bg-red-50 text-slate-700 rounded-bl-none border border-red-100 flex flex-col items-start gap-2 shadow-sm max-w-sm">
                                            <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                                                <span>Gia sư gặp sự cố khi tải phản hồi...</span>
                                            </div>
                                            <p className="text-xs text-slate-500 leading-normal font-medium">Hệ thống đang quá tải tạm thời hoặc gặp sự cố mạng. Em vui lòng thử bấm gửi lại nhé.</p>
                                            <button 
                                                onClick={() => handleRetryReply(msg.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm active:scale-95 transition-all cursor-pointer"
                                            >
                                                <RefreshCw size={10} /> Gửi lại câu hỏi
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </>
                ) : (
                    <>
                        {!isHistoryCollapsed && filteredMessages.length > 5 && (
                            <div className="flex items-center justify-center -mt-2 -mb-2">
                                <button 
                                    onClick={() => setIsHistoryCollapsed(true)}
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all text-xs font-bold rounded-xl cursor-pointer"
                                    title="Thu gọn tin nhắn cũ"
                                >
                                    <ChevronsDownUp size={13} />
                                    <span>Thu gọn cuộc trò chuyện</span>
                                </button>
                            </div>
                        )}
                        {filteredMessages.map((msg) => (
                            <React.Fragment key={msg.id}>
                                <MessageBubble message={msg} onWordDoubleClick={handleWordDoubleClick} onTranslate={handleTranslateMessage} isTranslating={translatingMessageIds.has(msg.id)} speechRate={speechRate} onSpeechRateChange={setSpeechRate} speechVoice={speechVoice} onSpeechVoiceChange={setSpeechVoice} onPlayEnglishTTS={handlePlayEnglishTTS} onPlayTranslatedTTS={handlePlayTranslatedTTS} isSpeakingMessageId={isSpeakingMessageId} isPaused={isPaused} />
                                {replyFailedMessageId === msg.id && (
                                    <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 border border-red-200 text-red-500 flex items-center justify-center shadow-sm"><Bot size={18} /></div>
                                        <div className="p-4 rounded-2xl bg-red-50 text-slate-700 rounded-bl-none border border-red-100 flex flex-col items-start gap-2 shadow-sm max-w-sm">
                                            <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                                                <span>Gia sư gặp sự cố khi tải phản hồi...</span>
                                            </div>
                                            <p className="text-xs text-slate-500 leading-normal font-medium">Hệ thống đang quá tải tạm thời hoặc gặp sự cố mạng. Em vui lòng thử bấm gửi lại nhé.</p>
                                            <button 
                                                onClick={() => handleRetryReply(msg.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm active:scale-95 transition-all cursor-pointer"
                                            >
                                                <RefreshCw size={10} /> Gửi lại câu hỏi
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </>
                )}
                {isThinking && (
                    <div className="flex items-start gap-3 animate-pulse">
                        <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/10"><Bot size={20} /></div>
                        <div className="p-4 rounded-2xl bg-white text-slate-400 rounded-bl-none border border-slate-200 flex items-center gap-3">
                            <Loader2 className="animate-spin text-teal-500" size={16} /> 
                            <span className="text-sm font-bold italic">Gia sư đang phân tích bài học...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-slate-200 bg-white/90 backdrop-blur-md p-3 md:p-6 pb-6 md:pb-8 landscape:p-2 landscape:pb-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {/* Suggested Section Transition Banner */}
                {suggestedTransition && (
                    <div className="mx-auto max-w-lg mb-4 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 border border-teal-200 animate-pulse">
                                <Sparkles size={18} />
                                <span className="absolute -top-1 -right-1 bg-teal-500 text-white rounded-full text-[8px] px-1.5 font-bold">
                                    {suggestedTransition.countdown}s
                                </span>
                            </div>
                            <div className="text-left">
                                <span className="text-[10px] text-teal-800 font-extrabold uppercase tracking-wider block">Gợi ý lộ trình liên tục</span>
                                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                                    Gia sư đang hướng dẫn em chuyển sang <strong>{suggestedTransition.name}</strong>.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button 
                                onClick={() => setSuggestedTransition(null)}
                                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100/60 rounded-xl transition-all font-semibold animate-in fade-in"
                            >
                                Đóng
                            </button>
                            <button 
                                onClick={() => {
                                    const target = suggestedTransition.targetSection;
                                    setSuggestedTransition(null);
                                    if (onSectionChange) {
                                        // Save current section as completed
                                        try {
                                            const list = JSON.parse(localStorage.getItem('completed_sections') || '[]');
                                            if (!list.includes(section)) {
                                                list.push(section);
                                                localStorage.setItem('completed_sections', JSON.stringify(list));
                                            }
                                        } catch (e) {}

                                        onSectionChange(target);
                                        setToastMessage({
                                            message: `Đã chuyển sang phần ${SECTION_NAMES[target]} theo hướng dẫn của gia sư!`,
                                            type: "success"
                                        });
                                    }
                                }}
                                className="flex-shrink-0 flex items-center gap-1 px-4 py-1.5 bg-teal-600 text-white hover:bg-teal-700 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-teal-600/15 active:scale-95 transition-all animate-bounce"
                            >
                                <span>Chuyển ngay</span> ➔
                            </button>
                        </div>
                    </div>
                )}

                {/* Previews for staged attachments */}
                {(stagedImage || stagedAudio) && (
                    <div className="mb-3 max-w-lg mx-auto flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        {stagedImage && (
                            <div className="relative group/img flex items-center gap-3 bg-slate-900 text-white border border-slate-800 p-2 rounded-2xl shadow-md">
                                <img 
                                    src={stagedImage.base64} 
                                    alt="Ảnh đã dán" 
                                    className="w-10 h-10 object-cover rounded-xl border border-white/10"
                                    referrerPolicy="no-referrer"
                                />
                                <div className="text-left py-0.5 pr-2">
                                    <p className="text-[11px] font-black uppercase text-teal-400 tracking-wider">Hình ảnh đã dán</p>
                                    <p className="text-[10px] text-slate-400 font-bold">({(stagedImage.file.size / 1024).toFixed(1)} KB)</p>
                                </div>
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setStagedImage(null); }}
                                    className="p-1 px-1.5 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-400 transition-colors text-slate-300 mr-1 cursor-pointer"
                                    title="Xóa ảnh"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}
                        {stagedAudio && (
                            <div className="relative group/aud flex items-center gap-3 bg-slate-900 text-white border border-slate-800 p-2 rounded-2xl shadow-md">
                                <div className="w-10 h-10 bg-teal-500/20 text-teal-400 rounded-xl flex items-center justify-center border border-teal-500/30">
                                    <Volume2 size={16} />
                                </div>
                                <div className="text-left py-0.5 pr-2">
                                    <p className="text-[11px] font-black uppercase text-teal-400 tracking-wider">Ghi âm/Âm thanh đã dán</p>
                                    <p className="text-[10px] text-slate-400 font-bold">({(stagedAudio.file.size / 1024).toFixed(1)} KB)</p>
                                </div>
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setStagedAudio(null); }}
                                    className="p-1 px-1.5 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-400 transition-colors text-slate-300 mr-1 cursor-pointer"
                                    title="Xóa âm thanh"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {isSectionCompleted ? (
                    <div className="mx-auto w-full max-w-lg bg-teal-50/90 border-2 border-teal-200/80 rounded-2xl p-4 md:p-5 flex flex-col items-center text-center gap-3.5 shadow-lg shadow-teal-700/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 border border-teal-200 shadow-inner">
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-teal-950 uppercase tracking-wider">Phần học này đã hoàn thành</h4>
                            <p className="text-xs text-slate-600 mt-1 font-bold leading-relaxed">
                                Em đã hoàn thành xuất sắc các nội dung của phần này. Hãy chuyển tiếp sang kỹ năng tiếp theo hoặc xem lại kiến thức nhé!
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center w-full">
                            <button 
                                onClick={() => {
                                    try {
                                        const list = JSON.parse(localStorage.getItem('completed_sections') || '[]');
                                        const filtered = list.filter((s: string) => s !== section);
                                        localStorage.setItem('completed_sections', JSON.stringify(filtered));
                                    } catch (e) {}
                                    setIsSectionCompleted(false);
                                    if (onRestart) onRestart();
                                }}
                                className="flex-1 sm:flex-none px-4 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100/80 font-bold border border-slate-200 rounded-xl transition-all active:scale-95 cursor-pointer bg-white"
                            >
                                Học lại phần này
                            </button>
                            {SEQUENTIAL_FLOW[section] && (
                                <button 
                                    onClick={() => {
                                        const target = SEQUENTIAL_FLOW[section]!;
                                        if (onSectionChange) {
                                            onSectionChange(target);
                                            setToastMessage({
                                                message: `Đã chuyển sang phần ${SECTION_NAMES[target]} để học tiếp!`,
                                                type: "success"
                                            });
                                        }
                                    }}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2 bg-teal-600 text-white hover:bg-teal-700 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-teal-600/15 active:scale-95 transition-all animate-pulse"
                                >
                                    <span>Học tiếp phần {SECTION_NAMES[SEQUENTIAL_FLOW[section]!]}</span> ➔
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-end gap-3 w-full mx-auto">
                        <AudioRecorder onAudioRecorded={handleAudioRecorded} isProcessing={isProcessingAudio} disabled={isReviewMode} />
                        <div className="relative flex-1 group">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleImageUpload} 
                                className="hidden" 
                                accept="image/*" 
                            />
                            <textarea 
                                value={input} 
                                onChange={(e) => setInput(e.target.value)} 
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(input); } }} 
                                onPaste={handlePaste}
                                placeholder={isReviewMode ? "Đang ở chế độ xem lại bài cũ..." : "Nhập câu hỏi... (Em có thể dán trực tiếp Ảnh hoặc Âm thanh từ clipboard vào đây)"} 
                                disabled={isReviewMode || isThinking} 
                                className="w-full min-h-[44px] max-h-32 landscape:min-h-[36px] resize-none rounded-2xl border-2 border-slate-200 bg-white p-3 pr-32 text-sm font-medium focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 landscape:p-2 landscape:pr-28" 
                                rows={1} 
                            />
                             <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                {!isReviewMode && (
                                    <button 
                                        onClick={() => fileInputRef.current?.click()} 
                                        className="p-2 rounded-xl text-slate-400 hover:bg-teal-50 hover:text-teal-600 transition-all cursor-pointer" 
                                        title="Tải ảnh bài học"
                                    >
                                        <Paperclip size={18} />
                                    </button>
                                )}
                                {!isReviewMode && (
                                    <button onClick={() => onHintRequest(filteredMessages[filteredMessages.length-1]?.text || lessonTitle, section)} className="p-2 rounded-xl text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-all cursor-pointer" title="Gợi ý">
                                        <Lightbulb size={18} />
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleSendMessage(input)} 
                                    disabled={isReviewMode || isThinking || (!input.trim() && !stagedImage && !stagedAudio)} 
                                    className="p-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-600/30 disabled:bg-slate-200 disabled:shadow-none transition-all active:scale-95 cursor-pointer"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {isDiagnosticTest && (
                    <div className="mt-2 flex justify-center gap-1.5 landscape:mt-1">
                        <div className={`w-10 h-1 rounded-full ${diagnosticStep === 'grammar' ? 'bg-teal-500 shadow-sm' : 'bg-slate-200'}`}></div>
                        <div className={`w-10 h-1 rounded-full ${diagnosticStep === 'writing' ? 'bg-teal-500 shadow-sm' : 'bg-slate-200'}`}></div>
                        <div className={`w-10 h-1 rounded-full ${diagnosticStep === 'speaking' ? 'bg-teal-500 shadow-sm' : 'bg-slate-200'}`}></div>
                    </div>
                )}
            </div>
            
            {selectionData && (
                <div 
                    className="fixed z-[9998] bg-teal-500/20 pointer-events-none rounded-sm border border-teal-500/30 animate-pulse"
                    style={{
                        top: selectionData.rect.top,
                        left: selectionData.rect.left,
                        width: selectionData.rect.width,
                        height: selectionData.rect.height
                    }}
                />
            )}
            
            {selectionData && (
                <SelectionToolbar 
                    selectionData={selectionData} 
                    onLookup={handleSelectionLookup} 
                    onRead={handleSelectionRead} 
                    onTranslate={handleSelectionTranslate} 
                    onClose={closeAllPopups} 
                    isSpeaking={isSpeakingMessageId?.startsWith('sel-')} 
                />
            )}
            
            {popoverData && (
                <WordPopover 
                    popoverData={popoverData} 
                    onClose={closeAllPopups} 
                    onSave={(data: any) => {
                        // Strip collocations when saving the main word to avoid auto-saving everything
                        const { collocations, ...wordOnly } = data;
                        onSaveWord(wordOnly);
                    }} 
                    onSaveCollocation={onSaveCollocation} 
                    onPlayAudio={(text: string) => handlePlayEnglishTTS({id: `pop-${Date.now()}`, text: text})} 
                    isSpeaking={isSpeakingMessageId?.startsWith('pop-')} 
                    savedVocabulary={savedVocabulary} 
                />
            )}

            {translationPopoverData && (
                <TranslationPopover 
                    data={translationPopoverData} 
                    onClose={closeAllPopups} 
                    onSaveWord={onSaveWord}
                    savedVocabulary={savedVocabulary}
                />
            )}
        </div>
    );
};

export default LessonView;
