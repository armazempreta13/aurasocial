import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/server/firebase-auth';
import { putR2Object } from '@/lib/server/r2';

export const runtime = 'nodejs';

function randomId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyFirebaseIdToken(req.headers);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (!file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    // Hard limit to prevent huge uploads via the API route.
    const maxBytes = 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'Video too large after compression (max 25MB).' }, { status: 413 });
    }

    const ext = file.name.toLowerCase().endsWith('.webm') ? 'webm' : (file.name.split('.').pop() || 'webm');
    const key = `videos/${auth.uid}/${Date.now()}_${randomId()}.${ext}`;
    const buf = new Uint8Array(await file.arrayBuffer());
    const { url } = await putR2Object({
      key,
      body: buf,
      contentType: file.type || 'video/webm',
    });

    return NextResponse.json({
      url,
      key,
      size: file.size,
      mime: file.type || 'video/webm',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 });
  }
}

