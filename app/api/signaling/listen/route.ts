import { NextRequest, NextResponse } from 'next/server';
import { signalingStore, SignalingEvent } from '@/lib/signaling';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) return new Response('Unauthorized', { status: 401 });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      const unsubscribe = signalingStore.register(userId, (event: SignalingEvent) => {
        const payload = JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      });

      // Maintain connection
      const intervalId = setInterval(() => {
        controller.enqueue(encoder.encode(`: keep-alive\n\n`));
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        unsubscribe();
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
