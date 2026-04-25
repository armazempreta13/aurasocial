'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, query } from 'firebase/firestore';

import { db } from '@/firebase';

function initials(name: string) {
  const clean = String(name || '').trim();
  if (!clean) return 'C';
  return clean.charAt(0).toUpperCase();
}

export function CommunitiesInviteCard() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'communities'), limit(3));
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setItems([])
    );
  }, []);

  const preview = useMemo(() => items.slice(0, 3), [items]);

  return (
    <div className="bg-[#f3efff] rounded-[24px] p-6 relative overflow-hidden group">
      <div className="absolute -top-4 -right-4 w-16 h-16 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
      <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-primary/10 rounded-full blur-xl" />

      <p className="text-[13px] text-slate-800 font-semibold leading-relaxed mb-4 relative z-10">
        Entre em comunidades e acompanhe discussões, regras e destaques com pessoas que curtem os mesmos temas.
      </p>

      {preview.length > 0 ? (
        <div className="relative z-10 mb-4 flex flex-col gap-2">
          {preview.map((c) => (
            <Link
              key={c.id}
              href={`/communities/${c.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white/70 hover:bg-white transition-colors px-3 py-2 border border-white/60"
            >
              <div className="w-9 h-9 rounded-2xl bg-white border border-border overflow-hidden shrink-0 flex items-center justify-center text-slate-600 font-black text-[12px]">
                {c?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials(c?.name)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-slate-900 truncate">{c?.name || 'Comunidade'}</p>
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  {(c?.type === 'Private' || c?.type === 'Privada') ? 'Privada' : 'Pública'} • {(c?.membersCount ?? c?.members?.length ?? 0)} membros
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      <Link
        href="/communities"
        className="aura-btn-primary inline-flex h-9 px-6 rounded-full text-[12px] items-center justify-center transition-all shadow-sm active:scale-95 relative z-10"
      >
        Explorar comunidades
      </Link>
    </div>
  );
}

