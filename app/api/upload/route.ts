import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    // On Cloudflare, we don't have a filesystem, so we must rely on external services like ImgBB
    const formData = await request.formData();
    const image = formData.get('image');

    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const apiKey = process.env.IMGBB_API_KEY;
    
    if (!apiKey) {
      console.error('IMGBB_API_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error. IMGBB_API_KEY is required for production uploads.' },
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
