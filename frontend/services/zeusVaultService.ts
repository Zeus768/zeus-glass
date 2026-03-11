import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import { encode as base64Encode, decode as base64Decode } from 'base-64';

const VAULT_VERSION = '1.0';
const VAULT_FILENAME = 'zeus_vault.json';

// Get directory safely
const getVaultBackupDir = () => {
  const docDir = FileSystem.documentDirectory || '';
  return docDir + 'vault/';
};

const getCacheDir = () => {
  return FileSystem.cacheDirectory || '';
};

// Keys that should be backed up to the vault
const VAULT_KEYS = {
  // Debrid Services
  REAL_DEBRID_TOKEN: 'real_debrid_token',
  REAL_DEBRID_REFRESH_TOKEN: 'real_debrid_refresh_token',
  REAL_DEBRID_EXPIRES: 'real_debrid_expires',
  ALLDEBRID_API_KEY: 'alldebrid_api_key',
  ALLDEBRID_USERNAME: 'alldebrid_username',
  PREMIUMIZE_API_KEY: 'premiumize_api_key',
  PREMIUMIZE_CUSTOMER_ID: 'premiumize_customer_id',
  
  // Trakt
  TRAKT_ACCESS_TOKEN: 'trakt_access_token',
  TRAKT_REFRESH_TOKEN: 'trakt_refresh_token',
  TRAKT_EXPIRES: 'trakt_expires',
  
  // IPTV
  IPTV_CONFIG: 'iptv_config',
  IPTV_FAVORITES: 'iptv_favorites',
  
  // Torrentio
  TORRENTIO_CONFIG: 'torrentio_config',
  
  // OpenSubtitles
  OPENSUBTITLES_CONFIG: 'opensubtitles_config',
  
  // User Preferences
  SUBTITLE_SETTINGS: 'subtitle_settings',
  STREAM_DEFAULT_SETTINGS: 'stream_default_settings',
  ONE_CLICK_PLAY_SETTINGS: 'one_click_play_settings',
  PARENTAL_CONTROLS: 'parental_controls',
  
  // Watchlist & History
  FAVORITES: 'favorites',
  WATCH_HISTORY: 'watch_history',
  CONTINUE_WATCHING: 'continue_watching',
};

export interface VaultData {
  version: string;
  created: string;
  updated: string;
  deviceId: string;
  accounts: {
    realDebrid?: {
      token: string;
      refreshToken?: string;
      expires?: string;
    };
    allDebrid?: {
      apiKey: string;
      username?: string;
    };
    premiumize?: {
      apiKey: string;
      customerId?: string;
    };
    trakt?: {
      accessToken: string;
      refreshToken?: string;
      expires?: string;
    };
    iptv?: {
      domain: string;
      username: string;
      password: string;
      enabled: boolean;
    };
    openSubtitles?: {
      apiKey: string;
      username?: string;
      token?: string;
    };
  };
  settings: {
    torrentio?: any;
    subtitles?: any;
    streamDefaults?: any;
    oneClickPlay?: any;
    parentalControls?: any;
  };
  userData: {
    favorites?: any;
    watchHistory?: any;
    continueWatching?: any;
    iptvFavorites?: any;
  };
}

class ZeusVaultService {
  private deviceId: string = '';
  private encryptionKey: string = '';
  private isInitialized: boolean = false;

  async init(): Promise<boolean> {
    try {
      // Generate or retrieve device ID
      this.deviceId = await this.getOrCreateDeviceId();
      
      // Create encryption key from device ID
      this.encryptionKey = await this.generateEncryptionKey();
      
      // Ensure vault directory exists
      await this.ensureVaultDirectory();
      
      this.isInitialized = true;
      console.log('[ZeusVault] Initialized successfully');
      
      return true;
    } catch (error) {
      console.error('[ZeusVault] Initialization error:', error);
      return false;
    }
  }

  private async getOrCreateDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('zeus_device_id');
      if (!deviceId) {
        // Generate a unique device ID
        deviceId = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `zeus-${Date.now()}-${Math.random()}`
        );
        await AsyncStorage.setItem('zeus_device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      console.error('[ZeusVault] Device ID error:', error);
      return 'default-device-id';
    }
  }

  private async generateEncryptionKey(): Promise<string> {
    // Simple key derivation - in production use a more secure method
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `zeus-vault-${this.deviceId}-key`
    );
  }

  private async ensureVaultDirectory(): Promise<void> {
    try {
      if (VAULT_BACKUP_DIR) {
        // Try to create directory - will fail silently if exists
        await FileSystem.makeDirectoryAsync(VAULT_BACKUP_DIR, { intermediates: true }).catch(() => {});
      }
    } catch (error) {
      console.log('[ZeusVault] Directory creation skipped:', error);
    }
  }

  // Simple XOR encryption/decryption (for basic obfuscation)
  private encrypt(data: string): string {
    try {
      const key = this.encryptionKey;
      let result = '';
      for (let i = 0; i < data.length; i++) {
        result += String.fromCharCode(
          data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      // Use base-64 library for React Native compatibility
      return base64Encode(result);
    } catch (error) {
      console.error('[ZeusVault] Encryption error:', error);
      return data;
    }
  }

  private decrypt(encryptedData: string): string {
    try {
      const key = this.encryptionKey;
      // Use base-64 library for React Native compatibility
      const data = base64Decode(encryptedData);
      let result = '';
      for (let i = 0; i < data.length; i++) {
        result += String.fromCharCode(
          data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return result;
    } catch (error) {
      console.error('[ZeusVault] Decryption error:', error);
      return encryptedData;
    }
  }

  // Collect all account data from AsyncStorage
  async collectVaultData(): Promise<VaultData> {
    const vault: VaultData = {
      version: VAULT_VERSION,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      deviceId: this.deviceId,
      accounts: {},
      settings: {},
      userData: {},
    };

    try {
      // Real-Debrid
      const rdToken = await AsyncStorage.getItem(VAULT_KEYS.REAL_DEBRID_TOKEN);
      const rdRefresh = await AsyncStorage.getItem(VAULT_KEYS.REAL_DEBRID_REFRESH_TOKEN);
      const rdExpires = await AsyncStorage.getItem(VAULT_KEYS.REAL_DEBRID_EXPIRES);
      if (rdToken) {
        vault.accounts.realDebrid = {
          token: rdToken,
          refreshToken: rdRefresh || undefined,
          expires: rdExpires || undefined,
        };
      }

      // AllDebrid
      const adKey = await AsyncStorage.getItem(VAULT_KEYS.ALLDEBRID_API_KEY);
      const adUser = await AsyncStorage.getItem(VAULT_KEYS.ALLDEBRID_USERNAME);
      if (adKey) {
        vault.accounts.allDebrid = {
          apiKey: adKey,
          username: adUser || undefined,
        };
      }

      // Premiumize
      const pmKey = await AsyncStorage.getItem(VAULT_KEYS.PREMIUMIZE_API_KEY);
      const pmCustomer = await AsyncStorage.getItem(VAULT_KEYS.PREMIUMIZE_CUSTOMER_ID);
      if (pmKey) {
        vault.accounts.premiumize = {
          apiKey: pmKey,
          customerId: pmCustomer || undefined,
        };
      }

      // Trakt
      const traktAccess = await AsyncStorage.getItem(VAULT_KEYS.TRAKT_ACCESS_TOKEN);
      const traktRefresh = await AsyncStorage.getItem(VAULT_KEYS.TRAKT_REFRESH_TOKEN);
      const traktExpires = await AsyncStorage.getItem(VAULT_KEYS.TRAKT_EXPIRES);
      if (traktAccess) {
        vault.accounts.trakt = {
          accessToken: traktAccess,
          refreshToken: traktRefresh || undefined,
          expires: traktExpires || undefined,
        };
      }

      // IPTV
      const iptvConfig = await AsyncStorage.getItem(VAULT_KEYS.IPTV_CONFIG);
      if (iptvConfig) {
        vault.accounts.iptv = JSON.parse(iptvConfig);
      }

      // OpenSubtitles
      const openSubsConfig = await AsyncStorage.getItem(VAULT_KEYS.OPENSUBTITLES_CONFIG);
      if (openSubsConfig) {
        vault.accounts.openSubtitles = JSON.parse(openSubsConfig);
      }

      // Settings
      const torrentioConfig = await AsyncStorage.getItem(VAULT_KEYS.TORRENTIO_CONFIG);
      if (torrentioConfig) vault.settings.torrentio = JSON.parse(torrentioConfig);

      const subtitleSettings = await AsyncStorage.getItem(VAULT_KEYS.SUBTITLE_SETTINGS);
      if (subtitleSettings) vault.settings.subtitles = JSON.parse(subtitleSettings);

      const streamDefaults = await AsyncStorage.getItem(VAULT_KEYS.STREAM_DEFAULT_SETTINGS);
      if (streamDefaults) vault.settings.streamDefaults = JSON.parse(streamDefaults);

      const oneClickPlay = await AsyncStorage.getItem(VAULT_KEYS.ONE_CLICK_PLAY_SETTINGS);
      if (oneClickPlay) vault.settings.oneClickPlay = JSON.parse(oneClickPlay);

      const parentalControls = await AsyncStorage.getItem(VAULT_KEYS.PARENTAL_CONTROLS);
      if (parentalControls) vault.settings.parentalControls = JSON.parse(parentalControls);

      // User Data
      const favorites = await AsyncStorage.getItem(VAULT_KEYS.FAVORITES);
      if (favorites) vault.userData.favorites = JSON.parse(favorites);

      const watchHistory = await AsyncStorage.getItem(VAULT_KEYS.WATCH_HISTORY);
      if (watchHistory) vault.userData.watchHistory = JSON.parse(watchHistory);

      const continueWatching = await AsyncStorage.getItem(VAULT_KEYS.CONTINUE_WATCHING);
      if (continueWatching) vault.userData.continueWatching = JSON.parse(continueWatching);

      const iptvFavorites = await AsyncStorage.getItem(VAULT_KEYS.IPTV_FAVORITES);
      if (iptvFavorites) vault.userData.iptvFavorites = JSON.parse(iptvFavorites);

    } catch (error) {
      console.error('[ZeusVault] Error collecting data:', error);
    }

    return vault;
  }

  // Save vault to device storage
  async saveVault(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      const vaultData = await this.collectVaultData();
      vaultData.updated = new Date().toISOString();
      
      const jsonData = JSON.stringify(vaultData);
      const encryptedData = this.encrypt(jsonData);
      
      // Save to internal storage
      const internalPath = VAULT_BACKUP_DIR + VAULT_FILENAME;
      await FileSystem.writeAsStringAsync(internalPath, encryptedData);
      
      // Also save to a backup location
      try {
        if (Platform.OS === 'android') {
          // Try to save to external storage for persistence across reinstalls
          const externalPath = FileSystem.documentDirectory + '../' + VAULT_FILENAME;
          await FileSystem.writeAsStringAsync(externalPath, encryptedData);
        }
      } catch (e) {
        console.log('[ZeusVault] External backup failed (expected on some devices):', e);
      }
      
      // Store a marker that vault exists
      await AsyncStorage.setItem('zeus_vault_saved', new Date().toISOString());
      
      console.log('[ZeusVault] Vault saved successfully');
      return true;
    } catch (error) {
      console.error('[ZeusVault] Error saving vault:', error);
      return false;
    }
  }

  // Restore vault from device storage
  async restoreVault(): Promise<VaultData | null> {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      let encryptedData: string | null = null;
      
      // Try internal storage
      const internalPath = VAULT_BACKUP_DIR + VAULT_FILENAME;
      
      try {
        encryptedData = await FileSystem.readAsStringAsync(internalPath);
        console.log('[ZeusVault] Found vault in internal storage');
      } catch (e) {
        console.log('[ZeusVault] No vault in internal storage');
      }
      
      // If not found, try external backup location on Android
      if (!encryptedData && Platform.OS === 'android') {
        try {
          const externalPath = FileSystem.documentDirectory + '../' + VAULT_FILENAME;
          encryptedData = await FileSystem.readAsStringAsync(externalPath);
          console.log('[ZeusVault] Found vault in external backup');
        } catch (e) {
          console.log('[ZeusVault] External backup not accessible');
        }
      }
      
      if (!encryptedData) {
        console.log('[ZeusVault] No vault backup found');
        return null;
      }
      
      const decryptedData = this.decrypt(encryptedData);
      const vaultData: VaultData = JSON.parse(decryptedData);
      
      console.log('[ZeusVault] Vault restored successfully, version:', vaultData.version);
      return vaultData;
    } catch (error) {
      console.error('[ZeusVault] Error restoring vault:', error);
      return null;
    }
  }

  // Apply restored vault data to AsyncStorage
  async applyVaultData(vault: VaultData): Promise<boolean> {
    try {
      // Real-Debrid
      if (vault.accounts.realDebrid) {
        await AsyncStorage.setItem(VAULT_KEYS.REAL_DEBRID_TOKEN, vault.accounts.realDebrid.token);
        if (vault.accounts.realDebrid.refreshToken) {
          await AsyncStorage.setItem(VAULT_KEYS.REAL_DEBRID_REFRESH_TOKEN, vault.accounts.realDebrid.refreshToken);
        }
        if (vault.accounts.realDebrid.expires) {
          await AsyncStorage.setItem(VAULT_KEYS.REAL_DEBRID_EXPIRES, vault.accounts.realDebrid.expires);
        }
      }

      // AllDebrid
      if (vault.accounts.allDebrid) {
        await AsyncStorage.setItem(VAULT_KEYS.ALLDEBRID_API_KEY, vault.accounts.allDebrid.apiKey);
        if (vault.accounts.allDebrid.username) {
          await AsyncStorage.setItem(VAULT_KEYS.ALLDEBRID_USERNAME, vault.accounts.allDebrid.username);
        }
      }

      // Premiumize
      if (vault.accounts.premiumize) {
        await AsyncStorage.setItem(VAULT_KEYS.PREMIUMIZE_API_KEY, vault.accounts.premiumize.apiKey);
        if (vault.accounts.premiumize.customerId) {
          await AsyncStorage.setItem(VAULT_KEYS.PREMIUMIZE_CUSTOMER_ID, vault.accounts.premiumize.customerId);
        }
      }

      // Trakt
      if (vault.accounts.trakt) {
        await AsyncStorage.setItem(VAULT_KEYS.TRAKT_ACCESS_TOKEN, vault.accounts.trakt.accessToken);
        if (vault.accounts.trakt.refreshToken) {
          await AsyncStorage.setItem(VAULT_KEYS.TRAKT_REFRESH_TOKEN, vault.accounts.trakt.refreshToken);
        }
        if (vault.accounts.trakt.expires) {
          await AsyncStorage.setItem(VAULT_KEYS.TRAKT_EXPIRES, vault.accounts.trakt.expires);
        }
      }

      // IPTV
      if (vault.accounts.iptv) {
        await AsyncStorage.setItem(VAULT_KEYS.IPTV_CONFIG, JSON.stringify(vault.accounts.iptv));
      }

      // OpenSubtitles
      if (vault.accounts.openSubtitles) {
        await AsyncStorage.setItem(VAULT_KEYS.OPENSUBTITLES_CONFIG, JSON.stringify(vault.accounts.openSubtitles));
      }

      // Settings
      if (vault.settings.torrentio) {
        await AsyncStorage.setItem(VAULT_KEYS.TORRENTIO_CONFIG, JSON.stringify(vault.settings.torrentio));
      }
      if (vault.settings.subtitles) {
        await AsyncStorage.setItem(VAULT_KEYS.SUBTITLE_SETTINGS, JSON.stringify(vault.settings.subtitles));
      }
      if (vault.settings.streamDefaults) {
        await AsyncStorage.setItem(VAULT_KEYS.STREAM_DEFAULT_SETTINGS, JSON.stringify(vault.settings.streamDefaults));
      }
      if (vault.settings.oneClickPlay) {
        await AsyncStorage.setItem(VAULT_KEYS.ONE_CLICK_PLAY_SETTINGS, JSON.stringify(vault.settings.oneClickPlay));
      }
      if (vault.settings.parentalControls) {
        await AsyncStorage.setItem(VAULT_KEYS.PARENTAL_CONTROLS, JSON.stringify(vault.settings.parentalControls));
      }

      // User Data
      if (vault.userData.favorites) {
        await AsyncStorage.setItem(VAULT_KEYS.FAVORITES, JSON.stringify(vault.userData.favorites));
      }
      if (vault.userData.watchHistory) {
        await AsyncStorage.setItem(VAULT_KEYS.WATCH_HISTORY, JSON.stringify(vault.userData.watchHistory));
      }
      if (vault.userData.continueWatching) {
        await AsyncStorage.setItem(VAULT_KEYS.CONTINUE_WATCHING, JSON.stringify(vault.userData.continueWatching));
      }
      if (vault.userData.iptvFavorites) {
        await AsyncStorage.setItem(VAULT_KEYS.IPTV_FAVORITES, JSON.stringify(vault.userData.iptvFavorites));
      }

      // Mark as restored
      await AsyncStorage.setItem('zeus_vault_restored', new Date().toISOString());
      
      console.log('[ZeusVault] Vault data applied successfully');
      return true;
    } catch (error) {
      console.error('[ZeusVault] Error applying vault data:', error);
      return false;
    }
  }

  // Check if vault exists and restore automatically
  async autoRestore(): Promise<{ restored: boolean; accountsRestored: string[] }> {
    const result = { restored: false, accountsRestored: [] as string[] };
    
    try {
      // Check if already restored in this session
      const alreadyRestored = await AsyncStorage.getItem('zeus_vault_restored');
      const vaultSaved = await AsyncStorage.getItem('zeus_vault_saved');
      
      // If vault was saved but not restored, attempt restore
      if (!alreadyRestored || !vaultSaved) {
        const vault = await this.restoreVault();
        
        if (vault) {
          await this.applyVaultData(vault);
          result.restored = true;
          
          // Track which accounts were restored
          if (vault.accounts.realDebrid) result.accountsRestored.push('Real-Debrid');
          if (vault.accounts.allDebrid) result.accountsRestored.push('AllDebrid');
          if (vault.accounts.premiumize) result.accountsRestored.push('Premiumize');
          if (vault.accounts.trakt) result.accountsRestored.push('Trakt');
          if (vault.accounts.iptv) result.accountsRestored.push('IPTV');
          if (vault.accounts.openSubtitles) result.accountsRestored.push('OpenSubtitles');
        }
      }
    } catch (error) {
      console.error('[ZeusVault] Auto-restore error:', error);
    }
    
    return result;
  }

  // Export vault as string (for manual backup/sharing)
  async exportVault(): Promise<string | null> {
    try {
      const vault = await this.collectVaultData();
      return JSON.stringify(vault, null, 2);
    } catch (error) {
      console.error('[ZeusVault] Export error:', error);
      return null;
    }
  }

  // Export vault to a file and share it
  async exportToFile(): Promise<boolean> {
    try {
      const vaultJson = await this.exportVault();
      if (!vaultJson) {
        Alert.alert('Error', 'Failed to collect vault data');
        return false;
      }

      // Create a temporary file
      const tempPath = FileSystem.cacheDirectory + `zeus_vault_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(tempPath, vaultJson);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(tempPath, {
          mimeType: 'application/json',
          dialogTitle: 'Export Zeus Vault',
        });
        console.log('[ZeusVault] Exported via share');
        return true;
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
        return false;
      }
    } catch (error) {
      console.error('[ZeusVault] Export to file error:', error);
      Alert.alert('Error', 'Failed to export vault');
      return false;
    }
  }

  // Import vault from a file picker
  async importFromFile(): Promise<boolean> {
    try {
      // Open file picker
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log('[ZeusVault] Import cancelled');
        return false;
      }

      const file = result.assets[0];
      
      // Read the file content
      const content = await FileSystem.readAsStringAsync(file.uri);
      
      // Import the vault
      const success = await this.importVault(content);
      
      if (success) {
        Alert.alert('Success', 'Vault restored successfully! Please restart the app.');
        console.log('[ZeusVault] Imported from file');
        return true;
      } else {
        Alert.alert('Error', 'Invalid vault file format');
        return false;
      }
    } catch (error) {
      console.error('[ZeusVault] Import from file error:', error);
      Alert.alert('Error', 'Failed to import vault');
      return false;
    }
  }

  // Import vault from string
  async importVault(vaultJson: string): Promise<boolean> {
    try {
      const vault: VaultData = JSON.parse(vaultJson);
      
      if (!vault.version || !vault.accounts) {
        throw new Error('Invalid vault format');
      }
      
      await this.applyVaultData(vault);
      await this.saveVault(); // Re-save to update local backup
      
      return true;
    } catch (error) {
      console.error('[ZeusVault] Import error:', error);
      return false;
    }
  }

  // Clear vault and all saved data
  async clearVault(): Promise<boolean> {
    try {
      // Delete vault file
      const internalPath = VAULT_BACKUP_DIR + VAULT_FILENAME;
      try {
        await FileSystem.deleteAsync(internalPath, { idempotent: true });
      } catch (e) {
        // File might not exist
      }
      
      // Clear vault markers
      await AsyncStorage.removeItem('zeus_vault_saved');
      await AsyncStorage.removeItem('zeus_vault_restored');
      
      console.log('[ZeusVault] Vault cleared');
      return true;
    } catch (error) {
      console.error('[ZeusVault] Clear error:', error);
      return false;
    }
  }

  // Get vault status
  async getVaultStatus(): Promise<{
    exists: boolean;
    lastSaved: string | null;
    lastRestored: string | null;
    accountCount: number;
  }> {
    let exists = false;
    let accountCount = 0;
    
    // FileSystem doesn't work on web, use AsyncStorage marker instead
    const lastSaved = await AsyncStorage.getItem('zeus_vault_saved');
    const lastRestored = await AsyncStorage.getItem('zeus_vault_restored');
    
    if (lastSaved) {
      exists = true;
      // Count accounts from AsyncStorage directly
      const rdToken = await AsyncStorage.getItem(VAULT_KEYS.REAL_DEBRID_TOKEN);
      const adKey = await AsyncStorage.getItem(VAULT_KEYS.ALLDEBRID_API_KEY);
      const pmKey = await AsyncStorage.getItem(VAULT_KEYS.PREMIUMIZE_API_KEY);
      const traktToken = await AsyncStorage.getItem(VAULT_KEYS.TRAKT_ACCESS_TOKEN);
      const iptvConfig = await AsyncStorage.getItem(VAULT_KEYS.IPTV_CONFIG);
      const openSubsConfig = await AsyncStorage.getItem(VAULT_KEYS.OPENSUBTITLES_CONFIG);
      
      if (rdToken) accountCount++;
      if (adKey) accountCount++;
      if (pmKey) accountCount++;
      if (traktToken) accountCount++;
      if (iptvConfig) accountCount++;
      if (openSubsConfig) accountCount++;
    }
    
    return {
      exists,
      lastSaved,
      lastRestored,
      accountCount,
    };
  }
}

export const zeusVaultService = new ZeusVaultService();
