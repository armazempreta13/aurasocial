export type GiphyGif = {
  id: string;
  title: string;
  previewUrl: string;
  stillUrl: string;
  fullUrl: string;
};

type GiphyApiGif = {
  id: string;
  title?: string;
  images?: Record<string, { url?: string } | undefined> | undefined;
};

function pickUrl(images: GiphyApiGif['images'], key: string): string | null {
  const url = images?.[key]?.url;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

function normalizeGif(gif: GiphyApiGif): GiphyGif | null {
  const images = gif.images;
  const previewUrl =
    pickUrl(images, 'fixed_width_downsampled') ||
    pickUrl(images, 'fixed_width') ||
    pickUrl(images, 'downsized') ||
    pickUrl(images, 'preview_gif');
  const stillUrl =
    pickUrl(images, 'fixed_width_still') ||
    pickUrl(images, 'original_still') ||
    previewUrl;
  const fullUrl =
    pickUrl(images, 'original') ||
    pickUrl(images, 'downsized_large') ||
    pickUrl(images, 'downsized') ||
    previewUrl;

  if (!previewUrl || !stillUrl || !fullUrl) return null;

  return {
    id: gif.id,
    title: gif.title || 'GIF',
    previewUrl,
    stillUrl,
    fullUrl,
  };
}

function getGiphyKey(): string {
  const key = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
  if (typeof key === 'string' && key.trim().length > 0) return key.trim();
  return '';
}

async function fetchGiphy(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<GiphyGif[]> {
  const apiKey = getGiphyKey();
  if (!apiKey) return [];

  const url = new URL(`https://api.giphy.com/v1/${path}`);
  url.searchParams.set('api_key', apiKey);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) return [];

  const json = (await res.json()) as { data?: GiphyApiGif[] };
  const data = Array.isArray(json.data) ? json.data : [];
  return data.map(normalizeGif).filter(Boolean) as GiphyGif[];
}

export async function getTrendingGifs(opts?: { limit?: number; offset?: number; signal?: AbortSignal }) {
  const limit = String(opts?.limit ?? 18);
  const offset = String(opts?.offset ?? 0);
  return fetchGiphy(
    'gifs/trending',
    { limit, offset, rating: 'g', bundle: 'messaging_non_clips' },
    opts?.signal,
  );
}

export async function searchGifs(
  query: string,
  opts?: { limit?: number; offset?: number; signal?: AbortSignal },
) {
  const q = query.trim();
  if (!q) return [];
  const limit = String(opts?.limit ?? 18);
  const offset = String(opts?.offset ?? 0);
  return fetchGiphy(
    'gifs/search',
    { q, limit, offset, rating: 'g', lang: 'pt', bundle: 'messaging_non_clips' },
    opts?.signal,
  );
}

