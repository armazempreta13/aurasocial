'use client';

export const OFFICIAL_COMMUNITY_NAMES = ['Aura Social'] as const;

export function normalizeCommunityName(name: string) {
  return (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function isOfficialCommunity(community: any) {
  if (!community) return false;
  if (community.isOfficial === true) return true;
  const normalized = normalizeCommunityName(String(community.name || ''));
  return OFFICIAL_COMMUNITY_NAMES.some((n) => normalizeCommunityName(n) === normalized);
}

export function isAuraSocialCommunity(community: any) {
  if (!community) return false;
  const normalized = normalizeCommunityName(String(community.name || ''));
  return normalizeCommunityName('Aura Social') === normalized;
}
