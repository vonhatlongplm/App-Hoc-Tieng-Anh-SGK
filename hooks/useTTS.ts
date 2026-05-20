import { useState, useRef } from 'react';

export type TTSMode = 'ai' | 'browser';

// Keep a global static reference to the playing audio so we can stop it precisely across hook calls
let activeAudio: HTMLAudioElement | null = null;
let currentSequenceId: number = 0;

export const useTTS = () => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isVietnamese = (txt: string) => {
    // Check for unique Vietnamese accent characters
    const viChars = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠÂẦẤẨẪẬĂẰẮĂẲẴẶÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸYĐ]/;
    return viChars.test(txt);
  };

  const splitIntoChunks = (text: string, maxLen = 180): string[] => {
    const cleanText = text.replace(/[\r\n]+/g, ' ').trim();
    if (!cleanText) return [];
    
    // Split by sentences or punctuation first to keep phrasing natural
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
        // If a single word/part is too long, chunk by space
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

  const playTTS = async (
    text: string, 
    mode?: TTSMode, 
    onEndCallback?: () => void
  ) => {
    // Stop any currently active text-to-speech audio 
    stopTTS();

    setIsLoading(true);
    const myId = ++currentSequenceId;

    try {
      // Determine active mode (retrieve online preference dynamically if not provided)
      const activeMode = mode || (typeof window !== 'undefined' ? (localStorage.getItem('vocab_tts_mode') as TTSMode) : 'ai') || 'ai';

      // Determine the ideal language
      const targetLang = isVietnamese(text) ? 'vi' : 'en';

      const chunks = splitIntoChunks(text, 160);
      if (chunks.length === 0) {
        setIsLoading(false);
        onEndCallback?.();
        return;
      }

      // Compile the URLs array
      const playlist: { url: string; rate: number }[] = [];

      for (const chunk of chunks) {
        let url = '';
        let playbackRate = 1.0;

        if (activeMode === 'ai') {
          // AI Mode: Use premium, highly natural, neural sounding Google Translate TTS
          url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${targetLang}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
          playbackRate = 1.0; // Standard speed for natural teacher-like voice
        } else {
          // Machine Mode: Use Youdao robotic voice for English, or slower Google Voice for Vietnamese
          if (targetLang === 'en') {
            url = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(chunk)}`;
            playbackRate = 1.0; // Classic robotic speed
          } else {
            // For Vietnamese "Giọng Máy", we use Google Translate slow playback-rate
            url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunk)}`;
            playbackRate = 0.83; // Slowed down slightly to sound robotic and distinct
          }
        }
        playlist.push({ url, rate: playbackRate });
      }

      // Play the sequence of chunks
      let index = 0;

      const playNext = () => {
        // Guard if another speech started in the meantime
        if (myId !== currentSequenceId) return;

        if (index >= playlist.length) {
          setIsLoading(false);
          onEndCallback?.();
          return;
        }

        const currentItem = playlist[index];
        const audio = new Audio();
        
        // Append to DOM to make sure it plays nicely in sandboxed/iframe environments
        audio.style.display = 'none';
        document.body.appendChild(audio);

        audioRef.current = audio;
        activeAudio = audio;

        audio.onplay = () => {
          if (myId !== currentSequenceId) return;
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
          if (myId === currentSequenceId) {
            index++;
            playNext();
          }
        };

        audio.onerror = (e) => {
          cleanup();
          console.warn(`[TTS-Sequence] Error loading chunk ${index}. Playing fallback:`, e);
          if (myId === currentSequenceId) {
            // If Google Translate fails, fallback immediately to Youdao for English, or skip
            if (targetLang === 'en' && activeMode === 'ai') {
              // Try Youdao URL before completely falling back to SpeechSynthesis
              const fallbackUrl = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(chunks[index])}`;
              playlist[index] = { url: fallbackUrl, rate: 1.0 };
              playNext();
            } else {
              index++;
              playNext();
            }
          }
        };

        // Attempt to play audio
        audio.src = currentItem.url;
        audio.load();

        audio.oncanplay = () => {
          try {
            audio.playbackRate = currentItem.rate;
          } catch (err) {}
        };

        audio.play().catch(playErr => {
          cleanup();
          console.warn(`[TTS] play() failed or blocked. Using client SpeechSynthesis backup:`, playErr);
          if (myId === currentSequenceId) {
            // Ultimate local browser speak fallback
            fallbackSpeechSynthesis(text, targetLang, onEndCallback);
          }
        });
      };

      playNext();

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
    currentSequenceId++; // Breaks any ongoing custom playlist loop
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
