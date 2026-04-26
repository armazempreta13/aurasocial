'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { getTrendingGifs, searchGifs, type GiphyGif } from '@/lib/giphy';

type GifPickerProps = {
  onSelect: (fullUrl: string, previewUrl: string) => void;
  onClose: () => void;
  variant?: 'dark' | 'light';
};

export function GifPicker({ onSelect, onClose, variant = 'dark' }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GiphyGif[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = variant === 'dark';

  const classes = useMemo(() => {
    if (isDark) {
      return {
        shell:
          'absolute top-full left-0 mt-2 z-[100] w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1f] shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col',
        header: 'px-4 pt-4 pb-3 flex items-center gap-2',
        inputWrap:
          'flex-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all',
        input:
          'flex-1 bg-transparent text-[13px] text-white placeholder:text-slate-500 outline-none',
        icon: 'text-slate-400',
        close:
          'ml-1 w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center',
        grid: 'px-3 pb-3 grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto',
        tile:
          'relative overflow-hidden rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors',
        meta: 'px-3 pb-3 text-[11px] font-semibold text-slate-500',
        empty: 'px-3 pb-3 text-[12px] text-slate-400',
      };
    }
    return {
      shell:
        'absolute bottom-full left-0 mb-2 z-[100] w-[340px] overflow-hidden rounded-2xl border border-[#e4e8f2] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col',
      header: 'px-4 pt-4 pb-3 flex items-center gap-2',
      inputWrap:
        'flex-1 flex items-center gap-2 rounded-xl border border-[#e4e8f2] bg-[#f4f6fb] px-3 py-2 focus-within:border-[#b5aef0] focus-within:ring-1 focus-within:ring-[#b5aef0]/30 transition-all',
      input:
        'flex-1 bg-transparent text-[13px] text-[#1a1f3a] placeholder-[#b8c0d8] outline-none',
      icon: 'text-[#7c6fcd]',
      close:
        'ml-1 w-8 h-8 rounded-lg text-[#8a93ad] hover:text-[#1a1f3a] hover:bg-[#f4f6fb] transition-colors flex items-center justify-center',
      grid: 'px-3 pb-3 grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto',
      tile:
        'relative overflow-hidden rounded-xl border border-[#e4e8f2] bg-white hover:bg-[#f7f8fd] transition-colors',
      meta: 'px-3 pb-3 text-[11px] font-semibold text-[#8a93ad]',
      empty: 'px-3 pb-3 text-[12px] text-[#8a93ad]',
    };
  }, [isDark]);

  const load = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setError(null);
    try {
      const next = q.trim()
        ? await searchGifs(q, { signal: controller.signal })
        : await getTrendingGifs({ signal: controller.signal });
      setItems(next);
      setStatus('ready');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setItems([]);
      setStatus('ready');
      setError('Falha ao carregar GIFs.');
    }
  }, []);

  useEffect(() => {
    // Focus input on open + load trending initially
    inputRef.current?.focus();
    void load('');
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [load]);

  const setQueryDebounced = (val: string) => {
    setQuery(val);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void load(val), 350);
  };

  return (
    <div className={classes.shell} role="dialog" aria-label="Selecionar GIF">
      <div className={classes.header}>
        <div className={classes.inputWrap}>
          <Search size={16} className={classes.icon} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Procurar GIFs..."
            onChange={(e) => setQueryDebounced(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (debounceRef.current) window.clearTimeout(debounceRef.current);
                void load(query);
              }
              if (e.key === 'Escape') onClose();
            }}
            className={classes.input}
          />
          {status === 'loading' ? (
            <Loader2 size={16} className={`${classes.icon} animate-spin`} />
          ) : null}
        </div>
        <button type="button" onClick={onClose} className={classes.close} aria-label="Fechar">
          <X size={16} />
        </button>
      </div>

      {error ? <div className={classes.empty}>{error}</div> : null}

      {!error && status === 'ready' && items.length === 0 ? (
        <div className={classes.empty}>{query.trim() ? 'Nenhum resultado.' : 'Sem GIFs para mostrar.'}</div>
      ) : null}

      <div className={classes.grid}>
        {items.map((gif) => (
          <button
            key={gif.id}
            type="button"
            onClick={() => onSelect(gif.fullUrl, gif.previewUrl)}
            className={classes.tile}
            title={gif.title}
          >
            <img
              src={gif.previewUrl}
              alt={gif.title}
              className="w-full h-[120px] object-cover"
              loading="lazy"
              decoding="async"
            />
          </button>
        ))}
      </div>

      <div className={classes.meta}>{query.trim() ? 'Resultados' : 'Em alta'}</div>
    </div>
  );
}

