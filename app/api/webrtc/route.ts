import { NextRequest, NextResponse } from 'next/server';
import { addWebRTCSignal, getWebRTCSignals } from '@/lib/db';
import { verifyFirebaseIdToken } from '@/lib/server/firebase-auth';

// POST /api/webrtc — send a WebRTC signal (offer, answer, ICE, hang-up…)
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyFirebaseIdToken(req.headers);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { toId, fromId, type, payload } = await req.json();
    if (!toId || !fromId || !type) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (fromId !== auth.uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const signal = addWebRTCSignal(toId, fromId, type, payload);
    return NextResponse.json(signal);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/webrtc?userId=xxx — poll pending WebRTC signals for a user
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyFirebaseIdToken(req.headers);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) return NextResponse.json([], { status: 200 });
    if (userId !== auth.uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const signals = getWebRTCSignals(userId);
    return NextResponse.json(signals);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
