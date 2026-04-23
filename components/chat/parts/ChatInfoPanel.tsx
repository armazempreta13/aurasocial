'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Image as ImageIcon, 
    Bell, 
    Ban, 
    Shield, 
    X, 
    Mail, 
    MapPin, 
    Link as LinkIcon, 
    FileText, 
    ChevronRight,
    Search,
    MoreHorizontal,
    UserPlus,
    Phone
} from 'lucide-react';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAppStore } from '@/lib/store';

interface ChatInfoPanelProps {
    chat: any;
    messages: any[];
    isOpen: boolean;
    onClose: () => void;
}

const tokens = {
    border: 'rgba(0, 0, 0, 0.05)',
    accent: '#6366f1',
    textPri: '#0f172a',
    textMuted: '#94a3b8',
};

export function ChatInfoPanel({ chat, messages, isOpen, onClose }: ChatInfoPanelProps) {
    const [activeTab, setActiveTab] = React.useState<'media' | 'links' | 'files'>('media');
    const [fullUser, setFullUser] = React.useState<any>(null);
    const [relationship, setRelationship] = React.useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const profile = useAppStore(state => state.profile);

    const filteredMessages = useMemo(() => {
        if (!searchQuery.trim()) return messages;
        return messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [messages, searchQuery]);

    const media = useMemo(() => filteredMessages.filter(m => m.type === 'image'), [filteredMessages]);
    const links = useMemo(() => filteredMessages.filter(m => m.text?.includes('http')), [filteredMessages]);
    const files = useMemo(() => filteredMessages.filter(m => m.type === 'file'), [filteredMessages]);

    React.useEffect(() => {
        if (isOpen && chat?.otherUser?.uid) {
            const fetchFullData = async () => {
                const { getRelationshipSnapshot } = await import('@/lib/friendships');
                const [userSnap, relSnap] = await Promise.all([
                    getDoc(doc(db, 'users', chat.otherUser.uid)),
                    profile?.uid ? getRelationshipSnapshot(profile.uid, chat.otherUser.uid) : null
                ]);
                if (userSnap.exists()) setFullUser(userSnap.data());
                if (relSnap) setRelationship(relSnap);
            };
            fetchFullData();
        }
    }, [isOpen, chat?.otherUser?.uid, profile?.uid]);

    const statusLabel = useMemo(() => {
        if (!relationship) return 'Seguir';
        if (relationship.status === 'friends' || relationship.status === 'muted') return 'Amigos';
        if (relationship.status === 'request_sent') return 'Pendente';
        return 'Seguir';
    }, [relationship]);

    const isConnected = relationship?.status === 'friends' || relationship?.status === 'muted' || relationship?.status === 'request_sent';

    if (!chat) return null;

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <motion.aside
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 380, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    style={{
                        height: '100%',
                        background: '#ffffff',
                        borderLeft: `1px solid ${tokens.border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        zIndex: 50,
                        boxShadow: '-20px 0 60px rgba(0,0,0,0.03)'
                    }}
                >
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                        {/* Header & Close Button */}
                        <div className="sticky top-0 z-10 px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-black/[0.03] flex items-center justify-between">
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Detalhes</h2>
                            <button 
                                onClick={onClose}
                                className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Banner & Profile */}
                        <div className="relative">
                            <div className="h-32 bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-600" />
                            <div className="px-6 -mt-16 text-center pb-8 border-b border-slate-50">
                                <motion.img 
                                    layoutId={`avatar-${chat.id}`}
                                    src={chat.otherUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.otherUser.displayName)}`}
                                    className="h-32 w-32 rounded-[48px] border-8 border-white shadow-2xl mx-auto bg-white object-cover"
                                    alt=""
                                />
                                <h3 className="mt-4 text-2xl font-black text-slate-900 leading-tight tracking-tight">
                                    {chat.otherUser.displayName}
                                </h3>
                                <p className="text-sm font-bold text-indigo-500 mt-1">
                                    @{chat.otherUser.username || chat.otherUser.displayName.toLowerCase().replace(/\s/g, '')}
                                </p>
                                
                                <div className="flex items-center justify-center gap-2 mt-4">
                                    <button 
                                        onClick={async () => {
                                            if (!profile || !chat.otherUser) return;
                                            try {
                                                const { sendFriendRequest, removeFriendship } = await import('@/lib/friendships');
                                                if (isConnected) {
                                                    if (confirm(`Remover conexão com ${chat.otherUser.displayName}?`)) {
                                                        await removeFriendship(profile.uid, chat.otherUser.uid);
                                                        setRelationship({ ...relationship, status: 'none' });
                                                    }
                                                } else {
                                                    await sendFriendRequest({ fromUser: profile, toUser: chat.otherUser });
                                                    setRelationship({ ...relationship, status: 'request_sent' });
                                                }
                                            } catch (e: any) {
                                                alert(e.message);
                                            }
                                        }}
                                        className={`px-6 py-2 rounded-full text-xs font-black shadow-lg transition-transform hover:scale-105 ${
                                            isConnected 
                                                ? 'bg-slate-100 text-slate-800 shadow-slate-100' 
                                                : 'bg-[#7c6fcd] text-white shadow-[#7c6fcd]/20'
                                        }`}
                                    >
                                        {statusLabel}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const startCall = useAppStore.getState().startCall;
                                            if (startCall && chat.otherUser) {
                                                startCall(chat.otherUser.uid, chat.otherUser.displayName, 'audio', chat.otherUser.photoURL);
                                            }
                                        }}
                                        className="h-9 w-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-[#7c6fcd] hover:bg-[#7c6fcd]/5 transition-all"
                                    >
                                        <Phone size={18} />
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (!chat.otherUser) return;
                                            const action = confirm(`Deseja bloquear ${chat.otherUser.displayName}?`) ? 'block' : null;
                                            if (action === 'block') {
                                                const { blockUser } = await import('@/lib/friendships');
                                                await blockUser(profile!.uid, chat.otherUser.uid);
                                                alert('Usuário bloqueado.');
                                                onClose();
                                            }
                                        }}
                                        className="h-9 w-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                    >
                                        <MoreHorizontal size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Quick Info Sections */}
                        <div className="p-6 space-y-8">
                            {/* Bio / Status */}
                            <section>
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Bio</h4>
                                <p className="text-sm font-semibold text-slate-600 leading-relaxed">
                                    {fullUser?.bio || 'Nenhuma biografia disponível.'}
                                </p>
                            </section>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 rounded-3xl bg-slate-50 text-center border border-slate-100">
                                    <p className="text-lg font-black text-slate-900">{fullUser?.followersCount || 0}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Seguidores</p>
                                </div>
                                <div className="p-4 rounded-3xl bg-slate-50 text-center border border-slate-100">
                                    <p className="text-lg font-black text-slate-900">{fullUser?.postsCount || 0}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Posts</p>
                                </div>
                            </div>

                            {/* Tabs for shared content */}
                            <section>
                                <div className="flex gap-4 border-b border-slate-100 mb-4">
                                    {(['media', 'links', 'files'] as const).map(tab => (
                                        <button 
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`pb-3 text-xs font-black uppercase tracking-widest relative transition-colors ${activeTab === tab ? 'text-indigo-600' : 'text-slate-400'}`}
                                        >
                                            {tab === 'media' && 'Mídia'}
                                            {tab === 'links' && 'Links'}
                                            {tab === 'files' && 'Arquivos'}
                                            {activeTab === tab && (
                                                <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeTab}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="min-h-[200px]"
                                    >
                                        {activeTab === 'media' && (
                                            media.length > 0 ? (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {media.map((m, i) => (
                                                        <motion.div 
                                                            key={i} 
                                                            whileHover={{ scale: 1.05 }}
                                                            className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer"
                                                        >
                                                            <img src={m.attachmentUrl} className="w-full h-full object-cover" alt="" />
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <EmptyShared icon={<ImageIcon size={32} />} label="Sem mídias" />
                                            )
                                        )}

                                        {activeTab === 'links' && (
                                            links.length > 0 ? (
                                                <div className="space-y-2">
                                                    {links.map((l, i) => (
                                                        <a key={i} href={l.text} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-xl transition-all group">
                                                            <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                                                <LinkIcon size={18} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-black text-slate-800 truncate mb-0.5">{l.text}</p>
                                                                <p className="text-[10px] font-bold text-slate-400">Ver link externo</p>
                                                            </div>
                                                        </a>
                                                    ))}
                                                </div>
                                            ) : (
                                                <EmptyShared icon={<LinkIcon size={32} />} label="Sem links" />
                                            )
                                        )}

                                        {activeTab === 'files' && (
                                            <EmptyShared icon={<FileText size={32} />} label="Sem documentos" />
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </section>

                            <div className="h-px bg-slate-100" />

                            {/* Settings / Danger Zone */}
                            <section className="space-y-4 pb-12">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Privacidade & Ações</h4>
                                <div className="space-y-1">
                                    <MenuAction 
                                        icon={<Bell size={18} />} 
                                        label="Silenciar Notificações" 
                                        showToggle 
                                        isActive={relationship?.status === 'muted'}
                                        onClick={async () => {
                                            if (!profile || !chat.otherUser) return;
                                            const { toggleMutedFriendship } = await import('@/lib/friendships');
                                            const newMuted = relationship?.status !== 'muted';
                                            await toggleMutedFriendship(profile.uid, chat.otherUser.uid, newMuted);
                                            setRelationship({ ...relationship, status: newMuted ? 'muted' : 'friends' });
                                        }}
                                    />
                                    <MenuAction 
                                        icon={<Search size={18} />} 
                                        label="Pesquisar na Conversa" 
                                        onClick={() => setIsSearching(!isSearching)}
                                    />
                                    <AnimatePresence>
                                        {isSearching && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="px-4 pb-4"
                                            >
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input 
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Buscar mensagens..."
                                                        className="w-full bg-slate-100 border-none rounded-xl py-2 pl-9 pr-4 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <MenuAction 
                                        icon={<Ban size={18} />} 
                                        label="Bloquear Usuário" 
                                        color="red" 
                                        onClick={async () => {
                                            if (!chat.otherUser || !profile) return;
                                            if (confirm(`Deseja bloquear ${chat.otherUser.displayName}?`)) {
                                                const { blockUser } = await import('@/lib/friendships');
                                                await blockUser(profile.uid, chat.otherUser.uid);
                                                alert('Usuário bloqueado.');
                                                onClose();
                                            }
                                        }}
                                    />
                                    <MenuAction 
                                        icon={<Shield size={18} />} 
                                        label="Denunciar Perfil" 
                                        color="red" 
                                        onClick={async () => {
                                            if (!chat.otherUser || !profile) return;
                                            const reason = prompt(`Por que deseja denunciar ${chat.otherUser.displayName}?`);
                                            if (reason) {
                                                const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
                                                await addDoc(collection(db, 'reports'), {
                                                    reporterId: profile.uid,
                                                    targetId: chat.otherUser.uid,
                                                    reason,
                                                    type: 'user_report',
                                                    createdAt: serverTimestamp(),
                                                    status: 'pending'
                                                });
                                                alert('Denúncia enviada com sucesso. Nossa equipe irá analisar.');
                                            }
                                        }}
                                    />
                                </div>
                            </section>
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}

function EmptyShared({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-300">
            {icon}
            <p className="mt-3 text-xs font-black uppercase tracking-wider">{label}</p>
        </div>
    );
}

function MenuAction({ icon, label, showToggle, color, onClick, isActive }: { icon: React.ReactNode, label: string, showToggle?: boolean, color?: string, onClick?: () => void, isActive?: boolean }) {
    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group ${color === 'red' ? 'text-red-500 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${color === 'red' ? 'bg-red-50 group-hover:bg-red-100' : 'bg-slate-100 group-hover:bg-white'}`}>
                    {icon}
                </div>
                <span className="text-sm font-black">{label}</span>
            </div>
            {showToggle ? (
                <div className={`h-5 w-9 rounded-full relative p-1 transition-colors ${isActive ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                    <motion.div 
                        animate={{ x: isActive ? 16 : 0 }}
                        className="h-3 w-3 bg-white rounded-full shadow-sm" 
                    />
                </div>
            ) : (
                <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
            )}
        </button>
    );
}
