import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let focusSound: Audio.Sound | null = null;
let selectSound: Audio.Sound | null = null;
let soundEnabled = true;

const STORAGE_KEY = 'zeus_focus_sound_enabled';

// Proper 30ms high-pitched tick click (4.4kHz sine, quick decay)
const TICK_WAV = 'data:audio/wav;base64,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';

/**
 * TV Focus Sound — plays a subtle tick on D-Pad navigation
 * Designed for TV remote users to get audio feedback on focus changes
 */
export const focusSoundService = {
  /**
   * Initialize the focus sound (call once on app start)
   */
  init: async () => {
    try {
      // Load saved preference
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        soundEnabled = saved === 'true';
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });

      // Focus tick sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: TICK_WAV },
        { volume: 0.2, shouldPlay: false }
      );
      focusSound = sound;

      // Select/press sound (slightly louder, same tick)
      const { sound: sel } = await Audio.Sound.createAsync(
        { uri: TICK_WAV },
        { volume: 0.35, shouldPlay: false }
      );
      selectSound = sel;
    } catch (e) {
      console.log('[FocusSound] Init failed (non-critical):', e);
    }
  },

  /**
   * Play the focus tick sound (on D-Pad navigation)
   */
  playFocus: async () => {
    if (!soundEnabled || !focusSound) return;
    try {
      await focusSound.setPositionAsync(0);
      await focusSound.playAsync();
    } catch {
      // Non-critical — silently ignore
    }
  },

  /**
   * Play the select/press sound (on button press)
   */
  playSelect: async () => {
    if (!soundEnabled || !selectSound) return;
    try {
      await selectSound.setPositionAsync(0);
      await selectSound.playAsync();
    } catch {
      // Non-critical
    }
  },

  /** Toggle focus sound on/off and persist */
  setEnabled: async (enabled: boolean) => {
    soundEnabled = enabled;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {}
  },

  /** Check if sound is enabled */
  isEnabled: () => soundEnabled,

  /** Clean up */
  dispose: async () => {
    if (focusSound) {
      await focusSound.unloadAsync();
      focusSound = null;
    }
    if (selectSound) {
      await selectSound.unloadAsync();
      selectSound = null;
    }
  },
};
