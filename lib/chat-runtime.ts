'use client';

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  type?: 'text' | 'image';
  attachmentUrl?: string;
  createdAt: number;
  read?: boolean;
}

export interface ChatUserPreview {
  uid: string;
  displayName: string;
  photoURL?: string;
  username?: string;
  lastSeen?: number;
  status?: string;
}

export interface ChatListItem {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: number;
  lastMessageSenderId?: string; // FIX: added field used by ChatProvider for new message detection
  unreadCount: number;
  pinned?: boolean;
  otherUser: ChatUserPreview;
  updatedAt?: number;
  createdAt?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Converts a Firestore Timestamp, number, or undefined to milliseconds. */
export function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof (value as any).toMillis === 'function') return (value as any).toMillis();
  return 0;
}

/** Validates that a participants array has at least 2 non-empty UIDs. */
function assertParticipants(participants: string[]): void {
  if (!Array.isArray(participants) || participants.length < 2) {
    throw new Error('participants must contain at least 2 UIDs.');
  }
  if (participants.some((p) => !p || typeof p !== 'string')) {
    throw new Error('All participant UIDs must be non-empty strings.');
  }
}

/** Normalizes a raw Firestore chat document into a plain object with ms timestamps. */
export function normalizeChatRow(d: { id: string; data: () => Record<string, any> }): Record<string, any> {
  const data = d.data();
  return {
    ...data,
    id: d.id,
    updatedAt: toMillis(data.updatedAt) || Date.now(),
    createdAt: toMillis(data.createdAt) || Date.now(),
    lastMessageTime: toMillis(data.lastMessageTime) || toMillis(data.updatedAt) || 0,
    lastMessageSenderId: data.lastMessageSenderId ?? null,
  };
}

// ---------------------------------------------------------------------------
// User sync
// ---------------------------------------------------------------------------

/**
 * Ensures the user's basic profile info is synced to the `users` collection.
 * Uses merge so existing fields are preserved.
 */
export async function syncChatUser(profile: {
  uid: string;
  displayName: string;
  photoURL?: string;
  username?: string;
}): Promise<void> {
  if (!profile.uid) {
    console.warn('syncChatUser: uid is required.');
    return;
  }

  const userRef = doc(db, 'users', profile.uid);
  try {
    await setDoc(
      userRef,
      { ...profile, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (e) {
    console.warn('Chat user sync failed (permissions?):', e);
  }
}

// ---------------------------------------------------------------------------
// User fetching
// ---------------------------------------------------------------------------

/**
 * Fetches all platform users (used for chat suggestions).
 */
export async function fetchChatUsers(): Promise<ChatUserPreview[]> {
  try {
    const q = query(collection(db, 'users'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map(
      (d) => ({ uid: d.id, ...d.data() } as ChatUserPreview),
    );
  } catch (e) {
    console.error('Failed to fetch chat users:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Chat fetching
// ---------------------------------------------------------------------------

/**
 * Fetches all chats where the user is a participant, ordered by most recent.
 *
 * NOTE: Requires a composite Firestore index: { participants (array), updatedAt (desc) }.
 */
export async function fetchChatsForUser(uid: string): Promise<Record<string, unknown>[]> {
  if (!uid) {
    console.warn('fetchChatsForUser: uid is required.');
    return [];
  }

  try {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', uid),
      orderBy('updatedAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeChatRow({ id: d.id, data: d.data.bind(d) }));
  } catch (e) {
    console.error('Failed to fetch chats:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Message fetching
// ---------------------------------------------------------------------------

/**
 * Fetches messages for a specific chat, ordered chronologically.
 */
export async function fetchMessagesForChat(chatId: string): Promise<ChatMessage[]> {
  if (!chatId) {
    console.warn('fetchMessagesForChat: chatId is required.');
    return [];
  }

  try {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200),
    );
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      chatId,
      ...d.data(),
      createdAt: toMillis(d.data().createdAt) || Date.now(),
    } as ChatMessage));
  } catch (e) {
    console.error('Failed to fetch messages:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Chat creation
// ---------------------------------------------------------------------------

/**
 * Ensures a 1-on-1 chat document exists between the given participants.
 * The chat ID is deterministic: sorted UIDs joined by `__`.
 */
export async function ensureRuntimeChat(
  participants: string[],
  metadata?: Record<string, { displayName: string; photoURL?: string }>
): Promise<Record<string, unknown>> {
  assertParticipants(participants);

  const sortedParticipants = [...participants].sort();
  const chatId = sortedParticipants.join('__');
  const chatRef = doc(db, 'chats', chatId);

  try {
    const snap = await getDoc(chatRef);
    if (snap.exists()) {
      return { id: chatId, ...snap.data() };
    }

    const chatData = {
      participants: sortedParticipants,
      participantMetadata: metadata || {},
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      lastMessageSenderId: null,
    };
    await setDoc(chatRef, chatData);
    return { ...chatData, id: chatId };
  } catch (e) {
    console.error('Failed to ensure chat:', e);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Message posting
// ---------------------------------------------------------------------------

interface PostMessageParams {
  chatId: string;
  senderId: string;
  text: string;
  type?: 'text' | 'image';
  attachmentUrl?: string;
  senderMetadata?: { displayName: string; photoURL?: string };
}

/**
 * Persists a new message to Firestore and updates the parent chat's metadata.
 * Returns the new message with an optimistic `createdAt` timestamp.
 */
export async function postRuntimeMessage(
  params: PostMessageParams,
): Promise<ChatMessage> {
  const { chatId, senderId, text, type = 'text', attachmentUrl } = params;

  if (!chatId || !senderId) {
    throw new Error('postRuntimeMessage: chatId and senderId are required.');
  }

  const messageData: Omit<ChatMessage, 'id'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    chatId,
    senderId,
    text,
    type,
    createdAt: serverTimestamp() as any,
    read: false,
    ...(attachmentUrl ? { attachmentUrl } : {}),
  };

  try {
    const msgRef = await addDoc(
      collection(db, 'chats', chatId, 'messages'),
      messageData,
    );

    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      lastMessage: type === 'image' ? '📷 Foto' : text,
      lastMessageTime: serverTimestamp(),
      lastMessageSenderId: senderId,
      lastMessageId: msgRef.id,
      updatedAt: serverTimestamp(),
      ...(params.senderMetadata ? { [`participantMetadata.${senderId}`]: params.senderMetadata } : {}),
    });

    return {
      id: msgRef.id,
      chatId,
      senderId,
      text,
      type,
      ...(attachmentUrl ? { attachmentUrl } : {}),
      createdAt: Date.now(),
      read: false,
    };
  } catch (e) {
    console.error('Failed to post message:', e);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Read receipts
// ---------------------------------------------------------------------------

/**
 * Marks all unread messages sent by the other participant as read.
 * Uses a batch write for efficiency.
 *
 * NOTE: Requires a composite index on `messages`: { senderId, read }.
 */
export async function markMessagesAsRead(
  chatId: string,
  viewerUid: string,
): Promise<void> {
  if (!chatId || !viewerUid) return;

  try {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      where('read', '==', false),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      if (d.data().senderId !== viewerUid) {
        batch.update(d.ref, { read: true });
      }
    });
    await batch.commit();
  } catch (e) {
    console.error('Failed to mark messages as read:', e);
  }
}

// ---------------------------------------------------------------------------
// Chat list builder
// ---------------------------------------------------------------------------

/**
 * Merges raw chat documents with user previews to produce a sorted ChatListItem[].
 * Sorting: pinned first, then by lastMessageTime descending.
 */
export function buildChatList(
  chats: Record<string, any>[],
  users: ChatUserPreview[],
  viewerUid: string,
  previousUnread: Record<string, number> = {},
): ChatListItem[] {
  const userMap = new Map(users.map((u) => [u.uid, u]));

  return chats
    .map((chat): ChatListItem => {
      const chatId: string = chat.id;
      const otherUid: string =
        (chat.participants as string[]).find((p) => p !== viewerUid) ?? viewerUid;

      const metadata = chat.participantMetadata?.[otherUid];
      const otherUser: ChatUserPreview = userMap.get(otherUid) ?? {
        uid: otherUid,
        displayName: metadata?.displayName || 'Carregando...',
        photoURL: metadata?.photoURL,
      };

      return {
        id: chatId,
        participants: chat.participants ?? [],
        lastMessage: chat.lastMessage ?? '',
        lastMessageTime: chat.lastMessageTime ?? chat.updatedAt ?? 0,
        lastMessageSenderId: chat.lastMessageSenderId ?? undefined,
        unreadCount: previousUnread[chatId] ?? 0,
        pinned: Boolean(chat.pinned),
        updatedAt: chat.updatedAt,
        createdAt: chat.createdAt,
        otherUser,
      };
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.lastMessageTime ?? 0) - (a.lastMessageTime ?? 0);
    });
}

// ---------------------------------------------------------------------------
// Message grouping
// ---------------------------------------------------------------------------

/**
 * Groups an already-sorted message array by calendar day (pt-BR locale).
 * Returns entries in chronological order via Map insertion order.
 */
export function groupMessagesByDay(
  messages: ChatMessage[],
): [string, ChatMessage[]][] {
  const groups = new Map<string, ChatMessage[]>();

  for (const message of messages) {
    const label = new Date(message.createdAt).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
    });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(message);
  }

  return [...groups.entries()];
}
