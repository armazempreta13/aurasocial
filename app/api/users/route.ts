import { NextResponse } from 'next/server';
import { getAllUsers, saveUser } from '@/lib/db';

export async function GET() {
  const users = getAllUsers();
  // If no users, return empty list instead of 500
  return NextResponse.json(users || []);
}

export async function POST(request: Request) {
  const user = await request.json();
  if (!user.uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
  const saved = saveUser(user);
  return NextResponse.json(saved);
}
