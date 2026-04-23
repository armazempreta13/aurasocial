'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { MessageCircle, Search, Maximize2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useChat } from '@/components/chat/ChatProvider';
import { TimeAgo } from './TimeAgo';

const DROPDOWN_EVENT = 'topnav:dropdown-open';

function emitDropdownOpen(name: string) {
  window.dispatchEvent(new CustomEvent(DROPDOWN_EVENT, { detail: { name } }));
}

export function MessagesDropdown() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const {
    chats,
    unreadTotal,
    openChatById,
  } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Close when another TopNav dropdown opens (prevents overlap)
  useEffect(() => {
    const handler = (event: Event) => {
      const opened = (event as CustomEvent<any>)?.detail?.name;
      if (opened && opened !== 'messages') setIsOpen(false);
    };
    window.addEventListener(DROPDOWN_EVENT, handler as EventListener);
    return () => window.removeEventListener(DROPDOWN_EVENT, handler as EventListener);
  }, []);

  // Close on outside click
  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    emitDropdownOpen('messages');
  }, [isOpen]);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats.slice(0, 8);
    return chats
      .filter((chat) => chat.otherUser.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 8);
  }, [chats, searchQuery]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen((value) => !value);
        }}
        className={`group relative flex h-10 w-10 items-center justify-center rounded-full transition-all ${
          isOpen ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-100 text-black hover:bg-gray-200'
        }`}
      >
        <MessageCircle className={`h-5 w-5 transition-transform ${isOpen ? 'scale-110 fill-current' : 'group-hover:scale-105'}`} />
        {unreadTotal > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-pink-500 px-1 text-[10px] font-black text-white animate-in zoom-in duration-300">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[100] flex w-[360px] flex-col overflow-hidden rounded-[28px] border border-white/50 bg-white/95 backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] animate-in slide-in-from-top-3 duration-300">
          <div className="flex items-center justify-between p-6">
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-black">{t('messages_page.conversations', 'Conversas')}</h2>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {unreadTotal > 0 ? t('messages_page.new_count', '{{count}} novas', { count: unreadTotal }) : t('messages_page.always_here', 'Sempre ao alcance')}
              </p>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/messages');
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-900 transition-all hover:bg-black/5"
            >
              <Maximize2 size={18} />
            </button>
          </div>

          <div className="px-6 pb-4">
            <div className="group relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                type="text"
                placeholder={t('messages_page.search_placeholder', 'Buscar conversas...')}
                className="w-full rounded-2xl bg-slate-100/80 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:bg-white focus:ring-4 focus:ring-blue-600/5"
              />
            </div>
          </div>

          <div className="scrollbar-hide max-h-[420px] flex-1 space-y-1 overflow-y-auto px-3 pb-3">
            {filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={async () => {
                  await openChatById(chat.id, 'floating');
                  setIsOpen(false);
                }}
                className="group flex w-full items-center gap-4 rounded-3xl p-3 text-left transition-all hover:bg-slate-50"
              >
                <div className="relative shrink-0">
                  <img
                    src={chat.otherUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.otherUser.displayName)}`}
                    alt={chat.otherUser.displayName}
                    className="h-14 w-14 rounded-full bg-slate-200 object-cover transition-transform group-hover:scale-105"
                  />
                  {chat.unreadCount > 0 && (
                    <div className="absolute -bottom-1 -right-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full border-[3px] border-white bg-pink-500 px-1 text-[10px] font-black text-white">
                      {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-baseline justify-between">
                    <span className="truncate text-[15px] font-bold text-slate-900">{chat.otherUser.displayName}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                      {chat.lastMessageTime ? <TimeAgo date={new Date(chat.lastMessageTime)} /> : ''}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">{chat.lastMessage || t('messages_page.started', 'Conversa iniciada')}</p>
                </div>
              </button>
            ))}

            {filteredChats.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-slate-50 text-slate-200">
                  <MessageCircle size={32} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                  {t('messages_page.no_results', 'Nenhuma conversa encontrada.')}
                </p>
              </div>
            )}
          </div>

          <Link
            href="/messages"
            onClick={() => setIsOpen(false)}
            className="border-t border-slate-100 bg-slate-50 p-5 text-center transition-all active:scale-[0.98] hover:bg-slate-100"
          >
            <span className="text-sm font-black uppercase tracking-widest text-blue-600">
              {t('messages_page.open_hub', 'Abrir central de mensagens')}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
