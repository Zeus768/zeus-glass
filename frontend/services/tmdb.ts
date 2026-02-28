import axios from 'axios';
import { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '../config/constants';
import { Movie, TVShow, Genre } from '../types';

const tmdbApi = axios.create({
  baseURL: TMDB_BASE_URL,
  params: {
    api_key: TMDB_API_KEY,
  },
});

export const tmdbService = {
  // Get image URL
  getImageUrl: (path: string | null, size: string = 'w500') => {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
  },

  // Movies
  getTrendingMovies: async (): Promise<Movie[]> => {
    const response = await tmdbApi.get('/trending/movie/week');
    return response.data.results;
  },

  getPopularMovies: async (): Promise<Movie[]> => {
    const response = await tmdbApi.get('/movie/popular');
    return response.data.results;
  },

  getNowPlayingMovies: async (): Promise<Movie[]> => {
    const response = await tmdbApi.get('/movie/now_playing');
    return response.data.results;
  },

  getUpcomingMovies: async (): Promise<Movie[]> => {
    const response = await tmdbApi.get('/movie/upcoming');
    return response.data.results;
  },

  getMovieDetails: async (id: number): Promise<Movie> => {
    const response = await tmdbApi.get(`/movie/${id}`);
    return response.data;
  },

  getMoviesByGenre: async (genreId: number): Promise<Movie[]> => {
    const response = await tmdbApi.get('/discover/movie', {
      params: { with_genres: genreId },
    });
    return response.data.results;
  },

  // TV Shows
  getTrendingTVShows: async (): Promise<TVShow[]> => {
    const response = await tmdbApi.get('/trending/tv/week');
    return response.data.results;
  },

  getPopularTVShows: async (): Promise<TVShow[]> => {
    const response = await tmdbApi.get('/tv/popular');
    return response.data.results;
  },

  getOnTheAirTVShows: async (): Promise<TVShow[]> => {
    const response = await tmdbApi.get('/tv/on_the_air');
    return response.data.results;
  },

  getTVShowDetails: async (id: number): Promise<TVShow> => {
    const response = await tmdbApi.get(`/tv/${id}`);
    return response.data;
  },

  // Search
  searchMulti: async (query: string): Promise<(Movie | TVShow)[]> => {
    const response = await tmdbApi.get('/search/multi', {
      params: { query },
    });
    return response.data.results;
  },

  searchMovies: async (query: string): Promise<Movie[]> => {
    const response = await tmdbApi.get('/search/movie', {
      params: { query },
    });
    return response.data.results;
  },

  searchTVShows: async (query: string): Promise<TVShow[]> => {
    const response = await tmdbApi.get('/search/tv', {
      params: { query },
    });
    return response.data.results;
  },

  // Genres
  getMovieGenres: async (): Promise<Genre[]> => {
    const response = await tmdbApi.get('/genre/movie/list');
    return response.data.genres;
  },

  getTVGenres: async (): Promise<Genre[]> => {
    const response = await tmdbApi.get('/genre/tv/list');
    return response.data.genres;
  },
};
