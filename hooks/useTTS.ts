
export type TTSMode = 'ai' | 'browser';

export const useTTS = () => {
  const playTTS = async (text: string, mode: TTSMode = 'ai') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn("Speech synthesis not supported in this browser environment.");
      return;
    }

    try {
      // 1. Cancel any active or queued speech first to unblock the speech queue (Chrome/Safari queue stall bug)
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      
      // 2. Effort to match high quality English voice to avoid falling back to local system locale (e.g. speaking English text with Vietnamese pronunciation/voice)
      const voices = window.speechSynthesis.getVoices();
      const enVoice = voices.find(v => v.lang.toLowerCase() === 'en-us' && v.localService) ||
                      voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('en-us')) ||
                      voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('en'));
                      
      if (enVoice) {
        utterance.voice = enVoice;
      }
      
      // Adjust speech rate & volume for comfortable lessons
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onerror = (e) => {
        console.error("SpeechSynthesisUtterance error:", e);
      };

      // 3. Play sound
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Error in useTTS playTTS:", err);
    }
  };

  return {
    playTTS,
    stopTTS: () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    },
    isTtsLoading: false,
    ttsError: null
  };
};
