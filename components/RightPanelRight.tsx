'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAppStore } from '@/lib/store';
import { useChat } from '@/components/chat/ChatProvider';

function OnlineDot({ color = 'bg-emerald-500' }: { color?: string }) {
  return <span className={`w-1.5 h-1.5 rounded-full ${color}`} />;
}

const blockCls = 'px-5 py-4 flex flex-col gap-3';

export function RightPanelRight() {
  const currentUser = useAppStore((state) => state.user);
  const { chats, unreadTotal } = useChat();

  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [messagesQuery, setMessagesQuery] = useState('');

  const usersByIdRef = useRef<Map<string, any>>(new Map());
  const unsubUserBatchesRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    usersByIdRef.current.clear();
    setActiveUsers([]);
    unsubUserBatchesRef.current.forEach((u) => u());
    unsubUserBatchesRef.current = [];
    if (!currentUser?.uid) return;

    const friendsQuery = query(collection(db, 'friendships'), where('users', 'array-contains', currentUser.uid));
    const unsubFriends = onSnapshot(
      friendsQuery,
      (friendsSnap) => {
        const friendIds = friendsSnap.docs
          .map((d) => d.data() as any)
          .filter((d) => d?.status === 'active')
          .map((d) => (Array.isArray(d.users) ? d.users.find((id: string) => id !== currentUser.uid) : null))
          .filter(Boolean) as string[];

        usersByIdRef.current.clear();
        unsubUserBatchesRef.current.forEach((u) => u());
        unsubUserBatchesRef.current = [];

        if (friendIds.length === 0) {
          setActiveUsers([]);
          return;
        }

        const batches: string[][] = [];
        for (let i = 0; i < friendIds.length; i += 10) batches.push(friendIds.slice(i, i + 10));
        batches.forEach((batch) => {
          const qUsers = query(collection(db, 'users'), where('__name__', 'in', batch));
          const unsubUsers = onSnapshot(
            qUsers,
            (usersSnap) => {
              usersSnap.docs.forEach((ud) => usersByIdRef.current.set(ud.id, { id: ud.id, ...ud.data() }));
              const all = Array.from(usersByIdRef.current.values())
                .filter((u) => u?.isOnline)
                .slice(0, 5);
              setActiveUsers(all);
            },
            (err) => console.warn('Users listener error:', err)
          );
          unsubUserBatchesRef.current.push(unsubUsers);
        });
      },
      (err) => console.warn('Friendships listener error:', err)
    );

    return () => {
      unsubFriends();
      unsubUserBatchesRef.current.forEach((u) => u());
      unsubUserBatchesRef.current = [];
      usersByIdRef.current.clear();
    };
  }, [currentUser?.uid]);

  const filteredChats = useMemo(() => {
    const q = messagesQuery.trim().toLowerCase();
    const base = chats.slice(0, 6);
    if (!q) return base;
    return base.filter((c) => c.otherUser.displayName.toLowerCase().includes(q));
  }, [chats, messagesQuery]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Online Now Block */}
      <div className="aura-panel px-5 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-[15px] text-slate-900">Online agora</h3>
          <Link href="/network" className="aura-link text-[12px] font-bold">
            Ver todos
          </Link>
        </div>

        <div className="flex flex-col gap-2.5">
          {activeUsers.length > 0 ? activeUsers.map((u, idx) => (
            <div key={u.id} className="flex items-center justify-between gap-3">
              <Link href={`/profile/${u.id}`} className="flex items-center gap-3 min-w-0 group">
                <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-50 relative">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-slate-50">
                      {u.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${idx === 4 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                </div>
                <p className="font-bold text-[13px] text-slate-900 truncate group-hover:text-primary transition-colors">{u.displayName}</p>
              </Link>
            </div>
          )) : (
            <div className="py-2">
              <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
                Ninguém online no momento.
              </p>
              <Link href="/network" className="aura-link text-[12px] font-bold inline-block mt-2">
                Ver pessoas
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Messages Block */}
      <div className="aura-panel px-5 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-[15px] text-slate-900">Mensagens</h3>
          <button className="text-slate-400 hover:text-slate-600 transition-colors">
            <Search size={18} />
          </button>
        </div>
        
        <div className="flex flex-col gap-2 mt-1">
          {filteredChats.length > 0 ? filteredChats.map((c: any) => (
            <Link key={c.id} href="/messages" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-50">
                <img
                  src={c.otherUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.otherUser.displayName)}&background=f1f5f9&color=94a3b8`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between">
                  <p className="font-bold text-[13px] text-slate-900 truncate group-hover:text-primary transition-colors">{c.otherUser.displayName}</p>
                  <p className="text-[10px] text-slate-400 font-bold whitespace-nowrap ml-2">
                    {c.lastMessageTime
                      ? new Date(c.lastMessageTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[12px] text-slate-500 truncate font-medium">{c.lastMessage || 'Conversa iniciada'}</p>
                  {c.unreadCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )) : (
            <div className="py-4 text-center flex flex-col items-center justify-center bg-slate-50/50 rounded-[20px] border border-dashed border-slate-200/60 p-4">
              <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                Nenhuma conversa para mostrar.
              </p>
              <Link href="/messages" className="mt-2 inline-flex h-7 px-4 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm active:scale-95">
                Ir para mensagens
              </Link>
            </div>
          )}
        </div>

        <Link href="/messages" className="aura-link text-[12px] font-bold text-center block mt-2">
          Ver todas as mensagens {unreadTotal > 0 ? `(${unreadTotal})` : ''}
        </Link>
      </div>
    </div>
  );
}
