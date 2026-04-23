'use client';

const HASHTAG_REGEX = /#([\p{L}\p{N}_]{1,30})/gu;
const MAX_HASHTAGS_PER_POST = 10;

function normalizeHashtagTag(tag: string) {
  const cleanedTag = tag.trim().replace(/^#+/, '').toLowerCase();
  if (!cleanedTag) return null;
  return `#${cleanedTag}`;
}

export function extractHashtags(content: string) {
  const matches = content.matchAll(HASHTAG_REGEX);
  const uniqueTags = new Set<string>();

  for (const match of matches) {
    const normalizedTag = normalizeHashtagTag(match[1] || '');
    if (!normalizedTag) continue;

    uniqueTags.add(normalizedTag);
    if (uniqueTags.size >= MAX_HASHTAGS_PER_POST) break;
  }

  return Array.from(uniqueTags);
}

export function rankTrendingHashtags(posts: any[]) {
  const scores = new Map<string, number>();

  posts.forEach((post, index) => {
    const fromField = Array.isArray(post?.hashtags) ? post.hashtags : [];
    const fromContent = typeof post?.content === 'string' ? extractHashtags(post.content) : [];
    const hashtags = (fromField.length > 0 ? fromField : fromContent) as string[];
    if (hashtags.length === 0) return;

    const engagementScore =
      1 +
      Math.min(post.likesCount || 0, 20) * 0.25 +
      Math.min(post.commentsCount || 0, 20) * 0.4 +
      Math.min(post.sharesCount || 0, 20) * 0.5;
    const recencyScore = Math.max(1, 5 - index * 0.08);

    // Deduplicate per-post so a duplicated hashtags array doesn't inflate scoring.
    Array.from(new Set(hashtags)).forEach((tag: string) => {
      const normalizedTag = normalizeHashtagTag(tag);
      if (!normalizedTag) return;

      scores.set(normalizedTag, (scores.get(normalizedTag) || 0) + engagementScore + recencyScore);
    });
  });

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, score]) => ({
      tag,
      score: Math.round(score * 10) / 10,
    }));
}
