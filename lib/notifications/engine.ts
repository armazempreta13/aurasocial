'use client';

/**
 * notifications/engine.ts
 * Real-time Firestore engine: subscribe, CRUD, dedup, cross-tab sync.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { Notification, NotificationPayload, NotificationSettings } from './types';
import { DEFAULT_SETTINGS } from './types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_NOTIFICATIONS = 50;
const CLEANUP_AGE_DAYS = 30;

// ─── Cross-tab sync via BroadcastChannel ──────────────────────────────────────

type SyncMessage =
  | { type: 'MARK_READ'; ids: string[] }
  | { type: 'MARK_ALL_READ'; uid: string }
  | { type: 'DELETE'; id: string };

let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!_channel) {
    try {
      _channel = new BroadcastChannel('aura_notifications');
    } catch {
      return null;
    }
  }
  return _channel;
}

export function broadcastSync(msg: SyncMessage) {
  getChannel()?.postMessage(msg);
}

export function listenSync(callback: (msg: SyncMessage) => void): () => void {
  const ch = getChannel();
  if (!ch) {
    // Fallback: localStorage events for Safari
    const handler = (e: StorageEvent) => {
      if (e.key === 'aura_notif_sync' && e.newValue) {
        try { callback(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
  const handler = (e: MessageEvent) => callback(e.data as SyncMessage);
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export async function isDuplicate(payload: NotificationPayload): Promise<boolean> {
  try {
    const since = new Date(Date.now() - DEDUP_WINDOW_MS);
    const constraints = [
      where('userId', '==', payload.userId),
      where('actorId', '==', payload.actorId),
      where('type', '==', payload.type),
    ];
    if (payload.postId) constraints.push(where('postId', '==', payload.postId));

    const snap = await getDocs(
      query(collection(db, 'notifications'), ...constraints, limit(5))
    );
    if (snap.empty) return false;

    return snap.docs.some((d) => {
      const ts = d.data().createdAt?.toDate?.();
      return ts && ts > since;
    });
  } catch {
    return false;
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createNotification(payload: NotificationPayload): Promise<void> {
  if (payload.userId === payload.actorId) return; // never self-notify

  const dup = await isDuplicate(payload);
  if (dup) return;

  await addDoc(collection(db, 'notifications'), {
    ...payload,
    postId:        payload.postId        ?? null,
    commentId:     payload.commentId     ?? null,
    communityId:   payload.communityId   ?? null,
    communityName: payload.communityName ?? null,
    storyId:       payload.storyId       ?? null,
    extraText:     payload.extraText     ?? null,
    read: false,
    createdAt: serverTimestamp(),
  });
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { read: true, readAt: serverTimestamp() });
  broadcastSync({ type: 'MARK_READ', ids: [id] });
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const batch = writeBatch(db);
  ids.forEach((id) =>
    batch.update(doc(db, 'notifications', id), { read: true, readAt: serverTimestamp() })
  );
  await batch.commit();
  broadcastSync({ type: 'MARK_READ', ids });
}

export async function markAllRead(uid: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', uid),
    where('read', '==', false),
    limit(100)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true, readAt: serverTimestamp() }));
  await batch.commit();
  broadcastSync({ type: 'MARK_ALL_READ', uid });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteNotification(id: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', id));
  broadcastSync({ type: 'DELETE', id });
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
  callback: (notifications: Notification[]) => void
): Unsubscribe {
  const ordered = query(
    collection(db, 'notifications'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(MAX_NOTIFICATIONS)
  );

  let fallbackUnsub: Unsubscribe | null = null;

  const mainUnsub = onSnapshot(
    ordered,
    (snap) => {
      const items: Notification[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Notification, 'id'>),
      }));
      callback(items);
    },
    (err) => {
      // Index missing → client-side sort fallback
      if (
        err.code === 'failed-precondition' ||
        err.message?.includes('index')
      ) {
        const fallback = query(
          collection(db, 'notifications'),
          where('userId', '==', uid),
          limit(MAX_NOTIFICATIONS * 2)
        );
        fallbackUnsub = onSnapshot(fallback, (snap) => {
          const items: Notification[] = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Notification, 'id'>) }))
            .sort((a, b) => {
              const msA = a.createdAt?.toMillis?.() ?? 0;
              const msB = b.createdAt?.toMillis?.() ?? 0;
              return msB - msA;
            })
            .slice(0, MAX_NOTIFICATIONS);
          callback(items);
        });
      }
    }
  );

  return () => {
    mainUnsub();
    fallbackUnsub?.();
  };
}

// ─── Notification Settings ────────────────────────────────────────────────────

export async function getNotificationSettings(uid: string): Promise<NotificationSettings> {
  const snap = await getDocs(
    query(collection(db, 'notification_settings'), where('userId', '==', uid), limit(1))
  );
  if (snap.empty) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(snap.docs[0].data() as Partial<NotificationSettings>) };
}

export async function saveNotificationSettings(
  uid: string,
  settings: Partial<NotificationSettings>
): Promise<void> {
  const ref = doc(db, 'notification_settings', uid);
  await updateDoc(ref, { ...settings, userId: uid, updatedAt: serverTimestamp() }).catch(() =>
    addDoc(collection(db, 'notification_settings'), { ...DEFAULT_SETTINGS, ...settings, userId: uid, updatedAt: serverTimestamp() })
  );
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function cleanupOldNotifications(uid: string): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - CLEANUP_AGE_DAYS * 24 * 60 * 60 * 1000);
    const snap = await getDocs(
      query(
        collection(db, 'notifications'),
        where('userId', '==', uid),
        where('read', '==', true),
        limit(50)
      )
    );
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs
      .filter((d) => {
        const ts = d.data().createdAt?.toDate?.();
        return ts && ts < cutoff;
      })
      .forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch {
    // Non-critical, silently skip
  }
}
