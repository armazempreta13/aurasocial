'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { collection, query, onSnapshot, where, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAppStore } from '@/lib/store';
import { Users, UserPlus, UserCheck, Search, UserRoundCheck, UserRoundX, ShieldBan, Repeat2 } from 'lucide-react';
import Link from 'next/link';
import { getPendingFriendRequests, getRelationshipSnapshot, getSuggestedFriends, respondToFriendRequest, sendFriendRequest, searchUsers, toggleFollowUser } from '@/lib/friendships';

import { createNotification } from '@/lib/notifications';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '@/hooks/useDebounce';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function NetworkPage() {
  const { t } = useTranslation('common');
  const { user, isAuthReady } = useRequireAuth();
  const { profile } = useAppStore();
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [relationshipMap, setRelationshipMap] = useState<Record<string, any>>({});
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  useEffect(() => {
    if (!profile) return;

    // 1. REAL-TIME: Following list
    const followQ = query(collection(db, 'followers'), where('followerId', '==', profile.uid));
    const unsubscribeFollow = onSnapshot(followQ, (snapshot) => {
      const followingIds = new Set(snapshot.docs.map(doc => doc.data().followingId));
      setFollowing(followingIds);
    }, (error) => {
      console.error('Error in network follow sub:', error);
    });

    // 2. REAL-TIME: Pending Friend Requests
    const requestsQ = query(
      collection(db, 'friend_requests'),
      where('toUid', '==', profile.uid),
      where('status', '==', 'pending')
    );
    
    const unsubscribeRequests = onSnapshot(requestsQ, async (snapshot) => {
      const requestPromises = snapshot.docs.map(async (requestDoc) => {
        const requestData = requestDoc.data();
        const userSnap = await getDoc(doc(db, 'users', requestData.fromUid));
        return {
          id: requestDoc.id,
          ...requestData,
          user: userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null,
        };
      });
      
      const resolvedRequests = (await Promise.all(requestPromises)).filter(r => r.user);
      setPendingRequests(resolvedRequests.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });

    // 3. One-time load for suggestions (suggestions are complex and better as a fetch)
    const loadSuggestions = async () => {
      try {
        const suggestions = await getSuggestedFriends(profile.uid);
        setUsers(suggestions);

        const relationshipEntries = await Promise.allSettled(
          suggestions.map(async (user) => [user.id, await getRelationshipSnapshot(profile.uid, user.id)] as const)
        );

        const map: Record<string, any> = {};
        relationshipEntries.forEach((res) => {
          if (res.status === 'fulfilled') {
            const [id, snap] = res.value;
            map[id] = snap;
          }
        });
        setRelationshipMap(map);
      } catch (error) {
        console.error('Error loading suggestions:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadSuggestions();

    return () => {
      unsubscribeFollow();
      unsubscribeRequests();
    };
  }, [profile]);


  const debouncedSearch = useDebounce(searchQuery, 400);

  useEffect(() => {
    const performSearch = async () => {
      if (!profile) return;
      if (!debouncedSearch.trim()) {
        setFilteredUsers(users);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchUsers(debouncedSearch, profile.uid);
        
        // Load relationships for search results
        const relationshipEntries = await Promise.allSettled(
          results.map(async (user) => [user.id, await getRelationshipSnapshot(profile.uid, user.id)] as const)
        );

        const map: Record<string, any> = { ...relationshipMap };
        relationshipEntries.forEach((res) => {
          if (res.status === 'fulfilled') {
            const [id, snap] = res.value;
            map[id] = snap;
          }
        });

        setRelationshipMap(map);
        setFilteredUsers(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    void performSearch();
  }, [debouncedSearch, users, profile]);

  const toggleFollow = async (targetUserId: string, targetUserName: string, targetUserPhoto: string) => {
    if (!profile) return;

    try {
      await toggleFollowUser({
        followerUid: profile.uid,
        followingUid: targetUserId,
        isFollowing: following.has(targetUserId),
        followerName: profile.displayName,
        followerPhoto: profile.photoURL
      });
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };


  const refreshCards = async () => {
    if (!profile) return;
    const suggestions = await getSuggestedFriends(profile.uid);
    const requests = await getPendingFriendRequests(profile.uid);
    const relationshipEntries = await Promise.all(
      suggestions.map(async (user) => [user.id, await getRelationshipSnapshot(profile.uid, user.id)] as const)
    );
    setUsers(suggestions);
    setPendingRequests(requests);
    setRelationshipMap(Object.fromEntries(relationshipEntries));
  };

  const handleSendFriendRequest = async (user: any) => {
    if (!profile) return;

    setBusyId(user.id);
    try {
      await sendFriendRequest({
        fromUser: profile,
        toUser: user,   // friendships.ts now accepts {id} or {uid}
        source: 'suggestion',
      });
      await refreshCards();
    } catch (error: any) {
      alert(error.message || t('network_page.failed_send', 'Failed to send friend request.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleRequestResponse = async (request: any, action: 'accept' | 'decline' | 'ignore') => {
    if (!profile) return;

    setBusyId(request.id);
    try {
      await respondToFriendRequest({
        requestOwnerUid: request.fromUid,
        actorUser: profile,
        action,
      });
      await refreshCards();
    } catch (error: any) {
      alert(error.message || t('network_page.failed_update', 'Failed to update request.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppLayout wide={true} hideRightPanel={true}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('network_page.title', 'Network')}</h1>
              <p className="text-muted-foreground">{t('network_page.subtitle', 'Grow your professional circle')}</p>
            </div>
          </div>
        </div>

        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-primary/5 rounded-[24px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative flex items-center">
            <Search className={`absolute left-5 w-5 h-5 transition-colors ${isSearching ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
            <input 
              type="text" 
              placeholder={t('network_page.search_placeholder', 'Search people by name or interest...')} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/80 backdrop-blur-md border border-border/50 rounded-[22px] py-5 pl-14 pr-6 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-lg shadow-black/[0.02] text-lg font-medium"
            />
            {isSearching && (
              <div className="absolute right-5">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        <h2 className="text-lg font-bold text-foreground mb-4 px-2">
          {searchQuery ? t('network_page.search_results', 'Search Results') : t('network_page.people_you_may_know', 'People you may know')}
        </h2>

        {pendingRequests.length > 0 && (
          <div className="mb-8 bg-white rounded-3xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <UserRoundCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{t('network_page.friend_requests', 'Friend Requests')}</h2>
                <p className="text-sm text-muted-foreground">{t('network_page.friend_requests_desc', 'Respond quickly to people who already share context with you.')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-border/50 p-4 flex items-center gap-4">
                  <Link href={`/profile/${request.user.id}`} className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden shrink-0">
                    {request.user.photoURL ? (
                      <img src={request.user.photoURL} alt={request.user.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground font-bold">
                        {request.user.displayName?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${request.user.id}`} className="font-bold text-foreground hover:text-primary transition-colors">
                      {request.user.displayName}
                    </Link>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {request.message || request.user.bio || t('network_page.wants_to_connect', 'Wants to connect with you.')}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleRequestResponse(request, 'accept')} disabled={busyId === request.id} className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-sm">
                        {t('network_page.accept', 'Accept')}
                      </button>
                      <button onClick={() => handleRequestResponse(request, 'decline')} disabled={busyId === request.id} className="px-4 py-2 rounded-xl bg-muted text-foreground font-bold text-sm">
                        {t('network_page.decline', 'Decline')}
                      </button>
                      <button onClick={() => handleRequestResponse(request, 'ignore')} disabled={busyId === request.id} className="px-4 py-2 rounded-xl text-muted-foreground font-bold text-sm hover:bg-muted">
                        {t('network_page.ignore', 'Ignore')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {loading || isSearching ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-3xl p-6 h-48 animate-pulse border border-border/50"></div>
            ))}
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map(user => (
              <div key={user.id} className="relative bg-white rounded-[32px] p-1 border border-border/40 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
                
                <div className="relative p-6 flex flex-col items-center text-center">
                  <Link href={`/profile/${user.id}`} className="relative mb-4 group/avatar">
                    <div className="w-24 h-24 rounded-full bg-white p-1 shadow-md ring-1 ring-border/50 transition-transform group-hover/avatar:scale-105">
                      <div className="w-full h-full rounded-full bg-gray-100 overflow-hidden">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-3xl font-bold bg-gradient-to-br from-gray-50 to-gray-200">
                            {user.displayName?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    {user.isOnline && (
                      <div className="absolute bottom-1 right-1 w-6 h-6 bg-white rounded-full p-1 shadow-sm">
                        <div className="w-full h-full bg-green-500 rounded-full border-2 border-white" />
                      </div>
                    )}
                  </Link>

                  <Link href={`/profile/${user.id}`} className="font-bold text-[17px] text-foreground hover:text-primary transition-colors mb-0.5">
                    {user.displayName}
                  </Link>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-1 font-medium">
                    {user.work ? `${user.work}` : user.bio || t('network_page.aura_member', 'Aura Member')}
                  </p>

                  <div className="flex flex-wrap justify-center gap-1.5 mb-6 h-6 overflow-hidden">
                    {user.suggestionReasons?.length > 0 ? (
                      user.suggestionReasons.map((reason: string) => (
                        <span key={reason} className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                          {reason}
                        </span>
                      ))
                    ) : user.interests?.slice(0, 2).map((interest: string) => (
                      <span key={interest} className="px-2.5 py-0.5 rounded-full bg-primary/5 text-primary/70 text-[10px] font-bold uppercase tracking-wider">
                        {interest}
                      </span>
                    ))}
                  </div>
                  
                  <div className="w-full grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleSendFriendRequest(user)}
                      disabled={busyId === user.id || relationshipMap[user.id]?.status === 'blocked' || relationshipMap[user.id]?.status === 'request_sent' || relationshipMap[user.id]?.status === 'friends'}
                      className={`py-2.5 rounded-[18px] font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                        relationshipMap[user.id]?.status === 'friends'
                          ? 'bg-emerald-50 text-emerald-700'
                          : relationshipMap[user.id]?.status === 'request_sent'
                            ? 'bg-muted text-foreground opacity-70'
                            : relationshipMap[user.id]?.status === 'blocked'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95'
                      }`}
                    >
                      {relationshipMap[user.id]?.status === 'friends' ? (
                        <UserRoundCheck className="w-3.5 h-3.5" />
                      ) : relationshipMap[user.id]?.status === 'request_sent' ? (
                        <Repeat2 className="w-3.5 h-3.5" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {relationshipMap[user.id]?.status === 'friends' ? t('network_page.friends', 'Friends') :
                         relationshipMap[user.id]?.status === 'request_sent' ? t('network_page.request_sent', 'Sent') :
                         t('network_page.add_friend', 'Add')}
                      </span>
                    </button>

                    <button
                      onClick={() => toggleFollow(user.id, user.displayName, user.photoURL)}
                      className={`py-2.5 rounded-[18px] font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
                        following.has(user.id)
                          ? 'bg-muted/50 border-transparent text-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-100'
                          : 'bg-white border-border/60 text-foreground hover:border-primary/30 hover:bg-primary/[0.02]'
                      }`}
                    >
                      {following.has(user.id) ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          {t('network_page.following', 'Following')}
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          {t('network_page.follow', 'Follow')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 border border-border/50 shadow-sm text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-bold text-foreground mb-2">{t('network_page.no_suggestions_title', 'No suggestions found')}</h3>
            <p className="text-muted-foreground">{t('network_page.no_suggestions_desc', 'Try expanding your interests or joining more communities to find relevant connections.')}</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
