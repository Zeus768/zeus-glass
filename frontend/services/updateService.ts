import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

const NEXTCLOUD_SHARE_TOKEN = 'bnZJZ36W9LNSzyQ';
const NEXTCLOUD_BASE = 'https://nextcloud.rs-s.co.uk';
const WEBDAV_BASE = `${NEXTCLOUD_BASE}/public.php/webdav`;

// Auth header for Nextcloud public share WebDAV
const getAuthHeaders = () => ({
  Authorization: `Basic ${btoa(`${NEXTCLOUD_SHARE_TOKEN}:`)}`,
});

export interface UpdateInfo {
  version: string;
  versionCode: number;
  buildNumber?: number;
  apkFilename: string;
  changelog: string;
  forceUpdate: boolean;
  minVersion?: string;
}

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  percentage: number;
}

class UpdateService {
  private currentVersion: string;
  private downloadResumable: FileSystem.DownloadResumable | null = null;

  constructor() {
    this.currentVersion = Constants.expoConfig?.version || '1.5.0';
  }

  getCurrentVersion(): string {
    return this.currentVersion;
  }

  getCurrentBuildNumber(): number {
    try {
      const versionData = require('../version.json');
      return versionData.buildNumber || 0;
    } catch {
      return 0;
    }
  }

  // Compare version strings (e.g., "1.5.0" vs "1.6.0")
  private isNewerVersion(remote: string, local: string): boolean {
    const remoteParts = remote.split('.').map(Number);
    const localParts = local.split('.').map(Number);

    for (let i = 0; i < Math.max(remoteParts.length, localParts.length); i++) {
      const r = remoteParts[i] || 0;
      const l = localParts[i] || 0;
      if (r > l) return true;
      if (r < l) return false;
    }
    return false;
  }

  // Fetch version.json from Nextcloud share
  async checkForUpdate(): Promise<UpdateInfo | null> {
    if (Platform.OS !== 'android') return null;

    try {
      const url = `${WEBDAV_BASE}/version.json`;
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        console.log('[Update] version.json not found or inaccessible:', response.status);
        return null;
      }

      const updateInfo: UpdateInfo = await response.json();

      // Check by buildNumber first (catches ALL changes), fallback to version string
      const localBuildNumber = this.getCurrentBuildNumber();
      if (updateInfo.buildNumber && localBuildNumber && updateInfo.buildNumber > localBuildNumber) {
        console.log(`[Update] New build available: ${updateInfo.buildNumber} (current: ${localBuildNumber})`);
        return updateInfo;
      }

      if (this.isNewerVersion(updateInfo.version, this.currentVersion)) {
        console.log(`[Update] New version available: ${updateInfo.version} (current: ${this.currentVersion})`);
        return updateInfo;
      }

      console.log(`[Update] App is up to date (${this.currentVersion})`);
      return null;
    } catch (error) {
      console.log('[Update] Failed to check for updates:', error);
      return null;
    }
  }

  // Download APK with progress tracking
  async downloadUpdate(
    updateInfo: UpdateInfo,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<string | null> {
    try {
      const apkFilename = updateInfo.apkFilename || 'zeus-glass-release.apk';
      const downloadUrl = `${WEBDAV_BASE}/${apkFilename}`;
      const localUri = `${FileSystem.cacheDirectory}${apkFilename}`;

      // Delete old file if exists
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      }

      console.log(`[Update] Downloading from: ${downloadUrl}`);

      const callback = (downloadProgress: FileSystem.DownloadProgressData) => {
        const percentage = downloadProgress.totalBytesExpectedToWrite > 0
          ? Math.round((downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100)
          : 0;
        onProgress({
          totalBytesWritten: downloadProgress.totalBytesWritten,
          totalBytesExpectedToWrite: downloadProgress.totalBytesExpectedToWrite,
          percentage,
        });
      };

      this.downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localUri,
        {
          headers: getAuthHeaders(),
        },
        callback
      );

      const result = await this.downloadResumable.downloadAsync();
      if (result?.uri) {
        console.log(`[Update] Download complete: ${result.uri}`);
        return result.uri;
      }

      return null;
    } catch (error) {
      console.error('[Update] Download failed:', error);
      return null;
    }
  }

  // Cancel ongoing download
  cancelDownload() {
    if (this.downloadResumable) {
      this.downloadResumable.pauseAsync();
      this.downloadResumable = null;
    }
  }

  // Install the downloaded APK
  async installUpdate(localUri: string): Promise<boolean> {
    try {
      // Convert file:// URI to content:// URI for Android 7+
      const contentUri = await FileSystem.getContentUriAsync(localUri);
      console.log(`[Update] Installing from content URI: ${contentUri}`);

      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      });

      return true;
    } catch (error) {
      console.error('[Update] Install failed:', error);
      // Fallback: try with INSTALL_PACKAGE action
      try {
        const contentUri = await FileSystem.getContentUriAsync(localUri);
        await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
          data: contentUri,
          flags: 1,
        });
        return true;
      } catch (fallbackError) {
        console.error('[Update] Fallback install also failed:', fallbackError);
        Alert.alert(
          'Install Failed',
          'Could not install the update automatically. Please enable "Install from Unknown Sources" in your device settings and try again.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
  }

  // Format file size for display
  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

export const updateService = new UpdateService();
