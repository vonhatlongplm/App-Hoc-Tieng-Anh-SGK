import { useState, useRef, useCallback, useEffect } from 'react';

export type TTSMode = 'ai' | 'browser';

// Reusable global HTMLAudioElement to prevent multiple overlap, GC issues, and memory leaks
let globalAudio1: HTMLAudioElement | null = null;
let globalAudio2: HTMLAudioElement | null = null;
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

const getAudioPool = () => {
  if (typeof window === 'undefined') return { audio1: null, audio2: null };
  if (!globalAudio1) {
    globalAudio1 = new Audio();
  }
  if (!globalAudio2) {
    globalAudio2 = new Audio();
  }
  return { audio1: globalAudio1, audio2: globalAudio2 };
};

const getGlobalAudio = () => {
  return getAudioPool().audio1;
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

  const splitIntoChunks = (cleanedText: string, maxLen = 160): string[] => {
    if (!cleanedText) return [];
    
    // Split into paragraphs/lines first to preserve structural pauses
    const lines = cleanedText.split('\n');
    const chunks: string[] = [];

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      // Split the line by punctuation to preserve natural speaking pauses
      const sentences = cleanLine.split(/([.!?。、,，;；:])\s*/);
      let currentChunk = '';

      for (const part of sentences) {
        if (!part) continue;
        
        // If it's single punctuation, bundle it to previous chunk
        if (/^[.!?。、,，;；:]$/.test(part)) {
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
    if (mySequenceId !== currentSequenceId) {
      return;
    }

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
    
    // Stop pool audio elements
    const { audio1, audio2 } = getAudioPool();
    [audio1, audio2].forEach((audio) => {
      if (audio) {
        try {
          audio.pause();
          audio.src = ''; // Clear source to stop net requests immediately
          try { audio.load(); } catch(e){}
          audio.onplay = null;
          audio.onended = null;
          audio.onerror = null;
          audio.oncanplay = null;
        } catch (e) {}
      }
    });
    
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
        
        // Strip markdown metadata & symbols, keeping newlines
        const stripped = rawText
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
          .replace(/[\\_L]{3,}/g, '');

        // Split by line, trim, collapse repeated spaces per line, filter empty lines
        const lines = stripped.split(/\r?\n/);
        const cleanedLines = lines
          .map(line => line.replace(/[ \t]+/g, ' ').trim())
          .filter(Boolean);

        return cleanedLines.join('\n');
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
        const targetLang = isVietnamese(currentChunk) ? 'vi' : 'en';

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

        const cleanPlayer = (player: HTMLAudioElement) => {
          try {
            player.onplay = null;
            player.onended = null;
            player.onerror = null;
            player.oncanplay = null;
            player.pause();
            player.src = '';
            try { player.load(); } catch (e) {}
          } catch (e) {}
        };

        // Browser mode goes straight to local voice SpeechSynthesis
        if (activeMode === 'browser') {
          fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
          return;
        }

        // AI Mode Setup using Audio Pool
        const { audio1, audio2 } = getAudioPool();
        if (!audio1 || !audio2) {
          fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
          return;
        }

        // Alternately use audio1 and audio2 for double preloading cache
        const currentPlayer = index % 2 === 0 ? audio1 : audio2;
        const preloader = index % 2 === 0 ? audio2 : audio1;

        let fallbackInProgress = false;
        let retryLoadingTimer: any = null;

        const triggerFallback = (reason: string) => {
          if (fallbackInProgress || chunkCompleted) return;
          fallbackInProgress = true;

          console.warn(`[TTS-Trigger-Fallback] Triggered on chunk ${index}. Reason: ${reason}`);

          if (loadingTimer) {
            clearTimeout(loadingTimer);
            loadingTimer = null;
          }
          if (retryLoadingTimer) {
            clearTimeout(retryLoadingTimer);
            retryLoadingTimer = null;
          }
          if (playbackSafetyTimer) {
            clearTimeout(playbackSafetyTimer);
            playbackSafetyTimer = null;
          }

          cleanPlayer(currentPlayer);
          fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
        };

        // Reset any prior handler setups on current player to avoid overlapping hooks
        currentPlayer.onplay = null;
        currentPlayer.onended = null;
        currentPlayer.onerror = null;
        currentPlayer.oncanplay = null;

        // Clean up preloader's handlers to stop it from invoking callbacks when it preloads in back
        preloader.onplay = null;
        preloader.onended = null;
        preloader.onerror = null;
        preloader.oncanplay = null;

        // Setup Player Source
        const proxyUrl = `/api/tts?text=${encodeURIComponent(currentChunk)}&lang=${targetLang}`;

        // Set up preloading for the next chunk (index + 1) in browser CacheStorage
        if (index + 1 < chunks.length) {
          const nextChunk = chunks[index + 1];
          const nextLang = isVietnamese(nextChunk) ? 'vi' : 'en';
          const nextProxyUrl = `/api/tts?text=${encodeURIComponent(nextChunk)}&lang=${nextLang}`;
          
          if (typeof window !== 'undefined' && 'caches' in window) {
            window.caches.open('tts-audio-cache').then(async (cache) => {
              const matched = await cache.match(nextProxyUrl);
              if (!matched) {
                fetch(nextProxyUrl).then(response => {
                  if (response.ok) cache.put(nextProxyUrl, response);
                }).catch(() => {});
              }
            }).catch(() => {});
          }
        }

        const loadAndPlay = async () => {
          let audioBlob: Blob | null = null;
          let isFromCache = false;

          // Try checking the browser CacheStorage first
          if (typeof window !== 'undefined' && 'caches' in window) {
            try {
              const cache = await window.caches.open('tts-audio-cache');
              const cachedResponse = await cache.match(proxyUrl);
              if (cachedResponse) {
                audioBlob = await cachedResponse.blob();
                isFromCache = true;
              } else {
                const response = await fetch(proxyUrl);
                if (response.ok) {
                  await cache.put(proxyUrl, response.clone());
                  audioBlob = await response.blob();
                }
              }
            } catch (e) {
              console.warn("[TTS-Cache] Error matching/saving to cache:", e);
            }
          }

          if (mySequenceId !== currentSequenceId || chunkCompleted) return;

          // If we successfully got a blob, load it as object URL
          if (audioBlob) {
            const blobUrl = URL.createObjectURL(audioBlob);
            currentPlayer.src = blobUrl;
            currentPlayer.load();
          } else {
            // Uncached fallback
            currentPlayer.src = proxyUrl;
            currentPlayer.load();
          }

          // Adjust rate first
          try {
            currentPlayer.playbackRate = 1.0;
          } catch (e) {}

          // 1. Loading Timeout: If it has not started playing in 4 seconds, fallback to SpeechSynthesis
          if (!isFromCache) {
            loadingTimer = setTimeout(() => {
              if (mySequenceId === currentSequenceId && !chunkCompleted) {
                triggerFallback("Loading timeout (4s)");
              }
            }, 4000);
          }

          currentPlayer.play().catch(playErr => {
            if (chunkCompleted) return;
            triggerFallback(`Autoplay blocked / playback error: ${playErr?.message || playErr}`);
          });
        };

        // Reset handlers
        currentPlayer.onplay = () => {
          if (mySequenceId === currentSequenceId) {
            setIsLoading(false);
            
            // Success! Clear the loading timeout
            if (loadingTimer) {
              clearTimeout(loadingTimer);
              loadingTimer = null;
            }
            
            // Set a generous fallback playback safety timer proportional to character length
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

        currentPlayer.onended = () => {
          onChunkCompleted();
        };

        currentPlayer.onerror = (err) => {
          if (chunkCompleted) return;
          console.warn(`[TTS-Proxy-Error] Cache/proxy load failed or blocked. Trying direct cloud url.`, err);
          
          if (loadingTimer) {
            clearTimeout(loadingTimer);
            loadingTimer = null;
          }
          
          // Retry direct cloud provider URL as backup (Use Google Translate for English to prevent audio repetition!)
          const directUrl = targetLang === 'en'
            ? `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(currentChunk)}`
            : `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(currentChunk)}`;

          currentPlayer.onplay = null;
          currentPlayer.onended = null;
          currentPlayer.onerror = null;

          retryLoadingTimer = setTimeout(() => {
            if (mySequenceId === currentSequenceId && !chunkCompleted) {
              triggerFallback("Retry direct URL load stalled (3.5s)");
            }
          }, 3500);

          currentPlayer.onplay = () => {
            if (mySequenceId === currentSequenceId) {
              setIsLoading(false);
              if (retryLoadingTimer) {
                clearTimeout(retryLoadingTimer);
                retryLoadingTimer = null;
              }
              
              const playDuration = Math.max(16000, currentChunk.length * 140 + 8000);
              if (playbackSafetyTimer) clearTimeout(playbackSafetyTimer);
              playbackSafetyTimer = setTimeout(() => {
                if (mySequenceId === currentSequenceId && !chunkCompleted) {
                  onChunkCompleted();
                }
              }, playDuration);
            }
          };

          currentPlayer.onended = () => {
            if (retryLoadingTimer) {
              clearTimeout(retryLoadingTimer);
              retryLoadingTimer = null;
            }
            onChunkCompleted();
          };

          currentPlayer.onerror = () => {
            if (chunkCompleted) return;
            triggerFallback("Direct URL load failed");
          };

          currentPlayer.src = directUrl;
          currentPlayer.load();
          currentPlayer.play().catch((playErr) => {
            if (chunkCompleted) return;
            triggerFallback(`Direct URL play catch: ${playErr?.message || playErr}`);
          });
        };

        loadAndPlay();
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
