import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { AppMode } from '../App';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export interface SavedProgress {
  uid: string;
  email: string;
  documentContent: string;
  appMode: AppMode;
  messages: Message[];
  updatedAt: number;
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export async function saveProgressToFirebase(uid: string, email: string, documentContent: string, appMode: AppMode, messages: Message[]) {
  if (!uid) return;
  const progressRef = doc(db, 'progress', uid);
  const data: SavedProgress = {
    uid,
    email: email || '',
    documentContent,
    appMode,
    messages,
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

export async function clearProgressFromFirebase(uid: string) {
  if (!uid) return;
  // Just clear it by overwriting with empty
  const progressRef = doc(db, 'progress', uid);
  const data: SavedProgress = {
    uid,
    email: auth.currentUser?.email || '',
    documentContent: '',
    appMode: 'LEARN_BOOK',
    messages: [],
    updatedAt: Date.now()
  };
  await setDoc(progressRef, data);
}
