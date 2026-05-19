
export type TTSMode = 'ai' | 'browser';

export const useTTS = () => {
  const playTTS = async (text: string, mode: TTSMode = 'ai') => {
    if (mode === 'browser') {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
      return;
    }

    // AI mode fallback to browser for now if server-side TTS is not fully implemented
    // Or we can implement a call to /api/tts if it exists
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  return {
    playTTS,
    stopTTS: () => window.speechSynthesis.cancel(),
    isTtsLoading: false,
    ttsError: null
  };
};
