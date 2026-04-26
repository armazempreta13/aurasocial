'use client';

import { AppLayout } from '@/components/AppLayout';
import {
  Users,
  Search,
  Plus,
  Globe,
  Lock,
  X,
  Upload,
  Loader2,
  Camera,
  UserPlus,
  Link2,
  Tag,
  Paintbrush,
  ImagePlus,
  BadgeCheck,
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '@/firebase';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import Link from 'next/link';
import Image from 'next/image';
import { uploadImage } from '@/lib/image-utils';
import { getFriendIds } from '@/lib/friendships';
import { useTranslation } from 'react-i18next';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import {
  buildCommunityCoverStyle,
  COMMUNITY_THEME_PRESETS,
  DEFAULT_COMMUNITY_THEME,
  hexToRgba,
  normalizeThemeColor,
} from '@/lib/community-theme';
import { isAuraSocialCommunity } from '@/lib/community-official';

const EMPTY_LINK = { label: '', url: '' };

type CommunityDraft = {
  name: string;
  description: string;
  type: string;
  image: string;
  coverURL: string;
  themeColor: string;
  pinnedTopics: string[];
  links: { label: string; url: string }[];
};

function normalizeCommunityName(name: string) {
  return (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function buildPageButtons(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const buttons: Array<number | '...'> = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) buttons.push('...');
  for (let p = left; p <= right; p++) buttons.push(p);
  if (right < totalPages - 1) buttons.push('...');
  buttons.push(totalPages);
  return buttons;
}

export default function CommunitiesPage() {
  const { t } = useTranslation('common');
  const { user, isAuthReady } = useRequireAuth();
  const { profile } = useAppStore();
  const [communities, setCommunities] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'explore' | 'my'>('explore');
  const [sortBy, setSortBy] = useState<'members' | 'newest'>('members');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [newCommunity, setNewCommunity] = useState<CommunityDraft>({
    name: '',
    description: '',
    type: 'Public',
    image: '',
    coverURL: '',
    themeColor: DEFAULT_COMMUNITY_THEME,
    pinnedTopics: ['', '', ''],
    links: [{ ...EMPTY_LINK }],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);


  const resetForm = () => {
    setNewCommunity({
      name: '',
      description: '',
      type: 'Public',
      image: '',
      coverURL: '',
      themeColor: DEFAULT_COMMUNITY_THEME,
      pinnedTopics: ['', '', ''],
      links: [{ ...EMPTY_LINK }],
    });
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'image' | 'coverURL',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (target === 'image') {
      setIsUploadingAvatar(true);
    } else {
      setIsUploadingCover(true);
    }

    try {
      const result = await uploadImage(file);
      setNewCommunity((current) => ({ ...current, [target]: result.url }));
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Falha ao enviar a imagem: ${error.message}`);
    } finally {
      if (target === 'image') {
        setIsUploadingAvatar(false);
      } else {
        setIsUploadingCover(false);
      }
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'communities'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const communitiesData = snapshot.docs.map((communityDoc) => ({
        id: communityDoc.id,
        ...communityDoc.data(),
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

    const normalizedName = normalizeCommunityName(newCommunity.name);
    const hasDuplicateName = communities.some(
      (c) => normalizeCommunityName(String(c?.name || '')) === normalizedName,
    );
    if (hasDuplicateName) {
      alert('Já existe uma comunidade com esse nome. Escolha outro nome para evitar duplicidade.');
      return;
    }

    setIsSubmitting(true);
    try {
      const communityRef = doc(collection(db, 'communities'));
      const memberRef = doc(db, 'communities', communityRef.id, 'members', profile.uid);
      const batch = writeBatch(db);
      const pinnedTopics = newCommunity.pinnedTopics
        .map((topic) => topic.trim())
        .filter(Boolean)
        .slice(0, 5);
      const links = newCommunity.links
        .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
        .filter((link) => link.label && link.url)
        .slice(0, 3);
      const themeColor = normalizeThemeColor(newCommunity.themeColor);

      batch.set(communityRef, {
        name: newCommunity.name.trim(),
        description: newCommunity.description.trim(),
        type: newCommunity.type,
        image: newCommunity.image || '',
        coverURL: newCommunity.coverURL || '',
        themeColor,
        pinnedTopics,
        links,
        creatorId: profile.uid,
        members: [profile.uid],
        memberCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(memberRef, {
        uid: profile.uid,
        memberSince: serverTimestamp(),
      });
      await batch.commit();

      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating community:', error);
      alert('Não foi possível criar a comunidade agora.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinLeave = async (e: React.MouseEvent, community: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!profile) return;

    const communityRef = doc(db, 'communities', community.id);
    const memberRef = doc(db, 'communities', community.id, 'members', profile.uid);
    const isMember = community.members?.includes(profile.uid);

    try {
      const batch = writeBatch(db);

      if (isMember) {
        batch.update(communityRef, {
          members: arrayRemove(profile.uid),
          memberCount: increment(-1),
          updatedAt: serverTimestamp(),
        });
        batch.delete(memberRef);
      } else {
        batch.update(communityRef, {
          members: arrayUnion(profile.uid),
          memberCount: increment(1),
          updatedAt: serverTimestamp(),
        });
        batch.set(memberRef, {
          uid: profile.uid,
          memberSince: serverTimestamp(),
        });
      }

      await batch.commit();
    } catch (error) {
      console.error('Error joining/leaving community:', error);
      alert('Não foi possível atualizar sua participação agora.');
    }
  };

  const filteredCommunities = communities
    .filter((community) => {
      const matchesSearch =
        String(community.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(community.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (community.pinnedTopics || []).some((topic: string) =>
          topic.toLowerCase().includes(searchQuery.toLowerCase()),
        );

      if (activeTab === 'my') {
        return matchesSearch && community.members?.includes(profile?.uid);
      }
      return matchesSearch;
    })
    .map((community) => {
      const friendMembers = (community.members || []).filter((memberId: string) =>
        friendIds.has(memberId),
      );
      return {
        ...community,
        themeColor: normalizeThemeColor(community.themeColor),
        friendMembersCount: friendMembers.length,
        socialScore: friendMembers.length * 25 + Math.min(community.memberCount || 0, 200) * 0.2,
      };
    });

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sortBy, searchQuery]);

  const sortedCommunities = useMemo(() => {
    return [...filteredCommunities].sort((a, b) => {
      if (sortBy === 'members') return (b.socialScore || 0) - (a.socialScore || 0);
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });
  }, [filteredCommunities, sortBy]);

  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(sortedCommunities.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedCommunities = sortedCommunities.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <AppLayout wide={true} hideRightPanel={true}>
      <div className="mb-4">
        <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('communities_page.title', 'Comunidades')}
              </h1>
              <p className="text-muted-foreground">
                Descubra espaços com identidade própria, contexto e pessoas que realmente combinam com o tema.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
          >
            <Plus className="h-5 w-5" />
            Criar comunidade
          </button>
        </div>

        <div className="mb-6 flex items-center gap-6 overflow-x-auto border-b border-border/50">
          <button
            onClick={() => setActiveTab('explore')}
            className={`relative whitespace-nowrap pb-3 text-sm font-bold transition-all ${
              activeTab === 'explore'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Explorar comunidades
            {activeTab === 'explore' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 rounded-full bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`relative whitespace-nowrap pb-3 text-sm font-bold transition-all ${
              activeTab === 'my' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Minhas comunidades
            {activeTab === 'my' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 rounded-full bg-primary" />
            )}
          </button>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, descrição ou tópico..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-border/50 bg-white py-3.5 pl-12 pr-4 shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'members' | 'newest')}
            className="rounded-2xl border border-border/50 bg-white px-5 py-3.5 text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-primary/10"
          >
            <option value="members">Ordenar por membros</option>
            <option value="newest">Ordenar por mais novas</option>
          </select>
        </div>

        {sortedCommunities.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/50 bg-white py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="mb-1 text-lg font-bold text-foreground">
              {activeTab === 'my'
                ? 'Você ainda não entrou em nenhuma comunidade'
                : 'Nenhuma comunidade encontrada'}
            </h3>
            <p className="text-muted-foreground">
              {activeTab === 'my'
                ? 'Explore alguns espaços e entre nos que fizerem sentido para você.'
                : 'Tente outra busca ou crie a sua própria comunidade.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pagedCommunities.map((community) => {
                const isMember = community.members?.includes(profile?.uid);
                const accent = normalizeThemeColor(community.themeColor);
                return (
                  <Link
                    href={`/communities/${community.id}`}
                    key={community.id}
                    className="group flex h-full flex-col overflow-hidden rounded-[20px] border border-border/50 bg-white shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
                  >
                    <div
                      className="relative h-24 shrink-0 overflow-hidden"
                      style={!community.coverURL ? buildCommunityCoverStyle(accent) : undefined}
                    >
                      {community.coverURL ? (
                        <Image
                          src={community.coverURL}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          referrerPolicy="no-referrer"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                      <div className="absolute bottom-3 left-3 flex items-center gap-2.5">
                        <div
                          className="relative h-11 w-11 overflow-hidden rounded-[14px] border border-white/35 bg-white/10 shadow-lg backdrop-blur-md"
                          style={{ boxShadow: `0 12px 24px ${hexToRgba(accent, 0.22)}` }}
                        >
                          {community.image ? (
                            <Image
                              src={community.image}
                              alt=""
                              fill
                              sizes="44px"
                              referrerPolicy="no-referrer"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xl font-black text-white">
                              {community.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="text-white">
                          <h3 className="text-[15px] font-bold leading-tight transition-colors group-hover:text-white">
                            <span className="inline-flex items-center gap-1.5">
                              <span>{community.name}</span>
                              {isAuraSocialCommunity(community) && (
                                <BadgeCheck className="h-4 w-4 text-indigo-200 fill-indigo-600 text-white shrink-0" strokeWidth={2.5} />
                              )}
                            </span>
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-white/80">
                            <span className="rounded-full bg-white/12 px-2 py-0.5 backdrop-blur-sm">
                              {(community.memberCount || 0).toLocaleString('pt-BR')} membros
                            </span>
                            <span className="rounded-full bg-white/12 px-2 py-0.5 backdrop-blur-sm">
                              {community.type === 'Public' ? 'Pública' : 'Privada'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <p className="mb-3 line-clamp-1 text-[13px] leading-relaxed text-muted-foreground">
                        {community.description}
                      </p>

                      {community.pinnedTopics?.length > 0 && (
                        <div className="mb-3 space-y-1.5">
                          {community.pinnedTopics.slice(0, 2).map((topic: string, index: number) => (
                            <div
                              key={`${topic}-${index}`}
                              className="flex items-start gap-2 rounded-lg bg-muted/35 px-2.5 py-1.5 text-[12px] leading-snug text-foreground/80"
                            >
                              <Tag className="mt-[1px] h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
                              <span className="line-clamp-1">{topic}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mb-3 flex items-center gap-3 text-[12px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {(community.memberCount || 0).toLocaleString('pt-BR')} membros
                        </span>
                        {community.friendMembersCount > 0 && (
                          <span className="flex items-center gap-1 font-semibold" style={{ color: accent }}>
                            <UserPlus className="h-3.5 w-3.5" />
                            {community.friendMembersCount} amigo
                            {community.friendMembersCount > 1 ? 's' : ''} aqui
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => handleJoinLeave(e, community)}
                        className={`mt-auto w-full rounded-xl py-2 text-[13px] font-bold transition-all ${
                          isMember
                            ? 'bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-600'
                            : 'hover:bg-muted/30'
                        }`}
                        style={
                          isMember
                            ? undefined
                            : {
                                backgroundColor: hexToRgba(accent, 0.12),
                                color: accent,
                              }
                        }
                      >
                        {isMember ? 'Sair da comunidade' : 'Entrar na comunidade'}
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="rounded-xl border border-border/50 bg-white px-3 py-2 text-sm font-bold text-muted-foreground shadow-sm transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>

                {buildPageButtons(safePage, totalPages).map((p, idx) =>
                  p === '...' ? (
                    <span key={`dots-${idx}`} className="px-2 text-sm font-bold text-muted-foreground/60">
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`h-10 min-w-10 rounded-xl border px-3 text-sm font-black shadow-sm transition-colors ${
                        p === safePage
                          ? 'border-primary bg-primary text-white'
                          : 'border-border/50 bg-white text-foreground hover:bg-muted/30'
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded-xl border border-border/50 bg-white px-3 py-2 text-sm font-bold text-muted-foreground shadow-sm transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[32px] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/50 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold">Criar comunidade</h2>
                <p className="text-sm text-muted-foreground">
                  Defina identidade, contexto e presença visual desde o primeiro momento.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-full p-2 transition-colors hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateCommunity}
              className="grid max-h-[calc(92vh-88px)] gap-0 overflow-y-auto lg:grid-cols-[1.1fr_0.9fr]"
            >
              <div className="space-y-5 border-r border-border/40 p-6">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Nome</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex.: Designers Brasil"
                    value={newCommunity.name}
                    onChange={(e) => setNewCommunity((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-xl border-transparent bg-muted/50 px-4 py-3 text-sm transition-all focus:border-primary/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Descrição</label>
                  <textarea
                    required
                    placeholder="Explique o tipo de conversa, o perfil das pessoas e o que faz essa comunidade valer a pena."
                    value={newCommunity.description}
                    onChange={(e) =>
                      setNewCommunity((current) => ({ ...current, description: e.target.value }))
                    }
                    className="min-h-[110px] w-full resize-none rounded-xl border-transparent bg-muted/50 px-4 py-3 text-sm transition-all focus:border-primary/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Tópicos fixos</label>
                  <div className="space-y-2">
                    {newCommunity.pinnedTopics.map((topic, index) => (
                      <div key={index} className="relative">
                        <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder={`Tópico ${index + 1}`}
                          value={topic}
                          onChange={(e) => {
                            const nextTopics = [...newCommunity.pinnedTopics];
                            nextTopics[index] = e.target.value;
                            setNewCommunity((current) => ({ ...current, pinnedTopics: nextTopics }));
                          }}
                          className="w-full rounded-xl border-transparent bg-muted/50 py-2.5 pl-10 pr-4 text-sm transition-all focus:border-primary/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-semibold">Links externos</label>
                    {newCommunity.links.length < 3 && (
                      <button
                        type="button"
                        onClick={() =>
                          setNewCommunity((current) => ({
                            ...current,
                            links: [...current.links, { ...EMPTY_LINK }],
                          }))
                        }
                        className="text-xs font-bold text-primary"
                      >
                        Adicionar link
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {newCommunity.links.map((link, index) => (
                      <div key={index} className="grid gap-2 md:grid-cols-[0.8fr_1.2fr_auto]">
                        <input
                          type="text"
                          placeholder="Label"
                          value={link.label}
                          onChange={(e) => {
                            const nextLinks = [...newCommunity.links];
                            nextLinks[index] = { ...nextLinks[index], label: e.target.value };
                            setNewCommunity((current) => ({ ...current, links: nextLinks }));
                          }}
                          className="rounded-xl border-transparent bg-muted/50 px-4 py-2.5 text-sm transition-all focus:border-primary/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
                        />
                        <div className="relative">
                          <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="url"
                            placeholder="https://..."
                            value={link.url}
                            onChange={(e) => {
                              const nextLinks = [...newCommunity.links];
                              nextLinks[index] = { ...nextLinks[index], url: e.target.value };
                              setNewCommunity((current) => ({ ...current, links: nextLinks }));
                            }}
                            className="w-full rounded-xl border-transparent bg-muted/50 py-2.5 pl-10 pr-4 text-sm transition-all focus:border-primary/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
                          />
                        </div>
                        {newCommunity.links.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setNewCommunity((current) => ({
                                ...current,
                                links: current.links.filter((_, linkIndex) => linkIndex !== index),
                              }))
                            }
                            className="rounded-xl px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Privacidade</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Public', 'Private'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewCommunity((current) => ({ ...current, type }))}
                        className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-all ${
                          newCommunity.type === type
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {type === 'Public' ? 'Pública' : 'Privada'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <ImagePlus className="h-4 w-4" />
                    Capa
                  </label>
                  <div
                    className="relative h-36 overflow-hidden rounded-[24px] border border-border/50"
                    style={!newCommunity.coverURL ? buildCommunityCoverStyle(newCommunity.themeColor) : undefined}
                  >
                    {newCommunity.coverURL ? (
                      <Image
                        src={newCommunity.coverURL}
                        alt="Prévia da capa"
                        fill
                        sizes="(max-width: 768px) 100vw, 800px"
                        referrerPolicy="no-referrer"
                        className="object-cover"
                      />
                    ) : null}
                    {isUploadingCover && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
                    >
                      <Upload className="h-4 w-4" />
                      {newCommunity.coverURL ? 'Trocar capa' : 'Enviar capa'}
                    </button>
                    <input
                      type="file"
                      ref={coverInputRef}
                      onChange={(e) => handleImageUpload(e, 'coverURL')}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Camera className="h-4 w-4" />
                    Avatar da comunidade
                  </label>
                  <div className="flex items-center gap-4">
                    <div
                      className="relative h-20 w-20 overflow-hidden rounded-[24px] border border-border/50"
                      style={{ backgroundColor: hexToRgba(newCommunity.themeColor, 0.1) }}
                    >
                      {newCommunity.image ? (
                        <Image
                          src={newCommunity.image}
                          alt="Prévia do avatar"
                          fill
                          sizes="80px"
                          referrerPolicy="no-referrer"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl font-black text-primary">
                          {newCommunity.name?.trim()?.charAt(0).toUpperCase() || 'A'}
                        </div>
                      )}
                      {isUploadingAvatar && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="flex-1 rounded-xl bg-muted px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted/80"
                    >
                      {newCommunity.image ? 'Trocar avatar' : 'Enviar avatar'}
                    </button>
                    <input
                      type="file"
                      ref={avatarInputRef}
                      onChange={(e) => handleImageUpload(e, 'image')}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Paintbrush className="h-4 w-4" />
                    Cor temática
                  </label>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {COMMUNITY_THEME_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          setNewCommunity((current) => ({ ...current, themeColor: color }))
                        }
                        className={`h-9 w-9 rounded-full border-2 transition-all ${
                          normalizeThemeColor(newCommunity.themeColor) === color
                            ? 'scale-110 border-foreground/30'
                            : 'border-white'
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Escolher cor ${color}`}
                      />
                    ))}
                  </div>
                  <input
                    type="text"
                    value={newCommunity.themeColor}
                    onChange={(e) =>
                      setNewCommunity((current) => ({ ...current, themeColor: e.target.value }))
                    }
                    placeholder="#7F77DD"
                    className="w-full rounded-xl border-transparent bg-muted/50 px-4 py-2.5 text-sm uppercase transition-all focus:border-primary/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
                  />
                </div>

                <div className="rounded-[24px] border border-border/50 bg-muted/20 p-4">
                  <p className="mb-3 text-sm font-semibold text-foreground">Prévia rápida</p>
                  <div
                    className="overflow-hidden rounded-[22px] border border-white/40"
                    style={!newCommunity.coverURL ? buildCommunityCoverStyle(newCommunity.themeColor) : undefined}
                  >
                    <div className="relative h-24">
                      {newCommunity.coverURL ? (
                        <Image
                          src={newCommunity.coverURL}
                          alt=""
                          fill
                          sizes="400px"
                          referrerPolicy="no-referrer"
                          className="object-cover"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                      <div className="absolute bottom-3 left-3 flex items-center gap-3">
                        <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-white/35 bg-white/10 backdrop-blur-md">
                          {newCommunity.image ? (
                            <Image
                              src={newCommunity.image}
                              alt=""
                              fill
                              sizes="48px"
                              referrerPolicy="no-referrer"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-lg font-black text-white">
                              {newCommunity.name?.trim()?.charAt(0).toUpperCase() || 'A'}
                            </div>
                          )}
                        </div>
                        <div className="text-white">
                          <p className="text-sm font-bold">{newCommunity.name || 'Sua comunidade'}</p>
                          <p className="text-[11px] text-white/80">
                            {newCommunity.type === 'Public' ? 'Pública' : 'Privada'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-4">
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {newCommunity.description || 'A descrição aparece aqui para mostrar a identidade do espaço.'}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !newCommunity.name.trim()}
                  className="mt-2 w-full rounded-xl bg-primary py-3.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Criando...' : 'Criar comunidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
