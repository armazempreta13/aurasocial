'use client';

type CompressionOptions = {
  maxWidth?: number;
  maxHeight?: number;
  fps?: number;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
};

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

async function loadVideo(file: File) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => resolve();
    const onError = () => reject(new Error('Falha ao ler o vídeo.'));
    video.addEventListener('loadedmetadata', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });
  });

  return { video, url };
}

export async function compressVideoSuper(file: File, opts: CompressionOptions = {}) {
  const mimeType = pickMimeType();
  if (!mimeType) throw new Error('Seu navegador não suporta compressão de vídeo.');

  const {
    maxWidth = 720,
    maxHeight = 720,
    fps = 30,
    videoBitsPerSecond = 650_000,
    audioBitsPerSecond = 64_000,
  } = opts;

  const { video, url } = await loadVideo(file);

  try {
    const srcW = Math.max(1, Number(video.videoWidth || 1));
    const srcH = Math.max(1, Number(video.videoHeight || 1));
    const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
    const targetW = Math.max(2, Math.floor(srcW * scale));
    const targetH = Math.max(2, Math.floor(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Falha ao inicializar o canvas.');

    // Video stream (scaled) + audio track (if available)
    const canvasStream = canvas.captureStream(fps);
    let audioTracks: MediaStreamTrack[] = [];
    try {
      const mediaStream = (video as any).captureStream?.();
      if (mediaStream?.getAudioTracks) {
        audioTracks = mediaStream.getAudioTracks();
      }
    } catch {
      audioTracks = [];
    }

    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioTracks,
    ]);

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond,
      audioBitsPerSecond,
    });

    const chunks: BlobPart[] = [];
    recorder.addEventListener('dataavailable', (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    });

    const done = new Promise<Blob>((resolve, reject) => {
      recorder.addEventListener('stop', () => resolve(new Blob(chunks, { type: mimeType.split(';')[0] })), { once: true });
      recorder.addEventListener('error', () => reject(new Error('Falha ao comprimir o vídeo.')), { once: true });
    });

    const drawFrame = () => {
      if (video.paused || video.ended) return;
      ctx.drawImage(video, 0, 0, targetW, targetH);
      requestAnimationFrame(drawFrame);
    };

    video.currentTime = 0;
    await video.play();
    recorder.start(200);
    requestAnimationFrame(drawFrame);

    await new Promise<void>((resolve) => {
      video.addEventListener('ended', () => resolve(), { once: true });
    });

    recorder.stop();
    const blob = await done;

    const outName = file.name.replace(/\.[^.]+$/, '') + '.webm';
    return new File([blob], outName, { type: blob.type || 'video/webm' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

