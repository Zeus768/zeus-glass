import AsyncStorage from '@react-native-async-storage/async-storage';

const CONTENT_FILTER_KEY = '@zeus_content_filter';

// Adult/NSFW keyword patterns to filter from stream links and titles
const ADULT_KEYWORDS = [
  'xxx', 'porn', 'adult', 'nsfw', 'hentai', 'erotic', 'brazzers',
  'bangbros', 'naughtyamerica', 'realitykings', 'xvideos', 'xhamster',
  'pornhub', 'redtube', 'youporn', 'tube8', 'spankbang', 'xnxx',
  'chaturbate', 'livejasmin', 'cam4', 'stripchat', 'bongacams',
  'onlyfans', 'fapello', 'rule34', 'nhentai', 'hanime',
];

// Domain patterns that are known adult sites
const ADULT_DOMAINS = [
  'xvideos.com', 'pornhub.com', 'xhamster.com', 'redtube.com',
  'youporn.com', 'tube8.com', 'spankbang.com', 'xnxx.com',
  'chaturbate.com', 'livejasmin.com', 'cam4.com', 'stripchat.com',
];

export interface ContentFilterSettings {
  enabled: boolean;
  blockAdultStreams: boolean;
  blockAdultCategories: boolean;
  customBlockedKeywords: string[];
}

const DEFAULT_SETTINGS: ContentFilterSettings = {
  enabled: true,
  blockAdultStreams: true,
  blockAdultCategories: true,
  customBlockedKeywords: [],
};

let currentSettings: ContentFilterSettings = { ...DEFAULT_SETTINGS };

export const contentFilterService = {
  init: async () => {
    try {
      const stored = await AsyncStorage.getItem(CONTENT_FILTER_KEY);
      if (stored) {
        currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      currentSettings = { ...DEFAULT_SETTINGS };
    }
  },

  getSettings: (): ContentFilterSettings => ({ ...currentSettings }),

  saveSettings: async (settings: Partial<ContentFilterSettings>) => {
    currentSettings = { ...currentSettings, ...settings };
    await AsyncStorage.setItem(CONTENT_FILTER_KEY, JSON.stringify(currentSettings));
  },

  /**
   * Check if a URL or title contains adult content
   */
  isAdultContent: (text: string): boolean => {
    if (!currentSettings.enabled || !currentSettings.blockAdultStreams) return false;
    
    const lower = text.toLowerCase();
    
    // Check keywords
    const allKeywords = [...ADULT_KEYWORDS, ...currentSettings.customBlockedKeywords];
    for (const keyword of allKeywords) {
      if (lower.includes(keyword.toLowerCase())) return true;
    }
    
    // Check domains
    for (const domain of ADULT_DOMAINS) {
      if (lower.includes(domain)) return true;
    }
    
    return false;
  },

  /**
   * Filter an array of stream links, removing adult content
   */
  filterStreams: <T extends { url?: string; name?: string; title?: string }>(streams: T[]): T[] => {
    if (!currentSettings.enabled || !currentSettings.blockAdultStreams) return streams;
    
    return streams.filter(stream => {
      const url = stream.url || '';
      const name = stream.name || '';
      const title = stream.title || '';
      const combined = `${url} ${name} ${title}`;
      return !contentFilterService.isAdultContent(combined);
    });
  },

  /**
   * Filter IPTV categories, removing adult categories
   */
  filterCategories: <T extends { category_name?: string }>(categories: T[]): T[] => {
    if (!currentSettings.enabled || !currentSettings.blockAdultCategories) return categories;
    
    return categories.filter(cat => {
      const name = cat.category_name || '';
      return !contentFilterService.isAdultContent(name);
    });
  },

  /**
   * Snoop a URL to try and extract the direct video link
   * This does a HEAD request to follow redirects and find the actual media URL
   */
  snoopLink: async (url: string): Promise<string> => {
    try {
      // First check if the URL itself is adult content
      if (contentFilterService.isAdultContent(url)) {
        throw new Error('Blocked: Adult content detected in URL');
      }
      
      // Try to follow redirects to find the final URL
      const response = await fetch(url, { 
        method: 'HEAD',
        redirect: 'follow',
      });
      
      const finalUrl = response.url || url;
      
      // Check the final URL for adult content
      if (contentFilterService.isAdultContent(finalUrl)) {
        throw new Error('Blocked: Adult content detected in resolved URL');
      }
      
      return finalUrl;
    } catch (error: any) {
      if (error.message.startsWith('Blocked:')) throw error;
      // If HEAD fails, return original URL
      return url;
    }
  },
};
