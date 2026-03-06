import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cross-platform secure storage utility
 * Uses SecureStore on native platforms, AsyncStorage on web
 */
export const storage = {
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        // Use AsyncStorage for web
        await AsyncStorage.setItem(key, value);
      } else {
        // Use SecureStore for native (iOS/Android/TV)
        await SecureStore.setItemAsync(key, value);
      }
      console.log(`[Storage] Saved ${key}`);
    } catch (error) {
      console.error(`[Storage] Error saving ${key}:`, error);
      // Fallback to AsyncStorage if SecureStore fails
      try {
        await AsyncStorage.setItem(key, value);
        console.log(`[Storage] Fallback saved ${key} to AsyncStorage`);
      } catch (fallbackError) {
        console.error(`[Storage] Fallback also failed for ${key}:`, fallbackError);
      }
    }
  },

  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(key);
      } else {
        // Try SecureStore first
        const value = await SecureStore.getItemAsync(key);
        if (value) return value;
        
        // Fallback to AsyncStorage
        return await AsyncStorage.getItem(key);
      }
    } catch (error) {
      console.error(`[Storage] Error getting ${key}:`, error);
      // Fallback to AsyncStorage
      try {
        return await AsyncStorage.getItem(key);
      } catch (fallbackError) {
        console.error(`[Storage] Fallback also failed for ${key}:`, fallbackError);
        return null;
      }
    }
  },

  deleteItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
        // Also try AsyncStorage in case it was stored there
        await AsyncStorage.removeItem(key);
      }
      console.log(`[Storage] Deleted ${key}`);
    } catch (error) {
      console.error(`[Storage] Error deleting ${key}:`, error);
    }
  },
};
