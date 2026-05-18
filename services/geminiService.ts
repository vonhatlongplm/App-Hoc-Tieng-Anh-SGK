
export const generateContent = async (contents: any, systemInstruction: string) => {
  const res = await fetch('/api/generate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ contents, systemInstruction })
  });
  if (!res.ok) throw new Error("AI Generation failed");
  return await res.json();
};

export const sendMessageToGemini = async (messages: any[], systemInstruction: string) => {
  return await generateContent(messages, systemInstruction);
};

export const analyzePronunciation = async (audioBase64: string, targetText: string) => {
  return { score: 85, feedback: "Good job!" };
};

export const translateToVietnamese = async (text: string) => {
  const res = await generateContent([{ role: 'user', parts: [{ text: `Translate to Vietnamese: ${text}` }] }], "You are a translator.");
  return res.text;
};

export const lookupWord = async (word: string) => {
  return { word, definition: "Meaning of " + word };
};

export const analyzeDiagnostic = async (answers: any) => {
  return { level: 'B1', analysis: "Good progress" };
};

export const analyzeSpeakingAudio = async (audioBase64: string) => {
  return { text: "Transcription", feedback: "Fluency is good" };
};

export const getDistractors = async (word: string) => [];
export const getReviewHint = async (word: string) => "";
export const getCollocationQuiz = async (word: string) => null;
export const selectStudySessionWords = (words: any[]) => words.slice(0, 5);
