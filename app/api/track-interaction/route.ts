import { NextResponse } from 'next/server';
import { processInteraction } from '@/lib/reputation-engine';
import { verifyFirebaseIdToken } from '@/lib/server/firebase-auth';

export async function POST(req: Request) {
  const auth = await verifyFirebaseIdToken(req.headers);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { type, fromUid, toUid, postId } = await req.json();

    if (!type || !fromUid || !toUid || !postId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (fromUid !== auth.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await processInteraction(type, fromUid, toUid, postId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing interaction:', error);
    return NextResponse.json({ error: 'Failed to process interaction' }, { status: 500 });
  }
}
