import { db } from '@/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  limit,
  serverTimestamp,
  updateDoc,
  increment,
  doc,
} from 'firebase/firestore';
import { generatePost } from '../generators/post-generator';
import { generateComment, generateCommentCount } from '../generators/comment-generator';
import { generateBotName, generateUsername, generateBio } from '../generators/name-generator';
import { BotActivity } from '../models/bot.types';
import { 
  recordActivity, 
  incrementBotMetric,
  getBotConfig,
} from '../storage/bot-storage';

export interface BotEngineOptions {
  botId: string;
  botDisplayName: string;
  botUserId: string;
  photoURL?: string;
}

export class BotEngine {
  private botId: string;
  private botDisplayName: string;
  private botUserId: string;
  private photoURL: string;
  private isRunning = false;

  constructor(options: BotEngineOptions) {
    this.botId = options.botId;
    this.botDisplayName = options.botDisplayName;
    this.botUserId = options.botUserId;
    this.photoURL = options.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(options.botDisplayName)}`;
  }

  async generateAndPublishPost(): Promise<string | null> {
    try {
      const generatedPost = generatePost();
      
      const postData = {
        content: generatedPost.content,
        imageUrl: generatedPost.imageUrl || null,
        authorId: this.botUserId,
        authorName: this.botDisplayName,
        authorPhoto: this.photoURL,
        visibility: generatedPost.visibility,
        communityId: generatedPost.communityId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        score: 0,
        hashtags: generatedPost.hashtags,
        mentions: generatedPost.mentions,
        isBot: true,
        botId: this.botId,
      };

      const docRef = await addDoc(collection(db, 'posts'), postData);
      
      // Record activity
      await recordActivity({
        id: `${Date.now()}-post`,
        botId: this.botId,
        type: 'post',
        targetId: docRef.id,
        timestamp: Date.now(),
        success: true,
      });

      // Update metrics
      await incrementBotMetric(this.botId, 'totalPosts', 1);

      return docRef.id;
    } catch (error) {
      console.error('Bot: Error generating post:', error);
      await recordActivity({
        id: `${Date.now()}-post-error`,
        botId: this.botId,
        type: 'post',
        targetId: '',
        timestamp: Date.now(),
        success: false,
        error: String(error),
      });
      return null;
    }
  }

  async generateCommentsOnRandomPost(commentCount?: number): Promise<number> {
    try {
      // Get a random recent post
      const postsQuery = query(
        collection(db, 'posts'),
        where('visibility', '==', 'public'),
        limit(50)
      );
      const postsSnap = await getDocs(postsQuery);
      
      if (postsSnap.empty) return 0;

      const posts = postsSnap.docs;
      const randomPost = posts[Math.floor(Math.random() * posts.length)];
      const postId = randomPost.id;

      // Generate comments
      const count = commentCount || generateCommentCount();
      let successCount = 0;

      for (let i = 0; i < count; i++) {
        try {
          const generatedComment = generateComment(postId, this.botUserId);

          const commentData = {
            postId,
            content: generatedComment.content,
            authorId: this.botUserId,
            authorName: this.botDisplayName,
            authorPhoto: this.photoURL,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            likesCount: 0,
            isBot: true,
            botId: this.botId,
          };

          const docRef = await addDoc(collection(db, 'comments'), commentData);

          // Update post comment count
          const postRef = doc(db, 'posts', postId);
          await updateDoc(postRef, {
            commentsCount: increment(1),
          });

          // Record activity
          await recordActivity({
            id: `${Date.now()}-comment-${i}`,
            botId: this.botId,
            type: 'comment',
            targetId: docRef.id,
            timestamp: Date.now(),
            success: true,
          });

          successCount++;
        } catch (err) {
          console.error('Bot: Error generating comment:', err);
        }
      }

      if (successCount > 0) {
        await incrementBotMetric(this.botId, 'totalComments', successCount);
      }

      return successCount;
    } catch (error) {
      console.error('Bot: Error generating comments:', error);
      return 0;
    }
  }

  async likeRandomPost(): Promise<boolean> {
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        where('visibility', '==', 'public'),
        limit(100)
      );
      const postsSnap = await getDocs(postsQuery);
      
      if (postsSnap.empty) return false;

      const posts = postsSnap.docs;
      const randomPost = posts[Math.floor(Math.random() * posts.length)];
      const postId = randomPost.id;

      // Check if bot already liked it
      const likesQuery = query(
        collection(db, 'likes'),
        where('postId', '==', postId),
        where('userId', '==', this.botUserId),
        limit(1)
      );
      const likesSnap = await getDocs(likesQuery);

      if (!likesSnap.empty) return false; // Already liked

      // Create like
      const likeData = {
        postId,
        userId: this.botUserId,
        type: 'like',
        createdAt: serverTimestamp(),
        isBot: true,
        botId: this.botId,
      };

      const docRef = await addDoc(collection(db, 'likes'), likeData);

      // Update post likes count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        likesCount: increment(1),
      });

      // Record activity
      await recordActivity({
        id: `${Date.now()}-like`,
        botId: this.botId,
        type: 'like',
        targetId: docRef.id,
        timestamp: Date.now(),
        success: true,
      });

      await incrementBotMetric(this.botId, 'totalLikes', 1);

      return true;
    } catch (error) {
      console.error('Bot: Error liking post:', error);
      return false;
    }
  }

  async runDailyActivity(): Promise<{ posts: number; comments: number; likes: number }> {
    const config = await getBotConfig(this.botId);
    if (!config || !config.enabled) {
      return { posts: 0, comments: 0, likes: 0 };
    }

    let postsCount = 0;
    let commentsCount = 0;
    let likesCount = 0;

    // Generate posts
    for (let i = 0; i < config.postsPerDay; i++) {
      const postId = await this.generateAndPublishPost();
      if (postId) {
        postsCount++;
        
        // Wait between posts
        await this.delay(config.delayBetweenActions);

        // Generate comments on each post
        const commentCount = await this.generateCommentsOnRandomPost(config.commentsPerPost);
        commentsCount += commentCount;

        await this.delay(config.delayBetweenActions);
      }
    }

    // Generate likes
    const likeCount = Math.floor(config.likePercentage);
    for (let i = 0; i < likeCount; i++) {
      const success = await this.likeRandomPost();
      if (success) likesCount++;
      await this.delay(config.delayBetweenActions / 2);
    }

    return { posts: postsCount, comments: commentsCount, likes: likesCount };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export async function createBotUser(
  displayName?: string,
  photoURL?: string
): Promise<{ displayName: string; username: string; photoURL: string; bio: string }> {
  return {
    displayName: displayName || generateBotName(),
    username: generateUsername(),
    photoURL: photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || generateBotName())}&background=random`,
    bio: generateBio(),
  };
}
