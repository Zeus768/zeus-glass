import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PARENTAL = 'parental_controls';

export interface ParentalControlSettings {
  enabled: boolean;
  pin: string | null;
  pinHash: string | null;
  adultContentBlocked: boolean;
  requirePinForAdult: boolean;
  setupComplete: boolean;
  lastUnlockedAt: number | null;
  unlockDuration: number; // minutes to stay unlocked
}

const DEFAULT_SETTINGS: ParentalControlSettings = {
  enabled: false,
  pin: null,
  pinHash: null,
  adultContentBlocked: true,
  requirePinForAdult: true,
  setupComplete: false,
  lastUnlockedAt: null,
  unlockDuration: 30, // Stay unlocked for 30 minutes
};

// Adult content category keywords
const ADULT_KEYWORDS = [
  'xxx', 'adult', 'porn', '18+', 'mature', 'erotic', 'sex',
  'playboy', 'hustler', 'brazzers', 'bangbros', 'naughty',
];

class ParentalControlService {
  private settings: ParentalControlSettings = DEFAULT_SETTINGS;
  private isUnlocked: boolean = false;

  async init() {
    await this.loadSettings();
    this.checkUnlockStatus();
  }

  async loadSettings(): Promise<ParentalControlSettings> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_PARENTAL);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('[Parental] Error loading settings:', e);
    }
    return this.settings;
  }

  async saveSettings(settings: Partial<ParentalControlSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await AsyncStorage.setItem(STORAGE_KEY_PARENTAL, JSON.stringify(this.settings));
  }

  getSettings(): ParentalControlSettings {
    return { ...this.settings };
  }

  // Simple hash function for PIN (not cryptographically secure, but adequate for local use)
  private hashPin(pin: string): string {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const char = pin.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // Enable parental controls with a new PIN
  async enable(pin: string): Promise<boolean> {
    if (pin.length < 4) {
      return false;
    }

    const pinHash = this.hashPin(pin);
    await this.saveSettings({
      enabled: true,
      pin: null, // Don't store plain PIN
      pinHash,
      adultContentBlocked: true,
      requirePinForAdult: true,
      setupComplete: true,
    });

    return true;
  }

  // Unlock with PIN (temporary access)
  async unlock(pin: string): Promise<boolean> {
    if (this.verifyPin(pin)) {
      this.isUnlocked = true;
      await this.saveSettings({
        lastUnlockedAt: Date.now(),
      });
      return true;
    }
    return false;
  }

  // Disable parental controls entirely (requires PIN)
  async disable(pin: string): Promise<boolean> {
    if (!this.verifyPin(pin)) {
      return false;
    }

    await this.saveSettings({
      enabled: false,
      adultContentBlocked: false,
      requirePinForAdult: false,
    });

    this.isUnlocked = true;
    return true;
  }

  // Verify PIN
  verifyPin(pin: string): boolean {
    if (!this.settings.pinHash) return false;
    return this.hashPin(pin) === this.settings.pinHash;
  }

  // Check if currently unlocked
  private checkUnlockStatus(): boolean {
    if (!this.settings.lastUnlockedAt) {
      this.isUnlocked = false;
      return false;
    }

    const unlockDurationMs = this.settings.unlockDuration * 60 * 1000;
    const elapsed = Date.now() - this.settings.lastUnlockedAt;
    
    this.isUnlocked = elapsed < unlockDurationMs;
    return this.isUnlocked;
  }

  // Lock parental controls again
  async lock(): Promise<void> {
    this.isUnlocked = false;
    await this.saveSettings({ lastUnlockedAt: null });
  }

  // Check if user can access adult content
  canAccessAdultContent(): boolean {
    if (!this.settings.enabled) return true;
    if (!this.settings.adultContentBlocked) return true;
    return this.checkUnlockStatus();
  }

  // Setup PIN for parental controls
  async setupPin(pin: string): Promise<boolean> {
    if (pin.length < 4) {
      return false;
    }

    const pinHash = this.hashPin(pin);
    await this.saveSettings({
      enabled: true,
      pin: null, // Don't store plain PIN
      pinHash,
      adultContentBlocked: true,
      requirePinForAdult: true,
      setupComplete: true,
    });

    return true;
  }

  // Enable parental controls
  async enableParentalControls(): Promise<void> {
    if (!this.settings.pinHash) {
      // Can't enable without PIN setup
      return;
    }

    await this.saveSettings({
      enabled: true,
      adultContentBlocked: true,
      requirePinForAdult: true,
    });

    this.isUnlocked = false;
  }

  // Change PIN (requires old PIN)
  async changePin(oldPin: string, newPin: string): Promise<boolean> {
    if (!this.verifyPin(oldPin)) {
      return false;
    }

    if (newPin.length < 4) {
      return false;
    }

    await this.saveSettings({
      pinHash: this.hashPin(newPin),
    });

    return true;
  }

  // Check if content contains adult material
  isAdultContent(categoryName: string, channelName?: string): boolean {
    const lowerCategory = categoryName.toLowerCase();
    const lowerChannel = channelName?.toLowerCase() || '';

    return ADULT_KEYWORDS.some(keyword => 
      lowerCategory.includes(keyword) || lowerChannel.includes(keyword)
    );
  }

  // Filter channels/categories - remove adult content if blocked
  filterAdultContent<T extends { category?: string; name?: string }>(items: T[]): T[] {
    if (this.canAccessAdultContent()) {
      return items; // No filtering needed
    }

    return items.filter(item => 
      !this.isAdultContent(item.category || '', item.name || '')
    );
  }

  // Generic filter method used by IPTV service
  filterContent<T>(items: T[]): T[] {
    if (this.canAccessAdultContent()) {
      return items;
    }
    
    return items.filter((item: any) => {
      const category = item.category || item.category_name || '';
      const name = item.name || item.title || '';
      return !this.isAdultContent(category, name);
    });
  }

  // Check if IPTV has adult categories
  checkIPTVForAdultContent(categories: { category_name: string }[]): boolean {
    return categories.some(cat => this.isAdultContent(cat.category_name));
  }

  // Requirements check - does user need to set up parental controls?
  needsParentalSetup(hasAdultContent: boolean): boolean {
    return hasAdultContent && !this.settings.setupComplete;
  }

  // Get setup instructions
  getSetupInstructions(): string[] {
    return [
      'Your IPTV provider includes adult content categories.',
      'To protect your viewing experience, please set up a 4-digit PIN.',
      'This PIN will be required to access adult content.',
      '',
      'To disable parental controls later:',
      '1. Go to Settings',
      '2. Tap "Parental Controls"',
      '3. Enter your PIN',
      '4. Select "Disable Parental Controls"',
    ];
  }

  // Get removal instructions (shown in settings)
  getRemovalInstructions(): string[] {
    return [
      'To disable parental controls:',
      '1. Enter your current PIN below',
      '2. Tap "Disable Parental Controls"',
      '',
      'Note: Adult content will become visible after disabling.',
    ];
  }
}

export const parentalControlService = new ParentalControlService();
