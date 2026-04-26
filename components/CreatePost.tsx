'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Smile, X, BarChart3, Plus, Trash2, Pencil, Type, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import { db } from '@/firebase';
import { ImageEditor } from './ImageEditor';
import { extractHashtags } from '@/lib/hashtags';
import { validateContent } from '@/lib/moderation/utils';
import { uploadImage } from '@/lib/image-utils';
import { MentionSuggestions } from './MentionSuggestions';
import { HashtagSuggestions } from './HashtagSuggestions';
import { POST_BACKGROUNDS, type BackgroundOption } from '@/lib/post-backgrounds';
import { GifPicker } from './GifPicker';

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
  '😀', '😂', '🥲', '😍', '🤩', '😎', '🥳', '🤔', '😮', '😢', '😡', '🥺',
  '👍', '👎', '❤️', '🔥', '✨', '🎉', '💯', '💪', '🙏', '👏', '🫶', '🤝',
  '😊', '🤗', '😴', '🤯', '🫠', '🥴', '😏', '🤭', '🫡', '😇', '🤓', '🫢',
  '🌟', '⚡', '🎯', '🚀', '💡', '🎨', '🌈', '🌊', '🍀', '🌸', '💎', '👑',
];

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <div className="absolute top-full left-0 mt-2 z-[100] bg-[#1a1a1f] rounded-2xl shadow-2xl border border-white/10 p-4 w-[260px] animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-xl">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Emojis</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-lg">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-8 gap-2">
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="text-lg hover:scale-125 hover:bg-white/10 transition-all rounded-lg p-2 active:scale-90"
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
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageAlt, setImageAlt] = useState<string>('');
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

  // Image editing
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);

  // Background Post ("Aa")
  const [selectedBackground, setSelectedBackground] = useState<BackgroundOption | null>(null);
  const [hoveredBackground, setHoveredBackground] = useState<BackgroundOption | null>(null);
  const [postAlignment, setPostAlignment] = useState<'center' | 'left' | 'right'>('center');
  const [postFont, setPostFont] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [textGlow, setTextGlow] = useState(false);
  const [backgroundTab, setBackgroundTab] = useState<'gradients' | 'solids' | 'soft' | 'aura' | 'textures'>('aura');

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
    setSelectedBackground(null);
    setHoveredBackground(null);
    setShowEmoji(false);
    setShowGif(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (imageFiles.length + files.length > 4) {
      alert('Você pode enviar no máximo 4 imagens por post.');
      return;
    }
    
    setGifUrl(null);
    setGifPreviewUrl(null);
    
    const newPreviews = [...imagePreviews];
    const newFiles = [...imageFiles];
    
    files.forEach(file => {
      newFiles.push(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    
    setImageFiles(newFiles);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    if (imageFiles.length <= 1) {
      setImageAlt('');
    }
  };

  const handleSaveEditedImage = (blob: Blob, metadata: { alt?: string; tags?: any[] }) => {
    if (editingImageIndex === null || !imageFiles[editingImageIndex]) return;
    
    const oldFile = imageFiles[editingImageIndex];
    const file = new File([blob], oldFile.name, { type: 'image/jpeg' });
    
    const newFiles = [...imageFiles];
    newFiles[editingImageIndex] = file;
    setImageFiles(newFiles);

    if (metadata.alt !== undefined) {
      setImageAlt(metadata.alt);
    }
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const newPreviews = [...imagePreviews];
      newPreviews[editingImageIndex] = ev.target?.result as string;
      setImagePreviews(newPreviews);
    };
    reader.readAsDataURL(file);
    
    setShowImageEditor(false);
    setEditingImageIndex(null);
  };

  // ── GIF selection ───────────────────────────────────────────────────────────
  const handleGifSelect = (url: string, previewUrl: string) => {
    setSelectedBackground(null);
    setHoveredBackground(null);
    setGifUrl(url);
    setGifPreviewUrl(previewUrl);
    setImageFiles([]);
    setImagePreviews([]);
    setShowGif(false);
  };

  const removeGif = () => {
    setGifUrl(null);
    setGifPreviewUrl(null);
  };

  const handlePollClick = () => {
    setSelectedBackground(null);
    setHoveredBackground(null);
    setShowPoll((v) => !v);
  };

  const backgroundTabs = useMemo(() => ({
    gradients: { label: 'Gradientes', filter: (bg: BackgroundOption) => bg.type === 'gradient' || bg.type === 'premium' },
    solids: { label: 'Sólidas', filter: (bg: BackgroundOption) => bg.type === 'solid' },
    soft: {
      label: 'Suaves',
      filter: (bg: BackgroundOption) => (bg.type === 'gradient' || bg.type === 'solid' || bg.type === 'premium') && bg.textColor === 'slate-900',
    },
    aura: { label: 'Aura Collection', filter: (bg: BackgroundOption) => bg.type === 'aura' },
    textures: { label: 'Texturas', filter: (_bg: BackgroundOption) => false },
  }), []);

  const visibleBackgrounds = useMemo(() => {
    const def = backgroundTabs[backgroundTab];
    return POST_BACKGROUNDS.filter(def.filter);
  }, [backgroundTab, backgroundTabs]);

  const handleToggleBackgroundMode = () => {
    if (selectedBackground) {
      setSelectedBackground(null);
      setHoveredBackground(null);
    } else {
      const initial = POST_BACKGROUNDS.find((bg) => bg.type === 'aura') ?? POST_BACKGROUNDS[0];
      setSelectedBackground(initial);
      setBackgroundTab(initial.type === 'aura' ? 'aura' : initial.type === 'solid' ? 'solids' : 'gradients');
      // Clear other attachments
      setImageFiles([]);
      setImagePreviews([]);
      setGifUrl(null);
      setGifPreviewUrl(null);
      setShowPoll(false);
    }
    setShowEmoji(false);
    setShowGif(false);
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

  const hasAttachment = !!(imagePreviews.length > 0 || gifUrl);
  const canPost = Boolean(profile?.uid) && (Boolean(content.trim()) || hasAttachment) && !isSubmitting;

  const autosize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const max = selectedBackground ? 220 : 120;
    const min = selectedBackground ? 140 : 44;
    const next = Math.min(max, Math.max(min, el.scrollHeight));
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
      let imageUrls: string[] = [];

      if (imageFiles.length > 0) {
        setIsUploadingImage(true);
        try {
          const uploads = imageFiles.map(file => uploadImage(file));
          const results = await Promise.all(uploads);
          imageUrls = results.map(r => r.url);
          imageUrl = imageUrls[0];
        } finally {
          setIsUploadingImage(false);
        }
      } else if (gifUrl) {
        imageUrl = gifUrl;
        imageUrls = [gifUrl];
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
        imageUrls,
        imageAlt: imageAlt || null,
        poll,
        background: selectedBackground ? {
          id: selectedBackground.id,
          type: selectedBackground.type,
          value: selectedBackground.value,
          textColor: selectedBackground.textColor,
          alignment: postAlignment,
          font: postFont,
          glow: textGlow
        } : null,
        createdAt: serverTimestamp(),
      });

      setContent('');
      setMentionSearch(null);
      setHashtagSearch(null);
      setImageFiles([]);
      setImagePreviews([]);
      setImageAlt('');
      setGifUrl(null);
      setGifPreviewUrl(null);
      setShowPoll(false);
      setSelectedBackground(null);
      setHoveredBackground(null);
      setPollOptions(['', '']);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (e) {
      console.error('CreatePost error:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <div className="w-full max-w-3xl mx-auto px-1 sm:px-0">
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold">
              {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </div>

        {/* Input and Toolbar */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Input */}
          <textarea
            ref={textareaRef}
            id="create-post-textarea"
            value={content}
            onChange={(e) => {
              handleTextChange(e);
              autosize();
            }}
            onFocus={() => autosize()}
            placeholder={`No que você está pensando, ${profile?.displayName?.split(' ')[0] || 'Usuário'}?`}
            style={selectedBackground ? {
              background: selectedBackground.value,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            } : undefined}
            className={`w-full resize-none bg-transparent outline-none leading-relaxed transition-[box-shadow,border-color] ${selectedBackground ? `rounded-2xl border border-slate-200 shadow-sm px-5 py-4 text-lg font-semibold min-h-[140px] max-h-[220px] ${postAlignment === 'center' ? 'text-center' : postAlignment === 'right' ? 'text-right' : 'text-left'} ${postFont === 'serif' ? 'font-serif' : postFont === 'mono' ? 'font-mono' : ''} ${selectedBackground.textColor === 'white' ? 'text-white placeholder:text-white/70' : 'text-slate-900 placeholder:text-slate-900/55'}` : 'text-base text-slate-700 placeholder:text-slate-400 min-h-[24px] max-h-[120px] font-medium'}`}
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

          {content.trim().length >= 12 && hashtags.length === 0 && !hashtagSearch && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Sparkles className="h-4 w-4 text-primary/70" />
                Hashtags ajudam seu post a subir no Trending
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {DEFAULT_TAG_SUGGESTIONS.slice(0, 3).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const next = `${content.trimEnd()}${content.trimEnd().endsWith('#') ? '' : ' '}#${tag} `;
                      setContent(next);
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                    className="rounded-full border border-slate-200 bg-white px-2 py-1 font-bold text-slate-600 hover:bg-slate-50"
                    title={`Adicionar #${tag}`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attachment Previews */}
          {gifPreviewUrl && (
            <div className="relative mt-3 rounded-2xl overflow-hidden border border-white/10 aspect-video bg-white/5 flex items-center justify-center">
              <img src={gifPreviewUrl}
                alt="Pré-visualização da imagem"
                className="max-h-full max-w-full object-contain"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  type="button"
                  onClick={removeGif}
                  className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors backdrop-blur-sm"
                  aria-label="Remover GIF"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
          {imagePreviews.length > 0 && (
            <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: imagePreviews.length === 1 ? '1fr' : '1fr 1fr' }}>
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative rounded-2xl overflow-hidden border border-white/10 aspect-video bg-white/5 flex items-center justify-center">
                  <img src={preview}
                    alt={`Pré-visualização da imagem ${index + 1}`}
                    className="max-h-full max-w-full object-contain w-full"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setEditingImageIndex(index); setShowImageEditor(true); }}
                      className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors backdrop-blur-sm"
                      aria-label="Editar imagem"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors backdrop-blur-sm"
                      aria-label="Remover imagem"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {isUploadingImage && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Poll Editor */}
          {showPoll && (
            <PollEditor
              options={pollOptions}
              onChange={handlePollOptionChange}
              onRemove={() => { setShowPoll(false); setPollOptions(['', '']); }}
            />
          )}

          {/* Toolbar + Publish */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <div
              ref={toolbarRef}
              className="flex flex-1 min-w-0 items-center gap-2 relative overflow-x-auto no-scrollbar pr-1"
            >
              {/* Image */}
              <button
                type="button"
                onClick={handleImageClick}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${imagePreviews.length > 0 ? 'text-indigo-600 bg-indigo-50 border border-indigo-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-transparent'} border`}
                aria-label="Imagem"
                title="Adicionar imagem"
              >                <ImageIcon size={18} />
              </button>

              {/* GIF */}
              <button
                type="button"
                onClick={() => { setShowGif((v) => !v); setShowEmoji(false); }}
                className={`h-9 px-2 border rounded-lg text-xs font-bold transition-all ${showGif || gifUrl ? 'border-indigo-500 text-indigo-600 bg-indigo-50' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                title="Adicionar GIF"
              >
                GIF
              </button>

              {/* Poll */}
              <button
                type="button"
                onClick={handlePollClick}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${showPoll ? 'text-indigo-600 bg-indigo-50 border border-indigo-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-transparent'} border`}
                aria-label="Enquete"
                title="Criar enquete"
              >
                <BarChart3 size={18} />
              </button>

              {/* Aa (Creative Studio) */}
              <button
                type="button"
                onClick={handleToggleBackgroundMode}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all border ${selectedBackground ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-transparent'}`}
                aria-label="Aura Creative Studio"
                title="Aura Creative Studio"
              >
                <Type size={18} />
              </button>

              {/* Emoji */}
              <button
                type="button"
                onClick={() => { setShowEmoji((v) => !v); setShowGif(false); }}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                aria-label="Emoji"
                title="Adicionar emoji"
              >
                <Smile size={18} />
              </button>

              {/* Emoji Picker */}
              {showEmoji && (
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowEmoji(false)}
                />
              )}

              {/* GIF Picker */}
              {showGif && (
                <GifPicker
                  variant="dark"
                  onSelect={(url, previewUrl) => handleGifSelect(url, previewUrl)}
                  onClose={() => setShowGif(false)}
                />
              )}
            </div>

            {/* Publish Button */}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed h-9 px-6 rounded-full text-sm font-bold text-white shadow-md hover:shadow-lg active:scale-95 transition-all duration-200"
              disabled={!canPost}
            >
              {isSubmitting ? (isUploadingImage ? 'Enviando…' : 'Publicando…') : 'Publicar'}
            </button>
          </div>
        </div>
      </div>

      {/* Background Styles Section - Only show when selected */}
      {selectedBackground && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="mt-4 pt-4 border-t border-slate-200"
        >
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Estilo do fundo</h3>
              <button
                onClick={() => { setSelectedBackground(null); setHoveredBackground(null); }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Style Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {(Object.keys(backgroundTabs) as Array<keyof typeof backgroundTabs>).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBackgroundTab(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${backgroundTab === key ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                >
                  {backgroundTabs[key].label}
                </button>
              ))}
            </div>

            {/* Background Grid */}
            {visibleBackgrounds.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {visibleBackgrounds.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onMouseEnter={() => setHoveredBackground(bg)}
                    onMouseLeave={() => setHoveredBackground(null)}
                    onClick={() => setSelectedBackground(bg)}
                    className={`shrink-0 w-14 h-14 rounded-xl transition-all relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${selectedBackground?.id === bg.id ? 'ring-2 ring-indigo-600 scale-105' : 'border border-slate-200 hover:scale-105'}`}
                    style={{ background: bg.value, backgroundSize: 'cover' }}
                    title={bg.name}
                  >
                    {selectedBackground?.id === bg.id && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-16 rounded-xl border border-dashed border-slate-200 text-xs font-semibold text-slate-500">
                Em breve
              </div>
            )}

            <div className="mt-2 min-h-[16px] text-[11px] font-semibold text-slate-500">
              {hoveredBackground?.name ?? selectedBackground?.name}
            </div>
          </div>
        </motion.div>
      )}
    </div>
    </div>

    {/* Image Editor Modal */}
    <AnimatePresence>
      {showImageEditor && editingImageIndex !== null && imagePreviews[editingImageIndex] && (
        <ImageEditor
          image={imagePreviews[editingImageIndex]}
          initialAlt={imageAlt}
          onSave={handleSaveEditedImage}
          onCancel={() => setShowImageEditor(false)}
        />
      )}
    </AnimatePresence>

    {/* Hidden file input */}
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept="image/*,image/gif"
      className="hidden"
      onChange={handleFileChange}
    />
    </>
  );
}
