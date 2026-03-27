import { streamScraperService, StreamSource } from './streamScrapers';

// Priority-ordered list of the most reliable free embed sources
// These work without Debrid — just like Mobiflix servers
const FREE_SERVER_PRIORITY = [
  'VidSrc',
  'VidSrc Pro',
  'Videasy',
  'SuperEmbed',
  'AutoEmbed',
  'VidSrc.xyz',
  'VidSrc.nl',
  'Embed.su',
  'SmashyStream',
  '2Embed',
  'MoviesAPI',
  'Rive',
  'FrEmbed',
  'WarezCDN',
  'WatchSomuch',
];

export interface FreeServer {
  name: string;
  url: string;
  quality: string;
}

export const freeStreamService = {
  /**
   * Get all free servers for a movie, ordered by reliability
   */
  getMovieServers: async (tmdbId: string, imdbId?: string): Promise<FreeServer[]> => {
    const sources = await streamScraperService.getMovieStreams(tmdbId, imdbId);
    return rankServers(sources);
  },

  /**
   * Get all free servers for a TV episode, ordered by reliability
   */
  getTVServers: async (
    tmdbId: string,
    imdbId?: string,
    season?: number,
    episode?: number
  ): Promise<FreeServer[]> => {
    const sources = await streamScraperService.getTVStreams(tmdbId, imdbId, undefined, season, episode);
    return rankServers(sources);
  },

  /**
   * Get the best (top priority) free server for a movie — for instant play
   */
  getBestMovieServer: async (tmdbId: string, imdbId?: string): Promise<FreeServer | null> => {
    const servers = await freeStreamService.getMovieServers(tmdbId, imdbId);
    return servers.length > 0 ? servers[0] : null;
  },

  /**
   * Get the best (top priority) free server for a TV episode — for instant play
   */
  getBestTVServer: async (
    tmdbId: string,
    imdbId?: string,
    season?: number,
    episode?: number
  ): Promise<FreeServer | null> => {
    const servers = await freeStreamService.getTVServers(tmdbId, imdbId, season, episode);
    return servers.length > 0 ? servers[0] : null;
  },

  /** Returns the prioritized server name list for UI */
  getServerList: (): string[] => FREE_SERVER_PRIORITY,
};

/** Rank and deduplicate sources by our priority list */
function rankServers(sources: StreamSource[]): FreeServer[] {
  // Only keep embed/direct types (no torrents — those need Debrid)
  const freeOnly = sources.filter(s => s.type === 'embed' || s.type === 'direct');

  // Sort by priority
  const sorted = [...freeOnly].sort((a, b) => {
    const aIdx = FREE_SERVER_PRIORITY.indexOf(a.source);
    const bIdx = FREE_SERVER_PRIORITY.indexOf(b.source);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  // Deduplicate by source name
  const seen = new Set<string>();
  const unique: FreeServer[] = [];
  for (const s of sorted) {
    if (!seen.has(s.source)) {
      seen.add(s.source);
      unique.push({ name: s.source, url: s.url, quality: s.quality });
    }
  }
  return unique;
}
