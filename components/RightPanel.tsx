'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, TrendingUp, Users, Search } from 'lucide-react';
import { db } from '@/firebase';
import { collection, query, limit, getDocs, orderBy, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import { rankTrendingHashtags } from '@/lib/hashtags';
import { useAppStore } from '@/lib/store';

export function RightPanel() {
  const currentUser = useAppStore((state) => state.user);
  const { t } = useTranslation('common');
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [trendingTags, setTrendingTags] = useState<{ tag: string; score: number }[]>([]);

  useEffect(() => {
    let unsubscribeFriends: (() => void) | undefined;

    const loadStaticData = async () => {
      const [postsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(120))),
      ]);
      const posts = postsSnapshot.docs.map((postDoc) => ({
        id: postDoc.id,
        ...postDoc.data(),
      }));
      setTrendingTags(rankTrendingHashtags(posts));
    };

    void loadStaticData();

    if (!currentUser) {
      setActiveUsers([]);
      return;
    }

    try {
      const friendsQuery = query(
        collection(db, 'friendships'),
        where('users', 'array-contains', currentUser.uid)
      );
      
      unsubscribeFriends = onSnapshot(friendsQuery, async (friendsSnap) => {
        const friendIds = friendsSnap.docs
          .map(docSnap => docSnap.data())
          .filter(data => data.status === 'active')
          .map(data => data.users?.find((id: string) => id !== currentUser.uid))
          .filter(Boolean);

        if (friendIds.length > 0) {
          const friendPromises = friendIds.slice(0, 15).map(id => getDoc(doc(db, 'users', id)));
          const friendSnaps = await Promise.all(friendPromises);
          
          const friendsData = friendSnaps
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }));
            
          setActiveUsers(friendsData);
        } else {
          setActiveUsers([]);
        }
      }, (error) => {
        console.error('Error loading friends for active panel:', error);
      });
    } catch (error) {
      console.error('Error setting up friends listener:', error);
    }

    return () => {
      if (unsubscribeFriends) unsubscribeFriends();
    };
  }, [currentUser]);

  return (
    <div className="flex flex-col gap-6">
      {/* Spotlight */}
      <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h3 className="font-semibold text-[14px] text-foreground">{t('right_panel.spotlight', 'Spotlight')}</h3>
        </div>
        
        <Link href="/explore" className="group cursor-pointer block">
          <div className="w-full h-[140px] rounded-xl bg-gray-100 overflow-hidden mb-3 relative">
            <img src="https://picsum.photos/seed/design/400/200" alt="Spotlight" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md font-medium uppercase tracking-wider">
              {t('right_panel.featured', 'Featured')}
            </div>
          </div>
          <h4 className="font-semibold text-[15px] text-foreground leading-tight mb-1 group-hover:text-primary transition-colors">{t('right_panel.ui_design_title', 'The Future of UI Design')}</h4>
          <p className="text-[13px] text-muted-foreground line-clamp-2">{t('right_panel.ui_design_desc', 'Explore the latest trends in glassmorphism, neo-brutalism, and spatial interfaces.')}</p>
        </Link>
      </div>

      {/* Trending Topics */}
      <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-[14px] text-foreground">{t('right_panel.trending_now', 'Trending Now')}</h3>
        </div>
        {trendingTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {trendingTags.map(({ tag, score }) => (
              <Link 
                key={tag} 
                href={`/explore?q=${encodeURIComponent(tag)}`}
                className="px-3 py-1.5 bg-muted/50 hover:bg-primary/10 hover:text-primary text-muted-foreground text-[13px] rounded-lg cursor-pointer transition-colors font-medium"
                title={`Trending score ${score}`}
              >
                {tag}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Trending tags will appear here as soon as people start posting with hashtags.
          </p>
        )}
      </div>

      {/* Active Connections */}
      <div>
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="font-semibold text-[14px] text-muted-foreground uppercase tracking-wider">{t('right_panel.active_now', 'Active Now')}</h3>
          <Link href="/network" className="text-muted-foreground hover:text-primary transition-colors">
            <Search className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="flex flex-col gap-1">
          {activeUsers.length > 0 ? (
            activeUsers.map((user) => (
              <Link 
                key={user.id} 
                href={`/profile/${user.id}`}
                className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all group"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium text-sm">
                        {user.displayName?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
                </div>
                <span className="font-medium text-[14px] text-foreground">{user.displayName}</span>
              </Link>
            ))
          ) : (
            <div className="text-center py-6 px-4">
              <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {t('right_panel.no_friends_online', "You don't have any friends online right now. They will appear here when they connect!")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
