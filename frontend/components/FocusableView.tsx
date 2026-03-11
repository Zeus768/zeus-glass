import React, { useState, useCallback } from 'react';
import { Pressable, View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';
import { theme, isTV } from '../constants/theme';

interface FocusableViewProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
  hasTVPreferredFocus?: boolean;
}

/**
 * FocusableView - A wrapper component that provides strong visual feedback
 * when focused on TV devices using remote control navigation.
 * 
 * Features:
 * - Bright cyan border when focused
 * - Scale up animation
 * - Glow effect
 * - Works with both touch and remote navigation
 */
export const FocusableView: React.FC<FocusableViewProps> = ({
  children,
  onPress,
  style,
  focusedStyle,
  disabled = false,
  testID,
  hasTVPreferredFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  return (
    <Pressable
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      testID={testID}
      style={[
        styles.container,
        style,
        isFocused && styles.focused,
        isFocused && focusedStyle,
      ]}
      {...(Platform.isTV && hasTVPreferredFocus && { hasTVPreferredFocus: true })}
    >
      {/* Glow effect behind the content */}
      {isFocused && <View style={styles.glowEffect} />}
      {children}
    </Pressable>
  );
};

/**
 * FocusableCard - Specialized focusable component for content cards
 */
export const FocusableCard: React.FC<FocusableViewProps> = ({
  children,
  onPress,
  style,
  disabled = false,
  testID,
  hasTVPreferredFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      disabled={disabled}
      testID={testID}
      style={[
        styles.card,
        style,
        isFocused && styles.cardFocused,
      ]}
      {...(Platform.isTV && hasTVPreferredFocus && { hasTVPreferredFocus: true })}
    >
      {/* Focus overlay */}
      {isFocused && (
        <View style={styles.cardFocusOverlay}>
          <View style={styles.focusBorderTop} />
          <View style={styles.focusBorderBottom} />
        </View>
      )}
      {children}
    </Pressable>
  );
};

/**
 * FocusableButton - Button with clear focus state for TV
 */
export const FocusableButton: React.FC<FocusableViewProps & { 
  variant?: 'primary' | 'secondary' | 'ghost';
}> = ({
  children,
  onPress,
  style,
  disabled = false,
  testID,
  variant = 'primary',
  hasTVPreferredFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getVariantStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.buttonPrimary;
      case 'secondary':
        return styles.buttonSecondary;
      case 'ghost':
        return styles.buttonGhost;
      default:
        return styles.buttonPrimary;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      disabled={disabled}
      testID={testID}
      style={[
        styles.button,
        getVariantStyle(),
        style,
        isFocused && styles.buttonFocused,
        disabled && styles.buttonDisabled,
      ]}
      {...(Platform.isTV && hasTVPreferredFocus && { hasTVPreferredFocus: true })}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  focused: {
    // SUPER VISIBLE focus for TV - white border with cyan glow
    borderWidth: isTV ? 6 : 4,
    borderColor: '#FFFFFF', // White border for maximum visibility
    borderRadius: theme.borderRadius.md,
    transform: [{ scale: isTV ? 1.15 : 1.08 }], // Bigger scale for "pop out"
    zIndex: 1000,
    // Triple-layer glow effect
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: isTV ? 35 : 25,
    elevation: 50,
    // Background tint for contrast
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
  },
  glowEffect: {
    position: 'absolute',
    top: isTV ? -18 : -12,
    left: isTV ? -18 : -12,
    right: isTV ? -18 : -12,
    bottom: isTV ? -18 : -12,
    backgroundColor: '#00D9FF', // Bright cyan
    borderRadius: theme.borderRadius.xl,
    opacity: isTV ? 0.5 : 0.35,
    zIndex: -1,
  },
  // Card styles
  card: {
    position: 'relative',
    overflow: 'visible', // Allow glow to show outside
    borderWidth: isTV ? 4 : 3,
    borderColor: 'transparent',
    borderRadius: theme.borderRadius.md,
  },
  cardFocused: {
    // MAXIMUM VISIBILITY - white border with massive glow
    borderWidth: isTV ? 6 : 4,
    borderColor: '#FFFFFF', // Bright white
    transform: [{ scale: isTV ? 1.18 : 1.08 }], // Even bigger pop
    zIndex: 1000,
    // Intense multi-layer shadow
    shadowColor: '#00D9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: isTV ? 45 : 30,
    elevation: 50,
    // Subtle background highlight
    backgroundColor: 'rgba(0, 217, 255, 0.2)',
  },
  cardFocusOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    pointerEvents: 'none',
  },
  focusBorderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: isTV ? 5 : 4,
    backgroundColor: theme.colors.primary,
  },
  focusBorderBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: isTV ? 5 : 4,
    backgroundColor: theme.colors.primary,
  },
  // Button styles
  button: {
    paddingVertical: isTV ? 18 : 14,
    paddingHorizontal: isTV ? 32 : 24,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'transparent',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonFocused: {
    borderColor: '#FFFFFF',
    borderWidth: isTV ? 5 : 4,
    transform: [{ scale: isTV ? 1.18 : 1.1 }],
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: isTV ? 35 : 25,
    elevation: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default FocusableView;
