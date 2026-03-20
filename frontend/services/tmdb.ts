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
  getTrendingMovies: async (page: number = 1): Promise<Movie[]> => {
    const response = await tmdbApi.get('/trending/movie/week', { params: { page } });
    return response.data.results;
  },

  getPopularMovies: async (page: number = 1): Promise<Movie[]> => {
    const response = await tmdbApi.get('/movie/popular', { params: { page } });
    return response.data.results;
  },

  getNowPlayingMovies: async (page: number = 1): Promise<Movie[]> => {
    const response = await tmdbApi.get('/movie/now_playing', { params: { page } });
    return response.data.results;
  },

  getUpcomingMovies: async (page: number = 1): Promise<Movie[]> => {
    const response = await tmdbApi.get('/movie/upcoming', { params: { page } });
    return response.data.results;
  },

  getTopRatedMovies: async (page: number = 1): Promise<Movie[]> => {
    const response = await tmdbApi.get('/movie/top_rated', { params: { page } });
    return response.data.results;
  },

  getMovieDetails: async (id: number): Promise<Movie> => {
    const response = await tmdbApi.get(`/movie/${id}`, {
      params: { append_to_response: 'external_ids' }
    });
    // Include IMDB ID from external_ids
    const data = response.data;
    if (data.external_ids?.imdb_id) {
      data.imdb_id = data.external_ids.imdb_id;
    }
    return data;
  },

  getMoviesByGenre: async (genreId: number, page: number = 1): Promise<Movie[]> => {
    const response = await tmdbApi.get('/discover/movie', {
      params: { with_genres: genreId, page },
    });
    return response.data.results;
  },

  // TV Shows
  getTrendingTVShows: async (page: number = 1): Promise<TVShow[]> => {
    const response = await tmdbApi.get('/trending/tv/week', { params: { page } });
    return response.data.results;
  },

  getPopularTVShows: async (page: number = 1): Promise<TVShow[]> => {
    const response = await tmdbApi.get('/tv/popular', { params: { page } });
    return response.data.results;
  },

  getOnTheAirTVShows: async (page: number = 1): Promise<TVShow[]> => {
    const response = await tmdbApi.get('/tv/on_the_air', { params: { page } });
    return response.data.results;
  },

  getTopRatedTVShows: async (page: number = 1): Promise<TVShow[]> => {
    const response = await tmdbApi.get('/tv/top_rated', { params: { page } });
    return response.data.results;
  },

  getTVShowsByGenre: async (genreId: number, page: number = 1): Promise<TVShow[]> => {
    const response = await tmdbApi.get('/discover/tv', {
      params: { with_genres: genreId, page },
    });
    return response.data.results;
  },

  getTVShowDetails: async (id: number): Promise<TVShow> => {
    const response = await tmdbApi.get(`/tv/${id}`, {
      params: { append_to_response: 'external_ids' }
    });
    // Include IMDB ID from external_ids
    const data = response.data;
    if (data.external_ids?.imdb_id) {
      data.imdb_id = data.external_ids.imdb_id;
    }
    return data;
  },

  // Get season episodes
  getSeasonEpisodes: async (tvId: number, seasonNumber: number): Promise<any> => {
    const response = await tmdbApi.get(`/tv/${tvId}/season/${seasonNumber}`);
    return response.data;
  },

  // Get a specific episode's details (for Next Up)
  getEpisodeDetails: async (tvId: number, seasonNumber: number, episodeNumber: number): Promise<any> => {
    try {
      const response = await tmdbApi.get(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`);
      return response.data;
    } catch {
      return null;
    }
  },

  // Get TV show basic info (poster, backdrop) by ID
  getTVShowBasic: async (id: number): Promise<{ poster_path: string | null; backdrop_path: string | null; name: string } | null> => {
    try {
      const response = await tmdbApi.get(`/tv/${id}`);
      return {
        poster_path: response.data.poster_path,
        backdrop_path: response.data.backdrop_path,
        name: response.data.name,
      };
    } catch {
      return null;
    }
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

  // Movie Collections/Franchises
  getCollection: async (collectionId: number): Promise<any> => {
    const response = await tmdbApi.get(`/collection/${collectionId}`);
    return response.data;
  },

  // Popular franchises - hardcoded IDs for popular collections
  getPopularFranchises: async (): Promise<any[]> => {
    const franchiseIds = [
      { id: 131296, name: 'Spider-Man (MCU)' },
      { id: 86311, name: 'The Avengers' },
      { id: 10, name: 'Star Wars' },
      { id: 119, name: 'The Lord of the Rings' },
      { id: 1241, name: 'Harry Potter' },
      { id: 9485, name: 'Fast & Furious' },
      { id: 528, name: 'The Terminator' },
      { id: 2150, name: 'Shrek' },
      { id: 121938, name: 'Batman (DCEU)' },
      { id: 495, name: 'Jurassic Park' },
      { id: 328, name: 'Jurassic World' },
      { id: 8091, name: 'Alien' },
      { id: 2980, name: 'Pirates of the Caribbean' },
      { id: 87359, name: 'Mission: Impossible' },
      { id: 726871, name: 'Dune' },
      { id: 131635, name: 'Hunger Games' },
      { id: 448150, name: 'Deadpool' },
      { id: 529892, name: 'Black Panther' },
      { id: 623911, name: 'John Wick' },
      { id: 263, name: 'The Dark Knight' },
    ];

    const results = await Promise.allSettled(
      franchiseIds.map(async (franchise) => {
        try {
          const collection = await tmdbService.getCollection(franchise.id);
          return {
            id: collection.id,
            name: collection.name,
            poster_path: collection.poster_path,
            backdrop_path: collection.backdrop_path,
            overview: collection.overview,
            parts: collection.parts,
            movieCount: collection.parts?.length || 0,
          };
        } catch (error) {
          return null;
        }
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);
  },
};
