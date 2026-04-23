import firebaseConfig from '@/firebase-applet-config.json';

export type FirebaseAuthUser = {
  uid: string;
  email: string | null;
};

function getBearerToken(headers: Headers) {
  const header = headers.get('authorization') || headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function verifyFirebaseIdToken(headers: Headers): Promise<FirebaseAuthUser | null> {
  const idToken = getBearerToken(headers);
  if (!idToken) return null;

  const apiKey = process.env.FIREBASE_WEB_API_KEY || (firebaseConfig as any).apiKey;
  if (!apiKey) return null;

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const user = data?.users?.[0];
    const uid = user?.localId || null;
    const email = user?.email ?? null;
    if (!uid) return null;

    return { uid, email };
  } catch {
    return null;
  }
}

