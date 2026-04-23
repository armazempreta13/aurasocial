'use client';

import { useMemo } from 'react';
import { Hash } from 'lucide-react';

interface HashtagSuggestionsProps {
  searchText: string;
  suggestions: string[];
  onSelect: (tag: string) => void;
  onClose: () => void;
}

function normalizeTag(input: string) {
  const cleaned = input.trim().replace(/^#+/, '').toLowerCase();
  return cleaned ? `#${cleaned}` : '';
}

export function HashtagSuggestions({ searchText, suggestions, onSelect }: HashtagSuggestionsProps) {
  const query = (searchText || '').trim().toLowerCase();

  const filtered = useMemo(() => {
    const unique = new Set<string>();
    const normalized = suggestions
      .map((s) => normalizeTag(s))
      .filter(Boolean)
      .filter((t) => (query ? t.slice(1).startsWith(query) : true));

    for (const tag of normalized) {
      unique.add(tag);
      if (unique.size >= 6) break;
    }

    return Array.from(unique);
  }, [suggestions, query]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute z-50 bg-white border border-slate-200 rounded-xl shadow-2xl w-64 mt-1 overflow-hidden animate-in fade-in slide-in-from-top-2">
      <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
        <Hash className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
          Sugestões de Hashtag
        </span>
      </div>
      <div className="max-h-60 overflow-y-auto custom-scrollbar">
        {filtered.map((tag) => (
          <button
            key={tag}
            onClick={() => onSelect(tag)}
            className="w-full flex items-center gap-3 p-3 hover:bg-primary/5 transition-colors border-b border-slate-50 last:border-0 group"
          >
            <div className="w-8 h-8 rounded-full bg-primary/5 overflow-hidden ring-2 ring-transparent group-hover:ring-primary/20 transition-all flex items-center justify-center">
              <Hash className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-bold text-slate-900 truncate w-full">{tag}</span>
              <span className="text-[11px] font-bold text-slate-400">Toque para inserir</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

