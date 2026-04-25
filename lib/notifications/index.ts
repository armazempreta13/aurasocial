/**
 * lib/notifications/index.ts
 * Public barrel — re-exports everything the rest of the app needs.
 * Import from '@/lib/notifications' instead of individual files.
 */

export type {
  NotificationType,
  NotificationPriority,
  NotificationColor,
  NotificationActor,
  NotificationPayload,
  Notification,
  GroupedNotification,
  NotificationSettings,
} from './types';

export {
  DEFAULT_SETTINGS,
  PRIORITY_MAP,
  PRIORITY_WEIGHT,
  getNotificationColor,
  getNotificationLink,
  computeScore,
} from './types';

export { groupNotifications, buildNotificationText } from './grouper';

export {
  createNotification,
  markNotificationRead,
  markNotificationsRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
  subscribeToNotifications,
  getNotificationSettings,
  saveNotificationSettings,
  cleanupOldNotifications,
  broadcastSync,
  listenSync,
  isDuplicate,
} from './engine';

export { useNotifications } from './useNotifications';
export type { UseNotificationsResult } from './useNotifications';

// ─── Legacy compatibility shims ───────────────────────────────────────────────
// These names were used by the old notifications.ts. They are re-exported here
// so that existing callers (NotificationsDropdown, PostCard, etc.) don't break.

export {
  markAllRead as markAllNotificationsRead,
  markNotificationRead as markNotificationRead_legacy,
} from './engine';

// getNotificationColor + getNotificationLink already exported above.
// NotificationType, Notification, etc. already exported above.
// subscribeToNotifications already exported above.
