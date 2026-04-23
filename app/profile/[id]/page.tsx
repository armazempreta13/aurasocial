'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { TopNav } from '@/components/TopNav';
import { Settings, MapPin, Calendar, Image as ImageIcon, Heart, MessageSquare, CheckCircle, Briefcase, GraduationCap, Heart as HeartIcon, ShieldBan, UserMinus, UserPlus, UserRoundCheck, UserRoundX } from 'lucide-react';
import { Feed } from '@/components/Feed';
import { CreatePost } from '@/components/CreatePost';
import { EditProfileModal } from '@/components/EditProfileModal';
import { FollowersList } from '@/components/FollowersList';
import { db } from '@/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, setDoc, deleteDoc, serverTimestamp, increment, updateDoc, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '@/lib/firebase-errors';
import { blockUser, cancelFriendRequest, getRelationshipSnapshot, removeFriendship, respondToFriendRequest, sendFriendRequest, setRestricted, toggleMutedFriendship, unblockUser, toggleFollowUser } from '@/lib/friendships';

import { createNotification } from '@/lib/notifications';
import { useTranslation } from 'react-i18next';
import { isAdmin } from '@/lib/admin';
import { LayoutDashboard } from 'lucide-react';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function ProfilePage() {
  const { t } = useTranslation('common');
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;
  const { profile: currentUser, isAuthReady } = useAppStore();
  const { user } = useRequireAuth();
  
  const [viewedUser, setViewedUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [relationship, setRelationship] = useState<any>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [postsCount, setPostsCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRelationshipBusy, setIsRelationshipBusy] = useState(false);
  const [showRelationshipMenu, setShowRelationshipMenu] = useState(false);

  const isOwner = currentUser?.uid === userId;
  const isVIP = viewedUser?.displayName === 'Philippe Boechat';

  // State for conditional rendering instead of early return
  const showLoading = !isAuthReady || !user;

  useEffect(() => {
    if (!userId || !isAuthReady) return;

    const docRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setViewedUser({ uid: userId, ...data });
        // Update local friendsCount state from document if it exists, otherwise keep current
        if (data.friendsCount !== undefined) {
          setFriendsCount(data.friendsCount);
        }
      } else {
        setLoading(false);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, isAuthReady]);


  // Fetch photos and posts count
  useEffect(() => {
    if (!userId || !isAuthReady) return;
    const q = query(collection(db, 'posts'), where('authorId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPostsCount(snapshot.size);
      
      const fetchedPhotos: string[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.imageUrl) fetchedPhotos.push(data.imageUrl);
      });
      setPhotos(fetchedPhotos.slice(0, 6)); // Get up to 6 photos
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'posts');
    });
    return () => unsubscribe();
  }, [userId, isAuthReady]);

  // Check follow status
  useEffect(() => {
    if (!currentUser || !userId || isOwner || !isAuthReady) return;
    const followRef = doc(db, 'followers', `${currentUser.uid}_${userId}`);
    const unsubscribe = onSnapshot(followRef, (doc) => {
      setIsFollowing(doc.exists());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `followers/${currentUser.uid}_${userId}`);
    });
    return () => unsubscribe();
  }, [currentUser, userId, isOwner, isAuthReady]);

  useEffect(() => {
    if (!currentUser || !userId || isOwner || !isAuthReady) return;

    const loadRelationship = async () => {
      try {
        const snapshot = await getRelationshipSnapshot(currentUser.uid, userId);
        setRelationship(snapshot);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `relationship/${currentUser.uid}/${userId}`);
      }
    };

    void loadRelationship();
  }, [currentUser, userId, isOwner, isAuthReady]);

  // Removed loadFriendsCount because we now get it in real-time from the user document


  const handleFollowToggle = async () => {
    if (!currentUser || !userId) return;

    try {
      await toggleFollowUser({
        followerUid: currentUser.uid,
        followingUid: userId,
        isFollowing: isFollowing,
        followerName: currentUser.displayName,
        followerPhoto: currentUser.photoURL
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'followers/notifications');
    }
  };


  const refreshRelationship = async () => {
    if (!currentUser || !userId || isOwner) return;
    const snapshot = await getRelationshipSnapshot(currentUser.uid, userId);
    setRelationship(snapshot);
  };

  const handlePrimaryRelationshipAction = async () => {
    if (!currentUser || !viewedUser || isRelationshipBusy) return;

    setIsRelationshipBusy(true);
    let errorPath = 'friend_requests';
    try {
      switch (relationship?.status) {
        case 'request_received':
          errorPath = `friendships/${currentUser.uid}__${viewedUser.uid}`;
          await respondToFriendRequest({
            requestOwnerUid: viewedUser.uid,
            actorUser: currentUser,
            action: 'accept',
          });
          break;
        case 'request_sent':
          errorPath = `friend_requests/${currentUser.uid}__${viewedUser.uid}`;
          await cancelFriendRequest(currentUser.uid, viewedUser.uid);
          break;
        case 'friends':
        case 'muted':
          errorPath = `friendships/${currentUser.uid}__${viewedUser.uid}`;
          await removeFriendship(currentUser.uid, viewedUser.uid);
          break;

        default: {
          errorPath = `friend_requests/${currentUser.uid}__${viewedUser.uid}`;
          await sendFriendRequest({
            fromUser: currentUser,
            toUser: viewedUser,
            source: 'profile',
          });
        }
      }

      await refreshRelationship();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, errorPath);
    } finally {
      setIsRelationshipBusy(false);
    }
  };

  const handleRelationshipMenuAction = async (action: 'decline' | 'ignore' | 'restrict' | 'unrestrict' | 'mute' | 'unmute' | 'block' | 'unblock') => {
    if (!currentUser || !viewedUser || isRelationshipBusy) return;

    setIsRelationshipBusy(true);
    setShowRelationshipMenu(false);
    try {
      switch (action) {
        case 'decline':
          await respondToFriendRequest({
            requestOwnerUid: viewedUser.uid,
            actorUser: currentUser,
            action: 'decline',
          });
          break;
        case 'ignore':
          await respondToFriendRequest({
            requestOwnerUid: viewedUser.uid,
            actorUser: currentUser,
            action: 'ignore',
          });
          break;
        case 'restrict':
          await setRestricted(currentUser.uid, viewedUser.uid, true);
          break;
        case 'unrestrict':
          await setRestricted(currentUser.uid, viewedUser.uid, false);
          break;
        case 'mute':
          await toggleMutedFriendship(currentUser.uid, viewedUser.uid, true);
          break;
        case 'unmute':
          await toggleMutedFriendship(currentUser.uid, viewedUser.uid, false);
          break;
        case 'block':
          await blockUser(currentUser.uid, viewedUser.uid);
          break;
        case 'unblock':
          await unblockUser(currentUser.uid, viewedUser.uid);
          break;
      }

      await refreshRelationship();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `relationships/${action}`);
    } finally {
      setIsRelationshipBusy(false);
    }
  };

  const handleSaveProfile = (updatedData: any) => {
    setViewedUser({ ...viewedUser, ...updatedData });
    // Also update current user in store if it's the owner
    if (isOwner) {
      useAppStore.setState({ profile: { ...currentUser, ...updatedData } });
    }
  };

  const handleMessageClick = async () => {
    if (!currentUser || !userId || !viewedUser) return;

    try {
      const mode = typeof window !== 'undefined' && window.innerWidth < 1280 ? 'page' : 'floating';
      const chatUser = {
        uid: userId,
        displayName: viewedUser.displayName || 'Usuário',
        photoURL: viewedUser.photoURL || '',
        username: viewedUser.username || '',
      };

      window.dispatchEvent(
        new CustomEvent('aura:open-chat-user', {
          detail: { user: chatUser, mode },
        })
      );

      if (mode === 'page') {
        router.push('/messages');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'chats');
    }
  };

  const isLoading = loading || showLoading;
  const isNotFound = !viewedUser && !isLoading;

  const primaryRelationshipLabel =
    relationship?.status === 'request_received'
      ? t('profile_page.accept_request', 'Accept Request')
      : relationship?.status === 'request_sent'
        ? t('profile_page.cancel_request', 'Cancel Request')
        : relationship?.status === 'friends'
          ? t('profile_page.friends', 'Friends')
          : relationship?.status === 'muted'
            ? t('profile_page.muted_friend', 'Muted Friend')
            : relationship?.status === 'blocked'
              ? t('profile_page.blocked', 'Blocked')
              : t('profile_page.add_friend', 'Add Friend');

  const primaryRelationshipIcon =
    relationship?.status === 'request_received'
      ? <UserRoundCheck className="w-4 h-4" />
      : relationship?.status === 'request_sent'
        ? <UserRoundX className="w-4 h-4" />
        : relationship?.status === 'friends' || relationship?.status === 'muted'
          ? <UserRoundCheck className="w-4 h-4" />
          : relationship?.status === 'blocked'
            ? <ShieldBan className="w-4 h-4" />
            : <UserPlus className="w-4 h-4" />;

    return (
      <div className="min-h-screen bg-background pb-12">
        <TopNav />

      {isLoading ? (
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
        </div>
      ) : isNotFound ? (
        <div className="min-h-[80vh] flex items-center justify-center">
          <p className="text-muted-foreground font-medium">{t('profile_page.user_not_found', 'User not found')}</p>
        </div>
      ) : (
        <main className="pt-[64px] flex flex-col items-center w-full">
        
        {/* Modern Header Section */}
        <div className="w-full max-w-[800px] mx-auto px-4 sm:px-6 pt-5 pb-3">
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/50 overflow-hidden relative">
            
            {/* Abstract Gradient Background or Cover Photo */}
            {viewedUser.coverURL ? (
                <div className="absolute top-0 left-0 right-0 h-[150px]">
                <img src={viewedUser.coverURL} alt="Cover" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
              </div>
            ) : (
               <div className={`absolute top-0 left-0 right-0 h-[150px] opacity-80 ${isVIP ? 'bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500' : 'bg-gradient-to-br from-primary/20 via-accent/20 to-purple-500/20'}`}>
                <div className="absolute inset-0 backdrop-blur-[100px]"></div>
              </div>
            )}

            <div className="relative pt-[96px] px-6 pb-7 flex flex-col items-center text-center">
              {/* Avatar with Glow */}
              <div className="relative group">
                <div className={`absolute inset-0 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all duration-500 ${isVIP ? 'bg-yellow-400/30' : ''}`} />
                <div className={`relative w-[128px] h-[128px] rounded-full border-[5px] border-white bg-white overflow-hidden shadow-xl mb-4 ring-4 transition-transform duration-500 group-hover:scale-[1.02] ${isVIP ? 'ring-yellow-400/50' : 'ring-primary/5'}`}>
                  {viewedUser.photoURL ? (
                    <img src={viewedUser.photoURL} alt={viewedUser.displayName || 'Profile'} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary font-black text-6xl bg-gradient-to-br from-primary/5 to-accent/10">
                      {viewedUser.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
              </div>

              {/* Name & Bio - Premium Typography */}
              <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
                <h1 className="text-[40px] font-black text-foreground tracking-tight mb-2 flex items-center justify-center gap-3">
                  {viewedUser.displayName}
                  {isVIP && (
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-400 blur-md opacity-20 scale-150 animate-pulse" />
                      <CheckCircle className="w-7 h-7 text-blue-500 fill-blue-500/10 relative" />
                    </div>
                  )}
                </h1>
                {viewedUser.username && (
                  <p className="text-primary font-bold text-[16px] mb-2">@{viewedUser.username}</p>
                )}
                <p className="text-muted-foreground/80 text-[15px] max-w-[500px] mb-6 leading-7 font-medium mx-auto">
                  {viewedUser.bio || t('profile_page.default_bio', 'Exploring the digital frontier. Passionate about design, technology, and building communities. 🚀')}
                </p>
              </div>

              {/* Stats & Info - Modern Pill Design */}
              <div className="flex flex-wrap items-center justify-center gap-3 mb-7">
                {viewedUser.education && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100/50 text-slate-600 text-[13px] font-bold shadow-sm">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <span>{viewedUser.education}</span>
                  </div>
                )}
                {viewedUser.work && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100/50 text-slate-600 text-[13px] font-bold shadow-sm">
                    <Briefcase className="w-4 h-4 text-primary" />
                    <span>{viewedUser.work}</span>
                  </div>
                )}
                {viewedUser.location && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100/50 text-slate-600 text-[13px] font-bold shadow-sm">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{viewedUser.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100/50 text-slate-600 text-[13px] font-bold shadow-sm">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{t('profile_page.joined', 'Joined')} {viewedUser.createdAt ? format(viewedUser.createdAt.toDate ? viewedUser.createdAt.toDate() : new Date(viewedUser.createdAt), 'yyyy') : '2026'}</span>
                </div>
              </div>

              {/* Action Buttons */}
                <div className="flex gap-2.5 w-full sm:w-auto">
                {!isOwner && (
                  <>
                    <button 
                      onClick={handlePrimaryRelationshipAction}
                      disabled={isRelationshipBusy || relationship?.status === 'blocked'}
                      className={`flex-1 sm:flex-none px-5 py-2.5 rounded-full font-semibold text-[14px] transition-all shadow-sm flex items-center justify-center gap-2 ${
                        relationship?.status === 'friends' || relationship?.status === 'muted'
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                          : relationship?.status === 'request_sent'
                            ? 'bg-muted hover:bg-gray-200 text-foreground'
                            : relationship?.status === 'blocked'
                              ? 'bg-red-50 text-red-600 cursor-not-allowed'
                              : 'bg-primary hover:bg-primary/90 text-white hover:shadow-md hover:-translate-y-0.5'
                      }`}
                    >
                      {primaryRelationshipIcon}
                      {isRelationshipBusy ? t('profile_page.working', 'Working...') : primaryRelationshipLabel}
                    </button>
                    <button 
                      onClick={handleMessageClick}
                      disabled={relationship?.status === 'blocked'}
                      className="flex-1 sm:flex-none bg-muted hover:bg-gray-200 text-foreground px-6 py-2.5 rounded-full font-semibold text-[14px] transition-all disabled:opacity-50"
                    >
                      {t('profile_page.message', 'Message')}
                    </button>
                    <button 
                      onClick={handleFollowToggle}
                      className={`flex-1 sm:flex-none px-5 py-2.5 rounded-full font-semibold text-[14px] transition-all shadow-sm ${
                        isFollowing 
                          ? 'bg-muted hover:bg-gray-200 text-foreground' 
                          : 'bg-white border border-border/50 hover:border-primary/30 text-foreground'
                      }`}
                    >
                      {isFollowing ? t('profile_page.following', 'Following') : t('profile_page.follow', 'Follow')}
                    </button>
                  </>
                )}
                {isOwner && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => setIsEditModalOpen(true)}
                      className="flex-1 sm:flex-none bg-muted hover:bg-gray-200 text-foreground px-6 py-2.5 rounded-full font-semibold text-[14px] transition-all"
                    >
                      {t('profile_page.edit_profile', 'Edit Profile')}
                    </button>
                    {isAdmin(currentUser) && (
                      <button 
                        onClick={() => router.push('/admin')}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-full font-semibold text-[14px] transition-all shadow-sm"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        {t('admin.dashboard', 'Painel Admin')}
                      </button>
                    )}
                  </div>
                )}
                {!isOwner && (
                  <div className="relative">
                    <button
                      onClick={() => setShowRelationshipMenu((current) => !current)}
                      className="w-11 h-11 bg-muted hover:bg-gray-200 text-foreground rounded-full flex items-center justify-center transition-all"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    {showRelationshipMenu && (
                      <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border/50 bg-white shadow-xl p-2 z-20">
                        {relationship?.status === 'request_received' && (
                          <>
                            <button onClick={() => handleRelationshipMenuAction('decline')} className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-muted transition-colors flex items-center gap-2">
                              <UserRoundX className="w-4 h-4" /> {t('profile_page.decline_request', 'Decline request')}
                            </button>
                            <button onClick={() => handleRelationshipMenuAction('ignore')} className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-muted transition-colors flex items-center gap-2">
                              <UserMinus className="w-4 h-4" /> {t('profile_page.ignore_quietly', 'Ignore quietly')}
                            </button>
                          </>
                        )}
                        {(relationship?.status === 'friends' || relationship?.status === 'muted') && (
                          <button onClick={() => handleRelationshipMenuAction(relationship?.status === 'muted' ? 'unmute' : 'mute')} className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-muted transition-colors flex items-center gap-2">
                            <UserMinus className="w-4 h-4" /> {relationship?.status === 'muted' ? t('profile_page.unmute_friend', 'Unmute friend') : t('profile_page.mute_friend', 'Mute friend')}
                          </button>
                        )}
                        <button onClick={() => handleRelationshipMenuAction(relationship?.status === 'restricted' ? 'unrestrict' : 'restrict')} className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-muted transition-colors flex items-center gap-2">
                          <UserMinus className="w-4 h-4" /> {relationship?.status === 'restricted' ? t('profile_page.remove_restriction', 'Remove restriction') : t('profile_page.restrict_user', 'Restrict user')}
                        </button>
                        <button onClick={() => handleRelationshipMenuAction(relationship?.status === 'blocked' ? 'unblock' : 'block')} className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2">
                          <ShieldBan className="w-4 h-4" /> {relationship?.status === 'blocked' ? t('profile_page.unblock_user', 'Unblock user') : t('profile_page.block_user', 'Block user')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!isOwner && relationship && (
                 <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 text-[12px] text-muted-foreground">
                  <span className="px-3 py-1 rounded-full bg-muted/50">
                    Status: <span className="font-semibold text-foreground">{t(`relationship.${relationship.status}`, relationship.status.replace('_', ' ')) as string}</span>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-muted/50">
                    {t('profile_page.affinity', 'Affinity')} {relationship.affinityScore}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-muted/50">
                    {relationship.mutualCommunitiesCount} {t('profile_page.shared_communities', 'shared communities')}
                  </span>
                </div>
              )}
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-4 border-t border-border/50 divide-x divide-border/50 bg-muted/10">
              <div 
                onClick={() => { setActiveTab('followers'); document.getElementById('profile-tabs')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="py-4 text-center hover:bg-muted/30 transition-colors cursor-pointer group"
              >
                <div className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{friendsCount}</div>
                <div className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5 group-hover:text-primary transition-colors">{t('profile_page.friends', 'Friends')}</div>
              </div>
              <div 
                onClick={() => { setActiveTab('followers'); document.getElementById('profile-tabs')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="py-4 text-center hover:bg-muted/30 transition-colors cursor-pointer group"
              >
                <div className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{viewedUser.followersCount || 0}</div>
                <div className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5 group-hover:text-primary transition-colors">{t('profile_page.tab_followers', 'Followers')}</div>
              </div>
              <div 
                onClick={() => { setActiveTab('following'); document.getElementById('profile-tabs')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="py-4 text-center hover:bg-muted/30 transition-colors cursor-pointer group"
              >
                <div className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{viewedUser.followingCount || 0}</div>
                <div className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5 group-hover:text-primary transition-colors">{t('profile_page.following', 'Following')}</div>
              </div>
              <div 
                onClick={() => { setActiveTab('posts'); document.getElementById('profile-tabs')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="py-4 text-center hover:bg-muted/30 transition-colors cursor-pointer group"
              >
                <div className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{postsCount}</div>
                <div className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5 group-hover:text-primary transition-colors">{t('profile_page.tab_posts', 'Posts')}</div>
              </div>
            </div>

          </div>
        </div>

        {/* Modern Tab Navigation */}
        <div id="profile-tabs" className="w-full max-w-[800px] mx-auto px-4 sm:px-6 mt-4 mb-6">
          <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-2xl overflow-x-auto scrollbar-hide">
            {[
              { id: 'posts', label: t('profile_page.tab_posts', 'Posts'), icon: MessageSquare },
              { id: 'media', label: t('profile_page.tab_photos', 'Photos'), icon: ImageIcon },
              { id: 'likes', label: t('profile_page.tab_likes', 'Likes'), icon: Heart },
              { id: 'followers', label: t('profile_page.tab_followers', 'Followers'), icon: UserPlus },
              { id: 'following', label: t('profile_page.tab_following', 'Following'), icon: UserRoundCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-[14px] transition-all ${
                    isActive 
                      ? 'bg-white text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="w-full max-w-[1000px] mx-auto px-4 flex flex-col lg:flex-row gap-6">
          
          {/* Left Column (Sidebar Info) */}
          <div className="w-full lg:w-[340px] flex flex-col gap-6 shrink-0 lg:sticky lg:top-[84px] self-start">
            
            {/* Intro Card */}
            <div className="bg-white rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-border/50 p-6">
              <h2 className="text-lg font-extrabold text-foreground mb-4">{t('profile_page.intro', 'Intro')}</h2>
              
              <div className="flex flex-col gap-4 text-[14px] text-muted-foreground">
                {viewedUser.education && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><GraduationCap className="w-4 h-4" /></div>
                    <span>{t('profile_page.studied_at', 'Studied at')} <strong className="text-foreground">{viewedUser.education}</strong></span>
                  </div>
                )}
                {viewedUser.work && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Briefcase className="w-4 h-4" /></div>
                    <span>{t('profile_page.works_at', 'Works at')} <strong className="text-foreground">{viewedUser.work}</strong></span>
                  </div>
                )}
                {viewedUser.location && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><MapPin className="w-4 h-4" /></div>
                    <span>{t('profile_page.lives_in', 'Lives in')} <strong className="text-foreground">{viewedUser.location}</strong></span>
                  </div>
                )}
                {viewedUser.relationship && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><HeartIcon className="w-4 h-4" /></div>
                    <span className="text-foreground font-medium">{viewedUser.relationship}</span>
                  </div>
                )}
                {!viewedUser.education && !viewedUser.work && !viewedUser.location && !viewedUser.relationship && (
                  <div className="text-center py-4 text-muted-foreground italic">{t('profile_page.no_details', 'No details provided yet.')}</div>
                )}
              </div>
              {isOwner && (
                <button 
                  onClick={() => setIsEditModalOpen(true)} 
                  className="w-full mt-6 bg-muted/50 hover:bg-muted text-foreground py-2.5 rounded-xl font-semibold text-[14px] transition-colors"
                >
                  {t('profile_page.edit_details', 'Edit details')}
                </button>
              )}
            </div>

            {/* Photos Card */}
            <div className="bg-white rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-border/50 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-extrabold text-foreground">{t('profile_page.tab_photos', 'Photos')}</h2>
                {photos.length > 0 && <button className="text-primary hover:underline text-[14px] font-medium transition-colors">{t('profile_page.see_all_photos', 'See all')}</button>}
              </div>
              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 rounded-2xl overflow-hidden">
                  {photos.map((url, i) => (
                    <div key={i} className="aspect-square bg-muted hover:opacity-90 cursor-pointer transition-opacity">
                      <img src={url} alt="Photo" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-[14px]">{t('profile_page.no_photos', 'No photos yet.')}</div>
              )}
            </div>

            <div className="bg-white rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-border/50 p-6">
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-lg font-extrabold text-foreground">{t('profile_page.friends', 'Friends')}</h2>
              </div>
              <div className="text-[14px] text-muted-foreground mb-2">{friendsCount} {t('profile_page.friends_count', 'friends').toLowerCase()}</div>
              <FollowersList userId={userId} type="friends" />
            </div>

          </div>

          {/* Right Column (Feed) */}
          <div className="flex-1 flex flex-col gap-6">
            {activeTab === 'posts' && (
              <>
                {isOwner && <CreatePost />}
                <Feed userId={userId} type="posts" />
              </>
            )}
            
            {activeTab === 'media' && (
              <Feed userId={userId} type="media" />
            )}
 
            {activeTab === 'likes' && (
              <Feed userId={userId} type="likes" />
            )}

            {activeTab === 'followers' && (
              <div className="bg-white rounded-3xl p-6 border border-border/50 shadow-sm">
                <h2 className="text-xl font-bold text-foreground mb-4">{t('profile_page.tab_followers', 'Followers')}</h2>
                <FollowersList userId={userId} type="followers" />
              </div>
            )}

            {activeTab === 'following' && (
              <div className="bg-white rounded-3xl p-6 border border-border/50 shadow-sm">
                <h2 className="text-xl font-bold text-foreground mb-4">{t('profile_page.tab_following', 'Following')}</h2>
                <FollowersList userId={userId} type="following" />
              </div>
            )}
          </div>

        </div>

        <EditProfileModal 
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          currentUserData={viewedUser}
          onSave={handleSaveProfile}
        />
      </main>
      )}
    </div>
  );
}
