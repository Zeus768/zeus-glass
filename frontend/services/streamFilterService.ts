import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_STREAM_DEFAULTS = 'stream_default_settings';
const STORAGE_KEY_ONE_CLICK_PLAY = 'one_click_play_settings';

export interface StreamFilterSettings {
  // Quality filters
  qualities: string[];
  preferredQuality: string | null;
  
  // Size filters
  minSizeGB: number | null;
  maxSizeGB: number | null;
  
  // Hoster filters
  preferredHosters: string[];
  excludedHosters: string[];
  
  // Sorting
  sortBy: 'quality' | 'size' | 'seeders' | 'hoster';
  sortOrder: 'asc' | 'desc';
}

export interface OneClickPlaySettings {
  enabled: boolean;
  preferredQuality: '4K' | 'REMUX' | '1080p' | '720p' | 'any';
  preferredHoster: string | null;
  preferredDebridService: 'real-debrid' | 'alldebrid' | 'premiumize' | 'any';
  minSizeGB: number | null;
  maxSizeGB: number | null;
  prioritizeIPTVPremium: boolean;
}

const DEFAULT_FILTER_SETTINGS: StreamFilterSettings = {
  qualities: ['4K', 'REMUX', '1080p', '720p', '480p'],
  preferredQuality: null,
  minSizeGB: null,
  maxSizeGB: null,
  preferredHosters: [],
  excludedHosters: [],
  sortBy: 'quality',
  sortOrder: 'desc',
};

const DEFAULT_ONE_CLICK_SETTINGS: OneClickPlaySettings = {
  enabled: false,
  preferredQuality: '1080p',
  preferredHoster: null,
  preferredDebridService: 'any',
  minSizeGB: null,
  maxSizeGB: null,
  prioritizeIPTVPremium: false,
};

// Quality priority order (higher = better)
const QUALITY_PRIORITY: { [key: string]: number } = {
  '4K': 100,
  'REMUX': 95,
  '2160p': 90,
  '1080p': 80,
  'HD': 70,
  '720p': 60,
  '480p': 40,
  'SD': 30,
  'CAM': 10,
  'Unknown': 0,
};

export interface FilterableStream {
  name: string;
  url: string;
  quality: string;
  size?: string;
  sizeBytes?: number;
  seeders?: number;
  hoster: string;
  source: string;
  type: 'torrent' | 'direct' | 'embed' | 'iptv';
  isIPTVPremium?: boolean;
}

class StreamFilterService {
  private defaultSettings: StreamFilterSettings = DEFAULT_FILTER_SETTINGS;
  private oneClickSettings: OneClickPlaySettings = DEFAULT_ONE_CLICK_SETTINGS;

  async init() {
    await this.loadSettings();
  }

  async loadSettings(): Promise<void> {
    try {
      const defaultsStr = await AsyncStorage.getItem(STORAGE_KEY_STREAM_DEFAULTS);
      if (defaultsStr) {
        this.defaultSettings = { ...DEFAULT_FILTER_SETTINGS, ...JSON.parse(defaultsStr) };
      }

      const oneClickStr = await AsyncStorage.getItem(STORAGE_KEY_ONE_CLICK_PLAY);
      if (oneClickStr) {
        this.oneClickSettings = { ...DEFAULT_ONE_CLICK_SETTINGS, ...JSON.parse(oneClickStr) };
      }
    } catch (e) {
      console.error('[StreamFilter] Error loading settings:', e);
    }
  }

  async saveDefaultSettings(settings: Partial<StreamFilterSettings>): Promise<void> {
    this.defaultSettings = { ...this.defaultSettings, ...settings };
    await AsyncStorage.setItem(STORAGE_KEY_STREAM_DEFAULTS, JSON.stringify(this.defaultSettings));
  }

  async saveOneClickSettings(settings: Partial<OneClickPlaySettings>): Promise<void> {
    this.oneClickSettings = { ...this.oneClickSettings, ...settings };
    await AsyncStorage.setItem(STORAGE_KEY_ONE_CLICK_PLAY, JSON.stringify(this.oneClickSettings));
  }

  getDefaultSettings(): StreamFilterSettings {
    return { ...this.defaultSettings };
  }

  getOneClickSettings(): OneClickPlaySettings {
    return { ...this.oneClickSettings };
  }

  // Filter streams based on current filter settings
  filterStreams(
    streams: FilterableStream[], 
    filters?: Partial<StreamFilterSettings>
  ): FilterableStream[] {
    const activeFilters = filters || this.defaultSettings;
    
    let filtered = [...streams];

    // Filter by quality
    if (activeFilters.qualities && activeFilters.qualities.length > 0) {
      filtered = filtered.filter(s => 
        activeFilters.qualities!.some(q => 
          s.quality.toUpperCase().includes(q.toUpperCase()) ||
          q.toUpperCase() === s.quality.toUpperCase()
        )
      );
    }

    // Filter by size
    if (activeFilters.minSizeGB !== null || activeFilters.maxSizeGB !== null) {
      filtered = filtered.filter(s => {
        if (!s.sizeBytes && !s.size) return true; // Keep if no size info
        
        const sizeGB = s.sizeBytes 
          ? s.sizeBytes / (1024 * 1024 * 1024)
          : this.parseSizeToGB(s.size || '');
        
        if (sizeGB === 0) return true;
        
        if (activeFilters.minSizeGB !== null && sizeGB < activeFilters.minSizeGB) {
          return false;
        }
        if (activeFilters.maxSizeGB !== null && sizeGB > activeFilters.maxSizeGB) {
          return false;
        }
        return true;
      });
    }

    // Filter by excluded hosters
    if (activeFilters.excludedHosters && activeFilters.excludedHosters.length > 0) {
      filtered = filtered.filter(s => 
        !activeFilters.excludedHosters!.some(h => 
          s.hoster.toLowerCase().includes(h.toLowerCase()) ||
          s.source.toLowerCase().includes(h.toLowerCase())
        )
      );
    }

    // Sort streams
    filtered = this.sortStreams(filtered, activeFilters.sortBy, activeFilters.sortOrder);

    // Prioritize preferred hosters
    if (activeFilters.preferredHosters && activeFilters.preferredHosters.length > 0) {
      const preferred: FilterableStream[] = [];
      const others: FilterableStream[] = [];
      
      filtered.forEach(s => {
        const isPreferred = activeFilters.preferredHosters!.some(h =>
          s.hoster.toLowerCase().includes(h.toLowerCase()) ||
          s.source.toLowerCase().includes(h.toLowerCase())
        );
        if (isPreferred) {
          preferred.push(s);
        } else {
          others.push(s);
        }
      });
      
      filtered = [...preferred, ...others];
    }

    return filtered;
  }

  // Sort streams
  sortStreams(
    streams: FilterableStream[], 
    sortBy: StreamFilterSettings['sortBy'] = 'quality',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): FilterableStream[] {
    const sorted = [...streams];
    const multiplier = sortOrder === 'desc' ? -1 : 1;

    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'quality':
          const aPriority = QUALITY_PRIORITY[a.quality] || QUALITY_PRIORITY['Unknown'];
          const bPriority = QUALITY_PRIORITY[b.quality] || QUALITY_PRIORITY['Unknown'];
          return (aPriority - bPriority) * multiplier;
        
        case 'size':
          const aSize = a.sizeBytes || this.parseSizeToBytes(a.size || '');
          const bSize = b.sizeBytes || this.parseSizeToBytes(b.size || '');
          return (aSize - bSize) * multiplier;
        
        case 'seeders':
          return ((a.seeders || 0) - (b.seeders || 0)) * multiplier;
        
        case 'hoster':
          return a.hoster.localeCompare(b.hoster) * multiplier;
        
        default:
          return 0;
      }
    });

    return sorted;
  }

  // Get best stream for one-click play
  getBestStreamForOneClick(streams: FilterableStream[]): FilterableStream | null {
    if (!this.oneClickSettings.enabled || streams.length === 0) {
      return null;
    }

    let candidates = [...streams];

    // Prioritize IPTV Premium if enabled
    if (this.oneClickSettings.prioritizeIPTVPremium) {
      const iptvStreams = candidates.filter(s => s.isIPTVPremium);
      if (iptvStreams.length > 0) {
        return iptvStreams[0];
      }
    }

    // Filter by preferred quality
    if (this.oneClickSettings.preferredQuality !== 'any') {
      const qualityFiltered = candidates.filter(s => 
        s.quality.toUpperCase().includes(this.oneClickSettings.preferredQuality)
      );
      if (qualityFiltered.length > 0) {
        candidates = qualityFiltered;
      }
    }

    // Filter by size
    if (this.oneClickSettings.minSizeGB || this.oneClickSettings.maxSizeGB) {
      candidates = candidates.filter(s => {
        const sizeGB = s.sizeBytes 
          ? s.sizeBytes / (1024 * 1024 * 1024)
          : this.parseSizeToGB(s.size || '');
        
        if (sizeGB === 0) return true;
        
        if (this.oneClickSettings.minSizeGB && sizeGB < this.oneClickSettings.minSizeGB) {
          return false;
        }
        if (this.oneClickSettings.maxSizeGB && sizeGB > this.oneClickSettings.maxSizeGB) {
          return false;
        }
        return true;
      });
    }

    // Filter by preferred hoster
    if (this.oneClickSettings.preferredHoster) {
      const hosterFiltered = candidates.filter(s =>
        s.hoster.toLowerCase().includes(this.oneClickSettings.preferredHoster!.toLowerCase()) ||
        s.source.toLowerCase().includes(this.oneClickSettings.preferredHoster!.toLowerCase())
      );
      if (hosterFiltered.length > 0) {
        candidates = hosterFiltered;
      }
    }

    // Sort by quality and return best
    candidates = this.sortStreams(candidates, 'quality', 'desc');
    return candidates[0] || null;
  }

  // Helper to parse size string to GB
  private parseSizeToGB(sizeStr: string): number {
    const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    switch (unit) {
      case 'TB': return value * 1024;
      case 'GB': return value;
      case 'MB': return value / 1024;
      default: return 0;
    }
  }

  // Helper to parse size string to bytes
  private parseSizeToBytes(sizeStr: string): number {
    return this.parseSizeToGB(sizeStr) * 1024 * 1024 * 1024;
  }

  // Get unique qualities from streams
  getUniqueQualities(streams: FilterableStream[]): string[] {
    const qualities = new Set<string>();
    streams.forEach(s => qualities.add(s.quality));
    
    // Sort by quality priority
    return Array.from(qualities).sort((a, b) => 
      (QUALITY_PRIORITY[b] || 0) - (QUALITY_PRIORITY[a] || 0)
    );
  }

  // Get unique hosters from streams
  getUniqueHosters(streams: FilterableStream[]): string[] {
    const hosters = new Set<string>();
    streams.forEach(s => {
      hosters.add(s.hoster);
      if (s.source !== s.hoster) hosters.add(s.source);
    });
    return Array.from(hosters).sort();
  }

  // Get size range from streams
  getSizeRange(streams: FilterableStream[]): { min: number; max: number } {
    let min = Infinity;
    let max = 0;
    
    streams.forEach(s => {
      const sizeGB = s.sizeBytes 
        ? s.sizeBytes / (1024 * 1024 * 1024)
        : this.parseSizeToGB(s.size || '');
      
      if (sizeGB > 0) {
        min = Math.min(min, sizeGB);
        max = Math.max(max, sizeGB);
      }
    });
    
    return { 
      min: min === Infinity ? 0 : min, 
      max 
    };
  }
}

export const streamFilterService = new StreamFilterService();
