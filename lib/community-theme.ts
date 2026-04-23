export const COMMUNITY_THEME_PRESETS = [
  '#7F77DD',
  '#4F7CFF',
  '#1FA37A',
  '#FF7A59',
  '#F056B3',
  '#F6B93B',
  '#0F172A',
  '#7C3AED',
] as const;

export const DEFAULT_COMMUNITY_THEME = COMMUNITY_THEME_PRESETS[0];

export function normalizeThemeColor(value?: string | null) {
  if (!value) return DEFAULT_COMMUNITY_THEME;
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return DEFAULT_COMMUNITY_THEME;
}

export function hexToRgba(hex: string, alpha: number) {
  const normalized = normalizeThemeColor(hex).replace('#', '');
  const bigint = Number.parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildCommunityCoverStyle(themeColor?: string | null) {
  const color = normalizeThemeColor(themeColor);
  return {
    background: `linear-gradient(135deg, ${hexToRgba(color, 0.95)} 0%, ${hexToRgba(
      color,
      0.45,
    )} 55%, rgba(255,255,255,0.9) 100%)`,
  };
}
