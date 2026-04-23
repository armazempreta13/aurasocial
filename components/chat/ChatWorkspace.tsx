'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useChat } from './ChatProvider';
import { uploadImage } from '@/lib/image-utils';
import { AppLayout } from '@/components/AppLayout';
import { ChatList } from './ChatList';
import { ChatConversation } from './ChatConversation';

// Modularized Parts
import { ChatInfoPanel } from './parts/ChatInfoPanel';
import { EmptyState } from './parts/EmptyState';
import { ComposeButton } from './parts/ChatSubComponents';
import { OnlineFriends } from './parts/OnlineFriends';

/* ─────────────────────────────────────────────
   Aura Design System Tokens 
───────────────────────────────────────────── */
export const tokens = {
    bg: '#eef0f6',
    surface: '#ffffff',
    surfaceAlt: '#f5f6fb',
    border: '#e4e8f2',
    borderFocus: '#b5aef0',
    accent: '#7c6fcd',
    accentBg: '#f0effe',
    textPri: '#1a1f3a',
    textSec: '#8b93af',
    textMuted: '#b8c0d8',
    online: '#22c55e',
} as const;

const css = {
    workspace: {
        display: 'flex',
        height: 'calc(100vh - 64px)',
        background: tokens.bg,
        overflow: 'hidden',
        position: 'relative',
    } satisfies React.CSSProperties,

    sidebar: (hidden: boolean): React.CSSProperties => ({
        width: 320,
        minWidth: 320,
        background: tokens.surface,
        borderRight: `1px solid ${tokens.border}`,
        display: hidden ? 'none' : 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
        zIndex: 10,
    }),
    
    sidebarHeader: {
        padding: '24px 20px 16px',
    } satisfies React.CSSProperties,
    
    sidebarMenuLabel: {
        fontSize: 9.5,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: tokens.textMuted,
        marginBottom: 4,
    } satisfies React.CSSProperties,

    sidebarTitleRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    } satisfies React.CSSProperties,

    sidebarTitle: {
        fontSize: 17,
        fontWeight: 700,
        color: tokens.textPri,
    } satisfies React.CSSProperties,
};

export function ChatWorkspace() {
    const { t } = useTranslation('common');
    const profile = useAppStore((state) => state.profile);
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialChatId = searchParams?.get('chatId') ?? null;

    const {
        chats,
        suggestions,
        messagesByChat,
        typingByChat,
        loading,
        pageChatId,
        setPageChatId,
        sendMessage,
        subscribeToChat,
        openChatWithUser,
    } = useChat();

    const [searchQuery, setSearchQuery] = useState('');
    const [composerValue, setComposerValue] = useState('');
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        if (initialChatId && initialChatId !== pageChatId) {
            setPageChatId(initialChatId);
            subscribeToChat(initialChatId);
        }
    }, [initialChatId]);

    const currentChat = useMemo(() => 
        chats.find(c => c.id === pageChatId), 
    [chats, pageChatId]);

    const activeMessages = useMemo(() => 
        pageChatId ? (messagesByChat[pageChatId] || []) : [], 
    [messagesByChat, pageChatId]);

    const handleSendMessage = useCallback(async () => {
        if (!pageChatId || !composerValue.trim()) return;
        await sendMessage(pageChatId, composerValue.trim());
        setComposerValue('');
    }, [pageChatId, composerValue, sendMessage]);

    if (!profile?.uid) return null;

    return (
        <AppLayout plain hideSidebar hideRightPanel>
            <div style={css.workspace}>
                {/* ── SIDEBAR ── */}
                <div
                    style={css.sidebar(false)}
                    className={`${pageChatId ? 'hidden md:flex' : 'flex'}`}
                >
                    <div style={css.sidebarHeader}>
                        <p style={css.sidebarMenuLabel}>Menu</p>
                        <div style={css.sidebarTitleRow}>
                            <h1 style={css.sidebarTitle}>Mensagens</h1>
                            <ComposeButton onClick={() => suggestions[0] && openChatWithUser(suggestions[0], 'page')} />
                        </div>
                    </div>

                    <ChatList
                        chats={chats}
                        suggestions={suggestions}
                        selectedChatId={pageChatId}
                        onSelectChat={async (id) => {
                            // Check if it's already a chat ID (contains __ or is in chats)
                            const isExisting = chats.some(c => c.id === id);
                            if (isExisting) {
                                setPageChatId(id);
                                subscribeToChat(id);
                                router.push(`/messages?chatId=${id}`);
                            } else {
                                // It's likely a userId from suggestions
                                const user = suggestions.find(s => s.uid === id);
                                if (user) {
                                    const chatId = await openChatWithUser(user, 'page');
                                    if (chatId) router.push(`/messages?chatId=${chatId}`);
                                }
                            }
                        }}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </div>

                {/* ── CONVERSATION ── */}
                <div className={`flex-1 flex min-w-0 ${!pageChatId ? 'hidden md:flex' : 'flex'} bg-[#f5f6fb]`} style={{ position: 'relative' }}>
                    {pageChatId && currentChat ? (
                        <ChatConversation
                            chat={currentChat}
                            messages={activeMessages}
                            profile={profile}
                            composerValue={composerValue}
                            onComposerChange={setComposerValue}
                            onSend={handleSendMessage}
                            onUpload={async (file) => {
                                const res = await uploadImage(file);
                                await sendMessage(pageChatId, 'Image', 'image', res.url);
                            }}
                            isTyping={typingByChat[pageChatId]}
                            onInfoToggle={() => setShowInfo(!showInfo)}
                        />
                    ) : (
                        <EmptyState />
                    )}
                </div>

                {!showInfo && <OnlineFriends />}

                {/* ── INFO PANEL (OPTIONAL) ── */}
                <ChatInfoPanel 
                    isOpen={showInfo} 
                    onClose={() => setShowInfo(false)} 
                    chat={currentChat}
                    messages={activeMessages}
                />
            </div>
        </AppLayout>
    );
}