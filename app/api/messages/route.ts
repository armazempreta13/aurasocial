import { NextResponse } from 'next/server';
import { addMessage, getMessages, readDB } from '@/lib/db';
import { verifyFirebaseIdToken } from '@/lib/server/firebase-auth';

export async function GET(request: Request) {
  const auth = await verifyFirebaseIdToken(request.headers);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  if (!chatId) return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });

  const chat = readDB().chats[chatId];
  if (!chat?.participants?.includes(auth.uid)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const messages = getMessages(chatId);
  return NextResponse.json(messages);
}

export async function POST(request: Request) {
  const auth = await verifyFirebaseIdToken(request.headers);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { chatId, senderId, text, type, attachmentUrl } = await request.json();
  if (!chatId || !senderId) return NextResponse.json({ error: 'Missing logic fields' }, { status: 400 });
  if (senderId !== auth.uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const chat = readDB().chats[chatId];
  if (!chat?.participants?.includes(auth.uid)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const message = addMessage(chatId, senderId, text, type || 'text', attachmentUrl);
  return NextResponse.json(message);
}
