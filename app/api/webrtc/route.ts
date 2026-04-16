import { NextRequest, NextResponse } from 'next/server';
import { addWebRTCSignal, getWebRTCSignals } from '@/lib/db';

// POST /api/webrtc — send a WebRTC signal (offer, answer, ICE, hang-up…)
export async function POST(req: NextRequest) {
  try {
    const { toId, fromId, type, payload } = await req.json();
    if (!toId || !fromId || !type) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const signal = addWebRTCSignal(toId, fromId, type, payload);
    return NextResponse.json(signal);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/webrtc?userId=xxx — poll pending WebRTC signals for a user
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) return NextResponse.json([], { status: 200 });
    const signals = getWebRTCSignals(userId);
    return NextResponse.json(signals);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
