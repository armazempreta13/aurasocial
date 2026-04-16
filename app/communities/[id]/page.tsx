'use client';

import { AppLayout } from '@/components/AppLayout';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { doc, onSnapshot, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import { Users, Globe, Lock, MessageSquare, ArrowLeft, Plus, Settings, Shield } from 'lucide-react';
import { Feed } from '@/components/Feed';
import { CreatePost } from '@/components/CreatePost';
import { CommunitySettingsModal } from '@/components/CommunitySettingsModal';
import CommunityJoinGate from '@/components/CommunityJoinGate';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function CommunityDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { profile } = useAppStore();
  const { t } = useTranslation('common');
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [isForcedUpdate, setIsForcedUpdate] = useState(false);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'communities', id as string), async (doc) => {
      if (doc.exists()) {
        const data = { id: doc.id, ...doc.data() };
        setCommunity(data);

        if (profile && data.members?.includes(profile.uid) && data.gate_requireRulesAcceptance && data.rules_currentVersion > 0) {
          const acceptRef = doc(db, 'communities', id as string, 'rule_acceptances', profile.uid);
          const acceptSnap = await getDoc(acceptRef);
          const userVersion = acceptSnap.exists() ? acceptSnap.data().rulesVersion : 0;
          
          if (userVersion < data.rules_currentVersion) {
             setIsForcedUpdate(true);
             setShowGate(true);
          }
        }
      } else {
        router.push('/communities');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, router, profile]);

  const handleJoinLeave = async () => {
    if (!profile || !community) return;

    if (!community.members?.includes(profile.uid) && community.gate_requireRulesAcceptance && community.rules_currentVersion > 0) {
      setIsForcedUpdate(false);
      setShowGate(true);
      return;
    }

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

  if (loading) {
    return (
      <AppLayout wide={true}>
        <div className="animate-pulse">
          <div className="h-48 bg-muted rounded-3xl mb-6"></div>
          <div className="h-8 bg-muted w-1/3 rounded mb-4"></div>
          <div className="h-4 bg-muted w-1/2 rounded mb-8"></div>
          <div className="space-y-4">
            <div className="h-32 bg-muted rounded-2xl"></div>
            <div className="h-32 bg-muted rounded-2xl"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const isMember = community?.members?.includes(profile?.uid);
  const userRole = community?.roles?.[profile?.uid || ''] || 'member';
  const isAdmin = isMember && (community?.creatorId === profile?.uid || userRole === 'admin');
  const isModerator = isMember && (isAdmin || userRole === 'moderator');

  return (
    <AppLayout wide={true} hideRightPanel={true}>
      {showGate && community && (
         <CommunityJoinGate 
            communityId={community.id}
            communityName={community.name}
            currentVersion={community.rules_currentVersion}
            forceOverlay={isForcedUpdate}
            onCancel={() => setShowGate(false)}
            onAcceptSuccess={() => {
              setShowGate(false);
              alert(isForcedUpdate ? 'Thanks for reading the new rules!' : 'Welcome to the community!');
            }}
         />
      )}

      <div className="mb-6">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-6 transition-colors group pt-2"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Communities
        </button>

        <div className="bg-white rounded-[40px] border border-border/40 shadow-[0_20px_60px_rgba(0,0,0,0.05)] overflow-hidden mb-10 group/comm">
          <div className="h-[240px] relative overflow-hidden bg-slate-200">
            <img src={community.image} alt="" className="w-full h-full object-cover transition-transform duration-1000 group-hover/comm:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            
            <div className="absolute bottom-8 left-8 right-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white text-3xl font-black shadow-2xl">
                  {community.name.charAt(0)}
                </div>
                <div className="text-white">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{community.name}</h1>
                    {isAdmin && (
                      <div className="bg-primary/20 backdrop-blur-md text-primary-foreground text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 rounded-full flex items-center gap-1 border border-primary/30">
                        <Shield className="w-3.5 h-3.5" /> {t('community.admin', 'Admin')}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-5 text-sm font-bold text-white/70">
                    <span className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm"><Users className="w-4 h-4" /> {community.memberCount || 0} {t('community.members', 'members')}</span>
                    <span className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                      {community.type === 'Public' ? <Globe className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-amber-400" />}
                      {community.type}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={handleJoinLeave}
                  className={`px-8 py-3 rounded-2xl font-black text-[15px] transition-all shadow-xl active:scale-95 ${
                    isMember 
                      ? 'bg-white/10 backdrop-blur-md text-white hover:bg-red-500/20 hover:text-red-100 border border-white/20' 
                      : 'bg-primary text-white hover:bg-primary/90 shadow-primary/30 hover:shadow-primary/40'
                  }`}
                >
                  {isMember ? t('community.leave', 'Leave Group') : t('community.join', 'Join Group')}
                </button>
                {isAdmin && (
                  <button 
                    onClick={() => router.push(`/communities/${community.id}/admin`)}
                    className="w-12 h-12 bg-white/10 backdrop-blur-md text-white rounded-2xl border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center group/settings"
                  >
                    <Settings className="w-6 h-6 group-hover/settings:rotate-90 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="p-8 bg-white/50 backdrop-blur-sm">
            <h3 className="text-[12px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-3">About this community</h3>
            <p className="text-lg text-foreground/80 leading-relaxed max-w-4xl font-medium">
              {community.description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {isMember ? (
              <>
                <CreatePost communityId={community.id} communityName={community.name} />
                <Feed communityId={community.id} />
              </>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-border/50">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">Join this community to see posts</h3>
                <p className="text-muted-foreground mb-6">You need to be a member to view and participate in the conversation.</p>
                <button 
                  onClick={handleJoinLeave}
                  className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  Join Group
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                About this Group
              </h3>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-bold">{community.type}</p>
                    <p className="text-muted-foreground">Anyone can find this group and see who&apos;s in it.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-bold">Visible</p>
                    <p className="text-muted-foreground">Anyone can find this group.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-bold">Active</p>
                    <p className="text-muted-foreground">Members post regularly in this community.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold mb-4">Community Rules</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {community?.rules?.length > 0 ? (
                  community.rules.map((rule: any, idx: number) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-primary font-bold">{idx + 1}.</span>
                      <div>
                        <strong className="text-foreground">{rule.title}</strong>
                        {rule.description && <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>}
                      </div>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold">1.</span>
                      Be kind and courteous
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold">2.</span>
                      No hate speech or bullying
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold">3.</span>
                      No promotions or spam
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <CommunitySettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        community={community}
      />
    </AppLayout>
  );
}
