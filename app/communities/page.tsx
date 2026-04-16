'use client';

import { AppLayout } from '@/components/AppLayout';
import { Users, Search, Plus, Globe, Lock, MessageSquare, X, Upload, Loader2, Camera, UserPlus } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import Link from 'next/link';
import Image from 'next/image';
import { uploadImage } from '@/lib/image-utils';
import { getFriendIds } from '@/lib/friendships';
import { useTranslation } from 'react-i18next';

export default function CommunitiesPage() {
  const { t } = useTranslation('common');
  const { profile } = useAppStore();
  const [communities, setCommunities] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'explore' | 'my'>('explore');
  const [sortBy, setSortBy] = useState<'members' | 'newest'>('members');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [newCommunity, setNewCommunity] = useState({
    name: '',
    description: '',
    type: 'Public',
    image: `https://picsum.photos/seed/${Math.random()}/400/200`
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadImage(file);
      setNewCommunity({ ...newCommunity, image: result.url });
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Failed to upload image: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'communities'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const communitiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCommunities(communitiesData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile?.uid) return;

    const loadFriendIds = async () => {
      const friends = await getFriendIds(profile.uid);
      setFriendIds(new Set(friends));
    };

    void loadFriendIds();
  }, [profile?.uid]);

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newCommunity.name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'communities'), {
        ...newCommunity,
        creatorId: profile.uid,
        members: [profile.uid],
        memberCount: 1,
        createdAt: serverTimestamp()
      });
      setShowCreateModal(false);
      setNewCommunity({
        name: '',
        description: '',
        type: 'Public',
        image: `https://picsum.photos/seed/${Math.random()}/400/200`
      });
    } catch (error) {
      console.error('Error creating community:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinLeave = async (e: React.MouseEvent, community: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!profile) return;

    const communityRef = doc(db, 'communities', community.id);
    const isMember = community.members?.includes(profile.uid);

    try {
      if (isMember) {
        await updateDoc(communityRef, {
          members: arrayRemove(profile.uid),
          memberCount: (community.memberCount || 1) - 1
        });
      } else {
        await updateDoc(communityRef, {
          members: arrayUnion(profile.uid),
          memberCount: (community.memberCount || 0) + 1
        });
      }
    } catch (error) {
      console.error('Error joining/leaving community:', error);
    }
  };

  const filteredCommunities = communities.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'my') {
      return matchesSearch && c.members?.includes(profile?.uid);
    }
    return matchesSearch;
  }).map((community) => {
    const friendMembers = (community.members || []).filter((memberId: string) => friendIds.has(memberId));
    return {
      ...community,
      friendMembersCount: friendMembers.length,
      socialScore: friendMembers.length * 25 + Math.min(community.memberCount || 0, 200) * 0.2,
    };
  });

  return (
    <AppLayout wide={true} hideRightPanel={true}>
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('communities_page.title', 'Communities')}</h1>
              <p className="text-muted-foreground">{t('communities_page.subtitle', 'Find your tribe and join the conversation')}</p>
            </div>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-primary text-white px-6 py-2.5 rounded-full font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2 w-fit"
          >
            <Plus className="w-5 h-5" />
            {t('communities_page.create_btn', 'Create Community')}
          </button>
        </div>

        <div className="flex items-center gap-8 border-b border-border/50 mb-8 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('explore')}
            className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === 'explore' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t('communities_page.tab_explore', 'Explore Communities')}
            {activeTab === 'explore' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('my')}
            className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === 'my' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t('communities_page.tab_my', 'My Communities')}
            {activeTab === 'my' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full"></div>}
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder={t('communities_page.search_placeholder', 'Search for communities by name or topic...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-border/50 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'members' | 'newest')}
            className="bg-white border border-border/50 rounded-2xl px-6 py-4 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm font-bold text-sm"
          >
            <option value="members">{t('communities_page.sort_members', 'Sorted by Members')}</option>
            <option value="newest">{t('communities_page.sort_newest', 'Sorted by Newest')}</option>
          </select>
        </div>

        {filteredCommunities.sort((a,b) => {
          if (sortBy === 'members') return (b.socialScore || 0) - (a.socialScore || 0);
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        }).length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-border/50">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">
              {activeTab === 'my' ? t('communities_page.empty_my_title', "You haven't joined any communities yet") : t('communities_page.empty_explore_title', "No communities found")}
            </h3>
            <p className="text-muted-foreground">
              {activeTab === 'my' ? t('communities_page.empty_my_desc', "Explore and join some groups to see them here!") : t('communities_page.empty_explore_desc', "Try a different search or create your own!")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCommunities.sort((a,b) => {
              if (sortBy === 'members') return (b.socialScore || 0) - (a.socialScore || 0);
              return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
            }).map((community) => {
              const isMember = community.members?.includes(profile?.uid);
              return (
                <Link 
                  href={`/communities/${community.id}`}
                  key={community.id} 
                  className="bg-white rounded-3xl border border-border/50 shadow-sm overflow-hidden hover:shadow-md transition-all group flex flex-col h-full"
                >
                  <div className="h-32 bg-muted relative shrink-0">
                    <Image 
                      src={community.image} 
                      alt="" 
                      fill 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute top-3 right-3 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[12px] font-bold text-foreground flex items-center gap-1.5 shadow-sm">
                      {community.type === 'Public' ? <Globe className="w-3 h-3 text-green-500" /> : <Lock className="w-3 h-3 text-amber-500" />}
                      {community.type}
                    </div>
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{community.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {t('communities_page.members_count', { count: community.memberCount || 0, defaultValue: '{{count}} members' })}</span>
                      {community.friendMembersCount > 0 && (
                        <span className="flex items-center gap-1 text-primary font-semibold">
                          <UserPlus className="w-4 h-4" /> {t('communities_page.friends_inside', { count: community.friendMembersCount, defaultValue: '{{count}} friends inside' })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-6 line-clamp-2 leading-relaxed flex-1">
                      {community.description}
                    </p>
                    <button 
                      onClick={(e) => handleJoinLeave(e, community)}
                      className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                        isMember 
                          ? 'bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-600' 
                          : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                      }`}
                    >
                      {isMember ? t('communities_page.leave_group', 'Leave Group') : t('communities_page.join_group', 'Join Group')}
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
              <h2 className="text-xl font-bold">{t('communities_page.modal_title', 'Create Community')}</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCommunity} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">{t('communities_page.modal_name', 'Community Name')}</label>
                <input 
                  type="text" 
                  required
                  placeholder={t('communities_page.modal_name_placeholder', 'e.g. Tech Innovators')}
                  value={newCommunity.name}
                  onChange={(e) => setNewCommunity({...newCommunity, name: e.target.value})}
                  className="w-full bg-muted/50 border-transparent focus:bg-white focus:border-primary/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">{t('communities_page.modal_desc', 'Description')}</label>
                <textarea 
                  required
                  placeholder={t('communities_page.modal_desc_placeholder', 'What is this community about?')}
                  value={newCommunity.description}
                  onChange={(e) => setNewCommunity({...newCommunity, description: e.target.value})}
                  className="w-full bg-muted/50 border-transparent focus:bg-white focus:border-primary/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all min-h-[100px] resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">{t('communities_page.modal_image', 'Community Image')}</label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-16 rounded-xl bg-muted overflow-hidden border border-border/50 relative group">
                    {newCommunity.image ? (
                      <Image 
                        src={newCommunity.image} 
                        alt="Preview" 
                        fill 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> {newCommunity.image ? t('communities_page.modal_change_image', 'Change Image') : t('communities_page.modal_upload_image', 'Upload Image')}
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">{t('communities_page.modal_privacy', 'Privacy Type')}</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Public', 'Private'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewCommunity({...newCommunity, type})}
                      className={`py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${
                        newCommunity.type === type 
                          ? 'border-primary bg-primary/5 text-primary' 
                          : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <button 
                type="submit"
                disabled={isSubmitting || !newCommunity.name.trim()}
                className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50 mt-2"
              >
                {isSubmitting ? t('communities_page.modal_creating', 'Creating...') : t('communities_page.modal_create_btn', 'Create Community')}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
