import { NextResponse } from 'next/server';
import { getChats, ensureChat } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  
  const chats = getChats(userId);
  return NextResponse.json(chats);
}

export async function POST(request: Request) {
  const { participants } = await request.json();
  
  if (!participants || participants.length < 2) {
    return NextResponse.json({ error: 'Invalid participants' }, { status: 400 });
  }
  
  const chat = ensureChat(participants);
  return NextResponse.json(chat);
}
