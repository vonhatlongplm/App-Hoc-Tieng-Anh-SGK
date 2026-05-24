
import React, { useState, useEffect, useRef } from 'react';
import { VocabularyWord, VocabularyCollocation } from '../types';
import { getDistractors, analyzePronunciation, getReviewHint, getCollocationQuiz, lookupWord, selectStudySessionWords } from '../services/geminiService';
import { useTTS, TTSMode } from '../hooks/useTTS';
import { Trash2, Volume2, Lightbulb, Zap, CheckCircle2, XCircle, Ear, Mic, Loader2, CornerDownLeft, Archive, SkipForward, Sparkles, Image as ImageIcon, ChevronDown, Play, Keyboard, Library, Plus, ArrowRight } from 'lucide-react';
// --- Helper Components ---

const AudioWaveform: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!stream || !canvasRef.current) return;

        let audioContext: AudioContext | null = null;
        let animationFrameId: number;

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) {
                console.error("AudioContext not supported");
                return;
            }
            
            audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const canvas = canvasRef.current;
            const canvasCtx = canvas.getContext('2d');

            const draw = () => {
                animationFrameId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(dataArray);

                if (canvasCtx) {
                    canvasCtx.fillStyle = '#f1f5f9';
                    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
                    const barWidth = (canvas.width / bufferLength) * 2.5;
                    let barHeight;
                    let x = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        barHeight = dataArray[i] / 2;
                        // Use rgba for better compatibility
                        canvasCtx.fillStyle = `rgba(13, 148, 136, ${barHeight / 100})`;
                        canvasCtx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight);
                        x += barWidth + 1;
                    }
                }
            };
            draw();
        } catch (err) {
            console.error("Error initializing AudioWaveform:", err);
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close().catch(console.error);
            }
        };
    }, [stream]);

    if (!stream) return <div className="w-[200px] h-[50px] rounded-lg bg-slate-100" />;

    return <canvas ref={canvasRef} width="200" height="50" className="rounded-lg bg-slate-100" />;
};

// --- Main Vocabulary Component ---

interface VocabularyProps {
  words: VocabularyWord[];
  onUpdateWord: (word: VocabularyWord) => void;
  onDelete: (word: string) => void;
}

type PracticeItem = { 
    type: 'word', 
    data: VocabularyWord,
    targetMastery?: number
} | { 
    type: 'collocation', 
    data: VocabularyCollocation, 
    parentWord: VocabularyWord,
    targetMastery?: number
};


const StudySession: React.FC<{ items: PracticeItem[]; words: VocabularyWord[]; onUpdate: (word: VocabularyWord) => void; onExit: () => void; ttsMode: 'ai' | 'browser'; onToggleTts: () => void; }> = ({ items, words, onUpdate, onExit, ttsMode, onToggleTts }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [completedCount, setCompletedCount] = useState(0);

    if (currentIndex >= items.length) {
        return (
            <div className="bg-white rounded-3xl shadow-2xl p-10 text-center max-w-md mx-auto mt-10 border border-slate-200">
                <div className="w-20 h-20 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Hoàn thành phiên học!</h3>
                <p className="text-slate-500 mb-8">Bạn đã xuất sắc vượt qua {completedCount} thử thách từ vựng hôm nay.</p>
                <button onClick={onExit} className="w-full py-4 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition-colors">
                    Trở về Tháp Từ vựng
                </button>
            </div>
        );
    }

    const currentItem = items[currentIndex];
    const latestWord = words.find(w => w.word === (currentItem.type === 'word' ? currentItem.data.word : currentItem.parentWord.word));
    
    let activeItem = { ...currentItem };
    if (latestWord) {
        if (activeItem.type === 'word') {
            activeItem.data = latestWord;
        } else {
            activeItem.parentWord = latestWord;
            const latestCollocation = latestWord.collocations?.find(c => c.phrase === activeItem.data.phrase);
            if (latestCollocation) {
                activeItem.data = latestCollocation;
            }
        }
    }

    const handleComplete = () => {
        setCompletedCount(prev => prev + 1);
        setCurrentIndex(prev => prev + 1);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6 flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center font-bold">
                        {currentIndex + 1}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">Phiên học hiện tại</p>
                        <p className="text-xs text-slate-500">Tổng cộng {items.length} thử thách</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} 
                        disabled={currentIndex === 0}
                        className="p-2 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-colors"
                        title="Quay lại thử thách trước"
                    >
                        <CornerDownLeft size={16} className="rotate-90" />
                    </button>
                    <button 
                        onClick={() => setCurrentIndex(prev => Math.min(items.length - 1, prev + 1))} 
                        disabled={currentIndex === items.length - 1}
                        className="p-2 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-colors"
                        title="Chuyển sang thử thách tiếp theo"
                    >
                        <SkipForward size={16} />
                    </button>
                    <div className="w-px h-6 bg-slate-200 mx-1"></div>
                    <button onClick={onExit} className="text-sm font-bold text-slate-400 hover:text-slate-800 transition-colors flex items-center gap-1 ml-1">
                        Thoát
                    </button>
                </div>
            </div>
            <PracticeView 
                key={`${activeItem.type === 'word' ? activeItem.data.word : activeItem.data.phrase}-${activeItem.targetMastery}`} 
                item={activeItem as PracticeItem} 
                onUpdate={onUpdate} 
                onComplete={handleComplete}
                ttsMode={ttsMode}
                onToggleTts={onToggleTts}
            />
        </div>
    );
};

const Vocabulary: React.FC<VocabularyProps> = ({ words: rawWords, onUpdateWord, onDelete }) => {
  const [studySessionItems, setStudySessionItems] = useState<PracticeItem[] | null>(null);
  const [quickAddWord, setQuickAddWord] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [ttsMode, setTtsMode] = useState<'ai' | 'browser'>(() => {
      return (localStorage.getItem('vocab_tts_mode') as 'ai' | 'browser') || 'ai';
  });

  const toggleTtsMode = () => {
      const newMode = ttsMode === 'ai' ? 'browser' : 'ai';
      setTtsMode(newMode);
      localStorage.setItem('vocab_tts_mode', newMode);
  };

  const getSafeMastery = (level: any) => {
      const num = typeof level === 'number' ? level : parseInt(level, 10);
      return isNaN(num) ? 0 : num;
  };

  const words: VocabularyWord[] = rawWords.map(w => ({
      ...w,
      masteryLevel: getSafeMastery(w.masteryLevel),
      collocations: w.collocations?.map(c => ({
          ...c,
          masteryLevel: getSafeMastery(c.masteryLevel)
      }))
  })) as any;
  
  const isWordMastered = (word: VocabularyWord) => {
      // Only count the main word mastery for completion status
      return getSafeMastery(word.masteryLevel) >= 4;
  };
  
  const inProgressWords = words.filter(w => !isWordMastered(w) && !w.isBacklogged).sort((a,b) => b.savedAt - a.savedAt);
  const backlogWords = words.filter(w => w.isBacklogged).sort((a,b) => b.savedAt - a.savedAt);
  const masteredWords = words.filter(w => isWordMastered(w));
  
  const handlePracticeStart = (item: PracticeItem) => {
    const items: PracticeItem[] = [];
    
    if (item.type === 'word') {
        const word = item.data;
        const currentMastery = getSafeMastery(word.masteryLevel);
        if (currentMastery < 4) {
            for (let i = currentMastery; i < 4; i++) {
                items.push({ type: 'word', data: word, targetMastery: i });
            }
        } else {
            // Allow review of mastered words (especially from backlog)
            for (let i = 0; i < 4; i++) {
                items.push({ type: 'word', data: word, targetMastery: i });
            }
        }
    } else {
        const col = item.data;
        const currentMastery = getSafeMastery(col.masteryLevel);
        if (currentMastery < 4) {
            for (let i = currentMastery; i < 4; i++) {
                items.push({ ...item, targetMastery: i });
            }
        } else {
            // Allow review of mastered collocations
            for (let i = 0; i < 4; i++) {
                items.push({ ...item, targetMastery: i });
            }
        }
    }
    
    if (items.length > 0) {
        setStudySessionItems(items);
    } else {
        alert("Từ vựng này và các cụm từ liên quan đã được chinh phục!");
    }
  }
  
  const [isSessionLoading, setIsSessionLoading] = useState(false);

  const handleStartSession = async () => {
      setIsSessionLoading(true);
      const sessionItems: PracticeItem[] = [];
      const MAX_WORDS = 10;
      
      // Helper to generate all remaining levels for a word
      const generateWordLevels = (word: VocabularyWord) => {
          const levels: PracticeItem[] = [];
          const currentMastery = getSafeMastery(word.masteryLevel);
          if (currentMastery < 4) {
              for (let i = currentMastery; i < 4; i++) {
                  levels.push({ type: 'word', data: word, targetMastery: i });
              }
          }
          return levels;
      };

      // Gather all candidate words (unmastered)
      const candidates = [...inProgressWords, ...backlogWords].filter(w => getSafeMastery(w.masteryLevel) < 4);
      
      if (candidates.length === 0) {
          setIsSessionLoading(false);
          alert("Bạn đã chinh phục hết từ vựng hiện tại! Hãy thêm từ mới từ tài liệu nhé.");
          return;
      }

      let selectedWords: VocabularyWord[] = [];

      // If we have few words, just take them all (up to MAX_WORDS)
      if (candidates.length <= MAX_WORDS) {
          selectedWords = candidates;
      } else {
          // Use AI to select the best 10 words
          const candidateStrings = candidates.map(w => w.word);
          const pool = candidateStrings.slice(0, 50); 
          
          try {
              const selectedStrings = await selectStudySessionWords(pool);
              // Map back to VocabularyWord objects
              selectedWords = selectedStrings
                  .map(s => candidates.find(c => c.word === s))
                  .filter((w): w is VocabularyWord => w !== undefined);
              
              // Fallback if AI returns fewer than MAX_WORDS or invalid words
              if (selectedWords.length < MAX_WORDS) {
                  const remaining = candidates.filter(c => !selectedWords.includes(c));
                  selectedWords.push(...remaining.slice(0, MAX_WORDS - selectedWords.length));
              }
          } catch (e) {
              console.error("AI selection failed, falling back to default order", e);
              selectedWords = candidates.slice(0, MAX_WORDS);
          }
      }

      // Generate items for selected words
      for (const word of selectedWords) {
          const wordLevels = generateWordLevels(word);
          sessionItems.push(...wordLevels);
      }

      if (sessionItems.length > 0) {
          setStudySessionItems(sessionItems.sort((a, b) => {
              const masteryA = (a as any).targetMastery ?? 0;
              const masteryB = (b as any).targetMastery ?? 0;
              if (masteryA !== masteryB) {
                  return masteryA - masteryB;
              }
              return Math.random() - 0.5;
          }));
      } else {
          alert("Không tìm thấy bài tập phù hợp.");
      }
      setIsSessionLoading(false);
  };

  const handlePracticeComplete = () => {
    setStudySessionItems(null);
  }

  const handleQuickAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = quickAddWord.trim();
      if (!trimmed) return;
      
      setIsQuickAdding(true);
      const existingWords = new Set(words.map(w => w.word.toLowerCase()));
      if (existingWords.has(trimmed.toLowerCase())) {
          alert(`Từ "${trimmed}" đã có sẵn trong danh mục từ vựng học tập của bạn rồi!`);
          setIsQuickAdding(false);
          setQuickAddWord('');
          return;
      }

      // Add a placeholder first so the user sees it immediately
      const placeholderWord: VocabularyWord = {
          word: trimmed,
          meaning: 'Đang tra nghĩa & phân tích...',
          definition: '...',
          example: '...',
          ipa: '',
          partOfSpeech: '',
          masteryLevel: 0,
          pronunciationAttempts: [],
          savedAt: Date.now(),
          isBacklogged: false
      };
      onUpdateWord(placeholderWord);
      
      try {
          const result = await lookupWord(trimmed);
          const fullWordData: VocabularyWord = {
              ...placeholderWord,
              meaning: result.meaning || result.definition,
              definition: result.definition,
              example: result.example,
              ipa: result.ipa,
              partOfSpeech: result.partOfSpeech,
              irregularForms: result.irregularForms,
              collocations: result.collocations?.map((c: any) => ({
                  phrase: c.phrase,
                  meaning: c.meaning,
                  masteryLevel: 0,
                  pronunciationAttempts: []
              }))
          };
          onUpdateWord(fullWordData);
          setQuickAddWord('');
      } catch (err) {
          console.error("Failed to lookup word:", trimmed, err);
          onUpdateWord({
              ...placeholderWord,
              meaning: 'Gặp lỗi khi tra cứu tự động. Bạn vẫn có thể luyện viết hoặc phát âm từ này.'
          });
      } finally {
          setIsQuickAdding(false);
      }
  };

  // Helper to categorize words by Part of Speech
  const getWordTopic = (wordObj: VocabularyWord) => {
      if (!wordObj.partOfSpeech) return 'Danh mục khác';
      const pos = wordObj.partOfSpeech.toLowerCase();
      if (pos.includes('noun') || pos.includes('danh')) return 'Danh từ (Nouns)';
      if (pos.includes('verb') || pos.includes('động')) return 'Động từ (Verbs)';
      if (pos.includes('adj') || pos.includes('tính')) return 'Tính từ (Adjectives)';
      if (pos.includes('adv') || pos.includes('trạng')) return 'Trạng từ (Adverbs)';
      return 'Cấu trúc & Cụm từ';
  };

  const groupWordsByTopic = (wordList: VocabularyWord[]) => {
      const groups: Record<string, VocabularyWord[]> = {};
      wordList.forEach(w => {
          const topic = getWordTopic(w);
          if (!groups[topic]) groups[topic] = [];
          groups[topic].push(w);
      });
      return groups;
  };

  const masteredGroups = groupWordsByTopic(masteredWords);
  const backlogGroups = groupWordsByTopic(backlogWords);

  return (
    <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto bg-slate-50">
        {!studySessionItems ? (
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800 serif">Tháp Từ vựng Nghiên cứu</h2>
                        <p className="text-slate-500 mt-2">Chinh phục từ vựng từ sách & tài liệu học tập qua 4 cấp độ: Nhận diện, Nghe hiểu, Luyện viết & Phát âm chuẩn.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button 
                            onClick={toggleTtsMode}
                            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                                ttsMode === 'ai' 
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                            title={ttsMode === 'ai' ? "Đang dùng giọng AI cao cấp" : "Đang dùng giọng máy tiết kiệm"}
                        >
                            {ttsMode === 'ai' ? <Sparkles size={16} /> : <Keyboard size={16} />}
                            {ttsMode === 'ai' ? 'Giọng AI (Hay)' : 'Giọng Máy (Nhanh)'}
                        </button>
                        
                        <form onSubmit={handleQuickAdd} className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                            <input 
                                type="text" 
                                value={quickAddWord}
                                onChange={(e) => setQuickAddWord(e.target.value)}
                                disabled={isQuickAdding}
                                placeholder="Thêm & tra nhanh..."
                                className="px-3 py-1.5 text-xs rounded-lg border border-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 font-medium w-36 sm:w-44"
                            />
                            <button 
                                type="submit"
                                disabled={isQuickAdding || !quickAddWord.trim()}
                                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                                {isQuickAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                <span>{isQuickAdding ? 'Đang tra...' : 'Thêm từ'}</span>
                            </button>
                        </form>
                    </div>
                </header>
                
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-700">Đang rèn luyện ({inProgressWords.length})</h3>
                            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full uppercase tracking-tighter mt-1 inline-block">Sổ từ vựng Nghiên cứu giáo trình</span>
                        </div>
                        {inProgressWords.length > 0 && (
                            <button 
                                onClick={handleStartSession} 
                                disabled={isSessionLoading}
                                className="px-6 py-3 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSessionLoading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                                {isSessionLoading ? 'Đang chuẩn bị...' : 'Bắt đầu phiên học'}
                            </button>
                        )}
                    </div>
                    {inProgressWords.length > 0 ? (
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {inProgressWords.map(word => <WordItem key={word.word} word={word} onPractice={handlePracticeStart} onDelete={onDelete} />)}
                        </ul>
                    ) : (
                        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                            <Lightbulb className="mx-auto text-slate-300 mb-2" size={32}/>
                            <p className="text-slate-500 text-sm">Chưa có từ vựng nào từ giáo trình trong danh sách rèn luyện.</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">Em có thể thêm từ vựng bằng cách double-click vào từ bất kỳ trong bài đọc/tài liệu giáo trình, hoặc gõ nhanh ở ô bên trên để tra cứu cứu hộ.</p>
                        </div>
                    )}
                </section>

                {backlogWords.length > 0 && (
                    <section className="bg-amber-50 p-6 rounded-2xl shadow-sm border border-amber-200">
                        <h3 className="text-lg font-bold text-amber-800 flex items-center gap-2 mb-4"><Archive size={20}/> Ngăn "Cho qua" ({backlogWords.length})</h3>
                        <div className="space-y-6">
                            {Object.entries(backlogGroups).map(([topic, groupWords]) => (
                                <div key={topic}>
                                    <h4 className="text-sm font-bold text-amber-700/70 uppercase tracking-wider mb-3 border-b border-amber-200 pb-1">{topic} ({groupWords.length})</h4>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {groupWords.map(word => <WordItem key={word.word} word={word} onPractice={handlePracticeStart} isBacklogged />)}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-700 mb-4">Từ vựng đã Chinh phục ({masteredWords.length})</h3>
                    {masteredWords.length > 0 ? (
                        <div className="space-y-6">
                            {Object.entries(masteredGroups).map(([topic, groupWords]) => (
                                <div key={topic}>
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">{topic} ({groupWords.length})</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {groupWords.map(word => (
                                            <div key={word.word} className="group flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-teal-300 transition-all">
                                                <div className="truncate flex-1">
                                                    <span className="font-bold text-slate-800 text-sm">{word.word}</span>
                                                    <div className="text-[10px] text-slate-500 truncate">{word.meaning}</div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button 
                                                        onClick={() => {
                                                            if (window.confirm(`Bạn có chắc muốn học lại từ "${word.word}" không?`)) {
                                                                onUpdateWord({ ...word, masteryLevel: 0, isBacklogged: false, collocations: word.collocations?.map(c => ({ ...c, masteryLevel: 0 })) });
                                                            }
                                                        }}
                                                        className="text-teal-600 hover:bg-teal-50 p-1.5 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100"
                                                        title="Học lại"
                                                    >
                                                        <Zap size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            if (window.confirm(`Bạn có chắc muốn xóa từ "${word.word}" khỏi danh sách không?`)) {
                                                                onDelete(word.word);
                                                            }
                                                        }}
                                                        className="text-slate-400 hover:text-red-500 transition-all p-1.5 rounded-lg md:opacity-0 md:group-hover:opacity-100"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={14}/>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : ( 
                        <p className="text-slate-400 text-sm italic text-center py-6">Hãy rèn luyện chăm chỉ để đưa từ vựng học tập vào danh sách chinh phục!</p>
                    )}
                </section>
            </div>
        ) : (
            <StudySession items={studySessionItems} words={words} onUpdate={onUpdateWord} onExit={handlePracticeComplete} ttsMode={ttsMode} onToggleTts={toggleTtsMode} />
        )}
    </div>
  );
}

// --- Sub-components for Vocabulary Page ---

const WordItem: React.FC<{ word: VocabularyWord; onPractice: (item: PracticeItem) => void; isBacklogged?: boolean; onDelete?: (word: string) => void }> = ({ word, onPractice, isBacklogged, onDelete }) => {
    const [collocationsVisible, setCollocationsVisible] = useState(false);
    
    // Progress based ONLY on main word mastery (0-4)
    const progress = Math.min(100, (word.masteryLevel / 4) * 100);
    
    return (
        <li className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <div className="p-4 flex gap-4">
                <div className="flex-shrink-0 w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200">
                    {word.isGeneratingImage ? <Loader2 className="animate-spin text-teal-500" size={20} /> : word.imageUrl ? <img src={word.imageUrl} alt={word.word} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-300" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div className="min-w-0">
                            <h4 className="font-bold text-slate-800 truncate">{word.word} <span className="text-[10px] font-normal text-slate-400 italic">({word.partOfSpeech})</span></h4>
                            {word.irregularForms && <p className="text-[10px] font-bold text-amber-600 uppercase mt-0.5">{word.irregularForms}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                            <Zap size={10} className="text-teal-500" />
                            <span className="text-[10px] font-black text-teal-600">{Math.round(progress)}%</span>
                            {onDelete && (
                                <button onClick={(e) => { e.stopPropagation(); onDelete(word.word); }} className="ml-2 text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors" title="Xóa từ này">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">{word.meaning}</p>
                    <div className="mt-3 flex items-center gap-3">
                         <button onClick={() => onPractice({type: 'word', data: word})} className="flex-1 px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 transition-colors text-xs flex items-center justify-center gap-1">
                            Luyện ngay
                        </button>
                        {word.collocations && word.collocations.length > 0 && (
                            <button onClick={() => setCollocationsVisible(!collocationsVisible)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                                <ChevronDown size={14} className={`transition-transform duration-200 ${collocationsVisible ? 'rotate-180' : ''}`} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
            {collocationsVisible && word.collocations && (
                <div className="bg-slate-50 border-t border-slate-100 p-3 space-y-2">
                    {word.collocations.map(col => (
                        <div key={col.phrase} className="flex justify-between items-center p-2 bg-white rounded-lg border border-slate-200 text-xs">
                            <div className="truncate pr-2">
                                <p className="font-bold text-slate-800">{col.phrase} {col.masteryLevel >= 4 && <span className="text-teal-500 ml-1">✓</span>}</p>
                                <p className="text-[10px] text-slate-400 italic">{col.meaning}</p>
                            </div>
                            <button 
                                onClick={() => onPractice({type: 'collocation', data: col, parentWord: word})} 
                                className={`px-2 py-1 rounded-md text-xs font-bold flex-shrink-0 transition-colors ${col.masteryLevel >= 4 ? 'bg-green-100 text-green-700' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}
                            >
                                {col.masteryLevel >= 4 ? 'Đã xong' : 'Luyện tập'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </li>
    );
};

const PracticeView: React.FC<{ item: PracticeItem; onUpdate: (word: VocabularyWord) => void; onComplete: () => void; ttsMode: 'ai' | 'browser'; onToggleTts: () => void; }> = ({ item, onUpdate, onComplete, ttsMode, onToggleTts }) => {
    const [challengeType, setChallengeType] = useState<'meaning' | 'listening' | 'writing' | 'pronunciation'>('meaning');
    const [options, setOptions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingText, setLoadingText] = useState('Đang chuẩn bị thử thách...');
    const [hint, setHint] = useState<string | null>(null);
    const [quiz, setQuiz] = useState<{ sentence: string; correctAnswer: string; distractors: string[] } | null>(null);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [answerStatus, setAnswerStatus] = useState<'correct' | 'incorrect' | null>(null);
    const [usedHint, setUsedHint] = useState(false);

    const [isRecording, setIsRecording] = useState(false);
    const [pronunciationFeedback, setPronunciationFeedback] = useState({ text: '', isCorrect: false, score: 0 });
    const [recordedAudioURL, setRecordedAudioURL] = useState<string | null>(null);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    
    const { playTTS: playTTSHook, stopTTS, isTtsLoading, ttsError } = useTTS();

    useEffect(() => {
        return () => {
            stopTTS();
        };
    }, []); // Run only on unmount to avoid premature stopTTS during state changes/re-renders

    const playTTS = (text: string) => {
        playTTSHook(text, ttsMode);
    };

    const currentData = item.type === 'word' ? item.data : item.data;
    const parentWord = item.type === 'word' ? item.data : item.parentWord;
    const currentMastery = currentData.masteryLevel;

    const setupChallenge = async (activeItem: PracticeItem) => {
        setIsLoading(true);
        setPronunciationFeedback({ text: '', isCorrect: false, score: 0 });
        setUsedHint(false);
        setWritingInput('');
        setWritingStatus('idle');
        setSelectedOption(null);
        setAnswerStatus(null);
        if (recordedAudioURL) {
            URL.revokeObjectURL(recordedAudioURL);
        }
        setRecordedAudioURL(null);
        
        const mastery = activeItem.targetMastery ?? (activeItem.type === 'word' ? activeItem.data.masteryLevel : activeItem.data.masteryLevel);
        
        if (mastery === 0) {
            setChallengeType('meaning');
            setLoadingText('Đang tìm kiếm ví dụ ngữ cảnh...');
        }
        else if (mastery === 1) {
            setChallengeType('listening');
            setLoadingText('Đang tạo âm thanh chân thực...');
        }
        else if (mastery === 2) {
            setChallengeType('writing');
            setLoadingText('Đang chuẩn bị bài tập chính tả...');
        }
        else if (mastery === 3) {
            setChallengeType('pronunciation');
            setLoadingText('Đang khởi tạo bộ phân tích giọng nói...');
        }

        try {
            const reviewHint = await getReviewHint(parentWord.word);
            setHint(reviewHint);

            if (activeItem.type === 'word') {
                const distractors = await getDistractors(activeItem.data.word);
                setOptions([...distractors, activeItem.data.word].sort(() => Math.random() - 0.5));
            } else {
                if (mastery === 0) {
                    const quizData = await getCollocationQuiz(activeItem.data.phrase);
                    setQuiz(quizData);
                    setOptions([...quizData.distractors, quizData.correctAnswer].sort(() => Math.random() - 0.5));
                } else {
                    const distractors = await getDistractors(activeItem.data.phrase);
                    setOptions([...distractors, activeItem.data.phrase].sort(() => Math.random() - 0.5));
                }
            }
        } catch (error) {
            console.error("Challenge setup error:", error);
            if (activeItem.type === 'word') {
                setOptions([activeItem.data.word, "distractor 1", "distractor 2", "distractor 3"].sort(() => Math.random() - 0.5));
            } else {
                if (mastery === 0) {
                    setQuiz({ sentence: `... ${activeItem.data.phrase} ...`, correctAnswer: activeItem.data.phrase, distractors: ["distractor 1", "distractor 2", "distractor 3"] });
                    setOptions([activeItem.data.phrase, "distractor 1", "distractor 2", "distractor 3"].sort(() => Math.random() - 0.5));
                } else {
                    setOptions([activeItem.data.phrase, "distractor 1", "distractor 2", "distractor 3"].sort(() => Math.random() - 0.5));
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Only setup challenge if it's a new item or if we are not in the middle of pronunciation feedback
        // If we are showing pronunciation feedback (meaning we just finished a recording), 
        // we don't want to reset the view even if the item prop updated due to mastery change.
        if (challengeType === 'pronunciation' && pronunciationFeedback.isCorrect) {
            return;
        }
        setupChallenge(item);
    }, [item]);

    const [writingInput, setWritingInput] = useState('');
    const [writingStatus, setWritingStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');

    const handleWritingSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (writingStatus === 'correct') return;

        const correctAnswer = item.type === 'word' ? item.data.word : item.data.phrase;
        const isCorrect = writingInput.trim().toLowerCase() === correctAnswer.toLowerCase();

        setWritingStatus(isCorrect ? 'correct' : 'incorrect');

        if (isCorrect) {
            playTTS(correctAnswer);
            setTimeout(() => {
                if (!usedHint) {
                    let updatedWord: VocabularyWord;
                    const actualMastery = item.type === 'word' ? item.data.masteryLevel : item.data.masteryLevel;
                    const newMastery = Math.min(4, actualMastery + 1);
                    
                    if (item.type === 'word') {
                        updatedWord = { ...item.data, masteryLevel: newMastery as any, isBacklogged: false };
                    } else {
                        const updatedCollocations = item.parentWord.collocations!.map(c => 
                            c.phrase === item.data.phrase ? { ...c, masteryLevel: newMastery as any } : c
                        );
                        updatedWord = { ...item.parentWord, collocations: updatedCollocations, isBacklogged: false };
                    }
                    onUpdate(updatedWord);
                }
                onComplete();
            }, 1500);
        } else {
            setUsedHint(true);
            setTimeout(() => {
                setWritingStatus('idle');
            }, 1000);
        }
    };

    const handleAnswer = (option: string) => {
        if (answerStatus) return; // Prevent multiple clicks

        let correctAnswer: string | undefined;
        if (item.type === 'word') {
            correctAnswer = item.data.word;
        } else {
            if (challengeType === 'meaning') {
                correctAnswer = quiz?.correctAnswer;
            } else { // listening
                correctAnswer = item.data.phrase;
            }
        }
        
        const isCorrect = option === correctAnswer;

        setSelectedOption(option);
        setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
        
        const wordToPlay = item.type === 'word' ? item.data.word : item.data.phrase;
        playTTS(wordToPlay);

        if (isCorrect) {
            // Success feedback
            setTimeout(() => {
                let updatedWord: VocabularyWord;
                const actualMastery = item.type === 'word' ? item.data.masteryLevel : item.data.masteryLevel;
                const newMastery = Math.min(4, actualMastery + 1);

                if (item.type === 'word') {
                    updatedWord = { ...item.data, masteryLevel: newMastery as any, isBacklogged: false };
                } else {
                    const updatedCollocations = item.parentWord.collocations!.map(c => 
                        c.phrase === item.data.phrase ? { ...c, masteryLevel: newMastery as any } : c
                    );
                    updatedWord = { ...item.parentWord, collocations: updatedCollocations, isBacklogged: false };
                }
                onUpdate(updatedWord);
                onComplete();
            }, 1500);
        } else {
            // Error feedback - move to next without leveling up
            setTimeout(() => {
                onComplete();
            }, 2500);
        }
    };
    
    const handleSkip = () => {
        onUpdate({ ...parentWord, isBacklogged: true });
        onComplete();
    };
    
    const toggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            mediaStream?.getTracks().forEach(track => track.stop());
            setMediaStream(null);
        } else {
            if (recordedAudioURL) {
                URL.revokeObjectURL(recordedAudioURL);
            }
            setRecordedAudioURL(null);
            setPronunciationFeedback({ text: '', isCorrect: false, score: 0 });

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setMediaStream(stream);
                const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
                mediaRecorderRef.current = recorder;
                
                const audioChunks: Blob[] = [];
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        audioChunks.push(e.data);
                    }
                };

                recorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    setRecordedAudioURL(audioUrl);

                    setIsLoading(true);
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = async () => {
                        try {
                            const base64 = (reader.result as string).split(',')[1];
                            const targetPhrase = item.type === 'word' ? item.data.word : item.data.phrase;
                            const result = await analyzePronunciation(base64, targetPhrase);
                            setPronunciationFeedback({ text: result.feedback, isCorrect: result.isCorrect, score: result.score });
                            
                            if (result.isCorrect) {
                                let finalWordUpdate: VocabularyWord;
                                const actualMastery = item.type === 'word' ? item.data.masteryLevel : item.data.masteryLevel;
                                const newMastery = Math.min(4, actualMastery + 1);

                                if (item.type === 'word') {
                                    finalWordUpdate = { ...item.data, masteryLevel: newMastery as any, pronunciationAttempts: [], isBacklogged: false };
                                } else {
                                    const updatedCollocations = item.parentWord.collocations!.map(c => 
                                        c.phrase === item.data.phrase ? { ...c, masteryLevel: newMastery as any, pronunciationAttempts: [] } : c
                                    );
                                    finalWordUpdate = { ...item.parentWord, collocations: updatedCollocations, isBacklogged: false };
                                }
                                onUpdate(finalWordUpdate);
                            }
                        } catch (error) {
                            console.error("Pronunciation analysis failed:", error);
                            setPronunciationFeedback({ text: "Không thể phân tích giọng nói. Vui lòng thử lại.", isCorrect: false, score: 0 });
                        } finally {
                            setIsLoading(false);
                        }
                    };
                };

                recorder.start();
                setIsRecording(true);
            } catch (err) { console.error(err); }
        }
    };

    const handleForcePass = () => {
        let updatedWord: VocabularyWord;
        const newMastery = 4; // Force to max level to pass the skill

        if (item.type === 'word') {
            updatedWord = { ...item.data, masteryLevel: newMastery as any, isBacklogged: false };
        } else {
            const updatedCollocations = item.parentWord.collocations!.map(c => 
                c.phrase === item.data.phrase ? { ...c, masteryLevel: newMastery as any } : c
            );
            updatedWord = { ...item.parentWord, collocations: updatedCollocations, isBacklogged: false };
        }
        onUpdate(updatedWord);
        onComplete();
    };
    
    return (
        <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 animate-in zoom-in duration-300 relative border border-slate-200">
           <div className="flex justify-between items-center mb-8">
               <button onClick={onComplete} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-800 transition-colors">
                   <CornerDownLeft size={16} /> Thoát rèn luyện
               </button>
               
               <div className="flex items-center gap-2">
                    <button 
                        onClick={onToggleTts}
                        className={`p-2 rounded-full shadow-sm border transition-all ${
                            ttsMode === 'ai' 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100' 
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                        title={ttsMode === 'ai' ? "Đang dùng giọng AI (Click để đổi sang giọng máy)" : "Đang dùng giọng máy (Click để đổi sang giọng AI)"}
                    >
                        {ttsMode === 'ai' ? <Sparkles size={18} /> : <Keyboard size={18} />}
                    </button>
                   <button onClick={handleSkip} className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 font-bold hover:bg-amber-200 transition-colors">
                       <SkipForward size={14} /> Tạm bỏ qua
                   </button>
               </div>
           </div>
           
           {isLoading ? (
               <div className="flex flex-col items-center justify-center py-20 gap-4">
                   <Loader2 className="animate-spin text-teal-500" size={48} />
                   <p className="text-slate-400 font-medium italic">{loadingText}</p>
               </div>
           ) : (
               <div className="text-center">
                   {challengeType === 'meaning' && (
                       <div className="space-y-6">
                           <div className="flex flex-col items-center">
                               <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-4">
                                   <Lightbulb size={24} />
                               </div>
                               <h3 className="text-2xl font-bold text-slate-800">Hiểu nghĩa của từ</h3>
                               <p className="text-slate-500 mt-2">Dựa vào định nghĩa bên dưới, hãy chọn từ chính xác.</p>
                           </div>
                           
                           <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 relative group">
                               <p className="text-xl serif text-slate-700 leading-relaxed italic" dangerouslySetInnerHTML={{ __html: item.type === 'word' ? `"${currentData.meaning}"` : quiz?.sentence.replace('___', '<b class="text-teal-600">___</b>') || '' }} />
                               <button 
                                   onClick={() => playTTS(item.type === 'word' ? item.data.word : item.data.phrase)}
                                   className="absolute top-2 right-2 p-2 text-slate-400 hover:text-teal-600 bg-white rounded-full shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                   title="Nghe phát âm"
                                   disabled={isTtsLoading}
                               >
                                   {isTtsLoading ? <Loader2 size={16} className="animate-spin text-teal-500" /> : <Volume2 size={16} />}
                               </button>
                               {ttsError && <span className="absolute top-12 right-2 text-[10px] text-red-500 bg-red-50 px-1 rounded animate-pulse">AI Lỗi</span>}
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto">
                               {options.map(opt => {
                                   const isSelected = selectedOption === opt;
                                   const isCorrect = opt === (item.type === 'word' ? item.data.word : quiz?.correctAnswer);
                                   
                                   let btnClass = "p-4 rounded-xl border-2 transition-all font-bold text-slate-700 ";
                                   if (answerStatus) {
                                       if (isSelected) {
                                           btnClass += answerStatus === 'correct' 
                                               ? "bg-green-50 border-green-500 text-green-700 scale-105" 
                                               : "bg-red-50 border-red-500 text-red-700 animate-shake";
                                       } else if (answerStatus === 'incorrect' && isCorrect) {
                                           btnClass += "bg-green-50 border-green-500 text-green-700 animate-pulse";
                                       } else {
                                           btnClass += "bg-white border-slate-100 opacity-50";
                                       }
                                   } else {
                                       btnClass += "bg-white border-slate-100 hover:border-teal-500 hover:bg-teal-50";
                                   }

                                   return (
                                       <button 
                                           key={opt} 
                                           onClick={() => handleAnswer(opt)} 
                                           className={btnClass}
                                           disabled={!!answerStatus}
                                       >
                                           <div className="flex items-center justify-center gap-2">
                                               {opt}
                                               {answerStatus === 'correct' && isSelected && <CheckCircle2 size={18} />}
                                               {answerStatus === 'incorrect' && isSelected && <XCircle size={18} />}
                                               {answerStatus === 'incorrect' && isCorrect && !isSelected && <CheckCircle2 size={18} />}
                                           </div>
                                       </button>
                                   );
                               })}
                           </div>
                       </div>
                   )}

                   {challengeType === 'listening' && (
                       <div className="space-y-6">
                           <div className="flex flex-col items-center">
                               <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                   <Ear size={24} />
                               </div>
                               <h3 className="text-2xl font-bold text-slate-800">Nhận diện âm thanh</h3>
                               <p className="text-slate-500 mt-2">Nghe cách phát âm và chọn đúng từ/cụm từ.</p>
                           </div>

                           <button onClick={() => playTTS(item.type === 'word' ? item.data.word : item.data.phrase)} className="mx-auto w-24 h-24 rounded-full bg-teal-600 text-white shadow-xl shadow-teal-600/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform group relative" disabled={isTtsLoading}>
                               <Volume2 size={40} className="group-hover:animate-pulse" />
                           </button>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto mt-6">
                               {options.map(opt => {
                                   const isSelected = selectedOption === opt;
                                   const isCorrect = opt === (item.type === 'word' ? item.data.word : item.data.phrase);
                                   
                                   let btnClass = "p-4 rounded-xl border-2 transition-all font-bold text-slate-700 ";
                                   if (answerStatus) {
                                       if (isSelected) {
                                           btnClass += answerStatus === 'correct' 
                                               ? "bg-green-50 border-green-500 text-green-700 scale-105" 
                                               : "bg-red-50 border-red-500 text-red-700 animate-shake";
                                       } else if (answerStatus === 'incorrect' && isCorrect) {
                                           btnClass += "bg-green-50 border-green-500 text-green-700 animate-pulse";
                                       } else {
                                           btnClass += "bg-white border-slate-100 opacity-50";
                                       }
                                   } else {
                                       btnClass += "bg-white border-slate-100 hover:border-teal-500 hover:bg-teal-50";
                                   }

                                   return (
                                       <button 
                                           key={opt} 
                                           onClick={() => handleAnswer(opt)} 
                                           className={btnClass}
                                           disabled={!!answerStatus}
                                       >
                                           <div className="flex items-center justify-center gap-2">
                                               {opt}
                                               {answerStatus === 'correct' && isSelected && <CheckCircle2 size={18} />}
                                               {answerStatus === 'incorrect' && isSelected && <XCircle size={18} />}
                                               {answerStatus === 'incorrect' && isCorrect && !isSelected && <CheckCircle2 size={18} />}
                                           </div>
                                       </button>
                                   );
                               })}
                           </div>
                       </div>
                   )}

                   {challengeType === 'writing' && (
                       <div className="space-y-6">
                           <div className="flex flex-col items-center">
                               <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
                                   <Keyboard size={24} />
                               </div>
                               <h3 className="text-2xl font-bold text-slate-800">Luyện viết (Spelling)</h3>
                               <p className="text-slate-500 mt-2">Nghe âm thanh và gõ lại chính xác từ vựng.</p>
                           </div>

                           <button onClick={() => playTTS(item.type === 'word' ? item.data.word : item.data.phrase)} className="mx-auto w-20 h-20 rounded-full bg-teal-600 text-white shadow-xl shadow-teal-600/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform group">
                               <Volume2 size={32} className="group-hover:animate-pulse" />
                           </button>

                           <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mt-4">
                               <p className="text-sm text-slate-600 mb-2">Gợi ý nghĩa: <span className="font-medium italic">{currentData.meaning}</span></p>
                           </div>

                            <form onSubmit={handleWritingSubmit} className="max-w-md mx-auto mt-6">
                               <div className="relative">
                                   <input 
                                       type="text" 
                                       value={writingInput}
                                       onChange={(e) => setWritingInput(e.target.value)}
                                       placeholder="Gõ từ vựng vào đây..."
                                       className={`w-full p-4 text-center text-xl font-bold rounded-xl border-2 focus:outline-none transition-colors ${
                                           writingStatus === 'correct' ? 'border-green-500 bg-green-50 text-green-700' : 
                                           writingStatus === 'incorrect' ? 'border-red-500 bg-red-50 text-red-700 animate-shake' : 
                                           'border-slate-200 focus:border-teal-500'
                                       }`}
                                       autoFocus
                                       disabled={writingStatus === 'correct'}
                                       autoComplete="off"
                                       spellCheck="false"
                                   />
                                   {writingStatus === 'correct' && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" size={24} />}
                                   {writingStatus === 'incorrect' && <XCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500" size={24} />}
                               </div>
                               
                               {usedHint && writingStatus !== 'correct' && (
                                   <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm animate-in fade-in slide-in-from-top-2">
                                       <span className="font-bold block mb-1">Gợi ý từ đúng:</span>
                                       <span className="font-mono text-lg tracking-wider">{item.type === 'word' ? item.data.word : item.data.phrase}</span>
                                       <p className="text-xs mt-1 opacity-80">Hãy gõ lại từ này để tiếp tục.</p>
                                   </div>
                               )}

                               <button 
                                   type="submit" 
                                   className="w-full mt-4 py-3 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition-colors disabled:opacity-50"
                                   disabled={!writingInput.trim() || writingStatus === 'correct'}
                               >
                                   Kiểm tra
                               </button>
                           </form>
                       </div>
                   )}

                   {challengeType === 'pronunciation' && (
                       <div className="space-y-6">
                           <div className="flex flex-col items-center">
                               <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4">
                                   <Mic size={24} />
                               </div>
                               <h3 className="text-2xl font-bold text-slate-800">Luyện phát âm chuẩn</h3>
                               <p className="text-slate-500 mt-2">Hãy nói thật to và rõ ràng từ vựng này.</p>
                           </div>

                           <div className="py-8 px-4 bg-slate-50 rounded-3xl border border-slate-200">
                               <h4 className="text-5xl font-black text-teal-800 tracking-tight">{item.type === 'word' ? item.data.word : item.data.phrase}</h4>
                               {item.type === 'word' && <p className="text-xl font-mono text-slate-400 mt-2">/{item.data.ipa}/</p>}
                               <button onClick={() => playTTS(item.type === 'word' ? item.data.word : item.data.phrase)} className="mt-4 text-teal-600 font-bold flex items-center gap-1 mx-auto hover:underline"><Volume2 size={16}/> Nghe lại mẫu</button>
                           </div>

                           <div className="flex flex-col items-center gap-6">
                               <div className="flex items-center gap-4">
                                   <button onClick={toggleRecording} className={`w-20 h-20 rounded-full shadow-2xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 ring-8 ring-red-100 animate-pulse' : 'bg-teal-600 hover:bg-teal-700'} text-white`}>
                                       {isRecording ? <div className="w-6 h-6 bg-white rounded-sm" /> : <Mic size={32} />}
                                   </button>
                                   <AudioWaveform stream={mediaStream} />
                               </div>
                               
                               {pronunciationFeedback.text && (
                                    <div className={`w-full max-w-md p-4 rounded-2xl flex items-start gap-3 border shadow-sm ${pronunciationFeedback.isCorrect ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                                        <div className="flex flex-col items-center justify-center mr-2">
                                            <div className="text-2xl font-black">{pronunciationFeedback.score}</div>
                                            <div className="text-[10px] uppercase tracking-widest opacity-70">Điểm</div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-left leading-relaxed whitespace-pre-line text-slate-800">{pronunciationFeedback.text.replace(/\*\*/g, '').replace(/\*/g, '')}</p>
                                            {recordedAudioURL && !pronunciationFeedback.isCorrect && (
                                                <button 
                                                    onClick={() => new Audio(recordedAudioURL).play()}
                                                    className="mt-3 flex items-center gap-2 text-xs font-bold bg-white/50 px-3 py-1.5 rounded-lg hover:bg-white/80 transition-colors"
                                                >
                                                    <Play size={14} /> Nghe lại bản ghi âm
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                {pronunciationFeedback.isCorrect && (
                                    <button onClick={onComplete} className="mt-4 px-8 py-3 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20 animate-in fade-in slide-in-from-bottom-4">
                                        Tiếp tục <ArrowRight size={18} className="inline ml-1" />
                                    </button>
                                )}
                           </div>
                           
                           <button onClick={handleForcePass} className="mt-8 text-sm text-slate-400 hover:text-slate-600 underline font-medium">
                               Khó quá? Bỏ qua kỹ năng này (Đánh dấu đã hoàn thành)
                           </button>
                       </div>
                   )}

                   {hint && (
                       <div className="mt-10 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3 text-left max-w-lg mx-auto">
                           <Sparkles className="text-blue-500 mt-0.5 flex-shrink-0" size={18} />
                           <div>
                               <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Mẹo ghi nhớ (Mnemonic)</span>
                               <p className="text-sm text-blue-800 font-medium whitespace-pre-wrap">{hint}</p>
                           </div>
                       </div>
                   )}
               </div>
           )}
        </div>
    );
};

export default Vocabulary;
