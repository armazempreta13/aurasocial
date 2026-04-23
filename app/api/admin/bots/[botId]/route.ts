import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { BotManager } from '@/lib/bot-system/core/bot-manager';
import { getBotConfig } from '@/lib/bot-system/storage/bot-storage';
import { verifyFirebaseIdToken } from '@/lib/server/firebase-auth';

interface RouteContext {
  params: Promise<{ botId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyFirebaseIdToken(req.headers);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { botId } = await params;
    const bot = await getBotConfig(botId);

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    return NextResponse.json(bot);
  } catch (error) {
    console.error('Error fetching bot:', error);
    return NextResponse.json({ error: 'Failed to fetch bot' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyFirebaseIdToken(req.headers);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { botId } = await params;
    const body = await req.json();
    const { action, ...updates } = body;

    if (action === 'start') {
      await BotManager.startBot(botId);
      return NextResponse.json({ message: 'Bot started' });
    }

    if (action === 'stop') {
      await BotManager.stopBot(botId);
      return NextResponse.json({ message: 'Bot stopped' });
    }

    if (action === 'pause') {
      await BotManager.pauseBot(botId);
      return NextResponse.json({ message: 'Bot paused' });
    }

    if (action === 'update') {
      await BotManager.updateBotConfig(botId, updates);
      return NextResponse.json({ message: 'Bot updated' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating bot:', error);
    return NextResponse.json(
      { error: 'Failed to update bot' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await verifyFirebaseIdToken(req.headers);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { botId } = await params;
    await BotManager.deleteBot(botId);

    return NextResponse.json({ message: 'Bot deleted' });
  } catch (error) {
    console.error('Error deleting bot:', error);
    return NextResponse.json({ error: 'Failed to delete bot' }, { status: 500 });
  }
}
