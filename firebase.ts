import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import firebaseConfig from './firebase-applet-config.json';

// Safety check for Worker SSR environment
const isBrowser = typeof window !== 'undefined';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = isBrowser ? getAuth(app) : {} as any;
export const db = isBrowser ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : {} as any;
export const storage = isBrowser ? getStorage(app) : {} as any;
