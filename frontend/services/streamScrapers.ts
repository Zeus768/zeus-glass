import axios from 'axios';

// Stream source interface
export interface StreamSource {
  name: string;
  url: string;
  quality: string;
  type: 'direct' | 'embed' | 'torrent';
  source: string;
}

// Scraper configuration
const SCRAPERS = {
  // Torrent indexers (via Stremio addons)
  torrentio: {
    name: 'Torrentio',
    baseUrl: 'https://torrentio.strem.fun',
    type: 'torrent' as const,
  },
  mediafusion: {
    name: 'MediaFusion',
    baseUrl: 'https://mediafusion.elfhosted.com',
    type: 'torrent' as const,
  },
  yts: {
    name: 'YTS',
    baseUrl: 'https://yts.mx/api/v2',
    type: 'torrent' as const,
  },
  
  // Streaming sites
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
  flixmomo: {
    name: 'FlixMomo',
    baseUrl: 'https://flixmomo.tv',
    type: 'embed' as const,
  },
  hydrahd: {
    name: 'HydraHD',
    baseUrl: 'https://hydrahd.ru',
    type: 'embed' as const,
  },
  cineby: {
    name: 'Cineby',
    baseUrl: 'https://cineby.gd',
    type: 'embed' as const,
  },
  flickystream: {
    name: 'FlickyStream',
    baseUrl: 'https://flickystream.ru',
    type: 'embed' as const,
  },
  yflix: {
    name: 'YFlix',
    baseUrl: 'https://yflix.to',
    type: 'embed' as const,
  },
  gomovies: {
    name: 'GoMovies',
    baseUrl: 'https://gomovies.gg',
    type: 'embed' as const,
  },
  movieparadise: {
    name: 'MovieParadise',
    baseUrl: 'https://movieparadise.co',
    type: 'embed' as const,
  },
  utelevision: {
    name: 'UTelevision',
    baseUrl: 'https://utelevision.to',
    type: 'embed' as const,
  },
  archive: {
    name: 'Archive.org',
    baseUrl: 'https://archive.org',
    type: 'direct' as const,
  },
};

export const streamScraperService = {
  /**
   * Get all available streams for a movie
   */
  getMovieStreams: async (tmdbId: string, imdbId?: string, title?: string, year?: number): Promise<StreamSource[]> => {
    const streams: StreamSource[] = [];
    
    // Run scrapers in parallel
    const scraperPromises = [
      // Torrentio
      streamScraperService.scrapeTorrentio('movie', imdbId || tmdbId),
      // MediaFusion
      streamScraperService.scrapeMediaFusion('movie', imdbId || tmdbId),
      // YTS (movies only)
      title && year ? streamScraperService.scrapeYTS(title, year) : Promise.resolve([]),
      // VidSrc
      streamScraperService.scrapeVidSrc('movie', tmdbId),
      // VidSrc Pro
      streamScraperService.scrapeVidSrcPro('movie', tmdbId),
      // Embed scrapers
      streamScraperService.scrapeEmbedSite('flixmomo', 'movie', tmdbId, imdbId),
      streamScraperService.scrapeEmbedSite('cineby', 'movie', tmdbId, imdbId),
      streamScraperService.scrapeEmbedSite('hydrahd', 'movie', tmdbId, imdbId),
      streamScraperService.scrapeEmbedSite('yflix', 'movie', tmdbId, imdbId),
    ];
    
    try {
      const results = await Promise.allSettled(scraperPromises);
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          streams.push(...result.value);
        }
      });
    } catch (error) {
      console.error('Error scraping streams:', error);
    }
    
    return streams;
  },

  /**
   * Get all available streams for a TV show episode
   */
  getTVStreams: async (tmdbId: string, imdbId: string | undefined, season: number, episode: number): Promise<StreamSource[]> => {
    const streams: StreamSource[] = [];
    
    const scraperPromises = [
      // Torrentio
      streamScraperService.scrapeTorrentio('series', imdbId || tmdbId, season, episode),
      // MediaFusion
      streamScraperService.scrapeMediaFusion('series', imdbId || tmdbId, season, episode),
      // VidSrc
      streamScraperService.scrapeVidSrc('tv', tmdbId, season, episode),
      // VidSrc Pro
      streamScraperService.scrapeVidSrcPro('tv', tmdbId, season, episode),
      // Embed scrapers
      streamScraperService.scrapeEmbedSite('flixmomo', 'tv', tmdbId, imdbId, season, episode),
      streamScraperService.scrapeEmbedSite('cineby', 'tv', tmdbId, imdbId, season, episode),
    ];
    
    try {
      const results = await Promise.allSettled(scraperPromises);
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          streams.push(...result.value);
        }
      });
    } catch (error) {
      console.error('Error scraping TV streams:', error);
    }
    
    return streams;
  },

  /**
   * Scrape Torrentio (Stremio addon)
   */
  scrapeTorrentio: async (type: 'movie' | 'series', id: string, season?: number, episode?: number): Promise<StreamSource[]> => {
    try {
      let url = `${SCRAPERS.torrentio.baseUrl}/stream/${type}/${id}`;
      if (type === 'series' && season !== undefined && episode !== undefined) {
        url += `:${season}:${episode}`;
      }
      url += '.json';
      
      const response = await axios.get(url, { timeout: 10000 });
      const streams = response.data?.streams || [];
      
      return streams.map((s: any) => ({
        name: s.title || s.name || 'Torrentio',
        url: s.url || s.infoHash ? `magnet:?xt=urn:btih:${s.infoHash}` : '',
        quality: extractQuality(s.title || s.name || ''),
        type: 'torrent' as const,
        source: 'Torrentio',
      })).filter((s: StreamSource) => s.url);
    } catch (error) {
      console.log('Torrentio scrape failed:', error);
      return [];
    }
  },

  /**
   * Scrape MediaFusion (Stremio addon)
   */
  scrapeMediaFusion: async (type: 'movie' | 'series', id: string, season?: number, episode?: number): Promise<StreamSource[]> => {
    try {
      let url = `${SCRAPERS.mediafusion.baseUrl}/${process.env.MEDIAFUSION_CONFIG || 'default'}/stream/${type}/${id}`;
      if (type === 'series' && season !== undefined && episode !== undefined) {
        url += `:${season}:${episode}`;
      }
      url += '.json';
      
      const response = await axios.get(url, { timeout: 10000 });
      const streams = response.data?.streams || [];
      
      return streams.map((s: any) => ({
        name: s.title || s.name || 'MediaFusion',
        url: s.url || (s.infoHash ? `magnet:?xt=urn:btih:${s.infoHash}` : ''),
        quality: extractQuality(s.title || s.name || ''),
        type: 'torrent' as const,
        source: 'MediaFusion',
      })).filter((s: StreamSource) => s.url);
    } catch (error) {
      console.log('MediaFusion scrape failed:', error);
      return [];
    }
  },

  /**
   * Scrape YTS for movies
   */
  scrapeYTS: async (title: string, year: number): Promise<StreamSource[]> => {
    try {
      const response = await axios.get(`${SCRAPERS.yts.baseUrl}/list_movies.json`, {
        params: {
          query_term: title,
          limit: 5,
        },
        timeout: 10000,
      });
      
      const movies = response.data?.data?.movies || [];
      const matchingMovie = movies.find((m: any) => 
        m.year === year && m.title.toLowerCase().includes(title.toLowerCase())
      );
      
      if (!matchingMovie || !matchingMovie.torrents) return [];
      
      return matchingMovie.torrents.map((t: any) => ({
        name: `YTS ${t.quality} ${t.type}`,
        url: t.url || `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(matchingMovie.title)}`,
        quality: t.quality || 'Unknown',
        type: 'torrent' as const,
        source: 'YTS',
      }));
    } catch (error) {
      console.log('YTS scrape failed:', error);
      return [];
    }
  },

  /**
   * Scrape VidSrc
   */
  scrapeVidSrc: async (type: 'movie' | 'tv', tmdbId: string, season?: number, episode?: number): Promise<StreamSource[]> => {
    try {
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
    } catch (error) {
      return [];
    }
  },

  /**
   * Scrape VidSrc Pro
   */
  scrapeVidSrcPro: async (type: 'movie' | 'tv', tmdbId: string, season?: number, episode?: number): Promise<StreamSource[]> => {
    try {
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
    } catch (error) {
      return [];
    }
  },

  /**
   * Generic embed site scraper
   */
  scrapeEmbedSite: async (
    site: keyof typeof SCRAPERS, 
    type: 'movie' | 'tv', 
    tmdbId: string, 
    imdbId?: string,
    season?: number, 
    episode?: number
  ): Promise<StreamSource[]> => {
    const scraper = SCRAPERS[site];
    if (!scraper) return [];
    
    try {
      let url = scraper.baseUrl;
      
      // Build URL based on site pattern
      switch (site) {
        case 'flixmomo':
          url += type === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}/${season}/${episode}`;
          break;
        case 'cineby':
          url += type === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}/${season}/${episode}`;
          break;
        case 'hydrahd':
          url += type === 'movie' ? `/watch/${imdbId || tmdbId}` : `/watch/${imdbId || tmdbId}/s${season}e${episode}`;
          break;
        case 'yflix':
          url += type === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}/${season}/${episode}`;
          break;
        case 'gomovies':
          url += type === 'movie' ? `/watch-movie/${tmdbId}` : `/watch-tv/${tmdbId}/${season}/${episode}`;
          break;
        case 'movieparadise':
          url += type === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}/${season}/${episode}`;
          break;
        default:
          url += `/${type}/${tmdbId}`;
      }
      
      return [{
        name: scraper.name,
        url: url,
        quality: 'HD',
        type: scraper.type,
        source: scraper.name,
      }];
    } catch (error) {
      return [];
    }
  },

  /**
   * Get Archive.org Disney streams
   */
  scrapeArchiveOrg: async (searchTerm: string): Promise<StreamSource[]> => {
    try {
      const response = await axios.get('https://archive.org/advancedsearch.php', {
        params: {
          q: `collection:disney_202105 AND title:${searchTerm}`,
          fl: ['identifier', 'title'],
          rows: 10,
          output: 'json',
        },
        timeout: 10000,
      });
      
      const docs = response.data?.response?.docs || [];
      
      return docs.map((doc: any) => ({
        name: `Archive.org - ${doc.title}`,
        url: `https://archive.org/download/${doc.identifier}`,
        quality: 'Unknown',
        type: 'direct' as const,
        source: 'Archive.org',
      }));
    } catch (error) {
      console.log('Archive.org scrape failed:', error);
      return [];
    }
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
