import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../config/constants';
import { IPTVConfig, IPTVChannel, EPGProgram, VODItem } from '../types';
import { parentalControlService } from './parentalControlService';

// Helper function for web storage (localStorage as fallback for AsyncStorage issues)
const webStorage = {
  getItem: (key: string): string | null => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  },
};

// EPG Cache to prevent crashes from too many API calls
interface EPGCacheEntry {
  data: EPGProgram[];
  timestamp: number;
}

const EPG_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const epgCache: Map<string, EPGCacheEntry> = new Map();

// Channels cache
interface ChannelsCacheEntry {
  data: IPTVChannel[];
  timestamp: number;
}
const CHANNELS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache
let channelsCache: ChannelsCacheEntry | null = null;

// Categories cache
interface CategoriesCacheEntry {
  data: any[];
  timestamp: number;
}
const CATEGORIES_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache
let liveCategoriesCache: CategoriesCacheEntry | null = null;
let vodCategoriesCache: CategoriesCacheEntry | null = null;
let seriesCategoriesCache: CategoriesCacheEntry | null = null;

// Category type for IPTV
export interface IPTVCategory {
  category_id: string;
  category_name: string;
}

// Real Xtreme Codes IPTV Service
export const iptvService = {
  // Clear all caches
  clearCache: () => {
    epgCache.clear();
    channelsCache = null;
    liveCategoriesCache = null;
    vodCategoriesCache = null;
    seriesCategoriesCache = null;
    console.log('[IPTV] Cache cleared');
  },

  saveConfig: async (config: IPTVConfig): Promise<void> => {
    const configStr = JSON.stringify(config);
    // Save to both AsyncStorage and localStorage (for web reliability)
    await AsyncStorage.setItem(STORAGE_KEYS.IPTV_CONFIG, configStr);
    webStorage.setItem(STORAGE_KEYS.IPTV_CONFIG, configStr);
    // Clear cache when config changes
    iptvService.clearCache();
    console.log('[IPTV] Config saved:', config.domain, config.username);
  },

  getConfig: async (): Promise<IPTVConfig | null> => {
    // Try AsyncStorage first
    let config = await AsyncStorage.getItem(STORAGE_KEYS.IPTV_CONFIG);
    
    // Fallback to localStorage on web
    if (!config && Platform.OS === 'web') {
      config = webStorage.getItem(STORAGE_KEYS.IPTV_CONFIG);
      console.log('[IPTV] Config from localStorage fallback');
    }
    
    if (config) {
      const parsed = JSON.parse(config);
      console.log('[IPTV] Config loaded:', parsed.domain, parsed.enabled);
      return parsed;
    }
    
    console.log('[IPTV] No config found');
    return null;
  },

  logout: async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEYS.IPTV_CONFIG);
    webStorage.removeItem(STORAGE_KEYS.IPTV_CONFIG);
    iptvService.clearCache();
    console.log('[IPTV] Logged out');
  },

  // Real Xtreme Codes authentication
  authenticate: async (domain: string, username: string, password: string): Promise<boolean> => {
    try {
      // Clean domain (remove http/https if present, and trailing slashes)
      let cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      
      // Try HTTPS first, then fall back to HTTP
      const protocols = ['https', 'http'];
      
      for (const protocol of protocols) {
        try {
          const response = await axios.get(
            `${protocol}://${cleanDomain}/player_api.php`,
            {
              params: {
                username: username,
                password: password,
              },
              timeout: 15000,
              validateStatus: (status) => status < 500, // Accept any status < 500
            }
          );

          // Check for valid response with user_info
          if (response.data && response.data.user_info) {
            console.log(`IPTV auth successful via ${protocol}`);
            return true;
          }
          
          // Check for auth status in response
          if (response.data && response.data.user_info === null) {
            console.log('IPTV auth failed: invalid credentials');
            return false;
          }
        } catch (protocolError: any) {
          console.log(`IPTV ${protocol} failed:`, protocolError.message);
          // Continue to next protocol
        }
      }
      
      // If both protocols fail
      console.error('IPTV authentication failed on both HTTP and HTTPS');
      return false;
    } catch (error) {
      console.error('IPTV authentication error:', error);
      return false;
    }
  },

  // Get live channels from Xtreme Codes
  getLiveChannels: async (): Promise<IPTVChannel[]> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) {
        return [];
      }

      let cleanDomain = config.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      
      // Try HTTPS first, then HTTP
      const protocols = ['https', 'http'];
      let response = null;
      let protocol = 'http';
      
      for (const p of protocols) {
        try {
          response = await axios.get(
            `${p}://${cleanDomain}/player_api.php`,
            {
              params: {
                username: config.username,
                password: config.password,
                action: 'get_live_streams',
              },
              timeout: 15000,
            }
          );
          protocol = p;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!response) return [];

      const streams = response.data || [];
      const channels: IPTVChannel[] = [];

      // Convert ALL channels to our format - no limit
      for (const stream of streams) {
        const channel: IPTVChannel = {
          id: stream.stream_id?.toString() || stream.num?.toString(),
          name: stream.name || 'Unknown Channel',
          logo: stream.stream_icon || '',
          stream_icon: stream.stream_icon || '',
          category: stream.category_name || 'Uncategorized',
          category_id: stream.category_id?.toString() || '',
          epg_channel_id: stream.epg_channel_id || '',
          stream_url: `${protocol}://${cleanDomain}/live/${config.username}/${config.password}/${stream.stream_id}.ts`,
          epg: [],
        };
        channels.push(channel);
      }

      // Apply parental controls filter
      return parentalControlService.filterContent(channels);
    } catch (error) {
      console.error('Error fetching live channels:', error);
      return [];
    }
  },

  // Get live categories from Xtreme Codes
  getLiveCategories: async (): Promise<IPTVCategory[]> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) {
        return [];
      }

      let cleanDomain = config.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      
      const protocols = ['https', 'http'];
      let response = null;
      
      for (const p of protocols) {
        try {
          response = await axios.get(
            `${p}://${cleanDomain}/player_api.php`,
            {
              params: {
                username: config.username,
                password: config.password,
                action: 'get_live_categories',
              },
              timeout: 15000,
            }
          );
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!response || !response.data) return [];
      
      // Handle both array and object response formats
      const categories = Array.isArray(response.data) 
        ? response.data 
        : response.data.live_categories || [];
      
      return categories.map((cat: any) => ({
        category_id: cat.category_id?.toString() || cat.id?.toString() || '',
        category_name: cat.category_name || cat.name || 'Unknown',
      }));
    } catch (error) {
      console.error('Error fetching live categories:', error);
      return [];
    }
  },

  // Get VOD content from Xtreme Codes with pagination
  getVODContent: async (categoryId?: string, page: number = 1, limit: number = 50): Promise<VODItem[]> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) {
        return [];
      }

      let cleanDomain = config.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      
      // Try HTTPS first, then HTTP
      const protocols = ['https', 'http'];
      let response = null;
      let protocol = 'http';
      
      for (const p of protocols) {
        try {
          const params: any = {
            username: config.username,
            password: config.password,
            action: 'get_vod_streams',
          };
          if (categoryId && categoryId !== 'all') {
            params.category_id = categoryId;
          }
          
          response = await axios.get(
            `${p}://${cleanDomain}/player_api.php`,
            {
              params,
              timeout: 15000,
            }
          );
          protocol = p;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!response) return [];

      const streams = response.data || [];
      const vodItems: VODItem[] = [];
      
      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedStreams = streams.slice(startIndex, endIndex);

      for (const stream of paginatedStreams) {
        const vodItem: VODItem = {
          id: stream.stream_id?.toString() || stream.num?.toString(),
          name: stream.name || 'Unknown',
          description: stream.plot || stream.description || '',
          poster: stream.stream_icon || stream.cover || '',
          backdrop: stream.backdrop_path?.[0] || '',
          category: stream.category_name || 'Movies',
          category_id: stream.category_id?.toString(),
          stream_url: `${protocol}://${cleanDomain}/movie/${config.username}/${config.password}/${stream.stream_id}.${stream.container_extension || 'mp4'}`,
          duration: stream.duration ? parseInt(stream.duration) : undefined,
          year: stream.releasedate || stream.year || '',
          rating: stream.rating || '',
          type: 'movie',
        };
        vodItems.push(vodItem);
      }

      // Apply parental controls filter
      return parentalControlService.filterContent(vodItems);
    } catch (error) {
      console.error('Error fetching VOD content:', error);
      return [];
    }
  },

  // Get VOD Categories
  getVODCategories: async (): Promise<IPTVCategory[]> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) return [];

      let cleanDomain = config.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      
      const protocols = ['https', 'http'];
      let response = null;
      
      for (const p of protocols) {
        try {
          response = await axios.get(
            `${p}://${cleanDomain}/player_api.php`,
            {
              params: {
                username: config.username,
                password: config.password,
                action: 'get_vod_categories',
              },
              timeout: 15000,
            }
          );
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!response || !response.data) return [];
      
      const categories = Array.isArray(response.data) ? response.data : [];
      
      return categories.map((cat: any) => ({
        category_id: cat.category_id?.toString() || cat.id?.toString() || '',
        category_name: cat.category_name || cat.name || 'Unknown',
      }));
    } catch (error) {
      console.error('Error fetching VOD categories:', error);
      return [];
    }
  },

  // Get TV Series (Shows) from Xtreme Codes
  getSeries: async (categoryId?: string, page: number = 1, limit: number = 50): Promise<VODItem[]> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) return [];

      let cleanDomain = config.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      
      const protocols = ['https', 'http'];
      let response = null;
      let protocol = 'http';
      
      for (const p of protocols) {
        try {
          const params: any = {
            username: config.username,
            password: config.password,
            action: 'get_series',
          };
          if (categoryId && categoryId !== 'all') {
            params.category_id = categoryId;
          }
          
          response = await axios.get(
            `${p}://${cleanDomain}/player_api.php`,
            { params, timeout: 15000 }
          );
          protocol = p;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!response) return [];

      const series = response.data || [];
      const seriesItems: VODItem[] = [];
      
      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedSeries = series.slice(startIndex, endIndex);

      for (const show of paginatedSeries) {
        const seriesItem: VODItem = {
          id: show.series_id?.toString() || show.id?.toString(),
          name: show.name || show.title || 'Unknown',
          description: show.plot || show.description || '',
          poster: show.cover || show.stream_icon || '',
          backdrop: show.backdrop_path?.[0] || '',
          category: show.category_name || 'TV Shows',
          category_id: show.category_id?.toString(),
          stream_url: '', // Series have episodes, not direct URL
          year: show.releaseDate || show.year || '',
          rating: show.rating || '',
          type: 'series',
          seasons: show.seasons || [],
        };
        seriesItems.push(seriesItem);
      }

      return parentalControlService.filterContent(seriesItems);
    } catch (error) {
      console.error('Error fetching series:', error);
      return [];
    }
  },

  // Get Series Categories
  getSeriesCategories: async (): Promise<IPTVCategory[]> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) return [];

      let cleanDomain = config.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      
      const protocols = ['https', 'http'];
      let response = null;
      
      for (const p of protocols) {
        try {
          response = await axios.get(
            `${p}://${cleanDomain}/player_api.php`,
            {
              params: {
                username: config.username,
                password: config.password,
                action: 'get_series_categories',
              },
              timeout: 15000,
            }
          );
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!response || !response.data) return [];
      
      const categories = Array.isArray(response.data) ? response.data : [];
      
      return categories.map((cat: any) => ({
        category_id: cat.category_id?.toString() || cat.id?.toString() || '',
        category_name: cat.category_name || cat.name || 'Unknown',
      }));
    } catch (error) {
      console.error('Error fetching series categories:', error);
      return [];
    }
  },

  // Get Series Info (episodes)
  getSeriesInfo: async (seriesId: string): Promise<any> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) return null;

      let cleanDomain = config.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      
      const protocols = ['https', 'http'];
      let response = null;
      let protocol = 'http';
      
      for (const p of protocols) {
        try {
          response = await axios.get(
            `${p}://${cleanDomain}/player_api.php`,
            {
              params: {
                username: config.username,
                password: config.password,
                action: 'get_series_info',
                series_id: seriesId,
              },
              timeout: 15000,
            }
          );
          protocol = p;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!response || !response.data) return null;
      
      // Return series info with episode URLs
      const info = response.data;
      if (info.episodes) {
        Object.keys(info.episodes).forEach(season => {
          info.episodes[season] = info.episodes[season].map((ep: any) => ({
            ...ep,
            stream_url: `${protocol}://${cleanDomain}/series/${config.username}/${config.password}/${ep.id}.${ep.container_extension || 'mp4'}`,
          }));
        });
      }
      
      return info;
    } catch (error) {
      console.error('Error fetching series info:', error);
      return null;
    }
  },

  // Get account info from Xtreme Codes
  getAccountInfo: async (): Promise<{ username: string; expiryDate: string; daysLeft: number } | null> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) return null;

      let cleanDomain = config.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      
      // Try HTTPS first, then HTTP
      const protocols = ['https', 'http'];
      let response = null;
      
      for (const p of protocols) {
        try {
          response = await axios.get(
            `${p}://${cleanDomain}/player_api.php`,
            {
              params: {
                username: config.username,
                password: config.password,
              },
              timeout: 10000,
            }
          );
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!response) return null;

      const userInfo = response.data?.user_info;
      if (!userInfo) return null;

      const expiryTimestamp = parseInt(userInfo.exp_date) * 1000;
      const expiryDate = new Date(expiryTimestamp);
      const now = new Date();
      const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        username: userInfo.username || config.username,
        expiryDate: expiryDate.toISOString(),
        daysLeft: Math.max(0, daysLeft),
      };
    } catch (error) {
      console.error('Error fetching IPTV account info:', error);
      return null;
    }
  },

  // Get EPG for a channel with caching
  getEPG: async (channelId: string): Promise<EPGProgram[]> => {
    try {
      // Check cache first
      const cached = epgCache.get(channelId);
      if (cached && Date.now() - cached.timestamp < EPG_CACHE_DURATION) {
        console.log(`[IPTV] EPG cache hit for channel ${channelId}`);
        return cached.data;
      }

      const config = await iptvService.getConfig();
      if (!config || !config.enabled) return [];

      let cleanDomain = config.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      
      // Try HTTPS first, then HTTP
      const protocols = ['https', 'http'];
      let response = null;
      
      for (const p of protocols) {
        try {
          response = await axios.get(
            `${p}://${cleanDomain}/player_api.php`,
            {
              params: {
                username: config.username,
                password: config.password,
                action: 'get_simple_data_table',
                stream_id: channelId,
              },
              timeout: 10000,
            }
          );
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!response) return [];

      const epgData = response.data?.epg_listings || [];
      const programs: EPGProgram[] = [];

      // Helper to decode base64 (works in both web and native)
      const decodeBase64 = (str: string): string => {
        try {
          if (typeof atob !== 'undefined') {
            // Web
            return decodeURIComponent(escape(atob(str)));
          } else {
            // Native - use Buffer
            return Buffer.from(str, 'base64').toString('utf8');
          }
        } catch {
          return str; // Return original if decode fails
        }
      };

      for (const epg of epgData.slice(0, 10)) {
        // Decode base64 encoded title and description
        const title = epg.title ? decodeBase64(epg.title) : 'Program';
        const description = epg.description ? decodeBase64(epg.description) : '';
        
        programs.push({
          id: epg.id || `${channelId}-${epg.start}`,
          title: title,
          description: description,
          start: new Date(parseInt(epg.start_timestamp || epg.start) * 1000).toISOString(),
          end: new Date(parseInt(epg.stop_timestamp || epg.end) * 1000).toISOString(),
          channel_id: channelId,
        });
      }

      // Cache the result
      epgCache.set(channelId, { data: programs, timestamp: Date.now() });
      console.log(`[IPTV] EPG cached for channel ${channelId}`);

      return programs;
    } catch (error) {
      console.error('Error fetching EPG:', error);
      return [];
    }
  },

  // Batch load EPG for multiple channels (to reduce API calls)
  getEPGBatch: async (channelIds: string[]): Promise<Map<string, EPGProgram[]>> => {
    const results = new Map<string, EPGProgram[]>();
    
    // Only fetch EPG for channels not in cache
    const uncachedIds = channelIds.filter(id => {
      const cached = epgCache.get(id);
      if (cached && Date.now() - cached.timestamp < EPG_CACHE_DURATION) {
        results.set(id, cached.data);
        return false;
      }
      return true;
    });

    // Limit concurrent requests to prevent crashes
    const batchSize = 5;
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize);
      const promises = batch.map(id => iptvService.getEPG(id));
      
      try {
        const batchResults = await Promise.allSettled(promises);
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.set(batch[index], result.value);
          }
        });
      } catch (e) {
        console.error('[IPTV] EPG batch error:', e);
      }
      
      // Small delay between batches to prevent overwhelming the server
      if (i + batchSize < uncachedIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  },

  // Search VOD Movies by title
  searchVODMovies: async (query: string): Promise<any[]> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) return [];

      const queryLower = query.toLowerCase().trim();
      if (queryLower.length < 2) return [];

      let cleanDomain = config.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      
      const protocols = ['https', 'http'];
      let response = null;
      
      for (const p of protocols) {
        try {
          response = await axios.get(
            `${p}://${cleanDomain}/player_api.php`,
            {
              params: {
                username: config.username,
                password: config.password,
                action: 'get_vod_streams',
              },
              timeout: 20000,
            }
          );
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!response || !response.data) return [];
      
      const allMovies = response.data || [];
      
      // Filter by search query (search in name/title)
      const matches = allMovies.filter((movie: any) => {
        const title = (movie.name || movie.title || '').toLowerCase();
        return title.includes(queryLower);
      }).slice(0, 20); // Limit to 20 results

      return matches.map((movie: any) => ({
        stream_id: movie.stream_id,
        name: movie.name || movie.title,
        stream_icon: movie.stream_icon || movie.cover,
        cover: movie.cover || movie.stream_icon,
        plot: movie.plot || movie.description,
        rating: movie.rating,
        year: movie.releaseDate || movie.year,
        stream_url: movie.stream_url || `${cleanDomain}/movie/${config.username}/${config.password}/${movie.stream_id}.mp4`,
        type: 'movie',
      }));
    } catch (error) {
      console.error('[IPTV] Search VOD movies error:', error);
      return [];
    }
  },

  // Search VOD Series by title
  searchVODSeries: async (query: string): Promise<any[]> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) return [];

      const queryLower = query.toLowerCase().trim();
      if (queryLower.length < 2) return [];

      let cleanDomain = config.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      
      const protocols = ['https', 'http'];
      let response = null;
      
      for (const p of protocols) {
        try {
          response = await axios.get(
            `${p}://${cleanDomain}/player_api.php`,
            {
              params: {
                username: config.username,
                password: config.password,
                action: 'get_series',
              },
              timeout: 20000,
            }
          );
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!response || !response.data) return [];
      
      const allSeries = response.data || [];
      
      // Filter by search query (search in name/title)
      const matches = allSeries.filter((series: any) => {
        const title = (series.name || series.title || '').toLowerCase();
        return title.includes(queryLower);
      }).slice(0, 20); // Limit to 20 results

      return matches.map((series: any) => ({
        stream_id: series.series_id,
        series_id: series.series_id,
        name: series.name || series.title,
        stream_icon: series.cover || series.stream_icon,
        cover: series.cover || series.stream_icon,
        plot: series.plot || series.description,
        rating: series.rating,
        year: series.releaseDate || series.year,
        type: 'series',
      }));
    } catch (error) {
      console.error('[IPTV] Search VOD series error:', error);
      return [];
    }
  },

  // Check if IPTV is logged in
  isLoggedIn: (): boolean => {
    // Synchronous check using cached state - will be updated on app load
    return iptvService._isLoggedIn;
  },

  _isLoggedIn: false,

  // Initialize the logged in state
  initLoginState: async (): Promise<boolean> => {
    const config = await iptvService.getConfig();
    iptvService._isLoggedIn = !!(config && config.enabled);
    return iptvService._isLoggedIn;
  },
};
