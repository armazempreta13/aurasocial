'use client';

import React from 'react';
import { useChat } from '../ChatProvider';
import { useAppStore } from '@/lib/store';
import { Phone } from 'lucide-react';
import { tokens } from '../ChatWorkspace';

export function OnlineFriends() {
    const { chats, suggestions, openChatWithUser } = useChat();
    
    // Combine chats and suggestions users (deduped)
    // In a real app, this would be a filtered 'friends' list from a useFriends hook
    const onlineUsers = [...chats.map(c => c.otherUser), ...suggestions]
        .filter((u, i, self) => u && self.findIndex(s => s?.uid === u.uid) === i)
        .slice(0, 15);

    return (
        <aside className="w-[280px] min-w-[280px] bg-white border-l border-[#e4e8f2] flex flex-col hidden lg:flex">
            <div className="px-6 py-5 border-b border-[#e4e8f2]">
                <h3 className="text-[11px] font-black uppercase tracking-[1.5px] text-[#b8c0d8]">Amigos Online</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
                {onlineUsers.length > 0 ? (
                    onlineUsers.map((user) => (
                        <div 
                            key={user.uid}
                            className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[#f8f9fd] transition-all group"
                        >
                            <button 
                                onClick={() => openChatWithUser(user, 'page')}
                                className="flex-1 flex items-center gap-3 text-left min-w-0"
                            >
                                <div className="relative shrink-0">
                                    <img 
                                        src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}`} 
                                        className="h-10 w-10 rounded-full border border-[#e4e8f2] object-cover group-hover:border-[#7c6fcd] transition-colors"
                                        alt=""
                                    />
                                    <div className="absolute bottom-0 right-0 h-3 w-3 bg-[#22c55e] border-[2.5px] border-white rounded-full shadow-sm" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13.5px] font-bold text-[#1a1f3a] truncate leading-tight">
                                        {user.displayName}
                                    </p>
                                    <p className="text-[10.5px] font-bold text-[#22c55e] mt-0.5">
                                        Disponível
                                    </p>
                                </div>
                            </button>
                            
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const startCall = useAppStore.getState().startCall;
                                    if (startCall) startCall(user.uid, user.displayName, 'audio', user.photoURL);
                                }}
                                className="h-8 w-8 rounded-lg bg-white border border-[#e4e8f2] flex items-center justify-center text-[#8b93af] hover:text-[#7c6fcd] hover:border-[#7c6fcd] transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Phone size={14} />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                        <div className="w-10 h-10 rounded-full bg-[#f4f6fb] flex items-center justify-center mb-3">
                            <div className="w-2 h-2 bg-[#b8c0d8] rounded-full animate-pulse" />
                        </div>
                        <p className="text-[11px] font-bold text-[#b8c0d8] uppercase tracking-wider px-4">
                            Ninguém online no momento
                        </p>
                    </div>
                )}
            </div>
            
            <div className="p-5 border-t border-[#e4e8f2] bg-[#fcfdfe]">
                <button className="w-full py-2.5 rounded-xl border-2 border-dashed border-[#e4e8f2] text-[11px] font-black uppercase tracking-widest text-[#8b93af] hover:border-[#7c6fcd] hover:text-[#7c6fcd] transition-all">
                    Ver Todos Contatos
                </button>
            </div>
        </aside>
    );
}
