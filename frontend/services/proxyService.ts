import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Free proxy servers for streaming (regularly updated)
// These are SOCKS5/HTTP proxies that can be used for streaming traffic

export interface ProxyServer {
  id: string;
  country: string;
  countryCode: string;
  flag: string;
  host: string;
  port: number;
  type: 'http' | 'socks5';
  latency?: number;
  status: 'online' | 'offline' | 'unknown';
}

export interface ProxySettings {
  enabled: boolean;
  selectedCountry: string | null;
  autoConnect: boolean;
}

const STORAGE_KEY = '@zeus_proxy_settings';

// Free proxy servers by country (these are public proxies)
// In production, you'd want to use a proxy service API or your own servers
const PROXY_SERVERS: ProxyServer[] = [
  // USA Proxies
  {
    id: 'us-1',
    country: 'United States',
    countryCode: 'US',
    flag: '🇺🇸',
    host: '198.59.191.234',
    port: 8080,
    type: 'http',
    status: 'unknown',
  },
  {
    id: 'us-2',
    country: 'United States',
    countryCode: 'US',
    flag: '🇺🇸',
    host: '64.225.8.203',
    port: 9998,
    type: 'http',
    status: 'unknown',
  },
  // UK Proxies
  {
    id: 'uk-1',
    country: 'United Kingdom',
    countryCode: 'GB',
    flag: '🇬🇧',
    host: '51.75.147.35',
    port: 3128,
    type: 'http',
    status: 'unknown',
  },
  {
    id: 'uk-2',
    country: 'United Kingdom',
    countryCode: 'GB',
    flag: '🇬🇧',
    host: '185.189.186.19',
    port: 8080,
    type: 'http',
    status: 'unknown',
  },
  // Germany Proxies
  {
    id: 'de-1',
    country: 'Germany',
    countryCode: 'DE',
    flag: '🇩🇪',
    host: '138.201.151.185',
    port: 8080,
    type: 'http',
    status: 'unknown',
  },
  {
    id: 'de-2',
    country: 'Germany',
    countryCode: 'DE',
    flag: '🇩🇪',
    host: '88.99.245.85',
    port: 8080,
    type: 'http',
    status: 'unknown',
  },
  // Netherlands Proxies
  {
    id: 'nl-1',
    country: 'Netherlands',
    countryCode: 'NL',
    flag: '🇳🇱',
    host: '51.15.242.153',
    port: 8888,
    type: 'http',
    status: 'unknown',
  },
  {
    id: 'nl-2',
    country: 'Netherlands',
    countryCode: 'NL',
    flag: '🇳🇱',
    host: '185.162.231.166',
    port: 8080,
    type: 'http',
    status: 'unknown',
  },
];

// Get unique countries from proxy list
export const getAvailableCountries = (): { code: string; name: string; flag: string }[] => {
  const countries = new Map<string, { code: string; name: string; flag: string }>();
  
  PROXY_SERVERS.forEach(server => {
    if (!countries.has(server.countryCode)) {
      countries.set(server.countryCode, {
        code: server.countryCode,
        name: server.country,
        flag: server.flag,
      });
    }
  });
  
  return Array.from(countries.values());
};

// Get proxy servers for a specific country
export const getProxiesByCountry = (countryCode: string): ProxyServer[] => {
  return PROXY_SERVERS.filter(s => s.countryCode === countryCode);
};

// Get the best proxy for a country (first available)
export const getBestProxy = (countryCode: string): ProxyServer | null => {
  const proxies = getProxiesByCountry(countryCode);
  // Return first online proxy, or first proxy if none tested
  const onlineProxy = proxies.find(p => p.status === 'online');
  return onlineProxy || proxies[0] || null;
};

// Test proxy connectivity
export const testProxy = async (proxy: ProxyServer): Promise<{ success: boolean; latency: number }> => {
  const startTime = Date.now();
  
  try {
    // Use the backend proxy test endpoint for real connectivity check
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    const proxyUrl = `${proxy.type}://${proxy.host}:${proxy.port}`;
    
    const response = await fetch(`${backendUrl}/api/proxy/test?proxy_url=${encodeURIComponent(proxyUrl)}`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    
    if (data.success) {
      return { success: true, latency: data.latency_ms || (Date.now() - startTime) };
    }
    return { success: false, latency: -1 };
  } catch (error) {
    return { success: false, latency: -1 };
  }
};

// Proxy settings service
export const proxyService = {
  // Get current settings
  getSettings: async (): Promise<ProxySettings> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[Proxy] Error getting settings:', error);
    }
    
    // Default settings
    return {
      enabled: false,
      selectedCountry: null,
      autoConnect: false,
    };
  },

  // Save settings
  saveSettings: async (settings: ProxySettings): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      console.log('[Proxy] Settings saved:', settings);
    } catch (error) {
      console.error('[Proxy] Error saving settings:', error);
    }
  },

  // Enable proxy for a country
  enableProxy: async (countryCode: string): Promise<boolean> => {
    const proxy = getBestProxy(countryCode);
    if (!proxy) {
      console.error('[Proxy] No proxy available for country:', countryCode);
      return false;
    }
    
    await proxyService.saveSettings({
      enabled: true,
      selectedCountry: countryCode,
      autoConnect: false,
    });
    
    console.log(`[Proxy] Enabled proxy for ${proxy.country}: ${proxy.host}:${proxy.port}`);
    return true;
  },

  // Disable proxy
  disableProxy: async (): Promise<void> => {
    const settings = await proxyService.getSettings();
    await proxyService.saveSettings({
      ...settings,
      enabled: false,
    });
    console.log('[Proxy] Proxy disabled');
  },

  // Get current proxy URL for streaming
  getProxyUrl: async (): Promise<string | null> => {
    const settings = await proxyService.getSettings();
    
    if (!settings.enabled || !settings.selectedCountry) {
      return null;
    }
    
    const proxy = getBestProxy(settings.selectedCountry);
    if (!proxy) {
      return null;
    }
    
    // Return proxy URL format
    return `${proxy.type}://${proxy.host}:${proxy.port}`;
  },

  // Get active proxy info
  getActiveProxy: async (): Promise<ProxyServer | null> => {
    const settings = await proxyService.getSettings();
    
    if (!settings.enabled || !settings.selectedCountry) {
      return null;
    }
    
    return getBestProxy(settings.selectedCountry);
  },

  // Test all proxies for a country and update status
  testCountryProxies: async (countryCode: string): Promise<ProxyServer[]> => {
    const proxies = getProxiesByCountry(countryCode);
    
    const results = await Promise.all(
      proxies.map(async (proxy) => {
        const result = await testProxy(proxy);
        return {
          ...proxy,
          status: result.success ? 'online' as const : 'offline' as const,
          latency: result.latency,
        };
      })
    );
    
    // Sort by latency (fastest first)
    return results.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'online' ? -1 : 1;
      }
      return (a.latency || 999) - (b.latency || 999);
    });
  },

  // Get all countries
  getCountries: getAvailableCountries,
};

export default proxyService;
