'use client';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  orderBy,
  onSnapshot,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'friend_request'
  | 'friend_accept'
  | 'share'
  | 'mention'
  | 'community_invite'
  | 'community_post'
  | 'reply';

export interface NotificationPayload {
  userId: string;          // recipient
  actorId: string;         // who triggered it
  actorName: string;
  actorPhoto: string;
  type: NotificationType;
  postId?: string | null;
  commentId?: string | null;
  communityId?: string | null;
  communityName?: string | null;
  extraText?: string | null; // for comment snippet, mention context, etc.
}

export interface Notification extends NotificationPayload {
  id: string;
  read: boolean;
  createdAt: Timestamp | null;
}

// ─── Dedup window (prevent duplicate notifs within 10 min same actor+type+post) ──

const DEDUP_MINUTES = 10;

function isPermissionDenied(error: any) {
  return (
    error?.code === 'permission-denied' ||
    String(error?.message || '').includes('Missing or insufficient permissions')
  );
}

async function isDuplicate(payload: NotificationPayload): Promise<boolean> {
  try {
    const since = new Date(Date.now() - DEDUP_MINUTES * 60 * 1000);
    // REMOVED orderBy to avoid requiring composite indexes
    const constraints = [
      where('userId', '==', payload.userId),
      where('actorId', '==', payload.actorId),
      where('type', '==', payload.type),
    ];
    
    if (payload.postId) {
      constraints.push(where('postId', '==', payload.postId));
    }

    const dupQuery = query(
      collection(db, 'notifications'),
      ...constraints,
      limit(5)
    );
    
    const snap = await getDocs(dupQuery);
    if (snap.empty) return false;
    
    // Check timing locally since we can't orderBy
    return snap.docs.some(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(0);
      return createdAt > since;
    });
  } catch (err) {
    if (!isPermissionDenied(err)) {
      console.warn('Dedup check failed (likely missing index), skipping:', err);
    }
    return false;
  }
}

// ─── Core create ───────────────────────────────────────────────────────────────

export async function createNotification(payload: NotificationPayload): Promise<void> {
  // Never notify yourself
  if (payload.userId === payload.actorId) return;

  const dup = await isDuplicate(payload);
  if (dup) return;

  await addDoc(collection(db, 'notifications'), {
    ...payload,
    postId: payload.postId ?? null,
    commentId: payload.commentId ?? null,
    communityId: payload.communityId ?? null,
    communityName: payload.communityName ?? null,
    extraText: payload.extraText ?? null,
    read: false,
    createdAt: serverTimestamp(),
  });
}

// ─── Read management ──────────────────────────────────────────────────────────

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', uid),
    where('read', '==', false),
    limit(100)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', notificationId));
}

export async function deleteAllNotifications(uid: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', uid),
    limit(100)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ─── Real-time subscription ────────────────────────────────────────────────────

export function subscribeToNotifications(
  uid: string,
  callback: (notifications: Notification[]) => void,
  maxItems = 50
): Unsubscribe {
  // Try with orderBy first, fallback to unordered if index is missing
  const qBase = query(
    collection(db, 'notifications'),
    where('userId', '==', uid)
  );
  
  const qOrdered = query(qBase, orderBy('createdAt', 'desc'), limit(maxItems));

  let fallbackUnsub: Unsubscribe | null = null;
  const mainUnsub = onSnapshot(qOrdered, (snap) => {
    const items: Notification[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Notification, 'id'>),
    }));
    callback(items);
  }, (err) => {
    if (err.code === 'failed-precondition' || err.message.includes('index')) {
      console.warn('Notifications ordered index missing, falling back to unordered client-side sort');
      // FALLBACK: Query without orderBy and sort on client
      fallbackUnsub = onSnapshot(query(qBase, limit(maxItems * 2)), (snap) => {
        const items: Notification[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Notification, 'id'>),
          }))
          .sort((a, b) => {
            const tA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : 0;
            const tB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : 0;
            return tB - tA;
          })
          .slice(0, maxItems);
        callback(items);
      }, (err2) => {
        console.error('Notifications fallback listener error:', err2);
      });
    } else {
      console.error('Notifications main listener error:', err);
    }
  });

  return () => {
    mainUnsub();
    if (fallbackUnsub) fallbackUnsub();
  };
}

// ─── Helper: notification link resolution ─────────────────────────────────────

export function getNotificationLink(n: Notification): string {
  switch (n.type) {
    case 'like':
    case 'comment':
    case 'share':
    case 'mention':
    case 'reply':
      return n.postId ? `/post/${n.postId}` : `/profile/${n.actorId}`;
    case 'follow':
    case 'friend_request':
    case 'friend_accept':
      return `/profile/${n.actorId}`;
    case 'community_invite':
    case 'community_post':
      return n.communityId ? `/communities/${n.communityId}` : `/feed`;
    default:
      return '/notifications';
  }
}

// ─── Helper: notification icon colour ─────────────────────────────────────────

export type NotificationColor =
  | 'red' | 'blue' | 'green' | 'violet' | 'primary' | 'emerald' | 'amber' | 'sky';

export function getNotificationColor(type: NotificationType): NotificationColor {
  switch (type) {
    case 'like': return 'red';
    case 'comment': return 'blue';
    case 'reply': return 'sky';
    case 'follow': return 'green';
    case 'friend_request': return 'primary';
    case 'friend_accept': return 'emerald';
    case 'share': return 'violet';
    case 'mention': return 'amber';
    case 'community_invite':
    case 'community_post': return 'primary';
    default: return 'primary';
  }
}
