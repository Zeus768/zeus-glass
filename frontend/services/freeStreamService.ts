import { streamScraperService, StreamSource } from './streamScrapers';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_BACKEND_URL || '';

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
  type: 'direct' | 'embed';  // direct = ad-free m3u8/mp4, embed = WebView with ad-blocking
  referer?: string;
}

export const freeStreamService = {
  /**
   * Get all free servers for a movie — tries direct extraction first, then embeds
   */
  getMovieServers: async (tmdbId: string, imdbId?: string): Promise<FreeServer[]> => {
    const servers: FreeServer[] = [];
    
    // 1. Try backend extraction for ad-free direct streams
    try {
      const params = new URLSearchParams({ tmdb_id: tmdbId, type: 'movie' });
      if (imdbId) params.append('imdb_id', imdbId);
      const resp = await axios.get(`${API_URL}/api/extract/video?${params}`, { timeout: 20000 });
      if (resp.data?.success && resp.data.streams?.length > 0) {
        for (const stream of resp.data.streams) {
          servers.push({
            name: `${stream.source} (Ad-Free)`,
            url: stream.url,
            quality: 'HD',
            type: 'direct',
            referer: stream.referer,
          });
        }
      }
    } catch (err) {
      console.log('[FreeStream] Backend extraction unavailable, using embeds');
    }
    
    // 2. Get embed sources as fallback (these play with ad-blocking in WebView)
    const sources = await streamScraperService.getMovieStreams(tmdbId, imdbId);
    const embedServers = rankServers(sources);
    servers.push(...embedServers);
    
    return servers;
  },

  /**
   * Get all free servers for a TV episode
   */
  getTVServers: async (
    tmdbId: string,
    imdbId?: string,
    season?: number,
    episode?: number
  ): Promise<FreeServer[]> => {
    const servers: FreeServer[] = [];
    
    // 1. Try backend extraction for ad-free direct streams
    try {
      const params = new URLSearchParams({ tmdb_id: tmdbId, type: 'tv' });
      if (imdbId) params.append('imdb_id', imdbId);
      if (season) params.append('season', season.toString());
      if (episode) params.append('episode', episode.toString());
      const resp = await axios.get(`${API_URL}/api/extract/video?${params}`, { timeout: 20000 });
      if (resp.data?.success && resp.data.streams?.length > 0) {
        for (const stream of resp.data.streams) {
          servers.push({
            name: `${stream.source} (Ad-Free)`,
            url: stream.url,
            quality: 'HD',
            type: 'direct',
            referer: stream.referer,
          });
        }
      }
    } catch (err) {
      console.log('[FreeStream] Backend extraction unavailable, using embeds');
    }
    
    // 2. Get embed sources as fallback
    const sources = await streamScraperService.getTVStreams(tmdbId, imdbId, undefined, season, episode);
    const embedServers = rankServers(sources);
    servers.push(...embedServers);
    
    return servers;
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
      unique.push({ name: s.source, url: s.url, quality: s.quality, type: 'embed' });
    }
  }
  return unique;
}
