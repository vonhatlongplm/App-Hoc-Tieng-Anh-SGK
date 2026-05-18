
export const useTTS = () => {
  return {
    speak: (text: string) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    },
    playTTS: (text: string) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    },
    stopTTS: () => {
      window.speechSynthesis.cancel();
    },
    isSpeaking: false,
    isTtsLoading: false,
    ttsError: null
  };
};

export enum TTSMode {
  NORMAL = 'normal',
  SLOW = 'slow'
}
