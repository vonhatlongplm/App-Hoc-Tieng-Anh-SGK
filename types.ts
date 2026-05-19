
export type AppMode = 'LEARN_BOOK' | 'PRACTICE_EXAM';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  translation?: string;
  showTranslation?: boolean;
  context?: any;
  type?: 'text' | 'audio_feedback';
  timestamp?: number;
  imageUrls?: string[];
  audioBase64?: string;
  englishAudio?: string;
}

export interface UserProgress {
  uid: string;
  email: string;
  name: string;
  documentContent: string;
  appMode: AppMode;
  messages: Message[];
  updatedAt: any;
  diagnosedLevel: string;
  scores: Record<string, number>;
  estimatedTimeToB2: string;
  completedLessons: number;
  totalLessons: number;
  detailedProgress: any;
  vocabulary: VocabularyWord[];
  isAdmin?: boolean;
  hintUsageCount?: number;
  uploadedMaterials: TextbookMetadata[];
  currentMaterialId?: string;
}

export interface StudentProfile extends UserProgress {
  progressPercentage: number;
  wordCount: number;
}

export interface TextbookMetadata {
  id: string;
  bookName: string;
  grade: string;
  unit: string;
  content: string;
  uploadDate: number;
}

export enum SectionId {
  LIBRARY = 'Thư viện giáo trình',
  RESEARCH = 'Phòng nghiên cứu',
  TESTS = 'Luyện giải đề thi',
  VOCABULARY = 'Học từ vựng',
  GRAMMAR = 'Ngữ pháp',
  LISTENING = 'Luyện nghe',
  READING = 'Luyện đọc',
  WRITING = 'Luyện viết',
  SPEAKING = 'Luyện nói',
  PHONICS = 'Phát âm',
  MY_VOCABULARY = 'Tháp từ vựng',
  ERROR_LOG = 'Nhật ký lỗi',
  LEADERBOARD = 'Bảng xếp hạng',
  MY_HISTORY = 'Lịch sử học',
  ADMIN = 'Quản trị'
}

export type Section = SectionId;
// Rename the interface to avoid conflict
export interface SectionMetadata {
  id: SectionId;
  title: string;
  type: SectionId;
  content?: string;
}

export interface LessonProgress {
  id: string;
  status: 'locked' | 'available' | 'completed';
  score?: number;
  completedLessonNumbers?: number[];
  currentLesson?: number;
}

export interface VocabularyCollocation {
  phrase: string;
  meaning: string;
  isSaved?: boolean;
  masteryLevel?: number;
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
  collocations?: VocabularyCollocation[];
  masteryLevel?: number;
  isBacklogged?: boolean;
  savedAt?: number;
  imageUrl?: string;
  isGeneratingImage?: boolean;
  pronunciationAttempts?: {
    date: number;
    score: number;
    feedback: string;
    isCorrect: boolean;
  }[];
}

export interface CorrectionEntry {
  original: string;
  upgraded: string;
  explanation: string;
  id?: string;
  section?: string | Section;
  timestamp?: number;
  isUpgraded?: boolean;
}

export interface DiagnosticAttempt {
  date: string;
  level: string;
  score: number;
  audioBase64?: string;
  analysisText?: string;
  scores?: SkillScore[];
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
  completedOn?: number;
  section?: string | Section;
  details?: string;
}

export interface SkillScore {
  skill: string;
  score: number;
  fullMark?: number;
}
