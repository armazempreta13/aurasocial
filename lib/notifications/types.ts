import { Timestamp } from 'firebase/firestore';

// ─── Core Types ───────────────────────────────────────────────────────────────

export type NotificationType =
  | 'like'
  | 'comment'
  | 'reply'
  | 'follow'
  | 'friend_request'
  | 'friend_accept'
  | 'share'
  | 'mention'
  | 'community_post'
  | 'community_invite'
  | 'community_accept'
  | 'story_reaction'
  | 'story_reply'
  | 'post_tag'
  | 'poll_vote'
  | 'system';

export type NotificationPriority = 'high' | 'medium' | 'low';

export type NotificationColor =
  | 'red' | 'blue' | 'green' | 'violet' | 'primary'
  | 'emerald' | 'amber' | 'sky' | 'rose' | 'orange';

// ─── Actor ────────────────────────────────────────────────────────────────────

export interface NotificationActor {
  uid: string;
  displayName: string;
  photoURL: string;
}

// ─── Raw Firestore Document ───────────────────────────────────────────────────

export interface NotificationPayload {
  userId: string;           // recipient
  actorId: string;          // who triggered it
  actorName: string;
  actorPhoto: string;
  type: NotificationType;
  postId?: string | null;
  commentId?: string | null;
  communityId?: string | null;
  communityName?: string | null;
  storyId?: string | null;
  extraText?: string | null;
}

export interface Notification extends NotificationPayload {
  id: string;
  read: boolean;
  createdAt: Timestamp | null;
}

// ─── Grouped / Aggregated (UI layer) ─────────────────────────────────────────

export interface GroupedNotification {
  /** Stable group key, used as React key */
  groupKey: string;
  /** Use first notification's ID for single-item groups */
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  /** Sorted list of unique actors (max preview: 3) */
  actors: NotificationActor[];
  /** Total actor count (may be > actors.length) */
  actorCount: number;
  /** False if any notification in the group is unread */
  read: boolean;
  /** IDs of all raw notifications in this group (for batch mark-read) */
  rawIds: string[];
  /** Latest timestamp in the group */
  updatedAt: Timestamp | null;
  /** Context fields from the most recent notification */
  postId?: string | null;
  commentId?: string | null;
  communityId?: string | null;
  communityName?: string | null;
  storyId?: string | null;
  extraText?: string | null;
}

// ─── User Notification Settings ──────────────────────────────────────────────

export interface NotificationSettings {
  likes: boolean;
  comments: boolean;
  replies: boolean;
  follows: boolean;
  friendRequests: boolean;
  mentions: boolean;
  shares: boolean;
  communityPosts: boolean;
  communityInvites: boolean;
  storyReactions: boolean;
  sound: boolean;
  desktop: boolean;
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  likes: true,
  comments: true,
  replies: true,
  follows: true,
  friendRequests: true,
  mentions: true,
  shares: true,
  communityPosts: true,
  communityInvites: true,
  storyReactions: true,
  sound: true,
  desktop: true,
};

// ─── Priority Map ─────────────────────────────────────────────────────────────

export const PRIORITY_MAP: Record<NotificationType, NotificationPriority> = {
  mention:          'high',
  reply:            'high',
  friend_request:   'high',
  community_invite: 'high',
  story_reply:      'high',
  post_tag:         'high',
  comment:          'medium',
  follow:           'medium',
  friend_accept:    'medium',
  community_accept: 'medium',
  share:            'low',
  like:             'low',
  community_post:   'low',
  story_reaction:   'low',
  poll_vote:        'low',
  system:           'medium',
};

export const PRIORITY_WEIGHT: Record<NotificationPriority, number> = {
  high:   3,
  medium: 2,
  low:    1,
};

// ─── Color / Icon Map ─────────────────────────────────────────────────────────

export function getNotificationColor(type: NotificationType): NotificationColor {
  switch (type) {
    case 'like':             return 'red';
    case 'comment':          return 'blue';
    case 'reply':            return 'sky';
    case 'follow':           return 'green';
    case 'friend_request':   return 'primary';
    case 'friend_accept':    return 'emerald';
    case 'share':            return 'violet';
    case 'mention':          return 'amber';
    case 'story_reaction':   return 'rose';
    case 'story_reply':      return 'orange';
    case 'community_invite':
    case 'community_post':
    case 'community_accept': return 'primary';
    case 'post_tag':         return 'amber';
    case 'poll_vote':        return 'blue';
    case 'system':           return 'primary';
    default:                 return 'primary';
  }
}

export function getNotificationLink(n: GroupedNotification | Notification): string {
  switch (n.type) {
    case 'like':
    case 'comment':
    case 'share':
    case 'mention':
    case 'reply':
    case 'post_tag':
    case 'poll_vote':
      return n.postId ? `/post/${n.postId}` : `/profile/${'actorId' in n ? n.actorId : n.actors?.[0]?.uid}`;
    case 'follow':
    case 'friend_request':
    case 'friend_accept':
      return 'actorId' in n ? `/profile/${n.actorId}` : `/profile/${n.actors?.[0]?.uid}`;
    case 'community_invite':
    case 'community_post':
    case 'community_accept':
      return n.communityId ? `/communities/${n.communityId}` : '/feed';
    case 'story_reaction':
    case 'story_reply':
      return n.storyId ? `/stories/${n.storyId}` : '/feed';
    case 'system':
      return '/notifications';
    default:
      return '/notifications';
  }
}

// ─── Score for sorting ────────────────────────────────────────────────────────

export function computeScore(type: NotificationType, updatedAt: Timestamp | null): number {
  const priorityWeight = PRIORITY_WEIGHT[PRIORITY_MAP[type]] ?? 1;
  const now = Date.now();
  const ms = updatedAt?.toMillis ? updatedAt.toMillis() : now;
  const ageHours = (now - ms) / (1000 * 60 * 60);
  // Recency decays over 48h
  const recencyWeight = Math.max(0, 1 - ageHours / 48);
  return priorityWeight * 0.6 + recencyWeight * 0.4;
}
