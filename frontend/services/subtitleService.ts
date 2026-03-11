import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const OPENSUBTITLES_API_URL = 'https://api.opensubtitles.com/api/v1';
const STORAGE_KEY_OPENSUBTITLES = 'opensubtitles_config';
const STORAGE_KEY_SUBTITLE_SETTINGS = 'subtitle_settings';

export interface SubtitleTrack {
  id: string;
  language: string;
  languageCode: string;
  url: string;
  format: 'srt' | 'vtt' | 'ass';
  source: 'opensubtitles' | 'local';
  rating?: number;
  downloads?: number;
}

export interface SubtitleSettings {
  enabled: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  fontSizePixels: number;
  backgroundColor: string;
  textColor: string;
  preferredLanguages: string[];
  autoDownload: boolean;
}

export interface OpenSubtitlesConfig {
  apiKey: string;
  username?: string;
  password?: string;
  token?: string;
  tokenExpiry?: number;
}

const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  enabled: true,
  fontSize: 'medium',
  fontSizePixels: 24,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  textColor: '#FFFFFF',
  preferredLanguages: ['en', 'eng'],
  autoDownload: true,
};

const FONT_SIZE_MAP = {
  'small': 18,
  'medium': 24,
  'large': 32,
  'extra-large': 42,
};

class SubtitleService {
  private config: OpenSubtitlesConfig | null = null;
  private settings: SubtitleSettings = DEFAULT_SUBTITLE_SETTINGS;

  async init() {
    await this.loadConfig();
    await this.loadSettings();
  }

  // Config management
  async loadConfig(): Promise<OpenSubtitlesConfig | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_OPENSUBTITLES);
      if (stored) {
        this.config = JSON.parse(stored);
        return this.config;
      }
    } catch (e) {
      console.error('[Subtitles] Error loading config:', e);
    }
    return null;
  }

  async saveConfig(config: OpenSubtitlesConfig): Promise<void> {
    this.config = config;
    await AsyncStorage.setItem(STORAGE_KEY_OPENSUBTITLES, JSON.stringify(config));
  }

  async clearConfig(): Promise<void> {
    this.config = null;
    await AsyncStorage.removeItem(STORAGE_KEY_OPENSUBTITLES);
  }

  hasOpenSubtitlesConfig(): boolean {
    return !!this.config?.apiKey;
  }

  // Settings management
  async loadSettings(): Promise<SubtitleSettings> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_SUBTITLE_SETTINGS);
      if (stored) {
        this.settings = { ...DEFAULT_SUBTITLE_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('[Subtitles] Error loading settings:', e);
    }
    return this.settings;
  }

  async saveSettings(settings: Partial<SubtitleSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    // Update pixel size if fontSize changed
    if (settings.fontSize) {
      this.settings.fontSizePixels = FONT_SIZE_MAP[settings.fontSize];
    }
    await AsyncStorage.setItem(STORAGE_KEY_SUBTITLE_SETTINGS, JSON.stringify(this.settings));
  }

  getSettings(): SubtitleSettings {
    return this.settings;
  }

  // OpenSubtitles authentication
  async login(username: string, password: string, apiKey: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${OPENSUBTITLES_API_URL}/login`,
        { username, password },
        {
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      if (response.data?.token) {
        await this.saveConfig({
          apiKey,
          username,
          password,
          token: response.data.token,
          tokenExpiry: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        });
        return true;
      }
    } catch (e: any) {
      console.error('[OpenSubtitles] Login error:', e.message);
    }
    return false;
  }

  // Search subtitles by IMDB ID
  async searchByImdbId(imdbId: string, season?: number, episode?: number): Promise<SubtitleTrack[]> {
    if (!this.config?.apiKey) {
      console.log('[Subtitles] No API key configured');
      return [];
    }

    try {
      const params: any = {
        imdb_id: imdbId.replace('tt', ''),
        languages: this.settings.preferredLanguages.join(','),
      };

      if (season !== undefined) params.season_number = season;
      if (episode !== undefined) params.episode_number = episode;

      const headers: any = {
        'Api-Key': this.config.apiKey,
      };

      if (this.config.token) {
        headers['Authorization'] = `Bearer ${this.config.token}`;
      }

      const response = await axios.get(
        `${OPENSUBTITLES_API_URL}/subtitles`,
        {
          params,
          headers,
          timeout: 15000,
        }
      );

      const subtitles = response.data?.data || [];
      return subtitles.map((sub: any) => ({
        id: sub.id,
        language: sub.attributes?.language || 'Unknown',
        languageCode: sub.attributes?.language || 'en',
        url: '', // Need to download to get URL
        format: 'srt',
        source: 'opensubtitles' as const,
        rating: sub.attributes?.ratings,
        downloads: sub.attributes?.download_count,
        fileId: sub.attributes?.files?.[0]?.file_id,
      }));
    } catch (e: any) {
      console.error('[OpenSubtitles] Search error:', e.message);
      return [];
    }
  }

  // Search by movie/show name
  async searchByTitle(title: string, year?: number, type: 'movie' | 'tv' = 'movie'): Promise<SubtitleTrack[]> {
    if (!this.config?.apiKey) {
      return [];
    }

    try {
      const params: any = {
        query: title,
        languages: this.settings.preferredLanguages.join(','),
        type: type === 'tv' ? 'episode' : 'movie',
      };

      if (year) params.year = year;

      const headers: any = {
        'Api-Key': this.config.apiKey,
      };

      if (this.config.token) {
        headers['Authorization'] = `Bearer ${this.config.token}`;
      }

      const response = await axios.get(
        `${OPENSUBTITLES_API_URL}/subtitles`,
        {
          params,
          headers,
          timeout: 15000,
        }
      );

      const subtitles = response.data?.data || [];
      return subtitles.slice(0, 20).map((sub: any) => ({
        id: sub.id,
        language: sub.attributes?.language || 'Unknown',
        languageCode: sub.attributes?.language || 'en',
        url: '',
        format: 'srt',
        source: 'opensubtitles' as const,
        rating: sub.attributes?.ratings,
        downloads: sub.attributes?.download_count,
        fileId: sub.attributes?.files?.[0]?.file_id,
      }));
    } catch (e: any) {
      console.error('[OpenSubtitles] Search error:', e.message);
      return [];
    }
  }

  // Download subtitle and get URL
  async downloadSubtitle(fileId: string): Promise<string | null> {
    if (!this.config?.apiKey) {
      return null;
    }

    try {
      const headers: any = {
        'Api-Key': this.config.apiKey,
        'Content-Type': 'application/json',
      };

      if (this.config.token) {
        headers['Authorization'] = `Bearer ${this.config.token}`;
      }

      const response = await axios.post(
        `${OPENSUBTITLES_API_URL}/download`,
        { file_id: parseInt(fileId) },
        {
          headers,
          timeout: 15000,
        }
      );

      return response.data?.link || null;
    } catch (e: any) {
      console.error('[OpenSubtitles] Download error:', e.message);
      return null;
    }
  }

  // Convert SRT to VTT (WebVTT format for web player)
  convertSrtToVtt(srtContent: string): string {
    let vtt = 'WEBVTT\n\n';
    
    // Replace SRT timestamps with VTT format
    const converted = srtContent
      .replace(/\r\n/g, '\n')
      .replace(/(\d+)\n(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})/g, 
        (match, num, start, startMs, end, endMs) => {
          return `${start}.${startMs} --> ${end}.${endMs}`;
        });
    
    vtt += converted;
    return vtt;
  }

  // Parse local subtitle file
  async parseLocalSubtitle(fileUri: string): Promise<SubtitleTrack | null> {
    try {
      // Determine format from extension
      const extension = fileUri.split('.').pop()?.toLowerCase();
      let format: 'srt' | 'vtt' | 'ass' = 'srt';
      if (extension === 'vtt') format = 'vtt';
      if (extension === 'ass' || extension === 'ssa') format = 'ass';

      return {
        id: `local-${Date.now()}`,
        language: 'Local',
        languageCode: 'local',
        url: fileUri,
        format,
        source: 'local',
      };
    } catch (e) {
      console.error('[Subtitles] Parse local error:', e);
      return null;
    }
  }

  // Get CSS for subtitle styling
  getSubtitleStyle(): object {
    return {
      fontSize: this.settings.fontSizePixels,
      color: this.settings.textColor,
      backgroundColor: this.settings.backgroundColor,
      padding: '4px 8px',
      borderRadius: 4,
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
    };
  }
}

export const subtitleService = new SubtitleService();
