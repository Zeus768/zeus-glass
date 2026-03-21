import { create } from 'zustand';
import { traktService } from '../services/trakt';
import { tmdbService } from '../services/tmdb';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WATCHED_MOVIES_KEY = '@zeus_watched_movies';
const WATCHED_SHOWS_KEY = '@zeus_watched_shows';
const LAST_SYNC_KEY = '@zeus_watched_last_sync';
const NEXT_UP_KEY = '@zeus_next_up';

export interface NextUpItem {
  showTmdbId: number;
  showTitle: string;
  showPoster: string | null;
  episodeTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeStill: string | null;
  overview: string | null;
}

interface WatchedStore {
  watchedMovies: Set<number>;
  watchedShows: Set<number>;
  nextUpItems: NextUpItem[];
  recommendedMovieIds: number[];
  recommendedShowIds: number[];
  isLoading: boolean;
  isLoadingNextUp: boolean;
  isLoadingRecommendations: boolean;
  lastSynced: Date | null;
  isTraktConnected: boolean;
  
  // Actions
  syncFromTrakt: () => Promise<void>;
  fetchNextUp: () => Promise<void>;
  fetchRecommendations: () => Promise<void>;
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
  nextUpItems: [],
  recommendedMovieIds: [],
  recommendedShowIds: [],
  isLoading: false,
  isLoadingNextUp: false,
  isLoadingRecommendations: false,
  lastSynced: null,
  isTraktConnected: false,

  setTraktConnected: (connected: boolean) => {
    set({ isTraktConnected: connected });
    if (connected) {
      get().syncFromTrakt();
      get().fetchNextUp();
      get().fetchRecommendations();
    }
  },

  loadFromCache: async () => {
    try {
      const [moviesJson, showsJson, lastSyncStr, nextUpJson] = await Promise.all([
        AsyncStorage.getItem(WATCHED_MOVIES_KEY),
        AsyncStorage.getItem(WATCHED_SHOWS_KEY),
        AsyncStorage.getItem(LAST_SYNC_KEY),
        AsyncStorage.getItem(NEXT_UP_KEY),
      ]);

      const movies = moviesJson ? new Set<number>(JSON.parse(moviesJson)) : new Set<number>();
      const shows = showsJson ? new Set<number>(JSON.parse(showsJson)) : new Set<number>();
      const lastSynced = lastSyncStr ? new Date(lastSyncStr) : null;
      const nextUpItems: NextUpItem[] = nextUpJson ? JSON.parse(nextUpJson) : [];

      set({
        watchedMovies: movies,
        watchedShows: shows,
        lastSynced,
        nextUpItems,
      });

      console.log(`[WatchedStore] Loaded from cache: ${movies.size} movies, ${shows.size} shows, ${nextUpItems.length} next up`);
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

  fetchNextUp: async () => {
    const { isTraktConnected, isLoadingNextUp } = get();
    
    if (!isTraktConnected || isLoadingNextUp) return;

    set({ isLoadingNextUp: true });

    try {
      const isLoggedIn = await traktService.isLoggedIn();
      if (!isLoggedIn) {
        set({ isLoadingNextUp: false });
        return;
      }

      // Get all watched shows with their Trakt IDs
      const watchedShows = await traktService.getWatchedShowsWithIds();
      
      // Limit to most recent 15 shows to avoid too many API calls
      const recentShows = watchedShows.slice(0, 15);

      // Get progress for each show (in parallel batches of 5)
      const nextUpResults: NextUpItem[] = [];

      for (let i = 0; i < recentShows.length; i += 5) {
        const batch = recentShows.slice(i, i + 5);
        const progressResults = await Promise.allSettled(
          batch.map(async (show) => {
            const progress = await traktService.getShowProgress(show.traktId);
            if (!progress?.nextEpisode) return null;

            // Get episode still and show poster from TMDB
            const [episodeDetails, showInfo] = await Promise.all([
              tmdbService.getEpisodeDetails(
                show.tmdbId,
                progress.nextEpisode.season,
                progress.nextEpisode.number
              ),
              tmdbService.getTVShowBasic(show.tmdbId),
            ]);

            return {
              showTmdbId: show.tmdbId,
              showTitle: showInfo?.name || show.title,
              showPoster: showInfo?.poster_path || null,
              episodeTitle: progress.nextEpisode.title,
              seasonNumber: progress.nextEpisode.season,
              episodeNumber: progress.nextEpisode.number,
              episodeStill: episodeDetails?.still_path || showInfo?.backdrop_path || null,
              overview: episodeDetails?.overview || null,
            } as NextUpItem;
          })
        );

        for (const result of progressResults) {
          if (result.status === 'fulfilled' && result.value) {
            nextUpResults.push(result.value);
          }
        }
      }

      // Cache the results
      await AsyncStorage.setItem(NEXT_UP_KEY, JSON.stringify(nextUpResults));

      set({ nextUpItems: nextUpResults, isLoadingNextUp: false });
      console.log(`[WatchedStore] Fetched ${nextUpResults.length} next up items`);
    } catch (error) {
      console.warn('[WatchedStore] Failed to fetch next up:', error);
      set({ isLoadingNextUp: false });
    }
  },

  fetchRecommendations: async () => {
    const { isTraktConnected, isLoadingRecommendations } = get();
    
    if (!isTraktConnected || isLoadingRecommendations) return;

    set({ isLoadingRecommendations: true });

    try {
      const isLoggedIn = await traktService.isLoggedIn();
      if (!isLoggedIn) {
        set({ isLoadingRecommendations: false });
        return;
      }

      // Fetch movie and show recommendations in parallel
      const [movieIds, showIds] = await Promise.all([
        traktService.getRecommendedMovies(),
        traktService.getRecommendedShows(),
      ]);

      set({
        recommendedMovieIds: movieIds,
        recommendedShowIds: showIds,
        isLoadingRecommendations: false,
      });

      console.log(`[WatchedStore] Fetched ${movieIds.length} movie + ${showIds.length} show recommendations`);
    } catch (error) {
      console.warn('[WatchedStore] Failed to fetch recommendations:', error);
      set({ isLoadingRecommendations: false });
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
