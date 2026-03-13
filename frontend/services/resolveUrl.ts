import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { STORAGE_KEYS } from '../config/constants';

// Supported hosters that can be resolved via debrid services
const SUPPORTED_HOSTERS = [
  'rapidgator', 'nitroflare', 'uploaded', 'turbobit', '1fichier',
  'uptobox', 'mediafire', 'mega', 'google', 'dropbox',
  'openload', 'streamtape', 'doodstream', 'mixdrop', 'fembed',
  'streamlare', 'supervideo', 'upstream', 'vidoza', 'voe',
  'filemoon', 'streamwish', 'vidhide', 'vtube', 'waaw'
];

export interface ResolvedLink {
  url: string;
  quality: string;
  size?: string;
  hoster: string;
  filename?: string;
  debridService: 'real-debrid' | 'alldebrid' | 'premiumize';
}

export interface DebridAccount {
  service: 'real-debrid' | 'alldebrid' | 'premiumize';
  token: string;
  apiKey?: string;
  enabled: boolean;
}

class ResolveUrlService {
  private accounts: DebridAccount[] = [];

  async init() {
    await this.loadAccounts();
  }

  private async loadAccounts() {
    try {
      // Load Real-Debrid
      const rdToken = await AsyncStorage.getItem(STORAGE_KEYS.REAL_DEBRID_TOKEN);
      if (rdToken) {
        this.accounts.push({
          service: 'real-debrid',
          token: rdToken,
          enabled: true,
        });
      }

      // Load AllDebrid
      const adKey = await AsyncStorage.getItem(STORAGE_KEYS.ALLDEBRID_TOKEN);
      if (adKey) {
        this.accounts.push({
          service: 'alldebrid',
          token: adKey,
          apiKey: adKey,
          enabled: true,
        });
      }

      // Load Premiumize
      const pmKey = await AsyncStorage.getItem(STORAGE_KEYS.PREMIUMIZE_TOKEN);
      if (pmKey) {
        this.accounts.push({
          service: 'premiumize',
          token: pmKey,
          apiKey: pmKey,
          enabled: true,
        });
      }
    } catch (e) {
      console.error('[ResolveURL] Error loading accounts:', e);
    }
  }

  hasDebridEnabled(): boolean {
    return this.accounts.length > 0;
  }

  getEnabledServices(): string[] {
    return this.accounts.map(a => a.service);
  }

  // Check if a URL can be resolved by debrid
  canResolve(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return SUPPORTED_HOSTERS.some(h => lowerUrl.includes(h)) || 
           url.startsWith('magnet:') ||
           lowerUrl.includes('torrent');
  }

  // Resolve a link through available debrid services
  async resolve(url: string, preferredService?: string): Promise<ResolvedLink | null> {
    await this.loadAccounts(); // Refresh accounts

    if (this.accounts.length === 0) {
      console.log('[ResolveURL] No debrid accounts configured');
      return null;
    }

    // Sort accounts by preference
    let sortedAccounts = [...this.accounts];
    if (preferredService) {
      sortedAccounts.sort((a, b) => {
        if (a.service === preferredService) return -1;
        if (b.service === preferredService) return 1;
        return 0;
      });
    }

    // Try each service until one works
    for (const account of sortedAccounts) {
      try {
        const resolved = await this.resolveWithService(url, account);
        if (resolved) {
          return resolved;
        }
      } catch (e) {
        console.log(`[ResolveURL] ${account.service} failed:`, e);
      }
    }

    return null;
  }

  // Resolve magnet/torrent through debrid
  async resolveTorrent(magnet: string, preferredService?: string): Promise<ResolvedLink | null> {
    await this.loadAccounts();

    if (this.accounts.length === 0) {
      return null;
    }

    let sortedAccounts = [...this.accounts];
    if (preferredService) {
      sortedAccounts.sort((a, b) => 
        a.service === preferredService ? -1 : b.service === preferredService ? 1 : 0
      );
    }

    for (const account of sortedAccounts) {
      try {
        const resolved = await this.resolveTorrentWithService(magnet, account);
        if (resolved) {
          return resolved;
        }
      } catch (e) {
        console.log(`[ResolveURL] ${account.service} torrent resolution failed:`, e);
      }
    }

    return null;
  }

  private async resolveWithService(url: string, account: DebridAccount): Promise<ResolvedLink | null> {
    switch (account.service) {
      case 'real-debrid':
        return this.resolveRealDebrid(url, account.token);
      case 'alldebrid':
        return this.resolveAllDebrid(url, account.apiKey!);
      case 'premiumize':
        return this.resolvePremiumize(url, account.apiKey!);
      default:
        return null;
    }
  }

  private async resolveTorrentWithService(magnet: string, account: DebridAccount): Promise<ResolvedLink | null> {
    switch (account.service) {
      case 'real-debrid':
        return this.resolveTorrentRealDebrid(magnet, account.token);
      case 'alldebrid':
        return this.resolveTorrentAllDebrid(magnet, account.apiKey!);
      case 'premiumize':
        return this.resolveTorrentPremiumize(magnet, account.apiKey!);
      default:
        return null;
    }
  }

  // Real-Debrid unrestrict
  private async resolveRealDebrid(url: string, token: string): Promise<ResolvedLink | null> {
    try {
      const response = await axios.post(
        'https://api.real-debrid.com/rest/1.0/unrestrict/link',
        `link=${encodeURIComponent(url)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        }
      );

      if (response.data?.download) {
        return {
          url: response.data.download,
          quality: this.extractQuality(response.data.filename || ''),
          size: this.formatSize(response.data.filesize),
          hoster: 'Real-Debrid',
          filename: response.data.filename,
          debridService: 'real-debrid',
        };
      }
    } catch (e: any) {
      console.error('[RD] Unrestrict error:', e.message);
    }
    return null;
  }

  // Real-Debrid torrent
  private async resolveTorrentRealDebrid(magnet: string, token: string): Promise<ResolvedLink | null> {
    try {
      // Add magnet
      const addResponse = await axios.post(
        'https://api.real-debrid.com/rest/1.0/torrents/addMagnet',
        `magnet=${encodeURIComponent(magnet)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        }
      );

      const torrentId = addResponse.data?.id;
      if (!torrentId) return null;

      // Select files (all)
      await axios.post(
        `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
        'files=all',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        }
      );

      // Wait and get info
      await new Promise(r => setTimeout(r, 2000));

      const infoResponse = await axios.get(
        `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 15000,
        }
      );

      const links = infoResponse.data?.links || [];
      if (links.length > 0) {
        // Unrestrict the first link
        const unrestricted = await this.resolveRealDebrid(links[0], token);
        return unrestricted;
      }
    } catch (e: any) {
      console.error('[RD] Torrent error:', e.message);
    }
    return null;
  }

  // AllDebrid unlock
  private async resolveAllDebrid(url: string, apiKey: string): Promise<ResolvedLink | null> {
    try {
      const response = await axios.get(
        'https://api.alldebrid.com/v4/link/unlock',
        {
          params: {
            agent: 'zeus-glass',
            apikey: apiKey,
            link: url,
          },
          timeout: 15000,
        }
      );

      if (response.data?.data?.link) {
        return {
          url: response.data.data.link,
          quality: this.extractQuality(response.data.data.filename || ''),
          size: this.formatSize(response.data.data.filesize),
          hoster: 'AllDebrid',
          filename: response.data.data.filename,
          debridService: 'alldebrid',
        };
      }
    } catch (e: any) {
      console.error('[AD] Unlock error:', e.message);
    }
    return null;
  }

  // AllDebrid magnet
  private async resolveTorrentAllDebrid(magnet: string, apiKey: string): Promise<ResolvedLink | null> {
    try {
      const uploadResponse = await axios.get(
        'https://api.alldebrid.com/v4/magnet/upload',
        {
          params: {
            agent: 'zeus-glass',
            apikey: apiKey,
            magnets: magnet,
          },
          timeout: 30000,
        }
      );

      const magnetId = uploadResponse.data?.data?.magnets?.[0]?.id;
      if (!magnetId) return null;

      // Wait for ready
      await new Promise(r => setTimeout(r, 3000));

      const statusResponse = await axios.get(
        'https://api.alldebrid.com/v4/magnet/status',
        {
          params: {
            agent: 'zeus-glass',
            apikey: apiKey,
            id: magnetId,
          },
          timeout: 15000,
        }
      );

      const links = statusResponse.data?.data?.magnets?.links || [];
      if (links.length > 0) {
        return this.resolveAllDebrid(links[0].link, apiKey);
      }
    } catch (e: any) {
      console.error('[AD] Magnet error:', e.message);
    }
    return null;
  }

  // Premiumize direct download
  private async resolvePremiumize(url: string, apiKey: string): Promise<ResolvedLink | null> {
    try {
      const response = await axios.post(
        'https://www.premiumize.me/api/transfer/directdl',
        `apikey=${apiKey}&src=${encodeURIComponent(url)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000,
        }
      );

      if (response.data?.content?.[0]?.link) {
        const content = response.data.content[0];
        return {
          url: content.link,
          quality: this.extractQuality(content.path || ''),
          size: this.formatSize(content.size),
          hoster: 'Premiumize',
          filename: content.path,
          debridService: 'premiumize',
        };
      }
    } catch (e: any) {
      console.error('[PM] DirectDL error:', e.message);
    }
    return null;
  }

  // Premiumize torrent
  private async resolveTorrentPremiumize(magnet: string, apiKey: string): Promise<ResolvedLink | null> {
    try {
      const response = await axios.post(
        'https://www.premiumize.me/api/transfer/directdl',
        `apikey=${apiKey}&src=${encodeURIComponent(magnet)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 30000,
        }
      );

      if (response.data?.content?.[0]?.link) {
        const content = response.data.content[0];
        return {
          url: content.link,
          quality: this.extractQuality(content.path || ''),
          size: this.formatSize(content.size),
          hoster: 'Premiumize',
          filename: content.path,
          debridService: 'premiumize',
        };
      }
    } catch (e: any) {
      console.error('[PM] Torrent error:', e.message);
    }
    return null;
  }

  private extractQuality(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('2160p') || lower.includes('4k') || lower.includes('uhd')) return '4K';
    if (lower.includes('remux')) return 'REMUX';
    if (lower.includes('1080p')) return '1080p';
    if (lower.includes('720p')) return '720p';
    if (lower.includes('480p')) return '480p';
    return 'HD';
  }

  private formatSize(bytes?: number): string | undefined {
    if (!bytes) return undefined;
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  }
}

export const resolveUrlService = new ResolveUrlService();
