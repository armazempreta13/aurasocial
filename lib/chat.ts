import { db } from '@/firebase';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

export function getDirectChatId(userA: string, userB: string) {
  return [userA, userB].sort().join('__');
}

export async function ensureDirectChat(userA: string, userB: string) {
  const chatId = getDirectChatId(userA, userB);
  const chatRef = doc(db, 'chats', chatId);
  const chatDoc = await getDoc(chatRef);

  if (!chatDoc.exists()) {
    await setDoc(chatRef, {
      participants: [userA, userB].sort(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return chatId;
}
