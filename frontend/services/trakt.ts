import axios from 'axios';
import { Platform } from 'react-native';
import { storage } from '../utils/storage';
import { TRAKT_BASE_URL, TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET, STORAGE_KEYS, APP_SCHEME } from '../config/constants';
import { TraktToken, TraktUser, ContinueWatching } from '../types';

const getBackendUrl = () => process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Check if we need to use the proxy (web environment)
const shouldUseProxy = () => {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') return true;
  return Platform.OS === 'web';
};

const traktApi = axios.create({
  baseURL: TRAKT_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': TRAKT_CLIENT_ID,
  },
});

// Add auth token to requests - with safety guard to prevent crashes
traktApi.interceptors.request.use(async (config) => {
  try {
    const token = await storage.getItem(STORAGE_KEYS.TRAKT_TOKEN);
    if (token) {
      const tokenData: TraktToken = JSON.parse(token);
      if (tokenData && tokenData.access_token) {
        config.headers.Authorization = `Bearer ${tokenData.access_token}`;
      }
    }
  } catch (e) {
    console.warn('[Trakt] Failed to get token for request:', e);
  }
  return config;
});

export const traktService = {
  // Device Code Flow - with proxy fallback
  getDeviceCode: async (): Promise<{ device_code: string; user_code: string; verification_url: string; expires_in: number; interval: number }> => {
    try {
      // Try direct first
      const response = await traktApi.post('/oauth/device/code', {
        client_id: TRAKT_CLIENT_ID,
      });
      console.log('[Trakt] Device code obtained directly');
      return response.data;
    } catch (directError: any) {
      console.warn('[Trakt] Direct API failed, trying proxy:', directError.message);
      // Fallback to backend proxy
      const backendUrl = getBackendUrl();
      const response = await axios.post(`${backendUrl}/api/trakt/device/code`);
      console.log('[Trakt] Device code obtained via proxy');
      return response.data;
    }
  },

  pollForToken: async (deviceCode: string): Promise<TraktToken | null> => {
    try {
      // Try direct first
      const response = await traktApi.post('/oauth/device/token', {
        code: deviceCode,
        client_id: TRAKT_CLIENT_ID,
        client_secret: TRAKT_CLIENT_SECRET,
      });
      console.log('[Trakt] Token obtained directly');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        return null; // Still pending
      }
      // Try proxy on other errors
      try {
        console.warn('[Trakt] Direct poll failed, trying proxy:', error.message);
        const backendUrl = getBackendUrl();
        const response = await axios.post(`${backendUrl}/api/trakt/device/token`, null, {
          params: {
            code: deviceCode,
            client_id: TRAKT_CLIENT_ID,
            client_secret: TRAKT_CLIENT_SECRET,
          },
        });
        if (response.data.status_code === 200 && response.data.data) {
          console.log('[Trakt] Token obtained via proxy');
          return response.data.data;
        }
        return null; // Still pending
      } catch (proxyError) {
        return null;
      }
    }
  },

  saveToken: async (token: TraktToken): Promise<void> => {
    await storage.setItem(STORAGE_KEYS.TRAKT_TOKEN, JSON.stringify(token));
  },

  getToken: async (): Promise<TraktToken | null> => {
    try {
      const token = await storage.getItem(STORAGE_KEYS.TRAKT_TOKEN);
      if (!token) return null;
      const parsed = JSON.parse(token);
      return parsed && parsed.access_token ? parsed : null;
    } catch (e) {
      console.warn('[Trakt] Failed to parse token:', e);
      return null;
    }
  },

  logout: async (): Promise<void> => {
    try {
      await storage.deleteItem(STORAGE_KEYS.TRAKT_TOKEN);
    } catch (e) {
      console.warn('[Trakt] Logout error:', e);
    }
  },

  isAuthenticated: async (): Promise<boolean> => {
    try {
      const token = await traktService.getToken();
      return token !== null;
    } catch (e) {
      return false;
    }
  },

  // User
  getCurrentUser: async (): Promise<TraktUser | null> => {
    try {
      const response = await traktApi.get('/users/me');
      return response.data;
    } catch (e) {
      console.warn('[Trakt] Failed to get current user:', e);
      return null;
    }
  },

  // Continue Watching (Playback Progress)
  getWatchedProgress: async (): Promise<ContinueWatching[]> => {
    try {
      const response = await traktApi.get('/sync/playback');
      return response.data.map((item: any) => ({
        media: item.movie || item.show,
        progress: item.progress,
        lastWatched: item.paused_at,
        type: item.type,
        // Add TMDB IDs for easy lookup
        tmdbId: item.movie?.ids?.tmdb || item.show?.ids?.tmdb,
        imdbId: item.movie?.ids?.imdb || item.show?.ids?.imdb,
      }));
    } catch (error) {
      console.error('[Trakt] Error fetching continue watching:', error);
      return [];
    }
  },

  // Watchlist (Movies the user wants to watch)
  getWatchlistMovies: async (): Promise<any[]> => {
    try {
      const response = await traktApi.get('/sync/watchlist/movies', {
        params: { extended: 'full' },
      });
      return response.data.map((item: any) => ({
        id: item.movie.ids.tmdb,
        title: item.movie.title,
        year: item.movie.year,
        overview: item.movie.overview,
        rating: item.movie.rating,
        poster_path: null, // Will need to fetch from TMDB
        backdrop_path: null,
        trakt_id: item.movie.ids.trakt,
        imdb_id: item.movie.ids.imdb,
        listed_at: item.listed_at,
        type: 'movie',
      }));
    } catch (error) {
      console.error('[Trakt] Error fetching watchlist movies:', error);
      return [];
    }
  },

  // Watchlist (TV Shows the user wants to watch)
  getWatchlistShows: async (): Promise<any[]> => {
    try {
      const response = await traktApi.get('/sync/watchlist/shows', {
        params: { extended: 'full' },
      });
      return response.data.map((item: any) => ({
        id: item.show.ids.tmdb,
        name: item.show.title,
        year: item.show.year,
        overview: item.show.overview,
        rating: item.show.rating,
        poster_path: null,
        backdrop_path: null,
        trakt_id: item.show.ids.trakt,
        imdb_id: item.show.ids.imdb,
        listed_at: item.listed_at,
        type: 'tv',
      }));
    } catch (error) {
      console.error('[Trakt] Error fetching watchlist shows:', error);
      return [];
    }
  },

  // User's Favorites (Collection)
  getCollectionMovies: async (): Promise<any[]> => {
    try {
      const response = await traktApi.get('/sync/collection/movies', {
        params: { extended: 'full' },
      });
      return response.data.map((item: any) => ({
        id: item.movie.ids.tmdb,
        title: item.movie.title,
        year: item.movie.year,
        overview: item.movie.overview,
        rating: item.movie.rating,
        poster_path: null,
        backdrop_path: null,
        trakt_id: item.movie.ids.trakt,
        imdb_id: item.movie.ids.imdb,
        collected_at: item.collected_at,
        type: 'movie',
      }));
    } catch (error) {
      console.error('[Trakt] Error fetching collection movies:', error);
      return [];
    }
  },

  // Recently Watched (History)
  getRecentlyWatched: async (limit: number = 20): Promise<any[]> => {
    try {
      const response = await traktApi.get('/users/me/history', {
        params: { limit, extended: 'full' },
      });
      return response.data.map((item: any) => {
        const media = item.movie || item.show;
        return {
          id: media?.ids?.tmdb,
          title: item.movie?.title || item.show?.title,
          year: media?.year,
          overview: media?.overview,
          rating: media?.rating,
          poster_path: null,
          backdrop_path: null,
          trakt_id: media?.ids?.trakt,
          imdb_id: media?.ids?.imdb,
          watched_at: item.watched_at,
          type: item.type === 'movie' ? 'movie' : 'tv',
        };
      });
    } catch (error) {
      console.error('[Trakt] Error fetching recently watched:', error);
      return [];
    }
  },

  // Add to Watchlist
  addToWatchlist: async (type: 'movie' | 'show', tmdbId: number): Promise<boolean> => {
    try {
      await traktApi.post('/sync/watchlist', {
        [type === 'movie' ? 'movies' : 'shows']: [{ ids: { tmdb: tmdbId } }],
      });
      return true;
    } catch (error) {
      console.error('[Trakt] Error adding to watchlist:', error);
      return false;
    }
  },

  // Remove from Watchlist
  removeFromWatchlist: async (type: 'movie' | 'show', tmdbId: number): Promise<boolean> => {
    try {
      await traktApi.post('/sync/watchlist/remove', {
        [type === 'movie' ? 'movies' : 'shows']: [{ ids: { tmdb: tmdbId } }],
      });
      return true;
    } catch (error) {
      console.error('[Trakt] Error removing from watchlist:', error);
      return false;
    }
  },

  // Check if item is in watchlist
  isInWatchlist: async (type: 'movie' | 'show', tmdbId: number): Promise<boolean> => {
    try {
      const list = type === 'movie' 
        ? await traktService.getWatchlistMovies()
        : await traktService.getWatchlistShows();
      return list.some(item => item.id === tmdbId);
    } catch (error) {
      return false;
    }
  },

  // Get watched movies (TMDB IDs set)
  getWatchedMovies: async (): Promise<Set<number>> => {
    try {
      const response = await traktApi.get('/sync/watched/movies');
      const ids = new Set<number>();
      response.data?.forEach((item: any) => {
        const tmdbId = item.movie?.ids?.tmdb;
        if (tmdbId) ids.add(tmdbId);
      });
      return ids;
    } catch (e) {
      console.warn('[Trakt] Failed to get watched movies:', e);
      return new Set();
    }
  },

  // Get watched shows (TMDB IDs set)
  getWatchedShows: async (): Promise<Set<number>> => {
    try {
      const response = await traktApi.get('/sync/watched/shows');
      const ids = new Set<number>();
      response.data?.forEach((item: any) => {
        const tmdbId = item.show?.ids?.tmdb;
        if (tmdbId) ids.add(tmdbId);
      });
      return ids;
    } catch (e) {
      console.warn('[Trakt] Failed to get watched shows:', e);
      return new Set();
    }
  },

  // Get watched shows with full IDs (for Next Up)
  getWatchedShowsWithIds: async (): Promise<Array<{
    tmdbId: number;
    traktId: number;
    title: string;
    year?: number;
  }>> => {
    try {
      const response = await traktApi.get('/sync/watched/shows');
      return (response.data || [])
        .filter((item: any) => item.show?.ids?.tmdb && item.show?.ids?.trakt)
        .map((item: any) => ({
          tmdbId: item.show.ids.tmdb,
          traktId: item.show.ids.trakt,
          title: item.show.title,
          year: item.show.year,
        }));
    } catch (e) {
      console.warn('[Trakt] Failed to get watched shows with ids:', e);
      return [];
    }
  },

  // Mark movie as watched
  markAsWatched: async (type: 'movie' | 'show', ids: { imdb?: string; tmdb?: number }): Promise<boolean> => {
    try {
      const key = type === 'movie' ? 'movies' : 'shows';
      await traktApi.post('/sync/history', {
        [key]: [{ ids, watched_at: new Date().toISOString() }],
      });
      return true;
    } catch (e) {
      console.warn('[Trakt] Failed to mark as watched:', e);
      return false;
    }
  },

  // Get next up episode for a show
  getShowProgress: async (traktId: number): Promise<{
    nextEpisode: { season: number; number: number; title: string } | null;
    completed: number;
    aired: number;
  } | null> => {
    try {
      const response = await traktApi.get(`/shows/${traktId}/progress/watched`, {
        params: { hidden: false, specials: false, count_specials: false },
      });
      const data = response.data;
      return {
        nextEpisode: data.next_episode ? {
          season: data.next_episode.season,
          number: data.next_episode.number,
          title: data.next_episode.title || `Episode ${data.next_episode.number}`,
        } : null,
        completed: data.completed || 0,
        aired: data.aired || 0,
      };
    } catch (e) {
      console.warn('[Trakt] Failed to get show progress:', e);
      return null;
    }
  },

  // Scrobble - with IMDB ID support
  startWatching: async (ids: { imdb?: string; tmdb?: number }, progress: number, season?: number, episode?: number): Promise<void> => {
    try {
      const body: any = { progress };
      if (season !== undefined && episode !== undefined) {
        body.show = { ids };
        body.episode = { season, number: episode };
      } else {
        body.movie = { ids };
      }
      await traktApi.post('/scrobble/start', body);
    } catch (e) {
      console.warn('[Trakt] Scrobble start failed:', e);
    }
  },

  pauseWatching: async (ids: { imdb?: string; tmdb?: number }, progress: number, season?: number, episode?: number): Promise<void> => {
    try {
      const body: any = { progress };
      if (season !== undefined && episode !== undefined) {
        body.show = { ids };
        body.episode = { season, number: episode };
      } else {
        body.movie = { ids };
      }
      await traktApi.post('/scrobble/pause', body);
    } catch (e) {
      console.warn('[Trakt] Scrobble pause failed:', e);
    }
  },

  stopWatching: async (ids: { imdb?: string; tmdb?: number }, progress: number, season?: number, episode?: number): Promise<void> => {
    try {
      const body: any = { progress };
      if (season !== undefined && episode !== undefined) {
        body.show = { ids };
        body.episode = { season, number: episode };
      } else {
        body.movie = { ids };
      }
      await traktApi.post('/scrobble/stop', body);
    } catch (e) {
      console.warn('[Trakt] Scrobble stop failed:', e);
    }
  },
};
