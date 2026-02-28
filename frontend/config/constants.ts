import Constants from 'expo-constants';

// API Configuration
export const TMDB_API_KEY = Constants.expoConfig?.extra?.tmdbApiKey || '';
export const TRAKT_CLIENT_ID = Constants.expoConfig?.extra?.traktClientId || '';
export const TRAKT_CLIENT_SECRET = Constants.expoConfig?.extra?.traktClientSecret || '';

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
export const TRAKT_BASE_URL = 'https://api.trakt.tv';

// Debrid Services
export const REAL_DEBRID_BASE_URL = 'https://api.real-debrid.com';
export const REAL_DEBRID_CLIENT_ID = 'X245A4XAIBGVM';

export const ALLDEBRID_BASE_URL = 'https://api.alldebrid.com';
export const ALLDEBRID_CLIENT_ID = 'zeus-glass-app';

export const PREMIUMIZE_BASE_URL = 'https://www.premiumize.me/api';
export const PREMIUMIZE_CLIENT_ID = 'zeus-glass-app';

// App Configuration
export const APP_NAME = 'Zeus Glass';
export const APP_SCHEME = 'zeusglass';

// Quality options
export const QUALITY_OPTIONS = [
  { label: '4K', value: '2160p', priority: 1 },
  { label: '1080p', value: '1080p', priority: 2 },
  { label: '720p', value: '720p', priority: 3 },
  { label: 'SD', value: '480p', priority: 4 },
];

// Storage Keys
export const STORAGE_KEYS = {
  TRAKT_TOKEN: 'trakt_token',
  REAL_DEBRID_TOKEN: 'real_debrid_token',
  ALLDEBRID_TOKEN: 'alldebrid_token',
  PREMIUMIZE_TOKEN: 'premiumize_token',
  IPTV_CONFIG: 'iptv_config',
  FAVORITES: 'favorites',
  CONTINUE_WATCHING: 'continue_watching',
};
