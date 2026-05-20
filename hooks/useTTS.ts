import { useState, useRef } from 'react';

export type TTSMode = 'ai' | 'browser';

// Keep a global static reference to the playing audio so we can stop it precisely across hook calls
let activeAudio: HTMLAudioElement | null = null;

export const useTTS = () => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isVietnamese = (txt: string) => {
    // Check for unique Vietnamese accent characters
    const viChars = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸYĐ]/;
    return viChars.test(txt);
  };

  const playTTS = async (text: string, mode: TTSMode = 'ai') => {
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
        return;
      }

      // Split the text into comfortable chunks under 180 characters to comply with Translate TTS maximum length
      const maxLen = 180;
      const chunks: string[] = [];
      
      if (cleanText.length <= maxLen) {
        chunks.push(cleanText);
      } else {
        const words = cleanText.split(' ');
        let currentChunk = '';
        for (const word of words) {
          if ((currentChunk + ' ' + word).length > maxLen) {
            chunks.push(currentChunk.trim());
            currentChunk = word;
          } else {
            currentChunk = currentChunk ? currentChunk + ' ' + word : word;
          }
        }
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
      }

      if (chunks.length > 0) {
        let currentIdx = 0;

        const playNextChunk = () => {
          if (currentIdx >= chunks.length) {
            setIsLoading(false);
            return;
          }

          const chunkText = chunks[currentIdx];
          const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${targetLang}&client=tw-ob&q=${encodeURIComponent(chunkText)}`;
          
          const audio = new Audio(url);
          audioRef.current = audio;
          activeAudio = audio;

          audio.onended = () => {
            currentIdx++;
            playNextChunk();
          };

          audio.onerror = (e) => {
            console.warn(`[TTS-Fallback] Google Translate TTS chunk failed. Utilizing local SpeechSynthesis. Details:`, e);
            fallbackSpeechSynthesis(chunkText, targetLang);
            currentIdx++;
            setTimeout(playNextChunk, 1000);
          };

          audio.play().catch((playErr) => {
            console.warn(`[TTS-Fallback] Audio autoplay was blocked. Reverting to browser speechSynthesis:`, playErr);
            fallbackSpeechSynthesis(chunkText, targetLang);
            currentIdx++;
            setTimeout(playNextChunk, 1000);
          });
        };

        playNextChunk();
        return;
      }
    } catch (err) {
      console.error("[TTS] Failed initializing Google Audio TTS. Falling back to SpeechSynthesis.", err);
      fallbackSpeechSynthesis(text, isVietnamese(text) ? 'vi' : 'en');
    }
  };

  const fallbackSpeechSynthesis = (text: string, lang: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsLoading(false);
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
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("[TTS] SpeechSynthesis fallback failed:", e);
    } finally {
      setIsLoading(false);
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
