'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { BadgeCheck } from 'lucide-react';
import { db } from '@/firebase';
import { useAppStore } from '@/lib/store';
import { isAuraSocialCommunity } from '@/lib/community-official';

function initials(name: string) {
  const clean = String(name || '').trim();
  if (!clean) return 'C';
  return clean.charAt(0).toUpperCase();
}

export function CommunitiesDock() {
  const profile = useAppStore((s) => s.profile);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.uid) {
      setItems([]);
      return;
    }

    const q = query(
      collection(db, 'communities'),
      where('members', 'array-contains', profile.uid),
      limit(6)
    );

    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => setItems([])
    );
  }, [profile?.uid]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
  }, [items]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-[15px] text-slate-900">Minhas comunidades</h3>
        <Link href="/communities" className="aura-link text-[12px] font-bold">
          Ver todas
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="aura-panel px-5 py-4">
          <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
            Entre em comunidades para ver discussões e regras num só lugar.
          </p>
          <Link href="/communities" className="aura-link text-[12px] font-bold inline-block mt-2">
            Explorar comunidades
          </Link>
        </div>
      ) : (
        <div className="aura-panel px-5 py-4">
          <div className="flex flex-col gap-3">
            {sorted.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`/communities/${c.id}`}
                className="flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-50 flex items-center justify-center text-slate-400 font-bold text-[14px]">
                    {c?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initials(c?.name)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[13px] text-slate-900 truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <span className="truncate">{c?.name || 'Comunidade'}</span>
                      {isAuraSocialCommunity(c) && (
                        <BadgeCheck className="h-4 w-4 text-indigo-600 fill-indigo-600 text-white shrink-0" strokeWidth={2.5} />
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate font-medium">
                      {(c?.type === 'Private' || c?.type === 'Privada') ? 'Privada' : 'Pública'} • {(c?.membersCount ?? c?.members?.length ?? 0)} membros
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
