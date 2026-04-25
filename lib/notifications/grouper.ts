/**
 * notifications/grouper.ts
 * Pure function — groups raw Notification[] → GroupedNotification[]
 * No Firebase, no React — safe to use in any context.
 */

import type { Notification, GroupedNotification } from './types';
import { PRIORITY_MAP, computeScore } from './types';

/** Window (ms) within which events on the same entity are grouped together */
const GROUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Maximum actors stored in preview per group */
const MAX_PREVIEW_ACTORS = 3;

/** Maximum unique actors stored per group */
const MAX_ACTOR_POOL = 50;

/**
 * Groups raw notifications from Firestore into aggregated display groups.
 * - Same type + entityId within GROUP_WINDOW_MS → one group
 * - Sorted by computed priority + recency score (highest first)
 */
export function groupNotifications(raw: Notification[]): GroupedNotification[] {
  const groupMap = new Map<string, GroupedNotification>();

  // Sort by timestamp descending so newest event wins context fields
  const sorted = [...raw].sort((a, b) => {
    const msA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const msB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return msB - msA;
  });

  for (const n of sorted) {
    const entityId =
      n.postId || n.commentId || n.communityId || n.storyId || n.actorId;
    const ms = n.createdAt?.toMillis ? n.createdAt.toMillis() : 0;
    // Time bucket: 1-hour windows
    const bucket = Math.floor(ms / GROUP_WINDOW_MS);
    const groupKey = `${n.type}__${entityId}__${bucket}`;

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        groupKey,
        id: n.id,
        type: n.type,
        priority: PRIORITY_MAP[n.type] ?? 'low',
        actors: [],
        actorCount: 0,
        read: true,       // will be set false if any member is unread
        rawIds: [],
        updatedAt: null,
        postId: n.postId,
        commentId: n.commentId,
        communityId: n.communityId,
        communityName: n.communityName,
        storyId: n.storyId,
        extraText: n.extraText,
      });
    }

    const group = groupMap.get(groupKey)!;

    // Track all raw IDs for batch mark-read
    group.rawIds.push(n.id);

    // Track unread status
    if (!n.read) group.read = false;

    // Keep most recent timestamp
    const currentMs = n.createdAt?.toMillis ? n.createdAt.toMillis() : 0;
    const groupMs = group.updatedAt?.toMillis ? group.updatedAt.toMillis() : 0;
    if (currentMs > groupMs) group.updatedAt = n.createdAt;

    // Add unique actor (bounded)
    if (
      group.actors.length < MAX_ACTOR_POOL &&
      !group.actors.some((a) => a.uid === n.actorId)
    ) {
      group.actors.push({
        uid: n.actorId,
        displayName: n.actorName,
        photoURL: n.actorPhoto,
      });
    }

    group.actorCount++;
  }

  const groups = Array.from(groupMap.values());

  // Sort by score (priority × recency)
  return groups.sort((a, b) => {
    // Unread groups always first
    if (a.read !== b.read) return a.read ? 1 : -1;
    return computeScore(b.type, b.updatedAt) - computeScore(a.type, a.updatedAt);
  });
}

/**
 * Builds a human-readable text for a grouped notification.
 * e.g. "João e mais 2 pessoas curtiram seu post"
 */
export function buildNotificationText(g: GroupedNotification): string {
  const first = g.actors[0]?.displayName || 'Alguém';
  const extra = g.actorCount - 1;

  const subject =
    extra > 0
      ? `${first} e mais ${extra} ${extra === 1 ? 'pessoa' : 'pessoas'}`
      : first;

  switch (g.type) {
    case 'like':
      return `${subject} curtiram seu post.`;
    case 'comment':
      return extra > 0
        ? `${subject} comentaram no seu post.`
        : `${first} comentou no seu post.`;
    case 'reply':
      return extra > 0
        ? `${subject} responderam ao seu comentário.`
        : `${first} respondeu ao seu comentário.`;
    case 'follow':
      return extra > 0
        ? `${subject} começaram a te seguir.`
        : `${first} começou a te seguir.`;
    case 'friend_request':
      return `${first} te enviou uma solicitação de amizade.`;
    case 'friend_accept':
      return `${first} aceitou sua solicitação de amizade.`;
    case 'share':
      return extra > 0
        ? `${subject} compartilharam seu post.`
        : `${first} compartilhou seu post.`;
    case 'mention':
      return `${first} te mencionou em um post.`;
    case 'community_post':
      return `${first} publicou em ${g.communityName || 'sua comunidade'}.`;
    case 'community_invite':
      return `${first} te convidou para ${g.communityName || 'uma comunidade'}.`;
    case 'community_accept':
      return `Você foi aceito em ${g.communityName || 'uma comunidade'}.`;
    case 'story_reaction':
      return `${first} reagiu ao seu story.`;
    case 'story_reply':
      return `${first} respondeu ao seu story.`;
    case 'post_tag':
      return `${first} te marcou em um post.`;
    case 'poll_vote':
      return extra > 0
        ? `${subject} votaram na sua enquete.`
        : `${first} votou na sua enquete.`;
    case 'system':
      return g.extraText || 'Nova notificação do sistema.';
    default:
      return `${first} interagiu com você.`;
  }
}
