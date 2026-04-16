import { NextResponse } from 'next/server';
import { getMessages, addMessage } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  if (!chatId) return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
  const messages = getMessages(chatId);
  return NextResponse.json(messages);
}

export async function POST(request: Request) {
  const { chatId, senderId, text, type, attachmentUrl } = await request.json();
  if (!chatId || !senderId) return NextResponse.json({ error: 'Missing logic fields' }, { status: 400 });
  const message = addMessage(chatId, senderId, text, type || 'text', attachmentUrl);
  return NextResponse.json(message);
}
