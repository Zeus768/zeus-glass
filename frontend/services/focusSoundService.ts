import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let focusSound: Audio.Sound | null = null;
let soundEnabled = true;

/**
 * TV Focus Sound — plays a subtle tick on D-Pad navigation
 */
export const focusSoundService = {
  /**
   * Initialize the focus sound (call once on app start)
   */
  init: async () => {
    if (!Platform.isTV) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
      // Use a tiny in-memory beep (no external file needed)
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGExYQAAAAA=' },
        { volume: 0.15, shouldPlay: false }
      );
      focusSound = sound;
    } catch (e) {
      console.log('[FocusSound] Init failed (non-critical):', e);
    }
  },

  /**
   * Play the focus tick sound
   */
  play: async () => {
    if (!soundEnabled || !focusSound) return;
    try {
      await focusSound.setPositionAsync(0);
      await focusSound.playAsync();
    } catch {
      // Non-critical — silently ignore
    }
  },

  /** Toggle focus sound on/off */
  setEnabled: (enabled: boolean) => {
    soundEnabled = enabled;
  },

  /** Check if sound is enabled */
  isEnabled: () => soundEnabled,

  /** Clean up */
  dispose: async () => {
    if (focusSound) {
      await focusSound.unloadAsync();
      focusSound = null;
    }
  },
};
