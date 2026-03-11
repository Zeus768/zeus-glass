import axios from 'axios';
import { Platform } from 'react-native';
import { storage } from '../utils/storage';
import {
  REAL_DEBRID_BASE_URL,
  REAL_DEBRID_CLIENT_ID,
  ALLDEBRID_BASE_URL,
  PREMIUMIZE_BASE_URL,
  STORAGE_KEYS,
} from '../config/constants';
import { DebridAccount, StreamLink, CachedTorrent } from '../types';
import { errorLogService } from './errorLogService';

// Get backend URL for proxy calls (web only)
const getBackendUrl = () => {
  // Use relative path which will go through the Kubernetes ingress
  return '';
};

// Helper to determine if we need to use the proxy
// This checks at runtime to ensure we're detecting web correctly
const shouldUseProxy = () => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return true;
  }
  // Fallback to Platform check
  return Platform.OS === 'web';
};

// ============================================
// REAL-DEBRID SERVICE
// OAuth Device Code Flow (Correct Implementation)
// ============================================
export const realDebridService = {
  // Step 1: Get device code for user authorization
  getDeviceCode: async (): Promise<{
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
  }> => {
    console.log('[Real-Debrid] Getting device code...');
    const useProxy = shouldUseProxy();
    console.log('[Real-Debrid] useProxy:', useProxy);
    
    try {
      let response;
      
      if (useProxy) {
        // On web, use backend proxy to avoid CORS
        console.log('[Real-Debrid] Using proxy endpoint');
        response = await axios.get(`${getBackendUrl()}/api/debrid/real-debrid/device-code`);
      } else {
        // On native, call Real-Debrid directly
        console.log('[Real-Debrid] Calling API directly');
        response = await axios.get(`${REAL_DEBRID_BASE_URL}/oauth/v2/device/code`, {
          params: {
            client_id: REAL_DEBRID_CLIENT_ID,
            new_credentials: 'yes',
          },
        });
      }
      
      console.log('[Real-Debrid] Device code response:', JSON.stringify(response.data));
      
      return {
        device_code: response.data.device_code,
        user_code: response.data.user_code,
        verification_url: response.data.verification_url || 'https://real-debrid.com/device',
        expires_in: response.data.expires_in || 600,
        interval: response.data.interval || 5,
      };
    } catch (error: any) {
      console.error('[Real-Debrid] Error getting device code:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error || 'Failed to get device code');
    }
  },

  // Step 2: Poll for token - Real-Debrid uses a two-step process:
  // First poll /device/credentials to get client_id + client_secret
  // Then exchange those for access_token via /token
  pollForToken: async (deviceCode: string): Promise<{ access_token: string } | null> => {
    const useProxy = shouldUseProxy();
    
    try {
      console.log('[Real-Debrid] Polling for credentials...');
      
      let credResponse;
      
      if (useProxy) {
        // On web, use backend proxy
        credResponse = await axios.get(`${getBackendUrl()}/api/debrid/real-debrid/credentials`, {
          params: { code: deviceCode },
        });
        
        // Handle proxy response format
        if (credResponse.data.status_code !== 200 || !credResponse.data.data) {
          console.log('[Real-Debrid] User has not authorized yet');
          return null;
        }
        credResponse = { data: credResponse.data.data, status: 200 };
      } else {
        // On native, call Real-Debrid directly
        credResponse = await axios.get(`${REAL_DEBRID_BASE_URL}/oauth/v2/device/credentials`, {
          params: {
            client_id: REAL_DEBRID_CLIENT_ID,
            code: deviceCode,
          },
          validateStatus: (status) => status < 500,
        });
        
        if (credResponse.status === 403 || credResponse.data?.error) {
          console.log('[Real-Debrid] User has not authorized yet (this is normal)');
          return null;
        }
      }
      
      console.log('[Real-Debrid] Credentials response:', JSON.stringify(credResponse.data));
      
      // Check if we have client credentials
      if (!credResponse.data?.client_id || !credResponse.data?.client_secret) {
        console.log('[Real-Debrid] No credentials in response yet');
        return null;
      }
      
      const { client_id, client_secret } = credResponse.data;
      console.log('[Real-Debrid] Got credentials! Exchanging for token...');
      
      // Step 2b: Exchange credentials for access token
      let tokenResponse;
      
      if (useProxy) {
        // On web, use backend proxy
        tokenResponse = await axios.post(
          `${getBackendUrl()}/api/debrid/real-debrid/token`,
          null,
          {
            params: {
              client_id,
              client_secret,
              code: deviceCode,
            },
          }
        );
      } else {
        // On native, call Real-Debrid directly
        const tokenParams = new URLSearchParams();
        tokenParams.append('client_id', client_id);
        tokenParams.append('client_secret', client_secret);
        tokenParams.append('code', deviceCode);
        tokenParams.append('grant_type', 'http://oauth.net/grant_type/device/1.0');
        
        tokenResponse = await axios.post(
          `${REAL_DEBRID_BASE_URL}/oauth/v2/token`,
          tokenParams.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );
      }
      
      console.log('[Real-Debrid] Token response:', JSON.stringify(tokenResponse.data));
      
      if (tokenResponse.data?.access_token) {
        console.log('[Real-Debrid] SUCCESS! Got access token!');
        
        // Store refresh token for future use
        if (tokenResponse.data.refresh_token) {
          await storage.setItem('rd_refresh_token', tokenResponse.data.refresh_token);
          await storage.setItem('rd_client_id', client_id);
          await storage.setItem('rd_client_secret', client_secret);
        }
        
        return { access_token: tokenResponse.data.access_token };
      }
      
      return null;
    } catch (error: any) {
      // 403 means user hasn't authorized yet - this is expected during polling
      if (error.response?.status === 403) {
        console.log('[Real-Debrid] Still waiting for user authorization (403)');
        return null;
      }
      console.error('[Real-Debrid] Poll error:', error.response?.data || error.message);
      return null; // Return null to continue polling instead of throwing
    }
  },

  saveToken: async (token: string): Promise<void> => {
    console.log('[Real-Debrid] Saving token...');
    await storage.setItem(STORAGE_KEYS.REAL_DEBRID_TOKEN, token);
    const saved = await storage.getItem(STORAGE_KEYS.REAL_DEBRID_TOKEN);
    console.log('[Real-Debrid] Token saved:', saved ? 'YES' : 'NO');
  },

  getToken: async (): Promise<string | null> => {
    const token = await storage.getItem(STORAGE_KEYS.REAL_DEBRID_TOKEN);
    return token;
  },

  logout: async (): Promise<void> => {
    await storage.deleteItem(STORAGE_KEYS.REAL_DEBRID_TOKEN);
    await storage.deleteItem('rd_refresh_token');
    await storage.deleteItem('rd_client_id');
    await storage.deleteItem('rd_client_secret');
  },

  getAccountInfo: async (): Promise<DebridAccount | null> => {
    try {
      const token = await realDebridService.getToken();
      if (!token) return null;

      const response = await axios.get(`${REAL_DEBRID_BASE_URL}/rest/1.0/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = response.data;
      const expiryDate = new Date(data.expiration);
      const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return {
        username: data.username,
        email: data.email,
        expiryDate: data.expiration,
        daysLeft,
        type: data.type,
        points: data.points,
      };
    } catch (error) {
      console.error('[Real-Debrid] Error fetching account:', error);
      return null;
    }
  },

  // Unrestrict a link to get direct streaming URL
  unrestrictLink: async (link: string): Promise<string | null> => {
    try {
      const token = await realDebridService.getToken();
      if (!token) return null;

      const response = await axios.post(
        `${REAL_DEBRID_BASE_URL}/rest/1.0/unrestrict/link`,
        `link=${encodeURIComponent(link)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data?.download || null;
    } catch (error) {
      console.error('[Real-Debrid] Error unrestricting link:', error);
      return null;
    }
  },

  // Add magnet and get streaming link
  addMagnetAndGetLink: async (magnet: string, title: string): Promise<string | null> => {
    try {
      const token = await realDebridService.getToken();
      if (!token) {
        console.error('[Real-Debrid] No token available');
        return null;
      }

      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';

      // Step 1: Add magnet
      console.log('[Real-Debrid] Adding magnet...');
      const addResponse = await axios.post(`${backendUrl}/api/debrid/real-debrid/add-magnet`, null, {
        params: { magnet, token },
      });

      if (!addResponse.data.success) {
        console.error('[Real-Debrid] Failed to add magnet');
        return null;
      }

      const torrentId = addResponse.data.data.id;

      // Step 2: Select files
      console.log('[Real-Debrid] Selecting files...');
      await axios.post(`${backendUrl}/api/debrid/real-debrid/select-files`, null, {
        params: { torrent_id: torrentId, file_ids: 'all', token },
      });

      // Step 3: Wait for torrent to be ready
      console.log('[Real-Debrid] Waiting for torrent...');
      let attempts = 0;
      let torrentInfo;

      while (attempts < 30) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const infoResponse = await axios.get(`${backendUrl}/api/debrid/real-debrid/torrent-info`, {
          params: { torrent_id: torrentId, token },
        });

        torrentInfo = infoResponse.data.data;
        if (torrentInfo.status === 'downloaded' || torrentInfo.status === 'waiting_files_selection') {
          break;
        }
        attempts++;
      }

      if (!torrentInfo || torrentInfo.status !== 'downloaded') {
        return null;
      }

      // Step 4: Get download link
      const links = torrentInfo.links || [];
      if (links.length === 0) return null;

      // Step 5: Unrestrict
      const unrestrictResponse = await axios.post(`${backendUrl}/api/debrid/real-debrid/unrestrict`, null, {
        params: { link: links[0], token },
      });

      return unrestrictResponse.data?.data?.download || null;
    } catch (error) {
      console.error('[Real-Debrid] Error in magnet flow:', error);
      return null;
    }
  },

  getStreamLinks: async (imdbId: string, type: 'movie' | 'tv', title: string, year?: number): Promise<StreamLink[]> => {
    try {
      const token = await realDebridService.getToken();
      if (!token) return [];

      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const endpoint =
        type === 'movie'
          ? `${backendUrl}/api/torrents/movie?title=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`
          : `${backendUrl}/api/torrents/tv?title=${encodeURIComponent(title)}`;

      const response = await axios.get(endpoint);

      if (!response.data.success || !response.data.results) return [];

      const torrents = response.data.results;
      const qualityGroups: { [key: string]: any } = {};

      torrents.forEach((torrent: any) => {
        const quality = torrent.quality || '720p';
        if (!qualityGroups[quality] || torrent.seeders > qualityGroups[quality].seeders) {
          qualityGroups[quality] = torrent;
        }
      });

      const streamLinks: StreamLink[] = Object.entries(qualityGroups).map(([quality, torrent]) => ({
        quality,
        url: torrent.magnet,
        source: 'real-debrid',
        size: torrent.size,
        seeders: torrent.seeders,
      }));

      return streamLinks.sort((a, b) => {
        const order: { [key: string]: number } = { '2160p': 1, '1080p': 2, '720p': 3, '480p': 4 };
        return (order[a.quality] || 999) - (order[b.quality] || 999);
      });
    } catch (error) {
      console.error('[Real-Debrid] Error fetching stream links:', error);
      return [];
    }
  },
};

// ============================================
// ALLDEBRID SERVICE
// PIN Authentication Flow (Correct Implementation)
// ============================================
export const allDebridService = {
  // Step 1: Get PIN code
  getDeviceCode: async (): Promise<{
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
  }> => {
    console.log('[AllDebrid] Getting PIN code...');
    const useProxy = shouldUseProxy();
    console.log('[AllDebrid] useProxy:', useProxy);
    
    try {
      let response;
      
      if (useProxy) {
        // On web, use backend proxy
        response = await axios.get(`${getBackendUrl()}/api/debrid/alldebrid/pin`);
      } else {
        // On native, call AllDebrid directly
        response = await axios.get(`${ALLDEBRID_BASE_URL}/v4/pin/get`, {
          params: {
            agent: 'zeus-glass',
          },
        });
      }

      console.log('[AllDebrid] PIN response:', JSON.stringify(response.data));

      if (response.data.status !== 'success') {
        throw new Error(response.data.error?.message || 'Failed to get PIN');
      }

      const pinData = response.data.data;
      
      return {
        device_code: pinData.pin, // The PIN itself is used for checking
        user_code: pinData.pin,
        verification_url: pinData.user_url || 'https://alldebrid.com/pin/',
        expires_in: pinData.expires_in || 600,
        interval: 5,
      };
    } catch (error: any) {
      console.error('[AllDebrid] Error getting PIN:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to get PIN code');
    }
  },

  // Step 2: Poll for API key
  pollForToken: async (pin: string): Promise<{ access_token: string } | null> => {
    const useProxy = shouldUseProxy();
    
    try {
      console.log('[AllDebrid] Checking PIN:', pin);
      
      let response;
      
      if (useProxy) {
        // On web, use backend proxy
        response = await axios.get(`${getBackendUrl()}/api/debrid/alldebrid/pin-check`, {
          params: { pin },
        });
      } else {
        // On native, call AllDebrid directly
        response = await axios.get(`${ALLDEBRID_BASE_URL}/v4/pin/check`, {
          params: {
            agent: 'zeus-glass',
            pin: pin,
          },
          validateStatus: (status) => status < 500,
        });
      }

      console.log('[AllDebrid] Check response:', JSON.stringify(response.data));

      if (response.data.status === 'success' && response.data.data?.activated) {
        console.log('[AllDebrid] SUCCESS! Got API key!');
        return { access_token: response.data.data.apikey };
      }

      // Not activated yet
      return null;
    } catch (error: any) {
      console.error('[AllDebrid] Poll error:', error.response?.data || error.message);
      return null;
    }
  },

  saveToken: async (token: string): Promise<void> => {
    await storage.setItem(STORAGE_KEYS.ALLDEBRID_TOKEN, token);
  },

  getToken: async (): Promise<string | null> => {
    return await storage.getItem(STORAGE_KEYS.ALLDEBRID_TOKEN);
  },

  logout: async (): Promise<void> => {
    await storage.deleteItem(STORAGE_KEYS.ALLDEBRID_TOKEN);
  },

  getAccountInfo: async (): Promise<DebridAccount | null> => {
    try {
      const token = await allDebridService.getToken();
      if (!token) return null;

      const response = await axios.get(`${ALLDEBRID_BASE_URL}/v4/user`, {
        params: { agent: 'zeus-glass', apikey: token },
      });

      if (response.data.status !== 'success') return null;

      const data = response.data.data.user;
      const expiryTimestamp = data.premiumUntil * 1000;
      const expiryDate = new Date(expiryTimestamp);
      const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return {
        username: data.username,
        email: data.email,
        expiryDate: expiryDate.toISOString(),
        daysLeft,
        type: data.isPremium ? 'premium' : 'free',
      };
    } catch (error) {
      console.error('[AllDebrid] Error fetching account:', error);
      return null;
    }
  },

  getStreamLinks: async (imdbId: string, type: 'movie' | 'tv'): Promise<StreamLink[]> => {
    return [];
  },
};

// ============================================
// PREMIUMIZE SERVICE
// API Key Authentication (Correct Implementation)
// Note: Premiumize uses a simpler auth - direct API key entry
// For TV apps, we provide a manual API key entry method
// ============================================
export const premiumizeService = {
  // Premiumize doesn't have device code flow in the same way
  // We'll use a simplified approach where user enters API key directly
  // Or we provide the verification URL for them to get their key
  getDeviceCode: async (): Promise<{
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
  }> => {
    console.log('[Premiumize] Initializing auth...');
    
    // Premiumize uses direct API key auth
    // Generate a session ID for this auth attempt
    const sessionId = `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      device_code: sessionId,
      user_code: 'GET API KEY',
      verification_url: 'https://www.premiumize.me/account',
      expires_in: 600,
      interval: 5,
    };
  },

  // For Premiumize, we actually just need the user to enter their API key
  // This poll function will check if they've entered it via another method
  pollForToken: async (deviceCode: string): Promise<{ access_token: string } | null> => {
    // This won't work for Premiumize the same way
    // Instead, we should prompt user to enter their API key manually
    console.log('[Premiumize] Checking for API key...');
    
    // Check if user has manually entered their API key
    const manualKey = await storage.getItem('premiumize_pending_key');
    if (manualKey) {
      await storage.deleteItem('premiumize_pending_key');
      
      // Verify the key works
      try {
        const response = await axios.get(`${PREMIUMIZE_BASE_URL}/account/info`, {
          params: { apikey: manualKey },
        });
        
        if (response.data.status === 'success') {
          console.log('[Premiumize] API key verified!');
          return { access_token: manualKey };
        }
      } catch (error) {
        console.error('[Premiumize] Invalid API key');
      }
    }
    
    return null;
  },

  // Method for direct API key entry
  authenticateWithApiKey: async (apiKey: string): Promise<boolean> => {
    const useProxy = shouldUseProxy();
    
    try {
      console.log('[Premiumize] Verifying API key...');
      
      let response;
      
      if (useProxy) {
        // On web, use backend proxy
        response = await axios.get(`${getBackendUrl()}/api/debrid/premiumize/account-info`, {
          params: { apikey: apiKey },
        });
      } else {
        // On native, call Premiumize directly
        response = await axios.get(`${PREMIUMIZE_BASE_URL}/account/info`, {
          params: { apikey: apiKey },
        });
      }

      if (response.data.status === 'success') {
        await premiumizeService.saveToken(apiKey);
        console.log('[Premiumize] API key verified and saved!');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Premiumize] API key verification failed:', error);
      return false;
    }
  },

  saveToken: async (token: string): Promise<void> => {
    await storage.setItem(STORAGE_KEYS.PREMIUMIZE_TOKEN, token);
  },

  getToken: async (): Promise<string | null> => {
    return await storage.getItem(STORAGE_KEYS.PREMIUMIZE_TOKEN);
  },

  logout: async (): Promise<void> => {
    await storage.deleteItem(STORAGE_KEYS.PREMIUMIZE_TOKEN);
  },

  getAccountInfo: async (): Promise<DebridAccount | null> => {
    try {
      const token = await premiumizeService.getToken();
      if (!token) return null;

      const response = await axios.get(`${PREMIUMIZE_BASE_URL}/account/info`, {
        params: { apikey: token },
      });

      if (response.data.status !== 'success') return null;

      const data = response.data;
      const expiryTimestamp = data.premium_until * 1000;
      const expiryDate = new Date(expiryTimestamp);
      const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return {
        username: data.customer_id?.toString() || 'Premium User',
        expiryDate: expiryDate.toISOString(),
        daysLeft,
        type: data.status === 'premium' ? 'premium' : 'free',
      };
    } catch (error) {
      console.error('[Premiumize] Error fetching account:', error);
      return null;
    }
  },

  getStreamLinks: async (imdbId: string, type: 'movie' | 'tv'): Promise<StreamLink[]> => {
    return [];
  },
};

// ============================================
// DEBRID CACHE SEARCH SERVICE
// ============================================
export const debridCacheService = {
  searchCachedMovie: async (
    title: string,
    year?: number,
    imdbId?: string
  ): Promise<CachedTorrent[]> => {
    try {
      const token = await realDebridService.getToken();
      if (!token) {
        errorLogService.warn('No Real-Debrid token for cache search', 'DebridCache');
        return [];
      }

      // For mobile apps, we use the Torrentio API directly instead of going through backend
      // This avoids network errors when the backend is not accessible
      if (imdbId) {
        try {
          // Try Torrentio for instant results
          errorLogService.info(`Calling Torrentio directly for ${imdbId}`, 'DebridCache');
          const torrentioResults = await debridCacheService.searchTorrentio(imdbId, 'movie');
          errorLogService.info(`Torrentio returned ${torrentioResults.length} results`, 'DebridCache');
          
          if (torrentioResults.length > 0) {
            // Check cache status with Real-Debrid
            const hashes = torrentioResults.map(t => t.hash.toLowerCase());
            errorLogService.info(`Checking cache for ${hashes.length} hashes`, 'DebridCache');
            const cachedHashes = await debridCacheService.checkCacheStatus(hashes, token);
            errorLogService.info(`Found ${cachedHashes.length} cached hashes`, 'DebridCache');
            
            return torrentioResults.map(t => ({
              ...t,
              cached: cachedHashes.includes(t.hash.toLowerCase()),
            }));
          }
        } catch (torrentioError: any) {
          errorLogService.warn(`Torrentio direct call failed: ${torrentioError.message}`, 'DebridCache');
        }
      }

      // Fallback to backend if available
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      if (!backendUrl) {
        errorLogService.warn('No backend URL configured', 'DebridCache');
        return [];
      }

      const params = new URLSearchParams({ title, token });
      if (year) params.append('year', year.toString());
      if (imdbId) params.append('imdb_id', imdbId);

      const response = await axios.get(`${backendUrl}/api/debrid/cache/search/movie?${params.toString()}`, {
        timeout: 15000,
      });

      if (response.data.success) {
        return response.data.results || [];
      }

      return [];
    } catch (error: any) {
      errorLogService.error(`Cache search failed: ${error.message}`, 'DebridCache', error);
      return [];
    }
  },

  // Direct Torrentio API call (bypasses backend)
  searchTorrentio: async (imdbId: string, type: 'movie' | 'series', season?: number, episode?: number): Promise<CachedTorrent[]> => {
    try {
      let url = `https://torrentio.strem.fun/stream/${type}/${imdbId}`;
      if (type === 'series' && season !== undefined && episode !== undefined) {
        url += `:${season}:${episode}`;
      }
      url += '.json';

      const response = await axios.get(url, { timeout: 10000 });
      const streams = response.data?.streams || [];

      return streams.slice(0, 50).map((stream: any) => {
        // Parse info from title
        const title = stream.title || stream.name || '';
        const quality = title.match(/(4K|2160p|1080p|720p|480p)/i)?.[1] || '720p';
        const sizeMatch = title.match(/(\d+\.?\d*)\s*(GB|MB)/i);
        const size = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : '';
        
        // Extract hash from URL
        const hash = stream.infoHash || '';

        return {
          hash,
          title: stream.title || stream.name || 'Unknown',
          quality: quality.toUpperCase(),
          size,
          source: 'Torrentio',
          seeders: 0,
          cached: false, // Will be updated after cache check
          file_id: 0,
        };
      }).filter((t: CachedTorrent) => t.hash);
    } catch (error: any) {
      errorLogService.warn(`Torrentio search failed: ${error.message}`, 'DebridCache');
      return [];
    }
  },

  // Check cache status directly with Real-Debrid
  checkCacheStatus: async (hashes: string[], token: string): Promise<string[]> => {
    try {
      if (hashes.length === 0) return [];
      
      // Real-Debrid instant availability check
      const hashParam = hashes.join('/');
      const response = await axios.get(`https://api.real-debrid.com/rest/1.0/torrents/instantAvailability/${hashParam}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      const cachedHashes: string[] = [];
      if (response.data) {
        Object.keys(response.data).forEach(hash => {
          const data = response.data[hash];
          if (data && data.rd && data.rd.length > 0) {
            cachedHashes.push(hash.toLowerCase());
          }
        });
      }

      return cachedHashes;
    } catch (error: any) {
      errorLogService.warn(`Cache check failed: ${error.message}`, 'DebridCache');
      return [];
    }
  },

  searchCachedTV: async (
    title: string,
    season: number = 1,
    episode: number = 1,
    imdbId?: string
  ): Promise<CachedTorrent[]> => {
    try {
      const token = await realDebridService.getToken();
      if (!token) {
        errorLogService.warn('No Real-Debrid token for TV cache search', 'DebridCache');
        return [];
      }

      // For mobile apps, use Torrentio directly for TV shows
      if (imdbId) {
        try {
          errorLogService.info(`Calling Torrentio directly for ${imdbId} S${season}E${episode}`, 'DebridCache');
          const torrentioResults = await debridCacheService.searchTorrentio(imdbId, 'series', season, episode);
          errorLogService.info(`Torrentio returned ${torrentioResults.length} results`, 'DebridCache');
          
          if (torrentioResults.length > 0) {
            const hashes = torrentioResults.map(t => t.hash.toLowerCase());
            errorLogService.info(`Checking cache for ${hashes.length} hashes`, 'DebridCache');
            const cachedHashes = await debridCacheService.checkCacheStatus(hashes, token);
            errorLogService.info(`Found ${cachedHashes.length} cached hashes`, 'DebridCache');
            
            return torrentioResults.map(t => ({
              ...t,
              cached: cachedHashes.includes(t.hash.toLowerCase()),
            }));
          }
        } catch (torrentioError: any) {
          errorLogService.warn(`Torrentio TV direct call failed: ${torrentioError.message}`, 'DebridCache');
        }
      }

      // Fallback to backend
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      if (!backendUrl) {
        errorLogService.warn('No backend URL configured', 'DebridCache');
        return [];
      }

      const params = new URLSearchParams({
        title,
        token,
        season: season.toString(),
        episode: episode.toString(),
      });

      if (imdbId) params.append('imdb_id', imdbId);

      const response = await axios.get(`${backendUrl}/api/debrid/cache/search/tv?${params.toString()}`, {
        timeout: 15000,
      });

      if (response.data.success) {
        return response.data.results || [];
      }

      return [];
    } catch (error: any) {
      errorLogService.error(`TV cache search failed: ${error.message}`, 'DebridCache', error);
      return [];
    }
  },

  getStreamUrl: async (hash: string, fileId?: string): Promise<string | null> => {
    try {
      const token = await realDebridService.getToken();
      if (!token) {
        errorLogService.error('No Real-Debrid token for streaming', 'DebridCache');
        return null;
      }

      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const params = new URLSearchParams({ hash, token });

      if (fileId) params.append('file_id', fileId);

      const response = await axios.get(`${backendUrl}/api/debrid/cache/stream?${params.toString()}`);

      if (response.data.success && response.data.stream_url) {
        return response.data.stream_url;
      }

      return null;
    } catch (error: any) {
      errorLogService.error(`Failed to get stream URL: ${error.message}`, 'DebridCache', error);
      return null;
    }
  },

  convertToStreamLinks: (
    cachedTorrents: CachedTorrent[],
    source: 'real-debrid' | 'alldebrid' | 'premiumize' = 'real-debrid'
  ): StreamLink[] => {
    return cachedTorrents.map((torrent) => ({
      quality: torrent.quality,
      url: torrent.hash,
      source,
      size: torrent.size,
      seeders: torrent.seeders,
      isPremium: true,
    }));
  },
};
