'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, MessageSquare } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useChat } from './ChatProvider';
import { useUserSearch } from './useUserSearch';
import { type ChatUserPreview } from '@/lib/chat-runtime';

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewMessageModal({ isOpen, onClose }: NewMessageModalProps) {
  const [query, setQuery] = useState('');
  const { results, loading } = useUserSearch(query);
  const { chats, openChatWithUser } = useChat();

  // Fechar com a tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setQuery('');
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lista de amigos recentes extraída dos chats ativos
  const recentFriends = chats
    .map((chat) => chat.otherUser)
    .filter(Boolean) as ChatUserPreview[];

  const handleSelectUser = async (user: ChatUserPreview) => {
    await openChatWithUser(user);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="absolute bottom-16 right-0 mb-2 flex h-[500px] w-[340px] flex-col overflow-hidden rounded-[28px] border border-slate-100 bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-[15px] font-black tracking-tight text-slate-900">Nova mensagem</h2>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#7c3aed] transition-colors hover:bg-purple-50 hover:text-[#6d28d9]"
            >
              <X size={18} className="stroke-[2.5]" />
            </button>
          </div>

          {/* Search Field */}
          <div className="border-b border-slate-50 px-5 py-3">
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2.5 ring-1 ring-slate-100 focus-within:ring-2 focus-within:ring-[#7c3aed]/20 focus-within:bg-white transition-all">
              <span className="text-slate-400 text-xs font-black uppercase tracking-wider">Para:</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar pelo nome ou @handle"
                autoFocus
                className="w-full bg-transparent text-[13px] text-slate-800 placeholder-slate-400 outline-none"
              />
              {loading ? (
                <Loader2 size={16} className="animate-spin text-[#7c3aed]" />
              ) : (
                <Search size={16} className="text-slate-400" />
              )}
            </div>
          </div>

          {/* Results / Recent Friends */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
            {query.trim().length < 2 ? (
              <div className="space-y-1">
                {recentFriends.length > 0 && (
                  <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Contatos recentes
                  </p>
                )}
                
                {recentFriends.length === 0 ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 shadow-sm ring-1 ring-slate-100">
                      <MessageSquare size={20} className="text-[#7c3aed]" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      Nenhuma conversa ativa
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                      Pesquise acima para iniciar um papo!
                    </p>
                  </div>
                ) : (
                  recentFriends.map((user) => {
                    const isOnline = user.status === 'online';
                    const initials = user.displayName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <button
                        key={user.uid}
                        onClick={() => handleSelectUser(user)}
                        className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                      >
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div className="relative h-10 w-10 overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 ring-1 ring-black/5">
                            {user.photoURL ? (
                              <img
                                src={user.photoURL}
                                alt={user.displayName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-black text-[#7c3aed]">
                                {initials}
                              </div>
                            )}
                          </div>
                          {/* Status */}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                              isOnline ? 'bg-green-500' : 'bg-slate-300'
                            }`}
                          />
                        </div>

                        {/* Info */}
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-[13px] font-black text-slate-800">
                            {user.displayName}
                          </span>
                          {user.username && (
                            <span className="truncate text-[10px] font-bold text-slate-400">
                              @{user.username}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : results.length === 0 && !loading ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center">
                <p className="text-xs font-bold text-slate-700">Nenhum resultado</p>
                <p className="mt-1 text-[11px] font-medium text-slate-400">Verifique o nome ou @handle digitado.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Resultados da busca
                </p>
                {results.map((user) => {
                  const isOnline = user.status === 'online';
                  const initials = user.displayName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <button
                      key={user.uid}
                      onClick={() => handleSelectUser(user)}
                      className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className="relative h-10 w-10 overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 ring-1 ring-black/5">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-black text-[#7c3aed]">
                              {initials}
                            </div>
                          )}
                        </div>
                        {/* Status */}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                            isOnline ? 'bg-green-500' : 'bg-slate-300'
                          }`}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-[13px] font-black text-slate-800">
                          {user.displayName}
                        </span>
                        {user.username && (
                          <span className="truncate text-[10px] font-bold text-slate-400">
                            @{user.username}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
