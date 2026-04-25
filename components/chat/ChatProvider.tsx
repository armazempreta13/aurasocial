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
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '@/lib/store';
import { useSignaling } from '@/components/SignalingProvider';
import { eventBus } from '@/lib/event-bus';
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
import { NewMessageFloatingButton } from './NewMessageFloatingButton';

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
  currentChat: ChatListItem | null;
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
  const [users, setUsers] = useState<ChatUserPreview[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem('aura_user_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [chatRows, setChatRows] = useState<Record<string, any>[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  // Update localStorage whenever users state changes
  useEffect(() => {
    if (users.length > 0) {
      try {
        localStorage.setItem('aura_user_cache', JSON.stringify(users.slice(0, 100))); 
      } catch (e) {}
    }
  }, [users]);
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

  useEffect(() => {
    const offOpen = eventBus.subscribe('chat:open_bubble', (payload: any) => {
      if (payload?.chatId) {
        setMinimizedChatIds((prev) => prev.filter((id) => id !== payload.chatId));
        setFloatingChatIds((prev) => {
          const without = prev.filter((id) => id !== payload.chatId);
          const trimmed = without.length >= 3 ? without.slice(1) : without; // FLOATING_LIMIT = 3
          return [...trimmed, payload.chatId];
        });
      }
    });
    return () => {
      offOpen();
    };
  }, []);

  // FIX 2: prevChatRowsRef was MISSING in the original — caused ReferenceError
  const prevChatRowsRef = useRef<Record<string, any>[]>([]);

  // FIX 3: minimizedChatIds in a ref for use inside state updater closures
  const minimizedChatIdsRef = useRef<string[]>([]);
  useEffect(() => { minimizedChatIdsRef.current = minimizedChatIds; }, [minimizedChatIds]);

  // Ref for floatingChatIds — used inside onSnapshot closure to avoid stale state
  const floatingChatIdsRef = useRef<string[]>([]);
  useEffect(() => { floatingChatIdsRef.current = floatingChatIds; }, [floatingChatIds]);

  const lastSeenMessageIdRef = useRef<Record<string, string>>({});

  const playPop = useCallback(() => {
    soundEffects.play('pop');
  }, []);

  const playNotification = useCallback(() => {
    soundEffects.play('notification');
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
        const without = prev.filter((id) => id !== chatId);
        const trimmed = without.length >= FLOATING_LIMIT ? without.slice(1) : without;
        return [...trimmed, chatId];
      });
      eventBus.emit('chat:open_bubble', { chatId });
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

    // isInitialLoad é LOCAL ao closure do effect — reseta automaticamente
    // toda vez que o effect re-assina (ex: quando o uid muda ou o effect remonta).
    // Isso evita que mensagens antigas disparem bubbles.
    let isInitialLoad = true;

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
            lastMessageId: data.lastMessageId ?? null,
          };
        });

        // Fetch initial unread counts on first snapshot
        if (isInitialLoad && rows.length > 0) {
          rows.forEach((row) => {
            const unreadQ = query(
              collection(db, 'chats', row.id, 'messages'),
              where('senderId', '!=', uid),
              where('read', '==', false)
            );
            import('firebase/firestore').then(({ getCountFromServer }) => {
              getCountFromServer(unreadQ).then((countSnap) => {
                const count = countSnap.data().count;
                if (count > 0) {
                  setUnreadMap((prev) => ({ ...prev, [row.id]: count }));
                }
              }).catch(() => {});
            });
          });
        }

        // ── New message detection ─────────────────────────────────────────
        // Collect IDs of chats with new incoming messages,
        // then open them via queueMicrotask — NEVER call setState
        // synchronously inside onSnapshot.
        const toAutoOpen: string[] = [];

        rows.forEach((row) => {
          const prevMessageId = lastSeenMessageIdRef.current[row.id] || '';
          const currentMessageId = row.lastMessageId || '';

          if (isInitialLoad) {
            // Primeira snapshot: apenas registra os IDs já existentes no banco.
            // NÃO abre nenhum bubble.
            if (currentMessageId) {
              lastSeenMessageIdRef.current[row.id] = currentMessageId;
            }
          } else {
            // Snapshots subsequentes = mensagem nova de verdade
            const isNewIncoming =
              !!currentMessageId &&
              !!row.lastMessageSenderId &&
              row.lastMessageSenderId !== profileUidRef.current &&
              currentMessageId !== prevMessageId;

            if (isNewIncoming) {
              lastSeenMessageIdRef.current[row.id] = currentMessageId;
              toAutoOpen.push(row.id);
              setUnreadMap((u) => ({ ...u, [row.id]: (u[row.id] ?? 0) + 1 }));
            } else if (currentMessageId) {
              // Mesma mensagem ou mensagem própria: apenas atualiza o ref
              lastSeenMessageIdRef.current[row.id] = currentMessageId;
            }
          }
        });

        // Marca fim do load inicial
        isInitialLoad = false;

        prevChatRowsRef.current = rows;
        setChatRows(rows);

        // Abre bubbles e toca som após React processar o state acima
        if (toAutoOpen.length > 0) {
          queueMicrotask(() => {
            playNotification();
            toAutoOpen.forEach((chatId) => {
              const alreadyOpen = floatingChatIdsRef.current.includes(chatId);
              if (alreadyOpen) {
                // Chat já está aberto: não reabrir, apenas o unreadMap já foi incrementado
                // para mostrar o badge no header do bubble.
                return;
              }
              // Chat não está visível: remover de minimized e adicionar em floating
              setMinimizedChatIds((prev) => prev.filter((id) => id !== chatId));
              setFloatingChatIds((prev) => {
                const without = prev.filter((id) => id !== chatId);
                const trimmed = without.length >= FLOATING_LIMIT ? without.slice(1) : without;
                return [...trimmed, chatId];
              });
            });
          });
        }
      },
      (error) => console.error('Chat list listener error:', error),
    );

    return () => {
      unsubscribe();
      updateDoc(userRef, { status: 'offline', lastSeen: serverTimestamp() }).catch(console.warn);
    };
  }, [profile?.uid, playNotification]);
  
  // ── Browser notification: update title with unread count ───────────────────
  useEffect(() => {
    const total = Object.values(unreadMap).reduce((a, b) => a + b, 0);
    if (typeof document === 'undefined') return;
    const original = document.title.replace(/^\(\d+\)\s/, '');
    if (total > 0) {
      document.title = `(${total}) ${original}`;
    } else {
      document.title = original;
    }
  }, [unreadMap]);

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

    // ── Bulk fetch missing users first ──
    const missingUids = Array.from(uidsToTrack).filter(id => !users.some(u => u.uid === id));
    if (missingUids.length > 0) {
      // Firestore 'in' query limit is 30. If more, split or just ignore (snapshots will eventually catch up)
      const batch = missingUids.slice(0, 30);
      import('firebase/firestore').then(({ getDocs, collection, where, query }) => {
        const q = query(collection(db, 'users'), where('__name__', 'in', batch));
        getDocs(q).then(snap => {
          const fetched: ChatUserPreview[] = snap.docs.map(d => {
            const data = d.data();
            return {
              uid: d.id,
              displayName: data.displayName || (data.username ? `@${data.username}` : 'Usuário'),
              photoURL: data.photoURL,
              username: data.username,
              status: data.status ?? 'offline',
              lastSeen: data.lastSeen?.toMillis?.() ?? 0,
            };
          });
          setUsers(prev => {
            const next = [...prev];
            fetched.forEach(u => {
              if (!next.some(n => n.uid === u.uid)) next.push(u);
            });
            return next;
          });
        }).catch(console.warn);
      });
    }

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
      }, (err) => {
        console.error('Chat user presence listener error:', err);
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
      }, (err) => {
        console.error('Chat messages listener error:', err);
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
      
      const runtimeChat = await ensureRuntimeChat([profile.uid, user.uid], {
        [profile.uid]: { displayName: profile.displayName, photoURL: profile.photoURL },
        [user.uid]: { displayName: user.displayName, photoURL: user.photoURL }
      });
      
      const chatId = runtimeChat.id as string;
      
      setChatRows((prev) => {
        if (prev.some((c) => c.id === chatId)) return prev;
        return [runtimeChat, ...prev];
      });

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
      const without = prev.filter((id) => id !== chatId);
      const trimmed = without.length >= FLOATING_LIMIT ? without.slice(1) : without;
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
      if (!profile) return;
      const uid = profile.uid;
      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return;

      // Optimistic update for instant UI feedback
      const optimisticMsg: ChatMessage = {
        id: `opt_${Date.now()}`,
        chatId,
        senderId: uid,
        text,
        type,
        attachmentUrl,
        createdAt: Date.now(),
        read: false
      };
      
      setMessagesByChat((prev) => {
        const currentMessages = prev[chatId] || [];
        // Avoid duplicates if user spams send
        if (currentMessages.some(m => m.id === optimisticMsg.id)) return prev;
        return {
          ...prev,
          [chatId]: [...currentMessages, optimisticMsg]
        };
      });

      // Sound feedback for sending (subtle interaction cue)
      soundEffects.play('pop');

      await postRuntimeMessage({ 
        chatId, 
        senderId: uid, 
        text, 
        type, 
        attachmentUrl,
        senderMetadata: { displayName: profile.displayName, photoURL: profile.photoURL }
      });
      sendSignal(chat.otherUser?.uid ?? '', 'typing-status', { chatId, isTyping: false });
    },
    [chats, sendSignal, profile],
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
      currentChat: chats.find(c => c.id === pageChatId) || null,
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
        // Send with empty text — the image itself is the content
        await sendMessage(chatId, '', 'image', result.url);
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
      <div className="pointer-events-none fixed bottom-0 right-[72px] z-[90] flex max-w-[100vw] items-end gap-3 p-4">
        <AnimatePresence mode="popLayout">
          {floatingChats.map((chat) => {
            const isOnline = chat.otherUser?.status === 'online';
            const isTyping = Boolean(typingByChat[chat.id]);
            const composerValue = composerValues[chat.id] || '';

            return (
              <motion.div
                key={chat.id}
                layout
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
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
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-black text-slate-900">
                        {chat.otherUser?.displayName || 'Carregando...'}
                      </p>
                      {/* Unread badge for open but unread messages */}
                      {(chat.unreadCount ?? 0) > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-black text-white shadow-sm animate-pulse">
                          {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                        </span>
                      )}
                    </div>
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
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>

      <div className="pointer-events-none fixed bottom-6 right-[80px] z-[80] hidden flex-col items-end gap-3 md:flex">
        <AnimatePresence mode="popLayout">
          {minimizedChats.map((chat) => {
            const isOnline = chat.otherUser?.status === 'online';
            const initials = chat.otherUser?.displayName
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || '?';

            return (
              <motion.button
                key={chat.id}
                layout
                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => restoreFloatingChat(chat.id)}
                className="pointer-events-auto group relative flex items-center gap-4 rounded-[22px] border border-white/40 bg-white/80 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-shadow hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)]"
              >
                {/* Avatar section */}
                <div className="relative flex-shrink-0">
                  <div className="relative h-12 w-12 overflow-hidden rounded-[16px] bg-gradient-to-br from-indigo-50 to-slate-100 shadow-sm ring-1 ring-black/5">
                    {chat.otherUser?.photoURL ? (
                      <img
                        src={chat.otherUser.photoURL}
                        alt={chat.otherUser.displayName}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-[14px] font-bold text-white">
                        {initials}
                      </div>
                    )}
                    
                    {/* Subtle inner glow */}
                    <div className="pointer-events-none absolute inset-0 rounded-[16px] ring-1 ring-inset ring-white/20" />
                  </div>

                  {/* Status indicator integrated into avatar */}
                  <div className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white shadow-sm">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ring-1 ring-black/5 ${
                        isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      } ${isOnline ? 'animate-[pulse_2s_infinite]' : ''}`}
                    />
                  </div>
                </div>

                {/* Text content with clear hierarchy */}
                <div className="flex flex-col pr-2 text-left">
                  <span className="text-[14.5px] font-bold tracking-tight text-slate-900">
                    {chat.otherUser?.displayName}
                  </span>
                  <span className="max-w-[150px] truncate text-[12px] font-medium text-slate-500/80">
                    {chat.lastMessage || 'Nova mensagem'}
                  </span>
                </div>

                {/* Unread badge (compact & refined) */}
                {chat.unreadCount > 0 && (
                  <div className="flex h-5.5 min-w-[22px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-black tracking-tighter text-white shadow-[0_2px_10px_rgba(79,70,229,0.3)]">
                    {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                  </div>
                )}
                
                {/* Premium Glow effect on hover */}
                <div className="absolute inset-0 -z-10 rounded-[22px] bg-indigo-400/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <NewMessageFloatingButton />
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
