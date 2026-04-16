import { NextResponse } from 'next/server';
import { addSignal, getSignals } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  const signals = getSignals(userId);
  return NextResponse.json(signals);
}

export async function POST(request: Request) {
  const { toId, fromId, type, payload } = await request.json();
  addSignal(toId, fromId, type, payload);
  return NextResponse.json({ success: true });
}
