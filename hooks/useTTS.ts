import { useState, useRef } from 'react';

export type TTSMode = 'ai' | 'browser';

// Keep a global static reference to the playing audio so we can stop it precisely across hook calls
let activeAudio: HTMLAudioElement | null = null;

export const useTTS = () => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isVietnamese = (txt: string) => {
    // Check for unique Vietnamese accent characters
    const viChars = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠÂẦẤẨẪẬĂẰẮĂẲẴẶÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸYĐ]/;
    return viChars.test(txt);
  };

  const playTTS = async (
    text: string, 
    mode?: TTSMode, 
    onEndCallback?: () => void
  ) => {
    // 1. Stop any currently active text-to-speech audio 
    stopTTS();

    setIsLoading(true);

    try {
      // Determine active mode (retrieve online preference dynamically if not provided)
      const activeMode = mode || (typeof window !== 'undefined' ? (localStorage.getItem('vocab_tts_mode') as TTSMode) : 'ai') || 'ai';

      // Determine the ideal language
      const targetLang = isVietnamese(text) ? 'vi' : 'en';

      // Clean up whitespace
      const cleanText = text.replace(/[\r\n]+/g, ' ').trim();
      if (!cleanText) {
        setIsLoading(false);
        onEndCallback?.();
        return;
      }

      // Check for forced browser mode
      if (activeMode === 'browser') {
        fallbackSpeechSynthesis(cleanText, targetLang, onEndCallback);
        return;
      }

      if (targetLang === 'en') {
        // Play English text via highly reliable Youdao voice (US Accent, supports CORS, no blocking)
        const url = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(cleanText)}`;
        const audio = new Audio();
        
        // Append to DOM to ensure playback works in sandboxed / iframe environments
        audio.style.display = 'none';
        document.body.appendChild(audio);

        audioRef.current = audio;
        activeAudio = audio;

        audio.onplay = () => {
          setIsLoading(false);
        };

        const cleanup = () => {
          try {
            if (audio.parentNode) {
              audio.parentNode.removeChild(audio);
            }
          } catch (e) {}
        };

        audio.onended = () => {
          cleanup();
          setIsLoading(false);
          onEndCallback?.();
        };

        audio.onerror = (e) => {
          cleanup();
          console.warn(`[TTS-Youdao] Failed to load audio, using SpeechSynthesis fallback:`, e);
          fallbackSpeechSynthesis(cleanText, 'en', onEndCallback);
        };

        audio.src = url;
        audio.load();

        // Attempt to play audio
        try {
          await audio.play();
        } catch (playErr) {
          cleanup();
          console.warn(`[TTS-Youdao] play() failed or was blocked, trying fallbackSpeechSynthesis:`, playErr);
          fallbackSpeechSynthesis(cleanText, 'en', onEndCallback);
        }
      } else {
        // Vietnamese text: fallback to local SpeechSynthesis
        fallbackSpeechSynthesis(cleanText, 'vi', onEndCallback);
      }
    } catch (err) {
      console.warn("[TTS] Error during initialization, utilizing fallback:", err);
      fallbackSpeechSynthesis(text, isVietnamese(text) ? 'vi' : 'en', onEndCallback);
    }
  };

  const fallbackSpeechSynthesis = (text: string, lang: string, onEndCallback?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsLoading(false);
      onEndCallback?.();
      return;
    }
    
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'vi' ? 'vi-VN' : 'en-US';
      
      const voices = window.speechSynthesis.getVoices();
      const targetVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith(lang));
      if (targetVoice) {
        utterance.voice = targetVoice;
      }
      
      utterance.rate = 1.0;

      utterance.onend = () => {
        setIsLoading(false);
        onEndCallback?.();
      };

      utterance.onerror = (e) => {
        console.warn("[TTS] SpeechSynthesis playback error:", e);
        setIsLoading(false);
        onEndCallback?.();
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("[TTS] SpeechSynthesis fallback failed:", e);
      setIsLoading(false);
      onEndCallback?.();
    }
  };

  const stopTTS = () => {
    setIsLoading(false);
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      } catch (e) {}
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (e) {}
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
