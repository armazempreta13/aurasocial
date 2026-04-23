'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import { Image as ImageIcon, Video, Hash, X, Upload, Loader2, Globe, Users, ChevronDown, BarChart2, Plus, Minus, Bold, Italic, Quote, Smile } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firebase-errors';
import { UploadResult } from '@/lib/image-utils';
import { uploadMedia, MediaKind } from '@/lib/media-utils';
import { extractHashtags, rankTrendingHashtags } from '@/lib/hashtags';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { renderTextWithLinks } from '@/lib/mentions';
import { MentionSuggestions } from './MentionSuggestions';
import { HashtagSuggestions } from './HashtagSuggestions';
import { soundEffects } from '@/lib/sound-effects';
import { validateContent } from '@/lib/moderation/utils';
import { ActionModal } from './ActionModal';

export function CreatePost({
  communityId,
  communityName,
  communitySecurity,
  isCommunityStaff,
}: {
  communityId?: string;
  communityName?: string;
  communitySecurity?: any;
  isCommunityStaff?: boolean;
}) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const { profile } = useAppStore();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageMetadata, setImageMetadata] = useState<UploadResult | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoMetadata, setVideoMetadata] = useState<UploadResult | null>(null);
  const [showImageInput, setShowImageInput] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [youtubeVideo, setYoutubeVideo] = useState<{ videoId: string, watchUrl: string, embedUrl: string } | null>(null);
  const [uploadKind, setUploadKind] = useState<MediaKind>('image');
  const [isDragging, setIsDragging] = useState(false);
  const [mentionSearch, setMentionSearch] = useState<{ text: string, index: number } | null>(null);
  const [hashtagSearch, setHashtagSearch] = useState<{ text: string, index: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollExpiration, setPollExpiration] = useState(24); // hours
  const [mood, setMood] = useState<string | null>(null);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [showHashtagNudge, setShowHashtagNudge] = useState(false);
  const [isBypassingNudge, setIsBypassingNudge] = useState(false);
  const hashtags = useMemo(() => extractHashtags(content), [content]);

  // Show live preview when the text contains markdown markers
  const hasMarkdown = useMemo(() =>
    /\*\*|\*[^\s]|^> /m.test(content), [content]);

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

  // Insert markdown syntax at cursor position
  const insertFormat = useCallback((syntax: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    
    let targetStart = start;
    let targetEnd = end;
    let selected = content.substring(start, end);

    // Lógica Inteligente: Se nada estiver selecionado, pega a palavra sob o cursor
    if (start === end) {
      const textBefore = content.substring(0, start);
      const textAfter = content.substring(start);
      
      const lastSpaceBefore = textBefore.lastIndexOf(' ');
      const wordStart = lastSpaceBefore === -1 ? 0 : lastSpaceBefore + 1;
      
      const firstSpaceAfter = textAfter.search(/\s/);
      const wordEnd = firstSpaceAfter === -1 ? content.length : start + firstSpaceAfter;

      if (wordStart < wordEnd) {
        targetStart = wordStart;
        targetEnd = wordEnd;
        selected = content.substring(targetStart, targetEnd);
      }
    }

    const newText = content.substring(0, targetStart) + syntax + selected + syntax + content.substring(targetEnd);
    setContent(newText);
    
    setTimeout(() => {
      ta.focus();
      const newPos = targetEnd + syntax.length * 2;
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  }, [content]);

  const insertLineFormat = useCallback((prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lines = content.split('\n');
    let currentPos = 0;
    
    const lineIndex = lines.findIndex(line => {
      const lineEnd = currentPos + line.length;
      if (start >= currentPos && start <= lineEnd + 1) return true;
      currentPos = lineEnd + 1;
      return false;
    });

    if (lineIndex !== -1) {
      if (lines[lineIndex].startsWith(prefix)) {
        lines[lineIndex] = lines[lineIndex].substring(prefix.length);
      } else {
        lines[lineIndex] = prefix + lines[lineIndex];
      }
      setContent(lines.join('\n'));
    }
  }, [content]);


  const hashtagSuggestions = useMemo(() => {
    // Only suggest hashtags that already exist in recent posts (avoid suggesting "fantasy" topics).
    const cached = queryClient.getQueriesData({
      predicate: (q) => Array.isArray((q as any)?.queryKey) && (q as any).queryKey[0] === 'posts',
    });

    const recentPosts: any[] = [];
    for (const [, data] of cached) {
      const pages = (data as any)?.pages;
      if (!Array.isArray(pages)) continue;
      for (const page of pages) {
        const docs = page?.docs;
        if (!Array.isArray(docs)) continue;
        for (const d of docs) {
          const item = typeof d?.data === 'function' ? d.data() : d?.data ? d.data : d;
          if (item && typeof item === 'object') recentPosts.push(item);
          if (recentPosts.length >= 120) break;
        }
        if (recentPosts.length >= 120) break;
      }
      if (recentPosts.length >= 120) break;
    }

    const trending = rankTrendingHashtags(recentPosts).map((x) => x.tag);
    const allExisting = Array.from(
      new Set(
        recentPosts
          .flatMap((p: any) => (Array.isArray(p?.hashtags) ? p.hashtags : []))
          .map((t: string) => String(t || '').trim())
          .filter(Boolean)
          .map((t: string) => (t.startsWith('#') ? t : `#${t}`))
      )
    );

    const all = [...trending, ...allExisting]
      .filter((t) => t.startsWith('#'))
      .map((t) => t.toLowerCase())
      .filter((t) => !hashtags.map((h) => h.toLowerCase()).includes(t));

    return Array.from(new Set(all));
  }, [queryClient, hashtags]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setContent(value);

    // Auto-detect mood if not manually set and content is significant
    if (!mood && value.length > 8) {
      const lower = value.toLowerCase();
      if (lower.includes('feliz') || lower.includes('alegre') || lower.includes('top')) setMood('happy');
      else if (lower.includes('triste') || lower.includes('bad') || lower.includes('foda')) setMood('sad');
      else if (lower.includes('empolgado') || lower.includes('fogo') || lower.includes('bora')) setMood('excited');
      else if (lower.includes('pensando') || lower.includes('duvida') || lower.includes('queria')) setMood('thoughtful');
      else if (lower.includes('focado') || lower.includes('meta') || lower.includes('objetivo')) setMood('focused');
      else if (lower.includes('cansado') || lower.includes('sono') || lower.includes('exaurido')) setMood('tired');
      else if (lower.includes('paz') || lower.includes('zen') || lower.includes('tranquilo')) setMood('chill');
      else if (lower.includes('grato') || lower.includes('obrigado') || lower.includes('valeu')) setMood('grateful');
    }

    // Detect if we are typing a mention or hashtag (nearest trigger before cursor wins)
    const textBeforeCursor = value.substring(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    const lastHash = textBeforeCursor.lastIndexOf('#');
    
    const isMentionActive = lastAt !== -1 && (lastAt > lastHash);
    const isHashtagActive = lastHash !== -1 && (lastHash > lastAt);

    if (isMentionActive) {
      const textAfterAt = textBeforeCursor.substring(lastAt + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch({ text: textAfterAt, index: lastAt });
        setHashtagSearch(null);
        return;
      }
    }

    if (isHashtagActive) {
      const textAfterHash = textBeforeCursor.substring(lastHash + 1);
      if (!textAfterHash.includes(' ') && !textAfterHash.includes('\n')) {
        setHashtagSearch({ text: textAfterHash, index: lastHash });
        setMentionSearch(null);
        return;
      }
    }

    setMentionSearch(null);
    setHashtagSearch(null);
  };

  const handleSelectMention = (user: any) => {
    if (!mentionSearch || !textareaRef.current) return;
    
    const before = content.substring(0, mentionSearch.index);
    const after = content.substring(textareaRef.current.selectionStart);
    const newContent = `${before}@${user.username} ${after}`;
    
    setContent(newContent);
    setMentionSearch(null);
    
    // Set focus back to textarea
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursor = mentionSearch.index + user.username.length + 2;
      textareaRef.current?.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const handleSelectHashtag = (tag: string) => {
    if (!hashtagSearch || !textareaRef.current) return;

    const normalized = tag.startsWith('#') ? tag : `#${tag}`;
    const before = content.substring(0, hashtagSearch.index);
    const after = content.substring(textareaRef.current.selectionStart);
    const newContent = `${before}${normalized} ${after}`;

    setContent(newContent);
    setHashtagSearch(null);

    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursor = hashtagSearch.index + normalized.length + 1;
      textareaRef.current?.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const handleMediaUpload = async (file: File) => {
    if (!profile) return;
    
    setIsUploading(true);
    try {
      if (file.type.startsWith('video/')) {
        setUploadKind('video');
        
        // Frontend validation
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
          throw new Error('O vídeo é muito grande. O limite é de 100MB.');
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/youtube/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || errorData.error || 'Falha no upload para o YouTube');
        }

        const data = await response.json();
        setYoutubeVideo({
          videoId: data.videoId,
          watchUrl: data.watchUrl,
          embedUrl: data.embedUrl
        });
        setVideoUrl(data.watchUrl); // For preview purposes
        setVideoMetadata({
          kind: 'video',
          url: data.watchUrl,
          display_url: data.watchUrl,
          delete_url: '',
          width: 0,
          height: 0,
          mime: file.type,
          size: file.size,
        } as any);
        
        setImageUrl('');
        setImageMetadata(null);
      } else {
        setUploadKind('image');
        const result = await uploadMedia(file);
        setImageUrl(result.url);
        setImageMetadata(result);
        setVideoUrl('');
        setVideoMetadata(null);
        setYoutubeVideo(null);
      }
      setShowImageInput(false);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Upload falhou. Por favor, tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleMediaUpload(e.target.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleMediaUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    const hasPoll = showPoll && pollOptions.filter(o => o.trim()).length >= 2;
    if ((!content.trim() && !imageUrl.trim() && !videoUrl.trim() && !hasPoll) || !profile || isSubmitting || isUploading) return;
    
    setIsSubmitting(true);

    // 🛡️ MODERATION LAYER (Part 4)
    const modResult = validateContent(content, 'post');
    if (modResult.status === 'block') {
      alert('Seu conteúdo contém termos ou padrões não permitidos pela política da Aura.');
      setIsSubmitting(false);
      return;
    }

    // Gentle nudge: hashtags fuel "Assuntos do Momento" and discovery (no UI/layout changes)
    if (typeof window !== 'undefined' && hashtags.length === 0 && content.trim() && !isBypassingNudge) {
      try {
        const storageKey = 'aura_hashtag_nudge_v1';
        const alreadyNudged = window.localStorage.getItem(storageKey) === '1';
        if (!alreadyNudged) {
          setShowHashtagNudge(true);
          setIsSubmitting(false);
          return;
        }
      } catch {
        // ignore storage failures
      }
    }

    setIsBypassingNudge(false); // Reset bypass for next post

    // OPTIMISTIC UX LAYER (Instant appearance)
    // Use a real Firestore document id so interactions (likes/comments) never target a non-existent doc.
    // Important: enqueue the Firestore write before exposing the post in the UI to avoid "No document to update".
    const postRef = doc(collection(db, 'posts'));
    const tempId = postRef.id;

    const postRequiresApproval = !!(communityId && communitySecurity?.postRequiresApproval);
    const approvalStatus: 'approved' | 'pending' =
      communityId && postRequiresApproval && !isCommunityStaff ? 'pending' : 'approved';

    const optimisticPost = {
      id: tempId,
      authorId: profile.uid,
      authorName: profile.displayName || 'Anonymous',
      authorPhoto: profile.photoURL || '',
      authorUsername: profile.username || '',
      content: content.trim(),
      hashtags,
      imageUrl: imageUrl.trim() || null,
      hasImage: !!imageUrl.trim(),
      videoUrl: videoUrl.trim() || null,
      hasVideo: !!videoUrl.trim() || !!youtubeVideo,
      video: youtubeVideo ? {
        provider: "youtube",
        videoId: youtubeVideo.videoId,
        watchUrl: youtubeVideo.watchUrl,
        embedUrl: youtubeVideo.embedUrl,
        status: "ready"
      } : null,
      hasPoll: hasPoll,
      visibility: communityId ? 'public' : visibility,
      communityId: communityId || null,
      communityName: communityName || null,
      approvalStatus,
      approvedBy: null,
      approvedAt: null,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      score: 0,
      createdAt: Date.now(),
      _isOptimistic: true,
      mood: mood || null,
      poll: hasPoll ? {
        options: pollOptions.filter(o => o.trim()).map((text, i) => ({
          id: `opt_${i}`,
          text,
          votes: 0
        })),
        expiresAt: Date.now() + (pollExpiration * 60 * 60 * 1000),
        totalVotes: 0,
        voters: []
      } : null
    };

    // Remove local-only fields before sending to Firestore
    const { id: _unusedId, _isOptimistic: _unusedOptimistic, ...postData } = optimisticPost;

    // Enqueue the write immediately (do not await yet)
    const writePromise = setDoc(postRef, {
      ...postData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      approvalStatus,
      approvedBy: approvalStatus === 'approved' && isCommunityStaff ? profile.uid : null,
      approvedAt: approvalStatus === 'approved' && isCommunityStaff ? serverTimestamp() : null,
      moderation: {
        status: modResult.status,
        reasons: modResult.reasons,
        score: modResult.score.total,
        matchedRules: modResult.matchedRules
      }
    });

    // Clear mood after submit
    setMood(null);
    setShowMoodPicker(false);

    const shouldInjectIntoQueryKey = (queryKey: unknown) => {
      if (!Array.isArray(queryKey) || queryKey.length < 1) return false;
      if (queryKey[0] !== 'posts') return false;

      // Expected key shape: ['posts', userId, communityId, type, feedMode, searchQuery]
      const qUserId = queryKey[1];
      const qCommunityId = queryKey[2];
      const qType = queryKey[3];
      const qSearchQuery = queryKey[5];

      if (qType !== 'posts') return false;
      if ((qSearchQuery || '').toString().trim() !== '') return false;

      // Community post → only inject into that community feed
      if (communityId) {
        if (approvalStatus !== 'approved') return false;
        return qCommunityId === communityId;
      }

      // Profile/user feed for me (and global feeds)
      if (qUserId && qUserId !== profile.uid) return false;
      return qCommunityId == null;
    };

    const upsertOptimisticPost = (old: any) => {
      if (!old || !Array.isArray(old.pages)) return old;
      const pages = old.pages.map((page: any, idx: number) => {
        const docs = page?.docs;
        if (!Array.isArray(docs)) return page;
        if (idx !== 0) return page;
        if (docs.some((d: any) => d?.id === tempId)) return page;
        return { ...page, docs: [{ id: tempId, data: () => optimisticPost }, ...docs] };
      });
      return { ...old, pages };
    };

    // Update relevant feeds immediately
    queryClient.setQueriesData(
      { predicate: (q) => shouldInjectIntoQueryKey((q as any)?.queryKey) },
      upsertOptimisticPost
    );

    // 🚀 PRIORITY 7: IMMUTABLE FAST EXPERIENCE
    // Clear UI inputs immediately so user feels the post was "sent" instantly
    const savedContent = content; // Keep reference in case of error
    setContent('');
    setImageUrl('');
    setImageMetadata(null);
    setVideoUrl('');
    setVideoMetadata(null);
    setYoutubeVideo(null);
    setShowImageInput(false);
    setShowPoll(false);
    setPollOptions(['', '']);
    soundEffects.play('success');

    if (communityId && approvalStatus === 'pending') {
      alert(t('create_post.pending_approval', 'Seu post foi enviado e est\u00e1 aguardando aprova\u00e7\u00e3o do administrador.'));
    }

    try {
      // Wait for the write to be acknowledged in the background
      await writePromise;
      
      // Mark as non-optimistic in cache (id is already the real Firestore id)
      queryClient.setQueriesData(
        { predicate: (q) => shouldInjectIntoQueryKey((q as any)?.queryKey) },
        (old: any) => {
          if (!old || !Array.isArray(old.pages)) return old;
          const pages = old.pages.map((page: any) => {
            const docs = page?.docs;
            if (!Array.isArray(docs)) return page;
            return {
              ...page,
              docs: docs.map((d: any) =>
                d?.id === tempId
                  ? {
                      id: tempId,
                      data: () => ({
                        ...optimisticPost,
                        id: tempId,
                        _isOptimistic: false,
                        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                      }),
                    }
                  : d
              ),
            };
          });
          return { ...old, pages };
        }
      );
      
      // Sync finalize
      queryClient.invalidateQueries({ queryKey: ['posts'] });

      // BROADCAST SYNC (Part 6)
      if (typeof window !== 'undefined') {
        const syncChannel = new BroadcastChannel('aura_feed_sync');
        syncChannel.postMessage({ type: 'invalidate_posts' });
        syncChannel.close();
      }
    } catch (error) {
      // Revert cache on fail
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className={`relative bg-white rounded-[2rem] shadow-sm p-4 mb-6 border transition-all duration-300 ${isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-slate-100/60'}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          // Reset input so selecting the same file again still triggers onChange
          e.target.value = '';
          if (!file) return;
          // Vídeos também são suportados (upload via Firebase Storage).
          setShowImageInput(true);
          void handleMediaUpload(file);
        }}
      />
      {/* Top row: avatar + input */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0 shadow-sm border border-slate-200/50">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-primary/40 font-bold text-base bg-gradient-to-br from-slate-50 to-slate-200">
              {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </div>
        <div className="flex-1 bg-slate-50 rounded-3xl px-4 py-3 hover:bg-slate-100/80 transition-all cursor-text relative border border-slate-100/50">
          <textarea 
            ref={textareaRef}
            value={content}
            onChange={handleTextChange}
            placeholder={communityId ? `O que você está pensando para ${communityName}?` : profile?.displayName ? `No que você está pensando, ${profile.displayName.split(' ')[0]}?` : 'O que você está pensando?'}
            className="bg-transparent w-full focus:outline-none text-[14px] text-slate-700 placeholder:text-slate-400/80 font-medium resize-none leading-relaxed"
            rows={content ? Math.max(2, content.split('\n').length) : 1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                if (mentionSearch || hashtagSearch) return; 
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === 'Escape') {
                setMentionSearch(null);
                setHashtagSearch(null);
              }
            }}
          />
          {mentionSearch && (
            <MentionSuggestions 
              searchText={mentionSearch.text} 
              onSelect={handleSelectMention} 
              onClose={() => setMentionSearch(null)} 
            />
          )}
          {hashtagSearch && (
            <HashtagSuggestions
              searchText={hashtagSearch.text}
              suggestions={hashtagSuggestions}
              onSelect={handleSelectHashtag}
              onClose={() => setHashtagSearch(null)}
            />
          )}
        </div>
      </div>

      {/* Formatting Toolbar */}
      {content.length > 0 && (
        <div className="flex items-center gap-1 mb-2 pl-12">
          <button
            type="button"
            title="Negrito"
            onClick={() => insertFormat('**')}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Itálico"
            onClick={() => insertFormat('*')}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Citação"
            onClick={() => insertLineFormat('> ')}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          {mood && (
            <span className="ml-2 px-2 py-0.5 bg-primary/5 border border-primary/10 rounded-full text-[11px] font-bold text-primary flex items-center gap-1">
              {MOODS.find(m => m.id === mood)?.emoji} {MOODS.find(m => m.id === mood)?.label}
              <button type="button" onClick={() => setMood(null)} className="ml-1 hover:text-rose-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Mood Picker */}
      {showMoodPicker && (
        <div className="mb-3 pl-12">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Como você está se sentindo?</p>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setMood(m.id); setShowMoodPicker(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all hover:scale-105 active:scale-95 border ${
                    mood === m.id
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-primary/5 hover:border-primary/20'
                  }`}
                >
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live Markdown Preview */}
      {hasMarkdown && (
        <div className="mb-3 pl-12">
          <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Pré-visualização</p>
            <div className="text-[14px] text-slate-800 leading-relaxed">
              {renderTextWithLinks(content)}
            </div>
          </div>
        </div>
      )}

      {/* Media feedback (keeps layout/style consistent; only shows when uploading/selected) */}
      {isUploading && (
        <div className="flex items-center gap-2 mb-3 pl-12 text-slate-500 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          {uploadKind === 'video' ? 'Enviando vídeo...' : 'Enviando foto...'}
        </div>
      )}
      {(imageUrl || videoUrl) && !isUploading && (
        <div className="mb-3 pl-12">
          <div className="relative rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-white">
            {videoUrl ? (
              <video src={videoUrl} controls playsInline className="w-full max-h-[360px] object-cover" />
            ) : (
              <img src={imageUrl} alt="" className="w-full max-h-[360px] object-cover" />
            )}
            <button
              type="button"
              onClick={() => {
                setImageUrl('');
                setImageMetadata(null);
                setVideoUrl('');
                setVideoMetadata(null);
                setShowImageInput(false);
              }}
              className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-slate-700 transition-colors"
              title="Remover foto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Poll Builder */}
      {showPoll && (
        <div className="mb-4 pl-12">
          <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-bold text-slate-600 uppercase tracking-wider">Criar Enquete</span>
              <button 
                onClick={() => setShowPoll(false)}
                className="text-slate-400 hover:text-rose-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              {pollOptions.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input 
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...pollOptions];
                      newOptions[i] = e.target.value;
                      setPollOptions(newOptions);
                    }}
                    placeholder={`Opção ${i + 1}`}
                    className="flex-1 bg-white border border-slate-100 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  />
                  {pollOptions.length > 2 && (
                    <button 
                      onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-white rounded-lg transition-all"
                    >
                      <Minus size={16} />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 5 && (
                <button 
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  className="flex items-center gap-2 text-primary hover:text-primary/80 text-[13px] font-bold px-4 py-2 rounded-xl hover:bg-white transition-all w-full justify-center border border-dashed border-primary/20 mt-2"
                >
                  <Plus size={16} />
                  <span>Adicionar opção</span>
                </button>
              )}
            </div>
            <div className="mt-4 flex items-center gap-4 text-[12px] font-bold text-slate-500 border-t border-slate-100 pt-3">
              <span>Duração:</span>
              <select 
                value={pollExpiration} 
                onChange={(e) => setPollExpiration(Number(e.target.value))}
                className="bg-transparent focus:outline-none text-primary cursor-pointer"
              >
                <option value={1}>1 hora</option>
                <option value={24}>24 horas</option>
                <option value={72}>3 dias</option>
                <option value={168}>7 dias</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Hashtag tags */}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 pl-12">
          {hashtags.map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-full bg-primary/5 text-primary text-[11px] font-black uppercase tracking-wider border border-primary/10">
              #{tag.replace('#', '')}
            </span>
          ))}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-50/80">
        <div className="flex items-center gap-1">
          <button 
            type="button"
            onClick={() => {
              setShowImageInput(true);
              fileInputRef.current?.click();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold transition-all duration-300 hover:scale-105 active:scale-95 ${showImageInput || imageUrl || videoUrl ? 'text-primary bg-primary/10 shadow-sm shadow-primary/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            <ImageIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Foto/Vídeo</span>
          </button>

          <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all duration-300 hover:scale-105 active:scale-95">
            <Video className="w-4 h-4" />
            <span className="hidden sm:inline">Ao Vivo</span>
          </button>

          <button 
            type="button" 
            onClick={() => setShowPoll(!showPoll)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold transition-all duration-300 hover:scale-105 active:scale-95 ${showPoll ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            <BarChart2 className="w-4 h-4" />
            <span className="hidden sm:inline">Enquete</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMoodPicker(!showMoodPicker)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold transition-all duration-300 hover:scale-105 active:scale-95 ${
              mood ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Smile className="w-4 h-4" />
            <span className="hidden sm:inline">{mood ? MOODS.find(m => m.id === mood)?.emoji : 'Humor'}</span>
          </button>
        </div>

        <button 
          onClick={handleSubmit} 
          disabled={(!content.trim() && !imageUrl.trim() && !videoUrl.trim()) || isSubmitting || isUploading} 
          className="bg-primary text-white px-6 py-2 rounded-full font-black text-[12px] uppercase tracking-widest transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5"
        >
          {isSubmitting ? 'Publicando...' : 'Publicar'}
        </button>
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 bg-primary/10 backdrop-blur-[2px] rounded-2xl flex items-center justify-center pointer-events-none border-2 border-dashed border-primary animate-in fade-in duration-200">
          <div className="bg-white p-5 rounded-2xl shadow-lg flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Upload className="w-6 h-6 animate-bounce" />
            </div>
            <p className="text-base font-semibold text-slate-700">Drop to upload</p>
          </div>
        </div>
      )}

      <ActionModal
        isOpen={showHashtagNudge}
        onClose={() => setShowHashtagNudge(false)}
        onConfirm={() => {
          try {
            window.localStorage.setItem('aura_hashtag_nudge_v1', '1');
          } catch {}
          setIsBypassingNudge(true);
          setTimeout(() => handleSubmit(), 0);
        }}
        title="Dica de Engajamento"
        message="Sabia que adicionar 1–3 #hashtags ajuda seu post a entrar em 'Assuntos do Momento' e ser descoberto por mais pessoas?"
        confirmLabel="Publicar mesmo assim"
        cancelLabel="Vou adicionar hashtags"
        variant="info"
      />
    </div>
  );
}
