'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';

import { db } from '@/firebase';
import { useAppStore } from '@/lib/store';

function initials(name: string) {
  const clean = String(name || '').trim();
  if (!clean) return 'C';
  return clean.charAt(0).toUpperCase();
}

export function FeaturedCommunities({ variant = 'dock' }: { variant?: 'dock' | 'strip' }) {
  const profile = useAppStore((s) => s.profile);
  const [myCommunities, setMyCommunities] = useState<any[]>([]);
  const [discoverCommunities, setDiscoverCommunities] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.uid) {
      setMyCommunities([]);
      return;
    }

    const qMy = query(
      collection(db, 'communities'),
      where('members', 'array-contains', profile.uid),
      limit(10)
    );
    return onSnapshot(qMy, (snap) => setMyCommunities(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [profile?.uid]);

  useEffect(() => {
    const qDiscover = query(collection(db, 'communities'), limit(10));
    return onSnapshot(qDiscover, (snap) => setDiscoverCommunities(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  const items = useMemo(() => {
    const byId = new Map<string, any>();
    [...myCommunities, ...discoverCommunities].forEach((c) => byId.set(c.id, c));
    return Array.from(byId.values()).slice(0, 10);
  }, [myCommunities, discoverCommunities]);

  if (items.length === 0) return null;

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13px] font-black text-slate-900">Comunidades em destaque</p>
        <p className="text-[11px] text-slate-400 font-medium">Amostra rápida dos espaços mais ativos.</p>
      </div>
      <Link href="/communities" className="aura-link text-[12px] font-bold">
        Ver todas
      </Link>
    </div>
  );

  if (variant === 'strip') {
    return (
      <div className="aura-panel p-4 mb-4">
        {header}
        <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto pb-1">
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/communities/${c.id}`}
              className="group shrink-0 w-[220px] rounded-2xl border border-border bg-secondary hover:bg-secondary-hover transition-colors p-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center text-slate-600 font-black text-[12px]">
                  {c?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initials(c?.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
                    {c?.name || 'Comunidade'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium truncate">
                    {(c?.type === 'Private' || c?.type === 'Privada') ? 'Privada' : 'Pública'} • {(c?.membersCount ?? c?.members?.length ?? 0)} membros
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="aura-panel p-4">
      {header}
      <div className="mt-3 flex flex-col gap-2">
        {items.slice(0, 4).map((c) => (
          <Link
            key={c.id}
            href={`/communities/${c.id}`}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-secondary hover:bg-secondary-hover transition-colors p-3"
          >
            <div className="w-10 h-10 rounded-2xl bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center text-slate-600 font-black text-[12px]">
              {c?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image} alt="" className="w-full h-full object-cover" />
              ) : (
                initials(c?.name)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
                {c?.name || 'Comunidade'}
              </p>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                {(c?.type === 'Private' || c?.type === 'Privada') ? 'Privada' : 'Pública'} • {(c?.membersCount ?? c?.members?.length ?? 0)} membros
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
