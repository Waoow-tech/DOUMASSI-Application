// PROVISOIRE — voir ADR-002 sur Notion
// Palette à raffiner Sprint 1 avec la maquette Canva officielle (DAHAZHxJm78)
// Police Inter en fallback — la vraie famille DOUMASSI sera ajoutée Sprint 1.

import { config as defaultConfig } from '@tamagui/config/v3';
import { createInterFont } from '@tamagui/font-inter';
import { createTamagui } from 'tamagui';

const interFont = createInterFont();

const colors = {
  background: '#000000',
  surface: '#1A1A1A',
  surfaceElevated: '#252525',
  border: '#2A2A2A',
  borderStrong: '#3A3A3A',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  accentPrimary: '#FFFFFF',
  accentNeon: '#10D970',
  accentNeonLight: '#22E388',
  accentGold: '#FFB800',
  accentGoldLight: '#FFC700',
  statusDanger: '#FF3B30',
  statusInfo: '#3B82F6',
};

const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

const tokens = {
  ...defaultConfig.tokens,
  color: {
    ...defaultConfig.tokens.color,
    ...colors,
  },
  radius: {
    ...defaultConfig.tokens.radius,
    ...radius,
  },
};

const darkTheme = {
  background: colors.background,
  backgroundHover: colors.surface,
  backgroundPress: colors.surfaceElevated,
  backgroundFocus: colors.surfaceElevated,
  borderColor: colors.border,
  borderColorHover: colors.borderStrong,
  color: colors.textPrimary,
  colorHover: colors.textSecondary,
  colorPress: colors.textSecondary,
  colorFocus: colors.textPrimary,
  placeholderColor: colors.textSecondary,
  // Tokens custom DOUMASSI accessibles via $accentNeon, $accentGold, etc.
  accentNeon: colors.accentNeon,
  accentNeonLight: colors.accentNeonLight,
  accentGold: colors.accentGold,
  accentGoldLight: colors.accentGoldLight,
  surface: colors.surface,
  surfaceElevated: colors.surfaceElevated,
  textSecondary: colors.textSecondary,
  danger: colors.statusDanger,
  info: colors.statusInfo,
};

const config = createTamagui({
  ...defaultConfig,
  tokens,
  fonts: {
    body: interFont,
    heading: interFont,
  },
  themes: {
    dark: darkTheme,
  },
  defaultTheme: 'dark',
});

export type AppConfig = typeof config;

declare module 'tamagui' {
  // Augmente l'interface globale Tamagui pour le typage des tokens
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
