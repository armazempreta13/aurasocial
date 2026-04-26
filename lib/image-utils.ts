import { auth } from '@/firebase';
import imageCompression from 'browser-image-compression';
import { storage } from '@/firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

export interface UploadResult {
  url: string;
  display_url: string;
  delete_url: string;
  width: number;
  height: number;
  mime: string;
  size: number;
}

export interface TextLayer {
  id: string;
  text: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  size: number;
  color: string;
  font: string;
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
    // Fallback: if the server uploader isn't configured, upload to Firebase Storage directly.
    // This keeps Foto/Vídeo working even without IMGBB_API_KEY, and respects Storage Rules (auth required).
    const message = String(data?.error || '');
    const shouldFallback =
      response.status === 500 &&
      (message.toLowerCase().includes('imgbb') ||
        message.toLowerCase().includes('api key') ||
        message.toLowerCase().includes('configuration'));

    if (shouldFallback) {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Unauthorized');

      let width = 0;
      let height = 0;
      try {
        const bmp = await createImageBitmap(compressedFile);
        width = bmp.width;
        height = bmp.height;
        bmp.close();
      } catch {
        // ignore
      }

      const safeName = (compressedFile.name || 'image.jpg').replace(/[^\w.\-]+/g, '_');
      const path = `uploads/${uid}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, compressedFile, { contentType: compressedFile.type || file.type });
      const url = await getDownloadURL(storageRef);

      return {
        url,
        display_url: url,
        delete_url: '',
        width,
        height,
        mime: compressedFile.type || file.type,
        size: compressedFile.size,
      };
    }

    throw new Error(data.error || 'Failed to upload image');
  }

  return data as UploadResult;
}

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false },
  filters = { brightness: 100, contrast: 100, saturate: 100 },
  textLayers: TextLayer[] = []
): Promise<Blob | null> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (error) => reject(error));
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  const rotRad = (rotation * Math.PI) / 180;

  // calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = {
    width: Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height),
    height: Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height),
  };

  // set canvas size to match the bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // translate canvas context to a central point and rotate around it
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);

  // draw rotated image
  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) return null;

  // Set the size of the cropped canvas
  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  // Draw the cropped image onto the new canvas
  croppedCtx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)`;
  
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Draw Text Layers
  textLayers.forEach((layer) => {
    const fontSize = (layer.size / 100) * croppedCanvas.width;
    croppedCtx.font = `bold ${fontSize}px ${layer.font || 'sans-serif'}`;
    croppedCtx.fillStyle = layer.color || '#white';
    croppedCtx.textAlign = 'center';
    croppedCtx.textBaseline = 'middle';
    
    // Convert percentage to pixels
    const x = (layer.x / 100) * croppedCanvas.width;
    const y = (layer.y / 100) * croppedCanvas.height;
    
    // Add a subtle shadow for better readability
    croppedCtx.shadowColor = 'rgba(0,0,0,0.5)';
    croppedCtx.shadowBlur = fontSize * 0.1;
    croppedCtx.fillText(layer.text, x, y);
    
    // Reset shadow
    croppedCtx.shadowColor = 'transparent';
    croppedCtx.shadowBlur = 0;
  });

  return new Promise((resolve) => {
    croppedCanvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg');
  });
}
