import { Platform, Dimensions } from 'react-native';

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// TV Detection - check multiple sources for reliable detection
// 1. Platform.isTV - native flag from React Native
// 2. EXPO_TV environment variable - set during build
// 3. Screen dimensions - TV screens are typically 960px+ in landscape
// Shield TV and Fire TV typically report 1920x1080 or 3840x2160
const isTVBySize = SCREEN_WIDTH >= 960 || SCREEN_HEIGHT >= 960;
const isTVByPlatform = Platform.isTV === true;
const isTVByEnv = process.env.EXPO_TV === '1';

// Combined TV detection - any of these conditions means it's a TV
export const isTV = isTVByPlatform || (Platform.OS === 'android' && (isTVBySize || isTVByEnv));
export const isTablet = SCREEN_WIDTH > 768 && !isTV;

// Debug log to verify TV detection
if (__DEV__) {
  console.log('[Theme] Platform.isTV:', Platform.isTV);
  console.log('[Theme] Platform.OS:', Platform.OS);
  console.log('[Theme] SCREEN_WIDTH:', SCREEN_WIDTH);
  console.log('[Theme] SCREEN_HEIGHT:', SCREEN_HEIGHT);
  console.log('[Theme] isTVBySize:', isTVBySize);
  console.log('[Theme] isTV (computed):', isTV);
}

// Zeus Glass Theme - Sky Glass Inspired
export const theme = {
  colors: {
    primary: '#00D9FF',
    secondary: '#7C4DFF',
    background: '#0A0E27',
    surface: '#151B3D',
    surfaceLight: 'rgba(255, 255, 255, 0.05)',
    card: 'rgba(21, 27, 61, 0.8)',
    cardHover: 'rgba(21, 27, 61, 0.95)',
    text: '#FFFFFF',
    textSecondary: '#B0B8C8',
    textMuted: '#6B7280',
    border: 'rgba(255, 255, 255, 0.1)',
    gold: '#FFD700',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    focus: '#00D9FF',
    gradient: {
      start: '#0A0E27',
      end: '#1A1F3F',
    },
    glassmorphism: {
      background: 'rgba(21, 27, 61, 0.6)',
      border: 'rgba(255, 255, 255, 0.1)',
      blur: 20,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  fontSize: {
    xs: isTV ? 16 : 12,
    sm: isTV ? 18 : 14,
    md: isTV ? 22 : 16,
    lg: isTV ? 28 : 20,
    xl: isTV ? 36 : 24,
    xxl: isTV ? 48 : 32,
    huge: isTV ? 64 : 48,
  },
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  tv: {
    focusBorderWidth: 4,
    focusScale: 1.08,
    cardWidth: 220,
    cardHeight: 330,
    carouselItemSpacing: 20,
  },
  mobile: {
    cardWidth: 140,
    cardHeight: 210,
    carouselItemSpacing: 12,
  },
};

export type Theme = typeof theme;
