import { NextRequest, NextResponse } from 'next/server';
import { signalingStore } from '@/lib/signaling';
import { verifyFirebaseIdToken } from '@/lib/server/firebase-auth';

export async function POST(req: NextRequest) {
  const auth = await verifyFirebaseIdToken(req.headers);
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const { toId, fromId, type, payload } = data;

  if (!toId || !fromId || !type) {
    return NextResponse.json({ success: false, error: 'Missing Required Fields' }, { status: 400 });
  }

  if (fromId !== auth.uid) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const delivered = (globalThis as any)._signalingStore.send(toId, fromId, type, payload);

  return NextResponse.json({ success: true, delivered });
}
