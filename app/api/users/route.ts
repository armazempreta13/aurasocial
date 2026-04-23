import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, saveUser } from '@/lib/db';
import { verifyFirebaseIdToken } from '@/lib/server/firebase-auth';

export async function GET(req: NextRequest) {
  const auth = await verifyFirebaseIdToken(req.headers);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const users = getAllUsers();
  // If no users, return empty list instead of 500
  return NextResponse.json(users || []);
}

export async function POST(req: NextRequest) {
  const auth = await verifyFirebaseIdToken(req.headers);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await req.json();
  if (!user?.uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
  if (user.uid !== auth.uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const saved = saveUser(user);
  return NextResponse.json(saved);
}
