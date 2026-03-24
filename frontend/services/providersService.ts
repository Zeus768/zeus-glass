import axios from 'axios';
import { TMDB_API_KEY, TMDB_BASE_URL } from '../config/constants';

// TMDB Provider IDs (Watch Providers)
// Reference: https://developer.themoviedb.org/reference/watch-providers-movie-list
export const STREAMING_PROVIDERS = {
  netflix: { id: 8, name: 'Netflix', logo: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg' },
  disney: { id: 337, name: 'Disney+', logo: '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' },
  prime: { id: 9, name: 'Amazon Prime Video', logo: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
  hulu: { id: 15, name: 'Hulu', logo: '/zxrVdFjIjLqkfnwyghnfywTn3Lh.jpg' },
  hbo: { id: 1899, name: 'HBO Max', logo: '/jbe4gVSfRlbPTdESXhEKpornsfu.jpg' },
  apple: { id: 350, name: 'Apple TV+', logo: '/6uhKBfmtzFqOcLousHwZuzcrScK.jpg' },
  paramount: { id: 531, name: 'Paramount+', logo: '/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg' },
  peacock: { id: 386, name: 'Peacock', logo: '/8VCV78prwd9QzZnEm0ReO6bERDa.jpg' },
  starz: { id: 43, name: 'Starz', logo: '/yIKwylTLP1u8gl84Is7FItpYLGL.jpg' },
  crunchyroll: { id: 283, name: 'Crunchyroll', logo: '/8Gt1iClBlzTeQs8WQm8UrCoIxnQ.jpg' },
  mubi: { id: 11, name: 'MUBI', logo: '/bVR4Z1LCHY7gidXAJF5pMa4QrDS.jpg' },
  curiositystream: { id: 190, name: 'Curiosity Stream', logo: '/67Ee4E6qOkQGHeUTArdJ1qRxzR2.jpg' },
  britbox: { id: 380, name: 'BritBox', logo: '/pFNkpjSHr9xvmTtmxyPfk3tgzh0.jpg' },
  // Free services
  tubi: { id: 73, name: 'Tubi', logo: '/w2TDH9TRI7pltf5LjN3vXzs7QbN.jpg' },
  pluto: { id: 300, name: 'Pluto TV', logo: '/t6N57S17sdXRXmZDAkaGP0NHNG0.jpg' },
  freevee: { id: 613, name: 'Freevee', logo: '/uBE4RMH15mrkuz6vXzuJc7ZLXp1.jpg' },
  plex: { id: 538, name: 'Plex', logo: '/xpJpwQXD4E8JwUx2IhKdaIqkQQy.jpg' },
};

export type ProviderKey = keyof typeof STREAMING_PROVIDERS;

export interface ProviderContent {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  overview: string;
  media_type: 'movie' | 'tv';
}

class ProvidersService {
  private region: string = 'US'; // Default region

  setRegion(region: string) {
    this.region = region.toUpperCase();
  }

  getRegion(): string {
    return this.region;
  }

  // Get all available providers
  getAllProviders(): typeof STREAMING_PROVIDERS {
    return STREAMING_PROVIDERS;
  }

  // Get logo URL for a provider
  getProviderLogo(providerKey: ProviderKey): string {
    const provider = STREAMING_PROVIDERS[providerKey];
    if (provider) {
      return `https://image.tmdb.org/t/p/w92${provider.logo}`;
    }
    return '';
  }

  // Discover movies by streaming provider
  async discoverMoviesByProvider(
    providerKey: ProviderKey, 
    page: number = 1,
    sortBy: string = 'popularity.desc'
  ): Promise<{ results: ProviderContent[]; total_pages: number; total_results: number }> {
    try {
      const provider = STREAMING_PROVIDERS[providerKey];
      if (!provider) {
        console.error(`Unknown provider: ${providerKey}`);
        return { results: [], total_pages: 0, total_results: 0 };
      }

      const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
        params: {
          api_key: TMDB_API_KEY,
          with_watch_providers: provider.id,
          watch_region: this.region,
          with_watch_monetization_types: 'flatrate',
          sort_by: sortBy,
          page,
        },
        timeout: 15000,
      });

      return {
        results: response.data.results.map((item: any) => ({
          ...item,
          media_type: 'movie',
        })),
        total_pages: response.data.total_pages,
        total_results: response.data.total_results,
      };
    } catch (error) {
      console.error(`[Providers] Error fetching movies for ${providerKey}:`, error);
      return { results: [], total_pages: 0, total_results: 0 };
    }
  }

  // Discover TV shows by streaming provider
  async discoverTVByProvider(
    providerKey: ProviderKey, 
    page: number = 1,
    sortBy: string = 'popularity.desc'
  ): Promise<{ results: ProviderContent[]; total_pages: number; total_results: number }> {
    try {
      const provider = STREAMING_PROVIDERS[providerKey];
      if (!provider) {
        console.error(`Unknown provider: ${providerKey}`);
        return { results: [], total_pages: 0, total_results: 0 };
      }

      const response = await axios.get(`${TMDB_BASE_URL}/discover/tv`, {
        params: {
          api_key: TMDB_API_KEY,
          with_watch_providers: provider.id,
          watch_region: this.region,
          with_watch_monetization_types: 'flatrate',
          sort_by: sortBy,
          page,
        },
        timeout: 15000,
      });

      return {
        results: response.data.results.map((item: any) => ({
          ...item,
          media_type: 'tv',
        })),
        total_pages: response.data.total_pages,
        total_results: response.data.total_results,
      };
    } catch (error) {
      console.error(`[Providers] Error fetching TV for ${providerKey}:`, error);
      return { results: [], total_pages: 0, total_results: 0 };
    }
  }

  // Get watch providers for a specific movie
  async getMovieProviders(movieId: number): Promise<{ [key: string]: any }> {
    try {
      const response = await axios.get(
        `${TMDB_BASE_URL}/movie/${movieId}/watch/providers`,
        {
          params: { api_key: TMDB_API_KEY },
          timeout: 10000,
        }
      );

      return response.data.results || {};
    } catch (error) {
      console.error('[Providers] Error getting movie providers:', error);
      return {};
    }
  }

  // Get watch providers for a specific TV show
  async getTVProviders(tvId: number): Promise<{ [key: string]: any }> {
    try {
      const response = await axios.get(
        `${TMDB_BASE_URL}/tv/${tvId}/watch/providers`,
        {
          params: { api_key: TMDB_API_KEY },
          timeout: 10000,
        }
      );

      return response.data.results || {};
    } catch (error) {
      console.error('[Providers] Error getting TV providers:', error);
      return {};
    }
  }

  // Get content for multiple providers at once (for home page carousels)
  async getMultiProviderContent(
    providerKeys: ProviderKey[],
    mediaType: 'movie' | 'tv' = 'movie',
    limit: number = 10
  ): Promise<{ [key in ProviderKey]?: ProviderContent[] }> {
    const results: { [key in ProviderKey]?: ProviderContent[] } = {};

    const promises = providerKeys.map(async (key) => {
      try {
        const data = mediaType === 'movie'
          ? await this.discoverMoviesByProvider(key, 1)
          : await this.discoverTVByProvider(key, 1);
        
        results[key] = data.results.slice(0, limit);
      } catch (error) {
        console.error(`[Providers] Error fetching ${key}:`, error);
        results[key] = [];
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  // Get popular providers for a region
  getPopularProviders(region: string = 'US'): ProviderKey[] {
    // Return most popular providers by region
    const popularByRegion: { [key: string]: ProviderKey[] } = {
      US: ['netflix', 'disney', 'prime', 'hulu', 'hbo', 'apple', 'paramount', 'peacock'],
      UK: ['netflix', 'disney', 'prime', 'now', 'skygo', 'apple', 'britbox', 'paramount'],
      CA: ['netflix', 'disney', 'prime', 'apple', 'paramount', 'crunchyroll'],
      AU: ['netflix', 'disney', 'prime', 'stan', 'apple', 'paramount', 'britbox'],
      default: ['netflix', 'disney', 'prime', 'apple', 'hbo', 'paramount'],
    };

    return popularByRegion[region] || popularByRegion['default'];
  }

  // Get free streaming providers
  getFreeProviders(): ProviderKey[] {
    return ['tubi', 'pluto', 'freevee', 'plex'];
  }
}

export const providersService = new ProvidersService();
