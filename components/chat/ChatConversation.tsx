'use client';

import React, { useRef, useMemo, useEffect, useCallback, useState } from 'react';
import { Paperclip, Send, Phone, User as UserIcon, Check, CheckCheck, X, ZoomIn } from 'lucide-react';
import { IconButton } from './parts/ChatSubComponents';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { uploadImage } from '@/lib/image-utils';
import { useChat } from './ChatProvider';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ChatConversationProps {
  chat?: any;
  messages?: any[];
  /** @deprecated use currentUserId instead */
  profile?: any;
  /** @deprecated use value instead */
  composerValue?: string;
  /** @deprecated use onChange instead */
  onComposerChange?: (val: string) => void;
  onSend?: () => void;
  onUpload?: (file: File) => void;
  isTyping?: boolean;
  onInfoToggle?: () => void;
  currentUserId?: string;
  isWindow?: boolean;
  value?: string;
  onChange?: (val: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: normalise Firestore / raw timestamps → ms number
// ─────────────────────────────────────────────────────────────────────────────
function toMs(ts: any): number {
  if (!ts) return Date.now();
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const parsed = Number(ts);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: date separator label
// ─────────────────────────────────────────────────────────────────────────────
function dateLabel(dateObj: Date): string {
  if (isToday(dateObj)) return 'HOJE';
  if (isYesterday(dateObj)) return 'ONTEM';
  return format(dateObj, 'EEEE', { locale: ptBR }).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: avatar fallback URL
// ─────────────────────────────────────────────────────────────────────────────
function avatarUrl(photoURL?: string, displayName?: string): string {
  if (photoURL) return photoURL;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'U')}&background=random`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Lightbox
// ─────────────────────────────────────────────────────────────────────────────
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative max-w-[90vw] max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={src}
            alt="Imagem expandida"
            className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain shadow-2xl"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors backdrop-blur-sm"
          >
            <X size={18} />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function ChatConversation({
  chat,
  messages,
  profile,
  composerValue,
  onComposerChange,
  onSend,
  onUpload,
  isTyping,
  onInfoToggle,
  currentUserId,
  isWindow,
  value,
  onChange,
}: ChatConversationProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ✅ FIX: useAppStore called at hook level, never inside onClick callbacks
  const startCall = useAppStore((s) => s.startCall);

  // ✅ FIX: currentUserId prop takes priority; profile.uid is legacy fallback
  const activeUserId = currentUserId ?? profile?.uid ?? '';

  // Unify composer props (new API takes priority over deprecated API)
  const activeValue = value !== undefined ? value : (composerValue ?? '');
  const activeOnChange = onChange ?? onComposerChange;

  const otherUser = chat?.otherUser ?? {};
  const isOnline = otherUser?.status === 'online';

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Optimistic upload preview
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  // Pending image for description before sending
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const { sendMessage } = useChat();

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (messages && messages.length > 0) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
    }
  }, [messages]);

  // ── Agrupar mensagens por data ─────────────────────────────────────────────
  const groupedMessages = useMemo(() => {
    const groups: any[] = [];
    if (!messages) return groups;

    for (const msg of messages) {
      const ms = toMs(msg.createdAt ?? msg.timestamp);
      const dateObj = new Date(ms);
      if (isNaN(dateObj.getTime())) continue;

      const dateKey = format(dateObj, 'yyyy-MM-dd');
      let group = groups.find((g) => g.date === dateKey);

      if (!group) {
        group = {
          date: dateKey,
          label: dateLabel(dateObj),
          messages: [],
        };
        groups.push(group);
      }

      group.messages.push({ ...msg, _ms: ms });
    }

    return groups;
  }, [messages]);



  // ── Voice call handler ─────────────────────────────────────────────────────
  // ✅ FIX: callback defined at hook level, no more getState() in JSX
  const handleVoiceCall = useCallback(() => {
    if (startCall) {
      startCall(otherUser.uid, otherUser.displayName, 'audio', otherUser.photoURL);
    } else {
      alert('Sistema de chamadas em manutenção');
    }
  }, [startCall, otherUser.uid, otherUser.displayName, otherUser.photoURL]);

  // ── File upload: hold in state for description ─────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const localUrl = URL.createObjectURL(file);
      setPendingFile(file);
      setPendingPreview(localUrl);
      e.target.value = '';
    },
    [],
  );

  // ── Unified Send Handler (handles text + image) ────────────────────────────
  const handleSendClick = useCallback(async () => {
    const textContent = activeValue.trim();
    const hasImage = !!pendingFile;
    
    if (!textContent && !hasImage) return;

    if (hasImage && pendingFile) {
      setIsUploading(true);
      try {
        const res = await uploadImage(pendingFile);
        // Send as image type with description in text
        await sendMessage(chat.id, textContent, 'image', res.url);
        
        // Clear pending image
        setPendingFile(null);
        if (pendingPreview) {
          URL.revokeObjectURL(pendingPreview);
        }
        setPendingPreview(null);
        
        // Clear text input
        activeOnChange?.('');
      } catch (err: any) {
        console.error('Error sending image message:', err);
        alert(`Falha ao enviar imagem: ${err.message || 'Erro desconhecido'}`);
      } finally {
        setIsUploading(false);
      }
    } else {
      // Regular text message
      if (textContent) {
        await sendMessage(chat.id, textContent, 'text');
        activeOnChange?.('');
      }
    }
  }, [activeValue, pendingFile, pendingPreview, chat?.id, sendMessage, activeOnChange]);

  // ── Keyboard send ──────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSendClick();
      }
    },
    [handleSendClick],
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-[#f5f6fb]">
      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {/* ── HEADER (only in full-page mode) ── */}
      {!isWindow && (
        <header className="flex h-[72px] min-h-[72px] shrink-0 items-center justify-between border-b border-[#e4e8f2] bg-white px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={avatarUrl(otherUser.photoURL, otherUser.displayName)}
                className="h-10 w-10 rounded-full border border-[#e4e8f2] object-cover"
                alt={otherUser.displayName ?? 'Avatar'}
              />
              {isOnline && (
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#22c55e]" />
              )}
            </div>
            <div>
              <h2
                className="cursor-pointer text-[14px] font-bold leading-tight text-[#1a1f3a]"
                onClick={onInfoToggle}
              >
                {otherUser.displayName}
              </h2>
              <span
                className={`text-[11px] font-bold ${isOnline ? 'text-[#22c55e]' : 'text-[#b8c0d8]'
                  }`}
              >
                {isOnline ? '● online agora' : 'offline'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ✅ FIX: handleVoiceCall defined above as a proper callback */}
            <IconButton title="Chamada de voz" onClick={handleVoiceCall}>
              <Phone size={16} />
            </IconButton>
            <IconButton title="Ver perfil" onClick={onInfoToggle}>
              <UserIcon size={16} />
            </IconButton>
          </div>
        </header>
      )}

      {/* ── MESSAGES ── */}
      <div
        ref={scrollRef}
        className="scrollbar-hide flex-1 space-y-8 overflow-y-auto p-6"
      >
        {groupedMessages.length === 0 && !uploadingImage && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
              <img
                src={avatarUrl(otherUser.photoURL, otherUser.displayName)}
                alt=""
                className="h-14 w-14 rounded-full object-cover"
              />
            </div>
            <p className="text-[13px] font-bold text-[#b8c0d8]">
              Diga olá para {otherUser.displayName || 'esta pessoa'} 👋
            </p>
          </div>
        )}

        {groupedMessages.map((group, gIdx) => (
          <div key={gIdx} className="space-y-4">
            {/* Date separator */}
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-[#e4e8f2]" />
              <span className="text-[10px] font-black tracking-widest text-[#b8c0d8]">
                {group.label}
              </span>
              <div className="h-px flex-1 bg-[#e4e8f2]" />
            </div>

            {group.messages.map((msg: any) => {
              // ✅ FIX: uses activeUserId (from prop) — not profile.uid directly
              const isMe = msg.senderId === activeUserId;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={`flex items-end gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'
                    }`}
                >
                  {/* Other user avatar */}
                  {!isMe && (
                    <img
                      src={avatarUrl(otherUser.photoURL, otherUser.displayName)}
                      alt=""
                      className="mb-1 h-[26px] w-[26px] shrink-0 rounded-full border border-[#e4e8f2] object-cover"
                    />
                  )}

                  {/* Bubble */}
                  <div
                    className={`group relative flex max-w-[70%] flex-col ${isMe ? 'items-end' : 'items-start'
                      }`}
                  >
                    <div
                      className={`relative px-4 py-2.5 text-[14.5px] font-medium leading-relaxed transition-all duration-300 group-hover:translate-y-[-1px] ${isMe
                        ? 'rounded-[20px] rounded-br-[4px] bg-gradient-to-br from-[#7c6fcd] via-[#7c6fcd] to-[#6355b8] text-white shadow-[0_4px_15px_rgba(124,111,205,0.25)]'
                        : 'rounded-[20px] rounded-bl-[4px] border border-[#e4e8f2]/60 bg-white/80 backdrop-blur-md text-[#1a1f3a] shadow-[0_2px_10px_rgba(0,0,0,0.03)]'
                        }`}
                    >
                      {/* Premium Gloss Effect for 'isMe' */}
                      {isMe && (
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 pointer-events-none" />
                      )}

                      {/* Improved Bubble Tail */}
                      <div className={`absolute bottom-[-0.5px] h-4 w-4 ${isMe
                        ? 'right-[-7px] text-[#6355b8]'
                        : 'left-[-7px] text-white/80'
                        }`}>
                        <svg viewBox="0 0 16 16" className="h-full w-full fill-current filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
                          {isMe ? (
                            <path d="M0 16c4 0 8-4 8-10V0c0 4 4 16 8 16H0z" />
                          ) : (
                            <path d="M16 16c-4 0-8-4-8-10V0c0 4-4 16-8 16h16z" />
                          )}
                        </svg>
                      </div>

                      {/* Image attachment — click opens lightbox */}
                      {msg.type === 'image' && msg.attachmentUrl && (
                        <div className="-mx-2 -mt-1 mb-1 overflow-hidden rounded-[14px] relative group/img">
                          <img
                            src={msg.attachmentUrl}
                            alt="Anexo"
                            className="max-h-[300px] max-w-full object-cover transition-all duration-300 group-hover/img:brightness-90"
                            onClick={() => setLightboxSrc(msg.attachmentUrl)}
                          />
                          {/* Zoom hint overlay */}
                          <div
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                            onClick={() => setLightboxSrc(msg.attachmentUrl)}
                          >
                            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                              <ZoomIn size={18} className="text-white" />
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Text body — only show if non-empty */}
                      {msg.text && msg.text.trim() && (
                        <p className="relative z-10 whitespace-pre-wrap">{msg.text}</p>
                      )}
                    </div>

                    {/* Timestamp + read receipt */}
                    <div className="mt-1 flex items-center gap-1 px-1">
                      <span className="text-[10px] font-bold text-[#c0c8de]">
                        {format(new Date(msg._ms), 'HH:mm')}
                      </span>
                      {isMe && (
                        <span
                          className={
                            msg.read ? 'text-[#7c6fcd]' : 'text-[#c0c8de]'
                          }
                        >
                          {msg.read ? (
                            <CheckCheck size={12} strokeWidth={3} />
                          ) : (
                            <Check size={12} strokeWidth={3} />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}

        {/* Optimistic image preview while uploading */}
        {uploadingImage && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="flex items-end gap-2.5 flex-row-reverse"
          >
            <div className="group relative flex max-w-[70%] flex-col items-end">
              <div className="relative rounded-[20px] rounded-br-[4px] bg-gradient-to-br from-[#7c6fcd] via-[#7c6fcd] to-[#6355b8] shadow-[0_4px_15px_rgba(124,111,205,0.25)] overflow-hidden">
                <div className="-mx-0 -mt-0 overflow-hidden rounded-[20px] relative">
                  <img
                    src={uploadingImage}
                    alt="Enviando..."
                    className="max-h-[300px] max-w-full object-cover opacity-70"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  </div>
                </div>
              </div>
              <div className="mt-1 px-1">
                <span className="text-[10px] font-bold text-[#c0c8de]">Enviando…</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-end gap-2.5">
            {/* ✅ FIX: avatarUrl fallback used here too */}
            <img
              src={avatarUrl(otherUser.photoURL, otherUser.displayName)}
              alt=""
              className="mb-1 h-[26px] w-[26px] shrink-0 rounded-full border border-[#e4e8f2] object-cover"
            />
            <div className="rounded-t-[14px] rounded-br-[14px] rounded-bl-[4px] border border-[#e4e8f2] bg-white px-4 py-3">
              <div className="flex gap-1">
                <span className="h-1 w-1 animate-bounce rounded-full bg-[#b8c0d8]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-[#b8c0d8] [animation-delay:0.2s]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-[#b8c0d8] [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── COMPOSER ── */}
      <footer className="shrink-0 border-t border-[#e4e8f2] bg-white p-4">
        {pendingPreview && (
          <div className="mb-3 relative w-20 h-20 rounded-2xl overflow-hidden border border-[#e4e8f2] group animate-in fade-in duration-200">
            <img src={pendingPreview} className="w-full h-full object-cover" alt="Preview" />
            <button
              type="button"
              onClick={() => {
                setPendingFile(null);
                if (pendingPreview) URL.revokeObjectURL(pendingPreview);
                setPendingPreview(null);
              }}
              className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
              title="Remover imagem"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        )}

        <div className="focus-within:border-[#b5aef0] group flex items-center gap-3 rounded-full border border-[#e4e8f2] bg-[#f4f6fb] px-4 py-1.5 transition-colors">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[#b8c0d8] transition-colors hover:text-[#7c6fcd]"
            title="Enviar imagem"
          >
            <Paperclip size={20} strokeWidth={2.5} />
          </button>

          <input
            type="text"
            placeholder="Escreva uma mensagem..."
            className="flex-1 border-none bg-transparent py-2 text-[14px] text-[#1a1f3a] placeholder-[#b8c0d8] outline-none"
            value={activeValue}
            onChange={(e) => activeOnChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button
            type="button"
            onClick={handleSendClick}
            disabled={isUploading || (!activeValue.trim() && !pendingFile)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7c6fcd] text-white shadow-none transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            title="Enviar"
          >
            {isUploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send size={18} fill="currentColor" className="ml-0.5" />
            )}
          </button>
        </div>

        {/* ✅ FIX: accept only images; reset handled in handleFileChange */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,video/mp4,video/webm"
          onChange={handleFileChange}
        />
      </footer>
    </div>
  );
}
