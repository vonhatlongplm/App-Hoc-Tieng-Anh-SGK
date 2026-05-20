import { useState, useRef, useEffect } from 'react';

export type TTSMode = 'ai' | 'browser';

// Keep global static references to prevent Garbage Collection issues in Chrome/V8
let activeAudio: HTMLAudioElement | null = null;
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

export const useTTS = () => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isVietnamese = (txt: string) => {
    // Check for unique Vietnamese accent characters
    const viChars = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠÂẦẤẨẪẬĂẰẮĂẲẴẶÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸYĐ]/;
    return viChars.test(txt);
  };

  const getBestVoice = (lang: string, mode: 'ai' | 'browser'): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    
    const voices = window.speechSynthesis.getVoices();
    const langLower = lang.toLowerCase();
    
    // Match voices by language prefix (e.g., 'en-US' or 'vi-VN')
    const matchedVoices = voices.filter(v => 
      v.lang.toLowerCase().replace('_', '-').startsWith(langLower)
    );
    
    if (matchedVoices.length === 0) return null;
    
    if (mode === 'ai') {
      // "Giọng AI": Look for premium, neural, high-quality, online, or modern brand voices first
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
        
        // Edge "Online (Natural)" voices should get a massive boost as they sound exceptionally fluent/natural
        if (nameA.includes('natural') || nameA.includes('online')) scoreA += 5;
        if (nameB.includes('natural') || nameB.includes('online')) scoreB += 5;
        
        return scoreB - scoreA;
      });
      
      return sorted[0];
    } else {
      // "Giọng Máy": Prefer classic, traditional offline desktop voices (like David, Zira, Hazel, or non-online voices)
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
        
        // Penalize online/neural models to keep "Giọng Máy" sounding classic/robotic
        if (nameA.includes('natural') || nameA.includes('neutral') || nameA.includes('online')) scoreA -= 10;
        if (nameB.includes('natural') || nameB.includes('neutral') || nameB.includes('online')) scoreB -= 10;
        
        return scoreB - scoreA;
      });
      
      return sorted[0];
    }
  };

  // Split into chunks of maximum character limit to be safe for Google Translate TTS API limit (200 chars)
  const splitIntoChunks = (text: string, maxLen = 160): string[] => {
    const cleanText = text.replace(/[\r\n]+/g, ' ').trim();
    if (!cleanText) return [];
    
    // Split by punctuation first to preserve natural speaking pauses
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
        // If a single word or part is super long, split mechanically by space
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

  // Local fallback SpeechSynthesis for a single chunk if Audio element fails or is blocked
  const fallbackSpeechSynthesisForChunk = (
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
      window.speechSynthesis.cancel(); // Clear any pending utterances
      
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
      
      // Explicitly protect from V8 Garbage Collection by attaching to window namespace
      (window as any).activeUtterance = utterance;

      let safetyTimer = setTimeout(() => {
        if (mySequenceId === currentSequenceId) {
          console.warn('[TTS-Local-Fallback] SpeechSynthesis safety timeout reached.');
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
        console.warn('[TTS-Local-Fallback] Error event:', e);
        clearTimeout(safetyTimer);
        (window as any).activeUtterance = null;
        if (mySequenceId === currentSequenceId) {
          onEnded();
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[TTS-Local-Fallback] Error playing with SpeechSynthesis:', e);
      onEnded();
    }
  };

  const playTTS = async (
    text: string, 
    mode?: TTSMode, 
    onEndCallback?: () => void
  ) => {
    // Stop any currently active text-to-speech instances
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
        
        // Always try Same-Origin proxy route first to avoid client CORS blocks & sandboxing limits
        const proxyUrl = `/api/tts?text=${encodeURIComponent(currentChunk)}&lang=${targetLang}`;
        
        // Define playback details
        let playbackRate = 1.0;
        if (activeMode === 'browser') {
          // Standard traditional robotic speed
          playbackRate = targetLang === 'en' ? 0.92 : 0.82;
        }

        const audio = new Audio();
        audio.style.display = 'none';
        document.body.appendChild(audio);

        audioRef.current = audio;
        activeAudio = audio;

        // Safety timeout for network chunk fetch: 4 seconds limit
        const chunkTimeout = setTimeout(() => {
          console.warn(`[TTS-Playlist] Timeout loading proxy audio chunk ${index}. Moving to fallback.`);
          cleanup();
          if (mySequenceId === currentSequenceId) {
            // Emergency fallback: try SpeechSynthesis before completely skipping
            fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, () => {
              index++;
              playNextChunk();
            });
          }
        }, 4000);

        const cleanup = () => {
          clearTimeout(chunkTimeout);
          try {
            if (audio.parentNode) {
              audio.parentNode.removeChild(audio);
            }
          } catch (e) {}
        };

        audio.onplay = () => {
          clearTimeout(chunkTimeout);
          if (mySequenceId === currentSequenceId) {
            setIsLoading(false);
          }
        };

        audio.onended = () => {
          cleanup();
          if (mySequenceId === currentSequenceId) {
            index++;
            playNextChunk();
          }
        };

        audio.onerror = (err) => {
          console.warn(`[TTS-Playlist] Proxy audio load error on chunk ${index}:`, err);
          cleanup();
          if (mySequenceId === currentSequenceId) {
            // Hot swap to SpeechSynthesis for this chunk so the user hears continuous voice
            fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, () => {
              index++;
              playNextChunk();
            });
          }
        };

        audio.src = proxyUrl;
        audio.load();

        audio.oncanplay = () => {
          try {
            audio.playbackRate = playbackRate;
          } catch (e) {}
        };

        audio.play().catch(playErr => {
          console.warn(`[TTS-Playlist] AutoPlay blocked or failed. Running SpeechSynthesis fallback:`, playErr);
          cleanup();
          if (mySequenceId === currentSequenceId) {
            fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, () => {
              index++;
              playNextChunk();
            });
          }
        });
      };

      playNextChunk();

    } catch (err) {
      console.error("[TTS] Critical failure in loop, initializing hard emergency cleanup:", err);
      setIsLoading(false);
      onEndCallback?.();
    }
  };

  const stopTTS = () => {
    setIsLoading(false);
    currentSequenceId++; // Break ongoing sequence immediately
    
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.currentTime = 0;
        if (activeAudio.parentNode) {
          activeAudio.parentNode.removeChild(activeAudio);
        }
      } catch (e) {}
      activeAudio = null;
    }
    
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        if (audioRef.current.parentNode) {
          audioRef.current.parentNode.removeChild(audioRef.current);
        }
      } catch (e) {}
      audioRef.current = null;
    }
    
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      (window as any).activeUtterance = null;
    }
  };

  return {
    playTTS,
    stopTTS,
    isTtsLoading: isLoading,
    ttsError: null
  };
};
