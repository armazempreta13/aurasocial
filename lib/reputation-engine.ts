import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Lazy initialization
let adminApp: any;

function getAdminDb() {
  if (!adminApp) {
    if (!getApps().length) {
      // In a real production environment, you would use serviceAccount credentials
      // For this environment, we assume the environment is already configured
      adminApp = initializeApp();
    } else {
      adminApp = getApp();
    }
  }
  return getFirestore(adminApp);
}

export async function processInteraction(
  type: string,
  fromUid: string,
  toUid: string,
  postId: string
) {
  const db = getAdminDb();
  
  // 1. Define weights
  const weights: Record<string, number> = {
    view: 0.1,
    save: 5,
    share: 3,
    comment: 2,
    report: -10
  };

  const weight = weights[type] || 0;
  if (weight === 0) return;

  // 2. Update Post Score (Atomic increment)
  const postRef = db.collection('posts').doc(postId);
  await postRef.update({
    score: require('firebase-admin/firestore').FieldValue.increment(weight)
  });

  // 3. Update User Reputation (Simplified logic)
  const userRepRef = db.collection('users').doc(toUid).collection('reputation').doc('global');
  await userRepRef.set({
    score: require('firebase-admin/firestore').FieldValue.increment(weight * 0.5),
    updatedAt: require('firebase-admin/firestore').FieldValue.serverTimestamp()
  }, { merge: true });
}
