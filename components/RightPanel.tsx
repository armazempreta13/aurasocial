'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Users, Search } from 'lucide-react';
import { db } from '@/firebase';
import { collection, query, limit, getDocs, orderBy, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import { rankTrendingHashtags } from '@/lib/hashtags';
import { useAppStore } from '@/lib/store';
import { useChat } from '@/components/chat/ChatProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, UserRoundCheck, Repeat2 } from 'lucide-react';
import { getSuggestedFriends, getRelationshipSnapshot, sendFriendRequest, toggleFollowUser } from '@/lib/friendships';


export function RightPanel() {
  const currentUser = useAppStore((state) => state.user);
  const { t } = useTranslation('common');
  const { openChatWithUser } = useChat();
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [trendingTags, setTrendingTags] = useState<{ tag: string; score: number }[]>([]);
  const [trendingCommunities, setTrendingCommunities] = useState<any[]>([]);
  const [activeCommunityIndex, setActiveCommunityIndex] = useState(0);
  const [isSearchingActive, setIsSearchingActive] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [relationshipMap, setRelationshipMap] = useState<Record<string, any>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());


  useEffect(() => {
    let unsubscribeFriends: (() => void) | undefined;

    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(120));
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const posts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTrendingTags(rankTrendingHashtags(posts));
    }, (err) => console.error('Error syncing trending posts:', err));

    const communitiesQuery = query(collection(db, 'communities'), orderBy('memberCount', 'desc'), limit(3));
    const unsubscribeCommunities = onSnapshot(communitiesQuery, (snapshot) => {
      setTrendingCommunities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error('Error syncing trending communities:', err));

    const loadSuggestions = async () => {
      if (!currentUser) return;
      try {
        const suggested = await getSuggestedFriends(currentUser.uid);
        setSuggestions(suggested.slice(0, 3));
        
        const map: Record<string, any> = {};
        for (const s of suggested.slice(0, 3)) {
          map[s.id] = await getRelationshipSnapshot(currentUser.uid, s.id);
        }
        setRelationshipMap(map);
      } catch (err) {
        console.error('Error loading suggestions in RightPanel:', err);
      }
    };

    if (currentUser) {
      void loadSuggestions();
    }


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
      unsubscribePosts();
      unsubscribeCommunities();
    };
  }, [currentUser]);

  // Carousel timer
  useEffect(() => {
    if (trendingCommunities.length <= 1) return;
    const interval = setInterval(() => {
      setActiveCommunityIndex((prev) => (prev + 1) % trendingCommunities.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [trendingCommunities.length]);
  
  const filteredActiveUsers = activeUsers.filter(u => 
    u.displayName?.toLowerCase().includes(activeSearchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Trending Communities Carousel */}
      <div className="bg-white rounded-[28px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-border/50 overflow-hidden relative group">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="font-semibold text-[13px] text-foreground uppercase tracking-[0.08em] opacity-50">
            {t('right_panel.communities_title', 'Explorar')}
          </h3>
          <Link href="/communities" className="text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80 transition-opacity">
            {t('sidebar.see_all')}
          </Link>
        </div>
        
        <div className="relative h-[180px] w-full overflow-hidden rounded-[20px] bg-muted/20">
          {trendingCommunities.length > 0 ? (
            trendingCommunities.map((comm, idx) => (
              <Link 
                key={comm.id} 
                href={`/communities/${comm.id}`}
                className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                  idx === activeCommunityIndex 
                    ? 'opacity-100 translate-x-0' 
                    : idx < activeCommunityIndex 
                      ? 'opacity-0 -translate-x-full' 
                      : 'opacity-0 translate-x-full'
                }`}
              >
                <div className="relative h-full w-full group/card">
                  {comm.image ? (
                    <img 
                      src={comm.image} 
                      alt={comm.name} 
                      className="h-full w-full object-cover transition-transform duration-700 group-hover/card:scale-110" 
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                      <span className="text-4xl font-black">{comm.name?.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  
                  {/* Overlay Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  {/* Content Over Image */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-primary text-[9px] font-black text-white uppercase tracking-wider mb-2">
                          Destaque
                        </span>
                        <h4 className="font-bold text-[16px] text-white leading-tight truncate drop-shadow-sm">
                          {comm.name}
                        </h4>
                        <p className="text-[11px] text-white/70 font-medium truncate">
                          {comm.memberCount || 0} {t('right_panel.members', 'membros')}
                        </p>
                      </div>
                      
                      <div className="flex gap-1 h-1.5 items-center mb-1">
                        {trendingCommunities.map((_, dotIdx) => (
                          <div 
                            key={dotIdx}
                            className={`h-1 rounded-full transition-all duration-300 ${
                              dotIdx === activeCommunityIndex ? 'w-4 bg-white' : 'w-1 bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="h-full w-full animate-pulse flex items-center justify-center text-muted-foreground/30">
               <Users className="w-8 h-8" />
            </div>
          )}
        </div>
      </div>
      
      {/* Suggestions Section */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[13px] text-muted-foreground uppercase tracking-wider">
              {t('right_panel.suggestions', 'Sugestões')}
            </h3>
            <Link href="/network" className="text-[10px] font-bold text-primary uppercase hover:underline">
              {t('common.see_all', 'Ver tudo')}
            </Link>
          </div>
          
          <div className="flex flex-col gap-4">
            {suggestions.map((user) => (
              <div key={user.id} className="flex items-center gap-3">
                <Link href={`/profile/${user.id}`} className="shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden ring-1 ring-border/30">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground font-bold text-xs">
                        {user.displayName?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${user.id}`} className="font-bold text-[13px] text-foreground hover:text-primary truncate block">
                    {user.displayName}
                  </Link>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {user.work || t('common.aura_member', 'Membro Aura')}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!currentUser) return;
                    setBusyId(user.id);
                    try {
                      await sendFriendRequest({ fromUser: currentUser as any, toUser: user, source: 'suggestion' });
                      setRelationshipMap(prev => ({ ...prev, [user.id]: { status: 'request_sent' } }));
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  disabled={busyId === user.id || relationshipMap[user.id]?.status === 'request_sent' || relationshipMap[user.id]?.status === 'friends'}
                  className={`p-2 rounded-xl transition-all ${
                    relationshipMap[user.id]?.status === 'friends'
                      ? 'bg-emerald-50 text-emerald-600'
                      : relationshipMap[user.id]?.status === 'request_sent'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary hover:bg-primary hover:text-white shadow-sm'
                  }`}
                >
                  {relationshipMap[user.id]?.status === 'friends' ? (
                    <UserRoundCheck className="w-4 h-4" />
                  ) : relationshipMap[user.id]?.status === 'request_sent' ? (
                    <Repeat2 className="w-4 h-4" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending Topics */}


      {/* Active Connections */}
      <div className="relative">
        <div className="flex justify-between items-center mb-3 px-1">
          <AnimatePresence mode="wait">
            {!isSearchingActive ? (
              <motion.h3 
                key="title"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-semibold text-[13px] text-muted-foreground uppercase tracking-wider"
              >
                {t('right_panel.active_now', 'Active Now')}
              </motion.h3>
            ) : (
              <motion.div 
                key="search-box"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '100%', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="flex-1 mr-2"
              >
                <input 
                  autoFocus
                  type="text"
                  value={activeSearchQuery}
                  onChange={(e) => setActiveSearchQuery(e.target.value)}
                  placeholder="Pesquisar..."
                  className="w-full h-8 bg-muted/50 rounded-full px-4 text-xs outline-none focus:ring-1 ring-primary/30 transition-all"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            onClick={() => {
              setIsSearchingActive(!isSearchingActive);
              if (isSearchingActive) setActiveSearchQuery('');
            }}
            className="text-muted-foreground hover:text-primary transition-colors p-1"
          >
            {isSearchingActive ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
        
        <div className="flex flex-col gap-1">
          {filteredActiveUsers.length > 0 ? (
            filteredActiveUsers.map((user) => (
              <button 
                key={user.id} 
                onClick={() => openChatWithUser({
                  uid: user.id,
                  displayName: user.displayName,
                  photoURL: user.photoURL
                }, 'floating')}
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
                <span className="font-medium text-[14px] text-foreground text-left">{user.displayName}</span>
              </button>
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
