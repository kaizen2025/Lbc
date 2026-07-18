/**
 * Thème sombre par défaut — référence visuelle Collectr (fond quasi noir,
 * accent turquoise). Centralisé ici pour permettre un thème clair plus tard.
 */
export const colors = {
  background: "#0B0F0E",
  surface: "#151A19",
  surfaceBorder: "#232A29",
  text: "#F4F6F5",
  textMuted: "#8A9490",
  accent: "#2DD4BF",
  accentDark: "#14B8A6",
  positive: "#34D399",
  negative: "#F87171",
  gold: "#FBBF24",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
} as const;
