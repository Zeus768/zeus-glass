// Changelog entries shown to the user after every app update.
// Add a new entry at the TOP whenever you ship a new version.

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  highlights: string[]; // Short user-facing notes
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.6.0',
    date: '2026-02-15',
    highlights: [
      'TorBox / AllDebrid / Premiumize can now resolve torrents — no longer requires Real-Debrid',
      'Cache (⚡) badges now work for TorBox users',
      'Stream picker dialog now shows which debrid service is being used',
      'New: In-app version & changelog screen',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-02-01',
    highlights: [
      'Fixed Android TV D-pad focus throughout the app (all interactive items)',
      'Rebuilt Settings screen for proper TV navigation',
      'New full-screen Stream Picker with quality tabs',
      'Added Comet and Meteor scrapers',
      'Trakt deep integration: Watchlist, Collection, History tabs',
      'TorBox debrid integration (device code + manual API key)',
      'Multi-fallback debug uploader (paste.rs / GoFile)',
      'Fixed Shield TV startup crash on expo-notifications',
    ],
  },
];
