'use client';

import { auth, storage } from '@/firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { uploadImage, UploadResult } from '@/lib/image-utils';
import { compressVideoSuper } from '@/lib/video-compress';

export type MediaKind = 'image' | 'video';

export type MediaUploadResult = UploadResult & {
  kind: MediaKind;
};

function safeFilename(name: string) {
  return (name || 'file').replace(/[^\w.\-]+/g, '_');
}

export async function uploadMedia(file: File): Promise<MediaUploadResult> {
  if (file.type.startsWith('image/')) {
    const result = await uploadImage(file);
    return { ...result, kind: 'image' };
  }

  if (!file.type.startsWith('video/')) {
    throw new Error('Tipo de arquivo inválido. Envie uma foto ou vídeo.');
  }

  // Upper bound to avoid catastrophic client-side work.
  if (file.size > 250 * 1024 * 1024) {
    throw new Error('Vídeo muito grande. Tamanho máximo: 80MB.');
  }

  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Unauthorized');

  const path = `uploads/${uid}/videos/${Date.now()}_${safeFilename(file.name)}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);

  return {
    kind: 'video',
    url,
    display_url: url,
    delete_url: '',
    width: 0,
    height: 0,
    mime: file.type,
    size: file.size,
  };
}

