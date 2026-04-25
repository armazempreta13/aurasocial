'use client';

import { AppLayout } from '@/components/AppLayout';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/firebase';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import {
  Users,
  Globe,
  Lock,
  ArrowLeft,
  Settings,
  Shield,
  Link2,
  CalendarDays,
  Eye,
  Search,
  MoreHorizontal,
  ChevronDown,
  X,
  Plus,
  Check,
  LogOut,
  Bell,
  ShieldAlert,
  Tag,
} from 'lucide-react';
import { Feed } from '@/components/Feed';
import { CreatePost } from '@/components/CreatePost';
import { CommunitySettingsModal } from '@/components/CommunitySettingsModal';
import CommunityJoinGate from '@/components/CommunityJoinGate';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ActionModal } from '@/components/ActionModal';
import { CommunityShareModal } from '@/components/CommunityShareModal';
import Link from 'next/link';
import Image from 'next/image';
import { renderTextWithLinks } from '@/lib/mentions';
import {
  buildCommunityCoverStyle,
  hexToRgba,
  normalizeThemeColor,
} from '@/lib/community-theme';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useTranslation } from 'react-i18next';

type WeeklyHighlight = {
  postId?: string;
  postTitle?: string;
  memberId?: string;
  memberName?: string;
  updatedAt?: number;
};

export default function CommunityDetailPage() {
  const { t } = useTranslation('common');
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { profile } = useAppStore();
  const { user, isAuthReady } = useRequireAuth();

  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [isForcedUpdate, setIsForcedUpdate] = useState(false);
  const [memberSince, setMemberSince] = useState<Date | null>(null);
  const [previewPosts, setPreviewPosts] = useState<any[]>([]);
  const [weeklyHighlight, setWeeklyHighlight] = useState<WeeklyHighlight | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [recentActivityCount, setRecentActivityCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [joinRequestPending, setJoinRequestPending] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [showMemberMenu, setShowMemberMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [shareModalTab, setShareModalTab] = useState<'invite' | 'share'>('invite');
  const [searchOpen, setSearchOpen] = useState(false);
  const [communitySearchQuery, setCommunitySearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'discussion' | 'highlights' | 'people' | 'media' | 'about'>('discussion');
  const [memberPreview, setMemberPreview] = useState<any[]>([]);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.relative')) {
        setShowMoreMenu(false);
        setShowMemberMenu(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'communities', id), async (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as any;
        setCommunity(data);

        if (
          profile &&
          data.members?.includes(profile.uid) &&
          data.gate_requireRulesAcceptance &&
          data.rules_currentVersion > 0
        ) {
          const acceptRef = doc(db, 'communities', id, 'rule_acceptances', profile.uid);
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

  useEffect(() => {
    if (!id || !profile?.uid || !community?.members?.includes(profile.uid)) {
      setMemberSince(null);
      setMuted(false);
      return;
    }

    const loadMemberSince = async () => {
      const memberSnap = await getDoc(doc(db, 'communities', id, 'members', profile.uid));
      if (memberSnap.exists() && memberSnap.data().memberSince?.toDate) {
        setMemberSince(memberSnap.data().memberSince.toDate());
      }
      if (memberSnap.exists()) {
        const data: any = memberSnap.data();
        setMuted(!!data?.muted);
      }
    };

    void loadMemberSince();
  }, [community?.members, id, profile?.uid]);

  useEffect(() => {
    if (!community?.members?.length) {
      setMemberPreview([]);
      return;
    }

    const sample = community.members.slice(0, 24);
    const load = async () => {
      try {
        const snaps = await Promise.all(sample.map((uid: string) => getDoc(doc(db, 'users', uid))));
        setMemberPreview(snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() })));
      } catch (e) {
        console.warn('Member preview load failed:', e);
        setMemberPreview([]);
      }
    };
    void load();
  }, [community?.members]);

  useEffect(() => {
    if (!id || !community) return;

    const loadPreviewPosts = async () => {
      const previewQuery = query(
        collection(db, 'posts'),
        where('communityId', '==', id),
        orderBy('createdAt', 'desc'),
        limit(3),
      );
      const snapshot = await getDocs(previewQuery);
      setPreviewPosts(snapshot.docs.map((postDoc) => ({ id: postDoc.id, ...postDoc.data() })));
    };

    void loadPreviewPosts();
  }, [community, id]);

  useEffect(() => {
    if (!id || !community) return;

    // Use onSnapshot to keep highlight real-time and fix "deleted post still showing" bug
    const recentQuery = query(
      collection(db, 'posts'),
      where('communityId', '==', id),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(recentQuery, (snapshot) => {
      // If community has a manual highlight and it's still in the DB, we could use it, 
      // but usually the computed one is preferred for "Destaque"
      
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentPosts = snapshot.docs
        .map((postDoc) => ({ id: postDoc.id, ...(postDoc.data() as any) }))
        .filter((post: any) => {
          const approval = (post?.approvalStatus || 'approved') as string;
          if (approval !== 'approved') return false;
          const timestamp = post.createdAt?.toDate ? post.createdAt.toDate().getTime() : 
                           (post.createdAt?.seconds ? post.createdAt.seconds * 1000 : null);
          return timestamp && timestamp >= weekAgo;
        });

      if (recentPosts.length === 0) {
        setWeeklyHighlight(null);
        return;
      }

      const bestPost = [...recentPosts].sort((a: any, b: any) => {
        const aScore = (a.likesCount || 0) + (a.commentsCount || 0) * 2;
        const bScore = (b.likesCount || 0) + (b.commentsCount || 0) * 2;
        return bScore - aScore;
      })[0];

      const memberPosts = new Map<string, { name: string; count: number }>();
      recentPosts.forEach((post: any) => {
        const current = memberPosts.get(post.authorId) || {
          name: post.authorName || 'Membro',
          count: 0,
        };
        current.count += 1;
        memberPosts.set(post.authorId, current);
      });
      const bestMember = [...memberPosts.entries()].sort((a, b) => b[1].count - a[1].count)[0];

      setWeeklyHighlight({
        postId: bestPost?.id,
        postTitle: (bestPost?.content || '').slice(0, 72) || 'Post em destaque',
        memberId: bestMember?.[0],
        memberName: bestMember?.[1]?.name,
        updatedAt: Date.now(),
      });
    }, (error) => {
      console.warn('Highlight sync failed:', error);
    });

    return () => unsubscribe();
  }, [community, id]);

  useEffect(() => {
    if (!id) return;
    
    // Query only by communityId to avoid needing a composite index.
    // Date filtering is done client-side to prevent index errors during build phase.
    const activityQuery = query(
      collection(db, 'posts'),
      where('communityId', '==', id),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(activityQuery, (snapshot) => {
      const aDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentCount = snapshot.docs.filter(docSnap => {
        const data = docSnap.data();
        const approval = (data as any)?.approvalStatus || 'approved';
        if (approval !== 'approved') return false;
        const ts = data.createdAt?.toMillis ? data.createdAt.toMillis() :
                   data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0;
        return ts >= aDayAgo;
      }).length;
      setRecentActivityCount(recentCount);
    }, (error) => {
      console.warn('Activity sync failed:', error);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id || !profile?.uid || !community?.members?.includes(profile.uid)) {
      setPendingApprovalCount(0);
      return;
    }

    const q = query(
      collection(db, 'posts'),
      where('communityId', '==', id),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const isStaff = community?.creatorId === profile.uid ||
        community?.roles?.[profile.uid] === 'admin' ||
        community?.roles?.[profile.uid] === 'moderator';

      let count = 0;
      snapshot.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        const approval = (data?.approvalStatus || 'approved') as string;
        if (approval !== 'pending') return;
        if (isStaff || data?.authorId === profile.uid) count += 1;
      });

      setPendingApprovalCount(count);
    }, (error) => {
      console.warn('Pending approval sync failed:', error);
    });

    return () => unsubscribe();
  }, [community?.creatorId, community?.roles, community?.members, id, profile?.uid]);

  useEffect(() => {
    if (!id || !profile?.uid) {
      setJoinRequestPending(false);
      return;
    }

    const reqQuery = query(
      collection(db, 'community_requests'),
      where('userId', '==', profile.uid),
      where('communityId', '==', id),
      limit(5),
    );

    const unsubscribe = onSnapshot(reqQuery, (snapshot) => {
      const pending = snapshot.docs.some((docSnap) => {
        const data: any = docSnap.data();
        return (data?.status || 'pending') === 'pending';
      });
      setJoinRequestPending(pending);
    }, (error) => {
      console.warn('Join request sync failed:', error);
    });

    return () => unsubscribe();
  }, [id, profile?.uid]);

  useEffect(() => {
    if (!community?.members?.length) return;
    
    // Real-time presence sampling: check status of members
    // Firestore has a 30-limit for 'in' queries, which is a perfect sample for 'Presence' sensation
    const sampleSize = 30;
    const membersSample = community.members.slice(0, sampleSize);
    
    const onlineQuery = query(
      collection(db, 'users'), 
      where('uid', 'in', membersSample),
      where('isOnline', '==', true)
    );

    const unsubscribe = onSnapshot(onlineQuery, (snapshot) => {
      // If we have more than 30 members, we can extrapolate or just show the real active sample
      setOnlineCount(snapshot.size);
    }, (error) => {
      console.warn('Presence sync failed:', error);
    });

    return () => unsubscribe();
  }, [community?.members]);

  const themeColor = useMemo(
    () => normalizeThemeColor(community?.themeColor),
    [community?.themeColor],
  );

  const handleJoin = async () => {
    if (!profile || !community) return;
    if (joinRequestPending) {
      alert('Sua solicitação já está pendente de aprovação.');
      return;
    }

    if (
      community.gate_requireRulesAcceptance &&
      community.rules_currentVersion > 0
    ) {
      setIsForcedUpdate(false);
      setShowGate(true);
      return;
    }

    if (community?.security?.requireApproval) {
      try {
        const batch = writeBatch(db);
        const requestRef = doc(db, 'community_requests', `${community.id}_${profile.uid}`);
        batch.set(requestRef, {
          communityId: community.id,
          userId: profile.uid,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
        await batch.commit();
        alert('Solicitação enviada. Aguarde a aprovação de um administrador.');
      } catch (error) {
        console.error('Error requesting to join community:', error);
        alert('Não foi possível enviar sua solicitação agora.');
      }
      return;
    }

    const communityRef = doc(db, 'communities', community.id);
    const memberRef = doc(db, 'communities', community.id, 'members', profile.uid);

    try {
      const batch = writeBatch(db);
      batch.update(communityRef, {
        members: arrayUnion(profile.uid),
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      batch.set(memberRef, {
        userId: profile.uid,
        joinedAt: serverTimestamp(),
        role: 'member',
      });
      await batch.commit();
    } catch (error) {
      console.error('Error joining community:', error);
    }
  };

  const handleLeave = async () => {
    if (!profile || !community) return;

    const communityRef = doc(db, 'communities', community.id);
    const memberRef = doc(db, 'communities', community.id, 'members', profile.uid);

    try {
      const batch = writeBatch(db);
      batch.update(communityRef, {
        members: arrayRemove(profile.uid),
        memberCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      batch.delete(memberRef);
      await batch.commit();
      setIsLeaveModalOpen(false);
    } catch (error) {
      console.error('Error leaving community:', error);
    }
  };

  const handleJoinLeaveAction = () => {
    if (isMember) {
      setIsLeaveModalOpen(true);
    } else {
      handleJoin();
    }
  };

  const handleShareCommunity = () => {
    setShareModalTab('share');
    setShowShareModal(true);
  };

  const handleInvite = () => {
    setShareModalTab('invite');
    setShowShareModal(true);
  };

  const handleReportCommunity = () => {
    if (!user) return;
    const reason = window.prompt('Por que você deseja denunciar esta comunidade?');
    if (!reason) return;

    void addDoc(collection(db, 'reports'), {
      reporterId: user.uid,
      targetId: community.id,
      targetType: 'community',
      reason,
      status: 'pending',
      createdAt: serverTimestamp(),
    }).then(() => {
      alert('Obrigado. Sua denúncia foi enviada para análise.');
    });
  };

  const toggleMute = async () => {
    if (!profile?.uid || !community?.id) return;
    try {
      const next = !muted;
      await updateDoc(doc(db, 'communities', community.id, 'members', profile.uid), { muted: next });
      setMuted(next);
    } catch (e) {
      console.error('Mute update failed:', e);
      alert('Não foi possível atualizar suas notificações.');
    }
  };

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <AppLayout wide={true}>
        <div className="animate-pulse">
          <div className="mb-6 h-48 rounded-3xl bg-muted" />
          <div className="mb-4 h-8 w-1/3 rounded bg-muted" />
          <div className="mb-8 h-4 w-1/2 rounded bg-muted" />
          <div className="space-y-4">
            <div className="h-32 rounded-2xl bg-muted" />
            <div className="h-32 rounded-2xl bg-muted" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const isMember = community?.members?.includes(profile?.uid);
  const userRole = community?.roles?.[profile?.uid || ''] || 'member';
  const isAdmin = isMember && (community?.creatorId === profile?.uid || userRole === 'admin');
  const isStaff = isMember && (community?.creatorId === profile?.uid || userRole === 'admin' || userRole === 'moderator');
  const isPublicCommunity = community?.type === 'Public';
  const coverStyle = !community?.coverURL ? buildCommunityCoverStyle(themeColor) : undefined;

  return (
    <AppLayout wide={true} hideRightPanel={true}>
      {showGate && community && (
        <CommunityJoinGate
          communityId={community.id}
          communityName={community.name}
          currentVersion={community.rules_currentVersion}
          requireApproval={!!community?.security?.requireApproval}
          forceOverlay={isForcedUpdate}
          onCancel={() => setShowGate(false)}
          onAcceptSuccess={() => {
            setShowGate(false);
            if (isForcedUpdate) {
              alert('Regras atualizadas confirmadas.');
            } else if (community?.security?.requireApproval) {
              alert('Solicitação enviada. Aguarde a aprovação de um administrador.');
            } else {
              alert('Agora você faz parte da comunidade.');
            }
          }}
        />
      )}

      <ActionModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onConfirm={() => void handleInvite()}
        title="Convidar para a comunidade"
        message="Vou copiar o link da comunidade para sua área de transferência. Depois é só colar onde quiser."
        confirmLabel="Copiar convite"
        cancelLabel="Cancelar"
        variant="info"
      />

      <div className="mb-10">
        <button
          onClick={() => router.back()}
          className="group mb-6 flex items-center gap-2 pt-2 text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Voltar para comunidades
        </button>

        <div className="group/comm mb-4 md:mb-8 rounded-[24px] md:rounded-[40px] border border-border/40 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.05)] relative overflow-visible z-40">
          <div className="relative h-[180px] md:h-[220px] z-40 overflow-visible">
            <div className="absolute inset-0 overflow-hidden rounded-t-[24px] md:rounded-t-[40px] z-0" style={coverStyle}>
              {community.coverURL ? (
                <Image
                  src={community.coverURL}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 1000px) 100vw, 1000px"
                  referrerPolicy="no-referrer"
                  className="object-cover transition-transform duration-1000 group-hover/comm:scale-105"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </div>

            <div className="absolute bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-8 z-50">
              <div className="flex flex-col md:flex-row items-start md:items-end gap-3 md:gap-4">
                <div className="relative shrink-0">
                  <div 
                    className="relative flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-[28px] md:rounded-[36px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.2)] overflow-hidden ring-4 ring-white/10 text-2xl md:text-3xl font-black text-slate-800"
                  >
                    {community.image ? (
                      <Image
                        src={community.image}
                        alt=""
                        fill
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      community.name.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>

                <div className="mt-1 md:mt-2 min-w-0 flex-1 w-full">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-2xl md:text-3xl font-black tracking-tight text-white drop-shadow-sm">
                      {community.name}
                    </h1>
                    {community.type === 'Private' && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 backdrop-blur-md">
                        <Lock className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-[14px] font-bold text-white/90">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 opacity-70" />
                      {(community.memberCount || 0).toLocaleString('pt-BR')} membros
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-4 w-4 opacity-70" />
                      {community.type === 'Public' ? 'Pública' : 'Privada'}
                    </span>
                  </div>
                </div>

                <div className="hidden">
                  <button
                    onClick={handleInvite}
                    className="flex h-10 md:h-11 shrink-0 items-center gap-1 md:gap-2 rounded-xl md:rounded-2xl border border-white/30 bg-white/10 px-3 md:px-5 text-[12px] md:text-[13px] font-black text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Convidar</span>
                  </button>
                  <button
                    onClick={handleShareCommunity}
                    className="flex h-10 md:h-11 shrink-0 items-center gap-1 md:gap-2 rounded-xl md:rounded-2xl border border-white/30 bg-white/10 px-3 md:px-5 text-[12px] md:text-[13px] font-black text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 whitespace-nowrap"
                  >
                    <Link2 className="h-4 w-4" />
                    <span className="hidden md:inline">Compartilhar</span>
                  </button>

                  <div className="relative group/actions shrink-0">
                    <button
                      onClick={() => setShowMemberMenu(!showMemberMenu)}
                      disabled={!isMember && joinRequestPending && community?.security?.requireApproval}
                      className="flex w-full md:w-auto shrink-0 justify-center h-10 md:h-11 items-center gap-2 rounded-xl md:rounded-2xl px-4 md:px-6 font-black text-white shadow-lg transition-all hover:opacity-95 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      style={
                        !isMember && !(joinRequestPending && community?.security?.requireApproval)
                          ? {
                              backgroundColor: themeColor,
                              boxShadow: `0 12px 24px ${hexToRgba(themeColor, 0.4)}`,
                            }
                          : {
                              backgroundColor: 'rgba(255, 255, 255, 0.12)',
                              backdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
                            }
                      }
                    >
                      {isMember ? (
                        <div className="flex items-center gap-2 drop-shadow-sm">
                          <Check className="h-4 w-4" />
                          <span>Entrou</span>
                          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showMemberMenu ? 'rotate-180' : ''}`} />
                        </div>
                      ) : joinRequestPending && community?.security?.requireApproval ? (
                        'Pendente'
                      ) : (
                        'Entrar'
                      )}
                    </button>

                    {isMember && showMemberMenu && (
                      <div className="absolute right-0 top-full mt-2 w-64 z-[1000] animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300">
                        <div className="rounded-[28px] border border-slate-200 bg-white p-2 shadow-[0_30px_60px_rgba(0,0,0,0.25)]">
                          <button
                            onClick={() => {
                              setShowMemberMenu(false);
                              void toggleMute();
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left text-[14px] font-bold text-slate-800 transition-all hover:bg-slate-100 active:scale-[0.98]"
                          >
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${muted ? 'bg-rose-100' : 'bg-primary/10'}`}>
                              <Bell className={`h-4 w-4 ${muted ? 'text-rose-500' : 'text-primary'}`} />
                            </div>
                            {muted ? 'Ativar notificações' : 'Silenciar espaço'}
                          </button>
                          <div className="h-px bg-slate-100 my-1 mx-2 opacity-50" />
                          <button
                            onClick={() => {
                              setShowMemberMenu(false);
                              setIsLeaveModalOpen(true);
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left text-[14px] font-bold text-rose-500 transition-all hover:bg-rose-50 active:scale-[0.98]"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100">
                              <LogOut className="h-4 w-4" />
                            </div>
                            Sair da comunidade
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 md:px-8">
            <div className="flex items-center justify-end gap-2 overflow-x-auto no-scrollbar">
              {(isAdmin || isStaff) && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border/40 bg-white px-3 text-[13px] font-black text-foreground transition-colors hover:bg-muted/30 active:scale-95 whitespace-nowrap"
                  title="Configurar comunidade"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Configurar</span>
                </button>
              )}
              <button
                onClick={handleInvite}
                className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border/40 bg-white px-3 text-[13px] font-black text-foreground transition-colors hover:bg-muted/30 active:scale-95 whitespace-nowrap"
                title="Convidar"
              >
                <Plus className="h-4 w-4" />
                Convidar
              </button>
              <button
                onClick={handleShareCommunity}
                className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border/40 bg-white px-3 text-[13px] font-black text-foreground transition-colors hover:bg-muted/30 active:scale-95 whitespace-nowrap"
                title="Compartilhar"
              >
                <Link2 className="h-4 w-4" />
                <span className="hidden sm:inline">Compartilhar</span>
                <span className="sm:hidden">Link</span>
              </button>

              <div className="relative shrink-0">
                <button
                  onClick={() => {
                    if (isMember) {
                      setShowMemberMenu(!showMemberMenu);
                      return;
                    }
                    if (joinRequestPending && community?.security?.requireApproval) return;
                    handleJoinLeaveAction();
                  }}
                  disabled={!isMember && joinRequestPending && community?.security?.requireApproval}
                  className={`flex h-9 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-black transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap ${
                    isMember
                      ? 'border border-border/40 bg-muted/20 text-foreground hover:bg-muted/30'
                      : 'text-white hover:opacity-95'
                  }`}
                  style={
                    isMember
                      ? undefined
                      : {
                          backgroundColor: themeColor,
                          boxShadow: `0 10px 20px ${hexToRgba(themeColor, 0.28)}`,
                        }
                  }
                >
                  {isMember ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Entrou</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-300 ${showMemberMenu ? 'rotate-180' : ''}`}
                      />
                    </>
                  ) : joinRequestPending && community?.security?.requireApproval ? (
                    'Pendente'
                  ) : (
                    'Entrar'
                  )}
                </button>

                {isMember && showMemberMenu && (
                  <div className="absolute right-0 top-full mt-2 w-64 z-[1000] animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-2 shadow-[0_30px_60px_rgba(0,0,0,0.25)]">
                      <button
                        onClick={() => {
                          setShowMemberMenu(false);
                          void toggleMute();
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left text-[14px] font-bold text-slate-800 transition-all hover:bg-slate-100 active:scale-[0.98]"
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${muted ? 'bg-rose-100' : 'bg-primary/10'}`}
                        >
                          <Bell className={`h-4 w-4 ${muted ? 'text-rose-500' : 'text-primary'}`} />
                        </div>
                        {muted ? 'Ativar notificaÃ§Ãµes' : 'Silenciar espaÃ§o'}
                      </button>
                      <div className="h-px bg-slate-100 my-1 mx-2 opacity-50" />
                      <button
                        onClick={() => {
                          setShowMemberMenu(false);
                          setIsLeaveModalOpen(true);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left text-[14px] font-bold text-rose-500 transition-all hover:bg-rose-50 active:scale-[0.98]"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100">
                          <LogOut className="h-4 w-4" />
                        </div>
                        Sair da comunidade
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="sticky top-[56px] md:top-[64px] z-30 border-t border-border/40 bg-white/80 px-4 md:px-8 py-3 backdrop-blur-md">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
              <div className="flex w-full md:w-auto items-center gap-1 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                {[
                  { id: 'discussion', label: 'Discussão', onClick: () => setActiveTab('discussion') },
                  { id: 'highlights', label: 'Em destaque', onClick: () => setActiveTab('highlights') },
                  { id: 'people', label: 'Pessoas', onClick: () => setActiveTab('people') },
                  { id: 'media', label: 'Mídia', onClick: () => setActiveTab('media') },
                  { id: 'about', label: 'Sobre', onClick: () => setActiveTab('about') },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`relative whitespace-nowrap rounded-xl px-5 py-2.5 text-[13px] font-black transition-all ${
                      activeTab === tab.id
                        ? 'text-white'
                        : 'text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {activeTab === tab.id && (
                      <div
                        className="absolute inset-0 rounded-xl shadow-lg"
                        style={{ backgroundColor: themeColor }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0 z-50">
                <div className="relative">
                  <button
                    onClick={() => setSearchOpen(!searchOpen)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                      searchOpen ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                    }`}
                    title="Buscar"
                  >
                    <Search className="h-4.5 w-4.5" />
                  </button>

                  {searchOpen && (
                    <div className="absolute right-0 top-full mt-2 w-[320px] rounded-2xl border border-border/40 bg-white p-3 shadow-2xl">
                      <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 px-3 py-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <input
                          value={communitySearchQuery}
                          onChange={(e) => setCommunitySearchQuery(e.target.value)}
                          placeholder="Buscar na comunidade..."
                          className="w-full bg-transparent text-[13px] font-bold text-foreground placeholder:text-muted-foreground outline-none"
                        />
                        {communitySearchQuery.trim() && (
                          <button onClick={() => setCommunitySearchQuery('')}>
                            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                      showMoreMenu ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                    }`}
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>

                  {showMoreMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border/40 bg-white p-2 shadow-2xl">
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          void handleShareCommunity();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] font-bold text-slate-800 hover:bg-slate-100/50 rounded-xl transition-all"
                      >
                        <Link2 className="h-4 w-4 text-emerald-500" />
                        Compartilhar link
                      </button>
                      <div className="h-px bg-slate-100/50 my-1 mx-2" />
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          void handleReportCommunity();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Denunciar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {false && (
          <div className="grid gap-5 bg-white/50 p-4 backdrop-blur-sm md:p-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div id="comm-about" className="group/sobre relative scroll-mt-24">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-muted-foreground/45">
                  Sobre a comunidade
                </h3>
                {isAdmin && (
                  <button 
                    onClick={() => setShowSettings(true)}
                    className="flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1 text-[10px] font-bold text-primary opacity-0 transition-opacity group-hover/sobre:opacity-100 hover:bg-primary/10"
                  >
                    <Settings className="h-3 w-3" />
                    Editar informações
                  </button>
                )}
              </div>
              <div className="max-w-4xl text-[15px] font-medium leading-relaxed text-foreground/80 md:text-lg">
                {community.description ? renderTextWithLinks(community.description) : 'Esta comunidade ainda não possui uma descrição.'}
              </div>

              {!!community.pinnedTopics?.length && (
                <div className="mt-5 space-y-2">
                  {community.pinnedTopics.slice(0, 4).map((topic: string, index: number) => (
                    <div
                      key={`${topic}-${index}`}
                      className="flex items-start gap-2 rounded-xl bg-muted/35 px-3 py-2 text-[13px] leading-snug text-foreground/80"
                    >
                      <Tag className="mt-[2px] h-4 w-4 shrink-0" style={{ color: themeColor }} />
                      <span className="line-clamp-1">{topic}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-0 rounded-[28px] border border-border/50 bg-white p-5 shadow-sm lg:mt-6">
              <div className="mb-4 flex items-center gap-2">
                <h3 className="font-bold text-foreground">Presença da comunidade</h3>
              </div>
              <div className="space-y-3 text-sm">
                {memberSince ? (
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-semibold text-foreground">Você entrou em</p>
                      <p className="text-muted-foreground">
                        {memberSince!.toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-start gap-3">
                  <Eye className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-semibold text-foreground">
                      {isPublicCommunity ? 'Visível para usuários autenticados' : 'Espaço privado'}
                    </p>
                    <p className="text-muted-foreground">
                      {isPublicCommunity
                        ? 'Quem ainda não entrou consegue sentir o clima antes de participar.'
                        : 'A entrada depende de aprovação e as conversas ficam protegidas.'}
                    </p>
                  </div>
                </div>
                {!!community.links?.length && (
                  <div className="space-y-2 border-t border-border/50 pt-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground/55">
                      Links úteis
                    </p>
                    {community.links.map((linkItem: { label: string; url: string }) => (
                      <Link
                        key={`${linkItem.label}-${linkItem.url}`}
                        href={linkItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
                      >
                        <Link2 className="h-4 w-4" style={{ color: themeColor }} />
                        {linkItem.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
        </div>

        {weeklyHighlight?.postTitle && activeTab !== 'highlights' && (
          <div
            className="group/highlight mb-8 overflow-hidden rounded-2xl border border-border/40 bg-white shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-4 bg-slate-50/50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Eye className="h-5 w-5" />
              </div>
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <Link 
                  href={`/post/${weeklyHighlight.postId}`}
                  className="truncate text-[14px] font-bold text-slate-900 transition-colors hover:text-primary"
                >
                  {renderTextWithLinks(`“${weeklyHighlight.postTitle}”`, { inline: true })}
                </Link>

                {weeklyHighlight.memberName && (
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                    <span className="opacity-40 italic">por</span>
                    <Link 
                      href={`/profile/${weeklyHighlight.memberId}`}
                      className="font-bold text-slate-700 hover:text-primary transition-colors"
                    >
                      @{weeklyHighlight.memberName.replace(/\s+/g, '').toLowerCase()}
                    </Link>
                  </div>
                )}
              </div>
              <Link 
                href={`/post/${weeklyHighlight.postId}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm text-slate-400 hover:text-primary transition-all active:scale-90"
              >
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_420px] md:gap-10 2xl:grid-cols-[minmax(0,1fr)_460px]">
          <div id="comm-discussion" className="scroll-mt-24">
            {isMember ? (
              <>
                {pendingApprovalCount > 0 && (
                  <div className="mb-6 rounded-[28px] border border-border/50 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                          Aguardando aprovação
                        </p>
                        <p className="mt-1 text-[15px] font-semibold text-foreground/85">
                          {isStaff
                            ? `${pendingApprovalCount} posts pendentes para revisar`
                            : `Você tem ${pendingApprovalCount} post(s) pendente(s)`}
                        </p>
                      </div>
                      {isStaff && (
                        <button
                          onClick={() => router.push(`/communities/${community.id}/admin/moderation`)}
                          className="rounded-2xl px-5 py-3 text-[13px] font-black text-white transition-all hover:opacity-95 active:scale-95"
                          style={{ backgroundColor: themeColor }}
                        >
                          Gerenciar posts
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <CreatePost
                  communityId={community.id}
                  communityName={community.name}
                  communitySecurity={community?.security}
                  isCommunityStaff={isStaff}
                />
                {activeTab === 'people' ? (
                  <div className="rounded-[28px] border border-border/50 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-extrabold text-foreground">Pessoas</h3>
                        <p className="text-sm text-muted-foreground">
                          {(community.memberCount || 0).toLocaleString('pt-BR')} membros
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {memberPreview.map((m) => (
                        <Link
                          key={m.id}
                          href={`/profile/${m.id}`}
                          className="flex items-center gap-3 rounded-2xl border border-border/40 bg-white p-3 transition-colors hover:bg-muted/30"
                        >
                          <div className="h-10 w-10 overflow-hidden rounded-2xl bg-muted">
                            {m.photoURL ? (
                              <img src={m.photoURL} className="h-full w-full object-cover" alt="" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-black text-foreground">{m.displayName || m.username || 'Membro'}</div>
                            <div className="truncate text-[11px] font-semibold text-muted-foreground">
                              @{String(m.username || m.displayName || m.id).replace(/\s+/g, '').toLowerCase()}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : activeTab === 'media' ? (
                  <Feed
                    communityId={community.id}
                    type="media"
                    searchQuery={communitySearchQuery}
                    containerClassName="w-full max-w-none"
                  />
                ) : activeTab === 'highlights' ? (
                  <>
                    {weeklyHighlight ? (
                      <div className="mb-6 rounded-[28px] border border-border/50 bg-white p-6 shadow-sm">
                        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Em destaque</p>
                        <Link href={`/post/${weeklyHighlight.postId}`} className="mt-2 block text-[16px] font-extrabold text-foreground hover:text-primary">
                          {renderTextWithLinks(weeklyHighlight.postTitle || '', { inline: true })}
                        </Link>
                        {weeklyHighlight.memberName ? (
                          <p className="mt-2 text-sm font-semibold text-muted-foreground">
                            por @{weeklyHighlight.memberName.replace(/\s+/g, '').toLowerCase()}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mb-6 rounded-[28px] border border-border/50 bg-white p-6 shadow-sm">
                        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Em destaque</p>
                        <p className="mt-2 text-sm text-muted-foreground">Ainda não há destaque desta semana.</p>
                      </div>
                    )}
                    <Feed
                      communityId={community.id}
                      pinnedPostIds={community.pinnedPostIds}
                      searchQuery={communitySearchQuery}
                      containerClassName="w-full max-w-none"
                    />
                  </>
                ) : activeTab === 'about' ? (
                  <div className="rounded-[28px] border border-border/50 bg-white p-6 shadow-sm">
                    <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Sobre</p>
                    <div className="mt-2 text-[15px] leading-7 text-foreground/85">
                      {community.description ? renderTextWithLinks(community.description) : 'Esta comunidade ainda não possui uma descrição.'}
                    </div>
                    {!!community.pinnedTopics?.length && (
                      <div className="mt-5 space-y-2">
                        {community.pinnedTopics.slice(0, 6).map((topic: string, index: number) => (
                          <div
                            key={`${topic}-${index}`}
                            className="flex items-start gap-2 rounded-xl bg-muted/30 px-3 py-2 text-[13px] leading-snug text-foreground/80"
                          >
                            <Tag className="mt-[2px] h-4 w-4 shrink-0" style={{ color: themeColor }} />
                            <span className="line-clamp-2">{topic}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Feed
                    communityId={community.id}
                    pinnedPostIds={community.pinnedPostIds}
                    searchQuery={communitySearchQuery}
                    containerClassName="w-full max-w-none"
                  />
                )}
              </>
            ) : isPublicCommunity ? (
              <div className="space-y-4">
                <div className="rounded-[28px] border border-border/50 bg-white p-6 shadow-sm">
                  <h3 className="mb-2 text-xl font-bold text-foreground">
                    Veja o clima antes de entrar
                  </h3>
                  <p className="text-muted-foreground">
                    Você já consegue sentir o tom da conversa. Entre para ver o feed completo,
                    comentar e publicar.
                  </p>
                </div>

                {previewPosts.map((post: any, index) => (
                  <div key={post.id} className="relative overflow-hidden rounded-[28px] border border-border/50 bg-white p-5 shadow-sm">
                    {index > 0 && (
                      <div className="absolute inset-0 z-10 backdrop-blur-[2px] bg-white/10" />
                    )}
                    <div className="mb-4 flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black text-white"
                        style={{ backgroundColor: hexToRgba(themeColor, 0.75) }}
                      >
                        {(post.authorName || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{post.authorName || 'Membro da comunidade'}</p>
                        <p className="text-xs text-muted-foreground">
                          {post.createdAt?.toDate
                            ? post.createdAt.toDate().toLocaleDateString('pt-BR')
                            : 'Agora'}
                        </p>
                      </div>
                    </div>
                    <div className="mb-4 text-[15px] leading-7 text-foreground/85">
                      {renderTextWithLinks(post.content)}
                    </div>
                    <div className="flex items-center gap-5 text-xs font-semibold text-muted-foreground">
                      <span>{post.likesCount || 0} curtidas</span>
                      <span>{post.commentsCount || 0} comentários</span>
                    </div>
                  </div>
                ))}

                <div className="rounded-[28px] border border-dashed border-border/60 bg-white p-8 text-center">
                  <button
                    onClick={handleJoinLeaveAction}
                    disabled={!!community?.security?.requireApproval && joinRequestPending}
                    className="rounded-2xl px-8 py-3 font-bold text-white transition-all hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ backgroundColor: themeColor }}
                  >
                    {!!community?.security?.requireApproval
                      ? joinRequestPending
                        ? 'Aguardando aprovação do administrador'
                        : 'Pedir para entrar'
                      : 'Entre na comunidade para ver tudo'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border/50 bg-white p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Lock className="h-8 w-8" />
                </div>
                <h3 className="mb-2 text-xl font-bold">Comunidade privada</h3>
                <p className="mb-6 text-muted-foreground">
                  Entre para acessar as conversas, o histórico e os detalhes internos deste espaço.
                </p>
                <button
                  onClick={handleJoinLeaveAction}
                  className="rounded-xl px-8 py-3 font-bold text-white transition-all hover:opacity-95"
                  style={{ backgroundColor: themeColor }}
                >
                  Solicitar entrada
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6 md:sticky md:top-[96px] self-start">
            <div className="rounded-3xl border border-border/50 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-bold">
                <Shield className="h-5 w-5" style={{ color: themeColor }} />
                Sobre este espaço
              </h3>
              <div className="space-y-4 text-sm">
                {community.description ? (
                  <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 text-[13px] leading-relaxed text-muted-foreground">
                    <div className="line-clamp-4">{renderTextWithLinks(community.description, { inline: true })}</div>
                  </div>
                ) : null}

                {!!community.pinnedTopics?.length && (
                  <div className="space-y-2">
                    {community.pinnedTopics.slice(0, 4).map((topic: string, index: number) => (
                      <div
                        key={`${topic}-${index}`}
                        className="flex items-start gap-2 rounded-xl bg-muted/30 px-3 py-2 text-[13px] leading-snug text-foreground/80"
                      >
                        <Tag className="mt-[2px] h-4 w-4 shrink-0" style={{ color: themeColor }} />
                        <span className="line-clamp-1">{topic}</span>
                      </div>
                    ))}
                  </div>
                )}

                {memberSince ? (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-bold">Voce entrou em</p>
                      <p className="text-muted-foreground">
                        {memberSince!.toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {community.type === 'Public' ? (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold">{community.type === 'Public' ? 'Comunidade pública' : 'Comunidade privada'}</p>
                    <p className="text-muted-foreground">
                      {community.type === 'Public'
                        ? 'Usuários autenticados podem descobrir o espaço e sentir o contexto antes de entrar.'
                        : 'A entrada depende de aprovação e o conteúdo fica reservado aos membros.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <div className="relative">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {recentActivityCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="font-bold">Comunidade viva</p>
                    <p className="text-muted-foreground">
                      {(community.memberCount || 0).toLocaleString('pt-BR')} membros
                      {onlineCount > 0 ? ` - ${onlineCount} online agora` : ''}
                      {recentActivityCount > 0 ? ` - ${recentActivityCount} posts hoje` : ' - Sempre ativa'}
                    </p>
                  </div>
                </div>

                {!!community.links?.length && (
                  <div className="space-y-2 border-t border-border/40 pt-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground/60">
                      Links uteis
                    </p>
                    {community.links.slice(0, 5).map((linkItem: { label: string; url: string }) => (
                      <Link
                        key={`${linkItem.label}-${linkItem.url}`}
                        href={linkItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
                      >
                        <Link2 className="h-4 w-4" style={{ color: themeColor }} />
                        <span className="line-clamp-1">{linkItem.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-border/50 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-bold">Regras da comunidade</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {community?.rules?.length > 0 ? (
                  community.rules.map((rule: any, index: number) => (
                    <li key={index} className="flex gap-2">
                      <span className="font-bold" style={{ color: themeColor }}>
                        {index + 1}.
                      </span>
                      <div>
                        <strong className="text-foreground">{rule.title}</strong>
                        {rule.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{rule.description}</p>
                        )}
                      </div>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{ color: themeColor }}>
                        1.
                      </span>
                      Respeite o contexto e o tema principal da comunidade.
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{ color: themeColor }}>
                        2.
                      </span>
                      Evite spam, autopromoção agressiva e conteúdo sem contexto.
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{ color: themeColor }}>
                        3.
                      </span>
                      Mantenha conversas construtivas e úteis para quem participa.
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

      <ConfirmModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onConfirm={handleLeave}
        title={t('community.leave_title', 'Sair da Comunidade')}
        message={t('community.leave_confirm', 'Tem certeza que deseja sair desta comunidade? Você precisará entrar novamente para participar das discussões.')}
        confirmText={t('common.leave', 'Sair')}
        cancelText={t('common.cancel', 'Cancelar')}
        variant="danger"
      />

      <CommunityShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        community={community}
        defaultTab={shareModalTab}
      />
    </AppLayout>
  );
}
