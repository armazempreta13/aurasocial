'use client';

import React from 'react';
import { Search, User } from 'lucide-react';
import { tokens } from './ChatWorkspace';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatListProps {
    chats: any[];
    suggestions: any[];
    selectedChatId: string | null;
    onSelectChat: (id: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

export function ChatList({
    chats,
    suggestions,
    selectedChatId,
    onSelectChat,
    searchQuery,
    onSearchChange,
}: ChatListProps) {
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* ── SEARCH ── */}
            <div className="px-5 pb-4">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b8c0d8] group-focus-within:text-[#7c6fcd] transition-colors" size={16} strokeWidth={2.5} />
                    <input
                        type="text"
                        placeholder="Pesquisar mensagens"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 bg-[#f4f6fb] border border-[#e4e8f2] rounded-lg text-sm text-[#1a1f3a] placeholder-[#b8c0d8] outline-none focus:border-[#b5aef0] transition-all"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
                {/* ── RECENTES ── */}
                <div className="px-5 mb-2">
                    <span className="text-[10px] font-black tracking-widest text-[#b8c0d8] uppercase">Recentes</span>
                </div>

                <div className="space-y-0.5 mb-6">
                    {chats.map((chat) => {
                        const isSelected = chat.id === selectedChatId;
                        const lastMsg = chat.lastMessage;
                        const otherUser = chat.otherUser;
                        const isOnline = otherUser?.status === 'online';

                        return (
                            <button
                                key={chat.id}
                                onClick={() => onSelectChat(chat.id)}
                                className={`w-full flex items-center gap-3 px-5 py-3.5 transition-colors relative group ${
                                    isSelected ? 'bg-[#f0effe]' : 'hover:bg-[#f7f8fd]'
                                }`}
                            >
                                {isSelected && (
                                    <div className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-[#7c6fcd]" />
                                )}

                                <div className="relative shrink-0">
                                    {otherUser?.photoURL ? (
                                        <img src={otherUser.photoURL} alt="" className="h-11 w-11 rounded-full object-cover border border-[#e4e8f2]" />
                                    ) : (
                                        <div className="h-11 w-11 rounded-full bg-[#f0effe] flex items-center justify-center text-[#7c6fcd] font-bold text-sm border border-[#e4e8f2]">
                                            {otherUser?.displayName?.charAt(0) || '?'}
                                        </div>
                                    )}
                                    {isOnline && (
                                        <div className="absolute bottom-0 right-0 h-3 w-3 bg-[#22c55e] border-[2.5px] border-white rounded-full" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className={`text-[14px] font-bold truncate ${isSelected ? 'text-[#7c6fcd]' : 'text-[#1a1f3a]'}`}>
                                            {otherUser?.displayName}
                                        </span>
                                        <span className="text-[10.5px] font-medium text-[#b8c0d8]">
                                            {(() => {
                                                const ts = lastMsg?.timestamp;
                                                if (!ts) return '';
                                                const d = new Date(ts);
                                                if (isNaN(d.getTime())) return '';
                                                return formatDistanceToNow(d, { locale: ptBR, addSuffix: false }).replace('cerca de ', '');
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[12.5px] text-[#8b93af] truncate pr-4 font-medium">
                                            {lastMsg?.text || 'Inicie uma conversa'}
                                        </p>
                                        {chat.unreadCount > 0 && (
                                            <div className="h-4.5 min-w-[18px] px-1 bg-[#7c6fcd] rounded-full flex items-center justify-center text-[10px] text-white font-black">
                                                {chat.unreadCount}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* ── SUGERIDOS ── */}
                {suggestions.length > 0 && (
                    <div className="px-5 mb-4">
                        <div className="mb-4">
                             <span className="text-[10px] font-black tracking-widest text-[#b8c0d8] uppercase">Sugeridos</span>
                        </div>
                        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
                            {suggestions.slice(0, 4).map((user) => (
                                <button 
                                    key={user.uid} 
                                    onClick={() => onSelectChat(user.uid)}
                                    className="flex flex-col items-center gap-1.5 shrink-0 group"
                                >
                                    <div className="relative">
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt="" className="h-12 w-12 rounded-full object-cover border border-[#e4e8f2] group-hover:border-[#7c6fcd] transition-colors" />
                                        ) : (
                                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-[#e4e8f2] group-hover:border-[#7c6fcd] transition-colors">
                                                <User size={20} />
                                            </div>
                                        )}
                                        {user.status === 'online' && (
                                            <div className="absolute bottom-0 right-0 h-3 w-3 bg-[#22c55e] border-[2.5px] border-white rounded-full" />
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold text-[#8b93af] truncate w-14 text-center group-hover:text-[#1a1f3a] transition-colors">
                                        {user.displayName?.split(' ')[0]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
