import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Parental control settings interface
export interface ParentalSettings {
  enabled: boolean;
  pin: string;
  hideAdultContent: boolean;
  hideAdultChannels: boolean;
  hideXXXCategories: boolean;
  maxRating: 'G' | 'PG' | 'PG-13' | 'R' | 'NC-17' | 'ALL';
  blockedCategories: string[];
  requirePinForSettings: boolean;
  lockTime: number; // Minutes before re-requiring PIN
  lastUnlockTime?: string;
}

// Adult content keywords to filter
const ADULT_KEYWORDS = [
  'xxx', 'adult', 'porn', 'erotic', 'sex', '18+', 'mature',
  'playboy', 'brazzers', 'vivid', 'hustler', 'penthouse',
  'xvideos', 'pornhub', 'redtube', 'youporn', 'xnxx',
  'hot girls', 'nude', 'naked', 'strip', 'escort',
];

// Adult category names commonly used in IPTV
const ADULT_CATEGORIES = [
  'xxx', 'adult', '18+', 'mature', 'erotic', 'x-rated',
  'porn', 'adults only', 'for adults', 'adult entertainment',
];

const STORAGE_KEYS = {
  PARENTAL_SETTINGS: '@zeus_glass_parental_settings',
  PARENTAL_PIN: 'zeus_glass_parental_pin',
};

const DEFAULT_SETTINGS: ParentalSettings = {
  enabled: false,
  pin: '',
  hideAdultContent: true,
  hideAdultChannels: true,
  hideXXXCategories: true,
  maxRating: 'ALL',
  blockedCategories: [],
  requirePinForSettings: false,
  lockTime: 30,
};

export const parentalControlService = {
  settings: { ...DEFAULT_SETTINGS } as ParentalSettings,
  isUnlocked: false,

  // Initialize parental controls
  init: async (): Promise<void> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PARENTAL_SETTINGS);
      if (stored) {
        parentalControlService.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
      
      // Get PIN from secure storage
      const pin = await SecureStore.getItemAsync(STORAGE_KEYS.PARENTAL_PIN);
      if (pin) {
        parentalControlService.settings.pin = pin;
      }

      // Check if still unlocked from last session
      if (parentalControlService.settings.lastUnlockTime) {
        const lastUnlock = new Date(parentalControlService.settings.lastUnlockTime);
        const now = new Date();
        const minutesSinceUnlock = (now.getTime() - lastUnlock.getTime()) / (1000 * 60);
        parentalControlService.isUnlocked = minutesSinceUnlock < parentalControlService.settings.lockTime;
      }
    } catch (error) {
      console.error('Error loading parental settings:', error);
    }
  },

  // Get current settings
  getSettings: (): ParentalSettings => {
    return parentalControlService.settings;
  },

  // Save settings
  saveSettings: async (settings: Partial<ParentalSettings>): Promise<void> => {
    parentalControlService.settings = { ...parentalControlService.settings, ...settings };
    
    // Save PIN separately in secure storage
    if (settings.pin !== undefined) {
      if (settings.pin) {
        await SecureStore.setItemAsync(STORAGE_KEYS.PARENTAL_PIN, settings.pin);
      } else {
        await SecureStore.deleteItemAsync(STORAGE_KEYS.PARENTAL_PIN);
      }
    }
    
    // Save other settings (excluding PIN) to AsyncStorage
    const settingsToSave = { ...parentalControlService.settings };
    delete settingsToSave.pin;
    await AsyncStorage.setItem(STORAGE_KEYS.PARENTAL_SETTINGS, JSON.stringify(settingsToSave));
  },

  // Enable parental controls with PIN
  enable: async (pin: string): Promise<boolean> => {
    if (pin.length < 4) {
      return false;
    }
    
    await parentalControlService.saveSettings({
      enabled: true,
      pin,
      hideAdultContent: true,
      hideAdultChannels: true,
      hideXXXCategories: true,
    });
    
    return true;
  },

  // Disable parental controls (requires PIN)
  disable: async (pin: string): Promise<boolean> => {
    if (!parentalControlService.verifyPin(pin)) {
      return false;
    }
    
    await parentalControlService.saveSettings({
      enabled: false,
    });
    
    parentalControlService.isUnlocked = true;
    return true;
  },

  // Verify PIN
  verifyPin: (pin: string): boolean => {
    return parentalControlService.settings.pin === pin;
  },

  // Unlock with PIN
  unlock: async (pin: string): Promise<boolean> => {
    if (parentalControlService.verifyPin(pin)) {
      parentalControlService.isUnlocked = true;
      await parentalControlService.saveSettings({
        lastUnlockTime: new Date().toISOString(),
      });
      return true;
    }
    return false;
  },

  // Lock
  lock: (): void => {
    parentalControlService.isUnlocked = false;
  },

  // Check if content should be hidden
  isContentBlocked: (): boolean => {
    return parentalControlService.settings.enabled && 
           !parentalControlService.isUnlocked &&
           parentalControlService.settings.hideAdultContent;
  },

  // Check if a specific channel/content should be filtered
  shouldFilterContent: (name: string, category?: string): boolean => {
    if (!parentalControlService.settings.enabled) {
      return false;
    }
    
    if (parentalControlService.isUnlocked) {
      return false;
    }

    const nameLower = name.toLowerCase();
    const categoryLower = (category || '').toLowerCase();

    // Check adult keywords in name
    if (parentalControlService.settings.hideAdultContent) {
      for (const keyword of ADULT_KEYWORDS) {
        if (nameLower.includes(keyword)) {
          return true;
        }
      }
    }

    // Check adult categories
    if (parentalControlService.settings.hideXXXCategories) {
      for (const adultCat of ADULT_CATEGORIES) {
        if (categoryLower.includes(adultCat)) {
          return true;
        }
      }
    }

    // Check custom blocked categories
    if (parentalControlService.settings.blockedCategories.length > 0) {
      for (const blocked of parentalControlService.settings.blockedCategories) {
        if (categoryLower.includes(blocked.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  },

  // Filter an array of channels/content
  filterContent: <T extends { name: string; category?: string }>(items: T[]): T[] => {
    if (!parentalControlService.settings.enabled || parentalControlService.isUnlocked) {
      return items;
    }

    return items.filter(item => !parentalControlService.shouldFilterContent(item.name, item.category));
  },

  // Check rating
  isRatingAllowed: (rating: string): boolean => {
    if (!parentalControlService.settings.enabled || parentalControlService.isUnlocked) {
      return true;
    }

    const maxRating = parentalControlService.settings.maxRating;
    if (maxRating === 'ALL') {
      return true;
    }

    const ratingOrder = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
    const maxIndex = ratingOrder.indexOf(maxRating);
    const contentIndex = ratingOrder.indexOf(rating);

    if (contentIndex === -1) {
      return true; // Unknown rating, allow
    }

    return contentIndex <= maxIndex;
  },

  // Change PIN
  changePin: async (oldPin: string, newPin: string): Promise<boolean> => {
    if (!parentalControlService.verifyPin(oldPin)) {
      return false;
    }
    
    if (newPin.length < 4) {
      return false;
    }

    await parentalControlService.saveSettings({ pin: newPin });
    return true;
  },

  // Reset (requires current PIN)
  reset: async (pin: string): Promise<boolean> => {
    if (!parentalControlService.verifyPin(pin)) {
      return false;
    }

    await AsyncStorage.removeItem(STORAGE_KEYS.PARENTAL_SETTINGS);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.PARENTAL_PIN);
    parentalControlService.settings = { ...DEFAULT_SETTINGS };
    parentalControlService.isUnlocked = false;
    
    return true;
  },

  // Add category to blocked list
  addBlockedCategory: async (category: string): Promise<void> => {
    const categories = [...parentalControlService.settings.blockedCategories];
    if (!categories.includes(category)) {
      categories.push(category);
      await parentalControlService.saveSettings({ blockedCategories: categories });
    }
  },

  // Remove category from blocked list
  removeBlockedCategory: async (category: string): Promise<void> => {
    const categories = parentalControlService.settings.blockedCategories.filter(c => c !== category);
    await parentalControlService.saveSettings({ blockedCategories: categories });
  },
};
