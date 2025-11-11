/**
 * Theme configuration for Upper+Outdoor app
 * High contrast, accessible, clean design
 */

const baseColors = {
  // Primary palette
  primary: '#2563EB', // Blue
  primaryDark: '#1E40AF',
  primaryLight: '#60A5FA',

  // Accent colors
  success: '#10B981', // Green
  warning: '#F59E0B', // Amber
  error: '#EF4444', // Red
  info: '#3B82F6', // Blue

  // Day type colors - Muscle Group Split
  dayPush: '#8B5CF6', // Purple
  dayPull: '#06B6D4', // Cyan
  dayUpper: '#EC4899', // Pink
  dayLegs: '#F59E0B', // Amber/Orange
  // Day type colors - Body Part Split
  dayChest: '#A855F7', // Light Purple
  dayBack: '#14B8A6', // Teal
  dayShoulders: '#F43F5E', // Rose
  dayArms: '#3B82F6', // Blue
  // Special days
  dayOutdoor: '#10B981', // Green
  dayRest: '#6B7280', // Gray

  // Neutral palette
  black: '#000000',
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
};

export const lightColors = {
  ...baseColors,

  // Background (light mode)
  background: '#FFFFFF',
  backgroundSecondary: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceElevated: '#F9FAFB',

  // Text (light mode)
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Borders (light mode)
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderDark: '#D1D5DB',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

export const darkColors = {
  ...baseColors,

  // Background (dark mode)
  background: '#111827',
  backgroundSecondary: '#1F2937',
  surface: '#1F2937',
  surfaceElevated: '#374151',

  // Grays inverted for dark mode (darker backgrounds, lighter text)
  gray50: '#1F2937',
  gray100: '#374151',
  gray200: '#4B5563',
  gray300: '#6B7280',

  // Text (dark mode)
  textPrimary: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textTertiary: '#9CA3AF',
  textInverse: '#111827',

  // Borders (dark mode)
  border: '#374151',
  borderLight: '#4B5563',
  borderDark: '#1F2937',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

// Use dark theme by default
export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const typography = {
  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },

  // Font weights
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const animations = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
};

export const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

// Helper to get day type color
export const getDayTypeColor = (dayType: string): string => {
  switch (dayType) {
    // Muscle group split
    case 'Push':
      return colors.dayPush;
    case 'Pull':
      return colors.dayPull;
    case 'Upper2':
      return colors.dayUpper;
    case 'Legs':
      return colors.dayLegs;
    // Body part split
    case 'Chest':
      return colors.dayChest;
    case 'Back':
      return colors.dayBack;
    case 'Shoulders':
      return colors.dayShoulders;
    case 'Arms':
      return colors.dayArms;
    // Special
    case 'Outdoor':
      return colors.dayOutdoor;
    case 'Rest':
      return colors.dayRest;
    default:
      return colors.gray500;
  }
};

// Helper to get day type display name
export const getDayTypeDisplayName = (dayType: string): string => {
  switch (dayType) {
    case 'Upper2':
      return 'Upper Body';
    case 'Outdoor':
      return 'Outdoor';
    default:
      return dayType; // Push, Pull, Legs, Chest, Back, Shoulders, Arms, Rest
  }
};

export default {
  colors,
  lightColors,
  darkColors,
  spacing,
  borderRadius,
  typography,
  shadows,
  animations,
  hitSlop,
  getDayTypeColor,
  getDayTypeDisplayName,
};
