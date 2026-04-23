'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';
import { Search, User, Hash, Users, TrendingUp, Clock, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';

interface SearchResult {
  type: 'user' | 'hashtag' | 'community' | 'history';
  id: string;
  label: string;
  subtitle?: string;
  photo?: string;
  href: string;
  emoji?: string;
}

const HISTORY_KEY = 'aura_search_history_v2';
const MAX_HISTORY = 8;

function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function addToHistory(query: string) {
  const h = [query, ...getHistory().filter(q => q !== query)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}
function removeFromHistory(query: string) {
  const h = getHistory().filter(q => q !== query);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}
function clearHistory() {
  localStorage.setItem(HISTORY_KEY, '[]');
}

interface Props {
  onClose: () => void;
}

export function SearchOverlay({ onClose }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHistory(getHistory());
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setIsLoading(false); return; }
    setIsLoading(true);
    const norm = q.toLowerCase().trim();

    try {
      const found: SearchResult[] = [];

      // ── USERS ──────────────────────────────────────────────────────
      const usersSnap = await getDocs(query(
        collection(db, 'users'),
        where('displayName_lower', '>=', norm),
        where('displayName_lower', '<=', norm + '\uf8ff'),
        limit(4)
      ).withConverter ? query(
        collection(db, 'users'),
        where('displayName_lower', '>=', norm),
        where('displayName_lower', '<=', norm + '\uf8ff'),
        limit(4)
      ) : query(collection(db, 'users'), limit(60)));

      // Fallback: client-side filter when no index
      const allUsers = usersSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((u: any) =>
          u.displayName?.toLowerCase().includes(norm) ||
          u.username?.toLowerCase().includes(norm.replace('@', ''))
        )
        .slice(0, 4);

      allUsers.forEach((u: any) => {
        found.push({
          type: 'user',
          id: u.id,
          label: u.displayName || u.username || u.id,
          subtitle: u.username ? `@${u.username}` : u.bio?.slice(0, 40),
          photo: u.photoURL,
          href: `/profile/${u.id}`,
        });
      });

      // ── HASHTAGS ────────────────────────────────────────────────────
      const postsSnap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(80)));
      const tagSet = new Map<string, number>();
      postsSnap.docs.forEach(d => {
        const data = d.data() as any;
        (data.hashtags || []).forEach((tag: string) => {
          const t = tag.toLowerCase().replace(/^#/, '');
          if (t.includes(norm.replace(/^#/, ''))) {
            tagSet.set(t, (tagSet.get(t) || 0) + 1);
          }
        });
      });
      Array.from(tagSet.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .forEach(([tag, count]) => {
          found.push({
            type: 'hashtag',
            id: `#${tag}`,
            label: `#${tag}`,
            subtitle: `${count} post${count !== 1 ? 's' : ''}`,
            href: `/explore?q=%23${encodeURIComponent(tag)}`,
            emoji: '#️⃣',
          });
        });

      // ── COMMUNITIES ─────────────────────────────────────────────────
      const commSnap = await getDocs(query(collection(db, 'communities'), where('isPublic', '==', true), limit(40)));
      commSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((c: any) => c.name?.toLowerCase().includes(norm))
        .slice(0, 3)
        .forEach((c: any) => {
          found.push({
            type: 'community',
            id: c.id,
            label: c.name,
            subtitle: `${c.membersCount || (c.members?.length || 0)} membros`,
            photo: c.image,
            href: `/communities/${c.id}`,
          });
        });

      setResults(found);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) { setResults([]); setIsLoading(false); return; }
    setIsLoading(true);
    debounceRef.current = setTimeout(() => search(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, search]);

  const handleSubmit = (q: string) => {
    if (!q.trim()) return;
    addToHistory(q.trim());
    setHistory(getHistory());
    router.push(`/explore?q=${encodeURIComponent(q.trim())}`);
    onClose();
  };

  const handleSelect = (result: SearchResult) => {
    addToHistory(result.label);
    setHistory(getHistory());
    router.push(result.href);
    onClose();
  };

  const allItems = searchQuery.trim() ? results : history.map(h => ({
    type: 'history' as const,
    id: `hist-${h}`,
    label: h,
    subtitle: 'Busca recente',
    href: `/explore?q=${encodeURIComponent(h)}`,
  }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, allItems.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && allItems[activeIndex]) {
        handleSelect(allItems[activeIndex] as SearchResult);
      } else {
        handleSubmit(searchQuery);
      }
    }
    if (e.key === 'Escape') onClose();
  };

  const typeIcon = (type: string) => {
    if (type === 'user') return <User className="w-4 h-4 text-primary" />;
    if (type === 'hashtag') return <Hash className="w-4 h-4 text-violet-500" />;
    if (type === 'community') return <Users className="w-4 h-4 text-indigo-500" />;
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[200] bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed top-[72px] left-1/2 -translate-x-1/2 z-[201] w-full max-w-[600px] px-4"
      >
        <div className="bg-white rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden">
          {/* Search input row */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <Search className="w-5 h-5 text-primary shrink-0" />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar pessoas, #hashtags, comunidades..."
              className="flex-1 bg-transparent text-[16px] font-medium text-slate-800 placeholder-slate-400 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            )}
            <kbd className="hidden sm:flex h-6 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[11px] text-slate-400 shrink-0">
              Esc
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[440px] overflow-y-auto">
            {/* Empty query — history */}
            {!searchQuery.trim() && history.length === 0 && (
              <div className="py-10 text-center">
                <TrendingUp className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-[14px] text-slate-400 font-medium">Comece a digitar para buscar</p>
                <p className="text-[12px] text-slate-300 mt-1">Pessoas, posts, hashtags e comunidades</p>
              </div>
            )}

            {/* History section */}
            {!searchQuery.trim() && history.length > 0 && (
              <div className="p-3">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Histórico</span>
                  <button onClick={() => { clearHistory(); setHistory([]); }} className="text-[11px] text-primary font-bold hover:underline">
                    Limpar
                  </button>
                </div>
                {history.map((h, i) => (
                  <div
                    key={h}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group transition-all ${activeIndex === i ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                    onClick={() => handleSubmit(h)}
                  >
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-[14px] text-slate-700 font-medium flex-1">{h}</span>
                    <button
                      onClick={e => { e.stopPropagation(); removeFromHistory(h); setHistory(getHistory()); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-slate-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="py-8 text-center">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            )}

            {/* Results */}
            {!isLoading && searchQuery.trim() && (
              <>
                {results.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-[14px] text-slate-400 font-medium">Nenhum resultado para "{searchQuery}"</p>
                    <button
                      onClick={() => handleSubmit(searchQuery)}
                      className="mt-3 flex items-center gap-2 mx-auto text-[13px] font-bold text-primary hover:underline"
                    >
                      Ver todos os posts com esse termo <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="p-3 space-y-1">
                    {results.map((r, i) => (
                      <div
                        key={r.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeIndex === i ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                        onClick={() => handleSelect(r)}
                      >
                        {/* Avatar or icon */}
                        {r.photo ? (
                          <div className="w-9 h-9 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                            <img src={r.photo} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            r.type === 'hashtag' ? 'bg-violet-50' : r.type === 'community' ? 'bg-indigo-50' : 'bg-slate-100'
                          }`}>
                            {typeIcon(r.type)}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-slate-800 truncate">{r.label}</p>
                          {r.subtitle && <p className="text-[12px] text-slate-400 truncate">{r.subtitle}</p>}
                        </div>

                        <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                      </div>
                    ))}

                    {/* Full search CTA */}
                    <button
                      onClick={() => handleSubmit(searchQuery)}
                      className="w-full mt-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold text-primary hover:bg-primary/5 transition-colors border border-dashed border-primary/20"
                    >
                      <Search className="w-4 h-4" />
                      Ver todos os resultados para "{searchQuery}"
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
