'use client';

/**
 * notifications/useNotifications.ts
 * React hook — real-time grouped notifications with cross-tab sync,
 * sound effects, local cache and memoised derived data.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { soundEffects } from '@/lib/sound-effects';
import type { Notification, GroupedNotification } from './types';
import { groupNotifications } from './grouper';
import {
  subscribeToNotifications,
  markNotificationRead,
  markNotificationsRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
  listenSync,
  cleanupOldNotifications,
} from './engine';

const CACHE_KEY = 'aura_notif_cache_v2';
const MAX_CACHE = 50;

// ─── Local cache helpers ──────────────────────────────────────────────────────

function readCache(): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCache(notifications: Notification[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(notifications.slice(0, MAX_CACHE)));
  } catch {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseNotificationsResult {
  /** Grouped + sorted notifications for UI rendering */
  groups: GroupedNotification[];
  /** All raw (ungrouped) notifications */
  raw: Notification[];
  /** Total unread count */
  unreadCount: number;
  /** Whether the initial load is in progress */
  loading: boolean;
  /** Mark a single raw notification as read */
  markRead: (id: string) => Promise<void>;
  /** Mark all raw IDs in a group as read */
  markGroupRead: (rawIds: string[]) => Promise<void>;
  /** Mark every notification as read */
  markAllAsRead: () => Promise<void>;
  /** Delete a single notification */
  remove: (id: string) => Promise<void>;
  /** Delete all notifications */
  removeAll: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const uid = useAppStore((s) => s.profile?.uid);

  const [raw, setRaw] = useState<Notification[]>(() => readCache());
  const [loading, setLoading] = useState(true);
  const isFirstLoad = useRef(true);
  const prevIdsRef = useRef<Set<string>>(new Set());

  // ── Subscribe to Firestore ──────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;

    const unsub = subscribeToNotifications(uid, (incoming) => {
      setRaw((prev) => {
        // Detect new unread notifications that weren't in previous snapshot
        if (!isFirstLoad.current) {
          const prevIds = prevIdsRef.current;
          const newUnread = incoming.filter((n) => !n.read && !prevIds.has(n.id));
          if (newUnread.length > 0) {
            soundEffects.play('notification');
          }
        }

        // Update tracking
        isFirstLoad.current = false;
        prevIdsRef.current = new Set(incoming.map((n) => n.id));

        writeCache(incoming);
        return incoming;
      });
      setLoading(false);
    });

    // Cleanup old notifications once per session (non-blocking)
    cleanupOldNotifications(uid).catch(() => {});

    return unsub;
  }, [uid]);

  // ── Cross-tab sync (BroadcastChannel) ──────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const unsub = listenSync((msg) => {
      if (msg.type === 'MARK_READ') {
        const idSet = new Set(msg.ids);
        setRaw((prev) =>
          prev.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n))
        );
      } else if (msg.type === 'MARK_ALL_READ' && msg.uid === uid) {
        setRaw((prev) => prev.map((n) => ({ ...n, read: true })));
      } else if (msg.type === 'DELETE') {
        setRaw((prev) => prev.filter((n) => n.id !== msg.id));
      }
    });
    return unsub;
  }, [uid]);

  // ── Derived data (memoised) ────────────────────────────────────────────────
  const groups = useMemo(() => groupNotifications(raw), [raw]);
  const unreadCount = useMemo(() => raw.filter((n) => !n.read).length, [raw]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const markRead = useCallback(async (id: string) => {
    // Optimistic
    setRaw((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await markNotificationRead(id).catch(console.error);
  }, []);

  const markGroupRead = useCallback(async (rawIds: string[]) => {
    const idSet = new Set(rawIds);
    setRaw((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n))
    );
    await markNotificationsRead(rawIds).catch(console.error);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!uid) return;
    setRaw((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllRead(uid).catch(console.error);
  }, [uid]);

  const remove = useCallback(async (id: string) => {
    setRaw((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id).catch(console.error);
  }, []);

  const removeAll = useCallback(async () => {
    if (!uid) return;
    setRaw([]);
    await deleteAllNotifications(uid).catch(console.error);
  }, [uid]);

  return {
    groups,
    raw,
    unreadCount,
    loading,
    markRead,
    markGroupRead,
    markAllAsRead,
    remove,
    removeAll,
  };
}
