'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/firebase';
import { rankTrendingHashtags } from '@/lib/hashtags';
import { useAppStore } from '@/lib/store';
import { getRelationshipSnapshot, getSuggestedFriends, sendFriendRequest } from '@/lib/friendships';
import { CommunitiesInviteCard } from '@/components/dock/CommunitiesInviteCard';

function formatCompact(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (abs >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(n));
}

const blockCls = 'px-5 py-4 flex flex-col gap-3';

export function RightPanelLeft() {
  const currentUser = useAppStore((state) => state.user);

  const [trendingTags, setTrendingTags] = useState<{ tag: string; score: number; count: number }[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [relationshipMap, setRelationshipMap] = useState<Record<string, any>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const postsQuery = query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(140)
    );

    let unsubFallback: (() => void) | undefined;
    const unsub = onSnapshot(
      postsQuery,
      (snap) => {
        const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTrendingTags(rankTrendingHashtags(posts).slice(0, 5));
      },
      (err: any) => {
        const isIndexError =
          err?.code === 'failed-precondition' || String(err?.message || '').toLowerCase().includes('index');
        if (!isIndexError) console.warn('Trending listener error:', err);
        const fallbackQuery = query(collection(db, 'posts'), where('visibility', '==', 'public'), limit(140));
        unsubFallback = onSnapshot(
          fallbackQuery,
          (snap) => {
            const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setTrendingTags(rankTrendingHashtags(posts).slice(0, 5));
          },
          (err2) => console.error('Trending fallback error:', err2)
        );
      }
    );

    return () => {
      unsub();
      if (unsubFallback) unsubFallback();
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;
    let cancelled = false;
    const load = async () => {
      try {
        const suggested = await getSuggestedFriends(currentUser.uid);
        if (cancelled) return;
        const top = suggested.slice(0, 3);
        setSuggestions(top);
        const map: Record<string, any> = {};
        for (const s of top) {
          map[s.id] = await getRelationshipSnapshot(currentUser.uid, s.id);
        }
        if (!cancelled) setRelationshipMap(map);
      } catch (e) {
        console.error('Suggestions error:', e);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  return (
    <div className="w-full flex flex-col gap-6 pb-12">
      {/* Trending Block */}
      <div className={`aura-panel ${blockCls}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-[15px] text-slate-900">Trending</h3>
          <Link href="/explore" className="aura-link text-[12px] font-bold">
            Ver todos
          </Link>
        </div>
        <div className="flex flex-col">
          {trendingTags.length > 0 ? trendingTags.map((x) => (
            <Link
              key={x.tag}
              href={`/explore?q=${encodeURIComponent(x.tag.startsWith('#') ? x.tag : `#${x.tag}`)}`}
              className="py-3 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-bold text-[15px]">#</span>
                <div className="flex flex-col">
                  <p className="font-bold text-[14px] text-slate-900 group-hover:text-primary transition-colors">
                    {String(x.tag || '').replace(/^#/, '')}
                  </p>
                  <p className="text-[12px] text-slate-400 font-medium">{formatCompact(x.count)} posts</p>
                </div>
              </div>
            </Link>
          )) : (
            <div className="py-4 text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 text-[18px]">
                #
              </div>
              <p className="text-[13px] text-slate-600 font-semibold">
                Sem dados no momento
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                Volte em instantes ou explore novos tópicos.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Suggested Follows Block */}
      <div className={`aura-panel ${blockCls}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-[15px] text-slate-900">Pessoas para seguir</h3>
          <Link href="/network" className="aura-link text-[12px] font-bold">
            Ver todos
          </Link>
        </div>
        <div className="flex flex-col gap-4">
          {suggestions.length > 0 ? suggestions.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-50">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-slate-50">
                      {u.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[13px] text-slate-900 truncate leading-tight">{u.displayName}</p>
                  <p className="text-[11px] text-slate-400 truncate font-medium">@{u.username}</p>
                </div>
              </div>
              <button
                type="button"
                className="h-7 px-4 rounded-full border border-border text-[11px] font-bold text-primary hover:bg-secondary-hover transition-colors"
              >
                Seguir
              </button>
            </div>
          )) : (
            <div className="py-2">
              <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
                Sem sugestões no momento.
              </p>
              <Link href="/network" className="aura-link text-[12px] font-bold inline-block mt-2">
                Ver pessoas
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Communities Invite Box */}
      <CommunitiesInviteCard />

      {/* Footer Links */}
      <div className="px-2">
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-3">
          {['Sobre', 'Ajuda', 'Privacidade', 'Termos', 'Cookies'].map((link) => (
            <Link key={link} href="#" className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors">
              {link}
            </Link>
          ))}
        </div>
        <p className="text-[10px] font-bold text-slate-400">
          © 2024 Aura — Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
