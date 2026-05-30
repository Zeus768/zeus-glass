import axios from 'axios';
import { Linking } from 'react-native';
import { versionService } from './versionService';
import { storage } from '../utils/storage';
import { GITHUB_RELEASES_REPO } from '../config/constants';

const LAST_CHECK_KEY = 'update_last_check_ts';
const LAST_DISMISSED_VERSION_KEY = 'update_dismissed_version';
const CHECK_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseNotes: string;
  downloadUrl: string | null;
  releasePageUrl: string | null;
  publishedAt: string | null;
}

const stripVPrefix = (tag: string): string => tag.replace(/^v/i, '').trim();

const parseVersion = (v: string): number[] =>
  v.split(/[.\-+]/).map((n) => parseInt(n, 10) || 0);

const isNewer = (a: string, b: string): boolean => {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const x = av[i] ?? 0;
    const y = bv[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
};

export const updateChecker = {
  isConfigured: (): boolean => GITHUB_RELEASES_REPO.trim().length > 0,

  // Fetches latest release. Returns null if unconfigured / network error.
  checkForUpdate: async (force = false): Promise<UpdateInfo | null> => {
    const currentVersion = versionService.getCurrentVersion();
    const repo = GITHUB_RELEASES_REPO.trim();
    if (!repo) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: null,
        releaseNotes: '',
        downloadUrl: null,
        releasePageUrl: null,
        publishedAt: null,
      };
    }

    // Respect cooldown unless forced
    if (!force) {
      try {
        const lastRaw = await storage.getItem(LAST_CHECK_KEY);
        if (lastRaw) {
          const last = parseInt(lastRaw, 10);
          if (!Number.isNaN(last) && Date.now() - last < CHECK_COOLDOWN_MS) {
            return null;
          }
        }
      } catch {}
    }

    try {
      const resp = await axios.get(
        `https://api.github.com/repos/${repo}/releases/latest`,
        {
          headers: { Accept: 'application/vnd.github+json' },
          timeout: 10000,
        }
      );
      await storage.setItem(LAST_CHECK_KEY, String(Date.now()));

      const data = resp.data || {};
      const latestVersion = stripVPrefix(String(data.tag_name || ''));
      const apkAsset =
        Array.isArray(data.assets)
          ? data.assets.find((a: any) => /\.apk$/i.test(a?.name || ''))
          : null;
      const downloadUrl = apkAsset?.browser_download_url || null;
      const releasePageUrl = data.html_url || null;
      const hasUpdate = !!latestVersion && isNewer(latestVersion, currentVersion);

      return {
        hasUpdate,
        currentVersion,
        latestVersion,
        releaseNotes: String(data.body || '').trim(),
        downloadUrl,
        releasePageUrl,
        publishedAt: data.published_at || null,
      };
    } catch (e) {
      // Silent failure — don't bother the user with network errors.
      return null;
    }
  },

  // Returns true if the user already dismissed THIS specific latest version
  isVersionDismissed: async (version: string): Promise<boolean> => {
    try {
      const v = await storage.getItem(LAST_DISMISSED_VERSION_KEY);
      return v === version;
    } catch {
      return false;
    }
  },

  dismissVersion: async (version: string): Promise<void> => {
    try {
      await storage.setItem(LAST_DISMISSED_VERSION_KEY, version);
    } catch {}
  },

  openDownload: async (info: UpdateInfo): Promise<void> => {
    const url = info.downloadUrl || info.releasePageUrl;
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {}
  },
};
