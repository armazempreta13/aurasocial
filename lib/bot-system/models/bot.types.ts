// Bot Types and Interfaces for Data Simulation System

export type BotStatus = 'idle' | 'running' | 'paused' | 'stopped';
export type ActivityType = 'post' | 'comment' | 'like' | 'share' | 'follow';

export interface BotConfig {
  id: string;
  name: string;
  enabled: boolean;
  status: BotStatus;
  postsPerDay: number;
  commentsPerPost: number;
  likePercentage: number;
  imagePercentage: number;
  delayBetweenActions: number; // ms
  createdAt: number;
  updatedAt: number;
}

export interface BotUser {
  id: string;
  displayName: string;
  photoURL: string;
  bio: string;
  username: string;
  verified: boolean;
}

export interface GeneratedPost {
  content: string;
  imageUrl?: string;
  hashtags: string[];
  mentions: string[];
  communityId?: string;
  visibility: 'public' | 'private' | 'community';
}

export interface GeneratedComment {
  content: string;
  postId: string;
  authorId: string;
  parentCommentId?: string;
}

export interface BotActivity {
  id: string;
  botId: string;
  type: ActivityType;
  targetId: string; // postId, commentId, etc
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface BotMetrics {
  totalPosts: number;
  totalComments: number;
  totalLikes: number;
  totalShares: number;
  totalFollows: number;
  activeDays: number;
  lastActivityAt: number;
  createdAt: number;
}

export interface BotState {
  config: BotConfig;
  users: BotUser[];
  metrics: BotMetrics;
  activities: BotActivity[];
  lastRun: number;
  isRunning: boolean;
}
