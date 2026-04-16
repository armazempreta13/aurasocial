'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  MessageCircle, 
  Search, 
  Send, 
  Loader2,
  ChevronLeft,
  MoreHorizontal,
  Info,
  UserPlus,
  Check,
  CheckCheck,
  Calendar,
  Image as ImageIcon,
  Smile,
  Paperclip,
  Trash2,
  Pin,
  Edit,
  Phone,
  Video,
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import { TopNav } from '@/components/TopNav';
import { TimeAgo } from '@/components/TimeAgo';
import { useSignaling } from '@/components/SignalingProvider';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/firebase';

// --- Types ---
interface MessageRecord {
  id: string;
  senderId: string;
  text: string;
  type?: string;
  attachmentUrl?: string;
  createdAt: number;
  read?: boolean;
}

interface UserPreview {
  uid: string;
  displayName: string;
  photoURL?: string;
}

interface ChatListItem {
  id: string;
  otherUser: UserPreview;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
  participants: string[];
  pinned?: boolean;
}

function MessagesContent() {
  const profile = useAppStore((state) => state.profile);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialChatId = searchParams?.get('chatId') || null;

  const { sendSignal, events } = useSignaling();

  const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({});
  const [suggestedUsers, setSuggestedUsers] = useState<UserPreview[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Safe access to primary data
  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);

  const filteredChats = useMemo(() => {
    let list = [...chats].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
    });
    if (!searchQuery.trim()) return list;
    return list.filter(c => c.otherUser.displayName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [chats, searchQuery]);

  const filteredSuggestions = useMemo(() => {
    const suggestions = suggestedUsers.filter(u => !chats.some(c => c.otherUser.uid === u.uid));
    if (!searchQuery.trim()) return suggestions;
    return suggestions.filter(u => u.displayName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [suggestedUsers, chats, searchQuery]);

  const groupedMessages = useMemo(() => {
    const groups: Record<string, MessageRecord[]> = {};
    messages.forEach(msg => {
      const date = new Date(msg.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return Object.entries(groups);
  }, [messages]);

  // 1. SYNC & INIT
  useEffect(() => {
    if (!profile?.uid) return;
    async function initialize() {
      try {
        setLoading(true);
        // Identity Sync
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: profile!.uid, displayName: profile!.displayName, photoURL: profile!.photoURL })
        });
        // Scrape Firestore Legacy (Sync attempt)
        try {
           const snap = await getDocs(query(collection(db, 'chats'), where('participants', 'array-contains', profile!.uid)));
           for (const d of snap.docs) {
              await fetch('/api/chats', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ participants: d.data().participants })
              });
           }
        } catch (e) {}

        // Load Internal
        const chatRes = await fetch(`/api/chats?userId=${profile!.uid}`);
        const chatData = await chatRes.json();
        const userRes = await fetch('/api/users');
        const userData = await userRes.json();
        const allUsers = (Array.isArray(userData) ? userData : []) as UserPreview[];

        setChats(chatData.map((c: any) => ({
           ...c,
           otherUser: allUsers.find(u => u.uid === c.participants.find((p: string) => p !== profile!.uid)) || { uid: '?', displayName: 'Usuário' },
           unreadCount: 0
        })));
        setSuggestedUsers(allUsers.filter(u => u.uid !== profile!.uid));

      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    initialize();
  }, [profile?.uid]);

  // 2. Load Messages
  useEffect(() => {
    if (!activeChatId) return;
    async function load() {
      const res = await fetch(`/api/messages?chatId=${activeChatId}`);
      const data = await res.json();
      setMessages(data);
    }
    load();
  }, [activeChatId]);

  // 3. Signal Sync
  useEffect(() => {
    if (!events) return;
    const { type, fromId, payload } = events;
    if (type === 'message') {
      const msg = payload.message as MessageRecord;
      if (payload.chatId === activeChatId) setMessages((prev: any) => [...prev, msg]);
      setChats((prev: any) => prev.map((c: any) => c.id === payload.chatId ? { ...c, lastMessage: msg.text, lastMessageTime: msg.createdAt } : c));
    }
    if (type === 'typing-status') {
      setIsTyping((prev: any) => ({ ...prev, [fromId]: payload.isTyping }));
    }
  }, [events, activeChatId]);

  // 4. Send Message
  const sendMessage = async (text: string, type: string = 'text', url?: string) => {
    if (!profile?.uid || !activeChat) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChat.id, senderId: profile.uid, text, type, attachmentUrl: url })
      });
      const savedMsg = await res.json();
      setMessages((prev: any) => [...prev, savedMsg]);
      sendSignal(activeChat.otherUser.uid, 'message', { chatId: activeChat.id, message: savedMsg });
      sendSignal(activeChat.otherUser.uid, 'typing-status', { chatId: activeChat.id, isTyping: false });
      setChats((prev: any) => prev.map((c: any) => c.id === activeChat.id ? { ...c, lastMessage: text, lastMessageTime: savedMsg.createdAt } : c));
    } catch (e) { console.error(e); }
  };

  const startChat = async (user: UserPreview) => {
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: [profile!.uid, user.uid] })
      });
      const chat = await res.json();
      setChats((prev: any) => prev.find((c: any) => c.id === chat.id) ? prev : [{ ...chat, otherUser: user, unreadCount: 0 }, ...prev]);
      setActiveChatId(chat.id);
      setSearchQuery('');
    } catch (e) { console.error(e); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      sendMessage('🖼️ Imagem', 'image', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans overflow-hidden selection:bg-blue-600/10">
      <TopNav />
      <main className="flex-1 pt-16 flex h-[calc(100vh-64px)]">
        
        {/* SIDEBAR */}
        <aside className={`w-full md:w-[380px] lg:w-[420px] bg-white border-r border-slate-100 flex flex-col relative z-30 transition-all ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
           <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                 <h1 className="text-3xl font-black text-slate-900 tracking-tight">Chats</h1>
                 <button className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95"><Edit size={20} /></button>
              </div>
              <div className="relative group">
                 <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                 <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} type="text" placeholder="Pesquisar..." className="w-full bg-slate-100 border-none rounded-[20px] py-4 pl-12 pr-4 text-sm focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-600/5 transition-all font-medium" />
              </div>
           </div>

           <div className="flex-1 overflow-y-auto px-4 pb-12 scrollbar-hide space-y-6">
              {loading && chats.length === 0 ? (
                 <div className="flex flex-col items-center py-20 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Iniciando Aura...</p>
                 </div>
              ) : (
                 <>
                    <div className="space-y-1">
                       <p className="px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">CONVERSAS</p>
                       {filteredChats.map(chat => {
                          const isActive = activeChatId === chat.id;
                          const typing = isTyping[chat.otherUser.uid];
                          return (
                             <button key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`w-full p-4 flex items-center gap-4 rounded-[26px] transition-all relative ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'hover:bg-slate-50'}`}>
                                <div className="relative shrink-0">
                                   <img src={chat.otherUser.photoURL || `https://ui-avatars.com/api/?name=${chat.otherUser.displayName}`} className={`w-14 h-14 rounded-[22px] object-cover bg-slate-200 ${isActive ? 'ring-2 ring-white/50 scale-105' : ''}`} alt="" />
                                   {chat.pinned && <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center"><Pin size={10} className="text-white rotate-45" /></div>}
                                   {!isActive && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-[3px] border-white" />}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                   <div className="flex justify-between items-baseline mb-0.5">
                                      <span className="text-[16px] font-bold truncate tracking-tight">{chat.otherUser.displayName}</span>
                                      <span className={`text-[10px] font-bold ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{chat.lastMessageTime ? <TimeAgo date={new Date(chat.lastMessageTime)} /> : ''}</span>
                                   </div>
                                   <p className={`text-sm truncate ${isActive ? 'text-white/80' : 'text-slate-500'} ${typing ? 'text-green-500 font-bold' : ''}`}>
                                      {typing ? 'Escrevendo...' : chat.lastMessage || 'Envie um oi!'}
                                   </p>
                                </div>
                             </button>
                          );
                       })}
                    </div>

                    {filteredSuggestions.length > 0 && (
                       <div className="mt-6 pt-6 border-t border-slate-50">
                          <p className="px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">SUGESTÕES</p>
                          <div className="grid grid-cols-1 gap-2">
                             {filteredSuggestions.map(user => (
                                <button key={user.uid} onClick={() => startChat(user)} className="w-full p-4 hover:bg-slate-50 rounded-[28px] flex items-center gap-4 transition-all group">
                                   <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-12 h-12 rounded-[20px] object-cover bg-slate-200 group-hover:scale-105 transition-all" alt="" />
                                   <div className="flex-1 text-left">
                                      <p className="text-[15px] font-bold text-slate-900 leading-none mb-1">{user.displayName}</p>
                                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.15em] flex items-center gap-1">Conectar <UserPlus size={10} /></p>
                                   </div>
                                </button>
                             ))}
                          </div>
                       </div>
                    )}
                 </>
              )}
           </div>
        </aside>

        {/* CHAT VIEW */}
        <section className={`flex-1 flex flex-col bg-white overflow-hidden relative ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
           {activeChat ? (
              <>
                 <header className="h-[84px] px-8 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-3xl z-40 shrink-0">
                    <div className="flex items-center gap-4">
                       <button onClick={() => setActiveChatId(null)} className="md:hidden p-3 hover:bg-slate-100 rounded-full transition-all"><ChevronLeft /></button>
                       <img src={activeChat.otherUser.photoURL || `https://ui-avatars.com/api/?name=${activeChat.otherUser.displayName}`} className="w-12 h-12 rounded-[22px] object-cover shadow-md" alt="" />
                       <div>
                          <h2 className="text-[17px] font-black text-slate-900 tracking-tight leading-tight">{activeChat.otherUser.displayName}</h2>
                          <span className="text-[10px] font-black text-green-600 uppercase tracking-[0.2em]">{isTyping[activeChat.otherUser.uid] ? 'Escrevendo...' : 'Ativo agora'}</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button title="Audio" onClick={() => (window as any).__auraStartCall?.(activeChat.otherUser.uid, activeChat.otherUser.displayName, 'audio', activeChat.otherUser.photoURL)} className="w-11 h-11 bg-green-50 hover:bg-green-100 text-green-600 rounded-full flex items-center justify-center transition-all active:scale-95"><Phone size={20} /></button>
                       <button title="Video" onClick={() => (window as any).__auraStartCall?.(activeChat.otherUser.uid, activeChat.otherUser.displayName, 'video', activeChat.otherUser.photoURL)} className="w-11 h-11 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full flex items-center justify-center transition-all active:scale-95"><Video size={20} /></button>
                       <div className="p-3 hover:bg-slate-50 rounded-full cursor-pointer text-slate-400 transition-all"><Info size={22} /></div>
                       <div className="p-3 hover:bg-slate-50 rounded-full cursor-pointer text-slate-400 transition-all"><Trash2 size={22} /></div>
                    </div>
                 </header>

                 <div className="flex-1 overflow-y-auto px-10 py-12 scrollbar-hide space-y-10 bg-[#f8fafc]/50">
                    <div className="flex-1" />
                    {groupedMessages.map(([date, msgs]) => (
                       <div key={date} className="space-y-8 animate-in fade-in duration-500">
                          <div className="flex items-center gap-6">
                             <div className="h-[1px] bg-slate-200 flex-1" />
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2"><Calendar size={12} /> {date}</span>
                             <div className="h-[1px] bg-slate-200 flex-1" />
                          </div>
                          {msgs.map((msg) => {
                             const isMe = msg.senderId === profile.uid;
                             return (
                                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%] ${isMe ? 'ml-auto' : ''} group relative`}>
                                   {msg.type === 'image' ? (
                                      <div className={`p-1.5 rounded-[28px] shadow-2xl ${isMe ? 'bg-blue-600' : 'bg-white shadow-slate-200'}`}>
                                         <img src={msg.attachmentUrl} className="max-w-full max-h-[400px] rounded-[22px] object-cover" alt="Shared" />
                                      </div>
                                   ) : (
                                      <div className={`px-6 py-4 rounded-[28px] text-[15px] font-medium leading-relaxed transition-all shadow-sm ring-1 ring-black/5 ${isMe ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-none shadow-blue-600/20' : 'bg-white text-slate-800 rounded-bl-none'}`}>
                                         {msg.text}
                                      </div>
                                   )}
                                   <div className={`flex items-center gap-3 mt-2 px-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter"><TimeAgo date={new Date(msg.createdAt)} /></span>
                                      {isMe && (msg.read ? <CheckCheck size={14} className="text-blue-600" /> : <Check size={14} className="text-slate-300" />)}
                                   </div>
                                </div>
                             );
                          })}
                       </div>
                    ))}
                    <div ref={messagesEndRef} />
                 </div>

                 <footer className="p-8 bg-white border-t border-slate-100 flex items-center gap-4 z-40">
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 flex items-center justify-center bg-slate-100 text-slate-500 rounded-[22px] hover:bg-slate-200 transition-all"><Paperclip size={22} /></button>
                    <form onSubmit={(e) => { e.preventDefault(); if (newMessage.trim()) { sendMessage(newMessage.trim()); setNewMessage(''); } }} className="flex-1 bg-slate-100 rounded-[28px] flex items-center px-6 focus-within:bg-white focus-within:ring-8 focus-within:ring-blue-600/5 transition-all">
                       <input value={newMessage} onChange={e => { setNewMessage(e.target.value); sendSignal(activeChat.otherUser.uid, 'typing-status', { chatId: activeChat.id, isTyping: e.target.value.length > 0 }); }} placeholder="Digite algo..." className="flex-1 bg-transparent py-5 focus:outline-none text-[16px] text-slate-900 font-medium" />
                       <button type="button" className="p-2 text-slate-400 hover:text-blue-600"><Smile size={24} /></button>
                    </form>
                    <button onClick={() => { if (newMessage.trim()) { sendMessage(newMessage.trim()); setNewMessage(''); } }} className="w-14 h-14 flex items-center justify-center bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-600/40 hover:scale-105 active:scale-95 transition-all">
                       <Send size={22} className="relative -right-0.5" />
                    </button>
                 </footer>
              </>
           ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white relative">
                 <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 to-white pointer-events-none" />
                 <div className="max-w-md relative animate-in fade-in zoom-in duration-1000">
                    <div className="w-28 h-28 bg-white text-blue-600 rounded-[44px] flex items-center justify-center mx-auto mb-10 shadow-3xl border border-slate-100 rotate-3"><MessageCircle size={56} /></div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-4 uppercase">Messenger</h2>
                    <p className="text-slate-500 font-medium text-lg leading-relaxed">Sua rede segura para conversas em tempo real.</p>
                 </div>
              </div>
           )}
        </section>
      </main>
    </div>
  );
}

export default function MessagesPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" /></div>}><MessagesContent /></Suspense>;
}
