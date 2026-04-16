'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Bell, Heart, MessageCircle, Share2, UserCheck, UserPlus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { db } from '@/firebase';
import { doc, updateDoc, limit, query, collection, where, orderBy, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import { TimeAgo } from './TimeAgo';
import { useTranslation } from 'react-i18next';

export function NotificationsDropdown() {
  const { t } = useTranslation('common');
  const profile = useAppStore((state) => state.profile);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read),
    [notifications]
  );

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      }));
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      setUnreadCount(0);
      void Promise.all(
        unreadNotifications.map((notification) => updateDoc(doc(db, 'notifications', notification.id), { read: true }))
      );
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
      case 'comment': return <MessageCircle className="w-4 h-4 text-blue-500 fill-blue-500" />;
      case 'follow': return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'friend_request': return <UserPlus className="w-4 h-4 text-primary" />;
      case 'friend_accept': return <UserCheck className="w-4 h-4 text-emerald-600" />;
      case 'share': return <Share2 className="w-4 h-4 text-violet-600" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getMessage = (n: any) => {
    switch (n.type) {
      case 'like': return <span><span className="font-semibold">{n.actorName}</span> {t('notifications.reacted_to_post', 'reacted to your post.')}</span>;
      case 'comment': return <span><span className="font-semibold">{n.actorName}</span> {t('notifications.commented_on_post', 'commented on your post.')}</span>;
      case 'follow': return <span><span className="font-semibold">{n.actorName}</span> {t('notifications.started_following_you', 'started following you.')}</span>;
      case 'friend_request': return <span><span className="font-semibold">{n.actorName}</span> {t('notifications.sent_friend_request', 'sent you a friend request.')}</span>;
      case 'friend_accept': return <span><span className="font-semibold">{n.actorName}</span> {t('notifications.accepted_friend_request', 'accepted your friend request.')}</span>;
      case 'share': return <span><span className="font-semibold">{n.actorName}</span> {t('notifications.shared_post', 'shared your post.')}</span>;
      default: return <span>{t('notifications.new_from', { name: n.actorName, defaultValue: `New notification from ${n.actorName}` })}</span>;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleOpen}
        className="w-10 h-10 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center text-foreground transition-colors relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-[360px] bg-white rounded-2xl shadow-xl border border-border/50 overflow-hidden z-50">
          <div className="p-4 border-b border-border/50 flex justify-between items-center">
            <h3 className="font-bold text-lg">{t('notifications.title', 'Notifications')}</h3>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map(n => (
                <div key={n.id} className={`p-4 border-b border-border/50 hover:bg-muted/30 transition-colors flex gap-3 ${!n.read ? 'bg-primary/5' : ''}`}>
                  <Link href={`/profile/${n.actorId}`} className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                      {n.actorPhoto ? (
                        <img src={n.actorPhoto} alt={n.actorName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium">
                          {n.actorName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm border border-border/50">
                      {getIcon(n.type)}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-foreground leading-snug">
                      {getMessage(n)}
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-1">
                      {n.createdAt ? (
                        <TimeAgo date={n.createdAt.toDate ? n.createdAt.toDate() : new Date(n.createdAt)} />
                      ) : (
                        'Just now'
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 opacity-50">
                  <Bell className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">{t('notifications.empty', 'No notifications yet.')}</p>
              </div>
            )}
          </div>
          <Link 
            href="/notifications" 
            onClick={() => setIsOpen(false)}
            className="p-3 text-center block text-[13px] font-bold text-primary hover:bg-primary/5 border-t border-border/50 bg-gray-50/50 transition-colors"
          >
            {t('notifications.see_all', 'See all notifications')}
          </Link>
        </div>
      )}
    </div>
  );
}
