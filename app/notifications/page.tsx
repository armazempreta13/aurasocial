'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { collection, query, onSnapshot, where, orderBy, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAppStore } from '@/lib/store';
import { Bell, Heart, MessageCircle, Share2, UserCheck, UserPlus, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { TimeAgo } from '@/components/TimeAgo';
import { useTranslation } from 'react-i18next';

export default function NotificationsPage() {
  const { t } = useTranslation('common');
  const { profile, isAuthReady } = useAppStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady || !profile) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notificationsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, isAuthReady]);

  const markAllAsRead = async () => {
    if (!profile || notifications.length === 0) return;
    
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(db);
    unreadNotifications.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    
    try {
      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-4 h-4 text-red-500 fill-current" />;
      case 'comment': return <MessageCircle className="w-4 h-4 text-blue-500 fill-current" />;
      case 'follow': return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'friend_request': return <UserPlus className="w-4 h-4 text-primary" />;
      case 'friend_accept': return <UserCheck className="w-4 h-4 text-emerald-600" />;
      case 'share': return <Share2 className="w-4 h-4 text-violet-600" />;
      default: return <Bell className="w-4 h-4 text-primary" />;
    }
  };

  const getMessage = (notification: any) => {
    switch (notification.type) {
      case 'like': return t('notifications_page.liked', 'liked your post');
      case 'comment': return t('notifications_page.commented', 'commented on your post');
      case 'follow': return t('notifications_page.followed', 'started following you');
      case 'friend_request': return t('notifications_page.sent_request', 'sent you a friend request');
      case 'friend_accept': return t('notifications_page.accepted_request', 'accepted your friend request');
      case 'share': return t('notifications_page.shared', 'shared your post');
      default: return t('notifications_page.default_msg', 'sent you a notification');
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('notifications_page.title', 'Notifications')}</h1>
              <p className="text-muted-foreground">{t('notifications_page.subtitle', 'Stay updated with your community')}</p>
            </div>
          </div>
          <button 
            onClick={markAllAsRead}
            className="text-sm font-semibold text-primary hover:bg-primary/5 px-4 py-2 rounded-xl transition-colors"
          >
            {t('notifications_page.mark_all', 'Mark all as read')}
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 h-20 animate-pulse border border-border/50"></div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-border/50 shadow-sm">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Bell className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{t('notifications_page.empty_title', 'No notifications yet')}</h2>
            <p className="text-muted-foreground max-w-xs mx-auto">
              {t('notifications_page.empty_desc', 'When people interact with you or your posts, you\'ll see it here.')}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-border/50 shadow-sm overflow-hidden">
            {notifications.map((notification, index) => (
              <div 
                key={notification.id}
                className={`flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer relative ${
                  !notification.read ? 'bg-primary/[0.02]' : ''
                } ${index !== notifications.length - 1 ? 'border-b border-border/50' : ''}`}
              >
                {!notification.read && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                )}
                
                <Link href={`/profile/${notification.actorId}`} className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden ring-2 ring-white">
                    {notification.actorPhoto ? (
                      <img src={notification.actorPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground font-bold">
                        {notification.actorName?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center border border-border/50">
                    {getIcon(notification.type)}
                  </div>
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <Link href={`/profile/${notification.actorId}`} className="font-bold text-foreground hover:text-primary transition-colors">
                      {notification.actorName}
                    </Link>
                    <span className="text-muted-foreground">{getMessage(notification)}</span>
                    {notification.postId && (
                      <Link href={`/profile/${profile?.uid}`} className="text-primary font-medium hover:underline">
                        {t('notifications_page.your_post', 'your post')}
                      </Link>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <TimeAgo date={notification.createdAt?.toDate ? notification.createdAt.toDate() : new Date()} />
                  </div>
                </div>

                <button className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
