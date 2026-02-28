import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';
import { IPTVConfig, IPTVChannel, EPGProgram, VODItem } from '../types';

// Mock IPTV Service (simulating Xtreme Codes API)
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

  // Mock authentication
  authenticate: async (domain: string, username: string, password: string): Promise<boolean> => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock success for any credentials
        resolve(true);
      }, 1000);
    });
  },

  // Mock get live channels
  getLiveChannels: async (): Promise<IPTVChannel[]> => {
    return [
      {
        id: 'bbc_one',
        name: 'BBC One',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/BBC_One_logo_2021.svg/200px-BBC_One_logo_2021.svg.png',
        category: 'Entertainment',
        stream_url: 'mock://stream/bbc-one',
        epg: [
          {
            id: 'epg1',
            title: 'House of the Dragon',
            description: 'The reign of House Targaryen begins.',
            start: new Date().toISOString(),
            end: new Date(Date.now() + 3600000).toISOString(),
            channel_id: 'bbc_one',
          },
        ],
      },
      {
        id: 'bbc_two',
        name: 'BBC Two',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/BBC_Two_logo_2021.svg/200px-BBC_Two_logo_2021.svg.png',
        category: 'Entertainment',
        stream_url: 'mock://stream/bbc-two',
        epg: [
          {
            id: 'epg2',
            title: 'The Last of Us',
            description: 'Post-apocalyptic drama series.',
            start: new Date().toISOString(),
            end: new Date(Date.now() + 3600000).toISOString(),
            channel_id: 'bbc_two',
          },
        ],
      },
      {
        id: 'itv',
        name: 'ITV',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/ITV_logo_2019.svg/200px-ITV_logo_2019.svg.png',
        category: 'Entertainment',
        stream_url: 'mock://stream/itv',
        epg: [
          {
            id: 'epg3',
            title: 'Succession',
            description: 'Drama about a media dynasty.',
            start: new Date().toISOString(),
            end: new Date(Date.now() + 3600000).toISOString(),
            channel_id: 'itv',
          },
        ],
      },
      {
        id: 'sky_sports',
        name: 'Sky Sports Premier League',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e2/Sky_Sports_Premier_League_2017_logo.svg/200px-Sky_Sports_Premier_League_2017_logo.svg.png',
        category: 'Sports',
        stream_url: 'mock://stream/sky-sports',
        epg: [
          {
            id: 'epg4',
            title: 'Premier League Live',
            description: 'Live football coverage.',
            start: new Date().toISOString(),
            end: new Date(Date.now() + 7200000).toISOString(),
            channel_id: 'sky_sports',
          },
        ],
      },
      {
        id: 'sky_news',
        name: 'Sky News',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/20/Sky_News_logo_2023.svg/200px-Sky_News_logo_2023.svg.png',
        category: 'News',
        stream_url: 'mock://stream/sky-news',
        epg: [
          {
            id: 'epg5',
            title: 'Breaking News',
            description: 'Latest news and updates.',
            start: new Date().toISOString(),
            end: new Date(Date.now() + 1800000).toISOString(),
            channel_id: 'sky_news',
          },
        ],
      },
    ];
  },

  // Mock get VOD
  getVODContent: async (): Promise<VODItem[]> => {
    return [
      {
        id: 'vod1',
        name: 'Dune: Part Two',
        description: 'Epic sci-fi sequel',
        poster: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
        category: 'Movies',
        stream_url: 'mock://vod/dune-2',
        duration: 155,
        year: '2024',
      },
      {
        id: 'vod2',
        name: 'Oppenheimer',
        description: 'Biographical thriller',
        poster: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
        category: 'Movies',
        stream_url: 'mock://vod/oppenheimer',
        duration: 180,
        year: '2023',
      },
    ];
  },

  // Mock get account info
  getAccountInfo: async (): Promise<{ username: string; expiryDate: string; daysLeft: number } | null> => {
    const config = await iptvService.getConfig();
    if (!config || !config.enabled) return null;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 180); // 6 months
    const daysLeft = 180;

    return {
      username: config.username,
      expiryDate: expiryDate.toISOString(),
      daysLeft,
    };
  },
};
