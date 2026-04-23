import { GeneratedPost } from '../models/bot.types';
import { POST_TEMPLATES, HASHTAGS, INTERESTS } from './templates';

const IMAGE_URLS = [
  'https://picsum.photos/600/400?random=',
  'https://unsplash.com/napi/photos/random?w=600&h=400&q=80',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function generatePost(): GeneratedPost {
  const categories = Object.keys(POST_TEMPLATES) as Array<keyof typeof POST_TEMPLATES>;
  const category = getRandomItem(categories);
  const templates = POST_TEMPLATES[category];
  
  let content = getRandomItem(templates);
  
  // Substituir placeholders genéricos
  const interest = getRandomItem(INTERESTS);
  content = content
    .replace('[feature]', 'essa feature incrível')
    .replace('[tool]', interest)
    .replace('[Lang]', 'TypeScript')
    .replace('[project]', 'um projeto open source')
    .replace('[topic]', interest)
    .replace('[achievement]', 'meu objetivo')
    .replace('[thing]', interest)
    .replace(/\[.*?\]/g, 'algo')
    .replace(/\{.*?\}/g, 'feature');

  // Adicionar hashtags aleatórias (30% de chance)
  const hashtags: string[] = [];
  if (Math.random() > 0.7) {
    hashtags.push(...getRandomItems(HASHTAGS, Math.floor(Math.random() * 3) + 1));
    content += ' ' + hashtags.join(' ');
  }

  // Adicionar imagem (50% de chance)
  let imageUrl: string | undefined;
  if (Math.random() > 0.5) {
    const picSumUrl = IMAGE_URLS[0] + Math.floor(Math.random() * 1000000);
    imageUrl = picSumUrl;
  }

  // Adicionar mencões ocasionalmente (20% de chance)
  if (Math.random() > 0.8 && content.length < 200) {
    const mentions = getRandomItems(
      ['@developer', '@designer', '@startup', '@tech', '@innovation'],
      1
    );
    content += ' ' + mentions.join(' ');
  }

  return {
    content,
    imageUrl,
    hashtags,
    mentions: [],
    visibility: 'public',
  };
}

export function generatePostForCommunity(communityId: string, interest?: string): GeneratedPost {
  const post = generatePost();
  post.communityId = communityId;
  
  if (interest) {
    post.content += ` (About ${interest})`;
  }
  
  return post;
}

export function generateRandomPostContent(): string {
  const category = getRandomItem(Object.keys(POST_TEMPLATES) as Array<keyof typeof POST_TEMPLATES>);
  const templates = POST_TEMPLATES[category];
  return getRandomItem(templates);
}
