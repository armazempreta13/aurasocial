import { NextResponse } from 'next/server';
import { getChats, ensureChat } from '@/lib/db';
import { verifyFirebaseIdToken } from '@/lib/server/firebase-auth';

export async function GET(request: Request) {
  const auth = await verifyFirebaseIdToken(request.headers);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  if (userId !== auth.uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  
  const chats = getChats(userId);
  return NextResponse.json(chats);
}

export async function POST(request: Request) {
  const auth = await verifyFirebaseIdToken(request.headers);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { participants } = await request.json();
  
  if (!participants || participants.length < 2) {
    return NextResponse.json({ error: 'Invalid participants' }, { status: 400 });
  }

  if (!Array.isArray(participants) || !participants.includes(auth.uid)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const chat = ensureChat(participants);
  return NextResponse.json(chat);
}
