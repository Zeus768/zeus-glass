import axios from 'axios';
import { storage } from '../utils/storage';
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
  const token = await storage.getItem(STORAGE_KEYS.TRAKT_TOKEN);
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
    await storage.setItem(STORAGE_KEYS.TRAKT_TOKEN, JSON.stringify(token));
  },

  getToken: async (): Promise<TraktToken | null> => {
    const token = await storage.getItem(STORAGE_KEYS.TRAKT_TOKEN);
    return token ? JSON.parse(token) : null;
  },

  logout: async (): Promise<void> => {
    await storage.deleteItem(STORAGE_KEYS.TRAKT_TOKEN);
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await traktService.getToken();
    return token !== null;
  },

  // User
  getCurrentUser: async (): Promise<TraktUser> => {
    const response = await traktApi.get('/users/me');
    return response.data;
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
