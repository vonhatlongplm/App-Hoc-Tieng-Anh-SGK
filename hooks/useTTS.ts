import { useState, useRef, useCallback, useEffect } from 'react';

export type TTSMode = 'ai' | 'browser';

// Reusable global HTMLAudioElement to prevent multiple overlap, GC issues, and memory leaks
let globalAudio: HTMLAudioElement | null = null;
let currentSequenceId: number = 0;
let localGlobalVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && window.speechSynthesis) {
  localGlobalVoices = window.speechSynthesis.getVoices();
  if (localGlobalVoices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      localGlobalVoices = window.speechSynthesis.getVoices();
    };
  }
}

const getGlobalAudio = () => {
  if (typeof window === 'undefined') return null;
  if (!globalAudio) {
    globalAudio = new Audio();
  }
  return globalAudio;
};

export const useTTS = () => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto clean up on hook unmount
  useEffect(() => {
    audioRef.current = getGlobalAudio();
  }, []);

  const isVietnamese = (txt: string) => {
    const viChars = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠÂẦẤẨẪẬĂẰẮĂẲẴẶÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸYĐ]/;
    return viChars.test(txt);
  };

  const getBestVoice = (lang: string, mode: 'ai' | 'browser'): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    
    const voices = window.speechSynthesis.getVoices();
    const langLower = lang.toLowerCase();
    const matchedVoices = voices.filter(v => 
      v.lang.toLowerCase().replace('_', '-').startsWith(langLower)
    );
    
    if (matchedVoices.length === 0) return null;
    
    if (mode === 'ai') {
      const premiumKeywords = ['natural', 'neural', 'online', 'google', 'apple', 'samantha', 'aria', 'guy', 'liam', 'chi', 'hoaimy', 'namminh', 'premium', 'male', 'female'];
      const sorted = [...matchedVoices].sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        let scoreA = 0;
        let scoreB = 0;
        premiumKeywords.forEach(kw => {
          if (nameA.includes(kw)) scoreA += 1;
          if (nameB.includes(kw)) scoreB += 1;
        });
        if (nameA.includes('natural') || nameA.includes('online')) scoreA += 5;
        if (nameB.includes('natural') || nameB.includes('online')) scoreB += 5;
        return scoreB - scoreA;
      });
      return sorted[0];
    } else {
      const standardKeywords = ['david', 'zira', 'hazel', 'desktop', 'local', 'offline'];
      const sorted = [...matchedVoices].sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        let scoreA = 0;
        let scoreB = 0;
        standardKeywords.forEach(kw => {
          if (nameA.includes(kw)) scoreA += 5;
          if (nameB.includes(kw)) scoreB += 5;
        });
        if (nameA.includes('natural') || nameA.includes('neutral') || nameA.includes('online')) scoreA -= 10;
        if (nameB.includes('natural') || nameB.includes('neutral') || nameB.includes('online')) scoreB -= 10;
        return scoreB - scoreA;
      });
      return sorted[0];
    }
  };

  const splitIntoChunks = (text: string, maxLen = 160): string[] => {
    const cleanText = text.replace(/[\r\n]+/g, ' ').trim();
    if (!cleanText) return [];
    
    const sentences = cleanText.split(/([.!?。、，;；,])\s*/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const part of sentences) {
      if (!part) continue;
      if ((currentChunk + part).length <= maxLen) {
        currentChunk += part;
      } else {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        if (part.length > maxLen) {
          const words = part.split(/\s+/);
          for (const word of words) {
            if ((currentChunk + ' ' + word).trim().length <= maxLen) {
              currentChunk = (currentChunk + ' ' + word).trim();
            } else {
              if (currentChunk.trim()) chunks.push(currentChunk.trim());
              currentChunk = word;
            }
          }
        } else {
          currentChunk = part;
        }
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  };

  // Local browser SpeechSynthesis fallback
  const fallbackSpeechSynthesisForChunk = useCallback((
    chunkText: string,
    lang: string,
    mySequenceId: number,
    onEnded: () => void
  ) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEnded();
      return;
    }

    try {
      // Unstick SpeechSynthesis in Chromium
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(chunkText);
      const activeMode = typeof window !== 'undefined' ? (localStorage.getItem('vocab_tts_mode') as 'ai' | 'browser') || 'ai' : 'ai';
      const selectedVoice = getBestVoice(lang, activeMode);
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = lang === 'en' ? 'en-US' : 'vi-VN';
      }

      utterance.rate = lang === 'en' ? 0.95 : 0.85;
      
      // GC protection
      (window as any).activeUtterance = utterance;

      let safetyTimer = setTimeout(() => {
        if (mySequenceId === currentSequenceId) {
          console.warn('[TTS-Fallback] SpeechSynthesis safety timeout reached.');
          (window as any).activeUtterance = null;
          onEnded();
        }
      }, 4000); 

      utterance.onstart = () => {
        if (mySequenceId === currentSequenceId) {
          setIsLoading(false);
        }
      };

      utterance.onend = () => {
        clearTimeout(safetyTimer);
        (window as any).activeUtterance = null;
        if (mySequenceId === currentSequenceId) {
          onEnded();
        }
      };

      utterance.onerror = (e) => {
        console.warn('[TTS-Fallback] SpeechSynthesis error:', e);
        clearTimeout(safetyTimer);
        (window as any).activeUtterance = null;
        if (mySequenceId === currentSequenceId) {
          onEnded();
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[TTS-Fallback] Error in SpeechSynthesis speak:', e);
      onEnded();
    }
  }, []);

  const stopTTS = useCallback(() => {
    setIsLoading(false);
    currentSequenceId++; 
    
    // Stop global audio
    const audio = getGlobalAudio();
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {}
    }
    
    // Stop SpeechSynthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      (window as any).activeUtterance = null;
    }
  }, []);

  const playTTS = useCallback(async (
    text: string, 
    mode?: TTSMode, 
    onEndCallback?: () => void
  ) => {
    // 1. Immediately reset playback and advance sequence id
    stopTTS();

    setIsLoading(true);
    const mySequenceId = ++currentSequenceId;

    try {
      const activeMode = mode || (typeof window !== 'undefined' ? (localStorage.getItem('vocab_tts_mode') as TTSMode) : 'ai') || 'ai';
      const targetLang = isVietnamese(text) ? 'vi' : 'en';

      const chunks = splitIntoChunks(text, 160);
      if (chunks.length === 0) {
        setIsLoading(false);
        onEndCallback?.();
        return;
      }

      let index = 0;

      const playNextChunk = () => {
        if (mySequenceId !== currentSequenceId) return;

        if (index >= chunks.length) {
          setIsLoading(false);
          onEndCallback?.();
          return;
        }

        const currentChunk = chunks[index];

        // --- GLOBAL SAFETY GUARD ---
        // Guaranteed to release loading state and move forward after max 4.5 seconds per chunk
        let chunkCompleted = false;
        const safetyTimer = setTimeout(() => {
          if (mySequenceId === currentSequenceId && !chunkCompleted) {
            console.warn(`[TTS-Safety] 4.5s threshold reached on chunk ${index}. Bypassing loader.`);
            chunkCompleted = true;
            setIsLoading(false);
            index++;
            playNextChunk();
          }
        }, 4500);

        const onChunkCompleted = () => {
          if (chunkCompleted) return;
          chunkCompleted = true;
          clearTimeout(safetyTimer);
          if (mySequenceId === currentSequenceId) {
            index++;
            playNextChunk();
          }
        };

        // Browser mode goes straight to local voice Synthesis
        if (activeMode === 'browser') {
          fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
          return;
        }

        // AI Mode: Same-Origin Server Proxy URL (Absolute bulletproof against CORS and sandboxed browser policies)
        const proxyUrl = `/api/tts?text=${encodeURIComponent(currentChunk)}&lang=${targetLang}`;
        const audio = getGlobalAudio();

        if (!audio) {
          fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
          return;
        }

        // Reset any prior handler setups to avoid overlapping hooks
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
        audio.oncanplay = null;

        audio.onplay = () => {
          if (mySequenceId === currentSequenceId) {
            setIsLoading(false);
          }
        };

        audio.onended = () => {
          onChunkCompleted();
        };

        audio.onerror = (err) => {
          if (chunkCompleted) return;
          console.warn(`[TTS-Proxy-Error] Same-origin proxy delivery failed or blocked. trying direct url.`, err);
          
          // Retry direct cloud provider URL (some corporate/strict proxies might block specific server endpoints)
          const directUrl = targetLang === 'en'
            ? `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(currentChunk)}`
            : `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(currentChunk)}`;

          audio.onplay = () => {
            if (mySequenceId === currentSequenceId) {
              setIsLoading(false);
            }
          };

          audio.onended = () => {
            onChunkCompleted();
          };

          audio.onerror = () => {
            if (chunkCompleted) return;
            console.warn(`[TTS-Fallback] Direct URL failed too. Activating SpeechSynthesis as final resort...`);
            fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
          };

          audio.src = directUrl;
          audio.load();
          audio.play().catch(() => {
            if (chunkCompleted) return;
            fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
          });
        };

        // Kick off audio play
        audio.src = proxyUrl;
        audio.load();
        
        try {
          audio.playbackRate = 1.0;
        } catch (e) {}

        audio.play().catch(playErr => {
          if (chunkCompleted) return;
          console.warn(`[TTS-Autoplay-Blocked] Same-origin auto-play blocked by browser policy. Falling back to SpeechSynthesis.`, playErr);
          fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
        });
      };

      playNextChunk();

    } catch (err) {
      console.error("[TTS] Unhandled playTTS failure:", err);
      setIsLoading(false);
      onEndCallback?.();
    }
  }, [stopTTS, fallbackSpeechSynthesisForChunk]);

  return {
    playTTS,
    stopTTS,
    isTtsLoading: isLoading,
    ttsError: null
  };
};
