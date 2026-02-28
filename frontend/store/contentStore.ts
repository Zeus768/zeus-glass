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
  
  // Continue Watching
  continueWatching: ContinueWatching[];
  
  // Favorites
  favorites: (Movie | TVShow)[];
  
  // Loading states
  loading: boolean;
  
  // Actions
  loadHomeContent: () => Promise<void>;
  loadContinueWatching: () => Promise<void>;
  loadFavorites: () => Promise<void>;
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
  favorites: [],
  loading: false,

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
      const continueWatching = await traktService.getWatchedProgress();
      set({ continueWatching });
    } catch (error) {
      console.error('Error loading continue watching:', error);
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
