'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/lib/store';
import {
  Bell, Heart, MessageCircle, Share2, UserCheck, UserPlus,
  AtSign, Users, Sparkles, Reply, CheckCheck, Trash2, Check, X, Filter, BadgeCheck
} from 'lucide-react';
import Link from 'next/link';
import { TimeAgo } from '@/components/TimeAgo';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import {
  Notification, NotificationType, NotificationColor,
  subscribeToNotifications, markNotificationRead, markAllNotificationsRead,
  deleteNotification, deleteAllNotifications, getNotificationLink, getNotificationColor,
} from '@/lib/notifications';
import { respondToFriendRequest, getRelationshipSnapshot, RelationshipStatus } from '@/lib/friendships';

// ─── Colour map ───────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<NotificationColor, { icon: string; bg: string; border: string; dot: string }> = {
  red:     { icon: 'text-red-500',     bg: 'bg-red-50',      border: 'border-red-100',      dot: 'bg-red-500' },
  blue:    { icon: 'text-blue-500',    bg: 'bg-blue-50',     border: 'border-blue-100',     dot: 'bg-blue-500' },
  sky:     { icon: 'text-sky-500',     bg: 'bg-sky-50',      border: 'border-sky-100',      dot: 'bg-sky-500' },
  green:   { icon: 'text-green-500',   bg: 'bg-green-50',    border: 'border-green-100',    dot: 'bg-green-500' },
  violet:  { icon: 'text-violet-600',  bg: 'bg-violet-50',   border: 'border-violet-100',   dot: 'bg-violet-500' },
  emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100',  dot: 'bg-emerald-500' },
  amber:   { icon: 'text-amber-500',   bg: 'bg-amber-50',    border: 'border-amber-100',    dot: 'bg-amber-500' },
  rose:    { icon: 'text-rose-500',    bg: 'bg-rose-50',     border: 'border-rose-100',     dot: 'bg-rose-500' },
  orange:  { icon: 'text-orange-500',  bg: 'bg-orange-50',   border: 'border-orange-100',   dot: 'bg-orange-500' },
  primary: { icon: 'text-primary',     bg: 'bg-primary/10',  border: 'border-primary/20',   dot: 'bg-primary' },
};

function NotifIcon({ type, size = 16 }: { type: NotificationType; size?: number }) {
  const color = getNotificationColor(type);
  const cls = COLOR_CLASSES[color].icon;
  const p = { size, className: cls };
  switch (type) {
    case 'like': return <Heart {...p} fill="currentColor" />;
    case 'comment': return <MessageCircle {...p} fill="currentColor" />;
    case 'reply': return <Reply {...p} />;
    case 'follow': return <UserPlus {...p} />;
    case 'friend_request': return <UserPlus {...p} />;
    case 'friend_accept': return <UserCheck {...p} />;
    case 'share': return <Share2 {...p} />;
    case 'mention': return <AtSign {...p} />;
    case 'community_invite':
    case 'community_post': return <Users {...p} />;
    default: return <Sparkles {...p} />;
  }
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread' | 'social' | 'posts' | 'communities';

const FILTER_TABS: { id: FilterTab; label: string; types?: NotificationType[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'social',      label: 'Social', types: ['follow', 'friend_request', 'friend_accept'] },
  { id: 'posts',       label: 'Posts', types: ['like', 'comment', 'reply', 'share', 'mention'] },
  { id: 'communities', label: 'Communities', types: ['community_invite', 'community_post'] },
];

// ─── Date group helpers ────────────────────────────────────────────────────────

function getDateLabel(n: Notification): string {
  const date: Date = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  if (diffDays < 30) return 'This month';
  return 'Older';
}

const DATE_ORDER = ['Today', 'Yesterday', 'This week', 'This month', 'Older'];

// ─── Full notification row ─────────────────────────────────────────────────────

function NotifCard({ n, onRead, onDelete }: {
  n: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation('common');
  const { profile } = useAppStore();
  const router = useRouter();
  const [friendDone, setFriendDone] = useState<'accepted' | 'declined' | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<RelationshipStatus | null>(null);
  const color = getNotificationColor(n.type);
  const cls = COLOR_CLASSES[color];
  const isFriendRequest = n.type === 'friend_request';

  useEffect(() => {
    let isMounted = true;
    if (isFriendRequest && !friendDone && profile?.uid) {
      getRelationshipSnapshot(profile.uid, n.actorId).then(snap => {
        if (isMounted && (snap.status === 'friends' || snap.status === 'muted')) {
          setFriendDone('accepted');
          // Auto-delete after 5 seconds if already accepted elsewhere
          setTimeout(() => {
            if (isMounted) onDelete(n.id);
          }, 5000);
        }
        if (isMounted) setCurrentStatus(snap.status);
      });
    }
    return () => { isMounted = false; };
  }, [isFriendRequest, friendDone, profile?.uid, n.actorId, n.id, onDelete]);

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

  const handleNavigate = () => {
    if (!n.read) onRead(n.id);
    router.push(getNotificationLink(n));
  };

  const handleFriend = async (action: 'accept' | 'decline') => {
    if (!profile || isBusy) return;
    setIsBusy(true);
    try {
      await respondToFriendRequest({ requestOwnerUid: n.actorId, actorUser: profile, action });
      setFriendDone(action === 'accept' ? 'accepted' : 'declined');
      onRead(n.id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className={`group relative flex items-start gap-4 p-5 transition-all hover:bg-slate-50/80 rounded-2xl ${!n.read ? 'bg-primary/[0.025]' : ''}`}>
      {!n.read && (
        <span className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${cls.dot}`} />
      )}

      <button onClick={handleNavigate} className="relative shrink-0">
        <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden ring-2 ring-white shadow-md">
          {n.actorPhoto ? (
            <img src={n.actorPhoto} alt={n.actorName} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-lg bg-gradient-to-br from-slate-50 to-slate-200">
              {n.actorName?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </div>
        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${cls.bg} border-2 border-white flex items-center justify-center shadow-sm`}>
          <NotifIcon type={n.type} size={11} />
        </div>
      </button>

      <div className="flex-1 min-w-0">
        {isFriendRequest ? (
          <div className="rounded-3xl border border-primary/15 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] leading-snug text-slate-900 font-medium">
                  <Link
                    href={`/profile/${n.actorId}`}
                    className="font-bold text-slate-900 hover:text-primary transition-colors flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {n.actorName}
                    {(n.actorName?.toLowerCase().includes('philippe boechat') || n.actorId === 'gONefSw0DwPvTZBmFFIUn0sau4w2') && (
                      <BadgeCheck className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600 text-white shrink-0" strokeWidth={2.5} />
                    )}
                  </Link>{' '}
                  {getMessage()}
                </p>
                <p className={`mt-1.5 text-[12px] font-semibold ${cls.icon}`}>
                  {n.createdAt ? (
                    <TimeAgo date={n.createdAt.toDate ? n.createdAt.toDate() : new Date(n.createdAt as any)} />
                  ) : 'Just now'}
                </p>
              </div>

              <Link
                href={`/profile/${n.actorId}`}
                className="shrink-0 text-[12px] font-semibold text-slate-500 hover:text-primary transition-colors"
              >
                {t('notifications.view_profile', 'Ver Perfil')}
              </Link>
            </div>

            {!friendDone ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handleFriend('accept')}
                  disabled={isBusy}
                  className="min-w-[132px] px-4 h-10 bg-primary text-white text-[13px] font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm shadow-primary/20"
                >
                  {isBusy ? t('notifications.processing', 'Processing...') : t('network_page.accept', 'Accept')}
                </button>
                <button
                  onClick={() => handleFriend('decline')}
                  disabled={isBusy}
                  className="min-w-[132px] px-4 h-10 bg-slate-100 text-slate-700 text-[13px] font-semibold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  {t('network_page.decline', 'Decline')}
                </button>
              </div>
            ) : (
              <p className={`mt-3 text-[13px] font-semibold ${friendDone === 'accepted' ? 'text-emerald-600' : 'text-slate-500'}`}>
                {friendDone === 'accepted'
                  ? t('notifications.accepted', 'Request accepted')
                  : t('notifications.declined', 'Request declined')}
              </p>
            )}
          </div>
        ) : (
          <>
            <button onClick={handleNavigate} className="text-left w-full group/text">
              <p className={`text-[14px] leading-snug ${!n.read ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                <Link
                  href={`/profile/${n.actorId}`}
                  className="font-bold text-slate-900 hover:text-primary transition-colors flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {n.actorName}
                  {(n.actorName?.toLowerCase().includes('philippe boechat') || n.actorId === 'gONefSw0DwPvTZBmFFIUn0sau4w2') && (
                    <BadgeCheck className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600 text-white shrink-0" strokeWidth={2.5} />
                  )}
                </Link>{' '}
                {getMessage()}
                {n.communityName && (n.type === 'community_invite' || n.type === 'community_post') && n.communityId && (
                  <Link
                    href={`/communities/${n.communityId}`}
                    className="ml-1 text-primary font-semibold hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {n.communityName}
                  </Link>
                )}
              </p>
              {n.extraText && (
                <p className="mt-1 text-[13px] text-slate-400 line-clamp-2 italic border-l-2 border-slate-200 pl-3">
                  &ldquo;{n.extraText}&rdquo;
                </p>
              )}
            </button>

            <p className={`mt-1.5 text-[12px] font-semibold ${cls.icon}`}>
              {n.createdAt ? (
                <TimeAgo date={n.createdAt.toDate ? n.createdAt.toDate() : new Date(n.createdAt as any)} />
              ) : 'Just now'}
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!n.read && (
          <button
            onClick={() => onRead(n.id)}
            title={t('notifications.mark_read', 'Mark as read')}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-primary/10 hover:text-primary flex items-center justify-center text-slate-400 transition-colors"
          >
            <Check size={14} />
          </button>
        )}
        <button
          onClick={() => onDelete(n.id)}
          title={t('notifications.delete', 'Delete')}
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-slate-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { t } = useTranslation('common');
  const { user, isAuthReady: gateReady } = useRequireAuth();
  const { profile, isAuthReady } = useAppStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    if (!isAuthReady || !profile) return;
    const unsub = subscribeToNotifications(profile.uid, (items) => {
      setNotifications(items);
      setLoading(false);
    });
    return unsub;
  }, [profile, isAuthReady]);

  const handleRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await markNotificationRead(id).catch(console.error);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id).catch(console.error);
  }, []);

  if (!gateReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  const handleMarkAll = async () => {
    if (!profile?.uid || isMarkingAll) return;
    setIsMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsRead(profile.uid).catch(console.error);
    setIsMarkingAll(false);
  };

  const handleDeleteAll = async () => {
    if (!profile?.uid || isDeletingAll) return;
    if (!confirm(t('notifications.delete_all_confirm', 'Delete all notifications? This cannot be undone.'))) return;
    setIsDeletingAll(true);
    setNotifications([]);
    await deleteAllNotifications(profile.uid).catch(console.error);
    setIsDeletingAll(false);
  };

  const filtered = useMemo(() => {
    const tab = FILTER_TABS.find((f) => f.id === activeTab);
    if (!tab) return notifications;
    if (activeTab === 'all') return notifications;
    if (activeTab === 'unread') return notifications.filter((n) => !n.read);
    if (tab.types) return notifications.filter((n) => tab.types!.includes(n.type));
    return notifications;
  }, [notifications, activeTab]);

  // Group by date label
  const grouped = useMemo(() => {
    const map: Record<string, Notification[]> = {};
    filtered.forEach((n) => {
      const label = getDateLabel(n);
      if (!map[label]) map[label] = [];
      map[label].push(n);
    });
    return DATE_ORDER.filter((l) => map[l]?.length).map((label) => ({ label, items: map[label] }));
  }, [filtered]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return (
    <AppLayout>
      <div className="mb-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary relative">
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('notifications_page.title', 'Notifications')}</h1>
              <p className="text-[13px] text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} ${t('notifications_page.unread', 'unread')}`
                  : t('notifications_page.subtitle', 'Stay updated with your community')}
              </p>
            </div>
          </div>

          {/* Action menu */}
          <div className="relative">
            <button
              onClick={() => setShowActions((v) => !v)}
              className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors"
            >
              <Filter size={14} />
              {t('notifications_page.actions', 'Actions')}
            </button>
            {showActions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl border border-slate-100 shadow-xl z-20 overflow-hidden py-1">
                  <button
                    onClick={() => { handleMarkAll(); setShowActions(false); }}
                    disabled={isMarkingAll || unreadCount === 0}
                    className="w-full text-left px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-3 disabled:opacity-40 transition-colors"
                  >
                    <CheckCheck size={15} className="text-primary" />
                    {t('notifications_page.mark_all', 'Mark all as read')}
                  </button>
                  <button
                    onClick={() => { handleDeleteAll(); setShowActions(false); }}
                    disabled={isDeletingAll || notifications.length === 0}
                    className="w-full text-left px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 flex items-center gap-3 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 size={15} />
                    {t('notifications_page.delete_all', 'Delete all')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl mb-6 overflow-x-auto scrollbar-hide">
          {FILTER_TABS.map((tab) => {
            const count = tab.id === 'unread'
              ? unreadCount
              : tab.types
                ? notifications.filter((n) => tab.types!.includes(n.type)).length
                : notifications.length;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all ${isActive ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/50'}`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 h-20 animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-7 h-7 text-slate-300" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">
              {activeTab === 'unread'
                ? t('notifications_page.all_read', 'All caught up!')
                : t('notifications_page.empty_title', 'No notifications yet')}
            </h2>
            <p className="text-[14px] text-muted-foreground max-w-xs mx-auto">
              {activeTab === 'unread'
                ? t('notifications_page.all_read_desc', 'You\'ve read all your notifications.')
                : t('notifications_page.empty_desc', 'When people interact with you or your posts, you\'ll see it here.')}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ label, items }) => (
              <div key={label}>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-2 mb-2">{label}</p>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
                  {items.map((n) => (
                    <NotifCard key={n.id} n={n} onRead={handleRead} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
