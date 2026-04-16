'use client';

import { useState, useEffect, memo, useMemo, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import dynamic from 'next/dynamic';
import { Heart, MessageCircle, Share2, MoreHorizontal, Globe, Users, Lock, Bookmark, Trash2, ThumbsUp, CheckCircle, ShieldAlert, Repeat2, Send, Link2, CheckCheck, Clock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { db } from '@/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc, increment, addDoc, serverTimestamp, orderBy, getDocs, getDoc } from 'firebase/firestore';
import { TimeAgo } from './TimeAgo';
import { SharePostModal } from './SharePostModal';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

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
  { id: 'like', icon: '👍', label: 'Like', color: 'text-primary', bgColor: 'bg-primary/10' },
  { id: 'love', icon: '❤️', label: 'Love', color: 'text-red-500', bgColor: 'bg-red-500/10' },
  { id: 'insightful', icon: '💡', label: 'Insightful', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  { id: 'funny', icon: '😂', label: 'Funny', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
];

export const PostCard = memo(function PostCard({ post: initialPost }: { post: any }) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const profile = useAppStore((state) => state.profile);
  const [localPost, setLocalPost] = useState(initialPost);
  const post = localPost;
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [commentReactions, setCommentReactions] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{id: string, name: string} | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success'>('idle');

  useEffect(() => {
    setLocalPost(initialPost);
  }, [initialPost]);

  const date = post.createdAt?.toDate ? post.createdAt.toDate() : new Date();

  useEffect(() => {
    if (!profile || !post.id) {
      setUserReaction(null);
      setCommentReactions({});
      return;
    }

    const q = query(
      collection(db, 'likes'),
      where('postId', '==', post.id),
      where('userId', '==', profile.uid)
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
  }, [profile, post.id]);

  // Listen for comments when section is open
  useEffect(() => {
    if (!showComments || !post.id) return;

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
    });

    return () => unsubscribe();
  }, [showComments, post.id]);

  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    if (!profile || !post.id) {
      setIsBookmarked(false);
      return;
    }

    const q = query(
      collection(db, 'bookmarks'),
      where('postId', '==', post.id),
      where('userId', '==', profile.uid)
    );

    const loadBookmark = async () => {
      const snapshot = await getDocs(q);
      setIsBookmarked(!snapshot.empty);
    };

    void loadBookmark();
  }, [profile, post.id]);

  const handleBookmark = async () => {
    if (!profile || !post.id) return;

    const bookmarkRef = doc(db, 'bookmarks', `${post.id}_${profile.uid}`);

    try {
      if (isBookmarked) {
        await deleteDoc(bookmarkRef);
        setIsBookmarked(false);
      } else {
        await setDoc(bookmarkRef, {
          postId: post.id,
          userId: profile.uid,
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
      }
    } catch (error: any) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const handleShare = async () => {
    setShowShareMenu((current) => !current);
  };

  const incrementShareCount = async () => {
    if (!post.id) return;

    const postRef = doc(db, 'posts', post.id);
    await updateDoc(postRef, {
      sharesCount: increment(1)
    });
    setLocalPost((current: any) => ({
      ...current,
      sharesCount: (current.sharesCount || 0) + 1,
    }));
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
    if (!profile || !post.id) return;
    setIsShareModalOpen(true);
    setShowShareMenu(false);
  };

  const confirmRepost = async (repostCaption: string) => {
    if (!profile || !post.id) return;

    setIsSharing(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: profile.uid,
        authorName: profile.displayName || 'Anonymous',
        authorPhoto: profile.photoURL || '',
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

      if (post.authorId !== profile.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: post.authorId,
          actorId: profile.uid,
          actorName: profile.displayName || 'User',
          actorPhoto: profile.photoURL || '',
          type: 'share',
          postId: post.id,
          read: false,
          createdAt: serverTimestamp(),
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


  const handleReport = async () => {
    if (!profile || !post.id) return;
    
    if (!confirm(t('post_card.report_confirm', 'Are you sure you want to report this post for moderation?'))) return;

    try {
      await addDoc(collection(db, 'reports'), {
        postId: post.id,
        communityId: post.communityId,
        reportedBy: profile.uid,
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
      if (type === 'post_interaction' && payload.postId === post.id && payload.userId !== profile?.uid) {
        if (payload.action === 'like') {
           setLocalPost((curr: any) => ({ ...curr, likesCount: payload.count }));
           // Show bubble animation if in view
           if (inView && payload.isNew) {
             setShowHeartOverlay(true);
             setTimeout(() => setShowHeartOverlay(false), 1000);
           }
        }
      }
    };
    syncChannel.addEventListener('message', handleSync);
    return () => {
      syncChannel.removeEventListener('message', handleSync);
      syncChannel.close();
    };
  }, [post.id, profile?.uid, inView]);

  const handlePostReaction = async (type: string) => {
    if (!profile || !post.id) return;

    const postRef = doc(db, 'posts', post.id);
    const likeRef = doc(db, 'likes', `${post.id}_${profile.uid}`);

    // OPTIMISTIC PRE-REF
    const oldReaction = userReaction;
    const isRemove = oldReaction === type;
    
    // Immediate UI Update
    setUserReaction(isRemove ? null : type);
    const newCount = (post.likesCount || 0) + (isRemove ? -1 : (oldReaction ? 0 : 1));
    
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

    // SYNC ACROSS TABS
    const syncChannel = new BroadcastChannel('aura_feed_sync');
    syncChannel.postMessage({ 
      type: 'post_interaction', 
      payload: { postId: post.id, userId: profile.uid, action: 'like', count: newCount, isNew: !isRemove } 
    });
    syncChannel.close();

    try {
      const updateData: any = {};
      if (isRemove) {
        await deleteDoc(likeRef);
        updateData.likesCount = increment(-1);
        updateData[`reactionCounts.${type}`] = increment(-1);
        await updateDoc(postRef, updateData);
      } else {
        await setDoc(likeRef, {
          postId: post.id,
          userId: profile.uid,
          type: type,
          createdAt: serverTimestamp()
        });
        
        if (!oldReaction) {
          updateData.likesCount = increment(1);
        } else {
          updateData[`reactionCounts.${oldReaction}`] = increment(-1);
        }
        updateData[`reactionCounts.${type}`] = increment(1);
        
        await updateDoc(postRef, updateData);

        // Notification only for new likes/reactions
        if (!oldReaction && post.authorId !== profile.uid) {
          void addDoc(collection(db, 'notifications'), {
            userId: post.authorId,
            actorId: profile.uid,
            actorName: profile.displayName,
            actorPhoto: profile.photoURL || '',
            type: 'like',
            postId: post.id,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (error: any) {
      console.error('Error toggling reaction:', error);
      // REVERT OR QUEUE IF OFFLINE
      if (!navigator.onLine) {
        const { offlineManager } = require('@/lib/offline-manager');
        offlineManager.add('like', { postId: post.id, type });
      } else {
        setUserReaction(oldReaction);
      }
    }
  };

  const handleCommentReaction = async (commentId: string, type: string, currentReaction: string | null, currentLikesCount: number = 0) => {
    if (!profile || !post.id) return;

    const commentRef = doc(db, 'comments', commentId);
    const likeRef = doc(db, 'likes', `${post.id}_${commentId}_${profile.uid}`);

    try {
      const updateData: any = {};
      if (currentLikesCount === undefined) updateData.likesCount = 0;

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
        setComments((current) =>
          current.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  likesCount: Math.max((comment.likesCount || 0) - 1, 0),
                  reactionCounts: {
                    ...(comment.reactionCounts || {}),
                    [type]: Math.max(((comment.reactionCounts || {})[type] || 0) - 1, 0),
                  },
                }
              : comment
          )
        );
      } else {
        // Add or change reaction
        await setDoc(likeRef, {
          postId: post.id,
          commentId: commentId,
          userId: profile.uid,
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
        setComments((current) =>
          current.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  likesCount: (comment.likesCount || 0) + (currentReaction ? 0 : 1),
                  reactionCounts: {
                    ...(comment.reactionCounts || {}),
                    ...(currentReaction ? { [currentReaction]: Math.max(((comment.reactionCounts || {})[currentReaction] || 0) - 1, 0) } : {}),
                    [type]: ((comment.reactionCounts || {})[type] || 0) + 1,
                  },
                }
              : comment
          )
        );
      }
    } catch (error: any) {
      console.error('Error toggling comment reaction:', error);
      alert(`Failed to react: ${error.message}`);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !post.id || !newComment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      await addDoc(collection(db, 'comments'), {
        postId: post.id,
        authorId: profile.uid,
        authorName: profile.displayName || 'User',
        authorPhoto: profile.photoURL || '',
        content: newComment.trim(),
        likesCount: 0,
        replyToId: replyingTo?.id || null,
        replyToName: replyingTo?.name || null,
        createdAt: serverTimestamp()
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
      if (post.authorId !== profile.uid) {
        void addDoc(collection(db, 'notifications'), {
          userId: post.authorId,
          actorId: profile.uid,
          actorName: profile.displayName,
          actorPhoto: profile.photoURL || '',
          type: 'comment',
          postId: post.id,
          read: false,
          createdAt: serverTimestamp()
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
    if (!profile || !post.communityId) return;

    const loadCommunityRole = async () => {
      const communityDoc = await getDoc(doc(db, 'communities', post.communityId));
      if (!communityDoc.exists()) return;

      const data = communityDoc.data();
      const userRole = data.roles?.[profile.uid] || 'member';
      setIsCommunityModerator(userRole === 'admin' || userRole === 'moderator' || data.creatorId === profile.uid);
    };

    void loadCommunityRole();
  }, [profile, post.communityId]);

  const handleDeletePost = async () => {
    if (!profile || !post.id) return;
    
    const isAuthor = post.authorId === profile.uid;
    const canDelete = isAuthor || isCommunityModerator;

    if (!canDelete) return;
    
    if (window.confirm(t('post_card.delete_confirm', 'Are you sure you want to delete this post?'))) {
      try {
        await deleteDoc(doc(db, 'posts', post.id));
      } catch (error: any) {
        console.error('Error deleting post:', error);
        alert(`${t('post_card.failed_to_delete', 'Failed to delete post:')} ${error.message}`);
      }
    }
  };

  const activePostReaction = useMemo(() => REACTIONS.find((r) => r.id === userReaction), [userReaction]);
  const displayContent = useMemo(
    () => stripRenderedHashtags(post.content || '', Array.isArray(post.hashtags) ? post.hashtags : []),
    [post.content, post.hashtags]
  );
  const sharedPost = post.sharedPostData || null;
  const sharedPostDisplayContent = useMemo(
    () => stripRenderedHashtags(sharedPost?.content || '', Array.isArray(sharedPost?.hashtags) ? sharedPost.hashtags : []),
    [sharedPost]
  );

  const getTopReactions = (reactionCounts: Record<string, number> | undefined) => {
    if (!reactionCounts) return [];
    return Object.entries(reactionCounts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => REACTIONS.find(r => r.id === id))
      .filter(Boolean);
  };

  const topPostReactions = useMemo(() => getTopReactions(localPost.reactionCounts), [localPost.reactionCounts]);

  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const [showReactionSelector, setShowReactionSelector] = useState(false);
  const reactionTimerRef = useRef<any>(null);

  const handleDoubleClick = () => {
    if (!userReaction) {
      handlePostReaction('like');
      setShowHeartOverlay(true);
      setTimeout(() => setShowHeartOverlay(false), 1000);
    }
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

  return (
    <div
      ref={viewRef} 
      className="bg-white rounded-[40px] shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-8 border border-slate-100 overflow-hidden transition-all duration-700 hover:shadow-[0_40px_100px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 group/card active:scale-[0.995] relative"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '800px' }}
    >
      {/* Dynamic Animated Border Glow */}
      <div className="absolute inset-0 border-2 border-transparent group-hover/card:border-primary/10 rounded-[40px] pointer-events-none transition-all duration-700" />
      
      {sharedPost && (
        <div className="px-8 py-4 bg-gradient-to-r from-primary/[0.04] via-transparent to-transparent border-b border-primary/5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] font-black text-primary/70 uppercase tracking-[0.3em]">
            <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center border border-primary/10">
              <Share2 className="w-4 h-4" />
            </div>
            <span>{t('post_card.reposted_context', 'Aura Perspective')}</span>
          </div>
          <div className="flex gap-1.5 px-3 py-1.5 bg-white/50 rounded-full border border-primary/5 shadow-sm">
             <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
             <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
          </div>
        </div>
      )}
      <div className="p-8 pb-5">
        <div className="flex justify-between items-start mb-6">
          <div className="flex gap-5 items-center">
            <Link 
              href={`/profile/${post.authorId}`} 
              className="relative w-16 h-16 rounded-[24px] bg-slate-100 overflow-hidden shrink-0 ring-4 ring-white shadow-2xl transition-all duration-700 group-hover/card:scale-105 group-hover/card:shadow-primary/10"
            >
              {post.authorPhoto ? (
                <img src={post.authorPhoto} alt={post.authorName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary/30 font-black text-2xl bg-gradient-to-br from-slate-100 to-slate-200">
                  {post.authorName?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </Link>
            <div className="flex flex-col">
              <Link href={`/profile/${post.authorId}`} className="group/name flex items-center gap-2 flex-wrap mb-1">
                <span className="font-ex-bold text-xl text-slate-900 tracking-tight leading-tight group-hover/name:text-primary transition-all duration-300">{post.authorName}</span>
                {isFresh && !post.isRepost && (
                  <span className="bg-blue-600/10 text-blue-600 text-[9px] font-black px-3 py-1 rounded-full flex items-center gap-2 uppercase tracking-[0.15em] border border-blue-600/20 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                    {t('post.new', 'Now')}
                  </span>
                )}
                {post.authorName === 'Philippe Boechat' && (
                  <div className="relative group/verify">
                    <CheckCircle className="w-5 h-5 text-indigo-500 fill-indigo-500/10" />
                  </div>
                )}
              </Link>
              <div className="flex items-center gap-3 text-[13px] text-slate-400 font-bold mt-1">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-xl border border-slate-100/50 hover:bg-slate-100 transition-colors cursor-pointer group/time">
                  <Clock size={14} className="opacity-50 group-hover/time:text-primary transition-colors" />
                  <TimeAgo date={date} />
                </div>
                {post.communityName && (
                  <>
                    <span className="opacity-20 text-lg font-light">•</span>
                    <Link href={`/communities/${post.communityId}`} className="hover:text-primary transition-all flex items-center gap-2 font-black uppercase tracking-widest text-[10px] bg-primary/5 px-3 py-1 rounded-xl border border-primary/10 hover:bg-primary/10">
                      <Users className="w-3.5 h-3.5" />
                      {post.communityName}
                    </Link>
                  </>
                )}
                <span className="opacity-20 text-lg font-light">•</span>
                <div className="flex items-center gap-1.5 opacity-50 bg-slate-50 p-1 rounded-lg">
                  {post.visibility === 'public' ? <Globe className="w-3.5 h-3.5" /> : post.visibility === 'friends' ? <Users className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-border/50 z-20 overflow-hidden py-1">
                  {(profile?.uid === post.authorId || isCommunityModerator) ? (
                    <button 
                      onClick={handleDeletePost}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> {t('post_card.delete', 'Delete Post')}
                    </button>
                  ) : null}
                  {profile && (
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
        
        {displayContent && (
          <p className="text-[17px] text-slate-800 mb-4 whitespace-pre-wrap leading-[1.6] font-medium tracking-tight px-1">
            {displayContent}
          </p>
        )}
        {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.hashtags.map((tag: string) => {
              const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;

              return (
                <Link
                  key={normalizedTag}
                  href={`/explore?q=${encodeURIComponent(normalizedTag)}`}
                  className="text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  {normalizedTag}
                </Link>
              );
            })}
          </div>
        )}
        
        {sharedPost && (
          <div className="mt-4 mx-0 rounded-[36px] border border-slate-100 bg-gradient-to-br from-slate-50/50 to-white p-8 group/shared transition-all hover:bg-white hover:border-primary/20 hover:shadow-[0_20px_60px_rgba(0,0,0,0.04)] cursor-pointer relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="flex items-center gap-4 mb-6 relative">
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
                <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-primary rounded-xl flex items-center justify-center text-white border-2 border-white shadow-lg">
                  <Repeat2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-ex-bold text-[16px] text-slate-900 group-hover/shared:text-primary transition-colors tracking-tight">
                    {sharedPost.authorName}
                  </span>
                  {sharedPost.isVerified && <CheckCircle className="w-4 h-4 text-blue-500 fill-blue-500/10" />}
                </div>
                <div className="flex items-center gap-2">
                   {sharedPost.communityName ? (
                     <div className="text-[10px] text-primary/60 font-black uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/5">
                       {sharedPost.communityName}
                     </div>
                   ) : (
                     <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60">
                       Original Aura Insight
                     </div>
                   )}
                   <span className="text-[10px] text-slate-300">•</span>
                   <span className="text-[10px] text-slate-400 font-bold"><TimeAgo date={sharedPost.createdAt?.toDate ? sharedPost.createdAt.toDate() : new Date()} /></span>
                </div>
              </div>
            </div>

            <div className="relative mb-6">
              {sharedPostDisplayContent && (
                <p className="text-[16px] text-slate-700 whitespace-pre-wrap leading-relaxed font-medium tracking-tight">
                  {sharedPostDisplayContent}
                </p>
              )}
            </div>

            {sharedPost.imageUrl && (
              <div className="mt-4 rounded-[28px] overflow-hidden border border-slate-100 shadow-2xl shadow-black/5 group-hover/shared:scale-[1.01] transition-transform duration-700">
                <img src={sharedPost.imageUrl} alt="Shared content" className="w-full max-h-[380px] object-cover" />
              </div>
            )}
            
            <Link 
              href={`/post/${sharedPost.id}`}
              className="mt-6 pt-5 border-t border-slate-50 flex items-center justify-between group/link"
            >
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 group-hover/link:text-primary transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/link:bg-primary transition-colors" />
                {t('post_card.view_full_thread', 'Explore thread history')}
              </span>
              <div className="flex -space-x-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-7 h-7 rounded-xl bg-slate-50 border-2 border-white shadow-xl flex items-center justify-center overflow-hidden">
                     <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200" />
                  </div>
                ))}
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

      <div className="px-8 py-5 bg-slate-50/30">
        <div className="flex justify-between items-center text-[12px] text-slate-400 pb-5 mb-4 border-b border-slate-100/60 font-black uppercase tracking-[0.1em]">
          <div className="flex items-center gap-2 group/likes cursor-pointer">
            {topPostReactions.length > 0 ? (
              <div className="flex -space-x-2">
                {topPostReactions.map((r, i) => (
                  <div key={r?.id} style={{ zIndex: 30 - i * 10 }} className={`w-6 h-6 rounded-lg ${r?.bgColor} flex items-center justify-center text-[12px] ring-2 ring-white shadow-sm relative group-hover/likes:scale-110 transition-transform`}>
                    {r?.icon}
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-2 ring-white">
                <Heart className="w-3 h-3 fill-current" />
              </div>
            )}
            <span className="group-hover/likes:text-primary transition-colors">{post.likesCount || 0} {t('post.reactions', 'Connections')}</span>
          </div>
          <div className="flex gap-5">
            <span 
              className="cursor-pointer hover:text-slate-600 transition-colors flex items-center gap-1.5"
              onClick={() => setShowComments(!showComments)}
            >
              <div className="w-1 h-1 rounded-full bg-slate-300" />
              {post.commentsCount || 0} {t('post.comments', 'Comments')}
            </span>
            <span className="cursor-pointer hover:text-slate-600 transition-colors flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-slate-300" />
              {post.sharesCount || 0} {t('post.shares', 'Shares')}
            </span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <div className="relative group/react">
              {/* Reaction Popover - Ultra Premium Design */}
              <div className="absolute bottom-full left-0 pb-4 hidden group-hover/react:block z-50 animate-in fade-in slide-in-from-bottom-3 duration-300">
                <div className="bg-white/90 backdrop-blur-xl border border-white shadow-2xl rounded-[24px] p-2 flex gap-1.5">
                  {REACTIONS.map(r => (
                    <button
                      key={r.id}
                      onClick={(e) => { e.stopPropagation(); handlePostReaction(r.id); }}
                      className="w-12 h-12 hover:scale-125 hover:-translate-y-2 transition-all duration-300 origin-bottom flex items-center justify-center text-3xl rounded-xl hover:bg-slate-50"
                      title={r.label}
                    >
                      {r.icon}
                    </button>
                  ))}
                </div>
              </div>
              
              <button 
                onClick={() => activePostReaction ? handlePostReaction(activePostReaction.id) : handlePostReaction('like')}
                className={`group flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all duration-300 ${
                  activePostReaction 
                    ? `${activePostReaction.color} ${activePostReaction.bgColor} shadow-sm shadow-primary/5 ring-1 ring-primary/10` 
                    : 'text-slate-500 hover:bg-white hover:text-primary hover:shadow-xl hover:shadow-primary/5 hover:ring-1 hover:ring-primary/5 bg-white shadow-sm border border-slate-100'
                }`}
              >
                {activePostReaction ? (
                  <span className="text-xl leading-none scale-110 group-active:scale-90 transition-transform">{activePostReaction.icon}</span>
                ) : (
                  <ThumbsUp className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
                {activePostReaction ? t(`reaction.${activePostReaction.id}`, activePostReaction.label) : t('post.like', 'Insight')}
              </button>
            </div>

            <button 
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white border border-slate-100 text-slate-500 hover:text-primary hover:shadow-xl hover:shadow-primary/5 hover:ring-1 hover:ring-primary/5 font-black text-[11px] uppercase tracking-widest transition-all duration-300 group"
            >
              <MessageCircle className="w-4 h-4 group-hover:scale-110 transition-transform" /> {t('post.comment', 'Clarify')}
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <button 
                onClick={handleShare}
                disabled={isSharing}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white border border-slate-100 text-slate-500 hover:text-primary hover:shadow-xl hover:shadow-primary/5 hover:ring-1 hover:ring-primary/5 font-black text-[11px] uppercase tracking-widest transition-all duration-300 group disabled:opacity-50"
              >
                <Share2 className="w-4 h-4 group-hover:rotate-12 transition-transform" /> {isSharing ? '...' : t('post.share', 'Expand')}
              </button>
              {showShareMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowShareMenu(false)}></div>
                  <div className="absolute right-0 bottom-full mb-4 w-64 rounded-3xl border border-white bg-white/90 backdrop-blur-xl shadow-2xl p-2.5 z-20 animate-in zoom-in-95 fade-in duration-300">
                    <button onClick={handleRepost} className="w-full text-left px-4 py-3 text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary/5 hover:text-primary transition-all flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center">
                        <Repeat2 className="w-4 h-4" />
                      </div>
                      {t('post_card.share_to_feed', 'Echo Insight')}
                    </button>
                    <button onClick={handleExternalShare} className="w-full text-left px-4 py-3 text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-all flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Send className="w-4 h-4" />
                      </div>
                      {t('post_card.share_externally', 'Broadcast Out')}
                    </button>
                    <button onClick={handleCopyShareLink} className="w-full text-left px-4 py-3 text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                        <Link2 className="w-4 h-4" />
                      </div>
                      {t('post_card.copy_link', 'Secure URL')}
                    </button>
                  </div>
                </>
              )}
            </div>
            <button 
              onClick={handleBookmark}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm border ${
                isBookmarked 
                  ? 'bg-amber-50 text-amber-500 border-amber-100 shadow-amber-100/20' 
                  : 'bg-white border-slate-100 text-slate-400 hover:text-amber-500 hover:border-amber-100 hover:shadow-xl hover:shadow-amber-100/10'
              }`}
            >
              <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current animate-bounce' : 'group-hover:scale-110 transition-transform'}`} />
            </button>
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
                        <div className="text-[14px] text-foreground mt-0.5">{comment.content}</div>
                        
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
                            <div className="bg-white border border-border/50 shadow-lg rounded-full px-1 py-0.5 flex gap-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                              {REACTIONS.map(r => (
                                <button
                                  key={r.id}
                                  onClick={(e) => { e.stopPropagation(); handleCommentReaction(comment.id, r.id, cReactionId, comment.likesCount); }}
                                  className="w-8 h-8 hover:scale-125 transition-transform origin-bottom flex items-center justify-center text-xl"
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
              <form onSubmit={handleCommentSubmit} className="flex-1 flex items-center bg-white rounded-full px-3 py-1 border border-border/50 focus-within:border-primary/30 shadow-sm transition-colors">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                  className="flex-1 bg-transparent text-[14px] focus:outline-none py-1.5"
                />
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
    </div>
  );
});
