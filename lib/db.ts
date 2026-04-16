import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

function ensureDB() {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ 
      users: {}, 
      chats: {}, 
      messages: [],
      signals: [],
      webrtc_signals: []
    }, null, 2));
  }
}

export function readDB() {
  ensureDB();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    // Ensure all collections exist
    parsed.users = parsed.users || {};
    parsed.chats = parsed.chats || {};
    parsed.messages = parsed.messages || [];
    parsed.signals = parsed.signals || [];
    parsed.webrtc_signals = parsed.webrtc_signals || [];
    return parsed;
  } catch (e) {
    console.error('[DB] Read error:', e);
    return { users: {}, chats: {}, messages: [], signals: [], webrtc_signals: [] };
  }
}

export function writeDB(data: any) {
  ensureDB();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[DB] Write error:', e);
  }
}

export function saveUser(user: any) {
  const db = readDB();
  db.users[user.uid] = { ...user, lastSeen: Date.now() };
  writeDB(db);
  return user;
}

export function getAllUsers() {
  const db = readDB();
  return Object.values(db.users || {});
}

export function getChats(userId: string) {
  const db = readDB();
  return Object.values(db.chats || {}).filter((chat: any) => 
    chat.participants && chat.participants.includes(userId)
  ).sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function ensureChat(participants: string[]) {
  const db = readDB();
  const sortedParticipants = [...participants].sort();
  const chatId = sortedParticipants.join('__');
  db.chats = db.chats || {};
  if (!db.chats[chatId]) {
    db.chats[chatId] = { id: chatId, participants: sortedParticipants, updatedAt: Date.now(), createdAt: Date.now() };
    writeDB(db);
  }
  return db.chats[chatId];
}

export function addMessage(chatId: string, senderId: string, text: string, type: string = 'text', url?: string) {
  const db = readDB();
  const message = { 
    id: Math.random().toString(36).substr(2, 9), 
    chatId, 
    senderId, 
    text, 
    type, 
    attachmentUrl: url,
    createdAt: Date.now(),
    read: false 
  };
  db.messages.push(message);
  if (db.chats[chatId]) {
    db.chats[chatId].lastMessage = text;
    db.chats[chatId].lastMessageTime = message.createdAt;
    db.chats[chatId].updatedAt = message.createdAt;
  }
  writeDB(db);
  return message;
}

export function getMessages(chatId: string) {
  const db = readDB();
  return (db.messages || []).filter((msg: any) => msg.chatId === chatId);
}

export function addSignal(toId: string, fromId: string, type: string, payload: any) {
  const db = readDB();
  db.signals.push({ id: Date.now(), toId, fromId, type, payload, consumed: false });
  if (db.signals.length > 200) db.signals = db.signals.slice(-100);
  writeDB(db);
}

export function getSignals(userId: string) {
  const db = readDB();
  const userSignals = db.signals.filter((s: any) => s.toId === userId && !s.consumed);
  db.signals = db.signals.map((s: any) => s.toId === userId ? { ...s, consumed: true } : s);
  writeDB(db);
  return userSignals;
}

// ─── WebRTC Signaling (Dedicated, separate from chat signals) ───────────────

export function addWebRTCSignal(toId: string, fromId: string, type: string, payload: any) {
  const db = readDB();
  const signal = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    toId,
    fromId,
    type, // 'call-offer' | 'call-answer' | 'ice-candidate' | 'call-reject' | 'call-hang-up' | 'call-busy'
    payload,
    createdAt: Date.now(),
    consumed: false,
  };
  db.webrtc_signals.push(signal);
  // Keep last 500 WebRTC signals only (they are very transient)
  if (db.webrtc_signals.length > 500) {
    db.webrtc_signals = db.webrtc_signals.slice(-300);
  }
  writeDB(db);
  return signal;
}

export function getWebRTCSignals(userId: string) {
  const db = readDB();
  // Include signals from last 60s only (WebRTC signals are time-sensitive)
  const cutoff = Date.now() - 60_000;
  const userSignals = db.webrtc_signals.filter(
    (s: any) => s.toId === userId && !s.consumed && s.createdAt > cutoff
  );
  // Mark as consumed
  db.webrtc_signals = db.webrtc_signals.map((s: any) =>
    s.toId === userId ? { ...s, consumed: true } : s
  );
  writeDB(db);
  return userSignals;
}
