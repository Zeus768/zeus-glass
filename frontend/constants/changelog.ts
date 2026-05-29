// Changelog entries shown to the user after every app update.
// Add a new entry at the TOP whenever you ship a new version.

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  highlights: string[]; // Short user-facing notes
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.6.2',
    date: '2026-02-15',
    highlights: [
      'CRITICAL: Fixed TV Guide crash ("Rendered more hooks than during the previous render") — the page now loads cleanly every time',
      'IPTV account card now shows the real expiry date (e.g. "6 Oct 2026 (235 days left)") instead of the duplicated "in 12 days / 12 days" — also handles lifetime accounts and alternate exp_date formats (ms / ISO strings)',
      'Defensive parsing of IPTV exp_date — handles unix seconds, milliseconds, and date strings so the displayed expiry always matches what the server reports',
    ],
  },
  {
    version: '1.6.1',
    date: '2026-02-15',
    highlights: [
      'CRITICAL fix: IPTV login no longer fails with "Invalid credentials" on Android APK / TV — enabled cleartext HTTP traffic so Xtreme Codes servers (http://) can be reached',
      'IPTV: live channels, VOD, series and stream playback all work on plain-HTTP servers again',
      'Smarter IPTV login: honours your typed protocol (http vs https) and shows a clearer "cannot reach server" vs "invalid credentials" error',
    ],
  },
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
