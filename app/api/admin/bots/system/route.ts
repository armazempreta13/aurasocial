import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { BotManager } from '@/lib/bot-system/core/bot-manager';
import { verifyFirebaseIdToken } from '@/lib/server/firebase-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyFirebaseIdToken(req.headers);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const bots = await BotManager.listAllBots();
    const activeBots = BotManager.getActiveBots();

    return NextResponse.json({
      bots,
      activeBots,
      stats: {
        total: bots.length,
        active: activeBots.length,
        running: bots.filter(b => b.status === 'running').length,
        paused: bots.filter(b => b.status === 'paused').length,
      },
    });
  } catch (error) {
    console.error('Error fetching bot system status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bot system status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyFirebaseIdToken(req.headers);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { action } = await req.json();

    if (action === 'start-all') {
      const bots = await BotManager.listAllBots();
      for (const bot of bots) {
        if (bot.enabled && !BotManager.isBotRunning(bot.id)) {
          await BotManager.startBot(bot.id);
        }
      }
      return NextResponse.json({ message: 'All bots started' });
    }

    if (action === 'stop-all') {
      const activeBots = BotManager.getActiveBots();
      for (const botId of activeBots) {
        await BotManager.stopBot(botId);
      }
      return NextResponse.json({ message: 'All bots stopped' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing bot system:', error);
    return NextResponse.json(
      { error: 'Failed to manage bot system' },
      { status: 500 }
    );
  }
}
