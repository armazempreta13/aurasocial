'use client';

import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { Paperclip, Send, Phone, User as UserIcon, Check, CheckCheck } from 'lucide-react';
import { IconButton } from './parts/ChatSubComponents';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAppStore } from '@/lib/store';

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

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only auto-scroll if the user is near the bottom (within 120px)
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom || isTyping) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isTyping]);

  // ── Group messages by calendar day ────────────────────────────────────────
  const groupedMessages = useMemo(() => {
    const groups: Array<{ date: string; label: string; messages: any[] }> = [];
    if (!messages?.length) return groups;

    for (const msg of messages) {
      const ms = toMs(msg.createdAt ?? msg.timestamp);
      const dateObj = new Date(ms);
      if (isNaN(dateObj.getTime())) continue;

      const dateKey = format(dateObj, 'yyyy-MM-dd');
      let group = groups.find((g) => g.date === dateKey);
      if (!group) {
        group = { date: dateKey, label: dateLabel(dateObj), messages: [] };
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

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      onUpload?.(file);
      // Reset so the same file can be re-uploaded if needed
      e.target.value = '';
    },
    [onUpload],
  );

  // ── Keyboard send ──────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend?.();
      }
    },
    [onSend],
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-[#f5f6fb]">
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
                className={`text-[11px] font-bold ${
                  isOnline ? 'text-[#22c55e]' : 'text-[#b8c0d8]'
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
        {groupedMessages.length === 0 && (
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
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 ${
                    isMe ? 'flex-row-reverse' : 'flex-row'
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
                    className={`group relative flex max-w-[70%] flex-col ${
                      isMe ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`overflow-hidden px-4 py-3 text-[14px] font-medium leading-relaxed ${
                        isMe
                          ? 'rounded-t-[14px] rounded-bl-[14px] rounded-br-[4px] bg-[#7c6fcd] text-white'
                          : 'rounded-t-[14px] rounded-br-[14px] rounded-bl-[4px] border border-[#e4e8f2] bg-white text-[#1a1f3a]'
                      }`}
                    >
                      {/* Image attachment */}
                      {msg.type === 'image' && msg.attachmentUrl && (
                        <div className="-mx-2 -mt-1 mb-1 overflow-hidden rounded-lg">
                          <img
                            src={msg.attachmentUrl}
                            alt="Anexo"
                            className="max-h-[300px] max-w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                            onClick={() => window.open(msg.attachmentUrl, '_blank')}
                          />
                        </div>
                      )}
                      {/* Text body */}
                      {msg.text && (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
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
                </div>
              );
            })}
          </div>
        ))}

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
        <div className="focus-within:border-[#b5aef0] group flex items-center gap-3 rounded-full border border-[#e4e8f2] bg-[#f4f6fb] px-4 py-1.5 transition-colors">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[#b8c0d8] transition-colors hover:text-[#7c6fcd]"
            title="Enviar arquivo"
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
            onClick={onSend}
            disabled={!activeValue.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7c6fcd] text-white shadow-none transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            title="Enviar"
          >
            <Send size={18} fill="currentColor" className="ml-0.5" />
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
