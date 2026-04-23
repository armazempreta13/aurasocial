import { db } from '@/firebase';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { BotConfig, BotStatus } from '../models/bot.types';
import { BotEngine, createBotUser } from './bot-engine';
import { saveBotConfig, getBotConfig, getAllBotConfigs, deleteBotConfig } from '../storage/bot-storage';

const ACTIVE_BOTS = new Map<string, { interval: NodeJS.Timeout; engine: BotEngine }>();

export class BotManager {
  static async createBot(config: Omit<BotConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<BotConfig> {
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create bot user in Firebase
    const botUserData = await createBotUser();
    const userRef = await addDoc(collection(db, 'users'), {
      displayName: botUserData.displayName,
      username: botUserData.username,
      photoURL: botUserData.photoURL,
      bio: botUserData.bio,
      email: `${botUserData.username}@aura.bot`,
      isBot: true,
      botId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const botConfig: BotConfig = {
      id: botId,
      name: config.name,
      enabled: config.enabled ?? true,
      status: 'idle',
      postsPerDay: config.postsPerDay ?? 2,
      commentsPerPost: config.commentsPerPost ?? 1,
      likePercentage: config.likePercentage ?? 30,
      imagePercentage: config.imagePercentage ?? 50,
      delayBetweenActions: config.delayBetweenActions ?? 5000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveBotConfig(botConfig);

    return botConfig;
  }

  static async startBot(botId: string): Promise<void> {
    const config = await getBotConfig(botId);
    if (!config) throw new Error(`Bot ${botId} not found`);

    if (ACTIVE_BOTS.has(botId)) {
      console.warn(`Bot ${botId} is already running`);
      return;
    }

    // Get bot user info
    const botUserQuery = query(
      collection(db, 'users'),
      where('botId', '==', botId),
      limit(1)
    );
    const botUserSnapshot = await getDocs(botUserQuery);

    if (botUserSnapshot.empty) {
      throw new Error(`Bot user for ${botId} not found`);
    }

    const botUserDoc = botUserSnapshot.docs[0];
    const botUserData = botUserDoc.data();

    const engine = new BotEngine({
      botId,
      botDisplayName: botUserData.displayName,
      botUserId: botUserDoc.id,
      photoURL: botUserData.photoURL,
    });

    // Update config status
    await updateDoc(doc(db, 'system/bots/configurations', botId), {
      status: 'running',
    });

    // Start daily task
    const interval = setInterval(async () => {
      try {
        await engine.runDailyActivity();
      } catch (error) {
        console.error(`Error running bot ${botId}:`, error);
      }
    }, 24 * 60 * 60 * 1000); // Run daily

    // Store interval reference
    ACTIVE_BOTS.set(botId, { interval, engine });
  }

  static async stopBot(botId: string): Promise<void> {
    const bot = ACTIVE_BOTS.get(botId);
    if (!bot) return;

    clearInterval(bot.interval);
    ACTIVE_BOTS.delete(botId);

    // Update config status
    await updateDoc(doc(db, 'system/bots/configurations', botId), {
      status: 'stopped',
    });
  }

  static async pauseBot(botId: string): Promise<void> {
    await this.stopBot(botId);
    await updateDoc(doc(db, 'system/bots/configurations', botId), {
      status: 'paused',
    });
  }

  static async updateBotConfig(botId: string, updates: Partial<BotConfig>): Promise<void> {
    const config = await getBotConfig(botId);
    if (!config) throw new Error(`Bot ${botId} not found`);

    const updated = { ...config, ...updates, updatedAt: Date.now() };
    await saveBotConfig(updated);
  }

  static async deleteBot(botId: string): Promise<void> {
    // Stop if running
    await this.stopBot(botId);

    // Delete config
    await deleteBotConfig(botId);

    // Delete bot user
    const botUserQuery = query(
      collection(db, 'users'),
      where('botId', '==', botId),
      limit(1)
    );
    const botUserSnapshot = await getDocs(botUserQuery);

    if (!botUserSnapshot.empty) {
      await deleteDoc(botUserSnapshot.docs[0].ref);
    }
  }

  static async listAllBots(): Promise<BotConfig[]> {
    return getAllBotConfigs();
  }

  static getActiveBots(): string[] {
    return Array.from(ACTIVE_BOTS.keys());
  }

  static isBotRunning(botId: string): boolean {
    return ACTIVE_BOTS.has(botId);
  }
}
