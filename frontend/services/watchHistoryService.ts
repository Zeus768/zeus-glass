import AsyncStorage from '@react-native-async-storage/async-storage';

const WATCH_HISTORY_KEY = 'zeus_watch_history';
const MAX_HISTORY_ITEMS = 50;

export interface WatchHistoryItem {
  id: number;
  tmdbId: number;
  imdbId?: string;
  title: string;
  poster_path?: string;
  backdrop_path?: string;
  type: 'movie' | 'tv';
  year?: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  progress: number; // 0-100 percentage
  duration: number; // total duration in seconds
  currentTime: number; // current position in seconds
  watchedAt: string; // ISO date string
  streamUrl?: string;
}

class WatchHistoryService {
  private history: WatchHistoryItem[] = [];
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.loadHistory();
    this.initialized = true;
  }

  private async loadHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(WATCH_HISTORY_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[WatchHistory] Error loading history:', error);
      this.history = [];
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('[WatchHistory] Error saving history:', error);
    }
  }

  async addOrUpdate(item: Omit<WatchHistoryItem, 'watchedAt'>): Promise<void> {
    await this.init();

    const existingIndex = this.history.findIndex(h => {
      if (h.type === 'tv' && item.type === 'tv') {
        return h.tmdbId === item.tmdbId && h.season === item.season && h.episode === item.episode;
      }
      return h.tmdbId === item.tmdbId && h.type === item.type;
    });

    const newItem: WatchHistoryItem = {
      ...item,
      watchedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      // Update existing and move to front
      this.history.splice(existingIndex, 1);
    }

    // Add to front of array
    this.history.unshift(newItem);

    // Trim to max items
    if (this.history.length > MAX_HISTORY_ITEMS) {
      this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
    }

    await this.saveHistory();
  }

  async updateProgress(tmdbId: number, type: 'movie' | 'tv', progress: number, currentTime: number, season?: number, episode?: number): Promise<void> {
    await this.init();

    const index = this.history.findIndex(h => {
      if (h.type === 'tv' && type === 'tv') {
        return h.tmdbId === tmdbId && h.season === season && h.episode === episode;
      }
      return h.tmdbId === tmdbId && h.type === type;
    });

    if (index >= 0) {
      this.history[index].progress = progress;
      this.history[index].currentTime = currentTime;
      this.history[index].watchedAt = new Date().toISOString();
      await this.saveHistory();
    }
  }

  async getContinueWatching(): Promise<WatchHistoryItem[]> {
    await this.init();
    // Return items with progress between 5% and 95% (not finished, but started)
    return this.history.filter(item => item.progress >= 5 && item.progress < 95);
  }

  async getRecentlyWatched(limit: number = 20): Promise<WatchHistoryItem[]> {
    await this.init();
    return this.history.slice(0, limit);
  }

  async getHistory(): Promise<WatchHistoryItem[]> {
    await this.init();
    return [...this.history];
  }

  async removeItem(tmdbId: number, type: 'movie' | 'tv', season?: number, episode?: number): Promise<void> {
    await this.init();
    
    this.history = this.history.filter(h => {
      if (h.type === 'tv' && type === 'tv') {
        return !(h.tmdbId === tmdbId && h.season === season && h.episode === episode);
      }
      return !(h.tmdbId === tmdbId && h.type === type);
    });

    await this.saveHistory();
  }

  async clearHistory(): Promise<void> {
    this.history = [];
    await AsyncStorage.removeItem(WATCH_HISTORY_KEY);
  }

  async getLastWatched(tmdbId: number, type: 'movie' | 'tv'): Promise<WatchHistoryItem | null> {
    await this.init();
    
    if (type === 'tv') {
      // Get the most recent episode watched for this show
      return this.history.find(h => h.tmdbId === tmdbId && h.type === 'tv') || null;
    }
    
    return this.history.find(h => h.tmdbId === tmdbId && h.type === type) || null;
  }

  // For resuming playback
  async getResumePosition(tmdbId: number, type: 'movie' | 'tv', season?: number, episode?: number): Promise<number> {
    await this.init();
    
    const item = this.history.find(h => {
      if (h.type === 'tv' && type === 'tv') {
        return h.tmdbId === tmdbId && h.season === season && h.episode === episode;
      }
      return h.tmdbId === tmdbId && h.type === type;
    });

    if (item && item.progress < 95) {
      return item.currentTime;
    }
    return 0;
  }
}

export const watchHistoryService = new WatchHistoryService();
