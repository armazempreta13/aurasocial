'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Maximize2, Minus, X, Phone, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  doc,
  onSnapshot,
  query,
  collection,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useAppStore } from '@/lib/store';
import { useSignaling } from '@/components/SignalingProvider';
import {
  postRuntimeMessage,
  syncChatUser,
  markMessagesAsRead,
  buildChatList,
  ensureRuntimeChat,
  type ChatMessage,
  type ChatUserPreview,
  type ChatListItem,
} from '@/lib/chat-runtime';
import { uploadImage } from '@/lib/image-utils';
import { ChatConversation } from './ChatConversation';
import { soundEffects } from '@/lib/sound-effects';

type OpenChatMode = 'floating' | 'page';

interface ChatContextValue {
  chats: ChatListItem[];
  suggestions: ChatUserPreview[];
  messagesByChat: Record<string, ChatMessage[]>;
  typingByChat: Record<string, boolean>;
  loading: boolean;
  pageChatId: string | null;
  floatingChatIds: string[];
  minimizedChatIds: string[];
  unreadTotal: number;
  messagesHubOpen: boolean;
  openMessagesHub: () => void;
  closeMessagesHub: () => void;
  setPageChatId: (chatId: string | null) => void;
  openChatById: (chatId: string, mode?: OpenChatMode) => void;
  openChatWithUser: (user: ChatUserPreview, mode?: OpenChatMode) => Promise<string | null>;
  closeFloatingChat: (chatId: string) => void;
  minimizeFloatingChat: (chatId: string) => void;
  restoreFloatingChat: (chatId: string) => void;
  sendMessage: (chatId: string, text: string, type?: 'text' | 'image', attachmentUrl?: string) => Promise<void>;
  sendTyping: (chatId: string, isTyping: boolean) => void;
  subscribeToChat: (chatId: string) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const FLOATING_LIMIT = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const profile = useAppStore((s) => s.profile);
  const { sendSignal } = useSignaling();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<ChatUserPreview[]>([]);
  const [chatRows, setChatRows] = useState<Record<string, any>[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>({});
  const [typingByChat, setTypingByChat] = useState<Record<string, boolean>>({});
  const [messagesHubOpen, setMessagesHubOpen] = useState(false);
  const [pageChatId, setPageChatIdState] = useState<string | null>(null);
  const [floatingChatIds, setFloatingChatIds] = useState<string[]>([]);
  const [minimizedChatIds, setMinimizedChatIds] = useState<string[]>([]);

  // ── Refs: never trigger re-renders ────────────────────────────────────────
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const messageListenersRef = useRef<Record<string, () => void>>({});
  const userListenersRef = useRef<Record<string, () => void>>({});

  // FIX 1: uid in a ref — closures always read fresh value without deps issues
  const profileUidRef = useRef<string | undefined>(profile?.uid);
  useEffect(() => { profileUidRef.current = profile?.uid; }, [profile?.uid]);

  // FIX 2: prevChatRowsRef was MISSING in the original — caused ReferenceError
  const prevChatRowsRef = useRef<Record<string, any>[]>([]);

  // FIX 3: minimizedChatIds in a ref for use inside state updater closures
  const minimizedChatIdsRef = useRef<string[]>([]);
  useEffect(() => { minimizedChatIdsRef.current = minimizedChatIds; }, [minimizedChatIds]);

  // ── Sound ──────────────────────────────────────────────────────────────────
  const playPop = useCallback(() => {
    soundEffects.play('pop');
  }, []);

  // ── Derived chat list ──────────────────────────────────────────────────────
  const chats = useMemo(() => {
    if (!profile?.uid) return [];
    return buildChatList(chatRows, users, profile.uid, unreadMap);
  }, [chatRows, users, profile?.uid, unreadMap]);

  // ── Open chat (pure state, never async, safe inside effects) ───────────────
  // FIX 4: NOT async — openChatById must never be called directly inside
  // onSnapshot because setState inside an external callback creates loops.
  const openChatById = useCallback(
    (chatId: string, mode: OpenChatMode = 'floating') => {
      if (!chatId) return;

      if (mode === 'page') {
        setPageChatIdState(chatId);
        return;
      }

      setMinimizedChatIds((prev) => prev.filter((id) => id !== chatId));
      setFloatingChatIds((prev) => {
        if (prev.includes(chatId)) return prev;
        const trimmed = prev.length >= FLOATING_LIMIT ? prev.slice(1) : prev;
        return [...trimmed, chatId];
      });
    },
    [],
  );

  // ── Real-time: chat list ───────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.uid) return;
    const uid = profile.uid;
    const userRef = doc(db, 'users', uid);

    updateDoc(userRef, { status: 'online', lastSeen: serverTimestamp() }).catch(console.warn);

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', uid),
      orderBy('updatedAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
            createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
            lastMessageTime: data.lastMessageTime?.toMillis?.() ?? data.updatedAt?.toMillis?.() ?? 0,
            lastMessageSenderId: data.lastMessageSenderId ?? null,
            lastMessage: data.lastMessage ?? null,
          };
        });

        // ── New message detection ─────────────────────────────────────────
        // FIX 5: collect IDs of chats with new incoming messages,
        // then open them via a queued microtask — NEVER call setState/openChatById
        // synchronously inside onSnapshot (it's outside React's scheduler).
        const toAutoOpen: string[] = [];

        rows.forEach((row) => {
          const prev = prevChatRowsRef.current.find((p) => p.id === row.id);
          const isNewIncoming =
            row.lastMessageTime > 0 &&
            row.lastMessage &&
            row.lastMessageSenderId &&
            row.lastMessageSenderId !== profileUidRef.current &&
            (!prev || row.lastMessageTime > (prev.lastMessageTime ?? 0));

          if (isNewIncoming) {
            toAutoOpen.push(row.id);
            // Increment unread count
            setUnreadMap((u) => ({ ...u, [row.id]: (u[row.id] ?? 0) + 1 }));
          }
        });

        prevChatRowsRef.current = rows;
        setChatRows(rows);

        // Queue auto-opens + sound after React processes the state above
        if (toAutoOpen.length > 0) {
          // Use queueMicrotask to run after the current synchronous block
          queueMicrotask(() => {
            playPop();
            toAutoOpen.forEach((chatId) => {
              // Only auto-open if the user hasn't minimized the chat intentionally
              if (!minimizedChatIdsRef.current.includes(chatId)) {
                setFloatingChatIds((prev) => {
                  if (prev.includes(chatId)) return prev;
                  const trimmed = prev.length >= FLOATING_LIMIT ? prev.slice(1) : prev;
                  return [...trimmed, chatId];
                });
              }
            });
          });
        }
      },
      (error) => console.warn('Chat list listener error:', error),
    );

    return () => {
      unsubscribe();
      updateDoc(userRef, { status: 'offline', lastSeen: serverTimestamp() }).catch(console.warn);
    };
  }, [profile?.uid, playPop]);

  // ── Real-time: user presence for each participant ──────────────────────────
  // FIX 6: depends only on chatRows — removed floatingChatIds from deps.
  // Adding floatingChatIds caused new onSnapshot subscriptions every time
  // a window was opened or closed.
  useEffect(() => {
    if (!profile?.uid) return;
    const uid = profile.uid;

    const uidsToTrack = new Set<string>();
    chatRows.forEach((row) => {
      const otherUid = (row.participants as string[]).find((p: string) => p !== uid);
      if (otherUid) uidsToTrack.add(otherUid);
    });

    uidsToTrack.forEach((otherUid) => {
      if (userListenersRef.current[otherUid]) return; // already subscribed

      const unsub = onSnapshot(doc(db, 'users', otherUid), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const updated: ChatUserPreview = {
          uid: otherUid,
          displayName: data.displayName || (data.username ? `@${data.username}` : 'Usuário'),
          photoURL: data.photoURL,
          username: data.username,
          status: data.status ?? 'offline',
          lastSeen: data.lastSeen?.toMillis?.() ?? 0,
        };

        setUsers((prev) => {
          const idx = prev.findIndex((u) => u.uid === otherUid);
          if (idx >= 0) {
            const cur = prev[idx];
            // Only trigger re-render when something meaningful changed
            if (
              cur.status === updated.status &&
              cur.displayName === updated.displayName &&
              cur.photoURL === updated.photoURL
            ) {
              return prev;
            }
            const next = [...prev];
            next[idx] = updated;
            return next;
          }
          return [...prev, updated];
        });
      });

      userListenersRef.current[otherUid] = unsub;
    });
  }, [chatRows, profile?.uid]);

  // ── Full cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(messageListenersRef.current).forEach((u) => u());
      messageListenersRef.current = {};
      Object.values(userListenersRef.current).forEach((u) => u());
      userListenersRef.current = {};
      Object.values(typingTimeoutsRef.current).forEach((t) => clearTimeout(t));
      typingTimeoutsRef.current = {};
    };
  }, []);

  // ── Message subscription ───────────────────────────────────────────────────
  // FIX 7: subscribeToChat NO LONGER plays pop — the chat-list snapshot is the
  // single source of truth for "new message arrived". Double-pop eliminated.
  const subscribeToChat = useCallback(
    (chatId: string) => {
      if (messageListenersRef.current[chatId]) return;

      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(200),
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const rows = snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
              chatId,
              createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
            } as ChatMessage),
        );
        setMessagesByChat((prev) => ({ ...prev, [chatId]: rows }));
      });

      messageListenersRef.current[chatId] = unsubscribe;
    },
    [],
  );

  // ── Auto-subscribe + mark read when open chats change ─────────────────────
  useEffect(() => {
    const allOpen = [...floatingChatIds, ...(pageChatId ? [pageChatId] : [])];
    allOpen.forEach((chatId) => {
      subscribeToChat(chatId);
      setUnreadMap((prev) => ({ ...prev, [chatId]: 0 }));
      const uid = profileUidRef.current;
      if (uid) void markMessagesAsRead(chatId, uid);
    });
  }, [floatingChatIds, pageChatId, subscribeToChat]);

  // ── Mark read helper (for external callers) ────────────────────────────────
  const markChatReadLocal = useCallback((chatId: string) => {
    setUnreadMap((prev) => ({ ...prev, [chatId]: 0 }));
    const uid = profileUidRef.current;
    if (uid) void markMessagesAsRead(chatId, uid);
  }, []);

  // ── Open chat with user (creates chat doc if needed) ──────────────────────
  const openChatWithUser = useCallback(
    async (user: ChatUserPreview, mode: OpenChatMode = 'floating') => {
      if (!profile?.uid || !user?.uid) return null;
      setUsers((prev) => (prev.some((u) => u.uid === user.uid) ? prev : [...prev, user]));
      const runtimeChat = await ensureRuntimeChat([profile.uid, user.uid]);
      const chatId = runtimeChat.id as string;
      openChatById(chatId, mode);
      return chatId;
    },
    [openChatById, profile?.uid],
  );

  // ── Close / minimize / restore ─────────────────────────────────────────────
  const closeFloatingChat = useCallback((chatId: string) => {
    // Stop the message listener when the window closes to save Firestore reads
    messageListenersRef.current[chatId]?.();
    delete messageListenersRef.current[chatId];
    setFloatingChatIds((prev) => prev.filter((id) => id !== chatId));
    setMinimizedChatIds((prev) => prev.filter((id) => id !== chatId));
  }, []);

  const minimizeFloatingChat = useCallback((chatId: string) => {
    setFloatingChatIds((prev) => prev.filter((id) => id !== chatId));
    setMinimizedChatIds((prev) => (prev.includes(chatId) ? prev : [...prev, chatId]));
  }, []);

  const restoreFloatingChat = useCallback((chatId: string) => {
    setMinimizedChatIds((prev) => prev.filter((id) => id !== chatId));
    setFloatingChatIds((prev) => {
      if (prev.includes(chatId)) return prev;
      const trimmed = prev.length >= FLOATING_LIMIT ? prev.slice(1) : prev;
      return [...trimmed, chatId];
    });
  }, []);

  // ── Typing ─────────────────────────────────────────────────────────────────
  const sendTyping = useCallback(
    (chatId: string, isTyping: boolean) => {
      if (!profileUidRef.current) return;
      const chat = chats.find((c) => c.id === chatId);
      const targetId = chat?.otherUser?.uid;
      if (!targetId) return;
      sendSignal(targetId, 'typing-status', { chatId, isTyping });
    },
    [chats, sendSignal],
  );

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (chatId: string, text: string, type: 'text' | 'image' = 'text', attachmentUrl?: string) => {
      const uid = profileUidRef.current;
      if (!uid) return;
      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return;
      await postRuntimeMessage({ chatId, senderId: uid, text, type, attachmentUrl });
      sendSignal(chat.otherUser?.uid ?? '', 'typing-status', { chatId, isTyping: false });
    },
    [chats, sendSignal],
  );

  // ── Hub ────────────────────────────────────────────────────────────────────
  const openMessagesHub = useCallback(() => setMessagesHubOpen(true), []);
  const closeMessagesHub = useCallback(() => setMessagesHubOpen(false), []);

  const setPageChatId = useCallback(
    (chatId: string | null) => {
      setPageChatIdState(chatId);
      if (chatId) markChatReadLocal(chatId);
    },
    [markChatReadLocal],
  );

  // ── Typing signal listener ─────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.uid) return;

    const onSignal = (e: Event) => {
      const { type, payload } = (e as CustomEvent).detail ?? {};
      if (type !== 'typing-status') return;

      const chatId = payload?.chatId as string;
      const typing = Boolean(payload?.isTyping);

      setTypingByChat((prev) => ({ ...prev, [chatId]: typing }));

      if (typingTimeoutsRef.current[chatId]) {
        clearTimeout(typingTimeoutsRef.current[chatId]);
        delete typingTimeoutsRef.current[chatId];
      }

      if (typing) {
        typingTimeoutsRef.current[chatId] = setTimeout(() => {
          setTypingByChat((prev) => ({ ...prev, [chatId]: false }));
          delete typingTimeoutsRef.current[chatId];
        }, 3000);
      }
    };

    window.addEventListener('aura:signal', onSignal);
    return () => window.removeEventListener('aura:signal', onSignal);
  }, [profile?.uid]);

  // ── Bootstrap: sync profile + suggested friends ────────────────────────────
  useEffect(() => {
    if (!profile?.uid) return;
    const activeProfile = profile;
    let isMounted = true;

    void (async () => {
      setLoading(true);
      try {
        await syncChatUser({
          uid: activeProfile.uid,
          displayName: activeProfile.displayName,
          photoURL: activeProfile.photoURL,
          username: activeProfile.username,
        });

        const { getSuggestedFriends } = await import('@/lib/friendships');
        const recommended = await getSuggestedFriends(activeProfile.uid);
        const formatted: ChatUserPreview[] = recommended.map((u: any) => ({
          uid: u.id,
          displayName: u.displayName,
          photoURL: u.photoURL,
          username: u.username,
          status: u.status ?? 'offline',
        }));

        if (isMounted) setUsers(formatted);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => { isMounted = false; };
  }, [profile?.uid]);

  // ── Global event bridge ────────────────────────────────────────────────────
  useEffect(() => {
    const openFromWindow = async (event: Event) => {
      const detail = (event as CustomEvent<{ user: ChatUserPreview; mode?: OpenChatMode }>).detail;
      if (!detail?.user) return;
      await openChatWithUser(detail.user, detail.mode ?? 'floating');
    };

    const openById = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId: string; mode?: OpenChatMode }>).detail;
      if (!detail?.chatId) return;
      openChatById(detail.chatId, detail.mode ?? 'floating');
    };

    window.addEventListener('aura:open-chat-user', openFromWindow as EventListener);
    window.addEventListener('aura:open-chat-id', openById as EventListener);
    (window as any).__auraOpenChat = (user: ChatUserPreview, mode?: OpenChatMode) =>
      openChatWithUser(user, mode);
    (window as any).__auraOpenChatById = (chatId: string, mode?: OpenChatMode) =>
      openChatById(chatId, mode);

    return () => {
      window.removeEventListener('aura:open-chat-user', openFromWindow as EventListener);
      window.removeEventListener('aura:open-chat-id', openById as EventListener);
      delete (window as any).__auraOpenChat;
      delete (window as any).__auraOpenChatById;
    };
  }, [openChatById, openChatWithUser]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const unreadTotal = useMemo(
    () => chats.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0),
    [chats],
  );

  const suggestions = useMemo(
    () =>
      users
        .filter((u) => u.uid !== profile?.uid && !chats.some((c) => c.otherUser?.uid === u.uid))
        .slice(0, 12),
    [chats, profile?.uid, users],
  );

  // ── Context value ──────────────────────────────────────────────────────────
  const contextValue = useMemo<ChatContextValue>(
    () => ({
      chats,
      suggestions,
      messagesByChat,
      typingByChat,
      loading,
      pageChatId,
      floatingChatIds,
      minimizedChatIds,
      unreadTotal,
      messagesHubOpen,
      openMessagesHub,
      closeMessagesHub,
      setPageChatId,
      openChatById,
      openChatWithUser,
      closeFloatingChat,
      minimizeFloatingChat,
      restoreFloatingChat,
      sendMessage,
      sendTyping,
      subscribeToChat,
    }),
    [
      chats,
      suggestions,
      messagesByChat,
      typingByChat,
      loading,
      pageChatId,
      floatingChatIds,
      minimizedChatIds,
      unreadTotal,
      messagesHubOpen,
      openMessagesHub,
      closeMessagesHub,
      setPageChatId,
      openChatById,
      openChatWithUser,
      closeFloatingChat,
      minimizeFloatingChat,
      restoreFloatingChat,
      sendMessage,
      sendTyping,
      subscribeToChat,
    ],
  );

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
      {profile?.uid && <ChatOverlay />}
    </ChatContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay — floating windows + minimized bubbles
// ─────────────────────────────────────────────────────────────────────────────
function ChatOverlay() {
  const router = useRouter();

  const currentUserId = useAppStore((s) => s.profile?.uid ?? '');
  const startCall = useAppStore((s) => s.startCall);

  const {
    chats,
    floatingChatIds,
    minimizedChatIds,
    messagesByChat,
    typingByChat,
    closeFloatingChat,
    minimizeFloatingChat,
    restoreFloatingChat,
    sendMessage,
    sendTyping,
    closeMessagesHub,
  } = useChat();

  const [composerValues, setComposerValues] = useState<Record<string, string>>({});

  // FIX 8: clean up composer entries when chats close
  useEffect(() => {
    setComposerValues((prev) => {
      const allOpen = new Set([...floatingChatIds, ...minimizedChatIds]);
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((id) => {
        if (!allOpen.has(id)) { delete next[id]; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [floatingChatIds, minimizedChatIds]);

  const floatingChats = floatingChatIds
    .map((id) => chats.find((c) => c.id === id))
    .filter(Boolean) as ChatListItem[];

  const minimizedChats = minimizedChatIds
    .map((id) => chats.find((c) => c.id === id))
    .filter(Boolean) as ChatListItem[];

  const handleVoiceCall = useCallback(
    (chat: ChatListItem) => {
      if (startCall) {
        startCall(chat.otherUser.uid, chat.otherUser.displayName, 'audio', chat.otherUser.photoURL);
      } else {
        alert('Sistema de chamadas em manutenção');
      }
    },
    [startCall],
  );

  const handleOpenPage = useCallback(
    (chatId: string) => {
      window.dispatchEvent(new CustomEvent('aura:open-chat-id', { detail: { chatId, mode: 'page' } }));
      closeMessagesHub();
      router.push(`/messages?chatId=${chatId}`);
    },
    [closeMessagesHub, router],
  );

  // FIX 9: stable send/upload — close over chatId as argument, not via composerValues
  // in useCallback deps (which would recreate on every keystroke)
  const handleSend = useCallback(
    async (chatId: string, value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      await sendMessage(chatId, trimmed);
      setComposerValues((prev) => ({ ...prev, [chatId]: '' }));
    },
    [sendMessage],
  );

  const handleUpload = useCallback(
    async (chatId: string, file: File) => {
      try {
        const result = await uploadImage(file);
        await sendMessage(chatId, 'Imagem', 'image', result.url);
      } catch (error: any) {
        console.error('Chat upload error:', error);
        alert(`Falha ao enviar imagem: ${error.message}`);
      }
    },
    [sendMessage],
  );

  const avatarSrc = (user: ChatUserPreview) =>
    user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'U')}&background=random`;

  return (
    <>
      {/* ── Floating chat windows ──────────────────────────────────────────── */}
      <div className="pointer-events-none fixed bottom-0 right-0 z-[70] hidden max-w-[100vw] items-end gap-3 p-4 xl:flex">
        {floatingChats.map((chat) => {
          const isOnline = chat.otherUser?.status === 'online';
          const isTyping = Boolean(typingByChat[chat.id]);
          const composerValue = composerValues[chat.id] || '';

          return (
            <div
              key={chat.id}
              className="pointer-events-auto flex h-[560px] w-[360px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {/* Avatar with real-time online dot */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={avatarSrc(chat.otherUser)}
                      alt={chat.otherUser?.displayName}
                      className="h-10 w-10 rounded-2xl object-cover"
                    />
                    {/* FIX: real-time presence dot driven by Firestore onSnapshot */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white transition-colors duration-500 ${
                        isOnline ? 'bg-green-500' : 'bg-slate-300'
                      }`}
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-black text-slate-900">
                      {chat.otherUser?.displayName || 'Carregando...'}
                    </p>
                    <p
                      className={`text-[10px] font-black uppercase tracking-[0.18em] transition-colors ${
                        isTyping ? 'text-indigo-500' : isOnline ? 'text-green-600' : 'text-slate-400'
                      }`}
                    >
                      {isTyping ? 'Escrevendo...' : isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleVoiceCall(chat)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Chamada de voz"
                  >
                    <Phone size={15} />
                  </button>
                  <button
                    onClick={() => handleOpenPage(chat.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Abrir no feed"
                  >
                    <UserIcon size={15} />
                  </button>

                  <div className="mx-1 h-4 w-px bg-slate-200" />

                  <button
                    onClick={() => minimizeFloatingChat(chat.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Minimizar"
                  >
                    <Minus size={16} />
                  </button>
                  <button
                    onClick={() => handleOpenPage(chat.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Maximizar"
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button
                    onClick={() => closeFloatingChat(chat.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    title="Fechar"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="min-h-0 flex-1">
                <ChatConversation
                  chat={chat}
                  messages={messagesByChat[chat.id] || []}
                  currentUserId={currentUserId}
                  isTyping={isTyping}
                  isWindow
                  value={composerValue}
                  onChange={(value) => {
                    setComposerValues((prev) => ({ ...prev, [chat.id]: value }));
                    sendTyping(chat.id, value.length > 0);
                  }}
                  onSend={() => handleSend(chat.id, composerValue)}
                  onUpload={(file) => handleUpload(chat.id, file)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Minimized chat bubbles ─────────────────────────────────────────── */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[69] hidden flex-col items-end gap-2 xl:flex">
        {minimizedChats.map((chat) => {
          const isOnline = chat.otherUser?.status === 'online';
          return (
            <button
              key={chat.id}
              onClick={() => restoreFloatingChat(chat.id)}
              className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-lg shadow-slate-200/60 transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="relative flex-shrink-0">
                <img
                  src={avatarSrc(chat.otherUser)}
                  alt={chat.otherUser?.displayName}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white transition-colors duration-500 ${
                    isOnline ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                />
              </div>
              <div className="text-left">
                <p className="max-w-[140px] truncate text-[13px] font-bold text-slate-900">
                  {chat.otherUser?.displayName}
                </p>
                <p className="max-w-[140px] truncate text-[11px] text-slate-500">
                  {chat.lastMessage || 'Nova mensagem'}
                </p>
              </div>
              {chat.unreadCount > 0 && (
                <span className="flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-black text-white animate-in zoom-in duration-300">
                  {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
}