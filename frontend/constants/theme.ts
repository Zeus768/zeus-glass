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
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    huge: 48,
  },
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export type Theme = typeof theme;
