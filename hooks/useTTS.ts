import { useState, useRef, useEffect } from 'react';

export type TTSMode = 'ai' | 'browser';

// Keep a global static reference to the playing audio so we can stop it precisely across hook calls
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
  const synthesisRef = useRef<boolean>(false);

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
        if (nameA.includes('natural') || nameA.includes('neural') || nameA.includes('online')) scoreA -= 10;
        if (nameB.includes('natural') || nameB.includes('neural') || nameB.includes('online')) scoreB -= 10;
        
        return scoreB - scoreA;
      });
      
      return sorted[0];
    }
  };

  const playTTS = async (
    text: string, 
    mode?: TTSMode, 
    onEndCallback?: () => void
  ) => {
    // 1. Stop any currently active text-to-speech instances
    stopTTS();

    setIsLoading(true);
    const mySequenceId = ++currentSequenceId;

    try {
      const activeMode = mode || (typeof window !== 'undefined' ? (localStorage.getItem('vocab_tts_mode') as TTSMode) : 'ai') || 'ai';
      const targetLang = isVietnamese(text) ? 'vi' : 'en';

      // Clean up whitespace
      const cleanText = text.replace(/[\r\n]+/g, ' ').trim();
      if (!cleanText) {
        setIsLoading(false);
        onEndCallback?.();
        return;
      }

      // Check if SpeechSynthesis is supported and active
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        // Find best local voice matching preference
        const selectedVoice = getBestVoice(targetLang, activeMode);
        
        if (selectedVoice) {
          // Speak locally using Chrome/Edge/Apple SpeechSynthesis (Instant, CORS-free, no server loading failures)
          console.log(`[TTS] Speaking using local SpeechSynthesis. Voice: ${selectedVoice.name}, Mode: ${activeMode}`);
          
          window.speechSynthesis.cancel(); // Clear any queued utterances to avoid browser speech locks
          
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang;
          
          // Tailor voice style
          if (activeMode === 'ai') {
            utterance.rate = 1.0; // Fluent natural cadence
            utterance.pitch = 1.0;
          } else {
            utterance.rate = targetLang === 'en' ? 0.95 : 0.85; // Machine speaking rate (measured, slightly robotic)
            utterance.pitch = 0.95;
          }

          // Safety trigger to handle rare browser getVoices freeze or missing end boundary callback
          const maxWords = cleanText.split(/\s+/).length;
          const safetyTimeoutMs = Math.max(4000, maxWords * 600); // 600ms per word + base padding
          
          let safetyTimeout = setTimeout(() => {
            if (mySequenceId === currentSequenceId) {
              console.warn('[TTS-SpeechSynthesis] Safety timeout reached, resetting state.');
              setIsLoading(false);
              onEndCallback?.();
            }
          }, safetyTimeoutMs);

          const speechEnded = () => {
            clearTimeout(safetyTimeout);
            if (mySequenceId === currentSequenceId) {
              setIsLoading(false);
              onEndCallback?.();
            }
          };

          utterance.onstart = () => {
            if (mySequenceId === currentSequenceId) {
              setIsLoading(false); // Done loading, actively speaking
            }
          };

          utterance.onend = speechEnded;
          utterance.onerror = (err) => {
            console.warn('[TTS-SpeechSynthesis] Playback error event:', err);
            speechEnded();
          };

          window.speechSynthesis.speak(utterance);
          return;
        }
      }

      // ---------------------------------------------------------
      // FALLBACK: If SpeechSynthesis fails or isn't supported, 
      // play TTS via reliable, cross-origin web request streaming
      // ---------------------------------------------------------
      console.log(`[TTS] Synthesis fallback. Relying on streaming URLs.`);
      let streamingUrl = '';
      let playbackRate = 1.0;

      if (activeMode === 'ai') {
        // High quality US English fallback
        streamingUrl = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(cleanText)}`;
        playbackRate = 1.0;
      } else {
        // Standard Machine English / Vietnamese Google Voice fallback
        streamingUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${targetLang}&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
        playbackRate = targetLang === 'en' ? 1.0 : 0.86;
      }

      const audio = new Audio();
      audio.style.display = 'none';
      document.body.appendChild(audio);

      audioRef.current = audio;
      activeAudio = audio;

      // 3-second network loading safety guard: if CORS, network lag, or Google CAPTCHA blocks loading,
      // fail fast and reset states so the client isn't locked on loading spinner.
      const playbackSafetyTimeout = setTimeout(() => {
        try {
          if (audio.parentNode) {
            audio.parentNode.removeChild(audio);
          }
        } catch (e) {}
        
        console.warn(`[TTS-Fallback] Audio load timed out after 3s.`);
        if (mySequenceId === currentSequenceId) {
          setIsLoading(false);
          onEndCallback?.();
        }
      }, 3000);

      const cleanup = () => {
        clearTimeout(playbackSafetyTimeout);
        try {
          if (audio.parentNode) {
            audio.parentNode.removeChild(audio);
          }
        } catch (e) {}
      };

      audio.onplay = () => {
        clearTimeout(playbackSafetyTimeout);
        if (mySequenceId === currentSequenceId) {
          setIsLoading(false);
        }
      };

      audio.onended = () => {
        cleanup();
        if (mySequenceId === currentSequenceId) {
          setIsLoading(false);
          onEndCallback?.();
        }
      };

      audio.onerror = (err) => {
        cleanup();
        console.warn('[TTS-Fallback] Audio load error:', err);
        if (mySequenceId === currentSequenceId) {
          setIsLoading(false);
          onEndCallback?.();
        }
      };

      audio.src = streamingUrl;
      audio.load();

      audio.oncanplay = () => {
        try {
          audio.playbackRate = playbackRate;
        } catch (e) {}
      };

      try {
        await audio.play();
      } catch (err) {
        cleanup();
        console.warn('[TTS-Fallback] Audio play blocked:', err);
        if (mySequenceId === currentSequenceId) {
          setIsLoading(false);
          onEndCallback?.();
        }
      }

    } catch (err) {
      console.error("[TTS] Internal execution loop failed:", err);
      setIsLoading(false);
      onEndCallback?.();
    }
  };

  const stopTTS = () => {
    setIsLoading(false);
    currentSequenceId++; // Cancel active playlist sequences
    
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
    }
  };

  return {
    playTTS,
    stopTTS,
    isTtsLoading: isLoading,
    ttsError: null
  };
};
