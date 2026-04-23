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
    return NextResponse.json(bots);
  } catch (error) {
    console.error('Error listing bots:', error);
    return NextResponse.json(
      { error: 'Failed to list bots' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyFirebaseIdToken(req.headers);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const {
      name,
      enabled = true,
      postsPerDay = 2,
      commentsPerPost = 1,
      likePercentage = 30,
      imagePercentage = 50,
      delayBetweenActions = 5000,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Bot name is required' },
        { status: 400 }
      );
    }

    const bot = await BotManager.createBot({
      name,
      enabled,
      status: 'idle',
      postsPerDay: Math.max(1, Math.min(10, postsPerDay)),
      commentsPerPost: Math.max(0, Math.min(5, commentsPerPost)),
      likePercentage: Math.max(0, Math.min(100, likePercentage)),
      imagePercentage: Math.max(0, Math.min(100, imagePercentage)),
      delayBetweenActions: Math.max(1000, delayBetweenActions),
    });

    return NextResponse.json(bot, { status: 201 });
  } catch (error) {
    console.error('Error creating bot:', error);
    return NextResponse.json(
      { error: 'Failed to create bot' },
      { status: 500 }
    );
  }
}
