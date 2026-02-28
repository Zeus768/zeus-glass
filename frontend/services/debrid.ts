import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import {
  REAL_DEBRID_BASE_URL,
  REAL_DEBRID_CLIENT_ID,
  ALLDEBRID_BASE_URL,
  ALLDEBRID_CLIENT_ID,
  PREMIUMIZE_BASE_URL,
  PREMIUMIZE_CLIENT_ID,
  STORAGE_KEYS,
} from '../config/constants';
import { DebridAccount, StreamLink } from '../types';

// Real-Debrid Service
export const realDebridService = {
  getDeviceCode: async (): Promise<{ device_code: string; user_code: string; verification_url: string; expires_in: number; interval: number }> => {
    const response = await axios.get(`${REAL_DEBRID_BASE_URL}/oauth/v2/device/code`, {
      params: { client_id: REAL_DEBRID_CLIENT_ID, new_credentials: 'yes' },
    });
    return response.data;
  },

  pollForToken: async (deviceCode: string, clientId: string, clientSecret: string): Promise<any> => {
    try {
      const response = await axios.post(`${REAL_DEBRID_BASE_URL}/oauth/v2/token`, null, {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          code: deviceCode,
          grant_type: 'http://oauth.net/grant_type/device/1.0',
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        return null; // Still pending
      }
      throw error;
    }
  },

  saveToken: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(STORAGE_KEYS.REAL_DEBRID_TOKEN, token);
  },

  getToken: async (): Promise<string | null> => {
    return await SecureStore.getItemAsync(STORAGE_KEYS.REAL_DEBRID_TOKEN);
  },

  logout: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.REAL_DEBRID_TOKEN);
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
      console.error('Error fetching Real-Debrid account:', error);
      return null;
    }
  },

  // Get stream links from torrents + debrid
  getStreamLinks: async (imdbId: string, type: 'movie' | 'tv', title: string, year?: number): Promise<StreamLink[]> => {
    try {
      const token = await realDebridService.getToken();
      if (!token) {
        console.log('No Real-Debrid token, returning empty links');
        return [];
      }

      // Use backend torrent scraper
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const endpoint = type === 'movie' 
        ? `${backendUrl}/api/torrents/movie?title=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`
        : `${backendUrl}/api/torrents/tv?title=${encodeURIComponent(title)}`;

      const response = await axios.get(endpoint);
      
      if (!response.data.success || !response.data.results) {
        return [];
      }

      const torrents = response.data.results;
      const streamLinks: StreamLink[] = [];

      // Convert torrents to stream links
      // Group by quality and take best seeders
      const qualityGroups: { [key: string]: any } = {};
      
      torrents.forEach((torrent: any) => {
        const quality = torrent.quality || '720p';
        if (!qualityGroups[quality] || torrent.seeders > qualityGroups[quality].seeders) {
          qualityGroups[quality] = torrent;
        }
      });

      // Convert to stream links
      Object.entries(qualityGroups).forEach(([quality, torrent]) => {
        streamLinks.push({
          quality,
          url: torrent.magnet,
          source: 'real-debrid',
          size: torrent.size,
          seeders: torrent.seeders,
        });
      });

      return streamLinks.sort((a, b) => {
        const qualityOrder: { [key: string]: number } = { '2160p': 1, '1080p': 2, '720p': 3, '480p': 4 };
        return (qualityOrder[a.quality] || 999) - (qualityOrder[b.quality] || 999);
      });
    } catch (error) {
      console.error('Error fetching Real-Debrid stream links:', error);
      return [];
    }
  },
};

// AllDebrid Service
export const allDebridService = {
  getDeviceCode: async (): Promise<{ device_code: string; user_code: string; verification_url: string; expires_in: number; interval: number }> => {
    const response = await axios.get(`${ALLDEBRID_BASE_URL}/v4/pin/get`, {
      params: { agent: ALLDEBRID_CLIENT_ID },
    });
    const data = response.data.data;
    return {
      device_code: data.pin,
      user_code: data.pin,
      verification_url: data.check_url || 'https://alldebrid.com/pin',
      expires_in: data.expires_in || 600,
      interval: 5,
    };
  },

  pollForToken: async (pin: string): Promise<any> => {
    try {
      const response = await axios.get(`${ALLDEBRID_BASE_URL}/v4/pin/check`, {
        params: { agent: ALLDEBRID_CLIENT_ID, pin, check: pin },
      });
      if (response.data.status === 'success' && response.data.data.activated) {
        return { access_token: response.data.data.apikey };
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  saveToken: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(STORAGE_KEYS.ALLDEBRID_TOKEN, token);
  },

  getToken: async (): Promise<string | null> => {
    return await SecureStore.getItemAsync(STORAGE_KEYS.ALLDEBRID_TOKEN);
  },

  logout: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ALLDEBRID_TOKEN);
  },

  getAccountInfo: async (): Promise<DebridAccount | null> => {
    try {
      const token = await allDebridService.getToken();
      if (!token) return null;

      const response = await axios.get(`${ALLDEBRID_BASE_URL}/v4/user`, {
        params: { agent: ALLDEBRID_CLIENT_ID, apikey: token },
      });

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
      console.error('Error fetching AllDebrid account:', error);
      return null;
    }
  },

  getStreamLinks: async (imdbId: string, type: 'movie' | 'tv'): Promise<StreamLink[]> => {
    // AllDebrid would use same torrent scraping but different unrestrict API
    // For now returning empty to avoid duplicates with Real-Debrid
    return [];
  },
};

// Premiumize Service
export const premiumizeService = {
  getDeviceCode: async (): Promise<{ device_code: string; user_code: string; verification_url: string; expires_in: number; interval: number }> => {
    const response = await axios.post(`${PREMIUMIZE_BASE_URL}/token`, null, {
      params: {
        grant_type: 'device_code',
        client_id: PREMIUMIZE_CLIENT_ID,
      },
    });
    return {
      device_code: response.data.device_code,
      user_code: response.data.user_code,
      verification_url: response.data.verification_uri || 'https://www.premiumize.me/device',
      expires_in: response.data.expires_in || 600,
      interval: response.data.interval || 5,
    };
  },

  pollForToken: async (deviceCode: string): Promise<any> => {
    try {
      const response = await axios.post(`${PREMIUMIZE_BASE_URL}/token`, null, {
        params: {
          grant_type: 'device_code',
          client_id: PREMIUMIZE_CLIENT_ID,
          code: deviceCode,
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        return null;
      }
      throw error;
    }
  },

  saveToken: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(STORAGE_KEYS.PREMIUMIZE_TOKEN, token);
  },

  getToken: async (): Promise<string | null> => {
    return await SecureStore.getItemAsync(STORAGE_KEYS.PREMIUMIZE_TOKEN);
  },

  logout: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.PREMIUMIZE_TOKEN);
  },

  getAccountInfo: async (): Promise<DebridAccount | null> => {
    try {
      const token = await premiumizeService.getToken();
      if (!token) return null;

      const response = await axios.get(`${PREMIUMIZE_BASE_URL}/account/info`, {
        params: { apikey: token },
      });

      const data = response.data;
      const expiryTimestamp = data.premium_until * 1000;
      const expiryDate = new Date(expiryTimestamp);
      const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return {
        username: data.customer_id,
        expiryDate: expiryDate.toISOString(),
        daysLeft,
        type: data.premium ? 'premium' : 'free',
      };
    } catch (error) {
      console.error('Error fetching Premiumize account:', error);
      return null;
    }
  },

  getStreamLinks: async (imdbId: string, type: 'movie' | 'tv'): Promise<StreamLink[]> => {
    // Premiumize would use same torrent scraping but different unrestrict API
    // For now returning empty to avoid duplicates with Real-Debrid
    return [];
  },
};
