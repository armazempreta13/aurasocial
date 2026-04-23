'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit, orderBy, startAt, endAt } from 'firebase/firestore';
import { db } from '@/firebase';
import { Loader2 } from 'lucide-react';

interface UserSuggestion {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
}

interface MentionSuggestionsProps {
  searchText: string;
  onSelect: (user: UserSuggestion) => void;
  onClose: () => void;
}

export function MentionSuggestions({ searchText, onSelect, onClose }: MentionSuggestionsProps) {
  const [users, setUsers] = useState<UserSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchText) {
      setUsers([]);
      return;
    }

    const searchUsers = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'users'),
          where('username', '>=', searchText.toLowerCase()),
          where('username', '<=', searchText.toLowerCase() + '\uf8ff'),
          limit(5)
        );
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        } as UserSuggestion));
        setUsers(results);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(searchUsers, 200);
    return () => clearTimeout(timer);
  }, [searchText]);

  if (loading && users.length === 0) {
    return (
      <div className="absolute z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-4 w-64 mt-1 animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          Procurando usuários...
        </div>
      </div>
    );
  }

  if (users.length === 0 && !loading) return null;

  return (
    <div className="absolute z-50 bg-white border border-slate-200 rounded-xl shadow-2xl w-64 mt-1 overflow-hidden animate-in fade-in slide-in-from-top-2">
      <div className="p-2 border-b border-slate-100 bg-slate-50/50">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Sugestões de Menção</span>
      </div>
      <div className="max-h-60 overflow-y-auto custom-scrollbar">
        {users.map((user) => (
          <button
            key={user.uid}
            onClick={() => onSelect(user)}
            className="w-full flex items-center gap-3 p-3 hover:bg-primary/5 transition-colors border-b border-slate-50 last:border-0 group"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary/40 font-bold text-xs uppercase">
                  {user.displayName.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-bold text-slate-900 truncate w-full">{user.displayName}</span>
              <span className="text-[11px] font-bold text-primary">@{user.username}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
