import { NextResponse } from 'next/server';
import { processInteraction } from '@/lib/reputation-engine';
import { db } from '@/firebase'; // Client-side DB for writing the interaction
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { type, fromUid, toUid, postId } = await req.json();

    // 1. Log the interaction in Firestore (Client-side DB)
    await addDoc(collection(db, 'interactions'), {
      type,
      fromUid,
      toUid,
      postId,
      createdAt: serverTimestamp(),
    });

    // 2. Trigger reputation update (Server-side)
    await processInteraction(type, fromUid, toUid, postId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing interaction:', error);
    return NextResponse.json({ error: 'Failed to process interaction' }, { status: 500 });
  }
}
