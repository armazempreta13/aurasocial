import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { getBotActivities, getBotMetrics } from '@/lib/bot-system/storage/bot-storage';
import { verifyFirebaseIdToken } from '@/lib/server/firebase-auth';

interface Params {
  params: Promise<{ botId: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await verifyFirebaseIdToken(req.headers);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { botId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));

    const [metrics, activities] = await Promise.all([
      getBotMetrics(botId),
      getBotActivities(botId, limit),
    ]);

    return NextResponse.json({
      metrics,
      activities,
      stats: {
        totalActivities: activities.length,
        successCount: activities.filter(a => a.success).length,
        errorCount: activities.filter(a => !a.success).length,
      },
    });
  } catch (error) {
    console.error('Error fetching bot metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bot metrics' },
      { status: 500 }
    );
  }
}
