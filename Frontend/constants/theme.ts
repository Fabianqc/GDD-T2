/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const PurpleAccents = {
  primary: '#7C3AED',      // Violet 600
  medium: '#8B5CF6',       // Purple 500
  dark: '#6D28D9',         // Violet 700
  deep: '#4C1D95',         // Violet 900
  lightBg: '#F3E8FF',      // Soft purple container
  darkBg: '#2E1065',       // Dark purple container
  gradientPrimary: ['#7C3AED', '#4F46E5'],
  gradientEmeraldPurple: ['#059669', '#7C3AED'],
  gradientPurpleDark: ['#6D28D9', '#312E81'],
};

/** Tokens de estado clínico (RF-06) — contraste accesible claro/oscuro */
export const ClinicalColors = {
  light: {
    glucoseNormal: '#047857',
    glucoseElevated: '#C2410C',
    glucoseHigh: '#B91C1C',
    glucoseLow: '#B45309',
    responded: '#047857',
    incident: '#DC2626',
    cardAccent: '#0F766E',
  },
  dark: {
    glucoseNormal: '#34D399',
    glucoseElevated: '#FB923C',
    glucoseHigh: '#F87171',
    glucoseLow: '#FBBF24',
    responded: '#34D399',
    incident: '#F87171',
    cardAccent: '#2DD4BF',
  },
};

/** Tokens de gráficos (RF-06) */
export const ChartColors = {
  light: {
    grid: '#CBD5E1',
    axis: '#475569',
    tooltipBg: '#FFFFFF',
    tooltipBorder: '#CBD5E1',
    seriesPrimary: '#059669',
    seriesSecondary: '#2563EB',
    seriesTertiary: '#7C3AED',
    seriesWarn: '#D97706',
    referenceBand: 'rgba(5, 150, 105, 0.12)',
  },
  dark: {
    grid: '#334155',
    axis: '#94A3B8',
    tooltipBg: '#1C2541',
    tooltipBorder: '#2A3656',
    seriesPrimary: '#34D399',
    seriesSecondary: '#60A5FA',
    seriesTertiary: '#A78BFA',
    seriesWarn: '#FBBF24',
    referenceBand: 'rgba(52, 211, 153, 0.14)',
  },
};

export const Colors = {
  light: {
    text: '#0F172A',
    subtext: '#475569',
    background: '#E2E8F0',          // Soft slate-gray background
    cardBackground: '#FFFFFF',      // Crisp white elevated card
    cardBorder: '#CBD5E1',          // High contrast slate border
    primary: '#059669',             // Rich Emerald Green
    primaryDark: '#047857',
    purpleAccent: '#6D28D9',        // Royal Indigo Purple
    purpleLightBg: '#EDE9FE',
    purpleText: '#5B21B6',
    tint: '#059669',
    icon: '#475569',
    tabIconDefault: '#64748B',
    tabIconSelected: '#059669',
    headerBg: '#FFFFFF',
    inputBg: '#F8FAFC',
    inputBorder: '#94A3B8',
    alertHighRisk: '#DC2626',
    alertWarning: '#D97706',
    alertInfo: '#2563EB',
    success: '#047857',
  },
  dark: {
    text: '#F8FAFC',
    subtext: '#94A3B8',
    background: '#0B132B',
    cardBackground: '#1C2541',
    cardBorder: '#2A3656',
    primary: '#10B981',
    primaryDark: '#059669',
    purpleAccent: '#A78BFA',
    purpleLightBg: '#2E1065',
    purpleText: '#DDD6FE',
    tint: '#A78BFA',
    icon: '#94A3B8',
    tabIconDefault: '#64748B',
    tabIconSelected: '#A78BFA',
    headerBg: '#1C2541',
    inputBg: '#0F172A',
    inputBorder: '#334155',
    alertHighRisk: '#F87171',
    alertWarning: '#FBBF24',
    alertInfo: '#60A5FA',
    success: '#34D399',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
