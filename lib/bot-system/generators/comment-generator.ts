import { GeneratedComment } from '../models/bot.types';
import { COMMENT_TEMPLATES } from './templates';

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateComment(postId: string, authorId: string): GeneratedComment {
  const categories = Object.keys(COMMENT_TEMPLATES) as Array<keyof typeof COMMENT_TEMPLATES>;
  const category = getRandomItem(categories);
  const templates = COMMENT_TEMPLATES[category];
  
  const content = getRandomItem(templates);

  return {
    content,
    postId,
    authorId,
  };
}

export function generateReplyComment(
  postId: string,
  authorId: string,
  parentCommentId: string
): GeneratedComment {
  const comment = generateComment(postId, authorId);
  comment.parentCommentId = parentCommentId;
  return comment;
}

export function shouldGenerateComment(): boolean {
  // 60% chance of generating a comment
  return Math.random() > 0.4;
}

export function generateCommentCount(): number {
  // Generate between 1-5 comments with weighted distribution
  const rand = Math.random();
  if (rand < 0.4) return 1;
  if (rand < 0.65) return 2;
  if (rand < 0.85) return 3;
  if (rand < 0.95) return 4;
  return 5;
}
