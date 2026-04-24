'use client';

import { useState, useEffect, memo, useMemo, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, Share2, MoreHorizontal, Globe, Users, Lock, Bookmark, Trash2, ThumbsUp, CheckCircle, BadgeCheck, BarChart2, ShieldAlert, Repeat2, Send, Link2, CheckCheck, Clock, Sparkles, Flame, Zap, Pin, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { db } from '@/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc, increment, addDoc, serverTimestamp, orderBy, getDocs, getDoc, limit, startAfter, runTransaction, arrayUnion } from 'firebase/firestore';
import { TimeAgo } from './TimeAgo';
import { SharePostModal } from './SharePostModal';
import { ConfirmModal } from './ConfirmModal';
import Link from 'next/link';
import { getPostVibe, calculateMomentum } from '@/lib/aura-brain';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { createNotification } from '@/lib/notifications';
import { soundEffects } from '@/lib/sound-effects';
import { renderTextWithLinks } from '@/lib/mentions';
import { MentionSuggestions } from './MentionSuggestions';
import { validateContent } from '@/lib/moderation/utils';
import { isAdmin } from '@/lib/admin';

const SHOW_MODERATION_INTEL = process.env.NEXT_PUBLIC_SHOW_MODERATION_INTEL === 'true';

const Lightbox = dynamic(() => import('./Lightbox').then((mod) => mod.Lightbox), {
  ssr: false,
});

function normalizeHashtag(tag: string) {
  return tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
}

function stripRenderedHashtags(content: string, hashtags: string[] = []) {
  if (!content) return '';
  let nextContent = content;

  hashtags.forEach((tag) => {
    const normalizedTag = normalizeHashtag(tag).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hashtagRegex = new RegExp(`(^|\\s)${normalizedTag}(?=\\s|$)`, 'giu');
    nextContent = nextContent.replace(hashtagRegex, ' ');
  });

  return nextContent
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const REACTIONS = [
  { id: 'like', icon: '👍', label: 'Curtir', weight: 1, pulse: 'Recebendo apoio', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'love', icon: '❤️', label: 'Amei', weight: 3, pulse: 'As pessoas amaram isso', color: 'text-red-500', bgColor: 'bg-red-500/10' },
  { id: 'funny', icon: '😂', label: 'Haha', weight: 2, pulse: 'Está divertindo muita gente', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  { id: 'wow', icon: '😮', label: 'Uau', weight: 2, pulse: 'Chamando atenção', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'sad', icon: '😢', label: 'Triste', weight: 2, pulse: 'Gerando empatia', color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
  { id: 'angry', icon: '😡', label: 'Grrr', weight: 1, pulse: 'Gerando debate', color: 'text-red-700', bgColor: 'bg-red-700/10' },
  { id: 'fire', icon: '🔥', label: 'Fogo', weight: 5, pulse: 'Em alta agora', color: 'text-orange-600', bgColor: 'bg-orange-600/10' },
];

const MOODS = [
  { id: 'excited', emoji: '🔥', label: 'Empolgado' },
  { id: 'happy', emoji: '😄', label: 'Feliz' },
  { id: 'thoughtful', emoji: '💭', label: 'Reflexivo' },
  { id: 'motivated', emoji: '💪', label: 'Motivado' },
  { id: 'curious', emoji: '🤔', label: 'Curioso' },
  { id: 'grateful', emoji: '🙏', label: 'Grato' },
  { id: 'creative', emoji: '✨', label: 'Criativo' },
  { id: 'inspired', emoji: '🌟', label: 'Inspirado' },
  { id: 'sad', emoji: '😢', label: 'Triste' },
  { id: 'tired', emoji: '😴', label: 'Cansado' },
  { id: 'focused', emoji: '🎯', label: 'Focado' },
  { id: 'chill', emoji: '🌊', label: 'Zen' }
];

export const PostCard = memo(function PostCard({ post: initialPost, isPinned }: { post: any, isPinned?: boolean }) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useAppStore((state) => state.profile);
  const user = useAppStore((state) => state.user);
  const authUid = user?.uid || null;
  const [localPost, setLocalPost] = useState(initialPost);
  const post = localPost;

  // 🛡️ SANITY CHECK: Prevent NaN in UI by ensuring counts are always numbers
  const parseCount = (val: any) => {
    const n = Number(val);
    return isNaN(n) ? 0 : Math.max(0, n);
  };
  const likesCount = parseCount(post.likesCount);
  const commentsCount = parseCount(post.commentsCount);
  const sharesCount = parseCount(post.sharesCount);

  // Sync with prop updates
  useEffect(() => {
    setLocalPost(initialPost);
  }, [initialPost]);

  const normalizedHashtags = useMemo(() => {
    if (!Array.isArray(post?.hashtags)) return [] as string[];
    const normalized = post.hashtags.map((t: any) => normalizeHashtag(String(t || '')));
    return Array.from(new Set(normalized)).filter((t): t is string => Boolean(t));
  }, [post?.hashtags]);
  const isOptimisticPost = useMemo(() => {
    // Only treat ids prefixed with "optimistic_" as non-existent documents.
    // Posts created with a pre-generated Firestore id can be interacted with immediately.
    return String(post?.id || '').startsWith('optimistic_');
  }, [post?.id]);
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [commentReactions, setCommentReactions] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [mentionSearch, setMentionSearch] = useState<{ text: string, index: number } | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{id: string, name: string} | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success'>('idle');
  const [volatileBoost, setVolatileBoost] = useState(0);
  const [threadParticipants, setThreadParticipants] = useState<string[]>([]);
  
  // Modals state
  const [isDeletePostModalOpen, setIsDeletePostModalOpen] = useState(false);
  const [isDeleteCommentModalOpen, setIsDeleteCommentModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<{id: string, postId: string} | null>(null);
  const [likers, setLikers] = useState<any[]>([]);
  const [isPinnedLocally, setIsPinnedLocally] = useState(false);

  // Decaying boost over time (cool-down effect)
  useEffect(() => {
    if (volatileBoost > 0) {
      const timer = setTimeout(() => setVolatileBoost(prev => Math.max(0, prev - 1)), 100);
      return () => clearTimeout(timer);
    }
  }, [volatileBoost]);

  useEffect(() => {
    setLocalPost(initialPost);
  }, [initialPost]);

  // Keep post stats in sync without needing a full page refresh.
  // This ensures likesCount/reactionCounts update in real time after any reaction.
  useEffect(() => {
    if (!post?.id || isOptimisticPost) return;

    const postRef = doc(db, 'posts', post.id);
    const unsubscribe = onSnapshot(
      postRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setLocalPost((current: any) => ({
          ...current,
          ...data,
          id: snap.id,
        }));

        // Also update any cached feeds that contain this post so other components stay consistent.
        queryClient.setQueriesData(
          { predicate: (q) => Array.isArray((q as any)?.queryKey) && (q as any).queryKey[0] === 'posts' },
          (old: any) => {
            if (!old || !Array.isArray(old.pages)) return old;
            return {
              ...old,
              pages: old.pages.map((page: any) => {
                const docs = page?.docs;
                if (!Array.isArray(docs)) return page;
                return {
                  ...page,
                  docs: docs.map((d: any) => {
                    if (d?.id !== snap.id) return d;
                    return { id: snap.id, data: () => ({ ...(typeof d?.data === 'function' ? d.data() : {}), ...data, id: snap.id }) };
                  }),
                };
              }),
            };
          }
        );
      },
      (error) => {
        console.warn('Post snapshot sync failed:', error);
      }
    );

    return () => unsubscribe();
  }, [post?.id, isOptimisticPost, queryClient]);

  const date = post.createdAt?.toDate ? post.createdAt.toDate() : new Date();
  
  const postVibe = useMemo(() => {
    return getPostVibe(post, Date.now());
  }, [post]);

  const momentum = useMemo(() => {
    return calculateMomentum(post, Date.now(), volatileBoost);
  }, [post, volatileBoost]);

  useEffect(() => {
    if (!authUid || !post.id || isOptimisticPost) {
      setUserReaction(null);
      setCommentReactions({});
      return;
    }

    const q = query(
      collection(db, 'likes'),
      where('postId', '==', post.id),
      where('userId', '==', authUid)
    );

    const loadReactions = async () => {
      const snapshot = await getDocs(q);
      let pReaction = null;
      const cReactions: Record<string, string> = {};

      snapshot.docs.forEach((likeDoc) => {
        const data = likeDoc.data();
        if (data.commentId) {
          cReactions[data.commentId] = data.type;
        } else {
          pReaction = data.type;
        }
      });

      setUserReaction(pReaction);
      setCommentReactions(cReactions);
    };

    void loadReactions();
  }, [authUid, post.id]);

  // Listen for comments when section is open
  useEffect(() => {
    if (!showComments || !post.id || isOptimisticPost) return;

    const q = query(
      collection(db, 'comments'),
      where('postId', '==', post.id),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComments(commentsData);
    }, (error) => {
      console.warn('PostCard: Comments listener error:', error);
    });

    return () => unsubscribe();
  }, [showComments, post.id]);

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showBookmarkFeedback, setShowBookmarkFeedback] = useState(false);

  useEffect(() => {
    if (!authUid || !post.id || isOptimisticPost) {
      setIsBookmarked(false);
      return;
    }

    const q = query(
      collection(db, 'bookmarks'),
      where('postId', '==', post.id),
      where('userId', '==', authUid)
    );

    const loadBookmark = async () => {
      const snapshot = await getDocs(q);
      setIsBookmarked(!snapshot.empty);
    };

    void loadBookmark();
  }, [authUid, post.id]);

  useEffect(() => {
    if (!post.communityId || !authUid) return;
    const communityRef = doc(db, 'communities', post.communityId);
    const unsub = onSnapshot(communityRef, (snap) => {
      if (snap.exists()) {
        const pinned = snap.data().pinnedPostIds || [];
        setIsPinnedLocally(pinned.includes(post.id));
      }
    }, (error) => {
      console.warn('PostCard: Community listener error:', error);
    });
    return () => unsub();
  }, [post.communityId, post.id, authUid]);

  // Sync likers list in real-time
  useEffect(() => {
    if (!post.id || isOptimisticPost) return;

    const q = query(
      collection(db, 'likes'),
      where('postId', '==', post.id),
      where('commentId', '==', null),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const likersData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .sort((a: any, b: any) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tB - tA;
        })
        .filter((liker: any) => liker.userId !== authUid);
      
      setLikers(likersData);
    }, (error) => {
      if (error.code === 'failed-precondition') {
        console.warn('Index building for likers, showing partial data...');
      } else {
        console.error('Likers sync failed:', error);
      }
    });

    return () => unsubscribe();
  }, [post.id, authUid, isOptimisticPost]);

  const handleBookmark = async () => {
    if (!authUid || !post.id || isOptimisticPost) return;

    const bookmarkRef = doc(db, 'bookmarks', `${post.id}_${authUid}`);

    try {
      if (isBookmarked) {
        await deleteDoc(bookmarkRef);
        setIsBookmarked(false);
      } else {
        await setDoc(bookmarkRef, {
          postId: post.id,
          userId: authUid,
          createdAt: serverTimestamp(),
          // Store a copy of the post data for easier listing in bookmarks page
          postData: {
            content: post.content,
            imageUrl: post.imageUrl || null,
            authorName: post.authorName,
            authorPhoto: post.authorPhoto || '',
            authorId: post.authorId,
            createdAt: post.createdAt
          }
        });
        setIsBookmarked(true);
        // ✅ Feature 12: visual +1 feedback
        setShowBookmarkFeedback(true);
        setTimeout(() => setShowBookmarkFeedback(false), 1500);
      }
    } catch (error: any) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const handleShare = async () => {
    setShowShareMenu((current) => !current);
  };

  const incrementShareCount = async () => {
    if (!post.id || isOptimisticPost) return;

    const postRef = doc(db, 'posts', post.id);
    const updateData: any = {
      sharesCount: increment(1),
      updatedAt: serverTimestamp()
    };
    
    // Healing legacy data
    if (!post.visibility) updateData.visibility = 'public';
    if (post.likesCount === undefined) updateData.likesCount = 0;
    if (!post.authorName) updateData.authorName = 'Anonymous';

    try {
      await updateDoc(postRef, updateData);
      setLocalPost((current: any) => ({
        ...current,
        sharesCount: (current.sharesCount || 0) + 1,
      }));
    } catch (err) {
      console.error('Error incrementing share count:', err);
    }
  };

  const handleExternalShare = async () => {
    if (!post.id) return;
    setIsSharing(true);
    try {
      const shareUrl = `${window.location.origin}/post/${post.id}`;
      const shareText = post.content?.trim() || t('post_card.check_out', 'Check out this post on Aura.');

      if (navigator.share) {
        await navigator.share({
          title: `${post.authorName} on Aura`,
          text: shareText,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }

      await incrementShareCount();
      setShowShareMenu(false);
      setCopyStatus('success');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Error sharing post:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!post.id) return;
    setIsSharing(true);
    try {
      const shareUrl = `${window.location.origin}/post/${post.id}`;
      await navigator.clipboard.writeText(shareUrl);
      await incrementShareCount();
      setShowShareMenu(false);
      setCopyStatus('success');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Error copying post link:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRepost = () => {
    if (!authUid || !post.id) return;
    if (isOptimisticPost) return;
    
    setIsShareModalOpen(true);
    setShowShareMenu(false);
  };

  const confirmRepost = async (repostCaption: string) => {
    if (!authUid || !post.id) return;

    setIsSharing(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: authUid,
        authorName: profile?.displayName || user?.displayName || 'Anonymous',
        authorPhoto: profile?.photoURL || user?.photoURL || '',
        authorUsername: profile?.username || '',
        content: repostCaption.trim() || t('post_card.shared_a_post', 'Shared a post'),
        hashtags: [],
        imageUrl: null,
        imageDisplayUrl: null,
        imageDeleteUrl: null,
        imageWidth: null,
        imageHeight: null,
        imageMime: null,
        imageSize: null,
        hasImage: false,
        visibility: 'public',
        communityId: null,
        communityName: null,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        score: 0,
        sharedPostId: post.id,
        sharedPostData: {
          id: post.id,
          authorId: post.authorId,
          authorName: post.authorName,
          authorPhoto: post.authorPhoto || '',
          authorUsername: post.authorUsername || '',
          content: post.content || '',
          imageUrl: post.imageUrl || null,
          hashtags: post.hashtags || [],
          communityId: post.communityId || null,
          communityName: post.communityName || null,
          createdAt: post.createdAt || null,
        },
        createdAt: serverTimestamp(),
      });

      await incrementShareCount();

      if (post.authorId !== authUid) {
        void createNotification({
          userId: post.authorId,
          actorId: authUid,
          actorName: profile?.displayName || user?.displayName || 'User',
          actorPhoto: profile?.photoURL || user?.photoURL || '',
          type: 'share',
          postId: post.id,
        });
      }

      setIsShareModalOpen(false);
      
      // Invalidate queries to show the new share in the feed
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (error) {
      console.error('Error sharing post:', error);
    } finally {
      setIsSharing(false);
    }
  };


  const handleReport = () => {
    if (!authUid || !post.id) return;
    setIsReportModalOpen(true);
  };

  const confirmReport = async () => {
    try {
      await addDoc(collection(db, 'reports'), {
        postId: post.id,
        communityId: post.communityId,
        reportedBy: authUid,
        reason: 'Reported by user',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert(t('post_card.post_reported', 'Post reported successfully.'));
    } catch (error: any) {
      console.error('Error reporting post:', error);
      alert(`${t('post_card.failed_to_report', 'Failed to report:')} ${error.message}`);
    }
  };

  const { ref: viewRef, inView } = useInView({
    threshold: 0,
    rootMargin: '400px 0px', // Pre-render when close to view
    triggerOnce: false
  });

  // CROSS-TAB & OFFLINE SYNC LISTENER
  useEffect(() => {
    const syncChannel = new BroadcastChannel('aura_feed_sync');
    const handleSync = (event: MessageEvent) => {
      const { type, payload } = event.data;
      
      // If someone liked in another tab
      if (type === 'post_interaction' && payload.postId === post.id && payload.userId !== authUid) {
        if (payload.action === 'like') {
           setLocalPost((curr: any) => ({ ...curr, likesCount: payload.count }));
           // Show bubble animation if in view
           if (inView && payload.isNew) {
             setShowHeartOverlay(true);
             setTimeout(() => setShowHeartOverlay(false), 1000);
           }
        }
      }

      // If author updated their profile in another tab or via mass update
      if (type === 'profile_updated' && payload.uid === post.authorId) {
        setLocalPost((curr: any) => ({
          ...curr,
          authorName: payload.displayName,
          authorPhoto: payload.photoURL,
          authorUsername: payload.username
        }));
      }
    };
    syncChannel.addEventListener('message', handleSync);
    return () => {
      syncChannel.removeEventListener('message', handleSync);
      syncChannel.close();
    };
  }, [post.id, authUid, inView]);

  const handlePostReaction = async (type: string) => {
    if (!authUid || !post.id) return;
    
    if (isOptimisticPost) {
      // Intentar una cura rápida: ver se o ID já existe no Firestore
      console.warn('Interacting with optimistic post id; ignoring interaction until synced.');
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      return;
    }

    const postRef = doc(db, 'posts', post.id);
    const likeRef = doc(db, 'likes', `${post.id}_${authUid}`);

    const oldReaction = userReaction;
    const isRemove = oldReaction === type;
    
    if (!isRemove) {
      setVolatileBoost(prev => prev + 50); // Massive energy spike
    }
    
    // 1. BRAIN INTEGRATION: Boost interests if it's a positive/neutral interaction
    if (!isRemove && normalizedHashtags.length > 0) {
      const boostInterest = useAppStore.getState().boostInterest;
      normalizedHashtags.forEach((tag: string) => boostInterest(tag));
    }

    // 2. VISUAL & AUDIO PULSE
    soundEffects.play('reaction');
    setUserReaction(isRemove ? null : type);
    const newCount = Math.max(0, (post.likesCount || 0) + (isRemove ? -1 : (oldReaction ? 0 : 1)));
    
    setLocalPost((current: any) => {
      const nextCounts = { ...(current.reactionCounts || {}) };
      if (oldReaction) nextCounts[oldReaction] = Math.max((nextCounts[oldReaction] || 0) - 1, 0);
      if (!isRemove) nextCounts[type] = (nextCounts[type] || 0) + 1;

      return {
        ...current,
        likesCount: newCount,
        reactionCounts: nextCounts,
      };
    });

    // 3. MOMENTUM SYNC: Notify the feed that this post just "jumped" in energy
    const syncChannel = new BroadcastChannel('aura_feed_sync');
    syncChannel.postMessage({ 
      type: 'post_interaction', 
      payload: { 
        postId: post.id, 
        userId: authUid, 
        action: 'reaction', 
        reactionType: type,
        count: newCount, 
        isNew: !isRemove,
        momentumBoost: isRemove ? 0 : 25 // Instant momentum spike for the local brain
      } 
    });
    syncChannel.close();

    try {
      const updateData: any = {
        updatedAt: serverTimestamp()
      };
      
      // Calculate new counts for server sync
      const currentCounts = { ...(localPost.reactionCounts || {}) };
      
      if (isRemove) {
        // 1. Remove the like document
        await deleteDoc(likeRef);
        
        // 2. Prepare post update
        updateData.likesCount = increment(-1);
        updateData[`reactionCounts.${type}`] = increment(-1);
        
        currentCounts[type] = Math.max(0, (currentCounts[type] || 0) - 1);
        
        await updateDoc(postRef, updateData);
      } else {
        // 1. Create/Update the like document
        await setDoc(likeRef, {
          postId: post.id,
          commentId: null,
          userId: authUid,
          userName: profile?.displayName || user?.displayName || 'Aura User',
          userPhoto: profile?.photoURL || user?.photoURL || '',
          type: type,
          createdAt: serverTimestamp()
        });
        
        // 2. Prepare post update
        if (!oldReaction) {
          updateData.likesCount = increment(1);
        } else {
          // If changing reaction, decrement old one
          updateData[`reactionCounts.${oldReaction}`] = increment(-1);
          currentCounts[oldReaction] = Math.max(0, (currentCounts[oldReaction] || 0) - 1);
        }
        
        // Increment new reaction
        updateData[`reactionCounts.${type}`] = increment(1);
        currentCounts[type] = (currentCounts[type] || 0) + 1;
        
        await updateDoc(postRef, updateData);

        // 3. Notification only for new likes/reactions
        if (!oldReaction && post.authorId !== authUid) {
          void createNotification({
            userId: post.authorId,
            actorId: authUid,
            actorName: profile?.displayName || user?.displayName || 'User',
            actorPhoto: profile?.photoURL || user?.photoURL || '',
            type: 'like',
            postId: post.id,
          });
        }
      }
    } catch (error: any) {
      const isMissingDoc = String(error?.message || '').includes('No document to update');
      
      if (error?.code === 'permission-denied') {
        console.error('Error toggling reaction:', error);
        alert(t('post_card.like_permission_denied', 'Você não tem permissão para curtir este post.'));
      } else if (isMissingDoc) {
        // Silent recovery: Post was likely deleted while user was looking at it
        queryClient.invalidateQueries({ queryKey: ['posts'] });
      } else {
        console.error('Error toggling reaction:', error);
      }
      
      // Revert local UI state on failure
      setUserReaction(oldReaction);
      setLocalPost(localPost); // Restore previous state
      if (!navigator.onLine) {
        const { offlineManager } = require('@/lib/offline-manager');
        offlineManager.add('like', { postId: post.id, type });
      }
    }
  };

  const handleVote = async (optionId: string) => {
    if (!authUid || !post.id || isOptimisticPost) return;
    if (!post.poll) return;

    const isExpired = post.poll.expiresAt < Date.now();
    if (isExpired) return;

    const alreadyVoted = post.poll.voters?.includes(authUid);
    if (alreadyVoted) return;

    const postRef = doc(db, 'posts', post.id);

    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) return;

        const data = postDoc.data();
        const poll = data.poll;
        if (!poll) return;
        
        if (poll.voters?.includes(authUid)) return; 

        const updatedOptions = poll.options.map((opt: any) => {
          if (opt.id === optionId) {
            return { ...opt, votes: (opt.votes || 0) + 1 };
          }
          return opt;
        });

        transaction.update(postRef, {
          'poll.options': updatedOptions,
          'poll.totalVotes': increment(1),
          'poll.voters': arrayUnion(authUid)
        });
      });
      soundEffects.play('success');
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleCommentReaction = async (commentId: string, type: string, currentReaction: string | null, currentLikesCount: number = 0) => {
    if (!authUid || !post.id) return;

    const commentRef = doc(db, 'comments', commentId);
    const likeRef = doc(db, 'likes', `${post.id}_${commentId}_${authUid}`);

    try {
      soundEffects.play('reaction');
      const updateData: any = {};
      if (currentLikesCount === undefined) updateData.likesCount = 0;
      
      // Legacy Healing: Ensure visibility exists (though comments rarely have it, but for rules consistency)
      // Actually comments don't have visibility in rules, but just in case
      

      if (currentReaction === type) {
        // Remove reaction
        await deleteDoc(likeRef);
        updateData.likesCount = increment(-1);
        updateData[`reactionCounts.${type}`] = increment(-1);
        await updateDoc(commentRef, updateData);
        setCommentReactions((current) => {
          const next = { ...current };
          delete next[commentId];
          return next;
        });
      } else {
        // Add or change reaction
        await setDoc(likeRef, {
          postId: post.id,
          commentId: commentId,
          userId: authUid,
          type: type,
          createdAt: serverTimestamp()
        });
        if (!currentReaction) {
          updateData.likesCount = increment(1);
        } else {
          updateData[`reactionCounts.${currentReaction}`] = increment(-1);
        }
        updateData[`reactionCounts.${type}`] = increment(1);
        
        if (Object.keys(updateData).length > 0) {
          await updateDoc(commentRef, updateData);
        }
        setCommentReactions((current) => ({ ...current, [commentId]: type }));
      }
    } catch (error: any) {
      console.error('Error toggling comment reaction:', error);
      alert(`Failed to react: ${error.message}`);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUid || !post.id || !newComment.trim() || isSubmittingComment) return;

    if (isOptimisticPost) return;

    setIsSubmittingComment(true);
    try {
      // 🛡️ MODERATION LAYER
      const modResult = validateContent(newComment, 'comment');
      if (modResult.status === 'block') {
        alert('Seu comentário contém conteúdo não permitido pela política da Aura.');
        setIsSubmittingComment(false);
        return;
      }
      await addDoc(collection(db, 'comments'), {
        postId: post.id,
        authorId: authUid,
        authorName: profile?.displayName || user?.displayName || 'User',
        authorPhoto: profile?.photoURL || user?.photoURL || '',
        content: newComment.trim(),
        likesCount: 0,
        replyToId: replyingTo?.id || null,
        replyToName: replyingTo?.name || null,
        createdAt: serverTimestamp(),
        moderation: {
          status: modResult.status,
          reasons: modResult.reasons,
          score: modResult.score.total,
          matchedRules: modResult.matchedRules
        }
      });
      
      const updateData: any = {
        commentsCount: increment(1)
      };
      // Heal legacy data
      if (!post.visibility) updateData.visibility = 'public';
      if (post.likesCount === undefined) updateData.likesCount = 0;
      if (post.sharesCount === undefined) updateData.sharesCount = 0;
      if (!post.authorName) updateData.authorName = 'Anonymous';

      await updateDoc(doc(db, 'posts', post.id), updateData);
      setNewComment('');
      setLocalPost((current: any) => ({
        ...current,
        commentsCount: (current.commentsCount || 0) + 1,
      }));

      // Create notification for comment
      if (post.authorId !== authUid) {
        void createNotification({
          userId: post.authorId,
          actorId: authUid,
          actorName: profile?.displayName || user?.displayName || 'User',
          actorPhoto: profile?.photoURL || user?.photoURL || '',
          type: 'comment',
          postId: post.id,
          extraText: newComment.trim().slice(0, 80),
        });
      }
    } catch (error: any) {
      console.error('Error adding comment:', error);
      alert(`Failed to add comment: ${error.message}`);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const [isCommunityModerator, setIsCommunityModerator] = useState(false);

  useEffect(() => {
    if (!authUid || !post.communityId) return;

    const loadCommunityRole = async () => {
      const communityDoc = await getDoc(doc(db, 'communities', post.communityId));
      if (!communityDoc.exists()) return;

      const data = communityDoc.data();
      const userRole = data.roles?.[authUid] || 'member';
      setIsCommunityModerator(userRole === 'admin' || userRole === 'moderator' || data.creatorId === authUid);
    };

    void loadCommunityRole();
  }, [authUid, post.communityId]);

  const handleDeletePost = () => {
    if (!authUid || !post.id) return;
    const isAuthor = post.authorId === authUid;
    const canDelete = isAuthor || isCommunityModerator || isAdmin(profile);

    if (!canDelete) return;
    setIsDeletePostModalOpen(true);
  };

  const confirmDeletePost = async () => {
    if (!post.id) return;
    try {
      soundEffects.play('delete');
      await deleteDoc(doc(db, 'posts', post.id));

      // Optimistic UI: remove post from cached feeds immediately
      queryClient.setQueriesData(
        { predicate: (q) => Array.isArray((q as any)?.queryKey) && (q as any).queryKey[0] === 'posts' },
        (old: any) => {
          if (!old || !Array.isArray(old.pages)) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => {
              const docs = page?.docs;
              if (!Array.isArray(docs)) return page;
              return { ...page, docs: docs.filter((d: any) => d?.id !== post.id) };
            }),
          };
        }
      );

      setIsDeletePostModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (error: any) {
      console.error('Error deleting post:', error);
      alert(`${t('post_card.failed_to_delete', 'Failed to delete post:')} ${error.message}`);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    setCommentToDelete({ id: commentId, postId: post.id });
    setIsDeleteCommentModalOpen(true);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;
    try {
      soundEffects.play('delete');
      await deleteDoc(doc(db, 'comments', commentToDelete.id));
      
      // Update comments count on the post
      await updateDoc(doc(db, 'posts', commentToDelete.postId), {
        commentsCount: increment(-1)
      });
      
      setLocalPost((current: any) => ({
        ...current,
        commentsCount: Math.max(0, (current.commentsCount || 0) - 1),
      }));
      
      setCommentToDelete(null);
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      alert(`Failed to delete comment: ${error.message}`);
    }
  };

  const activePostReaction = useMemo(() => REACTIONS.find((r) => r.id === userReaction), [userReaction]);
  const displayContent = post.content || '';

  const sharedPost = post.sharedPostData || null;
  const sharedPostDisplayContent = sharedPost?.content || '';


  // Fetch thread participants for the shared post
  useEffect(() => {
    if (!post.sharedPostId) {
      if (threadParticipants.length > 0) setThreadParticipants([]);
      return;
    }
    
    const fetchParticipants = async () => {
      try {
        const q = query(
          collection(db, 'comments'),
          where('postId', '==', post.sharedPostId),
          orderBy('createdAt', 'desc'),
          limit(15)
        );
        const snap = await getDocs(q);
        const photos = snap.docs
          .map(d => d.data().authorPhoto)
          .filter(Boolean) as string[];
        
        // Add shared post author photo to the mix if it exists
        if (sharedPost?.authorPhoto) {
          photos.unshift(sharedPost.authorPhoto);
        }
        
        const uniquePhotos = Array.from(new Set(photos)).slice(0, 3);
        setThreadParticipants(uniquePhotos);
      } catch (err) {
        console.error('Error fetching thread participants:', err);
      }
    };
    
    fetchParticipants();
  }, [post.sharedPostId, sharedPost?.authorPhoto]);

  const getTopReactions = (reactionCounts: Record<string, number> | undefined) => {
    if (!reactionCounts || Object.keys(reactionCounts).length === 0) {
      // Fallback for legacy posts that only have likesCount but no detailed reactionCounts
      if (post.likesCount > 0) return [REACTIONS.find(r => r.id === 'love')].filter(Boolean);
      return [];
    }
    return Object.entries(reactionCounts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([id]) => REACTIONS.find(r => r.id === id))
      .filter(Boolean);
  };

  const getPostPulse = () => {
    const counts = post.reactionCounts;
    if (!counts || Object.keys(counts).length === 0) return null;
    
    const total = Object.values(counts).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
    if (total < 1) return null;

    const [dominantId] = Object.entries(counts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    
    return REACTIONS.find(r => r.id === dominantId);
  };

  const pulse = getPostPulse();

  const topPostReactions = useMemo(() => getTopReactions(localPost.reactionCounts), [localPost.reactionCounts]);

  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const [showReactionSelector, setShowReactionSelector] = useState(false);
  const [wasLongPress, setWasLongPress] = useState(false);
  const reactionTimerRef = useRef<any>(null);

  const handleDoubleClick = () => {
    if (!userReaction) {
      handlePostReaction('like');
      setShowHeartOverlay(true);
      setTimeout(() => setShowHeartOverlay(false), 1000);
    }
  };

  const handleTouchStart = () => {
    setWasLongPress(false);
    reactionTimerRef.current = setTimeout(() => {
      setWasLongPress(true);
      setShowReactionSelector(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
  };

  const handleReactionMouseEnter = () => {
    reactionTimerRef.current = setTimeout(() => {
      setShowReactionSelector(true);
    }, 600);
  };

  const handleReactionMouseLeave = () => {
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    // Give a small grace period to move into the selector
    setTimeout(() => {
      const selector = document.getElementById(`reaction-selector-${post.id}`);
      if (selector && !selector.matches(':hover')) {
        setShowReactionSelector(false);
      }
    }, 100);
  };

  const [imageLoaded, setImageLoaded] = useState(false);

  const isFresh = useMemo(() => {
    const now = Date.now();
    const createdAt = post.createdAt?.toDate ? post.createdAt.toDate().getTime() : now;
    return (now - createdAt) < 15 * 60 * 1000; // 15 minutes
  }, [post.createdAt]);

  // 🔄 DYNAMIC PROFILE SYNC: Always show latest info for the current user, or react to broadcast
  const authorPhoto = useMemo(() => {
    if (post.authorId === profile?.uid && profile?.photoURL) return profile.photoURL;
    return post.authorPhoto || '';
  }, [post.authorId, post.authorPhoto, profile?.uid, profile?.photoURL]);

  const authorName = useMemo(() => {
    if (post.authorId === profile?.uid && profile?.displayName) return profile.displayName;
    return post.authorName || 'User';
  }, [post.authorId, post.authorName, profile?.uid, profile?.displayName]);

  const authorUsername = useMemo(() => {
    if (post.authorId === profile?.uid && profile?.username) return profile.username;
    return post.authorUsername || '';
  }, [post.authorId, post.authorUsername, profile?.uid, profile?.username]);

  const isAuthorVerified = useMemo(() => {
    const pName = authorName?.toLowerCase().trim();
    const pUser = authorUsername?.toLowerCase().trim();
    const isHardcodedPhilippe = 
      post.authorId === 'gONefSw0DwPvTZBmFFIUn0sau4w2' || 
      pName === 'philippe boechat' || 
      pUser === 'philippeboechat2230' ||
      pUser === 'phdev';
    
    return post.authorVerified || post.isVerified || isHardcodedPhilippe || (post.authorId === profile?.uid && profile?.isVerified);
  }, [post.authorVerified, post.isVerified, post.authorId, authorName, authorUsername, profile?.uid, profile?.isVerified]);

  return (
    <div
      ref={viewRef} 
      className="bg-white rounded-[2rem] shadow-sm mb-6 border border-slate-100/60 overflow-hidden transition-all duration-700 hover:shadow-2xl hover:shadow-slate-200/40 group/card active:scale-[0.998] relative"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '800px' }}
    >
      {/* Dynamic Animated Border Glow */}
      <div className="absolute inset-0 border border-transparent group-hover/card:border-primary/20 rounded-[2rem] pointer-events-none transition-all duration-700" />
      
      <div className="p-5 sm:p-7">
        <div className="flex justify-between items-start mb-6">
          <div className="flex gap-4 items-center">
            <div className="relative shrink-0">
              <Link 
                href={`/profile/${post.authorId}`} 
                className="relative block w-12 h-12 rounded-2xl bg-slate-50 overflow-hidden ring-4 ring-slate-50 shadow-sm transition-all duration-500 group-hover/card:scale-105 group-hover/card:shadow-lg group-hover/card:shadow-primary/10"
              >
                {authorPhoto ? (
                  <img src={authorPhoto} alt={authorName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary/30 font-black text-2xl bg-gradient-to-br from-slate-100 to-slate-200">
                    {authorName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </Link>

            </div>
            <div className="flex flex-col">
              <Link href={`/profile/${post.authorId}`} className="group/name flex items-center gap-2 flex-wrap">
                <span className="font-ex-bold text-[18px] text-slate-900 tracking-tight leading-tight group-hover/name:text-primary transition-all duration-300">{authorName}</span>
                {isAuthorVerified && (
                  <BadgeCheck className="w-5 h-5 text-indigo-600 fill-indigo-600 text-white shrink-0" strokeWidth={2.5} />
                )}
                {post.mood && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full ml-1">
                    <span className="text-[13px]">{MOODS.find(m => m.id === post.mood)?.emoji}</span>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
                      {MOODS.find(m => m.id === post.mood)?.label}
                    </span>
                  </div>
                )}
              </Link>
              {authorUsername && (
                <span className="text-[15px] text-indigo-600/60 font-medium -mt-1">@{authorUsername}</span>
              )}
              <div className="flex items-center gap-2 text-[14px] text-slate-400 font-medium mt-1">
                <div className="flex items-center gap-2">
                  {isPinned && (
                    <div className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mr-1">
                      <Pin size={12} className="fill-indigo-600" />
                      <span className="text-[10px] font-black uppercase tracking-wider">{t('post.pinned', 'Fixado')}</span>
                    </div>
                  )}
                  <Clock size={16} className="opacity-60" />
                  <TimeAgo date={post.createdAt?.toDate ? post.createdAt.toDate() : (typeof post.createdAt === 'number' ? post.createdAt : Date.now())} />
                </div>
                <span className="opacity-50">•</span>
                <div className="flex items-center gap-1.5">
                  {post.communityId ? (
                    <Link 
                      href={`/communities/${post.communityId}`} 
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer group/comm-tag"
                    >
                      <Users className="w-4 h-4 text-indigo-500 group-hover/comm-tag:text-primary" />
                      <span className="font-bold text-slate-500/80 underline-offset-2 group-hover/comm-tag:underline group-hover/comm-tag:text-primary-600 transition-all">{post.communityName || 'Comunidade'}</span>
                    </Link>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 opacity-60" />
                      <span>{post.visibility === 'public' ? 'Público' : post.visibility}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-border/50 z-20 overflow-hidden py-1">
                  {(authUid === post.authorId || isCommunityModerator || isAdmin(profile)) ? (
                    <button 
                      onClick={() => { setShowMenu(false); handleDeletePost(); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> {t('post_card.delete', 'Delete Post')}
                    </button>
                  ) : null}
                  {isCommunityModerator && post.communityId && (
                    <button 
                      onClick={async () => { 
                        setShowMenu(false); 
                        const communityRef = doc(db, 'communities', post.communityId);
                        try {
                          const snap = await getDoc(communityRef);
                          if (snap.exists()) {
                            const pinned = snap.data().pinnedPostIds || [];
                            const isCurrentlyPinned = pinned.includes(post.id);
                            if (isCurrentlyPinned) {
                              await updateDoc(communityRef, {
                                pinnedPostIds: pinned.filter((id: string) => id !== post.id)
                              });
                            } else {
                              await updateDoc(communityRef, {
                                pinnedPostIds: arrayUnion(post.id)
                              });
                            }
                          }
                        } catch (err) {
                           console.error('Error toggling pin:', err);
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted/50 flex items-center gap-2 transition-colors"
                    >
                      <Bookmark className={`w-4 h-4 ${isPinnedLocally ? 'fill-primary text-primary' : ''}`} /> 
                      {isPinnedLocally ? 'Desafixar do topo' : 'Fixar no topo'}
                    </button>
                  )}
                  {authUid && (
                    <button 
                      onClick={() => { setShowMenu(false); handleReport(); }}
                      className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted/50 flex items-center gap-2 transition-colors"
                    >
                      <ShieldAlert className="w-4 h-4" /> {t('post_card.report', 'Report Post')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        
        <div 
          className="cursor-pointer group/content"
          onClick={() => router.push(`/post/${post.id}`)}
        >
          {post.content && (
            <div className="text-[17px] text-slate-900 mb-4 leading-relaxed font-medium tracking-tight px-0.5 group-hover/content:text-black transition-colors">
              {renderTextWithLinks(displayContent)}
            </div>
          )}
        </div>
        {normalizedHashtags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {normalizedHashtags.map((normalizedTag: string) => {
              return (
                <Link
                  key={normalizedTag}
                  href={`/explore?q=${encodeURIComponent(normalizedTag)}`}
                  className="text-[16px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {normalizedTag}
                </Link>
              );
            })}
          </div>
        )}

        {post.poll && (
          <div className="mb-6 pl-0.5">
            <div className="bg-slate-50/50 border border-slate-100/50 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-2">
                  <BarChart2 className="w-3 h-3" />
                  Enquete em tempo real
                </span>
                <span className="text-[10px] font-bold text-slate-400 capitalize">
                  {post.poll.expiresAt < Date.now() ? 'Encerrada' : <TimeAgo date={new Date(post.poll.expiresAt)} />}
                </span>
              </div>
              <div className="space-y-3">
                {post.poll.options.map((option: any) => {
                  const hasVoted = post.poll.voters?.includes(authUid);
                  const isExpired = post.poll.expiresAt < Date.now();
                  const showResults = hasVoted || isExpired;
                  const percentage = post.poll.totalVotes > 0 ? Math.round(((option.votes || 0) / post.poll.totalVotes) * 100) : 0;
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => !showResults && handleVote(option.id)}
                      disabled={showResults}
                      className={`relative w-full text-left overflow-hidden rounded-2xl transition-all duration-500 group/option ${
                        showResults ? 'cursor-default' : 'hover:scale-[1.02] active:scale-95 border border-slate-200'
                      }`}
                    >
                      {/* Progress background */}
                      {showResults && (
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 1, ease: 'circOut' }}
                          className={`absolute inset-0 z-0 opacity-15 ${
                            percentage === Math.max(...post.poll.options.map((o: any) => o.votes || 0)) ? 'bg-primary' : 'bg-slate-400'
                          }`}
                        />
                      )}
                      
                      <div className={`relative z-10 px-4 py-3.5 flex items-center justify-between ${showResults ? '' : 'bg-white'}`}>
                        <div className="flex items-center gap-3">
                          {showResults && (
                             <div className={`w-1.5 h-1.5 rounded-full ${
                               percentage === Math.max(...post.poll.options.map((o: any) => o.votes || 0)) ? 'bg-primary shadow-[0_0_8px_rgba(122,99,241,0.5)]' : 'bg-slate-300'
                             }`} />
                          )}
                          <span className={`text-[15px] font-bold transition-colors ${
                            showResults 
                              ? (percentage === Math.max(...post.poll.options.map((o: any) => o.votes || 0)) ? 'text-slate-900' : 'text-slate-500') 
                              : 'text-slate-700 group-hover/option:text-primary'
                          }`}>
                            {option.text}
                          </span>
                        </div>
                        {showResults && (
                          <div className="flex flex-col items-end leading-none">
                            <span className={`text-[14px] font-black ${
                              percentage === Math.max(...post.poll.options.map((o: any) => o.votes || 0)) ? 'text-primary' : 'text-slate-400'
                            }`}>
                              {percentage}%
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>{post.poll.totalVotes || 0} votos totais</span>
                {post.poll.voters?.includes(authUid) && (
                   <span className="text-primary flex items-center gap-1">
                     <CheckCircle className="w-3 h-3" />
                     Voto computado
                   </span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {sharedPost && (
          <div className="mt-3 mx-0 rounded-[24px] border border-slate-100 bg-gradient-to-br from-slate-50/50 to-white p-4 group/shared transition-all hover:bg-white hover:border-primary/20 hover:shadow-[0_16px_40px_rgba(0,0,0,0.04)] cursor-pointer relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="flex items-center gap-3 mb-4 relative">
              <div className="relative">
                <Link href={`/profile/${sharedPost.authorId}`} className="block w-12 h-12 rounded-[18px] bg-white p-0.5 shadow-xl ring-1 ring-slate-100 overflow-hidden shrink-0">
                  {sharedPost.authorPhoto ? (
                    <img src={sharedPost.authorPhoto} alt={sharedPost.authorName} loading="lazy" decoding="async" className="w-full h-full rounded-[16px] object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary/30 font-black text-sm bg-gradient-to-br from-slate-50 to-slate-200 rounded-[16px]">
                      {sharedPost.authorName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                </Link>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-ex-bold text-[16px] text-slate-900 group-hover/shared:text-primary transition-colors tracking-tight">
                    {sharedPost.authorName}
                  </span>
                  {sharedPost.authorUsername && (
                    <span className="text-[13px] text-slate-400 font-medium">@{sharedPost.authorUsername}</span>
                  )}
                  {(sharedPost.authorVerified || sharedPost.isVerified || sharedPost.authorId === 'gONefSw0DwPvTZBmFFIUn0sau4w2' || sharedPost.authorUsername === 'philippeboechat2230' || sharedPost.authorUsername === 'phdev' || sharedPost.authorName?.toLowerCase().trim() === 'philippe boechat') && <BadgeCheck className="w-4 h-4 text-indigo-600 fill-indigo-600 text-white" strokeWidth={2.5} />}
                </div>
                <div className="flex items-center gap-2">
                   <div className="flex items-center gap-1.5 text-[9px] font-black text-primary/60 uppercase tracking-widest bg-primary/5 px-2.5 py-1 rounded-full border border-primary/10 shadow-sm shadow-primary/5">
                     <Share2 className="w-2.5 h-2.5" />
                     {sharedPost.communityName && <span className="max-w-[120px] truncate">{sharedPost.communityName}</span>}
                   </div>
                   <span className="text-[10px] text-slate-300">•</span>
                   <span className="text-[10px] text-slate-400 font-bold"><TimeAgo date={sharedPost.createdAt?.toDate ? sharedPost.createdAt.toDate() : new Date()} /></span>
                </div>
              </div>
            </div>

            <div className="relative mb-6">
              {sharedPost.content && (
                <div className="text-[16px] text-slate-700 leading-relaxed font-medium tracking-tight">
                  {renderTextWithLinks(sharedPostDisplayContent)}
                </div>
              )}
            </div>

            {sharedPost.imageUrl && (
              <div className="mt-4 rounded-[28px] overflow-hidden border border-slate-100 shadow-2xl shadow-black/5 group-hover/shared:scale-[1.01] transition-transform duration-700">
                <img src={sharedPost.imageUrl} alt="Shared content" className="w-full max-h-[380px] object-cover" />
              </div>
            )}

            {sharedPost.video && sharedPost.video.provider === 'youtube' ? (
              <div className="mt-4 rounded-[28px] overflow-hidden border border-slate-100 shadow-2xl shadow-black/5 aspect-video group-hover/shared:scale-[1.01] transition-transform duration-700">
                {sharedPost.video.status === 'processing' ? (
                  <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm font-bold text-slate-500">Processando vídeo...</span>
                  </div>
                ) : (
                  <iframe
                    src={`${sharedPost.video.embedUrl}?modestbranding=1&rel=0&iv_load_policy=3&controls=1&showinfo=0`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Video player"
                  />
                )}
              </div>
            ) : sharedPost.videoUrl && (
              <div className="mt-4 rounded-[28px] overflow-hidden border border-slate-100 shadow-2xl shadow-black/5 group-hover/shared:scale-[1.01] transition-transform duration-700">
                <video src={sharedPost.videoUrl} controls playsInline className="w-full max-h-[380px] object-cover" />
              </div>
            )}
            
            <Link 
              href={`/post/${sharedPost.id}`}
              className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between group/link"
            >
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 group-hover/link:text-primary transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/link:bg-primary transition-colors" />
                {t('post_card.view_full_thread', 'Explore thread history')}
              </span>
              <div className="flex -space-x-2.5">
                {threadParticipants.length > 0 ? (
                  threadParticipants.map((photo, i) => (
                    <div 
                      key={i} 
                      className="w-7 h-7 rounded-xl bg-slate-50 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden ring-1 ring-slate-100/50"
                      style={{ zIndex: 3 - i }}
                    >
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-[8px] font-bold text-slate-400">Novo Echo</span>
                  </div>
                )}
              </div>
            </Link>
          </div>
        )}
      </div>
      
      {post.imageUrl && (
        <div 
          className="w-full bg-slate-100 cursor-pointer overflow-hidden group relative min-h-[200px]"
          onClick={() => setIsLightboxOpen(true)}
          onDoubleClick={handleDoubleClick}
        >
          {!imageLoaded && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
          )}
          <img 
            src={post.imageUrl} 
            alt="Post content" 
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            className={`w-full object-cover max-h-[540px] group-hover:scale-[1.02] transition-all duration-700 ease-out ${imageLoaded ? 'opacity-100' : 'opacity-0 scale-95'}`} 
          />
          
          {showHeartOverlay && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="animate-in zoom-in fade-in out-zoom-out out-fade-out fill-mode-forwards duration-700">
                <Heart className="w-24 h-24 text-white fill-white drop-shadow-2xl opacity-90" />
              </div>
            </div>
          )}
        </div>
      )}

      {post.video && post.video.provider === 'youtube' ? (
        <div className="w-full bg-slate-100 overflow-hidden group relative aspect-video">
          {post.video.status === 'processing' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-50">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <span className="text-[15px] font-black text-slate-400 uppercase tracking-widest">Vídeo em processamento</span>
            </div>
          ) : (
            <>
              {/* Overlay para esconder header do YT */}
              <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-b from-black/20 via-transparent to-transparent h-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <iframe
                src={`${post.video.embedUrl}?modestbranding=1&rel=0&iv_load_policy=3&controls=1&showinfo=0`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Video player"
              />
            </>
          )}

          {showHeartOverlay && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="animate-in zoom-in fade-in out-zoom-out out-fade-out fill-mode-forwards duration-700">
                <Heart className="w-24 h-24 text-white fill-white drop-shadow-2xl opacity-90" />
              </div>
            </div>
          )}
        </div>
      ) : post.videoUrl && (
        <div
          className="w-full bg-slate-100 overflow-hidden group relative min-h-[200px]"
          onDoubleClick={handleDoubleClick}
        >
          <video
            src={post.videoUrl}
            controls
            playsInline
            className="w-full object-cover max-h-[540px]"
          />

          {showHeartOverlay && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="animate-in zoom-in fade-in out-zoom-out out-fade-out fill-mode-forwards duration-700">
                <Heart className="w-24 h-24 text-white fill-white drop-shadow-2xl opacity-90" />
              </div>
            </div>
          )}
        </div>
      )}

      {isLightboxOpen && (
        <Lightbox 
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          imageUrl={post.imageUrl}
          authorName={post.authorName}
          authorPhoto={post.authorPhoto}
          content={post.content}
          likesCount={post.likesCount}
          commentsCount={post.commentsCount}
        />
      )}

      <div className="px-5 py-2">
        <div className="flex justify-between items-center py-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {userReaction && profile && (
                <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm overflow-hidden z-30">
                  <img src={profile.photoURL || '/default-avatar.png'} alt="Você" className="w-full h-full object-cover" />
                </div>
              )}
              {likers.map((liker, i) => (
                <div 
                  key={liker.id} 
                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm overflow-hidden"
                  style={{ zIndex: 20 - i }}
                >
                  <img src={liker.userPhoto || liker.photoURL || liker.avatar || '/default-avatar.png'} alt={liker.userName || liker.displayName} className="w-full h-full object-cover" />
                </div>
              ))}
              {(likesCount > (likers.length + (userReaction ? 1 : 0))) && (
                <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-600 z-10">
                  +{isNaN(likesCount - likers.length - (userReaction ? 1 : 0)) ? 0 : Math.max(0, likesCount - likers.length - (userReaction ? 1 : 0))}
                </div>
              )}
            </div>
            <p className="text-[14px] text-slate-500 font-medium">
              {userReaction ? (
                likesCount === 1 ? (
                  <>Você curtiu</>
                ) : likesCount === 2 ? (
                  <>Você e <span className="font-bold text-slate-900">outra pessoa</span> curtiram</>
                ) : (
                  <>Você e outras <span className="font-bold text-slate-900">{Math.max(0, likesCount - 1)}</span> pessoas curtiram</>
                )
              ) : (
                likesCount > 0 ? (
                  <><span className="font-bold text-slate-900">{likesCount}</span> {likesCount === 1 ? 'pessoa curtiu' : 'pessoas curtiram'}</>
                ) : (
                  <>Seja o primeiro a curtir</>
                )
              )}
            </p>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors" onClick={() => setShowComments(!showComments)}>
              <MessageCircle className="w-5 h-5" />
              <span className="text-[14px] font-medium">{commentsCount}</span>
            </div>
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors">
              <Repeat2 className="w-5 h-5" />
              <span className="text-[14px] font-medium">{sharesCount}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-slate-100 relative">
          <div 
            className="flex-1 relative" 
            onMouseEnter={handleReactionMouseEnter} 
            onMouseLeave={handleReactionMouseLeave}
          >
            <AnimatePresence>
              {showReactionSelector && (
                <>
                  <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setShowReactionSelector(false)} onTouchStart={() => setShowReactionSelector(false)} />
                  <motion.div
                    id={`reaction-selector-${post.id}`}
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="absolute bottom-full left-0 mb-2 bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 p-2 flex gap-1 z-50 pointer-events-auto"
                    onMouseEnter={handleReactionMouseEnter}
                    onMouseLeave={handleReactionMouseLeave}
                  >
                    {REACTIONS.map((reaction) => (
                      <button
                        key={reaction.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handlePostReaction(reaction.id);
                          setShowReactionSelector(false);
                        }}
                        className="group/reaction relative p-2 hover:scale-[1.3] hover:-translate-y-2 transition-all duration-300 origin-bottom flex-shrink-0"
                      >
                        <span className="text-3xl drop-shadow-sm relative z-10">{reaction.icon}</span>
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[11px] font-black tracking-wide px-3 py-1.5 rounded-full opacity-0 group-hover/reaction:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                          {reaction.label}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <button 
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              onClick={(e) => {
                if (wasLongPress) {
                  e.preventDefault();
                  setWasLongPress(false);
                  return;
                }
                activePostReaction ? handlePostReaction(activePostReaction.id) : handlePostReaction('like');
              }}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl transition-all duration-300 ${
                activePostReaction 
                  ? `${activePostReaction.color} ${activePostReaction.bgColor} shadow-sm` 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {activePostReaction ? (
                 <span className="text-xl leading-none drop-shadow-sm">{activePostReaction.icon}</span>
              ) : (
                 <Heart className="w-5 h-5 md:w-5 md:h-5" />
              )}
              <span className="hidden sm:inline text-[15px] font-bold">
                {activePostReaction ? activePostReaction.label : 'Curtir'}
              </span>
            </button>
          </div>
          <div className="w-[1px] h-6 bg-slate-100 mx-1" />
          <button 
            onClick={() => setShowComments(!showComments)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-slate-500 hover:bg-slate-50 transition-all duration-300"
          >
            <MessageCircle className="w-5 h-5 md:w-5 md:h-5" />
            <span className="hidden sm:inline text-[15px] font-bold">Comentar</span>
          </button>
          <div className="w-[1px] h-6 bg-slate-100 mx-1" />
          <button 
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-slate-500 hover:bg-slate-50 transition-all duration-300"
          >
            <Share2 className="w-5 h-5 md:w-5 md:h-5" />
            <span className="hidden sm:inline text-[15px] font-bold">Compartilhar</span>
          </button>
          <div className="w-[1px] h-6 bg-slate-100 mx-1" />
          <div className="relative flex-1">
            <button 
              onClick={handleBookmark}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl transition-all duration-300 ${
                isBookmarked ? 'text-amber-500 bg-amber-50/80 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Bookmark className={`w-5 h-5 md:w-5 md:h-5 ${isBookmarked ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline text-[15px] font-bold">Salvar</span>
            </button>
            <AnimatePresence>
              {showBookmarkFeedback && (
                <motion.span
                  key="bookmark-feedback"
                  initial={{ opacity: 0, y: 4, scale: 0.7 }}
                  animate={{ opacity: 1, y: -18, scale: 1 }}
                  exit={{ opacity: 0, y: -30, scale: 0.8 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 text-[11px] font-black text-amber-500 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shadow-sm whitespace-nowrap z-20"
                >
                  +1 ✓
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="px-5 pb-4 pt-2 bg-muted/10 border-t border-border/50">
          {/* Comment List */}
          <div className="flex flex-col gap-3 mb-4 max-h-[300px] overflow-y-auto">
            {comments.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4">{t('post.no_comments', 'No comments yet. Be the first!')}</div>
            ) : (
              comments.map(comment => {
                const cReactionId = commentReactions[comment.id];
                const cActiveReaction = REACTIONS.find(r => r.id === cReactionId);

                return (
                  <div key={comment.id} className={`flex gap-2 ${comment.replyToId ? 'ml-10 mt-1' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 mt-1">
                      {comment.authorPhoto ? (
                        <img src={comment.authorPhoto} alt={comment.authorName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium text-xs">
                          {comment.authorName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="bg-white border border-border/50 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm relative">
                        <div className="font-semibold text-[13px] text-foreground leading-tight">{comment.authorName}</div>
                        {comment.replyToName && (
                          <div className="text-[12px] text-primary font-medium mt-0.5">@{comment.replyToName}</div>
                        )}
                        <div className="text-[14px] text-foreground mt-0.5">{renderTextWithLinks(comment.content)}</div>
                        
                        {/* Comment Reaction Badge */}
                        {(comment.likesCount > 0 || cActiveReaction) && (
                          <div className="absolute -bottom-2 -right-2 bg-white border border-border/50 shadow-sm rounded-full px-1.5 py-0.5 flex items-center gap-1 text-[11px] font-medium z-10">
                            <div className="flex -space-x-1">
                              {getTopReactions(comment.reactionCounts).length > 0 ? (
                                getTopReactions(comment.reactionCounts).map((r, i) => (
                                  <span key={r?.id} style={{ zIndex: 30 - i * 10 }} className="text-[10px] leading-none relative">{r?.icon}</span>
                                ))
                              ) : (
                                <span>{cActiveReaction ? cActiveReaction.icon : '👍'}</span>
                              )}
                            </div>
                            {comment.likesCount > 0 && <span>{comment.likesCount}</span>}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-3 text-[12px] text-muted-foreground ml-2 mt-1 font-medium items-center">
                        <div className="relative group">
                          {/* Comment Reaction Popover */}
                          <div className="absolute bottom-full left-0 pb-1 hidden group-hover:block z-50">
                            <div className="bg-white border border-border/50 shadow-xl rounded-full p-1 flex items-center gap-0.5 w-max animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
                              {REACTIONS.map(r => (
                                <button
                                  key={r.id}
                                  onClick={(e) => { e.stopPropagation(); handleCommentReaction(comment.id, r.id, cReactionId, comment.likesCount); }}
                                  className="w-7 h-7 hover:scale-[1.4] transition-transform origin-bottom flex items-center justify-center text-lg rounded-full hover:bg-slate-50"
                                  title={r.label}
                                >
                                  {r.icon}
                                </button>
                              ))}
                            </div>
                          </div>
                          <span 
                            onClick={() => cActiveReaction ? handleCommentReaction(comment.id, cActiveReaction.id, cReactionId, comment.likesCount) : handleCommentReaction(comment.id, 'like', cReactionId, comment.likesCount)}
                            className={`cursor-pointer transition-colors ${cActiveReaction ? cActiveReaction.color : 'hover:text-foreground'}`}
                          >
                            {cActiveReaction ? cActiveReaction.label : 'Like'}
                          </span>
                        </div>
                        
                        <span 
                          className="hover:text-foreground cursor-pointer"
                          onClick={() => setReplyingTo({ id: comment.id, name: comment.authorName })}
                        >
                          Reply
                        </span>
                        
                        {(authUid === comment.authorId || authUid === post.authorId || isCommunityModerator || isAdmin(profile)) && (
                          <span 
                            className="hover:text-red-500 cursor-pointer text-red-400/70 transition-colors"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            Delete
                          </span>
                        )}
                        <span className="font-normal">
                          {comment.createdAt ? (
                            <TimeAgo date={comment.createdAt.toDate ? comment.createdAt.toDate() : new Date(comment.createdAt)} />
                          ) : (
                            'Just now'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add Comment Input */}
          <div className="flex flex-col gap-2 mt-2">
            {replyingTo && (
              <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 rounded-lg text-[13px] text-muted-foreground ml-10">
                <span>Replying to <span className="font-semibold text-foreground">{replyingTo.name}</span></span>
                <button onClick={() => setReplyingTo(null)} className="hover:text-foreground">✕</button>
              </div>
            )}
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium text-xs">
                    {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              <form onSubmit={handleCommentSubmit} className="flex-1 flex items-center bg-slate-50 rounded-3xl px-4 py-2 border border-slate-100 focus-within:border-primary/30 shadow-sm transition-colors">
                <div className="flex-1 relative">
                  <input
                    ref={commentInputRef}
                    type="text"
                    value={newComment}
                    onChange={(e) => {
                      const value = e.target.value;
                      const cursor = e.target.selectionStart || 0;
                      setNewComment(value);

                      const textBeforeCursor = value.substring(0, cursor);
                      const lastAt = textBeforeCursor.lastIndexOf('@');
                      
                      if (lastAt !== -1) {
                        const textAfterAt = textBeforeCursor.substring(lastAt + 1);
                        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                          setMentionSearch({ text: textAfterAt, index: lastAt });
                          return;
                        }
                      }
                      setMentionSearch(null);
                    }}
                    placeholder={replyingTo ? "Escreva uma resposta..." : "Escreva um comentário..."}
                    className="w-full bg-transparent text-[15px] text-slate-600 focus:outline-none py-1.5 placeholder:text-slate-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setMentionSearch(null);
                    }}
                  />
                  {mentionSearch && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 z-50">
                      <MentionSuggestions
                        searchText={mentionSearch.text}
                        onSelect={(username) => {
                          const before = newComment.substring(0, mentionSearch.index);
                          const after = newComment.substring(mentionSearch.index + mentionSearch.text.length + 1);
                          setNewComment(`${before}@${username} ${after}`);
                          setMentionSearch(null);
                          commentInputRef.current?.focus();
                        }}
                        onClose={() => setMentionSearch(null)}
                      />
                    </div>
                  )}
                </div>
                <button 
                  type="submit" 
                  disabled={!newComment.trim() || isSubmittingComment}
                  className="text-primary font-semibold text-sm disabled:opacity-50 px-2"
                >
                  Post
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      <SharePostModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onConfirm={confirmRepost}
        postAuthor={post.authorName}
        postContent={post.content || ''}
      />

      {copyStatus === 'success' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-gray-900/90 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <CheckCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-wide">{t('post_card.link_copied', 'Post link copied to clipboard.')}</span>
        </div>
      )}
      {/* Delete Post confirmation modal */}
      <ConfirmModal
        isOpen={isDeletePostModalOpen}
        onClose={() => setIsDeletePostModalOpen(false)}
        onConfirm={confirmDeletePost}
        title={t('post_card.delete_confirm_title', 'Excluir Post')}
        message={t('post_card.delete_confirm', 'Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita.')}
        confirmText={t('post_card.delete_confirm_btn', 'Excluir')}
        cancelText={t('common:cancel', 'Cancelar')}
      />

      {/* Delete Comment confirmation modal */}
      <ConfirmModal
        isOpen={isDeleteCommentModalOpen}
        onClose={() => { setIsDeleteCommentModalOpen(false); setCommentToDelete(null); }}
        onConfirm={confirmDeleteComment}
        title={t('comment.delete_confirm_title', 'Excluir Comentário')}
        message={t('comment.delete_confirm', 'Deseja excluir seu comentário?')}
        confirmText={t('comment.delete_confirm_btn', 'Excluir')}
        cancelText={t('common:cancel', 'Cancelar')}
      />

      {/* Report confirmation modal */}
      <ConfirmModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onConfirm={confirmReport}
        title={t('post_card.report', 'Denunciar Post')}
        message={t('post_card.report_confirm', 'Tem certeza que deseja denunciar este post para moderação?')}
        confirmText={t('post_card.report', 'Denunciar')}
        cancelText={t('common:cancel', 'Cancelar')}
        variant="warning"
      />
    </div>
  );
});
