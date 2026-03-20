import axios, { AxiosRequestConfig } from 'axios';
import { proxyService } from './proxyService';

const getBackendUrl = () => process.env.EXPO_PUBLIC_BACKEND_URL || '';

/**
 * Proxied fetch utility for streaming requests.
 * When proxy is enabled, routes the request through the backend proxy endpoint.
 * When proxy is disabled, makes a direct request.
 * 
 * Only use this for streaming-related requests (debrid unrestrict, torrent scraping, etc.)
 * Do NOT use for TMDB/Trakt metadata calls.
 */
export const proxiedGet = async (
  url: string,
  config?: AxiosRequestConfig
): Promise<any> => {
  const proxyUrl = await proxyService.getProxyUrl();

  if (proxyUrl) {
    // Route through backend proxy
    const backendUrl = getBackendUrl();
    const response = await axios.post(`${backendUrl}/api/proxy/fetch`, {
      url,
      proxy_url: proxyUrl,
      method: 'GET',
      headers: config?.headers || {},
    }, { timeout: config?.timeout || 30000 });

    return {
      data: typeof response.data.data === 'string' 
        ? tryParseJSON(response.data.data) 
        : response.data.data,
      status: response.data.status_code,
    };
  }

  // Direct request (no proxy)
  return axios.get(url, config);
};

export const proxiedPost = async (
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<any> => {
  const proxyUrl = await proxyService.getProxyUrl();

  if (proxyUrl) {
    const backendUrl = getBackendUrl();
    const response = await axios.post(`${backendUrl}/api/proxy/fetch`, {
      url,
      proxy_url: proxyUrl,
      method: 'POST',
      headers: config?.headers || {},
    }, { timeout: config?.timeout || 30000 });

    return {
      data: typeof response.data.data === 'string' 
        ? tryParseJSON(response.data.data) 
        : response.data.data,
      status: response.data.status_code,
    };
  }

  // Direct request (no proxy)
  return axios.post(url, data, config);
};

/**
 * Test proxy connectivity through the backend
 */
export const testProxyConnection = async (proxyUrl: string): Promise<{
  success: boolean;
  ip?: string;
  latency_ms?: number;
  error?: string;
}> => {
  try {
    const backendUrl = getBackendUrl();
    const response = await axios.get(
      `${backendUrl}/api/proxy/test?proxy_url=${encodeURIComponent(proxyUrl)}`,
      { timeout: 15000 }
    );
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

function tryParseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
