'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import {
  Bell, Heart, MessageCircle, Share2, UserCheck, UserPlus,
  AtSign, Users, Sparkles, Reply, Check, X, MoreHorizontal,
  CheckCheck, Trash2, BadgeCheck, Star, Tag,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '@/lib/store';
import { soundEffects } from '@/lib/sound-effects';
import { respondToFriendRequest } from '@/lib/friendships';
import { TimeAgo } from './TimeAgo';
import {
  useNotifications,
  getNotificationColor,
  getNotificationLink,
  buildNotificationText,
  deleteNotification,
  type GroupedNotification,
  type NotificationType,
  type NotificationColor,
} from '@/lib/notifications';

// ─── Cross-TopNav event ───────────────────────────────────────────────────────

const DROPDOWN_EVENT = 'topnav:dropdown-open';

function emitDropdownOpen(name: string) {
  window.dispatchEvent(new CustomEvent(DROPDOWN_EVENT, { detail: { name } }));
}

// ─── Colour map ───────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<NotificationColor, { icon: string; bg: string; dot: string; ring: string }> = {
  red:     { icon: 'text-red-500',     bg: 'bg-red-50',      dot: 'bg-red-500',    ring: 'ring-red-100' },
  blue:    { icon: 'text-blue-500',    bg: 'bg-blue-50',     dot: 'bg-blue-500',   ring: 'ring-blue-100' },
  sky:     { icon: 'text-sky-500',     bg: 'bg-sky-50',      dot: 'bg-sky-500',    ring: 'ring-sky-100' },
  green:   { icon: 'text-green-500',   bg: 'bg-green-50',    dot: 'bg-green-500',  ring: 'ring-green-100' },
  violet:  { icon: 'text-violet-600',  bg: 'bg-violet-50',   dot: 'bg-violet-500', ring: 'ring-violet-100' },
  emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-50',  dot: 'bg-emerald-500',ring: 'ring-emerald-100' },
  amber:   { icon: 'text-amber-500',   bg: 'bg-amber-50',    dot: 'bg-amber-500',  ring: 'ring-amber-100' },
  rose:    { icon: 'text-rose-500',    bg: 'bg-rose-50',     dot: 'bg-rose-500',   ring: 'ring-rose-100' },
  orange:  { icon: 'text-orange-500',  bg: 'bg-orange-50',   dot: 'bg-orange-500', ring: 'ring-orange-100' },
  primary: { icon: 'text-primary',     bg: 'bg-primary/10',  dot: 'bg-primary',    ring: 'ring-primary/20' },
};

// ─── Type icon ────────────────────────────────────────────────────────────────

function NotifTypeIcon({ type, size = 12 }: { type: NotificationType; size?: number }) {
  const color = getNotificationColor(type);
  const cls = `${COLOR_CLASSES[color].icon}`;
  const p = { size, className: cls };
  switch (type) {
    case 'like':             return <Heart {...p} fill="currentColor" />;
    case 'comment':          return <MessageCircle {...p} fill="currentColor" />;
    case 'reply':            return <Reply {...p} />;
    case 'follow':           return <UserPlus {...p} />;
    case 'friend_request':   return <UserPlus {...p} />;
    case 'friend_accept':    return <UserCheck {...p} />;
    case 'share':            return <Share2 {...p} />;
    case 'mention':          return <AtSign {...p} />;
    case 'community_invite':
    case 'community_post':
    case 'community_accept': return <Users {...p} />;
    case 'story_reaction':   return <Star {...p} fill="currentColor" />;
    case 'story_reply':      return <Reply {...p} />;
    case 'post_tag':         return <Tag {...p} />;
    case 'poll_vote':        return <Check {...p} />;
    case 'system':           return <Sparkles {...p} />;
    default:                 return <Sparkles {...p} />;
  }
}

// ─── Actor avatars stack ──────────────────────────────────────────────────────

function ActorAvatars({ group }: { group: GroupedNotification }) {
  const color = getNotificationColor(group.type);
  const cls = COLOR_CLASSES[color];

  const preview = group.actors.slice(0, 3);
  const extra = group.actorCount - preview.length;

  return (
    <div className="relative shrink-0">
      {/* Stacked avatars (max 2 shown + overflow badge) */}
      <div className="flex">
        {preview.slice(0, 2).map((actor, i) => (
          <div
            key={actor.uid}
            className={`relative w-11 h-11 rounded-full ring-2 ring-white overflow-hidden bg-slate-100 shadow-sm transition-all duration-300 group-hover:shadow-md ${i > 0 ? '-ml-4' : ''}`}
          >
            {actor.photoURL ? (
              <img src={actor.photoURL} alt={actor.displayName} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-base">
                {actor.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
        ))}
        {extra > 0 && (
          <div className="-ml-4 w-11 h-11 rounded-full ring-2 ring-white bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600 shadow-sm">
            +{extra}
          </div>
        )}
      </div>
      {/* Type badge */}
      <div className={`absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] rounded-full ${cls.bg} flex items-center justify-center shadow-md border-2 border-white transition-transform group-hover:scale-110 duration-300`}>
        <NotifTypeIcon type={group.type} size={10} />
      </div>
    </div>
  );
}

// ─── Grouped notification row ─────────────────────────────────────────────────

function GroupRow({
  group,
  onGroupRead,
  onDelete,
  onClose,
}: {
  group: GroupedNotification;
  onGroupRead: (rawIds: string[]) => void;
  onDelete: (rawIds: string[]) => void;
  onClose: () => void;
}) {
  const { profile } = useAppStore();
  const router = useRouter();
  const color = getNotificationColor(group.type);
  const cls = COLOR_CLASSES[color];
  const text = buildNotificationText(group);
  const isFriendRequest = group.type === 'friend_request';
  const [friendDone, setFriendDone] = useState<'accepted' | 'declined' | null>(null);
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    if (!group.read) onGroupRead(group.rawIds);
    router.push(getNotificationLink(group));
    onClose();
  };

  const handleFriendAction = async (action: 'accept' | 'decline') => {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const actorId = group.actors[0]?.uid;
      if (!actorId) return;
      await respondToFriendRequest({ requestOwnerUid: actorId, actorUser: profile, action });
      setFriendDone(action === 'accept' ? 'accepted' : 'declined');
      onGroupRead(group.rawIds);
      setTimeout(() => {
        group.rawIds.forEach((id) => deleteNotification(id).catch(() => {}));
      }, 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, height: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`group relative flex gap-3 px-4 py-3.5 transition-all duration-200 hover:bg-slate-50/80 cursor-pointer ${!group.read ? 'bg-primary/[0.025]' : ''}`}
    >
      {/* Unread indicator bar */}
      {!group.read && (
        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 rounded-r-full ${cls.dot}`} />
      )}

      {/* Avatars */}
      <button onClick={handleClick} className="shrink-0 mt-0.5" tabIndex={-1}>
        <ActorAvatars group={group} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 justify-between">
          <button onClick={handleClick} className="min-w-0 text-left flex-1">
            {/* Main text */}
            <p className={`text-[13.5px] leading-snug ${!group.read ? 'text-slate-900 font-semibold' : 'text-slate-600 font-medium'}`}>
              {/* Bold actor name(s) */}
              <span className="font-bold text-slate-900 flex items-center gap-1 flex-wrap inline">
                {group.actors[0]?.displayName}
                {/* Verified badge for specific users */}
                {group.actors[0]?.uid === 'gONefSw0DwPvTZBmFFIUn0sau4w2' && (
                  <BadgeCheck className="inline w-3.5 h-3.5 text-indigo-600 fill-indigo-600 text-white shrink-0 mx-0.5" strokeWidth={2.5} />
                )}
              </span>{' '}
              {/* Append the rest of the text (after actor name) */}
              {text.replace(/^[^e&].*?\s/, '')}
            </p>

            {/* Context snippet */}
            {group.extraText && (
              <p className="text-[12px] text-slate-400 mt-1 line-clamp-1 italic bg-slate-50/80 rounded-lg px-2 py-0.5 border border-slate-100/60">
                &ldquo;{group.extraText}&rdquo;
              </p>
            )}

            {/* Timestamp */}
            <p className={`text-[11px] mt-1 font-bold uppercase tracking-wider opacity-60 ${cls.icon}`}>
              {group.updatedAt ? (
                <TimeAgo date={group.updatedAt.toDate ? group.updatedAt.toDate() : new Date(group.updatedAt as any)} />
              ) : 'Agora'}
            </p>
          </button>

          {/* Hover actions */}
          <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200 ml-1">
            {!group.read && (
              <button
                onClick={(e) => { e.stopPropagation(); onGroupRead(group.rawIds); }}
                title="Marcar como lida"
                className="w-7 h-7 rounded-full bg-white shadow-sm border border-slate-100 hover:bg-primary/10 hover:text-primary hover:border-primary/20 flex items-center justify-center text-slate-400 transition-all active:scale-90"
              >
                <Check size={13} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(group.rawIds); }}
              title="Remover"
              className="w-7 h-7 rounded-full bg-white shadow-sm border border-slate-100 hover:bg-red-50 hover:text-red-500 hover:border-red-100 flex items-center justify-center text-slate-400 transition-all active:scale-90"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Friend request actions */}
        {isFriendRequest && !friendDone && (
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={() => handleFriendAction('accept')}
              disabled={busy}
              className="px-4 h-8 rounded-full bg-primary text-white text-[12px] font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-95 disabled:opacity-50"
            >
              {busy ? '...' : 'Aceitar'}
            </button>
            <button
              onClick={() => handleFriendAction('decline')}
              disabled={busy}
              className="px-4 h-8 rounded-full bg-slate-100 text-slate-600 text-[12px] font-bold hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
            >
              Recusar
            </button>
            <Link
              href={`/profile/${group.actors[0]?.uid}`}
              onClick={onClose}
              className="ml-auto text-[11px] font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest"
            >
              Ver Perfil
            </Link>
          </div>
        )}

        {friendDone && (
          <div className="mt-2 flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${friendDone === 'accepted' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
              {friendDone === 'accepted' ? <Check size={11} /> : <X size={11} />}
              {friendDone === 'accepted' ? 'Aceito' : 'Recusado'}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Dropdown ────────────────────────────────────────────────────────────

export function NotificationsDropdown() {
  const { groups, unreadCount, loading, markGroupRead, markAllAsRead, remove } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [moreOpen, setMoreOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close when another TopNav dropdown opens
  useEffect(() => {
    const handler = (e: Event) => {
      const name = (e as CustomEvent)?.detail?.name;
      if (name && name !== 'notifications') setIsOpen(false);
    };
    window.addEventListener(DROPDOWN_EVENT, handler);
    return () => window.removeEventListener(DROPDOWN_EVENT, handler);
  }, []);

  useEffect(() => {
    if (isOpen) emitDropdownOpen('notifications');
  }, [isOpen]);

  const filtered = useMemo(
    () => activeTab === 'unread' ? groups.filter((g) => !g.read) : groups,
    [activeTab, groups]
  );

  const handleMarkAll = async () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);
    soundEffects.play('success');
    await markAllAsRead().catch(console.error);
    setIsMarkingAll(false);
  };

  const handleDelete = useCallback(async (rawIds: string[]) => {
    rawIds.forEach((id) => remove(id).catch(console.error));
  }, [remove]);

  const handleGroupRead = useCallback(async (rawIds: string[]) => {
    soundEffects.play('success');
    await markGroupRead(rawIds).catch(console.error);
  }, [markGroupRead]);

  const handleClose = () => setIsOpen(false);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Bell button ── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 group ${
          isOpen ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-600'
        }`}
        aria-label="Notificações"
      >
        <Bell className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'scale-110' : 'group-hover:rotate-12'}`} />
        {unreadCount > 0 && (
          <>
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-gradient-to-br from-rose-500 to-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white shadow-sm z-10">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full animate-ping opacity-20" />
          </>
        )}
      </button>

      {/* ── Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute top-full right-0 mt-3 w-[400px] bg-white/97 backdrop-blur-2xl rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.13),0_4px_16px_rgba(0,0,0,0.06)] border border-white/60 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="font-black text-[17px] text-slate-900 tracking-tight">Notificações</h3>

                <div className="relative" ref={moreRef}>
                  <button
                    onClick={() => setMoreOpen((v) => !v)}
                    className={`p-2 rounded-xl transition-all active:scale-90 ${moreOpen ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                  >
                    <MoreHorizontal size={17} />
                  </button>

                  <AnimatePresence>
                    {moreOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -8 }}
                        className="absolute top-full right-0 mt-2 w-60 bg-white rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-slate-100 z-[60] py-1.5 overflow-hidden"
                      >
                        <button
                          onClick={() => { handleMarkAll(); setMoreOpen(false); }}
                          disabled={isMarkingAll || unreadCount === 0}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 text-left"
                        >
                          <CheckCheck size={15} className="text-primary" />
                          Marcar todas como lidas
                        </button>
                        <div className="h-px bg-slate-50 mx-3 my-1" />
                        <Link
                          href="/notifications"
                          onClick={() => { setMoreOpen(false); handleClose(); }}
                          className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Bell size={15} className="text-slate-400" />
                          Ver todas as notificações
                        </Link>
                        <Link
                          href="/settings/notifications"
                          onClick={() => { setMoreOpen(false); handleClose(); }}
                          className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Sparkles size={15} className="text-amber-500" />
                          Configurações
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-100/60 p-1 rounded-[14px]">
                {(['all', 'unread'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-1.5 text-[12px] font-bold rounded-[10px] transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === tab
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab === 'all' ? 'Todas' : 'Não lidas'}
                    {tab === 'unread' && unreadCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100/60 scrollbar-none">
              {loading ? (
                // Skeleton
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3.5">
                    <div className="w-11 h-11 rounded-full bg-slate-100 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 bg-slate-100 animate-pulse rounded-full w-3/4" />
                      <div className="h-2.5 bg-slate-100 animate-pulse rounded-full w-1/2" />
                    </div>
                  </div>
                ))
              ) : (
                <AnimatePresence initial={false} mode="popLayout">
                  {filtered.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="py-14 px-6 flex flex-col items-center text-center gap-3"
                    >
                      <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-200 border border-slate-100/60 rotate-12">
                        <Bell className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-[15px] text-slate-800 font-bold mb-1">
                          {activeTab === 'unread' ? 'Você está em dia! 🎉' : 'Nada por aqui ainda'}
                        </p>
                        <p className="text-[12.5px] text-slate-500 leading-relaxed">
                          {activeTab === 'unread'
                            ? 'Todas as notificações foram lidas.'
                            : 'Suas interações aparecerão aqui.'}
                        </p>
                      </div>
                      {activeTab === 'unread' && groups.length > 0 && (
                        <button onClick={() => setActiveTab('all')} className="text-[12px] font-bold text-primary hover:underline">
                          Ver todas
                        </button>
                      )}
                    </motion.div>
                  ) : (
                    filtered.map((group) => (
                      <GroupRow
                        key={group.groupKey}
                        group={group}
                        onGroupRead={handleGroupRead}
                        onDelete={handleDelete}
                        onClose={handleClose}
                      />
                    ))
                  )}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {groups.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100/60 bg-slate-50/40">
                <Link
                  href="/notifications"
                  onClick={handleClose}
                  className="block text-center text-[12.5px] font-semibold text-primary hover:text-primary/80 transition-colors py-0.5"
                >
                  Ver todas as notificações →
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── useEffect needs to be imported ──────────────────────────────────────────
// (not destructured above — adding here to avoid lint errors)
import { useEffect } from 'react';
