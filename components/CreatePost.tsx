'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Smile, X, BarChart3, Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { useAppStore } from '@/lib/store';
import { db } from '@/firebase';
import { extractHashtags } from '@/lib/hashtags';
import { validateContent } from '@/lib/moderation/utils';
import { uploadImage } from '@/lib/image-utils';

import { MentionSuggestions } from './MentionSuggestions';
import { HashtagSuggestions } from './HashtagSuggestions';

type CreatePostProps = {
  communityId?: string;
  communityName?: string;
  communitySecurity?: any;
  isCommunityStaff?: boolean;
};

const DEFAULT_TAG_SUGGESTIONS = ['vida', 'inspiração', 'tecnologia', 'fotografia', 'desenvolvimento'];

// ─────────────────────────────────────────────────────────────────────────────
// Emoji Picker (simple native grid)
// ─────────────────────────────────────────────────────────────────────────────
const EMOJI_LIST = [
  '😀','😂','🥲','😍','🤩','😎','🥳','🤔','😮','😢','😡','🥺',
  '👍','👎','❤️','🔥','✨','🎉','💯','💪','🙏','👏','🫶','🤝',
  '😊','🤗','😴','🤯','🫠','🥴','😏','🤭','🫡','😇','🤓','🫢',
  '🌟','⚡','🎯','🚀','💡','🎨','🌈','🌊','🍀','🌸','💎','👑',
];

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-full right-0 mb-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-3 w-[240px]">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Emojis</span>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="text-xl hover:scale-125 transition-transform rounded p-0.5"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GIF Picker (Giphy via public beta key / Tenor fallback)
// ─────────────────────────────────────────────────────────────────────────────
const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || 'dc6zaTOxFJmzC'; // public demo key

function GifPicker({ onSelect, onClose }: { onSelect: (url: string, previewUrl: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<any>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const endpoint = q.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=16&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=16&rating=g`;
      const res = await fetch(endpoint);
      const data = await res.json();
      setGifs(data.data || []);
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search('');
  }, [search]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  return (
    <div className="absolute bottom-full right-0 mb-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 w-[280px]">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">GIF</span>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="px-3 pb-2">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Buscar GIFs..."
          autoFocus
          className="w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] outline-none placeholder:text-slate-300 focus:border-primary/40"
        />
      </div>
      <div className="grid grid-cols-2 gap-1 px-3 pb-3 max-h-[220px] overflow-y-auto">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-lg bg-slate-100 animate-pulse" />
          ))
        ) : gifs.length === 0 ? (
          <p className="col-span-2 text-center text-[12px] text-slate-400 py-4">Nenhum GIF encontrado</p>
        ) : (
          gifs.map((gif: any) => {
            const preview = gif.images?.fixed_width_small?.url || gif.images?.preview_gif?.url;
            const full = gif.images?.downsized?.url || gif.images?.fixed_width?.url;
            return (
              <button
                key={gif.id}
                onClick={() => onSelect(full, preview)}
                className="overflow-hidden rounded-lg hover:opacity-90 transition-opacity"
              >
                <img src={preview} alt={gif.title} className="w-full object-cover" loading="lazy" />
              </button>
            );
          })
        )}
      </div>
      <p className="text-center text-[9px] text-slate-300 pb-2">Powered by GIPHY</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Poll Editor
// ─────────────────────────────────────────────────────────────────────────────
function PollEditor({
  options,
  onChange,
  onRemove,
}: {
  options: string[];
  onChange: (idx: number, val: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-black text-primary uppercase tracking-widest">Enquete</span>
        <button onClick={onRemove} className="text-slate-400 hover:text-rose-500 transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {options.map((opt, idx) => (
          <input
            key={idx}
            type="text"
            value={opt}
            onChange={(e) => onChange(idx, e.target.value)}
            placeholder={`Opção ${idx + 1}`}
            className="w-full rounded-xl border border-primary/20 bg-white px-3 py-1.5 text-[13px] outline-none placeholder:text-slate-300 focus:border-primary/50"
          />
        ))}
        {options.length < 4 && (
          <button
            onClick={() => onChange(options.length, '')}
            className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary/70 transition-colors"
          >
            <Plus size={12} /> Adicionar opção
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export function CreatePost({
  communityId,
  communityName,
  communitySecurity,
  isCommunityStaff,
}: CreatePostProps) {
  const queryClient = useQueryClient();
  const { profile } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionSearch, setMentionSearch] = useState<{ text: string; index: number } | null>(null);
  const [hashtagSearch, setHashtagSearch] = useState<{ text: string; index: number } | null>(null);

  // Image attachment
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // GIF attachment
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifPreviewUrl, setGifPreviewUrl] = useState<string | null>(null);

  // Toolbar popovers
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);

  // Poll
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);

  const hashtags = useMemo(() => extractHashtags(content), [content]);

  // Close popovers when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
        setShowGif(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setContent(value);

    const textBeforeCursor = value.substring(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    const lastHash = textBeforeCursor.lastIndexOf('#');

    const isMentionActive = lastAt !== -1 && lastAt > lastHash;
    const isHashtagActive = lastHash !== -1 && lastHash > lastAt;

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
    setContent(`${before}@${user.username} ${after}`);
    setMentionSearch(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSelectHashtag = (tag: string) => {
    if (!hashtagSearch || !textareaRef.current) return;
    const normalized = tag.startsWith('#') ? tag : `#${tag}`;
    const before = content.substring(0, hashtagSearch.index);
    const after = content.substring(textareaRef.current.selectionStart);
    setContent(`${before}${normalized} ${after}`);
    setHashtagSearch(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // ── Image button ────────────────────────────────────────────────────────────
  const handleImageClick = () => {
    setShowEmoji(false);
    setShowGif(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setGifUrl(null);
    setGifPreviewUrl(null);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // ── GIF selection ───────────────────────────────────────────────────────────
  const handleGifSelect = (url: string, previewUrl: string) => {
    setGifUrl(url);
    setGifPreviewUrl(previewUrl);
    setImageFile(null);
    setImagePreview(null);
    setShowGif(false);
  };

  const removeGif = () => {
    setGifUrl(null);
    setGifPreviewUrl(null);
  };

  // ── Emoji insertion ─────────────────────────────────────────────────────────
  const handleEmojiSelect = (emoji: string) => {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newContent = content.substring(0, start) + emoji + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        el.setSelectionRange(start + emoji.length, start + emoji.length);
        el.focus();
      }, 0);
    } else {
      setContent((c) => c + emoji);
    }
    setShowEmoji(false);
  };

  // ── Poll options ─────────────────────────────────────────────────────────────
  const handlePollOptionChange = (idx: number, val: string) => {
    if (idx >= pollOptions.length) {
      setPollOptions((prev) => [...prev, val]);
    } else {
      setPollOptions((prev) => prev.map((o, i) => (i === idx ? val : o)));
    }
  };

  const hasAttachment = !!(imagePreview || gifUrl);
  const canPost = Boolean(profile?.uid) && (Boolean(content.trim()) || hasAttachment) && !isSubmitting;

  const autosize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(120, Math.max(44, el.scrollHeight));
    el.style.height = `${next}px`;
  };

  const handleSubmit = async () => {
    if (!profile?.uid) return;
    const trimmed = content.trim();
    if (!trimmed && !hasAttachment) return;
    if (isSubmitting) return;

    if (trimmed) {
      const moderation = validateContent(trimmed, 'post');
      if (moderation.status === 'block') return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl: string | null = null;

      if (imageFile) {
        setIsUploadingImage(true);
        try {
          const result = await uploadImage(imageFile);
          imageUrl = result.url;
        } finally {
          setIsUploadingImage(false);
        }
      } else if (gifUrl) {
        imageUrl = gifUrl;
      }

      const validPollOptions = pollOptions.filter((o) => o.trim());
      const poll = showPoll && validPollOptions.length >= 2
        ? { options: validPollOptions.map((text) => ({ text, votes: 0 })), totalVotes: 0 }
        : null;

      await addDoc(collection(db, 'posts'), {
        authorId: profile.uid,
        authorName: profile.displayName || 'User',
        authorUsername: profile.username || '',
        authorPhoto: profile.photoURL || '',
        content: trimmed || '',
        hashtags,
        communityId: communityId || null,
        communityName: communityName || null,
        communitySecurity: communitySecurity ?? null,
        isCommunityStaff: isCommunityStaff ?? false,
        visibility: 'public',
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        imageUrl,
        poll,
        createdAt: serverTimestamp(),
      });

      setContent('');
      setMentionSearch(null);
      setHashtagSearch(null);
      setImageFile(null);
      setImagePreview(null);
      setGifUrl(null);
      setGifPreviewUrl(null);
      setShowPoll(false);
      setPollOptions(['', '']);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (e) {
      console.error('CreatePost error:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="aura-panel p-4 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-[42px] h-[42px] rounded-full overflow-hidden shrink-0">
          {profile?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted text-slate-500 font-bold">
              {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="rounded-2xl border border-border bg-secondary p-3.5 flex flex-col gap-3 shadow-sm transition-all duration-200">
            {/* 1. Input */}
            <div className="relative w-full flex items-start">
              <textarea
                ref={textareaRef}
                id="create-post-textarea"
                value={content}
                onChange={(e) => {
                  handleTextChange(e);
                  autosize();
                }}
                onFocus={() => autosize()}
                placeholder={`No que você está pensando, ${profile?.displayName?.split(' ')[0] || ''}?`}
                className="w-full min-h-[40px] max-h-[120px] resize-none overflow-hidden bg-transparent text-[14px] font-semibold text-slate-700 placeholder:text-slate-400 outline-none leading-[24px] m-0 p-1"
                style={{ height: '40px' }}
                onKeyDown={(e) => {
                  const key = e.key.toLowerCase();
                  const mod = e.metaKey || e.ctrlKey;
                  if (key === 'escape') {
                    setMentionSearch(null);
                    setHashtagSearch(null);
                    return;
                  }
                  if (key === 'enter' && !e.shiftKey) {
                    if (mod) {
                      e.preventDefault();
                      if (canPost) void handleSubmit();
                      return;
                    }
                  }
                }}
              />

              {mentionSearch?.text ? (
                <div className="absolute left-0 top-full pt-2 z-10">
                  <MentionSuggestions
                    searchText={mentionSearch.text}
                    onSelect={handleSelectMention}
                    onClose={() => setMentionSearch(null)}
                  />
                </div>
              ) : null}

              {hashtagSearch?.text ? (
                <div className="absolute left-0 top-full pt-2 z-10">
                  <HashtagSuggestions
                    searchText={hashtagSearch.text}
                    suggestions={[
                      ...DEFAULT_TAG_SUGGESTIONS,
                      ...hashtags.map((h) => String(h || '').replace(/^#/, '')),
                    ]}
                    onSelect={handleSelectHashtag}
                    onClose={() => setHashtagSearch(null)}
                  />
                </div>
              ) : null}
            </div>

            {/* 2. Attachment Preview (Integrated) */}
            {(imagePreview || gifPreviewUrl) && (
              <div className="relative w-full rounded-xl overflow-hidden group animate-in fade-in duration-300 border border-black/5">
                <img
                  src={imagePreview || gifPreviewUrl || ''}
                  alt="Preview"
                  className="w-full object-cover max-h-[360px]"
                />
                <button
                  type="button"
                  onClick={imagePreview ? removeImage : removeGif}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 shadow-md"
                  title="Remover anexo"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
                {isUploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                    <div className="w-6 h-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  </div>
                )}
              </div>
            )}

            {/* 3. Poll Editor (Integrated) */}
            {showPoll && (
              <PollEditor
                options={pollOptions}
                onChange={handlePollOptionChange}
                onRemove={() => { setShowPoll(false); setPollOptions(['', '']); }}
              />
            )}

            {/* 4. Ações (Toolbar + Publicar) */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/50">
              <div ref={toolbarRef} className="flex items-center gap-1 px-1 relative">
                {/* Image */}
                <button
                  type="button"
                  onClick={handleImageClick}
                  className={`w-8 h-8 flex items-center justify-center transition-all rounded-full hover:bg-slate-100 ${imagePreview ? 'text-primary bg-primary/10' : 'text-slate-400 hover:text-primary'}`}
                  aria-label="Imagem"
                  title="Adicionar imagem"
                >
                  <ImageIcon size={18} />
                </button>

                {/* GIF */}
                <button
                  type="button"
                  onClick={() => { setShowGif((v) => !v); setShowEmoji(false); }}
                  className={`h-6 px-2 border-[1.5px] rounded text-[10px] font-black transition-all ${showGif || gifUrl ? 'border-primary text-primary bg-primary/5' : 'border-slate-200 text-slate-400 hover:text-primary hover:border-primary'}`}
                  title="Adicionar GIF"
                >
                  GIF
                </button>

                {/* Poll */}
                <button
                  type="button"
                  onClick={() => setShowPoll((v) => !v)}
                  className={`w-8 h-8 flex items-center justify-center transition-all rounded-full hover:bg-slate-100 ${showPoll ? 'text-primary bg-primary/10' : 'text-slate-400 hover:text-primary'}`}
                  aria-label="Enquete"
                  title="Criar enquete"
                >
                  <BarChart3 size={17} />
                </button>

                {/* Emoji */}
                <button
                  type="button"
                  onClick={() => { setShowEmoji((v) => !v); setShowGif(false); }}
                  className={`w-8 h-8 flex items-center justify-center transition-all rounded-full hover:bg-slate-100 ${showEmoji ? 'text-primary bg-primary/10' : 'text-slate-400 hover:text-primary'}`}
                  aria-label="Emoji"
                  title="Adicionar emoji"
                >
                  <Smile size={18} />
                </button>

                {/* Emoji Picker Popover */}
                {showEmoji && (
                  <EmojiPicker
                    onSelect={handleEmojiSelect}
                    onClose={() => setShowEmoji(false)}
                  />
                )}

                {/* GIF Picker Popover */}
                {showGif && (
                  <GifPicker
                    onSelect={handleGifSelect}
                    onClose={() => setShowGif(false)}
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="aura-btn-primary h-[36px] px-6 rounded-2xl text-[13px]"
                disabled={!canPost}
              >
                {isSubmitting ? (isUploadingImage ? 'Enviando…' : 'Publicando…') : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
