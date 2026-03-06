import { create } from 'zustand';
import { Movie, TVShow, ContinueWatching } from '../types';
import { tmdbService } from '../services/tmdb';
import { traktService } from '../services/trakt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';

interface ContentState {
  // Movies
  trendingMovies: Movie[];
  popularMovies: Movie[];
  nowPlayingMovies: Movie[];
  upcomingMovies: Movie[];
  
  // TV Shows
  trendingTVShows: TVShow[];
  popularTVShows: TVShow[];
  onTheAirTVShows: TVShow[];
  
  // Trakt Lists
  continueWatching: ContinueWatching[];
  watchlistMovies: any[];
  watchlistShows: any[];
  recentlyWatched: any[];
  
  // Favorites (local)
  favorites: (Movie | TVShow)[];
  
  // Loading states
  loading: boolean;
  traktLoading: boolean;
  
  // Actions
  loadHomeContent: () => Promise<void>;
  loadContinueWatching: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  loadTraktLists: () => Promise<void>;
  addToFavorites: (item: Movie | TVShow) => Promise<void>;
  removeFromFavorites: (id: number) => Promise<void>;
  isFavorite: (id: number) => boolean;
}

export const useContentStore = create<ContentState>((set, get) => ({
  trendingMovies: [],
  popularMovies: [],
  nowPlayingMovies: [],
  upcomingMovies: [],
  trendingTVShows: [],
  popularTVShows: [],
  onTheAirTVShows: [],
  continueWatching: [],
  watchlistMovies: [],
  watchlistShows: [],
  recentlyWatched: [],
  favorites: [],
  loading: false,
  traktLoading: false,

  loadHomeContent: async () => {
    set({ loading: true });
    try {
      const [trendingMovies, popularMovies, nowPlayingMovies, trendingTVShows, popularTVShows] =
        await Promise.all([
          tmdbService.getTrendingMovies(),
          tmdbService.getPopularMovies(),
          tmdbService.getNowPlayingMovies(),
          tmdbService.getTrendingTVShows(),
          tmdbService.getPopularTVShows(),
        ]);

      set({
        trendingMovies,
        popularMovies,
        nowPlayingMovies,
        trendingTVShows,
        popularTVShows,
      });
    } catch (error) {
      console.error('Error loading home content:', error);
    } finally {
      set({ loading: false });
    }
  },

  loadContinueWatching: async () => {
    try {
      const isAuth = await traktService.isAuthenticated();
      if (!isAuth) {
        console.log('[ContentStore] Trakt not authenticated, skipping continue watching');
        return;
      }
      const continueWatching = await traktService.getWatchedProgress();
      set({ continueWatching });
    } catch (error) {
      console.error('Error loading continue watching:', error);
    }
  },

  loadTraktLists: async () => {
    try {
      const isAuth = await traktService.isAuthenticated();
      if (!isAuth) {
        console.log('[ContentStore] Trakt not authenticated, skipping lists');
        return;
      }

      set({ traktLoading: true });

      const [watchlistMovies, watchlistShows, recentlyWatched, continueWatching] = await Promise.all([
        traktService.getWatchlistMovies(),
        traktService.getWatchlistShows(),
        traktService.getRecentlyWatched(15),
        traktService.getWatchedProgress(),
      ]);

      // Fetch TMDB posters for watchlist items
      const moviesWithPosters = await Promise.all(
        watchlistMovies.slice(0, 20).map(async (movie: any) => {
          try {
            if (movie.id) {
              const details = await tmdbService.getMovieDetails(movie.id);
              return { ...movie, poster_path: details.poster_path, backdrop_path: details.backdrop_path };
            }
            return movie;
          } catch {
            return movie;
          }
        })
      );

      const showsWithPosters = await Promise.all(
        watchlistShows.slice(0, 20).map(async (show: any) => {
          try {
            if (show.id) {
              const details = await tmdbService.getTVShowDetails(show.id);
              return { ...show, poster_path: details.poster_path, backdrop_path: details.backdrop_path };
            }
            return show;
          } catch {
            return show;
          }
        })
      );

      set({
        watchlistMovies: moviesWithPosters,
        watchlistShows: showsWithPosters,
        recentlyWatched,
        continueWatching,
        traktLoading: false,
      });
    } catch (error) {
      console.error('Error loading Trakt lists:', error);
      set({ traktLoading: false });
    }
  },

  loadFavorites: async () => {
    try {
      const favoritesJson = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
      const favorites = favoritesJson ? JSON.parse(favoritesJson) : [];
      set({ favorites });
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  },

  addToFavorites: async (item: Movie | TVShow) => {
    try {
      const favorites = [...get().favorites, item];
      await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
      set({ favorites });
    } catch (error) {
      console.error('Error adding to favorites:', error);
    }
  },

  removeFromFavorites: async (id: number) => {
    try {
      const favorites = get().favorites.filter((item) => item.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
      set({ favorites });
    } catch (error) {
      console.error('Error removing from favorites:', error);
    }
  },

  isFavorite: (id: number) => {
    return get().favorites.some((item) => item.id === id);
  },
}));
