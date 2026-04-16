import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

function isLocalRequest(request: Request) {
  const { hostname } = new URL(request.url);
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const localRequest = isLocalRequest(request);

    if (!authHeader && !localRequest) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const formData = await request.formData();
    const image = formData.get('image');

    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey && localRequest) {
      const bytes = await image.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const extension = image.name.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'jpg';
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');

      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, fileName), buffer);

      return NextResponse.json({
        url: `/uploads/${fileName}`,
        display_url: `/uploads/${fileName}`,
        delete_url: '',
        width: 0,
        height: 0,
        mime: image.type || 'image/jpeg',
        size: image.size,
      });
    }

    if (!apiKey) {
      console.error('IMGBB_API_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error. Set IMGBB_API_KEY or run locally for fallback uploads.' },
        { status: 500 }
      );
    }

    const imgbbFormData = new FormData();
    imgbbFormData.append('image', image);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: imgbbFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('ImgBB API error:', data);
      return NextResponse.json({ 
        error: data.error?.message || 'Failed to upload to ImgBB' 
      }, { status: response.status });
    }

    return NextResponse.json(data.data);
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
