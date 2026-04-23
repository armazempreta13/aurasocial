import { db } from '@/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ModerationConfig, DEFAULT_CONFIG, moderationEngine, ModerationResult } from './engine';

let activeConfig: ModerationConfig = DEFAULT_CONFIG;

// Initialize listener for real-time config updates
export function initModerationSync() {
  const unsub = onSnapshot(doc(db, 'system_config', 'moderation'), (snap) => {
    if (snap.exists()) {
      activeConfig = { ...DEFAULT_CONFIG, ...snap.data() };
    }
  });
  return unsub;
}

export async function getRemoteModerationConfig(): Promise<ModerationConfig> {
  const snap = await getDoc(doc(db, 'system_config', 'moderation'));
  if (snap.exists()) {
    activeConfig = { ...DEFAULT_CONFIG, ...snap.data() } as ModerationConfig;
  }
  return activeConfig;
}

/**
 * Main function to validate content anywhere in the app
 */
export function validateContent(
  content: string, 
  type: 'post' | 'comment' | 'username' | 'message'
): ModerationResult {
  return moderationEngine(content, type, activeConfig);
}

/**
 * Updates moderation config in Firestore (Admin Only)
 */
export async function updateModerationConfig(newConfig: Partial<ModerationConfig>) {
  await setDoc(doc(db, 'system_config', 'moderation'), newConfig, { merge: true });
}
