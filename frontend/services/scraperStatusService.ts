import axios from 'axios';

export interface ScraperStatus {
  name: string;
  url: string;
  status: 'online' | 'offline' | 'checking' | 'unknown';
  latency?: number;
  lastChecked?: Date;
}

// All scrapers with their health check endpoints
const SCRAPER_LIST: { name: string; url: string; healthPath?: string }[] = [
  // Torrent scrapers
  { name: 'Torrentio', url: 'https://torrentio.strem.fun', healthPath: '/manifest.json' },
  { name: 'Knightcrawler', url: 'https://knightcrawler.elfhosted.com', healthPath: '/manifest.json' },
  { name: 'Comet', url: 'https://comet.elfhosted.com', healthPath: '/manifest.json' },
  
  // Embed scrapers
  { name: 'VidSrc', url: 'https://vidsrc.me' },
  { name: 'VidSrc Pro', url: 'https://vidsrc.pro' },
  { name: 'VidSrc.xyz', url: 'https://vidsrc.xyz' },
  { name: 'VidSrc.nl', url: 'https://vidsrc.nl' },
  { name: 'SuperEmbed', url: 'https://multiembed.mov' },
  { name: 'SmashyStream', url: 'https://player.smashy.stream' },
  { name: '2Embed', url: 'https://www.2embed.cc' },
  { name: 'AutoEmbed', url: 'https://autoembed.co' },
  { name: 'Embed.su', url: 'https://embed.su' },
  { name: 'MoviesAPI', url: 'https://moviesapi.club' },
  { name: 'Videasy', url: 'https://player.videasy.net' },
  { name: 'Rive', url: 'https://rivestream.live' },
  { name: 'FrEmbed', url: 'https://frembed.pro' },
  { name: 'WarezCDN', url: 'https://embed.warezcdn.com' },
  
  // APIs
  { name: 'TMDB', url: 'https://api.themoviedb.org', healthPath: '/3/configuration' },
  { name: 'Trakt', url: 'https://api.trakt.tv' },
  { name: 'Real-Debrid', url: 'https://api.real-debrid.com' },
];

// Check a single scraper's status
export const checkScraperStatus = async (scraper: { name: string; url: string; healthPath?: string }): Promise<ScraperStatus> => {
  const startTime = Date.now();
  
  try {
    const checkUrl = scraper.healthPath ? `${scraper.url}${scraper.healthPath}` : scraper.url;
    
    const response = await axios.get(checkUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      validateStatus: (status) => status < 500, // Accept any non-5xx status
    });
    
    const latency = Date.now() - startTime;
    
    return {
      name: scraper.name,
      url: scraper.url,
      status: 'online',
      latency,
      lastChecked: new Date(),
    };
  } catch (error: any) {
    return {
      name: scraper.name,
      url: scraper.url,
      status: 'offline',
      latency: undefined,
      lastChecked: new Date(),
    };
  }
};

// Check all scrapers
export const checkAllScrapers = async (
  onProgress?: (completed: number, total: number, result: ScraperStatus) => void
): Promise<ScraperStatus[]> => {
  const results: ScraperStatus[] = [];
  const total = SCRAPER_LIST.length;
  
  // Check in batches of 5 to avoid overwhelming
  const batchSize = 5;
  
  for (let i = 0; i < SCRAPER_LIST.length; i += batchSize) {
    const batch = SCRAPER_LIST.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (scraper) => {
        const result = await checkScraperStatus(scraper);
        if (onProgress) {
          onProgress(results.length + 1, total, result);
        }
        return result;
      })
    );
    
    results.push(...batchResults);
  }
  
  return results;
};

// Get scraper list for display
export const getScraperList = (): { name: string; url: string }[] => {
  return SCRAPER_LIST.map(s => ({ name: s.name, url: s.url }));
};

// Quick check - just check main scrapers
export const quickCheck = async (): Promise<{ online: number; offline: number; total: number }> => {
  const mainScrapers = SCRAPER_LIST.slice(0, 5); // Check first 5
  
  const results = await Promise.all(
    mainScrapers.map(s => checkScraperStatus(s))
  );
  
  const online = results.filter(r => r.status === 'online').length;
  const offline = results.filter(r => r.status === 'offline').length;
  
  return { online, offline, total: mainScrapers.length };
};

export const scraperStatusService = {
  checkAll: checkAllScrapers,
  checkOne: checkScraperStatus,
  getList: getScraperList,
  quickCheck,
  scrapers: SCRAPER_LIST,
};

export default scraperStatusService;
