'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Bell, Heart, MessageCircle, Share2, UserCheck, UserPlus,
  AtSign, Users, Sparkles, Reply, Check, Trash2, CheckCheck, X, MoreHorizontal
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  Notification, NotificationType, NotificationColor,
  subscribeToNotifications, markNotificationRead, markAllNotificationsRead,
  deleteNotification, getNotificationLink, getNotificationColor,
} from '@/lib/notifications';
import { soundEffects } from '@/lib/sound-effects';
import { respondToFriendRequest } from '@/lib/friendships';
import Link from 'next/link';
import { TimeAgo } from './TimeAgo';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';

const DROPDOWN_EVENT = 'topnav:dropdown-open';

function emitDropdownOpen(name: 'messages' | 'notifications') {
  window.dispatchEvent(new CustomEvent(DROPDOWN_EVENT, { detail: { name } }));
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<NotificationColor, { icon: string; bg: string; dot: string }> = {
  red:     { icon: 'text-red-500',     bg: 'bg-red-50',      dot: 'bg-red-500' },
  blue:    { icon: 'text-blue-500',    bg: 'bg-blue-50',     dot: 'bg-blue-500' },
  sky:     { icon: 'text-sky-500',     bg: 'bg-sky-50',      dot: 'bg-sky-500' },
  green:   { icon: 'text-green-500',   bg: 'bg-green-50',    dot: 'bg-green-500' },
  violet:  { icon: 'text-violet-600',  bg: 'bg-violet-50',   dot: 'bg-violet-500' },
  emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-50',  dot: 'bg-emerald-500' },
  amber:   { icon: 'text-amber-500',   bg: 'bg-amber-50',    dot: 'bg-amber-500' },
  primary: { icon: 'text-primary',     bg: 'bg-primary/10',  dot: 'bg-primary' },
};

function NotifIcon({ type, size = 14 }: { type: NotificationType; size?: number }) {
  const color = getNotificationColor(type);
  const cls = `${COLOR_CLASSES[color].icon}`;
  const props = { size, className: cls };
  switch (type) {
    case 'like': return <Heart {...props} fill="currentColor" />;
    case 'comment': return <MessageCircle {...props} fill="currentColor" />;
    case 'reply': return <Reply {...props} />;
    case 'follow': return <UserPlus {...props} />;
    case 'friend_request': return <UserPlus {...props} />;
    case 'friend_accept': return <UserCheck {...props} />;
    case 'share': return <Share2 {...props} />;
    case 'mention': return <AtSign {...props} />;
    case 'community_invite':
    case 'community_post': return <Users {...props} />;
    default: return <Sparkles {...props} />;
  }
}

// ─── Single notification row ───────────────────────────────────────────────────

function NotifRow({
  n,
  compact = false,
  onRead,
  onDelete,
  onClose,
}: {
  n: Notification;
  compact?: boolean;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('common');
  const { profile } = useAppStore();
  const router = useRouter();
  const [friendActionDone, setFriendActionDone] = useState<'accepted' | 'declined' | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const color = getNotificationColor(n.type);
  const colorCls = COLOR_CLASSES[color];
  const isFriendRequest = n.type === 'friend_request';

  const getMessage = () => {
    switch (n.type) {
      case 'like': return t('notifications.reacted_to_post', 'reacted to your post.');
      case 'comment': return t('notifications.commented_on_post', 'commented on your post.');
      case 'reply': return t('notifications.replied_to_comment', 'replied to your comment.');
      case 'follow': return t('notifications.started_following_you', 'started following you.');
      case 'friend_request': return t('notifications.sent_friend_request', 'sent you a friend request.');
      case 'friend_accept': return t('notifications.accepted_friend_request', 'accepted your friend request.');
      case 'share': return t('notifications.shared_post', 'shared your post.');
      case 'mention': return t('notifications.mentioned_you', 'mentioned you in a post.');
      case 'community_invite': return `${t('notifications.invited_you_to', 'invited you to')} ${n.communityName || 'a community'}.`;
      case 'community_post': return `${t('notifications.posted_in', 'posted in')} ${n.communityName || 'your community'}.`;
      default: return t('notifications.generic', 'sent you a notification.');
    }
  };

  const handleClick = () => {
    if (!n.read) onRead(n.id);
    router.push(getNotificationLink(n));
    onClose();
  };

  const handleFriendAction = async (action: 'accept' | 'decline') => {
    if (!profile || isBusy) return;
    setIsBusy(true);
    try {
      await respondToFriendRequest({
        requestOwnerUid: n.actorId,
        actorUser: profile,
        action,
      });
      
      setFriendActionDone(action === 'accept' ? 'accepted' : 'declined');
      onRead(n.id);
      
      // Delay deletion so user sees the "Accepted/Declined" state for a moment
      setTimeout(() => {
        deleteNotification(n.id).catch(console.error);
      }, 2000);
    } catch (e) {
      console.error('Friend action error:', e);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className={`group relative flex gap-3 px-4 py-4 transition-all duration-300 hover:bg-slate-50/80 ${!n.read ? 'bg-primary/[0.02]' : ''}`}
    >
      {!n.read && (
        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-r-full ${colorCls.dot} shadow-[0_0_8px_rgba(0,0,0,0.1)]`} />
      )}

      <button onClick={handleClick} className="relative shrink-0 mt-0.5">
        <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden ring-4 ring-white shadow-sm group-hover:shadow-md transition-all duration-300">
          {n.actorPhoto ? (
            <img src={n.actorPhoto} alt={n.actorName} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-lg">
              {n.actorName?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full ${colorCls.bg} flex items-center justify-center shadow-md border-2 border-white transition-transform group-hover:scale-110 duration-300`}>
          <NotifIcon type={n.type} size={11} />
        </div>
      </button>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-start justify-between gap-2">
          <button onClick={handleClick} className="min-w-0 text-left">
            <p className={`text-[14px] leading-tight ${!n.read ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
              <span className="font-bold text-slate-900">{n.actorName}</span>{' '}
              {getMessage()}
            </p>
            {n.extraText && (
              <p className="text-[12px] text-slate-400 mt-1 line-clamp-1 italic bg-slate-50 rounded-lg px-2 py-1 border border-slate-100/50">&ldquo;{n.extraText}&rdquo;</p>
            )}
            <p className={`text-[11px] mt-1.5 font-bold uppercase tracking-wider opacity-60 ${colorCls.icon}`}>
              {n.createdAt ? (
                <TimeAgo date={n.createdAt.toDate ? n.createdAt.toDate() : new Date(n.createdAt as any)} />
              ) : 'Just now'}
            </p>
          </button>
          
          <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
            {!n.read && (
              <button
                onClick={() => onRead(n.id)}
                title={t('notifications.mark_read', 'Mark as read')}
                className="w-7 h-7 rounded-full bg-white shadow-sm border border-slate-100 hover:bg-primary/10 hover:text-primary hover:border-primary/20 flex items-center justify-center text-slate-400 transition-all active:scale-90"
              >
                <Check size={14} />
              </button>
            )}
            <button
              onClick={() => onDelete(n.id)}
              title={t('notifications.delete', 'Delete')}
              className="w-7 h-7 rounded-full bg-white shadow-sm border border-slate-100 hover:bg-red-50 hover:text-red-500 hover:border-red-100 flex items-center justify-center text-slate-400 transition-all active:scale-90"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {isFriendRequest && !friendActionDone && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => handleFriendAction('accept')}
              disabled={isBusy}
              className="px-4 h-8 rounded-full bg-primary text-white text-[12px] font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isBusy ? t('notifications.processing', '...') : t('notifications.accept', 'Accept')}
            </button>
            <button
              onClick={() => handleFriendAction('decline')}
              disabled={isBusy}
              className="px-4 h-8 rounded-full bg-slate-100 text-slate-600 text-[12px] font-bold hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
            >
              {t('notifications.decline', 'Decline')}
            </button>
            <Link
              href={`/profile/${n.actorId}`}
              onClick={onClose}
              className="ml-auto text-[11px] font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest"
            >
              {t('notifications.profile', 'Profile')}
            </Link>
          </div>
        )}

        {friendActionDone && (
          <div className="mt-2 flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${friendActionDone === 'accepted' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
              {friendActionDone === 'accepted' ? <Check size={12} /> : <X size={12} />}
              {friendActionDone === 'accepted'
                ? t('notifications.accepted', 'Accepted')
                : t('notifications.declined', 'Declined')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

export function NotificationsDropdown() {
  const { t } = useTranslation('common');
  const { profile } = useAppStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // Close when another TopNav dropdown opens (prevents overlap)
  useEffect(() => {
    const handler = (event: Event) => {
      const opened = (event as CustomEvent<any>)?.detail?.name;
      if (opened && opened !== 'notifications') setIsOpen(false);
    };
    window.addEventListener(DROPDOWN_EVENT, handler as EventListener);
    return () => window.removeEventListener(DROPDOWN_EVENT, handler as EventListener);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    emitDropdownOpen('notifications');
  }, [isOpen]);

  // Real-time subscription
  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = subscribeToNotifications(profile.uid, (newList) => {
      setNotifications((prev) => {
        // Play sound only if we have a previous list (not initial load)
        // and there are new unread notifications that weren't in the previous list
        if (prev.length > 0 && newList.length > prev.length) {
          const hasNewUnread = newList.some(n => !n.read && !prev.some(p => p.id === n.id));
          if (hasNewUnread) {
            soundEffects.play('notification');
          }
        }
        return newList;
      });
    }, 30);
    return unsub;
  }, [profile?.uid]);

  // Close on outside click
  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const handleRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await markNotificationRead(id).catch(console.error);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id).catch(console.error);
  }, []);

  const handleMarkAll = async () => {
    if (!profile?.uid || isMarkingAll) return;
    setIsMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsRead(profile.uid).catch(console.error);
    setIsMarkingAll(false);
  };

  const handleOpen = () => setIsOpen((v) => !v);
  const handleClose = () => setIsOpen(false);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative w-10 h-10 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center text-foreground transition-all duration-200 hover:scale-105 active:scale-95"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white shadow-sm animate-in zoom-in-50 duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-3 w-[400px] bg-white/95 backdrop-blur-xl rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-3 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100/50 bg-white/50">
            <div className="flex items-center gap-3">
              <h3 className="font-black text-[17px] text-slate-900 tracking-tight">
                {t('notifications.title', 'Notificações')}
              </h3>
              {unreadCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-[11px] font-black uppercase tracking-wider">
                    {unreadCount} {t('notifications.new_count', 'novas')}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  disabled={isMarkingAll}
                  title={t('notifications.mark_all', 'Marcar todas como lidas')}
                  className="p-2 text-primary hover:bg-primary/5 rounded-full transition-all active:scale-90 disabled:opacity-50"
                >
                  <CheckCheck size={18} />
                </button>
              )}
              <Link
                href="/notifications"
                onClick={handleClose}
                title={t('notifications.see_all', 'Ver tudo')}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all active:scale-90"
              >
                <MoreHorizontal size={18} />
              </Link>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-[13px] text-slate-400 font-medium">
                  {t('notifications.empty', 'No notifications yet.')}
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotifRow
                  key={n.id}
                  n={n}
                  compact
                  onRead={handleRead}
                  onDelete={handleDelete}
                  onClose={handleClose}
                />
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
              <Link
                href="/notifications"
                onClick={handleClose}
                className="block text-center text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors py-1"
              >
                {t('notifications.view_all', 'View all notifications →')}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
