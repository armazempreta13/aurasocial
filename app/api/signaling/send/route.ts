import { NextRequest, NextResponse } from 'next/server';
import { signalingStore } from '@/lib/signaling';

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { toId, fromId, type, payload } = data;

  if (!toId || !fromId || !type) {
    return NextResponse.json({ success: false, error: 'Missing Required Fields' }, { status: 400 });
  }

  const delivered = (globalThis as any)._signalingStore.send(toId, fromId, type, payload);

  return NextResponse.json({ success: true, delivered });
}
