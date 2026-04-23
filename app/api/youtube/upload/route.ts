import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';

// Ensure required env variables are present
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;

export async function POST(req: NextRequest) {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      console.error('YouTube API credentials missing in environment variables');
      return NextResponse.json({ error: 'YouTube configuration error' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.mov')) {
      return NextResponse.json({ error: 'Invalid file type. Supported: mp4, webm, mov' }, { status: 400 });
    }

    console.log(`Starting YouTube upload: ${file.name} (${file.size} bytes)`);

    // Initialize YouTube API
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN,
    });

    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client,
    });

    // Convert File to Readable stream for upload
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: `Content Asset - ${Math.random().toString(36).substring(7)}`,
          description: 'Processed media asset',
          categoryId: '22', // People & Blogs
        },
        status: {
          privacyStatus: 'unlisted',
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: stream,
      },
    });

    const videoId = response.data.id;

    if (!videoId) {
      throw new Error('Failed to get video ID from YouTube response');
    }

    console.log(`YouTube upload successful: ${videoId}`);

    return NextResponse.json({
      videoId,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      status: 'ready'
    });

  } catch (error: any) {
    console.error('YouTube upload error:', error.response?.data || error.message || error);
    return NextResponse.json({ 
      error: 'Upload to YouTube failed', 
      details: error.response?.data?.error?.message || error.message 
    }, { status: 500 });
  }
}

// Next.js Config to handle large file uploads
export const config = {
  api: {
    bodyParser: false, // We use formData() which handles the stream
    responseLimit: false,
  },
};
