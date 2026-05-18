
export type AppMode = 'LEARN_BOOK' | 'PRACTICE_EXAM';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  translation?: string;
  showTranslation?: boolean;
  context?: string;
}

export interface UserProgress {
  uid: string;
  email: string;
  name: string;
  documentContent: string;
  appMode: AppMode;
  messages: Message[];
  updatedAt: any;
  diagnosedLevel?: string;
  scores?: Record<string, number>;
  estimatedTimeToB2?: string;
  completedLessons?: number;
  totalLessons?: number;
  detailedProgress?: any;
}

export interface Section {
  id: string;
  title: string;
  type: 'vocab' | 'grammar' | 'reading' | 'listening' | 'speaking' | 'writing' | 'phonics';
  content?: string;
}

export interface LessonProgress {
  id: string;
  status: 'locked' | 'available' | 'completed';
  score?: number;
  completedLessons?: number;
  currentLesson?: number;
}

export interface VocabularyWord {
  word: string;
  definition: string;
  example: string;
  pronunciation?: string;
  audioUrl?: string;
  meaning?: string;
  ipa?: string;
  partOfSpeech?: string;
  irregularForms?: string;
  collocations?: any[];
  masteryLevel?: number;
  isBacklogged?: boolean;
  savedAt?: number;
  imageUrl?: string;
  isGeneratingImage?: boolean;
}

export interface CorrectionEntry {
  original: string;
  corrected: string;
  explanation: string;
  id?: string;
  section?: string | Section;
  timestamp?: number;
  upgraded?: boolean;
}

export interface DiagnosticAttempt {
  date: string;
  level: string;
  score: number;
  audioBase64?: string;
  analysisText?: string;
  scores?: Record<string, number>;
  completedOn?: number;
  diagnosedLevel?: string;
  grammarAnswers?: any;
  writingAnswer?: string;
}

export interface LessonHistoryEntry {
  id: string;
  lessonId: string;
  score: number;
  date: string;
}

export interface SkillScore {
  skill: string;
  score: number;
}
