import { useState, useRef } from 'react';

export type TTSMode = 'ai' | 'browser';

// Keep a global static reference to the playing audio so we can stop it precisely across hook calls
let activeAudio: HTMLAudioElement | null = null;

export const useTTS = () => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isVietnamese = (txt: string) => {
    // Check for unique Vietnamese accent characters
    const viChars = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠÂẦẤẨẪẬĂẰẮClarẵặÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝYĐ]/;
    return viChars.test(txt);
  };

  const playTTS = async (
    text: string, 
    mode: TTSMode = 'ai', 
    onEndCallback?: () => void
  ) => {
    // 1. Stop any currently active text-to-speech audio 
    stopTTS();

    setIsLoading(true);

    try {
      // Determine the ideal language
      const targetLang = isVietnamese(text) ? 'vi' : 'en';

      // Clean up whitespace
      const cleanText = text.replace(/[\r\n]+/g, ' ').trim();
      if (!cleanText) {
        setIsLoading(false);
        onEndCallback?.();
        return;
      }

      if (targetLang === 'en') {
        // Play English text via highly reliable Youdao voice (US Accent, supports CORS, no blocking)
        const url = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(cleanText)}`;
        const audio = new Audio(url);
        audioRef.current = audio;
        activeAudio = audio;

        audio.onplay = () => {
          setIsLoading(false);
        };

        audio.onended = () => {
          setIsLoading(false);
          onEndCallback?.();
        };

        audio.onerror = (e) => {
          console.warn(`[TTS-Youdao] Failed to load audio, using SpeechSynthesis fallback:`, e);
          fallbackSpeechSynthesis(cleanText, 'en', onEndCallback);
        };

        // Attempt to play audio
        await audio.play();
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
