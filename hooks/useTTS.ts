import { useState, useRef } from 'react';

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
        
        if (nameA.includes('natural') || nameA.includes('online')) scoreA += 5;
        if (nameB.includes('natural') || nameB.includes('online')) scoreB += 5;
        
        return scoreB - scoreA;
      });
      
      return sorted[0];
    } else {
      // "Giọng Máy": Prefer classic, traditional offline desktop voices
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

  // Local fallback SpeechSynthesis for a single chunk
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
      // Cancel is safe but might interrupt other speak, queue is reset on stopTTS anyway
      window.speechSynthesis.cancel(); 
      
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
          console.warn('[TTS-Fallback] SpeechSynthesis safety timeout reached. Auto-advancing to release UI.');
          (window as any).activeUtterance = null;
          onEnded();
        }
      }, 5000); // Max 5s for fallback safety

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
        console.warn('[TTS-Fallback] SpeechSynthesis error event:', e);
        clearTimeout(safetyTimer);
        (window as any).activeUtterance = null;
        if (mySequenceId === currentSequenceId) {
          onEnded();
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[TTS-Fallback] Error playing with SpeechSynthesis:', e);
      onEnded();
    }
  };

  const playTTS = async (
    text: string, 
    mode?: TTSMode, 
    onEndCallback?: () => void
  ) => {
    // 1. Dọn dẹp luồng phát cũ lập tức
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

        // --- CƠ CHẾ AN TOÀN TẬP TRUNG (Safety Timeout) ---
        // Cam kết giải phóng UI sau tối đa 6 giây dưới bất kỳ điều kiện ngập mạng hoặc sự cố nào
        let targetTransitioned = false;
        const forceNextTimeout = setTimeout(() => {
          if (mySequenceId === currentSequenceId && !targetTransitioned) {
            console.warn(`[TTS-Safety] Safety guard activated for chunk ${index}. Forcing next chunk.`);
            targetTransitioned = true;
            cleanup();
            index++;
            playNextChunk();
          }
        }, 6000);

        const onChunkCompleted = () => {
          if (targetTransitioned) return;
          targetTransitioned = true;
          clearTimeout(forceNextTimeout);
          cleanup();
          if (mySequenceId === currentSequenceId) {
            index++;
            playNextChunk();
          }
        };

        // --- CƠ CHẾ CHỌN URL BẬP PHÁT ---
        // 1. Direct Client URL: Sử dụng IP dân cư người dùng, không bao giờ bị Google/Youdao chặn CORS hay Captcha.
        const directUrl = targetLang === 'en'
          ? `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(currentChunk)}`
          : `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(currentChunk)}`;

        // 2. Proxy Backup URL: Nếu tải trực tiếp bị thất bại.
        const proxyUrl = `/api/tts?text=${encodeURIComponent(currentChunk)}&lang=${targetLang}`;
        
        let playbackRate = 1.0;
        if (activeMode === 'browser') {
          playbackRate = targetLang === 'en' ? 0.92 : 0.82;
        }

        const audio = new Audio();
        audio.style.display = 'none';
        document.body.appendChild(audio);

        audioRef.current = audio;
        activeAudio = audio;

        // Bộ hẹn giờ khẩn cấp cho mạng (Network Tải) quá 1.8 giây thì nhảy sang SpeechSynthesis
        let networkFallbackTriggered = false;
        const networkTimeout = setTimeout(() => {
          if (mySequenceId === currentSequenceId && !networkFallbackTriggered && !targetTransitioned) {
            console.warn(`[TTS-Timeout] Network loading exceeded 1.8s for chunk ${index}. Switching to Web Speech API.`);
            networkFallbackTriggered = true;
            cleanup();
            fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
          }
        }, 1800);

        const cleanup = () => {
          clearTimeout(networkTimeout);
          try {
            if (audio.parentNode) {
              audio.parentNode.removeChild(audio);
            }
          } catch (e) {}
        };

        audio.onplay = () => {
          clearTimeout(networkTimeout);
          if (mySequenceId === currentSequenceId) {
            setIsLoading(false);
          }
        };

        audio.onended = () => {
          onChunkCompleted();
        };

        audio.onerror = (err) => {
          if (networkFallbackTriggered || targetTransitioned) return;
          console.warn(`[TTS-Error] Direct client audio failed to load/play:`, err);
          cleanup();
          
          if (mySequenceId === currentSequenceId) {
            // Thử nạp thông qua Proxy
            console.log(`[TTS-Retry] Trying proxy fetch on chunk ${index}...`);
            const backupAudio = new Audio();
            backupAudio.style.display = 'none';
            document.body.appendChild(backupAudio);
            
            audioRef.current = backupAudio;
            activeAudio = backupAudio;

            let proxyTimeoutTriggered = false;
            const proxyTimer = setTimeout(() => {
              if (mySequenceId === currentSequenceId && !proxyTimeoutTriggered && !targetTransitioned) {
                proxyTimeoutTriggered = true;
                try { backpackCleanup(); } catch(e){}
                fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
              }
            }, 1800);

            const backpackCleanup = () => {
              clearTimeout(proxyTimer);
              try {
                if (backupAudio.parentNode) {
                  backupAudio.parentNode.removeChild(backupAudio);
                }
              } catch(e){}
            };

            backupAudio.onplay = () => {
              clearTimeout(proxyTimer);
              if (mySequenceId === currentSequenceId) {
                setIsLoading(false);
              }
            };

            backupAudio.onended = () => {
              backpackCleanup();
              onChunkCompleted();
            };

            backupAudio.onerror = (proxyErr) => {
              if (proxyTimeoutTriggered || targetTransitioned) return;
              console.warn(`[TTS-Proxy-Error] Proxy route failed too:`, proxyErr);
              backpackCleanup();
              if (mySequenceId === currentSequenceId) {
                // Biện pháp khôi phục tối cao: SpeechSynthesis của Trình duyệt
                fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
              }
            };

            backupAudio.src = proxyUrl;
            backupAudio.load();
            try {
              backupAudio.playbackRate = playbackRate;
            } catch(e){}
            backupAudio.play().catch(() => {
              if (proxyTimeoutTriggered || targetTransitioned) return;
              backpackCleanup();
              if (mySequenceId === currentSequenceId) {
                fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
              }
            });
          }
        };

        // Gán src tải trực tiếp từ Cloud
        audio.src = directUrl;
        audio.load();

        audio.oncanplay = () => {
          try {
            audio.playbackRate = playbackRate;
          } catch (e) {}
        };

        audio.play().catch(playErr => {
          if (networkFallbackTriggered || targetTransitioned) return;
          console.warn(`[TTS-Autoplay] Direct play blocked or failed. Fallback to API/Local synthesis:`, playErr);
          cleanup();
          if (mySequenceId === currentSequenceId) {
            fallbackSpeechSynthesisForChunk(currentChunk, targetLang, mySequenceId, onChunkCompleted);
          }
        });
      };

      playNextChunk();

    } catch (err) {
      console.error("[TTS] Critical error in play loop:", err);
      setIsLoading(false);
      onEndCallback?.();
    }
  };

  const stopTTS = () => {
    setIsLoading(false);
    currentSequenceId++; // Tăng sequence ID ngay để ngắt các callback cũ đang chờ
    
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
