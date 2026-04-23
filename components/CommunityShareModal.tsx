'use client';

import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Share2, Globe, Users, MessageSquare, UserPlus, Check, Copy, ExternalLink, Send, Search, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { db } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, setDoc, serverTimestamp, arrayUnion, addDoc } from 'firebase/firestore';
import { createNotification } from '@/lib/notifications';
import { ensureRuntimeChat, postRuntimeMessage } from '@/lib/chat-runtime';
import { normalizeThemeColor, hexToRgba } from '@/lib/community-theme';
import { soundEffects } from '@/lib/sound-effects';

interface CommunityShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  community: any;
  defaultTab?: 'invite' | 'share';
}

export function CommunityShareModal({ isOpen, onClose, community, defaultTab = 'invite' }: CommunityShareModalProps) {
  const { t } = useTranslation('common');
  const { profile } = useAppStore();
  const [activeTab, setActiveTab] = useState<'invite' | 'share'>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [postingToFeed, setPostingToFeed] = useState(false);
  const [feedCaption, setFeedCaption] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      loadFriends();
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const loadFriends = async () => {
    if (!profile?.uid) return;
    setLoadingFriends(true);
    try {
      // First get friendships
      const q = query(
        collection(db, 'friendships'),
        where('users', 'array-contains', profile.uid),
        where('status', '==', 'active'),
        limit(50)
      );
      const snap = await getDocs(q);
      const friendIds = snap.docs.map(d => {
        const data = d.data();
        return data.users.find((uid: string) => uid !== profile.uid);
      }).filter(Boolean);

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      // Then get user data
      const usersSnap = await getDocs(query(
        collection(db, 'users'),
        where('uid', 'in', friendIds.slice(0, 30))
      ));
      
      setFriends(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to load friends for invite:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const term = searchQuery.toLowerCase();
    return friends.filter(f => 
      f.displayName?.toLowerCase().includes(term) || 
      f.username?.toLowerCase().includes(term)
    );
  }, [friends, searchQuery]);

  const handleInvite = async (friend: any) => {
    if (!profile || !community || invitedIds.has(friend.id)) return;
    
    try {
      await createNotification({
        userId: friend.id,
        actorId: profile.uid,
        actorName: profile.displayName || 'Usuário',
        actorPhoto: profile.photoURL || '',
        type: 'community_invite',
        communityId: community.id,
        communityName: community.name,
        extraText: `Convidou você para participar da comunidade ${community.name}`
      });
      
      setInvitedIds(prev => new Set(prev).add(friend.id));
      soundEffects.play('success');
    } catch (err) {
      console.error('Invite failed:', err);
    }
  };

  const handleShareInMessage = async (friend: any) => {
    if (!profile || !community || sharedIds.has(friend.id)) return;
    
    try {
      const chat = await ensureRuntimeChat([profile.uid, friend.id]);
      const communityUrl = `${window.location.origin}/communities/${community.id}`;
      
      await postRuntimeMessage({
        chatId: chat.id as string,
        senderId: profile.uid,
        text: `Confira esta comunidade: ${community.name}\n${communityUrl}`,
      });
      
      setSharedIds(prev => new Set(prev).add(friend.id));
      soundEffects.play('success');
    } catch (err) {
      console.error('Message share failed:', err);
    }
  };

  const handlePostToFeed = async () => {
    if (!profile || !community || postingToFeed) return;
    setPostingToFeed(true);
    
    try {
      const communityUrl = `${window.location.origin}/communities/${community.id}`;
      const postRef = doc(collection(db, 'posts'));
      
      await setDoc(postRef, {
        authorId: profile.uid,
        authorName: profile.displayName || 'Anonymous',
        authorPhoto: profile.photoURL || '',
        authorUsername: profile.username || '',
        content: feedCaption.trim() 
          ? `${feedCaption.trim()}\n\nConfira esta comunidade: ${community.name}\n${communityUrl}`
          : `Acabei de encontrar esta comunidade incrível: ${community.name}! 🌟\n\n${communityUrl}`,
        type: 'text',
        visibility: 'public',
        communityId: null, // Shared to profile, not a specific community feed
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      soundEffects.play('success');
      alert('Compartilhado no seu perfil!');
      setPostingToFeed(false);
      setFeedCaption('');
      onClose();
    } catch (err) {
      console.error('Feed share failed:', err);
      setPostingToFeed(false);
      alert('Não foi possível compartilhar no feed agora.');
    }
  };

  const copyLink = async () => {
    try {
      const url = `${window.location.origin}/communities/${community.id}`;
      await navigator.clipboard.writeText(url);
      soundEffects.play('pop');
      alert('Link copiado!');
    } catch (err) {
      alert('Erro ao copiar link.');
    }
  };

  const themeColor = normalizeThemeColor(community?.themeColor);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-[500px] bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg"
              style={{ background: themeColor }}
            >
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-foreground">
                {activeTab === 'invite' ? 'Convidar Amigos' : 'Compartilhar'}
              </h3>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                {community?.name}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-muted-foreground transition-all active:scale-90"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 gap-2">
          <button
            onClick={() => setActiveTab('invite')}
            className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'invite' 
                ? 'bg-slate-900 text-white shadow-lg scale-[1.02]' 
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Convidar
          </button>
          <button
            onClick={() => setActiveTab('share')}
            className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'share' 
                ? 'bg-slate-900 text-white shadow-lg scale-[1.02]' 
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Share2 className="w-4 h-4" />
            Compartilhar
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'invite' ? (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Procurar amigos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-border/50 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>

              {/* Friends List */}
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {loadingFriends ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mb-3 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest">Carregando amigos...</p>
                  </div>
                ) : filteredFriends.length > 0 ? (
                  filteredFriends.map((friend) => (
                    <div key={friend.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors group">
                      <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0">
                        {friend.photoURL ? (
                          <img src={friend.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase text-slate-400">
                            {friend.displayName?.[0] || '?'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">{friend.displayName}</div>
                        <div className="text-[11px] font-semibold text-muted-foreground truncate">@{friend.username || 'user'}</div>
                      </div>
                      <button
                        onClick={() => handleInvite(friend)}
                        disabled={invitedIds.has(friend.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                          invitedIds.has(friend.id)
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                        }`}
                      >
                        {invitedIds.has(friend.id) ? (
                          <span className="flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Enviado
                          </span>
                        ) : (
                          'Convidar'
                        )}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-sm font-bold text-muted-foreground">Nenhum amigo encontrado.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Post to Profile Section */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">No seu perfil</p>
                <div className="bg-slate-50 rounded-2xl p-4 border border-border/50">
                  <textarea
                    placeholder="Diga algo sobre esta comunidade..."
                    value={feedCaption}
                    onChange={(e) => setFeedCaption(e.target.value)}
                    className="w-full bg-transparent border-none focus:outline-none text-sm font-medium resize-none min-h-[80px]"
                  />
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                      <Globe className="w-3 h-3" />
                      Público
                    </div>
                    <button
                      onClick={handlePostToFeed}
                      disabled={postingToFeed}
                      className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all flex items-center gap-2"
                    >
                      {postingToFeed ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Postar no Feed
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Message Section */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Enviar para alguém</p>
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar pr-1">
                  {friends.slice(0, 10).map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => handleShareInMessage(friend)}
                      disabled={sharedIds.has(friend.id)}
                      className="flex flex-col items-center gap-2 shrink-0 group"
                    >
                      <div className="relative">
                        <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 transition-all group-hover:scale-105 ${sharedIds.has(friend.id) ? 'border-emerald-400 opacity-50' : 'border-transparent group-hover:border-primary'}`}>
                          {friend.photoURL ? (
                            <img src={friend.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-400">
                              {friend.displayName?.[0]}
                            </div>
                          )}
                        </div>
                        {sharedIds.has(friend.id) && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white border-2 border-white">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 w-14 truncate text-center">
                        {friend.displayName?.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                  {friends.length === 0 && (
                    <p className="text-[11px] font-medium text-muted-foreground italic py-2">
                      Siga amigos para compartilhar rapidamente via DM.
                    </p>
                  )}
                </div>
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={copyLink}
                  className="flex items-center justify-center gap-3 py-4 bg-slate-50 hover:bg-slate-100 rounded-2xl text-xs font-black text-slate-600 transition-all active:scale-95 border border-border/30"
                >
                  <Copy className="w-4 h-4" />
                  Copiar Link
                </button>
                <button
                  onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: community.name,
                          text: `Confira esta comunidade no Aura: ${community.name}`,
                          url: `${window.location.origin}/communities/${community.id}`
                        });
                      } catch (e) {}
                    } else {
                      copyLink();
                    }
                  }}
                  className="flex items-center justify-center gap-3 py-4 bg-slate-50 hover:bg-slate-100 rounded-2xl text-xs font-black text-slate-600 transition-all active:scale-95 border border-border/30"
                >
                  <ExternalLink className="w-4 h-4" />
                  Mais Opções
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
