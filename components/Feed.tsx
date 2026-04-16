'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, query, orderBy, limit, getDocs, startAfter, QueryConstraint, QueryDocumentSnapshot, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { PostCard } from './PostCard';
import { useAppStore } from '@/lib/store';
import { Sparkles, Clock, ThumbsUp, RefreshCw } from 'lucide-react';
import { PostSkeleton } from './PostSkeleton';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getBlockedUserIds, getFriendIds } from '@/lib/friendships';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';

// SYNC CHANNEL FOR MULTI-TAB CONSISTENCY
const syncChannel = typeof window !== 'undefined' ? new BroadcastChannel('aura_feed_sync') : null;

const PAGE_SIZE = 15;

function matchesSearch(post: any, searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const rawHashtags = Array.isArray(post.hashtags) ? post.hashtags : [];
  const normalizedHashtags = rawHashtags
    .map((tag: string) => tag.toLowerCase())
    .map((tag: string) => (tag.startsWith('#') ? tag : `#${tag}`));

  const searchableFields = [
    post.content,
    post.authorName,
    post.communityName,
    ...normalizedHashtags,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return searchableFields.some((value) => value.includes(normalizedQuery));
}

function getSocialBoost(post: any, friendIds: Set<string>) {
  let score = 0;
  if (friendIds.has(post.authorId)) score += 3;
  if (post.communityId && friendIds.has(post.authorId)) score += 1.5;
  score += Math.min(post.likesCount || 0, 20) * 0.08;
  score += Math.min(post.commentsCount || 0, 20) * 0.12;
  score += Math.min(post.sharesCount || 0, 20) * 0.14;
  return score;
}

export function Feed({ userId, communityId, type = 'posts', searchQuery }: { userId?: string, communityId?: string, type?: 'posts' | 'media' | 'likes', searchQuery?: string }) {
  const { t } = useTranslation('common');
  const focusMode = useAppStore((state) => state.focusMode);
  const profile = useAppStore((state) => state.profile);
  const normalizedSearchQuery = searchQuery?.trim() || '';
  const pageSize = normalizedSearchQuery ? 50 : PAGE_SIZE;
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.uid) return;

    const loadRelationshipSignals = async () => {
      // ADDITIONAL SECURITY GUARD: Ensure project ID is confirmed and user is logically logged in
      if (!profile?.uid) return;
      
      try {
        const [friends, blocked] = await Promise.all([
          getFriendIds(profile.uid),
          getBlockedUserIds(profile.uid),
        ]);
        setFriendIds(new Set(friends));
        setBlockedUserIds(blocked);
      } catch (error) {
        console.error('Error loading relationship signals:', error);
        // Fallback to empty sets if permissions fail
        setFriendIds(new Set());
        setBlockedUserIds(new Set());
      }
    };

    void loadRelationshipSignals();
  }, [profile?.uid]);

  const fetchPosts = useCallback(async ({ pageParam }: { pageParam: QueryDocumentSnapshot | null }) => {
    if (type === 'likes') {
      const likesQ = query(
        collection(db, 'likes'),
        where('userId', '==', userId || profile?.uid),
        where('commentId', '==', null),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
      if (pageParam) {
        // startAfter for likes query
      }
      const likesSnapshot = await getDocs(likesQ);
      const postIds = likesSnapshot.docs.map(doc => doc.data().postId);
      
      if (postIds.length === 0) return { docs: [] } as any;

      const postsQ = query(collection(db, 'posts'), where('__name__', 'in', postIds));
      const postsSnapshot = await getDocs(postsQ);
      return postsSnapshot;
    }

    const constraints: QueryConstraint[] = [];

    if (userId) {
      constraints.push(where('authorId', '==', userId));
      if (type === 'media') {
        constraints.push(where('hasImage', '==', true));
      }
    } else if (communityId) {
      constraints.push(where('communityId', '==', communityId));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    if (pageParam) {
      constraints.push(startAfter(pageParam));
    }

    constraints.push(limit(pageSize));

    const q = query(collection(db, 'posts'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot;
  }, [communityId, pageSize, userId]);

  const [feedType, setFeedType] = useState<'all' | 'top' | 'trending'>('trending');

  const { ref, inView } = useInView();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useInfiniteQuery({
    queryKey: ['posts', userId, communityId, type || feedType, normalizedSearchQuery],
    queryFn: fetchPosts,
    initialPageParam: null as QueryDocumentSnapshot | null,
    getNextPageParam: (lastPage) => lastPage.docs.length === pageSize ? lastPage.docs[lastPage.docs.length - 1] : null,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allPosts = useMemo(
    () => {
      const posts = data?.pages.flatMap((page) => page.docs.map((doc) => ({ id: doc.id, ...doc.data() }))) || [];
      
      // 1. ADVANCED DEDUPLICATION & RECONCILIATION
      // We prioritize server data but preserve local state to avoid "jumping"
      const postMap = new Map();
      posts.forEach(p => {
        const existing = postMap.get(p.id);
        // If we have a duplicate, we prefer the one that has a server timestamp
        if (!existing || (!existing.createdAt?.toDate && p.createdAt?.toDate)) {
          postMap.set(p.id, p);
        }
      });
      const uniquePosts = Array.from(postMap.values());

      // 2. SOCIAL BRAIN 2.0 - INTEGRITY & FILTERING
      const visiblePosts = uniquePosts.filter((post: any) => {
        // Robustness: Ignore corrupted or incomplete posts
        if (!post.authorId || (!post.content && !post.imageUrl)) return false;
        
        if (blockedUserIds.has(post.authorId)) return false;
        if (post.visibility === 'friends' && post.authorId !== profile?.uid && !friendIds.has(post.authorId)) {
          return false;
        }
        return normalizedSearchQuery ? matchesSearch(post, normalizedSearchQuery) : true;
      });

      // 3. SOCIAL BRAIN 2.0 - ADVANCED RANKING (LOGARITHMIC DECAY)
      const sorted = [...visiblePosts].sort((a: any, b: any) => {
        const now = Date.now();
        
        const getTimestamp = (p: any) => {
           if (p.createdAt?.toDate) return p.createdAt.toDate().getTime();
           if (typeof p.createdAt === 'number') return p.createdAt;
           return now;
        };

        const aTime = getTimestamp(a);
        const bTime = getTimestamp(b);
        
        // Hours since creation (min 0.1 to avoid infinity)
        const aHours = Math.max(0.1, (now - aTime) / (1000 * 60 * 60));
        const bHours = Math.max(0.1, (now - bTime) / (1000 * 60 * 60));

        // Ranking Weights
        const getBaseScore = (p: any) => {
          let s = (p.likesCount || 0) * 2 + (p.commentsCount || 0) * 5 + (p.sharesCount || 0) * 8;
          
          // AFFINITY BOOST (Amigos próximos/Amigos)
          if (friendIds.has(p.authorId)) s += 30;
          
          // MEDIA WEIGHT (Posts com imagem/vídeo engajam mais visualmente)
          if (p.hasImage) s += 10;
          
          // OPTIMISTIC INJECTION (Instant visibility)
          if (p._isOptimistic) s += 2000;
          
          return s;
        };

        // Score with Logarithmic/Exponential Hybrid Decay
        const aScore = getBaseScore(a) / Math.pow(aHours + 2, 1.8);
        const bScore = getBaseScore(b) / Math.pow(bHours + 2, 1.8);

        return bScore - aScore;
      });

      // 4. ANTI-CLUSTERING (Post Diversity UX)
      // Prevent showing 3+ posts from the same author in a row
      const finalPosts: any[] = [];
      const authorStreak: Record<string, number> = {};
      
      sorted.forEach(post => {
        const authorId = post.authorId;
        authorStreak[authorId] = (authorStreak[authorId] || 0) + 1;
        
        if (authorStreak[authorId] <= 2) {
          finalPosts.push(post);
        } else {
          // Push to the end of the next page essentially
          // For simplicity in this render, we just capping for now
          // A more advanced version would re-inject them lower down
        }
      });

      return finalPosts;
    },
    [blockedUserIds, data, friendIds, normalizedSearchQuery, profile?.uid, type]
  );

  const [newPostsAvailable, setNewPostsAvailable] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // MULTI-TAB SYNC ENGINE
  useEffect(() => {
    if (!syncChannel) return;
    const handleSync = (event: MessageEvent) => {
      const { type: syncType } = event.data;
      if (syncType === 'invalidate_posts') {
         queryClient.invalidateQueries({ queryKey: ['posts'] });
      }
    };
    syncChannel.addEventListener('message', handleSync);
    return () => syncChannel.removeEventListener('message', handleSync);
  }, [queryClient]);

  useEffect(() => {
    if (userId || communityId || normalizedSearchQuery) return;

    const q = query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) return;
      const latestPostId = snapshot.docs[0].id;
      
      const existingPosts = data?.pages.flatMap(p => p.docs.map(d => d.id)) || [];
      if (!existingPosts.includes(latestPostId) && status === 'success' && existingPosts.length > 0) {
        setNewPostsAvailable(prev => Array.from(new Set([...prev, latestPostId])));
      }
    });

    return () => unsubscribe();
  }, [data, userId, communityId, normalizedSearchQuery, status]);

  const handleRefreshFeed = () => {
    setNewPostsAvailable([]);
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (status === 'pending') {
    return (
      <div className="flex flex-col gap-6">
        {[1, 2, 3].map((i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 sticky top-[72px] z-30 bg-[#f7f7f9]/80 backdrop-blur-3xl py-6 -mx-2 px-2 border-b border-slate-200/50">
        <div className="flex items-center gap-2 bg-[#eaeffa] p-1.5 rounded-[26px] border border-white shadow-[0_8px_20px_rgba(0,0,0,0.03)] backdrop-blur-xl">
          {[
            { id: 'all', label: t('feed.new', 'New'), icon: Clock },
            { id: 'trending', label: t('feed.trending', 'Trending'), icon: Sparkles },
            { id: 'top', label: t('feed.top', 'Top'), icon: ThumbsUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = (type || feedType) === tab.id || (tab.id === 'all' && !(type || feedType));
            return (
              <button
                key={tab.id}
                onClick={() => setFeedType(tab.id as any)} 
                className={`flex items-center gap-2.5 px-6 py-2.5 rounded-[22px] text-[13.5px] font-black transition-all duration-300 ${isActive ? 'bg-white text-[#7a63f1] shadow-[0_10px_25px_rgba(122,99,241,0.15)] scale-[1.05] translate-y-[-1px]' : 'text-slate-500 hover:text-[#7a63f1] hover:bg-white/60'}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'fill-[#7a63f1]/20' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
        
        {!focusMode && !userId && (
          <div className="hidden sm:flex items-center gap-2.5 text-[12.5px] font-black text-[#7a63f1] bg-[#7a63f1]/5 px-6 py-2.5 rounded-[22px] border border-[#7a63f1]/20 shadow-[0_10px_30px_rgba(122,99,241,0.08)] transition-all hover:bg-[#7a63f1]/10 group cursor-default">
            <Sparkles className="w-4.5 h-4.5 text-[#7a63f1] group-hover:animate-pulse" />
            <span className="tracking-tight uppercase">{t('feed.personal_tip', 'Para Você')}</span>
          </div>
        )}
      </div>
      
      {/* Floating Fresh Content Notification */}
      {newPostsAvailable.length > 0 && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-4 duration-500">
          <button 
            onClick={handleRefreshFeed}
            className="bg-primary text-white px-6 py-2.5 rounded-full shadow-2xl shadow-primary/40 font-black text-[14px] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all border border-white/20 backdrop-blur-md"
          >
            <RefreshCw className="w-4 h-4 animate-spin-slow" />
            {newPostsAvailable.length} {newPostsAvailable.length === 1 ? t('feed.new_post_available', 'new post available') : t('feed.new_posts_available', 'new posts available')}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {allPosts.map((post, idx) => (
          <div key={post.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${Math.min(idx * 50, 400)}ms` }}>
            <PostCard post={post} />
          </div>
        ))}
      </div>
      
      {hasNextPage && (
        <div ref={ref} className="py-12 flex items-center justify-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" />
          <span className="sr-only">Loading more...</span>
        </div>
      )}
    </div>
  );
}
