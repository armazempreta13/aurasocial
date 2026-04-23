import { NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/server/firebase-auth';

export async function POST(request: Request) {
  try {
    const auth = await verifyFirebaseIdToken(request.headers);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const image = formData.get('image');

    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const apiKey = process.env.IMGBB_API_KEY;
    
    if (!apiKey || apiKey === 'YOUR_IMGBB_API_KEY') {
      console.error('IMGBB_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Server configuration error. ImgBB API Key is missing.' },
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
