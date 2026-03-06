import axios from 'axios';

// Stream source interface
export interface StreamSource {
  name: string;
  url: string;
  quality: string;
  type: 'direct' | 'embed' | 'torrent';
  source: string;
  size?: string;
  seeders?: number;
}

// Scraper configuration
const SCRAPERS = {
  // Torrent indexers (via Stremio addons) - these need IMDB IDs
  torrentio: {
    name: 'Torrentio',
    baseUrl: 'https://torrentio.strem.fun',
    type: 'torrent' as const,
  },
  
  // Streaming sites - these work with TMDB IDs
  vidsrc: {
    name: 'VidSrc',
    baseUrl: 'https://vidsrc.to',
    embedUrl: 'https://vidsrc.to/embed',
    type: 'embed' as const,
  },
  vidsrcPro: {
    name: 'VidSrc Pro',
    baseUrl: 'https://vidsrc.pro',
    embedUrl: 'https://vidsrc.pro/embed',
    type: 'embed' as const,
  },
  vidsrcXyz: {
    name: 'VidSrc.xyz',
    baseUrl: 'https://vidsrc.xyz',
    embedUrl: 'https://vidsrc.xyz/embed',
    type: 'embed' as const,
  },
  superEmbed: {
    name: 'SuperEmbed',
    baseUrl: 'https://multiembed.mov',
    type: 'embed' as const,
  },
  smashystream: {
    name: 'SmashyStream',
    baseUrl: 'https://player.smashy.stream',
    type: 'embed' as const,
  },
  twoembed: {
    name: '2Embed',
    baseUrl: 'https://www.2embed.cc',
    type: 'embed' as const,
  },
  autoembed: {
    name: 'AutoEmbed',
    baseUrl: 'https://player.autoembed.cc',
    type: 'embed' as const,
  },
};

export const streamScraperService = {
  /**
   * Get all available streams for a movie
   */
  getMovieStreams: async (tmdbId: string, imdbId?: string, title?: string, year?: number): Promise<StreamSource[]> => {
    const streams: StreamSource[] = [];
    console.log(`[Scrapers] Getting movie streams for tmdb:${tmdbId}, imdb:${imdbId}`);
    
    // Run embed scrapers (these are most reliable)
    const embedPromises = [
      // VidSrc variants
      streamScraperService.scrapeVidSrc('movie', tmdbId),
      streamScraperService.scrapeVidSrcPro('movie', tmdbId),
      streamScraperService.scrapeVidSrcXyz('movie', tmdbId),
      // Other embeds
      streamScraperService.scrapeSuperEmbed('movie', tmdbId, imdbId),
      streamScraperService.scrapeSmashyStream('movie', tmdbId),
      streamScraperService.scrapeTwoEmbed('movie', tmdbId, imdbId),
      streamScraperService.scrapeAutoEmbed('movie', tmdbId),
    ];
    
    // Torrentio only if we have IMDB ID (required for Stremio addons)
    if (imdbId) {
      embedPromises.push(streamScraperService.scrapeTorrentio('movie', imdbId));
    }
    
    try {
      const results = await Promise.allSettled(embedPromises);
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          streams.push(...result.value);
        }
      });
    } catch (error) {
      console.error('Error scraping streams:', error);
    }
    
    console.log(`[Scrapers] Found ${streams.length} streams`);
    return streams;
  },

  /**
   * Get all available streams for a TV show episode
   */
  getTVStreams: async (tmdbId: string, imdbId: string | undefined, season: number, episode: number): Promise<StreamSource[]> => {
    const streams: StreamSource[] = [];
    console.log(`[Scrapers] Getting TV streams for tmdb:${tmdbId}, S${season}E${episode}`);
    
    const embedPromises = [
      // VidSrc variants
      streamScraperService.scrapeVidSrc('tv', tmdbId, season, episode),
      streamScraperService.scrapeVidSrcPro('tv', tmdbId, season, episode),
      streamScraperService.scrapeVidSrcXyz('tv', tmdbId, season, episode),
      // Other embeds
      streamScraperService.scrapeSuperEmbed('tv', tmdbId, imdbId, season, episode),
      streamScraperService.scrapeSmashyStream('tv', tmdbId, season, episode),
      streamScraperService.scrapeTwoEmbed('tv', tmdbId, imdbId, season, episode),
      streamScraperService.scrapeAutoEmbed('tv', tmdbId, season, episode),
    ];
    
    // Torrentio only if we have IMDB ID
    if (imdbId) {
      embedPromises.push(streamScraperService.scrapeTorrentio('series', imdbId, season, episode));
    }
    
    try {
      const results = await Promise.allSettled(embedPromises);
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          streams.push(...result.value);
        }
      });
    } catch (error) {
      console.error('Error scraping TV streams:', error);
    }
    
    console.log(`[Scrapers] Found ${streams.length} TV streams`);
    return streams;
  },

  /**
   * Scrape Torrentio (Stremio addon) - requires IMDB ID
   */
  scrapeTorrentio: async (type: 'movie' | 'series', imdbId: string, season?: number, episode?: number): Promise<StreamSource[]> => {
    try {
      if (!imdbId || !imdbId.startsWith('tt')) {
        console.log('[Torrentio] Invalid IMDB ID:', imdbId);
        return [];
      }
      
      let url = `${SCRAPERS.torrentio.baseUrl}/stream/${type}/${imdbId}`;
      if (type === 'series' && season !== undefined && episode !== undefined) {
        url += `:${season}:${episode}`;
      }
      url += '.json';
      
      console.log('[Torrentio] Fetching:', url);
      const response = await axios.get(url, { timeout: 15000 });
      const streams = response.data?.streams || [];
      
      return streams.slice(0, 15).map((s: any) => ({
        name: s.title || s.name || 'Torrentio',
        url: s.url || (s.infoHash ? `magnet:?xt=urn:btih:${s.infoHash}&dn=${encodeURIComponent(s.title || 'Video')}` : ''),
        quality: extractQuality(s.title || s.name || ''),
        type: 'torrent' as const,
        source: 'Torrentio',
        size: extractSize(s.title || ''),
        seeders: s.seeders,
      })).filter((s: StreamSource) => s.url);
    } catch (error: any) {
      console.log('[Torrentio] Error:', error.message);
      return [];
    }
  },

  /**
   * Scrape VidSrc.to
   */
  scrapeVidSrc: async (type: 'movie' | 'tv', tmdbId: string, season?: number, episode?: number): Promise<StreamSource[]> => {
    let embedUrl = `${SCRAPERS.vidsrc.embedUrl}/${type}/${tmdbId}`;
    if (type === 'tv' && season !== undefined && episode !== undefined) {
      embedUrl += `/${season}/${episode}`;
    }
    
    return [{
      name: 'VidSrc',
      url: embedUrl,
      quality: 'HD',
      type: 'embed' as const,
      source: 'VidSrc',
    }];
  },

  /**
   * Scrape VidSrc Pro
   */
  scrapeVidSrcPro: async (type: 'movie' | 'tv', tmdbId: string, season?: number, episode?: number): Promise<StreamSource[]> => {
    let embedUrl = `${SCRAPERS.vidsrcPro.embedUrl}/${type}/${tmdbId}`;
    if (type === 'tv' && season !== undefined && episode !== undefined) {
      embedUrl += `/${season}/${episode}`;
    }
    
    return [{
      name: 'VidSrc Pro',
      url: embedUrl,
      quality: 'HD',
      type: 'embed' as const,
      source: 'VidSrc Pro',
    }];
  },

  /**
   * Scrape VidSrc.xyz
   */
  scrapeVidSrcXyz: async (type: 'movie' | 'tv', tmdbId: string, season?: number, episode?: number): Promise<StreamSource[]> => {
    let embedUrl = `${SCRAPERS.vidsrcXyz.embedUrl}/${type}/${tmdbId}`;
    if (type === 'tv' && season !== undefined && episode !== undefined) {
      embedUrl += `/${season}/${episode}`;
    }
    
    return [{
      name: 'VidSrc.xyz',
      url: embedUrl,
      quality: 'HD',
      type: 'embed' as const,
      source: 'VidSrc.xyz',
    }];
  },

  /**
   * Scrape SuperEmbed / MultiEmbed
   */
  scrapeSuperEmbed: async (type: 'movie' | 'tv', tmdbId: string, imdbId?: string, season?: number, episode?: number): Promise<StreamSource[]> => {
    // MultiEmbed prefers TMDB ID
    let embedUrl = `${SCRAPERS.superEmbed.baseUrl}/?video_id=${tmdbId}&tmdb=1`;
    if (type === 'tv' && season !== undefined && episode !== undefined) {
      embedUrl += `&s=${season}&e=${episode}`;
    }
    
    return [{
      name: 'SuperEmbed',
      url: embedUrl,
      quality: 'HD',
      type: 'embed' as const,
      source: 'SuperEmbed',
    }];
  },

  /**
   * Scrape SmashyStream
   */
  scrapeSmashyStream: async (type: 'movie' | 'tv', tmdbId: string, season?: number, episode?: number): Promise<StreamSource[]> => {
    let embedUrl = `${SCRAPERS.smashystream.baseUrl}/${type}/${tmdbId}`;
    if (type === 'tv' && season !== undefined && episode !== undefined) {
      embedUrl += `?s=${season}&e=${episode}`;
    }
    
    return [{
      name: 'SmashyStream',
      url: embedUrl,
      quality: 'HD',
      type: 'embed' as const,
      source: 'SmashyStream',
    }];
  },

  /**
   * Scrape 2Embed
   */
  scrapeTwoEmbed: async (type: 'movie' | 'tv', tmdbId: string, imdbId?: string, season?: number, episode?: number): Promise<StreamSource[]> => {
    // 2Embed uses TMDB ID
    let embedUrl = `${SCRAPERS.twoembed.baseUrl}/embed/${type}/${tmdbId}`;
    if (type === 'tv' && season !== undefined && episode !== undefined) {
      embedUrl += `/${season}/${episode}`;
    }
    
    return [{
      name: '2Embed',
      url: embedUrl,
      quality: 'HD',
      type: 'embed' as const,
      source: '2Embed',
    }];
  },

  /**
   * Scrape AutoEmbed
   */
  scrapeAutoEmbed: async (type: 'movie' | 'tv', tmdbId: string, season?: number, episode?: number): Promise<StreamSource[]> => {
    let embedUrl = `${SCRAPERS.autoembed.baseUrl}/embed/${type}/${tmdbId}`;
    if (type === 'tv' && season !== undefined && episode !== undefined) {
      embedUrl += `/${season}/${episode}`;
    }
    
    return [{
      name: 'AutoEmbed',
      url: embedUrl,
      quality: 'HD',
      type: 'embed' as const,
      source: 'AutoEmbed',
    }];
  },
};

// Helper function to extract quality from title
function extractQuality(title: string): string {
  const qualityPatterns = [
    { pattern: /4k|2160p|uhd/i, quality: '4K' },
    { pattern: /1080p|fullhd|fhd/i, quality: '1080p' },
    { pattern: /720p|hd/i, quality: '720p' },
    { pattern: /480p|sd/i, quality: '480p' },
    { pattern: /cam|hdcam|ts|telesync/i, quality: 'CAM' },
  ];
  
  for (const { pattern, quality } of qualityPatterns) {
    if (pattern.test(title)) {
      return quality;
    }
  }
  
  return 'Unknown';
}

// Helper function to extract size from title
function extractSize(title: string): string | undefined {
  const sizeMatch = title.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i);
  if (sizeMatch) {
    return `${sizeMatch[1]} ${sizeMatch[2].toUpperCase()}`;
  }
  return undefined;
}
