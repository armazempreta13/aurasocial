'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageCircle, 
  Search, 
  MoreHorizontal, 
  Maximize2, 
  Edit3,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { TimeAgo } from './TimeAgo';
import Link from 'next/link';

type UserPreview = {
  uid: string;
  displayName: string;
  photoURL?: string;
};

type ChatListItem = {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount?: number;
  otherUser?: UserPreview;
};

export function MessagesDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profile = useAppStore((state) => state.profile);
  const router = useRouter();

  // 1. Fetch Chats from Internal API (instead of Firestore)
  useEffect(() => {
    if (!profile?.uid || !isOpen) return;

    async function loadChats() {
      try {
        const chatRes = await fetch(`/api/chats?userId=${profile!.uid}`);
        const chatData = await chatRes.json();
        
        const userRes = await fetch('/api/users');
        const userData = await userRes.json();
        const allUsers = (Array.isArray(userData) ? userData : []) as UserPreview[];

        const enriched = chatData.map((c: any) => {
           const otherId = c.participants.find((p: string) => p !== profile!.uid);
           const u = allUsers.find(u => u.uid === otherId) || { uid: otherId, displayName: 'Usuário' };
           return { ...c, otherUser: u };
        });

        setChats(enriched);
      } catch (e) {
        console.error('Failed to load dropdown chats', e);
      }
    }

    loadChats();
    const interval = setInterval(loadChats, 5000); // Background sync while open
    return () => clearInterval(interval);
  }, [profile?.uid, isOpen]);

  // Handle Click Outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    return chats.filter(c => c.otherUser?.displayName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [chats, searchQuery]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all relative group ${
          isOpen ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-100 hover:bg-gray-200 text-black'
        }`}
      >
        <MessageCircle className={`w-5 h-5 transition-transform ${isOpen ? 'scale-110 fill-current' : 'group-hover:scale-105'}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+10px)] right-0 w-[360px] bg-white/95 backdrop-blur-3xl rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-white/50 overflow-hidden z-[100] flex flex-col animate-in slide-in-from-top-3 duration-300">
          
          <div className="p-6 flex items-center justify-between">
            <h2 className="text-2xl font-black text-black tracking-tighter">Conversas</h2>
            <div className="flex items-center gap-1">
              <div className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 cursor-pointer text-slate-400"><MoreHorizontal size={20} /></div>
              <div className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 cursor-pointer text-slate-900" onClick={() => { setIsOpen(false); router.push('/messages'); }}><Maximize2 size={18} /></div>
            </div>
          </div>

          <div className="px-6 pb-4">
             <div className="relative group">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input 
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  type="text" 
                  placeholder="Pesquisar..." 
                  className="w-full bg-slate-100/80 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-600/5 transition-all outline-none"
                />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[400px] scrollbar-hide px-3 pb-3 space-y-1">
             {filteredChats.map(chat => (
                <button 
                  key={chat.id} 
                  onClick={() => { router.push(`/messages?chatId=${chat.id}`); setIsOpen(false); }}
                  className="w-full p-3 flex items-center gap-4 rounded-3xl hover:bg-slate-50 transition-all text-left group"
                >
                   <div className="relative shrink-0">
                      <img src={chat.otherUser?.photoURL || `https://ui-avatars.com/api/?name=${chat.otherUser?.displayName}`} alt="" className="w-14 h-14 rounded-full object-cover bg-slate-200 group-hover:scale-105 transition-transform" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-[3px] border-white" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                         <span className="text-[15px] font-bold text-slate-900 truncate">{chat.otherUser?.displayName}</span>
                         <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                            {chat.lastMessageTime ? <TimeAgo date={new Date(chat.lastMessageTime)} /> : ''}
                         </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{chat.lastMessage || 'Conversa iniciada'}</p>
                   </div>
                </button>
             ))}

             {chats.length === 0 && (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                   <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-[24px] flex items-center justify-center rotate-3"><MessageCircle size={32} /></div>
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhuma conversa encontrada</p>
                </div>
             )}
          </div>

          <Link 
            href="/messages" 
            onClick={() => setIsOpen(false)}
            className="p-5 text-center bg-slate-50 hover:bg-slate-100 transition-all active:scale-[0.98] border-t border-slate-100"
          >
            <span className="text-sm font-black text-blue-600 uppercase tracking-widest">Ver tudo no Messenger</span>
          </Link>
        </div>
      )}
    </div>
  );
}
