import Constants from 'expo-constants';

// API Configuration
// Fallback keys for development/web
const FALLBACK_TMDB_KEY = 'f15af109700aab95d564acda15bdcd97';
const FALLBACK_TRAKT_CLIENT_ID = '4cb0f37f73fc75a20dee4176591d04845a4f942cb386a7e9e33a2e9fb480593e';
const FALLBACK_TRAKT_CLIENT_SECRET = 'f7ab784c37688345eb0585b342b6b153a499926eed7b84c89df24789bf5ddf09';

export const TMDB_API_KEY = Constants.expoConfig?.extra?.tmdbApiKey || FALLBACK_TMDB_KEY;
export const TRAKT_CLIENT_ID = Constants.expoConfig?.extra?.traktClientId || FALLBACK_TRAKT_CLIENT_ID;
export const TRAKT_CLIENT_SECRET = Constants.expoConfig?.extra?.traktClientSecret || FALLBACK_TRAKT_CLIENT_SECRET;

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

// TorBox
export const TORBOX_BASE_URL = 'https://api.torbox.app';
export const TORBOX_AGENT = 'zeus-glass';

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
  TORBOX_TOKEN: 'torbox_token',
  IPTV_CONFIG: 'iptv_config',
  FAVORITES: 'favorites',
  CONTINUE_WATCHING: 'continue_watching',
};
