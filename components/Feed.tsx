'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter, 
  QueryConstraint, 
  QueryDocumentSnapshot, 
  where, 
  onSnapshot, 
  getDoc,
  doc
} from 'firebase/firestore';
import { db } from '@/firebase';
import { PostCard } from './PostCard';
import { useAppStore } from '@/lib/store';
import { 
  TrendingUp, 
  Clock, 
  ThumbsUp, 
  RefreshCw, 
  Sparkles, 
  Users, 
  Zap,
  ChevronUp,
  BookOpen
} from 'lucide-react';
import { PostSkeleton } from './PostSkeleton';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getBlockedUserIds, getFriendIds } from '@/lib/friendships';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  calculateRelevanceScore, 
  calculateMomentum, 
  FeedMode, 
  UserPreferences 
} from '@/lib/aura-brain';
import { motion, AnimatePresence } from 'motion/react';

const syncChannel = typeof window !== 'undefined' ? new BroadcastChannel('aura_feed_sync') : null;
const PAGE_SIZE = 15;
const FRESH_PRIORITY_MS = 30 * 60 * 1000; // newest posts win in ranking for ~30 minutes

function getPostTimeMs(post: any) {
  const createdAt = post?.createdAt;
  if (!createdAt) return 0;
  if (typeof createdAt === 'number') return createdAt;
  if (typeof createdAt?.toMillis === 'function') return createdAt.toMillis();
  if (typeof createdAt?.seconds === 'number') return createdAt.seconds * 1000;
  if (typeof createdAt === 'string') {
    const parsed = Date.parse(createdAt);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function Feed({ 
  userId, 
  communityId, 
  type = 'posts', 
  searchQuery,
  pinnedPostIds,
  containerClassName
}: { 
  userId?: string, 
  communityId?: string, 
  type?: 'posts' | 'media' | 'likes', 
  searchQuery?: string,
  pinnedPostIds?: string[],
  containerClassName?: string
}) {
  const { t } = useTranslation('common');
  const focusMode = useAppStore((state) => state.focusMode);
  const profile = useAppStore((state) => state.profile);
  const normalizedSearchQuery = searchQuery?.trim() || '';
  const pageSize = normalizedSearchQuery ? 50 : PAGE_SIZE;

  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [feedMode, setFeedMode] = useState<FeedMode>('for_you');
  const [newPostsAvailable, setNewPostsAvailable] = useState<string[]>([]);
  
  const parentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // 🏆 PRIORITY 6: Explicitly fetch pinned posts to ensure they appear regardless of their creation date
  const { data: pinnedPostsData } = useQuery({
    queryKey: ['pinned_posts', pinnedPostIds],
    queryFn: async () => {
      if (!pinnedPostIds || pinnedPostIds.length === 0) return [];
      // Firestore 'in' query or individual gets depending on size
      const snapshots = await Promise.all(
        pinnedPostIds.map(id => getDoc(doc(db, 'posts', id)))
      );
      return snapshots.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() }));
    },
    enabled: !!pinnedPostIds && pinnedPostIds.length > 0,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  // Load social signals for ranking
  useEffect(() => {
    if (!profile?.uid) return;
    const loadSignals = async () => {
      try {
        const [friends, blocked] = await Promise.all([
          getFriendIds(profile.uid),
          getBlockedUserIds(profile.uid),
        ]);
        setFriendIds(new Set(friends));
        setBlockedUserIds(blocked);
      } catch (e) {
        console.warn('Relationship signal fetch failed:', e);
      }
    };
    loadSignals();
  }, [profile?.uid]);

  const fetchPosts = useCallback(async ({ pageParam }: { pageParam: QueryDocumentSnapshot | null }) => {
    // Special case for 'likes' tab
    if (type === 'likes') {
      const likesQ = query(
        collection(db, 'likes'),
        where('userId', '==', userId || profile?.uid),
        where('commentId', '==', null),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
      const likesSnapshot = await getDocs(likesQ);
      const postIds = likesSnapshot.docs.map((d) => d.data().postId).filter(Boolean);
      if (postIds.length === 0) return { docs: [] } as any;

      // Firestore "in" queries have a small limit. Chunk and preserve ordering by likes recency.
      const chunks: string[][] = [];
      for (let i = 0; i < postIds.length; i += 10) chunks.push(postIds.slice(i, i + 10));

      const snapshots = await Promise.all(
        chunks.map((ids) => getDocs(query(collection(db, 'posts'), where('__name__', 'in', ids))))
      );

      const byId = new Map<string, any>();
      snapshots.forEach((snap) => snap.docs.forEach((d: any) => byId.set(d.id, d)));
      const orderedDocs = postIds.map((id) => byId.get(id)).filter(Boolean);

      return { docs: orderedDocs } as any;
    }

    const constraints: QueryConstraint[] = [];
    if (userId) {
      constraints.push(where('authorId', '==', userId));
      // Don't constrain media on the server (would exclude videos). We'll filter client-side.
    } else if (communityId) {
      constraints.push(where('communityId', '==', communityId));
    }
    
    // Default discovery constraints
    constraints.push(orderBy('createdAt', 'desc'));
    if (pageParam) constraints.push(startAfter(pageParam));
    constraints.push(limit(pageSize));

    const q = query(collection(db, 'posts'), ...constraints);
    return await getDocs(q);
  }, [communityId, pageSize, userId, type, profile?.uid]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useInfiniteQuery({
    queryKey: ['posts', userId, communityId, type, feedMode, normalizedSearchQuery],
    queryFn: fetchPosts,
    initialPageParam: null as QueryDocumentSnapshot | null,
    getNextPageParam: (lastPage) => lastPage.docs.length === pageSize ? lastPage.docs[lastPage.docs.length - 1] : null,
    staleTime: 5 * 60 * 1000,
  });

  const allPosts = useMemo(() => {
    const raw = data?.pages.flatMap(page => page.docs.map((d: any) => ({ id: d.id, ...d.data() }))) || [];
    
    // 🔗 MERGE & DEDUPLICATE: Ensure pinned posts are present even if not in first page results
    const combined = [...(pinnedPostsData || []), ...raw];
    const uniqueMap = new Map();
    combined.forEach(p => uniqueMap.set(p.id, p));
    
    const userPrefs: UserPreferences = {
      friendIds,
      interests: (profile as any)?.interests || [],
      blockedUserIds,
      uid: profile?.uid
    };
    const now = Date.now();

    const filtered = Array.from(uniqueMap.values())
      .filter((post: any) => !String(post?.id || '').startsWith('optimistic_'))
      .filter((post: any) => {
        if (!post.authorId) return false;
        const hasAnyContent = post.content || post.imageUrl || post.videoUrl || 
                              post.audioUrl || post.gifUrl || post.hasPoll || 
                              post.hasEvent || post.poll || post.event || post.mediaUrls?.length;
        if (!hasAnyContent) return false;
        if (blockedUserIds.has(post.authorId)) return false;
        if (post.visibility === 'friends' && post.authorId !== profile?.uid && !friendIds.has(post.authorId) && !post.communityId) return false;
        // Community approvals: hide pending/rejected items from the main feed.
        if (post.communityId) {
          const approval = (post.approvalStatus || 'approved') as string;
          if (approval !== 'approved') return false;
        }
        if (type === 'media' && !(post.imageUrl || post.videoUrl || post.hasImage || post.hasVideo)) return false;
        return true;
      });

    // 🏆 PARTITION: Divide into Pinned (Top) and Normal (Stream)
    const pinnedIdsSet = new Set(pinnedPostIds || []);
    const pinned = filtered.filter(p => pinnedIdsSet.has(p.id))
      .sort((a, b) => (pinnedPostIds?.indexOf(a.id) || 0) - (pinnedPostIds?.indexOf(b.id) || 0));
    const normal = filtered.filter(p => !pinnedIdsSet.has(p.id));

    const sortFn = (posts: any[]) => {
      return [...posts].sort((a: any, b: any) => {
        const aTime = getPostTimeMs(a);
        const bTime = getPostTimeMs(b);
        const aFresh = aTime > 0 && (now - aTime) <= FRESH_PRIORITY_MS;
        const bFresh = bTime > 0 && (now - bTime) <= FRESH_PRIORITY_MS;
        if (aFresh !== bFresh) return bFresh ? 1 : -1;
        if (aFresh && bFresh && aTime !== bTime) return bTime - aTime;

        if (feedMode === 'recent') return bTime - aTime;
        if (feedMode === 'top') return (b.likesCount || 0) - (a.likesCount || 0);
        if (feedMode === 'trending') return calculateMomentum(b, now) - calculateMomentum(a, now);
        if (feedMode === 'deep') {
           const aDepth = (a.content?.length || 0) + (a.commentsCount * 50);
           const bDepth = (b.content?.length || 0) + (b.commentsCount * 50);
           return bDepth - aDepth;
        }
        return calculateRelevanceScore(b, userPrefs, now) - calculateRelevanceScore(a, userPrefs, now);
      });
    };

    return [...pinned, ...sortFn(normal)];
  }, [data, pinnedPostsData, pinnedPostIds, friendIds, blockedUserIds, profile, feedMode, type]);

  // Virtualization for extreme performance
  const rowVirtualizer = useVirtualizer({
    count: allPosts.length,
    getScrollElement: () => typeof document !== 'undefined' ? document.documentElement : null,
    estimateSize: () => 600,
    overscan: 5,
  });

  const { ref: loadMoreRef, inView } = useInView({ threshold: 0.1 });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Real-time Incremental Update Engine
  useEffect(() => {
    if (normalizedSearchQuery) return;
    
    // Determine the relevant filter for the real-time listener
    const constraints: any[] = [orderBy('createdAt', 'desc'), limit(1)];
    
    if (communityId) {
      constraints.push(where('communityId', '==', communityId));
    } else if (userId) {
      constraints.push(where('authorId', '==', userId));
    } else if (feedMode === 'recent') {
      constraints.push(where('visibility', '==', 'public'));
    } else {
      // For ranking modes like for_you/trending, we don't show the real-time banner 
      // as the order is complex and non-chronological.
      return;
    }

    const q = query(collection(db, 'posts'), ...constraints);
    
    return onSnapshot(q, (snap) => {
      if (snap.empty) return;
      const latestDoc = snap.docs[0];
      const latestData: any = latestDoc.data ? latestDoc.data() : null;

      // Avoid surfacing "new posts" banners for community posts that are still pending approval.
      if (latestData?.communityId) {
        const approval = (latestData?.approvalStatus || 'approved') as string;
        if (approval !== 'approved') return;
      }

      const latestId = latestDoc.id;
      const exists = allPosts.some(p => p.id === latestId);
      
      if (!exists && status === 'success' && allPosts.length > 0) {
        setNewPostsAvailable(prev => Array.from(new Set([...prev, latestId])));
      }
    }, (error) => {
      console.warn('Feed: Real-time sync interrupted:', error);
    });
  }, [allPosts, userId, communityId, normalizedSearchQuery, feedMode, status]);

  const refreshFeed = () => {
    setNewPostsAvailable([]);
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [showFeedDropdown, setShowFeedDropdown] = useState(false);

  if (status === 'pending') {
    return <div className="flex flex-col gap-6"><PostSkeleton /><PostSkeleton /></div>;
  }

  const TABS = [
    { id: 'for_you', label: 'Para você', icon: Sparkles },
    { id: 'trending', label: 'Bombando', icon: Zap },
    { id: 'recent', label: 'Recentes', icon: Clock },
    { id: 'social', label: 'Círculo', icon: Users },
    { id: 'deep', label: 'Foco total', icon: BookOpen },
  ];
  const activeTab = TABS.find((t) => t.id === feedMode) || TABS[0];

  return (
    <div className={containerClassName || "w-full max-w-3xl mx-auto px-1 sm:px-0"}>
      {/* Compact Feed Mode Selector */}
      <div className="flex justify-end mb-3 relative">
        <button
          onClick={() => setShowFeedDropdown((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-100 shadow-sm text-[11px] font-bold text-slate-500 hover:text-primary hover:border-primary/20 transition-all duration-200"
        >
          <activeTab.icon className="w-3 h-3 text-primary" />
          <span>{activeTab.label}</span>
          <ChevronUp className={`w-3 h-3 transition-transform duration-200 ${showFeedDropdown ? '' : 'rotate-180'}`} />
        </button>
        <AnimatePresence>
          {showFeedDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFeedDropdown(false)} />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-1.5 z-50 bg-white rounded-2xl shadow-xl border border-slate-100/80 overflow-hidden py-1 w-40"
              >
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = feedMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setFeedMode(tab.id as any); setShowFeedDropdown(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-bold transition-colors ${active ? 'bg-primary/5 text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                    </button>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Real-time Injection Banner */}
      <AnimatePresence>
        {newPostsAvailable.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-28 left-1/2 -translate-x-1/2 z-[60]"
          >
            <button 
              onClick={refreshFeed}
              className="px-6 py-3 bg-primary text-white rounded-full shadow-2xl shadow-primary/40 font-black text-[13px] flex items-center gap-3 border border-white/20 backdrop-blur-md hover:scale-105 active:scale-95 transition-all group"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />
                <span className="text-xs font-bold text-white">
                  {newPostsAvailable.length} {newPostsAvailable.length === 1 ? 'nova ideia' : 'novas ideias'}
                </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Stream (Virtualized) */}
      <div 
        style={{ 
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const post = allPosts[virtualRow.index];
          return (
            <div
              key={post.id}
              data-index={virtualRow.index}
              ref={(el) => {
                if (el) rowVirtualizer.measureElement(el);
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: '24px'
              }}
            >
              <PostCard post={post} isPinned={pinnedPostIds?.includes(post.id)} />
            </div>
          );
        })}
      </div>

      {/* Infinite Loading Indicator */}
      <div ref={loadMoreRef} className="py-20 flex flex-col items-center gap-4 text-slate-400">
        {!hasNextPage && allPosts.length > 0 ? (
          <div className="flex flex-col items-center gap-2">
            <Sparkles className="w-6 h-6 opacity-20" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Você encontrou o que procurava.</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-primary/30 animate-bounce" />
            <div className="w-2 h-2 rounded-full bg-primary/30 animate-bounce delay-75" />
            <div className="w-2 h-2 rounded-full bg-primary/30 animate-bounce delay-150" />
          </div>
        )}
      </div>
    </div>
  );
}
