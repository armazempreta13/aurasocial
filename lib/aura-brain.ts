import { Timestamp } from 'firebase/firestore';

/**
 * AURA SOCIAL BRAIN v2.0
 * Advanced Algorithm for Ranking, Discovery and Engagement Velocity.
 * Inspired by Big Tech retention strategies but tailored for Premium Insight.
 */

export interface PostMetrics {
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  reactionCounts?: Record<string, number>;
  createdAt: any;
  authorId: string;
  hasImage?: boolean;
  content?: string;
  score?: number; // Emotional score from v1
}

export interface UserPreferences {
  friendIds: Set<string>;
  interests: string[];
  blockedUserIds: Set<string>;
  uid?: string;
}

export type FeedMode = 'for_you' | 'discovery' | 'social' | 'deep' | 'trending' | 'top' | 'recent';

// Engagement Weights (Big Tech standard)
const WEIGHTS = {
  LIKE: 1,
  REACTION: 2.5,
  COMMENT: 8,
  SHARE: 15,
  SAVE: 10,
  IMAGE_BONUS: 0.1,
  FRIEND_BOOST: 3.5,
  INTEREST_BOOST: 2.0,
};

/**
 * Calculates the Momentum Score (Interaction Velocity)
 * High momentum detects viral content in real-time.
 */
export function calculateMomentum(post: PostMetrics, now: number, volatileBoost: number = 0): number {
  const createdAt = post.createdAt?.toDate ? post.createdAt.toDate().getTime() : now;
  const ageInHours = Math.max(0.1, (now - createdAt) / (1000 * 60 * 60));
  
  // Base engagement with standard weights
  let engagement = 
    (post.likesCount || 0) * WEIGHTS.LIKE +
    (post.commentsCount || 0) * WEIGHTS.COMMENT +
    (post.sharesCount || 0) * WEIGHTS.SHARE;

  // Add weighted specific reactions if available
  if (post.reactionCounts) {
    Object.entries(post.reactionCounts).forEach(([type, count]) => {
      // We subtract the basic LIKE weight already added by likesCount 
      // to apply the specific REACTION bonus if it's an emotional reaction
      const bonus = WEIGHTS.REACTION - WEIGHTS.LIKE;
      engagement += (count * bonus);
    });
  }

  // Velocity = (Engagement + VolatileBoost) / (Hours + Gravity)^Exponential
  const gravity = 1.4; // Slightly lower gravity for more viral potential
  return (engagement + volatileBoost) / Math.pow(ageInHours + 1.2, gravity);
}

/**
 * The "For You" Ranking Engine
 */
export function calculateRelevanceScore(
  post: PostMetrics, 
  user: UserPreferences, 
  now: number
): number {
  if (user.blockedUserIds.has(post.authorId)) return -1;

  let score = calculateMomentum(post, now);

  // 1. Social Affinity (Graph)
  if (user.friendIds.has(post.authorId)) {
    score *= WEIGHTS.FRIEND_BOOST;
  }

  // 2. Interest Alignment (Semantic)
  if (user.interests.length > 0 && post.content) {
    const contentLower = post.content.toLowerCase();
    const matchesMatch = user.interests.filter(i => contentLower.includes(i.toLowerCase())).length;
    if (matchesMatch > 0) {
      score *= (1 + (matchesMatch * 0.5));
    }
  }

  // 3. Quality & Density Boost
  if (post.hasImage) score *= 1.1;
  if ((post.content?.length || 0) > 280) score *= 1.2; // Reward deep content in Aura

  // 4. Cold Start Anti-Bias
  // Ensure new posts get a minimum "exploration" score
  const ageInMinutes = (now - (post.createdAt?.toDate ? post.createdAt.toDate().getTime() : now)) / (1000 * 60);
  if (ageInMinutes < 30) {
    score += 50; // New insight exploration boost
  }

  return score;
}

/**
 * Detects the Post "Vibe" state
 */
export function getPostVibe(post: PostMetrics, now: number): 'new' | 'warming' | 'viral' | 'classic' | 'saturated' {
  const momentum = calculateMomentum(post, now);
  const createdAt = post.createdAt?.toDate ? post.createdAt.toDate().getTime() : now;
  const ageInHours = (now - createdAt) / (1000 * 60 * 60);

  if (ageInHours < 1) return 'new';
  if (momentum > 100) return 'viral';
  if (momentum > 20) return 'warming';
  if (ageInHours > 48) return 'classic';
  return 'saturated';
}
