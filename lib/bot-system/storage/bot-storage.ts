import { db } from '@/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { BotConfig, BotActivity, BotMetrics, BotState } from '../models/bot.types';

const BOTS_COLLECTION = 'system/bots/configurations';
const ACTIVITIES_COLLECTION = 'system/bots/activities';
const METRICS_COLLECTION = 'system/bots/metrics';

export async function saveBotConfig(config: BotConfig): Promise<void> {
  const botRef = doc(db, BOTS_COLLECTION, config.id);
  await setDoc(botRef, {
    ...config,
    updatedAt: serverTimestamp(),
  });
}

export async function getBotConfig(botId: string): Promise<BotConfig | null> {
  const botRef = doc(db, BOTS_COLLECTION, botId);
  const snap = await getDoc(botRef);
  return snap.exists() ? (snap.data() as BotConfig) : null;
}

export async function getAllBotConfigs(): Promise<BotConfig[]> {
  const colRef = collection(db, BOTS_COLLECTION);
  const snap = await getDocs(colRef);
  return snap.docs.map(doc => doc.data() as BotConfig);
}

export async function updateBotConfig(botId: string, updates: Partial<BotConfig>): Promise<void> {
  const botRef = doc(db, BOTS_COLLECTION, botId);
  await updateDoc(botRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBotConfig(botId: string): Promise<void> {
  const botRef = doc(db, BOTS_COLLECTION, botId);
  await deleteDoc(botRef);
}

export async function recordActivity(activity: BotActivity): Promise<void> {
  const activityRef = doc(collection(db, ACTIVITIES_COLLECTION));
  await setDoc(activityRef, {
    ...activity,
    timestamp: serverTimestamp(),
  });
}

export async function getBotActivities(botId: string, limit = 100): Promise<BotActivity[]> {
  const colRef = collection(db, ACTIVITIES_COLLECTION);
  const q = query(colRef, where('botId', '==', botId));
  const snap = await getDocs(q);
  return snap.docs
    .map(doc => doc.data() as BotActivity)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export async function getBotMetrics(botId: string): Promise<BotMetrics | null> {
  const metricsRef = doc(db, METRICS_COLLECTION, botId);
  const snap = await getDoc(metricsRef);
  return snap.exists() ? (snap.data() as BotMetrics) : null;
}

export async function updateBotMetrics(
  botId: string,
  updates: Partial<BotMetrics>
): Promise<void> {
  const metricsRef = doc(db, METRICS_COLLECTION, botId);
  const existing = await getDoc(metricsRef);
  
  if (!existing.exists()) {
    await setDoc(metricsRef, {
      totalPosts: 0,
      totalComments: 0,
      totalLikes: 0,
      totalShares: 0,
      totalFollows: 0,
      activeDays: 0,
      lastActivityAt: Date.now(),
      createdAt: Date.now(),
      ...updates,
    });
  } else {
    await updateDoc(metricsRef, updates);
  }
}

export async function incrementBotMetric(
  botId: string,
  metric: keyof Omit<BotMetrics, 'lastActivityAt' | 'createdAt'>,
  amount = 1
): Promise<void> {
  const metricsRef = doc(db, METRICS_COLLECTION, botId);
  await updateDoc(metricsRef, {
    [metric]: increment(amount),
    lastActivityAt: serverTimestamp(),
  });
}
