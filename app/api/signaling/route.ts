import { NextResponse } from 'next/server';
import { addSignal, getSignals } from '@/lib/db';
import { verifyFirebaseIdToken } from '@/lib/server/firebase-auth';

export async function GET(request: Request) {
  const auth = await verifyFirebaseIdToken(request.headers);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  if (userId !== auth.uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const signals = getSignals(userId);
  return NextResponse.json(signals);
}

export async function POST(request: Request) {
  const auth = await verifyFirebaseIdToken(request.headers);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { toId, fromId, type, payload } = await request.json();
  if (!toId || !fromId || !type) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (fromId !== auth.uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  addSignal(toId, fromId, type, payload);
  return NextResponse.json({ success: true });
}
