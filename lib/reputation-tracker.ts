import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';

export type InteractionType = 'view' | 'save' | 'share' | 'comment' | 'report';

export async function trackInteraction(
  type: InteractionType,
  fromUid: string,
  toUid: string,
  postId: string
) {
  try {
    await fetch('/api/track-interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, fromUid, toUid, postId }),
    });
  } catch (error) {
    console.error('Error tracking interaction:', error);
  }
}
