import { auth } from '@/firebase';
import imageCompression from 'browser-image-compression';

export interface UploadResult {
  url: string;
  display_url: string;
  delete_url: string;
  width: number;
  height: number;
  mime: string;
  size: number;
}

export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.4, // Target 400KB
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: 'image/jpeg',
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Compression error:', error);
    return file; // Fallback to original
  }
}

export async function uploadImage(file: File): Promise<UploadResult> {
  // 1. Validate
  if (!file.type.startsWith('image/')) {
    throw new Error('Invalid file type. Please upload an image.');
  }

  if (file.size > 32 * 1024 * 1024) {
    throw new Error('File too large. Maximum size is 32MB.');
  }

  // 2. Compress
  const compressedFile = await compressImage(file);

  // 3. Upload to our secure API
  const formData = new FormData();
  formData.append('image', compressedFile);

  const token = await auth.currentUser?.getIdToken();

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to upload image');
  }

  return data as UploadResult;
}
