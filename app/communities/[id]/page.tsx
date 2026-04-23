'use client';

import { AppLayout } from '@/components/AppLayout';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/firebase';
import {
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
} from 'lucide-react';
import { Feed } from '@/components/Feed';
import { CreatePost } from '@/components/CreatePost';
import { CommunitySettingsModal } from '@/components/CommunitySettingsModal';
import CommunityJoinGate from '@/components/CommunityJoinGate';
import { ConfirmModal } from '@/components/ConfirmModal';
import Link from 'next/link';
import Image from 'next/image';
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
      return;
    }

    const loadMemberSince = async () => {
      const memberSnap = await getDoc(doc(db, 'communities', id, 'members', profile.uid));
      if (memberSnap.exists() && memberSnap.data().memberSince?.toDate) {
        setMemberSince(memberSnap.data().memberSince.toDate());
      }
    };

    void loadMemberSince();
  }, [community?.members, id, profile?.uid]);

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
    const aDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const activityQuery = query(
      collection(db, 'posts'),
      where('communityId', '==', id),
      where('createdAt', '>=', aDayAgo)
    );

    const unsubscribe = onSnapshot(activityQuery, (snapshot) => {
      setRecentActivityCount(snapshot.size);
    }, (error) => {
      console.warn('Activity sync failed:', error);
    });

    return () => unsubscribe();
  }, [id]);

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

    if (
      community.gate_requireRulesAcceptance &&
      community.rules_currentVersion > 0
    ) {
      setIsForcedUpdate(false);
      setShowGate(true);
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
  const isPublicCommunity = community?.type === 'Public';
  const coverStyle = !community?.coverURL ? buildCommunityCoverStyle(themeColor) : undefined;

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
            alert(isForcedUpdate ? 'Regras atualizadas confirmadas.' : 'Agora você faz parte da comunidade.');
          }}
        />
      )}

      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="group mb-6 flex items-center gap-2 pt-2 text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Voltar para comunidades
        </button>

        <div className="group/comm mb-8 overflow-hidden rounded-[40px] border border-border/40 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <div className="relative h-[220px] overflow-hidden" style={coverStyle}>
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

            <div className="absolute bottom-8 left-8 right-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="flex items-start gap-4">
                <div
                  className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white/20 bg-white/10 text-3xl font-black text-white shadow-2xl backdrop-blur-xl"
                  style={{ boxShadow: `0 22px 44px ${hexToRgba(themeColor, 0.24)}` }}
                >
                  {community.image ? (
                    <Image
                      src={community.image}
                      alt=""
                      fill
                      sizes="80px"
                      referrerPolicy="no-referrer"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      {community.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="text-white">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{community.name}</h1>
                    {isAdmin && (
                      <div
                        className="flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider"
                        style={{
                          backgroundColor: hexToRgba(themeColor, 0.22),
                          borderColor: hexToRgba(themeColor, 0.32),
                        }}
                      >
                        <Shield className="h-3.5 w-3.5" /> Admin
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-white/80">
                    <span className="rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
                      {(community.memberCount || 0).toLocaleString('pt-BR')} membros
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
                      {community.type === 'Public' ? 'Pública' : 'Privada'}
                    </span>
                    {community.createdAt?.toDate && (
                      <span className="rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
                        Criada em{' '}
                        {community.createdAt.toDate().toLocaleDateString('pt-BR', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleJoinLeaveAction}
                  className={`rounded-2xl px-8 py-3 text-[15px] font-black transition-all active:scale-95 ${
                    isMember
                      ? 'border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-red-500/20 hover:text-red-100'
                      : 'text-white shadow-xl'
                  }`}
                  style={
                    isMember
                      ? undefined
                      : {
                          backgroundColor: themeColor,
                          boxShadow: `0 18px 38px ${hexToRgba(themeColor, 0.35)}`,
                        }
                  }
                >
                  {isMember ? 'Sair da comunidade' : 'Entrar na comunidade'}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => router.push(`/communities/${community.id}/admin`)}
                    className="group/settings flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20"
                  >
                    <Settings className="h-6 w-6 transition-transform group-hover/settings:rotate-90" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 bg-white/50 p-8 backdrop-blur-sm lg:grid-cols-[1.15fr_0.85fr]">
            <div className="group/sobre relative">
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
              <p className="max-w-4xl text-lg font-medium leading-relaxed text-foreground/80">
                {community.description || 'Esta comunidade ainda não possui uma descrição.'}
              </p>

              {!!community.pinnedTopics?.length && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {community.pinnedTopics.map((topic: string) => (
                    <span
                      key={topic}
                      className="rounded-full px-3 py-1 text-[12px] font-bold"
                      style={{
                        color: themeColor,
                        backgroundColor: hexToRgba(themeColor, 0.1),
                      }}
                    >
                      #{topic}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-[28px] border border-border/50 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <h3 className="font-bold text-foreground">Presença da comunidade</h3>
              </div>
              <div className="space-y-3 text-sm">
                {memberSince && (
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-semibold text-foreground">Você entrou em</p>
                      <p className="text-muted-foreground">
                        {memberSince.toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                )}
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
        </div>

        {weeklyHighlight?.postTitle && (
          <div
            className="group/highlight mb-8 overflow-hidden rounded-2xl border border-border/40 bg-white shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-4 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/5 px-2 py-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary">Destaque</span>
                </div>
              </div>

              <div className="flex flex-1 items-center gap-3 min-w-0">
                <Link 
                  href={`/post/${weeklyHighlight.postId}`}
                  className="truncate text-[14px] font-bold text-slate-900 transition-colors hover:text-primary"
                >
                  “{weeklyHighlight.postTitle}”
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
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all hover:bg-primary/10 hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isMember ? (
              <>
                <CreatePost communityId={community.id} communityName={community.name} />
                <Feed communityId={community.id} pinnedPostIds={community.pinnedPostIds} />
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
                    <p className="mb-4 whitespace-pre-wrap text-[15px] leading-7 text-foreground/85">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-5 text-xs font-semibold text-muted-foreground">
                      <span>{post.likesCount || 0} curtidas</span>
                      <span>{post.commentsCount || 0} comentários</span>
                    </div>
                  </div>
                ))}

                <div className="rounded-[28px] border border-dashed border-border/60 bg-white p-8 text-center">
                  <button
                    onClick={handleJoinLeaveAction}
                    className="rounded-2xl px-8 py-3 font-bold text-white transition-all hover:opacity-95"
                    style={{ backgroundColor: themeColor }}
                  >
                    Entre na comunidade para ver tudo
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

          <div className="space-y-6">
            <div className="rounded-3xl border border-border/50 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-bold">
                <Shield className="h-5 w-5" style={{ color: themeColor }} />
                Sobre este espaço
              </h3>
              <div className="space-y-4 text-sm">
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
                      {(community.memberCount || 0).toLocaleString('pt-BR')} membros {onlineCount > 0 && `• ${onlineCount} online agora `} • {recentActivityCount > 0 ? `${recentActivityCount} posts hoje` : 'Sempre ativa'}
                    </p>
                  </div>
                </div>
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
    </AppLayout>
  );
}
