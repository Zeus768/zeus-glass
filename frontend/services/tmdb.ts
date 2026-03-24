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

  // Get multiple movies by their TMDB IDs (for recommendations)
  getMoviesByIds: async (ids: number[]): Promise<any[]> => {
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const response = await tmdbApi.get(`/movie/${id}`);
        return response.data;
      })
    );
    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value)
      .map(r => r.value);
  },

  // Get multiple TV shows by their TMDB IDs (for recommendations)
  getTVShowsByIds: async (ids: number[]): Promise<any[]> => {
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const response = await tmdbApi.get(`/tv/${id}`);
        return response.data;
      })
    );
    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value)
      .map(r => r.value);
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

  // Popular franchises - comprehensive list loaded in batches
  getPopularFranchises: async (page: number = 1, pageSize: number = 30): Promise<{ franchises: any[]; hasMore: boolean }> => {
    const allFranchiseIds = [
      // MCU & Marvel (10)
      { id: 131296, name: 'Spider-Man (MCU)' }, { id: 86311, name: 'The Avengers' },
      { id: 529892, name: 'Black Panther' }, { id: 448150, name: 'Deadpool' },
      { id: 131292, name: 'Iron Man' }, { id: 131295, name: 'Captain America' },
      { id: 131291, name: 'Thor' }, { id: 284433, name: 'Guardians of the Galaxy' },
      { id: 453993, name: 'Ant-Man' }, { id: 531241, name: 'Doctor Strange' },
      // DC (8)
      { id: 263, name: 'The Dark Knight' }, { id: 948485, name: 'The Batman' },
      { id: 8537, name: 'Superman' }, { id: 209131, name: 'DC Extended Universe' },
      { id: 573693, name: 'Aquaman' }, { id: 468552, name: 'Wonder Woman' },
      { id: 573436, name: 'Spider-Verse' }, { id: 558216, name: 'Venom' },
      // Star Wars & Sci-Fi (12)
      { id: 10, name: 'Star Wars' }, { id: 726871, name: 'Dune' },
      { id: 115776, name: 'Star Trek' }, { id: 8091, name: 'Alien' },
      { id: 135416, name: 'Predator' }, { id: 115575, name: 'Back to the Future' },
      { id: 2344, name: 'The Matrix' }, { id: 328, name: 'Jurassic World' },
      { id: 173710, name: 'Planet of the Apes' }, { id: 8650, name: 'Transformers' },
      { id: 33514, name: 'RoboCop' }, { id: 63043, name: 'TRON' },
      // Fantasy & Adventure (10)
      { id: 119, name: 'The Lord of the Rings' }, { id: 121938, name: 'The Hobbit' },
      { id: 1241, name: 'Harry Potter' }, { id: 1565, name: 'Chronicles of Narnia' },
      { id: 131635, name: 'The Hunger Games' }, { id: 264, name: 'Twilight' },
      { id: 295130, name: 'Maze Runner' }, { id: 283579, name: 'Divergent' },
      { id: 84, name: 'Indiana Jones' }, { id: 495, name: 'Jurassic Park' },
      // Action (18)
      { id: 9485, name: 'Fast & Furious' }, { id: 623911, name: 'John Wick' },
      { id: 87359, name: 'Mission: Impossible' }, { id: 645, name: 'James Bond' },
      { id: 528, name: 'The Terminator' }, { id: 2980, name: 'Die Hard' },
      { id: 126125, name: 'The Expendables' }, { id: 5039, name: 'Rambo' },
      { id: 2, name: 'Lethal Weapon' }, { id: 1570, name: 'Rush Hour' },
      { id: 135483, name: 'Taken' }, { id: 1733, name: 'The Mummy' },
      { id: 391860, name: 'Kingsman' }, { id: 523855, name: 'The Equalizer' },
      { id: 126209, name: 'Bad Boys' }, { id: 495527, name: 'Jumanji' },
      { id: 31562, name: 'The Bourne' }, { id: 537982, name: 'Zombieland' },
      // Horror (14)
      { id: 656, name: 'Saw' }, { id: 91361, name: 'Halloween' },
      { id: 2467, name: 'Friday the 13th' }, { id: 525, name: 'Nightmare on Elm Street' },
      { id: 2150, name: 'Scream' }, { id: 313086, name: 'The Conjuring' },
      { id: 402074, name: 'Annabelle' }, { id: 494837, name: 'It' },
      { id: 746, name: 'Final Destination' }, { id: 256322, name: 'The Purge' },
      { id: 228446, name: 'Insidious' }, { id: 159816, name: 'Paranormal Activity' },
      { id: 91697, name: 'Sinister' }, { id: 420, name: 'Child\'s Play' },
      // Animation (18)
      { id: 2150, name: 'Shrek' }, { id: 10194, name: 'Toy Story' },
      { id: 137697, name: 'Finding Nemo' }, { id: 87096, name: 'Cars' },
      { id: 398, name: 'Ice Age' }, { id: 14740, name: 'Madagascar' },
      { id: 86066, name: 'Despicable Me' }, { id: 86027, name: 'Kung Fu Panda' },
      { id: 96871, name: 'How to Train Your Dragon' }, { id: 125574, name: 'The Lego Movie' },
      { id: 468222, name: 'The Incredibles' }, { id: 720879, name: 'Monsters Inc' },
      { id: 544669, name: 'Minions' }, { id: 404825, name: 'Hotel Transylvania' },
      { id: 386382, name: 'Wreck-It Ralph' }, { id: 240, name: 'Big Hero 6' },
      { id: 33085, name: 'Puss in Boots' }, { id: 497, name: 'The Secret Life of Pets' },
      // Comedy (14)
      { id: 86119, name: 'The Hangover' }, { id: 115, name: 'Austin Powers' },
      { id: 657, name: 'Scary Movie' }, { id: 2794, name: 'Night at the Museum' },
      { id: 1709, name: 'Beverly Hills Cop' }, { id: 718, name: 'Ace Ventura' },
      { id: 2806, name: 'Meet the Parents' }, { id: 9735, name: 'Neighbors' },
      { id: 304, name: 'Ocean\'s' }, { id: 230, name: 'The Godfather' },
      { id: 553717, name: 'Creed' }, { id: 1575, name: 'Rocky' },
      { id: 748, name: 'X-Men' }, { id: 94032, name: 'Blade' },
      // Pirates & Adventure (4)
      { id: 2980, name: 'Pirates of the Caribbean' }, { id: 2344, name: 'Die Hard' },
      { id: 948485, name: 'The Batman' }, { id: 573693, name: 'Aquaman' },
      // More Franchises (20+)
      { id: 1570, name: 'Red' }, { id: 8650, name: 'Home Alone' },
      { id: 133352, name: 'XXX' }, { id: 9735, name: 'Ride Along' },
      { id: 173710, name: 'Zoolander' }, { id: 1733, name: 'Sicario' },
      { id: 86066, name: 'Escape Room' }, { id: 131634, name: 'Hunger Games' },
      { id: 726871, name: 'Godzilla vs Kong' }, { id: 295130, name: 'A Quiet Place' },
      { id: 283579, name: 'Don\'t Breathe' }, { id: 87359, name: 'Jack Reacher' },
      { id: 645, name: 'The Transporter' }, { id: 2980, name: 'Ghostbusters' },
      { id: 84, name: 'Indiana Jones' }, { id: 115575, name: 'Sherlock Holmes' },
      { id: 645, name: 'Jack Ryan' }, { id: 125574, name: 'Cloudy with Meatballs' },
      { id: 86027, name: 'The Croods' }, { id: 96871, name: 'Rio' },
      { id: 126209, name: 'MIB' }, { id: 657, name: 'Jump Street' },
      { id: 256322, name: 'Pacific Rim' }, { id: 94032, name: 'Blade Runner' },
      { id: 173710, name: 'Cloverfield' }, { id: 63043, name: 'Avatar' },
    ];

    // Deduplicate by ID
    const uniqueMap = new Map<number, { id: number; name: string }>();
    allFranchiseIds.forEach(f => {
      if (!uniqueMap.has(f.id)) uniqueMap.set(f.id, f);
    });
    const uniqueIds = Array.from(uniqueMap.values());

    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const batch = uniqueIds.slice(startIdx, endIdx);
    const hasMore = endIdx < uniqueIds.length;

    if (batch.length === 0) return { franchises: [], hasMore: false };

    const results = await Promise.allSettled(
      batch.map(async (franchise) => {
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
        } catch {
          return null;
        }
      })
    );

    const franchises = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);

    return { franchises, hasMore };
  },
};
