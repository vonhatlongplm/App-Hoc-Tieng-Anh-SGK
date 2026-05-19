import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProgress, Message, AppMode } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export interface SavedProgress extends UserProgress {
  updatedAt: number;
}

export async function simpleEmailLogin(email: string, name: string) {
  return { uid: email.toLowerCase(), email: email.toLowerCase(), name };
}

export async function logoutUser() {
  // Do nothing
}

export async function saveProgressToFirebase(uid: string, progress: UserProgress) {
  if (!uid) return;
  const progressRef = doc(db, 'progress', uid);
  const data: SavedProgress = {
    ...progress,
    updatedAt: Date.now()
  };
  await setDoc(progressRef, data);
}

export async function loadProgressFromFirebase(uid: string): Promise<SavedProgress | null> {
  if (!uid) return null;
  const progressRef = doc(db, 'progress', uid);
  const snap = await getDoc(progressRef);
  if (snap.exists()) {
    return snap.data() as SavedProgress;
  }
  return null;
}

export async function clearProgressFromFirebase(uid: string, email: string, name: string) {
  if (!uid) return;
  const progressRef = doc(db, 'progress', uid);
  // Default structure
  const data: SavedProgress = {
    uid,
    email: email || '',
    name: name || '',
    documentContent: '',
    appMode: 'LEARN_BOOK',
    messages: [],
    vocabulary: [],
    diagnosedLevel: 'Undiagnosed',
    detailedProgress: {
        vocab: 0,
        grammar: 0,
        reading: 0,
        listening: 0,
        speaking: 0,
        writing: 0,
        phonics: 0
    },
    updatedAt: Date.now(),
    completedLessons: 0,
    totalLessons: 180,
    scores: {
        'Vocabulary': 0,
        'Grammar': 0,
        'Reading': 0,
        'Listening': 0,
        'Speaking': 0,
        'Writing': 0
    },
    estimatedTimeToB2: '6 tháng'
  };
  await setDoc(progressRef, data);
}
