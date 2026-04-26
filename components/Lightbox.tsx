'use client';

import { X, Download, Share2, CheckCheck, Loader2, Send, Bookmark, ZoomIn, ZoomOut, MessageCircle, ThumbsUp, ChevronLeft, ChevronRight, Link2, Image as ImageIcon, Smile } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp, orderBy, getDocs } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import { renderTextWithLinks } from '@/lib/mentions';
import { validateContent } from '@/lib/moderation/utils';
import { createNotification } from '@/lib/notifications';
import { soundEffects } from '@/lib/sound-effects';
import { useTranslation } from 'react-i18next';
import { MentionSuggestions } from './MentionSuggestions';
import { TimeAgo } from './TimeAgo';
import { GifPicker } from './GifPicker';
import { uploadImage } from '@/lib/image-utils';
import Link from 'next/link';

const REACTIONS = [
  { id: 'like', icon: '👍', label: 'Curtir', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'love', icon: '❤️', label: 'Amei', color: 'text-red-500', bgColor: 'bg-red-500/10' },
  { id: 'funny', icon: '😂', label: 'Haha', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  { id: 'wow', icon: '😮', label: 'Uau', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'sad', icon: '😢', label: 'Triste', color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
  { id: 'angry', icon: '😡', label: 'Grrr', color: 'text-red-700', bgColor: 'bg-red-700/10' },
  { id: 'fire', icon: '🔥', label: 'Fogo', color: 'text-orange-600', bgColor: 'bg-orange-600/10' },
];

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrls: string[];
  initialIndex?: number;
  postId: string;
}

interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  imageUrl?: string | null;
  likesCount: number;
  reactionCounts: Record<string, number>;
  replyToId: string | null;
  replyToName: string | null;
  createdAt: any;
  moderation?: { status: string; reasons: string[]; score: number; matchedRules: string[] };
}

export function Lightbox({ isOpen, onClose, imageUrls = [], initialIndex = 0, postId }: LightboxProps) {
  const { t } = useTranslation('common');
  const { profile, user } = useAppStore();
  const authUid = user?.uid || null;

  const [postData, setPostData] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [mentionSearch, setMentionSearch] = useState<{ text: string; index: number } | null>(null);
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [commentReactions, setCommentReactions] = useState<Record<string, string>>({});
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success'>('idle');
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showBookmarkFeedback, setShowBookmarkFeedback] = useState(false);
  const [commentMedia, setCommentMedia] = useState<{ url: string; file?: File; kind: 'image' | 'gif' } | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(initialIndex);

  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsLoaded(false);
      setIsZoomed(false);
      setCommentMedia(null);
      setShowGifPicker(false);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !postId) return;
    const unsubscribe = onSnapshot(doc(db, 'posts', postId), (snap) => {
      if (snap.exists()) setPostData({ id: snap.id, ...snap.data() });
    }, (error) => console.warn('Post listener error:', error));
    return () => unsubscribe();
  }, [postId, isOpen]);

  useEffect(() => {
    if (!isOpen || !postId) return;
    const q = query(collection(db, 'comments'), where('postId', '==', postId), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Comment[]);
    }, (error) => console.warn('Comments listener error:', error));
    return () => unsubscribe();
  }, [postId, isOpen]);

  useEffect(() => {
    if (!isOpen || !authUid || !postId) { setUserReaction(null); return; }
    const q = query(collection(db, 'likes'), where('postId', '==', postId), where('userId', '==', authUid), where('commentId', '==', null));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUserReaction(snapshot.empty ? null : snapshot.docs[0].data().type);
    }, (error) => console.warn('User reaction listener error:', error));
    return () => unsubscribe();
  }, [authUid, postId, isOpen]);

  useEffect(() => {
    if (!isOpen || !authUid || !postId) { setCommentReactions({}); return; }
    const q = query(collection(db, 'likes'), where('postId', '==', postId), where('userId', '==', authUid), where('commentId', '!=', null));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reactions: Record<string, string> = {};
      snapshot.docs.forEach(doc => { const data = doc.data(); if (data.commentId) reactions[data.commentId] = data.type; });
      setCommentReactions(reactions);
    }, (error) => console.warn('Comment reactions listener error:', error));
    return () => unsubscribe();
  }, [authUid, postId, isOpen]);

  useEffect(() => {
    if (!isOpen || !authUid || !postId) { setIsBookmarked(false); return; }
    const q = query(collection(db, 'bookmarks'), where('postId', '==', postId), where('userId', '==', authUid));
    const loadBookmark = async () => {
      try { const snapshot = await getDocs(q); setIsBookmarked(!snapshot.empty); }
      catch (error) { console.warn('Bookmark load error:', error); }
    };
    void loadBookmark();
  }, [authUid, postId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const textarea = commentInputRef.current;
    if (textarea) { textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px'; }
  }, [isOpen, newComment]);

  const handlePostReaction = async (type: string) => {
    if (!authUid || !postId || !postData) return;
    const likeRef = doc(db, 'likes', `${postId}_${authUid}`);
    const postRef = doc(db, 'posts', postId);
    const oldReaction = userReaction;
    const isRemove = oldReaction === type;
    try {
      soundEffects.play('reaction');
      setUserReaction(isRemove ? null : type);
      const updateData: any = { updatedAt: serverTimestamp() };
      if (isRemove) {
        await deleteDoc(likeRef);
        updateData.likesCount = increment(-1);
        updateData[`reactionCounts.${type}`] = increment(-1);
        await updateDoc(postRef, updateData);
      } else {
        await setDoc(likeRef, {
          postId, commentId: null, userId: authUid,
          userName: profile?.displayName || user?.displayName || 'Aura User',
          userPhoto: profile?.photoURL || user?.photoURL || '', type, createdAt: serverTimestamp()
        });
        if (!oldReaction) updateData.likesCount = increment(1);
        else updateData[`reactionCounts.${oldReaction}`] = increment(-1);
        updateData[`reactionCounts.${type}`] = increment(1);
        await updateDoc(postRef, updateData);
        if (!oldReaction && postData.authorId !== authUid) {
          void createNotification({
            userId: postData.authorId, actorId: authUid,
            actorName: profile?.displayName || user?.displayName || 'User',
            actorPhoto: profile?.photoURL || user?.photoURL || '', type: 'like', postId,
          });
        }
      }
    } catch (error: any) { console.error('Error toggling post reaction:', error); setUserReaction(oldReaction); }
  };

  const handleCommentReaction = async (commentId: string, type: string, currentReaction: string | null) => {
    if (!authUid || !postId) return;
    const commentRef = doc(db, 'comments', commentId);
    const likeRef = doc(db, 'likes', `${postId}_${commentId}_${authUid}`);
    try {
      soundEffects.play('reaction');
      setCommentReactions(prev => ({ ...prev, [commentId]: (currentReaction === type ? null : type) as string }));
      const updateData: any = { updatedAt: serverTimestamp() };
      if (currentReaction === type) {
        await deleteDoc(likeRef);
        updateData.likesCount = increment(-1);
        updateData[`reactionCounts.${type}`] = increment(-1);
        await updateDoc(commentRef, updateData);
      } else {
        await setDoc(likeRef, { postId, commentId, userId: authUid, type, createdAt: serverTimestamp() });
        if (!currentReaction) updateData.likesCount = increment(1);
        else updateData[`reactionCounts.${currentReaction}`] = increment(-1);
        updateData[`reactionCounts.${type}`] = increment(1);
        if (Object.keys(updateData).length > 0) await updateDoc(commentRef, updateData);
      }
    } catch (error: any) { console.error('Error toggling comment reaction:', error); setCommentReactions(prev => ({ ...prev, [commentId]: currentReaction as string })); }
  };

  const handleCommentTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setNewComment(value);
    const textBeforeCursor = value.substring(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAt + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) { setMentionSearch({ text: textAfterAt, index: lastAt }); return; }
    }
    setMentionSearch(null);
  };

  const handleMentionSelect = (username: string) => {
    if (!mentionSearch || !commentInputRef.current) return;
    const { text, index } = mentionSearch;
    const newContent = newComment.substring(0, index + 1) + username + newComment.substring(index + 1 + text.length);
    setNewComment(newContent);
    setMentionSearch(null);
    commentInputRef.current.focus();
    commentInputRef.current.selectionStart = commentInputRef.current.selectionEnd = index + 1 + username.length;
  };

  const handleReplyClick = (comment: Comment) => {
    setReplyingTo({ id: comment.id, name: comment.authorName });
    commentInputRef.current?.focus();
  };

  const cancelReply = () => { setReplyingTo(null); setNewComment(''); };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUid || !postId || (!newComment.trim() && !commentMedia) || isSubmittingComment || !postData) return;
    setIsSubmittingComment(true);
    try {
      const modResult = validateContent(newComment, 'comment');
      if (modResult.status === 'block') { alert('Seu comentário contém conteúdo não permitido pela política da Aura.'); setIsSubmittingComment(false); return; }
      let uploadedImageUrl = commentMedia?.url || null;
      if (commentMedia?.kind === 'image' && commentMedia.file) {
        const uploadResult = await uploadImage(commentMedia.file);
        uploadedImageUrl = uploadResult.url;
      }
      const commentId = doc(collection(db, 'comments')).id;
      await setDoc(doc(db, 'comments', commentId), {
        id: commentId, postId, authorId: authUid, authorName: profile?.displayName || user?.displayName || 'User',
        authorPhoto: profile?.photoURL || user?.photoURL || '', content: newComment.trim(), imageUrl: uploadedImageUrl,
        likesCount: 0, reactionCounts: {}, replyToId: replyingTo?.id || null, replyToName: replyingTo?.name || null,
        createdAt: serverTimestamp(),
        moderation: { status: modResult.status, reasons: modResult.reasons, score: modResult.score.total, matchedRules: modResult.matchedRules }
      });
      await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) });
      setNewComment(''); setReplyingTo(null); setCommentMedia(null); setShowGifPicker(false);
      if (commentInputRef.current) commentInputRef.current.style.height = 'auto';
      if (postData.authorId !== authUid) {
        void createNotification({
          userId: postData.authorId, actorId: authUid, actorName: profile?.displayName || user?.displayName || 'User',
          actorPhoto: profile?.photoURL || user?.photoURL || '', type: 'comment', postId,
          extraText: newComment.trim().slice(0, 80) || 'Anexou uma imagem',
        });
      }
    } catch (error: any) { console.error('Error adding comment:', error); }
    finally { setIsSubmittingComment(false); }
  };

  const handleExternalShare = async () => {
    if (!postId || !postData) return;
    try {
      const shareUrl = `${window.location.origin}/post/${postId}`;
      const shareText = postData.content?.trim() || t('post_card.check_out', 'Confira este post no Aura.');
      if (navigator.share) {
        await navigator.share({ title: `${postData.authorName} on Aura`, text: shareText, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, { sharesCount: increment(1), updatedAt: serverTimestamp() });
      setCopyStatus('success');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) { console.error('Error sharing post:', error); }
  };

  const handleBookmark = async () => {
    if (!authUid || !postId || !postData) return;
    const bookmarkRef = doc(db, 'bookmarks', `${postId}_${authUid}`);
    try {
      if (isBookmarked) {
        await deleteDoc(bookmarkRef);
        setIsBookmarked(false);
      } else {
        await setDoc(bookmarkRef, {
          postId, userId: authUid, createdAt: serverTimestamp(),
          postData: {
            content: postData.content || '', imageUrl: imageUrls?.[0] || null, authorName: postData.authorName,
            authorPhoto: postData.authorPhoto || '', authorId: postData.authorId, createdAt: postData.createdAt,
          },
        });
        setIsBookmarked(true); setShowBookmarkFeedback(true);
        setTimeout(() => setShowBookmarkFeedback(false), 1500);
      }
    } catch (error) { console.error('Error toggling bookmark:', error); }
  };

  const handleDownloadImage = async () => {
    const imageUrl = imageUrls?.[currentImageIndex];
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aura-${postId || 'image'}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) { console.error('Error downloading image:', error); }
  };

  if (!isOpen) return null;
  if (!postData) return (
    <div className="fixed inset-0 z-[200] bg-background/80 backdrop-blur-md flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const parseCount = (val: any) => { const n = Number(val); return isNaN(n) ? 0 : Math.max(0, n); };
  const likesCount = parseCount(postData?.likesCount);
  const commentsCount = parseCount(postData?.commentsCount);
  const displayContent = postData.content || '';
  const currentImageUrl = imageUrls?.[currentImageIndex] || imageUrls?.[0] || '';

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <Dialog.Portal>
        <AnimatePresence>
          {isOpen && (
            <>
              <Dialog.Overlay asChild>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-background/80 backdrop-blur-md" />
              </Dialog.Overlay>
              <Dialog.Content asChild>
                <motion.div initial={{ scale: 0.985, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.985, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} className="fixed inset-0 z-[210] p-3 sm:p-6 flex items-stretch sm:items-center sm:justify-center">
                  <div className="relative w-full h-full sm:h-[min(820px,calc(100vh-3rem))] sm:w-[min(1240px,calc(100vw-3rem))] bg-background text-foreground overflow-hidden sm:rounded-2xl shadow-2xl border border-border flex flex-col lg:flex-row">
                    <Dialog.Title className="sr-only">Visualizar postagem</Dialog.Title>
                    <Dialog.Description className="sr-only">Modal para visualizar a imagem, reações e comentários.</Dialog.Description>
                    <div className="min-h-0 flex-1 flex flex-col lg:flex-row">
                      <div className="relative flex-1 bg-muted/10 p-4 sm:p-5 flex flex-col">
                        <div className="relative flex-1 w-full rounded-2xl bg-black/5 shadow-sm ring-1 ring-black/5 overflow-hidden flex items-center justify-center">
                          <div className="absolute top-3 right-3 z-[30] flex items-center gap-2">
                            <button onClick={() => setIsZoomed(!isZoomed)} className="h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 shadow-sm flex items-center justify-center text-white transition-colors" title={isZoomed ? 'Reduzir zoom' : 'Ampliar zoom'}>
                              {isZoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
                            </button>
                            <button onClick={handleDownloadImage} className="h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 shadow-sm flex items-center justify-center text-white transition-colors" title="Baixar imagem">
                              <Download className="h-4 w-4" />
                            </button>
                            <button onClick={onClose} className="h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 shadow-sm flex items-center justify-center text-white transition-colors" title="Fechar">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {imageUrls.length > 1 && (
                            <>
                              <button type="button" disabled={currentImageIndex === 0} onClick={() => { setIsLoaded(false); setCurrentImageIndex(currentImageIndex - 1); }} className="absolute left-3 top-1/2 -translate-y-1/2 z-[30] h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-30 disabled:hover:bg-black/40 backdrop-blur-md border border-white/10 shadow-sm flex items-center justify-center text-white transition-colors">
                                <ChevronLeft className="h-5 w-5" />
                              </button>
                              <button type="button" disabled={currentImageIndex === imageUrls.length - 1} onClick={() => { setIsLoaded(false); setCurrentImageIndex(currentImageIndex + 1); }} className="absolute right-3 top-1/2 -translate-y-1/2 z-[30] h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-30 disabled:hover:bg-black/40 backdrop-blur-md border border-white/10 shadow-sm flex items-center justify-center text-white transition-colors">
                                <ChevronRight className="h-5 w-5" />
                              </button>
                              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[30] flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                                {imageUrls.map((_, i) => <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`} />)}
                              </div>
                            </>
                          )}
                          <div className={`relative h-full w-full flex items-center justify-center ${isZoomed ? 'overflow-auto' : 'overflow-hidden'}`}>
                            <motion.img key={currentImageUrl} initial={{ scale: 0.985, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.18, ease: 'easeOut' }} src={currentImageUrl} alt={`Imagem do post ${currentImageIndex + 1}`} className={isZoomed ? 'max-w-none max-h-none object-none cursor-zoom-out' : 'max-w-full max-h-full object-contain cursor-zoom-in'} onClick={() => setIsZoomed((v) => !v)} onLoad={() => setIsLoaded(true)} />
                          </div>
                          {!isLoaded && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-[25]">
                              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="w-full lg:w-[420px] bg-background h-full flex flex-col overflow-hidden text-foreground border-t lg:border-t-0 lg:border-l border-border">
                        <div className="px-5 pt-5 pb-3 border-b border-border/60 flex items-start justify-between bg-background">
                          <div className="flex items-center gap-3">
                            <Link href={`/u/${postData.authorId}`}>
                              <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
                                {postData.authorPhoto ? (
                                  <img src={postData.authorPhoto} alt={postData.authorName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-bold">{postData.authorName?.charAt(0).toUpperCase()}</div>
                                )}
                              </div>
                            </Link>
                            <div>
                              <Link href={`/u/${postData.authorId}`} className="font-bold text-foreground leading-tight hover:underline">{postData.authorName}</Link>
                              <div className="text-[12px] text-muted-foreground"><TimeAgo date={postData.createdAt?.toDate ? postData.createdAt.toDate() : new Date()} /></div>
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden">
                          <div className="border-b border-border shrink-0 bg-background relative z-20">
                            {displayContent && (
                              <div className="px-4 pt-4 pb-1 max-h-[30vh] overflow-y-auto custom-scrollbar">
                                <div className="text-[15px] text-foreground whitespace-pre-wrap leading-relaxed">{renderTextWithLinks(displayContent)}</div>
                              </div>
                            )}
                            <div className="p-4 pt-3">
                              <div className="flex items-center justify-between gap-2 text-muted-foreground text-[13px] mb-3">
                                <div className="relative group/reaction">
                                  <button onClick={() => handlePostReaction(userReaction || 'like')} className={`flex items-center gap-2 rounded-md px-2 py-1 transition-colors ${userReaction ? 'text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                                    {userReaction ? <span className="text-base">{REACTIONS.find(r => r.id === userReaction)?.icon || '👍'}</span> : <ThumbsUp className="h-4 w-4" />}
                                    <span className="hidden sm:inline">{REACTIONS.find(r => r.id === userReaction)?.label || 'Curtir'}</span>
                                  </button>
                                  <div className="absolute bottom-full left-0 mb-2 opacity-0 invisible group-hover/reaction:opacity-100 group-hover/reaction:visible transition-all duration-200 z-[60] w-max">
                                    <div className="bg-background border border-border shadow-xl rounded-full px-3 py-2 flex items-center gap-2">
                                      {REACTIONS.map((reaction) => (
                                        <button key={reaction.id} onClick={(e) => { e.stopPropagation(); handlePostReaction(reaction.id); }} className="hover:scale-125 transition-transform origin-bottom text-xl" title={reaction.label} type="button">
                                          {reaction.icon}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <button onClick={() => commentInputRef.current?.focus()} className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
                                  <MessageCircle className="h-4 w-4" />
                                  <span className="hidden sm:inline">Comentar</span>
                                </button>
                                <div className="relative">
                                  <button onClick={handleExternalShare} className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
                                    {copyStatus === 'success' ? <CheckCheck className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
                                    <span className="hidden sm:inline">{copyStatus === 'success' ? 'Link copiado' : 'Compartilhar'}</span>
                                  </button>
                                </div>
                                <div className="relative">
                                  <button onClick={handleBookmark} className={`flex items-center gap-2 rounded-md px-2 py-1 transition-colors ${isBookmarked ? 'text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                                    <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
                                    <span className="hidden sm:inline">Salvar</span>
                                  </button>
                                  {showBookmarkFeedback && (
                                    <span className="absolute -top-8 right-0 text-[11px] bg-foreground text-background shadow-lg rounded-md px-2 py-1 whitespace-nowrap z-[100] animate-in zoom-in duration-200">Salvo</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                                <span><span className="text-foreground font-semibold">{likesCount}</span> curtidas</span>
                                <span><span className="text-foreground font-semibold">{commentsCount}</span> comentários</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar border-b border-border">
                            {comments.length === 0 ? (
                              <p className="text-muted-foreground text-sm text-center py-4">{t('post_card.no_comments_yet', 'Ainda não há comentários. Seja o primeiro a comentar!')}</p>
                            ) : (
                              comments.filter((c) => !c.replyToId).map((comment) => (
                                <div key={comment.id} className="mb-1">
                                  <CommentItemComp comment={comment} authUid={authUid} profile={profile} user={user} onReaction={handleCommentReaction} userReaction={commentReactions[comment.id] || null} onReply={handleReplyClick} />
                                  {comments.filter((c) => c.replyToId === comment.id).length > 0 && (
                                    <div className="ml-10 mt-2 pl-3 border-l-2 border-border/60 flex flex-col gap-1">
                                      {comments.filter((c) => c.replyToId === comment.id).map((reply) => (
                                        <CommentItemComp key={reply.id} comment={reply} authUid={authUid} profile={profile} user={user} onReaction={handleCommentReaction} userReaction={commentReactions[reply.id] || null} onReply={handleReplyClick} isReply={true} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                          <div className="p-4 bg-background shrink-0 border-t border-border">
                            <AnimatePresence>
                              {commentMedia && (
                                <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} className="mb-3 relative max-w-xs ml-10">
                                  <div className="relative inline-block border border-border rounded-xl overflow-hidden bg-black/5">
                                    <img src={commentMedia.url} alt="Anexo" className="max-h-32 object-contain" />
                                    <button type="button" onClick={() => { if (commentMedia?.kind === 'image' && commentMedia.url) URL.revokeObjectURL(commentMedia.url); setCommentMedia(null); }} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-colors">
                                      <X size={14} />
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            <form onSubmit={handleCommentSubmit} className="flex gap-2 relative">
                              <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0 mt-1">
                                {profile?.photoURL ? (
                                  <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-8 flex items-center justify-center text-muted-foreground text-xs font-bold">{profile?.displayName?.charAt(0).toUpperCase() || user?.displayName?.charAt(0).toUpperCase()}</div>
                                )}
                              </div>
                              <div className="flex-1 relative">
                                <div className="relative flex items-end bg-muted rounded-2xl border border-transparent focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/20 transition-all overflow-visible">
                                  <textarea ref={commentInputRef} value={newComment} onChange={handleCommentTextChange} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommentSubmit(e as unknown as React.FormEvent); } }} placeholder={replyingTo ? t('post_card.replying_to', { name: replyingTo.name }) : t('post_card.write_a_comment', 'Escreva um comentário...')} className="w-full bg-transparent pl-4 pr-[100px] py-3 text-[14px] text-foreground placeholder:text-muted-foreground outline-none resize-none min-h-[44px] max-h-28 custom-scrollbar leading-relaxed" rows={1} maxLength={500} disabled={isSubmittingComment} />
                                  <div className="absolute right-1 bottom-1 flex items-center gap-1">
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Adicionar imagem">
                                      <ImageIcon size={18} />
                                    </button>
                                    <button type="button" onClick={() => setShowGifPicker(!showGifPicker)} className="h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Adicionar GIF">
                                      <Smile size={18} />
                                    </button>
                                    <button type="submit" disabled={(!newComment.trim() && !commentMedia) || isSubmittingComment} className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-primary-foreground transition-colors shadow-sm ml-1" title="Enviar">
                                      {isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -ml-0.5" />}
                                    </button>
                                  </div>
                                </div>
                                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) { alert('Apenas imagens são permitidas'); return; } if (file.size > 10 * 1024 * 1024) { alert('A imagem deve ter no máximo 10MB'); return; } const url = URL.createObjectURL(file); setCommentMedia({ url, file, kind: 'image' }); }} />
                                {showGifPicker && (
                                  <div className="absolute bottom-[110%] right-0 mb-2 z-50 animate-in fade-in slide-in-from-bottom-2">
                                    <GifPicker variant="dark" onSelect={(url: string) => { setCommentMedia({ url, kind: 'gif' }); setShowGifPicker(false); }} onClose={() => setShowGifPicker(false)} />
                                  </div>
                                )}
                                {replyingTo && (
                                  <div className="absolute -top-7 left-0 text-xs text-muted-foreground bg-background px-2.5 py-1 rounded-md border border-border shadow-sm flex items-center gap-1.5 whitespace-nowrap z-10 animate-in fade-in slide-in-from-bottom-1">
                                    {t('post_card.replying_to', { name: replyingTo.name })}
                                    <button onClick={cancelReply} className="text-muted-foreground hover:text-foreground bg-muted/50 rounded-full p-0.5" type="button">
                                      <X size={12} />
                                    </button>
                                  </div>
                                )}
                                {mentionSearch && authUid && (
                                  <MentionSuggestions search={mentionSearch.text} onSelect={handleMentionSelect} onClose={() => {}} topOffset={-60} />
                                )}
                              </div>
                            </form>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CommentItemComp({ comment, authUid, profile, user, onReaction, userReaction, onReply, isReply = false }: { comment: Comment; authUid: string | null; profile: any; user: any; onReaction: (commentId: string, type: string, currentReaction: string | null) => Promise<void>; userReaction: string | null; onReply: (comment: Comment) => void; isReply?: boolean; }) {
  const { t } = useTranslation('common');
  const commentAuthorPhoto = comment.authorPhoto || '';
  const commentAuthorName = comment.authorName || 'Anônimo';
  const commentLikesCount = isNaN(Number(comment.likesCount)) ? 0 : Math.max(0, Number(comment.likesCount));
  const activeCommentReaction = REACTIONS.find((r) => r.id === userReaction);
  return (
    <div className={`flex gap-2 ${isReply ? 'mb-2' : 'mb-4'}`}>
      <Link href={`/u/${comment.authorId}`}>
        <div className={`${isReply ? 'w-6 h-6' : 'w-8 h-8'} rounded-full bg-gray-200 overflow-hidden shrink-0`}>
          {commentAuthorPhoto ? <img src={commentAuthorPhoto} alt={commentAuthorName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px] font-bold">{commentAuthorName.charAt(0).toUpperCase()}</div>}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <div className={`bg-muted rounded-xl px-3 py-2 break-words flex flex-col gap-1.5 ${isReply ? 'text-[13px]' : 'text-sm'}`}>
          <div>
            <Link href={`/u/${comment.authorId}`} className="font-bold text-foreground hover:underline mr-1">{commentAuthorName}</Link>
            {!isReply && comment.replyToName && comment.replyToId && <Link href={`/u/${comment.replyToId}`} className="text-primary hover:underline mr-1">@{comment.replyToName}</Link>}
            <span className="inline">{renderTextWithLinks(comment.content)}</span>
          </div>
          {comment.imageUrl && <div className="mt-1 rounded-lg overflow-hidden border border-border/50 max-w-[240px]"><img src={comment.imageUrl} alt="Anexo do comentário" className="w-full h-auto object-cover max-h-48" /></div>}
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
            <TimeAgo date={comment.createdAt?.toDate ? comment.createdAt.toDate() : new Date()} />
            {!isReply && <button onClick={() => onReply(comment)} className="font-semibold hover:text-foreground transition-colors">{t('post_card.reply', 'Responder')}</button>}
            {authUid && (
              <div className="relative group/comment-reaction">
                <button onClick={() => onReaction(comment.id, activeCommentReaction ? activeCommentReaction.id : 'like', userReaction)} className={`font-semibold transition-colors ${activeCommentReaction ? activeCommentReaction.color : 'hover:text-foreground'}`}>
                  {activeCommentReaction ? activeCommentReaction.label : 'Curtir'}
                </button>
                <div className="absolute bottom-full left-0 mb-1 opacity-0 invisible group-hover/comment-reaction:opacity-100 group-hover/comment-reaction:visible transition-all duration-200 z-[60]">
                  <div className="bg-background border border-border shadow-xl rounded-full px-2 py-1.5 flex items-center gap-1">
                    {REACTIONS.map((reaction) => (
                      <button key={reaction.id} onClick={(e) => { e.stopPropagation(); onReaction(comment.id, reaction.id, userReaction); }} className="hover:scale-125 transition-transform origin-bottom text-lg" title={reaction.label} type="button">
                        {reaction.icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {commentLikesCount > 0 && <span className="flex items-center gap-1 ml-auto">{activeCommentReaction?.icon || '👍'} {commentLikesCount}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}