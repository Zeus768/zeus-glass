import Constants from 'expo-constants';
import appJson from '../app.json';
import { storage } from '../utils/storage';
import { CHANGELOG, ChangelogEntry } from '../constants/changelog';

const LAST_SEEN_VERSION_KEY = 'last_seen_app_version';

export const versionService = {
  // Current version. Read from app.json at bundle time (reliable on web + native).
  // Fall back to expo-constants only if app.json import somehow fails.
  getCurrentVersion: (): string => {
    const fromAppJson = (appJson as any)?.expo?.version || (appJson as any)?.version;
    if (typeof fromAppJson === 'string' && fromAppJson.length > 0) return fromAppJson;
    const fromConstants =
      (Constants?.expoConfig as any)?.version ||
      (Constants as any)?.manifest?.version;
    return typeof fromConstants === 'string' && fromConstants.length > 0 ? fromConstants : '0.0.0';
  },

  getLastSeenVersion: async (): Promise<string | null> => {
    return await storage.getItem(LAST_SEEN_VERSION_KEY);
  },

  markCurrentVersionSeen: async (): Promise<void> => {
    await storage.setItem(LAST_SEEN_VERSION_KEY, versionService.getCurrentVersion());
  },

  // Returns true the first time the user opens the app on a NEW version.
  isFirstLaunchAfterUpdate: async (): Promise<boolean> => {
    const current = versionService.getCurrentVersion();
    const lastSeen = await versionService.getLastSeenVersion();
    // First-ever launch: don't pop a changelog
    if (!lastSeen) {
      await versionService.markCurrentVersionSeen();
      return false;
    }
    return lastSeen !== current;
  },

  // Return all changelog entries newer than `since`. If `since` is null, returns all.
  getChangelogSince: (since: string | null): ChangelogEntry[] => {
    if (!since) return CHANGELOG;
    const sinceParts = parseVersion(since);
    return CHANGELOG.filter((entry) => compareVersions(parseVersion(entry.version), sinceParts) > 0);
  },

  getAllChangelog: (): ChangelogEntry[] => CHANGELOG,
};

function parseVersion(v: string): number[] {
  return v.split('.').map((n) => parseInt(n, 10) || 0);
}

function compareVersions(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}
