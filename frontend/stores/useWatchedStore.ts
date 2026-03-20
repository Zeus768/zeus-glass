import { create } from 'zustand';
import { traktService } from '../services/trakt';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WATCHED_MOVIES_KEY = '@zeus_watched_movies';
const WATCHED_SHOWS_KEY = '@zeus_watched_shows';
const LAST_SYNC_KEY = '@zeus_watched_last_sync';

interface WatchedStore {
  watchedMovies: Set<number>;
  watchedShows: Set<number>;
  isLoading: boolean;
  lastSynced: Date | null;
  isTraktConnected: boolean;
  
  // Actions
  syncFromTrakt: () => Promise<void>;
  isMovieWatched: (tmdbId: number) => boolean;
  isShowWatched: (tmdbId: number) => boolean;
  markMovieWatched: (tmdbId: number) => void;
  markShowWatched: (tmdbId: number) => void;
  setTraktConnected: (connected: boolean) => void;
  loadFromCache: () => Promise<void>;
}

export const useWatchedStore = create<WatchedStore>((set, get) => ({
  watchedMovies: new Set(),
  watchedShows: new Set(),
  isLoading: false,
  lastSynced: null,
  isTraktConnected: false,

  setTraktConnected: (connected: boolean) => {
    set({ isTraktConnected: connected });
    if (connected) {
      get().syncFromTrakt();
    }
  },

  loadFromCache: async () => {
    try {
      const [moviesJson, showsJson, lastSyncStr] = await Promise.all([
        AsyncStorage.getItem(WATCHED_MOVIES_KEY),
        AsyncStorage.getItem(WATCHED_SHOWS_KEY),
        AsyncStorage.getItem(LAST_SYNC_KEY),
      ]);

      const movies = moviesJson ? new Set<number>(JSON.parse(moviesJson)) : new Set<number>();
      const shows = showsJson ? new Set<number>(JSON.parse(showsJson)) : new Set<number>();
      const lastSynced = lastSyncStr ? new Date(lastSyncStr) : null;

      set({
        watchedMovies: movies,
        watchedShows: shows,
        lastSynced,
      });

      console.log(`[WatchedStore] Loaded from cache: ${movies.size} movies, ${shows.size} shows`);
    } catch (error) {
      console.warn('[WatchedStore] Failed to load from cache:', error);
    }
  },

  syncFromTrakt: async () => {
    const { isTraktConnected, isLoading } = get();
    
    if (!isTraktConnected || isLoading) {
      return;
    }

    set({ isLoading: true });

    try {
      // Check if Trakt is authenticated
      const isLoggedIn = await traktService.isLoggedIn();
      if (!isLoggedIn) {
        set({ isLoading: false, isTraktConnected: false });
        return;
      }

      // Fetch watched items from Trakt
      const [movies, shows] = await Promise.all([
        traktService.getWatchedMovies(),
        traktService.getWatchedShows(),
      ]);

      const now = new Date();

      // Save to AsyncStorage for offline access
      await Promise.all([
        AsyncStorage.setItem(WATCHED_MOVIES_KEY, JSON.stringify([...movies])),
        AsyncStorage.setItem(WATCHED_SHOWS_KEY, JSON.stringify([...shows])),
        AsyncStorage.setItem(LAST_SYNC_KEY, now.toISOString()),
      ]);

      set({
        watchedMovies: movies,
        watchedShows: shows,
        lastSynced: now,
        isLoading: false,
      });

      console.log(`[WatchedStore] Synced from Trakt: ${movies.size} movies, ${shows.size} shows`);
    } catch (error) {
      console.warn('[WatchedStore] Failed to sync from Trakt:', error);
      set({ isLoading: false });
    }
  },

  isMovieWatched: (tmdbId: number) => {
    return get().watchedMovies.has(tmdbId);
  },

  isShowWatched: (tmdbId: number) => {
    return get().watchedShows.has(tmdbId);
  },

  markMovieWatched: (tmdbId: number) => {
    const { watchedMovies } = get();
    const newSet = new Set(watchedMovies);
    newSet.add(tmdbId);
    set({ watchedMovies: newSet });
    
    // Persist to cache
    AsyncStorage.setItem(WATCHED_MOVIES_KEY, JSON.stringify([...newSet])).catch(() => {});
  },

  markShowWatched: (tmdbId: number) => {
    const { watchedShows } = get();
    const newSet = new Set(watchedShows);
    newSet.add(tmdbId);
    set({ watchedShows: newSet });
    
    // Persist to cache
    AsyncStorage.setItem(WATCHED_SHOWS_KEY, JSON.stringify([...newSet])).catch(() => {});
  },
}));

// Initialize on app load
export const initWatchedStore = async () => {
  const store = useWatchedStore.getState();
  await store.loadFromCache();
  
  // Check Trakt connection
  const isLoggedIn = await traktService.isLoggedIn();
  store.setTraktConnected(isLoggedIn);
};

export default useWatchedStore;
