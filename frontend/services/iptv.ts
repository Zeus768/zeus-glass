import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { STORAGE_KEYS } from '../config/constants';
import { IPTVConfig, IPTVChannel, EPGProgram, VODItem } from '../types';

// Real Xtreme Codes IPTV Service
export const iptvService = {
  saveConfig: async (config: IPTVConfig): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEYS.IPTV_CONFIG, JSON.stringify(config));
  },

  getConfig: async (): Promise<IPTVConfig | null> => {
    const config = await AsyncStorage.getItem(STORAGE_KEYS.IPTV_CONFIG);
    return config ? JSON.parse(config) : null;
  },

  logout: async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEYS.IPTV_CONFIG);
  },

  // Real Xtreme Codes authentication
  authenticate: async (domain: string, username: string, password: string): Promise<boolean> => {
    try {
      // Clean domain (remove http/https if present)
      let cleanDomain = domain.replace(/^https?:\/\//, '');
      
      // Test authentication by getting user info
      const response = await axios.get(
        `http://${cleanDomain}/player_api.php`,
        {
          params: {
            username: username,
            password: password,
          },
          timeout: 10000,
        }
      );

      // If we get user_info, authentication is successful
      if (response.data && response.data.user_info) {
        return true;
      }
      
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

      let cleanDomain = config.domain.replace(/^https?:\/\//, '');
      
      const response = await axios.get(
        `http://${cleanDomain}/player_api.php`,
        {
          params: {
            username: config.username,
            password: config.password,
            action: 'get_live_streams',
          },
          timeout: 15000,
        }
      );

      const streams = response.data || [];
      const channels: IPTVChannel[] = [];

      // Convert to our format (limit to 50 for performance)
      for (const stream of streams.slice(0, 50)) {
        const channel: IPTVChannel = {
          id: stream.stream_id?.toString() || stream.num?.toString(),
          name: stream.name || 'Unknown Channel',
          logo: stream.stream_icon || '',
          category: stream.category_name || 'Uncategorized',
          stream_url: `http://${cleanDomain}/live/${config.username}/${config.password}/${stream.stream_id}.ts`,
          epg: [], // EPG loaded separately
        };
        channels.push(channel);
      }

      return channels;
    } catch (error) {
      console.error('Error fetching live channels:', error);
      return [];
    }
  },

  // Get VOD content from Xtreme Codes
  getVODContent: async (): Promise<VODItem[]> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) {
        return [];
      }

      let cleanDomain = config.domain.replace(/^https?:\/\//, '');
      
      const response = await axios.get(
        `http://${cleanDomain}/player_api.php`,
        {
          params: {
            username: config.username,
            password: config.password,
            action: 'get_vod_streams',
          },
          timeout: 15000,
        }
      );

      const streams = response.data || [];
      const vodItems: VODItem[] = [];

      // Convert to our format (limit to 50 for performance)
      for (const stream of streams.slice(0, 50)) {
        const vodItem: VODItem = {
          id: stream.stream_id?.toString() || stream.num?.toString(),
          name: stream.name || 'Unknown',
          description: stream.plot || stream.description || '',
          poster: stream.stream_icon || stream.cover || '',
          backdrop: stream.backdrop_path?.[0] || '',
          category: stream.category_name || 'Movies',
          stream_url: `http://${cleanDomain}/movie/${config.username}/${config.password}/${stream.stream_id}.${stream.container_extension || 'mp4'}`,
          duration: stream.duration ? parseInt(stream.duration) : undefined,
          year: stream.releasedate || stream.year || '',
        };
        vodItems.push(vodItem);
      }

      return vodItems;
    } catch (error) {
      console.error('Error fetching VOD content:', error);
      return [];
    }
  },

  // Get account info from Xtreme Codes
  getAccountInfo: async (): Promise<{ username: string; expiryDate: string; daysLeft: number } | null> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) return null;

      let cleanDomain = config.domain.replace(/^https?:\/\//, '');
      
      const response = await axios.get(
        `http://${cleanDomain}/player_api.php`,
        {
          params: {
            username: config.username,
            password: config.password,
          },
          timeout: 10000,
        }
      );

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

  // Get EPG for a channel
  getEPG: async (channelId: string): Promise<EPGProgram[]> => {
    try {
      const config = await iptvService.getConfig();
      if (!config || !config.enabled) return [];

      let cleanDomain = config.domain.replace(/^https?:\/\//, '');
      
      const response = await axios.get(
        `http://${cleanDomain}/player_api.php`,
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

      const epgData = response.data?.epg_listings || [];
      const programs: EPGProgram[] = [];

      for (const epg of epgData.slice(0, 10)) {
        programs.push({
          id: epg.id || `${channelId}-${epg.start}`,
          title: epg.title || 'Program',
          description: epg.description || '',
          start: new Date(parseInt(epg.start) * 1000).toISOString(),
          end: new Date(parseInt(epg.end) * 1000).toISOString(),
          channel_id: channelId,
        });
      }

      return programs;
    } catch (error) {
      console.error('Error fetching EPG:', error);
      return [];
    }
  },
};
