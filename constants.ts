
export const APP_NAME = "OmniEnglish";
export const GEMINI_MODEL = (typeof process !== 'undefined' && process.env?.GEMINI_MODEL) || "gemini-2.0-flash";

export const DEFAULT_SYSTEM_INSTRUCTION = `Bạn là một Giáo viên Tiếng Anh AI toàn năng.`;

export const LESSON_DATA: Record<string, any[]> = {};
export const PHONICS_RULES = [];
export const B2_VOCAB_DECKS = [];
export const DIAGNOSTIC_PROMPT_EN = "Diagnostic prompt in English";
export const DIAGNOSTIC_PROMPT_VI = "Lời nhắc chẩn đoán bằng tiếng Việt";

export const createInitialDetailedProgress = () => ({
  vocab: 0,
  grammar: 0,
  reading: 0,
  listening: 0,
  speaking: 0,
  writing: 0,
  phonics: 0
});
