// ─── IN-MEMORY DATABASE ───────────────────────────────────────────
// Cloudflare Workers have no filesystem. This module uses an in-memory
// store so API routes don't crash in production. The real data layer
// for posts, profiles, and communities uses Firebase Firestore directly
// from the client. This in-memory DB is only for dev-time chat/signaling.

interface DB {
  users: Record<string, any>;
  chats: Record<string, any>;
  messages: any[];
  signals: any[];
  webrtc_signals: any[];
}

const db: DB = {
  users: {},
  chats: {},
  messages: [],
  signals: [],
  webrtc_signals: [],
};

export function readDB(): DB {
  return db;
}

export function writeDB(_data: DB) {
  // No-op: data is already mutated in-place via the reference
}

export function saveUser(user: any) {
  db.users[user.uid] = { ...user, lastSeen: Date.now() };
  return user;
}

export function getAllUsers() {
  return Object.values(db.users);
}

export function getChats(userId: string) {
  return Object.values(db.chats)
    .filter((chat: any) => chat.participants?.includes(userId))
    .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function ensureChat(participants: string[]) {
  const sortedParticipants = [...participants].sort();
  const chatId = sortedParticipants.join('__');
  if (!db.chats[chatId]) {
    db.chats[chatId] = {
      id: chatId,
      participants: sortedParticipants,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
  }
  return db.chats[chatId];
}

export function addMessage(chatId: string, senderId: string, text: string, type: string = 'text', url?: string) {
  const message = {
    id: Math.random().toString(36).substr(2, 9),
    chatId,
    senderId,
    text,
    type,
    attachmentUrl: url,
    createdAt: Date.now(),
    read: false,
  };
  db.messages.push(message);
  if (db.chats[chatId]) {
    db.chats[chatId].lastMessage = text;
    db.chats[chatId].lastMessageTime = message.createdAt;
    db.chats[chatId].updatedAt = message.createdAt;
  }
  return message;
}

export function getMessages(chatId: string) {
  return db.messages.filter((msg: any) => msg.chatId === chatId);
}

let signalIdCounter = 0;
export function addSignal(toId: string, fromId: string, type: string, payload: any) {
  signalIdCounter++;
  db.signals.push({ 
    id: `${Date.now()}-${signalIdCounter}`, 
    toId, 
    fromId, 
    type, 
    payload, 
    consumed: false 
  });
  if (db.signals.length > 200) db.signals = db.signals.slice(-100);
}

export function getSignals(userId: string) {
  const userSignals = db.signals.filter((s: any) => s.toId === userId && !s.consumed);
  db.signals = db.signals.map((s: any) =>
    s.toId === userId ? { ...s, consumed: true } : s
  );
  return userSignals;
}

export function addWebRTCSignal(toId: string, fromId: string, type: string, payload: any) {
  const signal = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    toId,
    fromId,
    type,
    payload,
    createdAt: Date.now(),
    consumed: false,
  };
  db.webrtc_signals.push(signal);
  if (db.webrtc_signals.length > 500) {
    db.webrtc_signals = db.webrtc_signals.slice(-300);
  }
  return signal;
}

export function getWebRTCSignals(userId: string) {
  const cutoff = Date.now() - 60_000;
  const userSignals = db.webrtc_signals.filter(
    (s: any) => s.toId === userId && !s.consumed && s.createdAt > cutoff
  );
  db.webrtc_signals = db.webrtc_signals.map((s: any) =>
    s.toId === userId ? { ...s, consumed: true } : s
  );
  return userSignals;
}
