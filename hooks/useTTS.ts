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
    
    // Split by punctuation first to preserve natural speaking pauses
    const sentences = cleanText.split(/([.!?。、,，;；])\s*/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const part of sentences) {
      if (!part) continue;
      // If it's single punctuation, bundle it to previous chunk
      if (/^[.!?。、,，;；]$/.test(part)) {
        currentChunk += part;
        continue;
      }

      if ((currentChunk + ' ' + part).length <= maxLen) {
        currentChunk = currentChunk ? currentChunk + ' ' + part : part;
      } else {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        if (part.length > maxLen) {
          const words = part.split(/\s+/);
          currentChunk = '';
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
      // Unstick SpeechSynthesis in Chromium-based browsers
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
      
      // Protect utterance from premature garbage collection in Chrome
      (window as any).activeUtterance = utterance;

      let completed = false;
      const handleCompleted = () => {
        if (completed) return;
        completed = true;
        clearTimeout(safetyTimer);
        (window as any).activeUtterance = null;
        onEnded();
      };

      // Proportional safety timeout for active playback (120ms per character + 6s startup buffer)
      const safetyDuration = Math.max(12000, chunkText.length * 120 + 6000);
      let safetyTimer = setTimeout(() => {
        if (mySequenceId === currentSequenceId) {
          console.warn('[TTS-Fallback] SpeechSynthesis safety timeout reached for:', chunkText);
          handleCompleted();
        }
      }, safetyDuration); 

      utterance.onstart = () => {
        if (mySequenceId === currentSequenceId) {
          setIsLoading(false);
        }
      };

      utterance.onend = () => {
        if (mySequenceId === currentSequenceId) {
          handleCompleted();
        }
      };

      utterance.onerror = (e) => {
        console.warn('[TTS-Fallback] SpeechSynthesis error:', e);
        if (mySequenceId === currentSequenceId) {
          handleCompleted();
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
      
      const cleanTextForSpeech = (rawText: string) => {
        if (!rawText) return '';
        return rawText
          // Strip image tags first ![alt](url) -> alt
          .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
          // Strip link tags [text](url) -> text
          .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
          // Remove backslash escapes entirely so they aren't spoken as "backslash"
          .replace(/\\/g, '')
          // Globally strip all asterisk markers (*) from bold/italic markup
          .replace(/\*/g, '')
          // Globally strip all underscore markers (_)
          .replace(/_/g, '')
          // Globally strip all hash title signs (#)
          .replace(/#/g, '')
          // Globally strip tilde signs (~)
          .replace(/~/g, '')
          // Globally strip backtick highlights (`)
          .replace(/`/g, '')
          // Remove blockquotes marker at the start of lines
          .replace(/^\s*>\s+/gm, '')
          // Remove list bullets / list indicators
          .replace(/^\s*[\*\-+]\s+/gm, '')
          // Remove line separators like ____________
          .replace(/[\\_L]{3,}/g, '')
          // Normalize and compress repeated whitespace down to a single space
          .replace(/\s+/g, ' ')
          .trim();
      };

      const cleanedText = cleanTextForSpeech(text);
      const targetLang = isVietnamese(cleanedText) ? 'vi' : 'en';

      const chunks = splitIntoChunks(cleanedText, 160);
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

        // Track chunk completion status to avoid duplicate progression
        let chunkCompleted = false;
        let loadingTimer: any = null;
        let playbackSafetyTimer: any = null;

        const onChunkCompleted = () => {
          if (chunkCompleted) return;
          chunkCompleted = true;
          
          // Clear all active timers for this chunk
          if (loadingTimer) clearTimeout(loadingTimer);
          if (playbackSafetyTimer) clearTimeout(playbackSafetyTimer);
          
          if (mySequenceId === currentSequenceId) {
            index++;
            playNextChunk();
          }
        };

        // Browser mode goes straight to local voice SpeechSynthesis
        if (activeMode === 'browser') {
          fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
          return;
        }

        // AI Mode Setup: Same-Origin API Proxy URL
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

        // 1. Loading Timeout: If it has not started playing in 4 seconds, fallback to SpeechSynthesis
        loadingTimer = setTimeout(() => {
          if (mySequenceId === currentSequenceId && !chunkCompleted) {
            console.warn(`[TTS-Loading-Timeout] Slow network/error loading chunk ${index}. Switching to SpeechSynthesis fallback.`);
            
            // Clean/Pause the audio tag before fallback so it doesn't cross-speak later
            audio.onplay = null;
            audio.onended = null;
            audio.onerror = null;
            try { audio.pause(); } catch(e){}
            
            fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
          }
        }, 4000);

        audio.onplay = () => {
          if (mySequenceId === currentSequenceId) {
            setIsLoading(false);
            
            // Success! Clear the loading timeout
            if (loadingTimer) {
              clearTimeout(loadingTimer);
              loadingTimer = null;
            }
            
            // Set a generous fallback playback safety timer proportional to character length
            // (140ms per character + generous 8s safety margin)
            const playDuration = Math.max(16000, currentChunk.length * 140 + 8000);
            if (playbackSafetyTimer) clearTimeout(playbackSafetyTimer);
            playbackSafetyTimer = setTimeout(() => {
              if (mySequenceId === currentSequenceId && !chunkCompleted) {
                console.warn(`[TTS-Playback-Timeout] Active playback safety limit reached for chunk ${index}. Advancing to release UI.`);
                onChunkCompleted();
              }
            }, playDuration);
          }
        };

        audio.onended = () => {
          onChunkCompleted();
        };

        audio.onerror = (err) => {
          if (chunkCompleted) return;
          console.warn(`[TTS-Proxy-Error] Same-origin proxy failed or blocked. Trying direct cloud url.`, err);
          
          if (loadingTimer) {
            clearTimeout(loadingTimer);
            loadingTimer = null;
          }
          
          // Retry direct cloud provider URL as backup
          const directUrl = targetLang === 'en'
            ? `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(currentChunk)}`
            : `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(currentChunk)}`;

          audio.onplay = null;
          audio.onended = null;
          audio.onerror = null;

          let retryLoadingTimer = setTimeout(() => {
            if (mySequenceId === currentSequenceId && !chunkCompleted) {
              console.warn(`[TTS-Retry-Loading-Timeout] Direct URL load stalled. Defaulting to voice synthesis.`);
              try { audio.pause(); } catch(e){}
              fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
            }
          }, 3500);

          audio.onplay = () => {
            if (mySequenceId === currentSequenceId) {
              setIsLoading(false);
              clearTimeout(retryLoadingTimer);
              
              const playDuration = Math.max(16000, currentChunk.length * 140 + 8000);
              if (playbackSafetyTimer) clearTimeout(playbackSafetyTimer);
              playbackSafetyTimer = setTimeout(() => {
                if (mySequenceId === currentSequenceId && !chunkCompleted) {
                  onChunkCompleted();
                }
              }, playDuration);
            }
          };

          audio.onended = () => {
            clearTimeout(retryLoadingTimer);
            onChunkCompleted();
          };

          audio.onerror = () => {
            if (chunkCompleted) return;
            clearTimeout(retryLoadingTimer);
            console.warn(`[TTS-Fallback] Direct URL also failed. Launching browser SpeechSynthesis...`);
            fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
          };

          audio.src = directUrl;
          audio.load();
          audio.play().catch(() => {
            if (chunkCompleted) return;
            clearTimeout(retryLoadingTimer);
            fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
          });
        };

        // Kick off original audio proxy request
        audio.src = proxyUrl;
        audio.load();
        
        try {
          audio.playbackRate = 1.0;
        } catch (e) {}

        audio.play().catch(playErr => {
          if (chunkCompleted) return;
          if (loadingTimer) {
            clearTimeout(loadingTimer);
            loadingTimer = null;
          }
          console.warn(`[TTS-Autoplay-Blocked] Autoplay blocked by browser. Falling back to SpeechSynthesis.`, playErr);
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
