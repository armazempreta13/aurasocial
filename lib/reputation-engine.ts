// ─── REPUTATION ENGINE ─────────────────────────────────────────────
// Server-side reputation processing. Uses firebase-admin when available.
// On Cloudflare Workers, firebase-admin may not initialize correctly,
// so we wrap everything in try-catch to fail gracefully.

let adminDb: any = null;

async function getAdminDb() {
  if (adminDb) return adminDb;
  try {
    const { initializeApp, getApps, getApp } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    
    let app;
    if (!getApps().length) {
      app = initializeApp();
    } else {
      app = getApp();
    }
    adminDb = getFirestore(app);
    return adminDb;
  } catch (e) {
    console.warn('[ReputationEngine] firebase-admin not available in this environment:', e);
    return null;
  }
}

export async function processInteraction(
  type: string,
  fromUid: string,
  toUid: string,
  postId: string
) {
  try {
    const db = await getAdminDb();
    if (!db) {
      console.log('[ReputationEngine] Skipping interaction processing — admin SDK unavailable');
      return;
    }

    const weights: Record<string, number> = {
      view: 0.1,
      save: 5,
      share: 3,
      comment: 2,
      report: -10,
    };

    const weight = weights[type] || 0;
    if (weight === 0) return;

    const { FieldValue } = await import('firebase-admin/firestore');

    const postRef = db.collection('posts').doc(postId);
    await postRef.update({
      score: FieldValue.increment(weight),
    });

    const userRepRef = db.collection('users').doc(toUid).collection('reputation').doc('global');
    await userRepRef.set(
      {
        score: FieldValue.increment(weight * 0.5),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error('[ReputationEngine] Error processing interaction:', e);
  }
}
