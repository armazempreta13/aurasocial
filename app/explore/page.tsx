'use client';

import { AppLayout } from '@/components/AppLayout';
import { Feed } from '@/components/Feed';
import { Compass, TrendingUp, Hash, Search as SearchIcon, Users } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/firebase';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { rankTrendingHashtags } from '@/lib/hashtags';
import { useRequireAuth } from '@/hooks/useRequireAuth';

function ExploreContent() {
  const { t } = useTranslation('common');
  const { user, isAuthReady } = useRequireAuth();
  const searchParams = useSearchParams();
  const searchQuery = searchParams?.get('q') || '';
  const [activeTab, setActiveTab] = useState<'all' | 'people' | 'posts'>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  useEffect(() => {
    if (!searchQuery) return;
    const fetchUsers = async () => {
      setIsSearchingUsers(true);
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(200)));
        const normalizedQuery = searchQuery.toLowerCase();
        const matchedUsers = usersSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((user: any) =>
            user.displayName?.toLowerCase().includes(normalizedQuery) ||
            user.email?.toLowerCase().includes(normalizedQuery) ||
            user.bio?.toLowerCase().includes(normalizedQuery) ||
            user.username?.toLowerCase().includes(normalizedQuery.replace('@', ''))
          );
        setUsers(matchedUsers);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsSearchingUsers(false);
      }
    };
    fetchUsers();
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery) return;

    const fetchTrending = async () => {
      try {
        const postsSnap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(200)));
        const posts = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const ranked = rankTrendingHashtags(posts).map((x) => x.tag);
        setTrendingTags(ranked);
      } catch (error) {
        console.error('Error fetching trending hashtags:', error);
        setTrendingTags([]);
      }
    };

    void fetchTrending();
  }, [searchQuery]);

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            {searchQuery ? <SearchIcon className="w-6 h-6" /> : <Compass className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {searchQuery ? t('explore_page.search_results', { query: searchQuery, defaultValue: `Search results for "${searchQuery}"` }) : t('explore_page.title', 'Explore')}
            </h1>
            <p className="text-muted-foreground">
              {searchQuery ? t('explore_page.search_subtitle', 'Finding the best content and people for you') : t('explore_page.subtitle', "Discover what's happening in Aura")}
            </p>
          </div>
        </div>

        {searchQuery ? (
          <div className="flex gap-2 mb-6 border-b border-border/50 pb-2">
            {[
              { id: 'all', label: t('explore_page.tab_all', 'Top') },
              { id: 'people', label: t('explore_page.tab_people', 'People') },
              { id: 'posts', label: t('explore_page.tab_posts', 'Posts') }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-2 rounded-full font-semibold text-[14px] transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-primary text-white shadow-sm' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-border/50 mb-8">
            <div className="flex items-center gap-2 mb-4 font-bold text-foreground">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t('explore_page.trending', 'Trending Topics')}
            </div>
            {trendingTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {trendingTags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/explore?q=${encodeURIComponent(tag)}`}
                    className="px-4 py-2 bg-muted/50 hover:bg-primary/10 hover:text-primary rounded-full text-sm font-medium transition-all border border-transparent hover:border-primary/20"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                {t('explore_page.no_trending_yet', 'Ainda não há tópicos em alta.')}
              </div>
            )}
          </div>
        )}

        {searchQuery && (activeTab === 'all' || activeTab === 'people') && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 font-bold text-foreground px-2">
              <Users className="w-5 h-5 text-primary" />
              {t('explore_page.people', 'People')}
            </div>
            {isSearchingUsers ? (
              <div className="text-muted-foreground px-2">{t('explore_page.loading', 'Loading people...')}</div>
            ) : users.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {users.slice(0, activeTab === 'all' ? 4 : undefined).map((user) => (
                  <Link
                    key={user.id}
                    href={`/profile/${user.id}`}
                    className="flex items-center gap-4 p-4 bg-white border border-border/50 rounded-2xl hover:shadow-md transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden ring-2 ring-transparent group-hover:ring-primary/20 transition-all shrink-0">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary font-bold bg-primary/5">
                          {user.displayName?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-foreground truncate">{user.displayName}</h4>
                      {user.username && <p className="text-[12px] text-primary font-bold mt-[-2px]">@{user.username}</p>}
                      <p className="text-[13px] text-muted-foreground truncate">{user.bio || t('explore_page.member', 'Aura Member')}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground px-2 py-4 bg-muted/30 rounded-2xl text-center">
                {t('explore_page.no_people_found', { query: searchQuery, defaultValue: `No people found matching "${searchQuery}"` })}
              </div>
            )}
          </div>
        )}

        {(!searchQuery || activeTab === 'all' || activeTab === 'posts') && (
          <div>
            <div className="flex items-center gap-2 mb-4 font-bold text-foreground px-2">
              {searchQuery ? <SearchIcon className="w-5 h-5 text-primary" /> : <Hash className="w-5 h-5 text-primary" />}
              {searchQuery ? t('explore_page.posts', 'Posts') : t('explore_page.recommended', 'Recommended for you')}
            </div>
            <Feed searchQuery={searchQuery || undefined} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <ExploreContent />
    </Suspense>
  );
}
