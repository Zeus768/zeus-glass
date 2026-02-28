import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { TRAKT_BASE_URL, TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET, STORAGE_KEYS, APP_SCHEME } from '../config/constants';
import { TraktToken, TraktUser, ContinueWatching } from '../types';

const traktApi = axios.create({
  baseURL: TRAKT_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': TRAKT_CLIENT_ID,
  },
});

// Add auth token to requests
traktApi.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(STORAGE_KEYS.TRAKT_TOKEN);
  if (token) {
    const tokenData: TraktToken = JSON.parse(token);
    config.headers.Authorization = `Bearer ${tokenData.access_token}`;
  }
  return config;
});

export const traktService = {
  // Device Code Flow
  getDeviceCode: async (): Promise<{ device_code: string; user_code: string; verification_url: string; expires_in: number; interval: number }> => {
    const response = await traktApi.post('/oauth/device/code', {
      client_id: TRAKT_CLIENT_ID,
    });
    return response.data;
  },

  pollForToken: async (deviceCode: string): Promise<TraktToken | null> => {
    try {
      const response = await traktApi.post('/oauth/device/token', {
        code: deviceCode,
        client_id: TRAKT_CLIENT_ID,
        client_secret: TRAKT_CLIENT_SECRET,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        return null; // Still pending
      }
      throw error;
    }
  },

  saveToken: async (token: TraktToken): Promise<void> => {
    await SecureStore.setItemAsync(STORAGE_KEYS.TRAKT_TOKEN, JSON.stringify(token));
  },

  getToken: async (): Promise<TraktToken | null> => {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.TRAKT_TOKEN);
    return token ? JSON.parse(token) : null;
  },

  logout: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.TRAKT_TOKEN);
  },

  // User
  getCurrentUser: async (): Promise<TraktUser> => {
    const response = await traktApi.get('/users/me');
    return response.data;
  },

  // Continue Watching
  getWatchedProgress: async (): Promise<ContinueWatching[]> => {
    try {
      const response = await traktApi.get('/sync/playback');
      return response.data.map((item: any) => ({
        media: item.movie || item.show,
        progress: item.progress,
        lastWatched: item.paused_at,
        type: item.type,
      }));
    } catch (error) {
      console.error('Error fetching continue watching:', error);
      return [];
    }
  },

  // Scrobble
  startWatching: async (type: 'movie' | 'tv', id: number, progress: number): Promise<void> => {
    await traktApi.post('/scrobble/start', {
      [type]: { ids: { tmdb: id } },
      progress,
    });
  },

  pauseWatching: async (type: 'movie' | 'tv', id: number, progress: number): Promise<void> => {
    await traktApi.post('/scrobble/pause', {
      [type]: { ids: { tmdb: id } },
      progress,
    });
  },

  stopWatching: async (type: 'movie' | 'tv', id: number, progress: number): Promise<void> => {
    await traktApi.post('/scrobble/stop', {
      [type]: { ids: { tmdb: id } },
      progress,
    });
  },
};
