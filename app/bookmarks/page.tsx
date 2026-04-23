'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAppStore } from '@/lib/store';
import { Bookmark, Search } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { useTranslation } from 'react-i18next';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function BookmarksPage() {
  const { t } = useTranslation('common');
  const { profile, isAuthReady } = useAppStore();
  const { user, isAuthReady: gateReady } = useRequireAuth();
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  if (!gateReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  useEffect(() => {
    if (!isAuthReady || !profile) return;

    const q = query(
      collection(db, 'bookmarks'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookmarksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBookmarks(bookmarksData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching bookmarks:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, isAuthReady]);

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <Bookmark className="w-6 h-6 fill-current" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('bookmarks_page.title', 'Saved Items')}</h1>
            <p className="text-muted-foreground">{t('bookmarks_page.subtitle', 'Posts you\'ve saved for later')}</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl p-6 h-48 animate-pulse border border-border/50"></div>
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-border/50 shadow-sm">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Bookmark className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{t('bookmarks_page.empty_title', 'No saved items yet')}</h2>
            <p className="text-muted-foreground max-w-xs mx-auto">
              {t('bookmarks_page.empty_desc', 'Save posts to easily find them later. They\'ll appear here.')}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {bookmarks.map((bookmark) => (
              <PostCard 
                key={bookmark.postId} 
                post={{
                  id: bookmark.postId,
                  ...bookmark.postData
                }} 
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
