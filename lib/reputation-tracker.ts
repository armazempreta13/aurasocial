import { auth } from '@/firebase';

export type InteractionType = 'view' | 'save' | 'share' | 'comment' | 'report';

export async function trackInteraction(
  type: InteractionType,
  fromUid: string,
  toUid: string,
  postId: string
) {
  try {
    const token = await auth.currentUser?.getIdToken();
    await fetch('/api/track-interaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ type, fromUid, toUid, postId }),
    });
  } catch (error) {
    console.error('Error tracking interaction:', error);
  }
}
