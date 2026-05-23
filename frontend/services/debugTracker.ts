import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Dimensions } from 'react-native';
import { errorLogService } from './errorLogService';
import { BACKEND_URL } from '../config/constants';

const INTERACTION_KEY = '@zeus_debug_interactions';
const NAV_KEY = '@zeus_debug_navigation';
const MAX_INTERACTIONS = 1000;
const MAX_NAV = 500;

const getBackendUrl = (): string => BACKEND_URL;

export interface InteractionEvent {
  id: string;
  timestamp: string;
  type: 'press' | 'focus' | 'longpress' | 'scroll' | 'input' | 'modal' | 'api' | 'crash';
  target: string;
  screen: string;
  details?: string;
}

export interface NavigationEvent {
  id: string;
  timestamp: string;
  from: string;
  to: string;
  params?: string;
}

// In-memory buffers for performance
let interactions: InteractionEvent[] = [];
let navigation: NavigationEvent[] = [];
let currentScreen = 'unknown';
let initialized = false;

const getDeviceId = async (): Promise<string> => {
  try {
    let id = await AsyncStorage.getItem('@zeus_glass_device_id');
    if (!id) {
      id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('@zeus_glass_device_id', id);
    }
    return id;
  } catch {
    return `device_${Date.now()}`;
  }
};

const getDeviceName = (): string => {
  if (Platform.isTV) {
    return Platform.OS === 'android' ? 'Android TV / Fire TV' : 'TV Device';
  }
  return Platform.OS === 'android' ? 'Android Phone' : Platform.OS === 'ios' ? 'iPhone' : 'Web Browser';
};

export const debugTracker = {
  init: async () => {
    if (initialized) return;
    try {
      const storedInteractions = await AsyncStorage.getItem(INTERACTION_KEY);
      const storedNav = await AsyncStorage.getItem(NAV_KEY);
      if (storedInteractions) interactions = JSON.parse(storedInteractions);
      if (storedNav) navigation = JSON.parse(storedNav);
      initialized = true;
      debugTracker.trackInteraction('system', 'app-start', 'App initialized');
    } catch (e) {
      console.warn('[DebugTracker] Init failed:', e);
    }
  },

  setCurrentScreen: (screen: string) => {
    currentScreen = screen;
  },

  trackInteraction: (type: InteractionEvent['type'], target: string, details?: string) => {
    const event: InteractionEvent = {
      id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      type,
      target,
      screen: currentScreen,
      details,
    };
    interactions.unshift(event);
    if (interactions.length > MAX_INTERACTIONS) {
      interactions = interactions.slice(0, MAX_INTERACTIONS);
    }
    // Save periodically (every 20 events)
    if (interactions.length % 20 === 0) {
      AsyncStorage.setItem(INTERACTION_KEY, JSON.stringify(interactions)).catch(() => {});
    }
  },

  trackNavigation: (from: string, to: string, params?: any) => {
    const event: NavigationEvent = {
      id: `nav_${Date.now()}`,
      timestamp: new Date().toISOString(),
      from,
      to,
      params: params ? JSON.stringify(params).slice(0, 200) : undefined,
    };
    navigation.unshift(event);
    if (navigation.length > MAX_NAV) {
      navigation = navigation.slice(0, MAX_NAV);
    }
    currentScreen = to;
    AsyncStorage.setItem(NAV_KEY, JSON.stringify(navigation)).catch(() => {});
  },

  trackCrash: (error: Error, componentStack?: string) => {
    debugTracker.trackInteraction('crash', error.message, componentStack?.slice(0, 500));
    errorLogService.error(`CRASH: ${error.message}`, 'CrashHandler', error);
    // Force save immediately
    AsyncStorage.setItem(INTERACTION_KEY, JSON.stringify(interactions)).catch(() => {});
  },

  // Upload debug bundle directly to file hosting (no backend proxy needed)
  uploadDebugBundle: async (): Promise<{ success: boolean; gofileUrl: string | null; message: string }> => {
    try {
      const deviceId = await getDeviceId();
      const { width, height } = Dimensions.get('window');

      const report = {
        zeus_glass_debug_report: true,
        generated_at: new Date().toISOString(),
        device: {
          id: deviceId,
          name: getDeviceName(),
          platform: `${Platform.OS}${Platform.isTV ? '-tv' : ''} ${Platform.Version || ''}`.trim(),
          app_version: '1.5.0',
          screenWidth: width,
          screenHeight: height,
          isTV: Platform.isTV,
        },
        interaction_count: interactions.length,
        error_count: errorLogService.logs.filter(l => l.level === 'error').length,
        nav_count: navigation.length,
        current_screen: currentScreen,
        interactions: interactions.slice(0, 300),
        errors: errorLogService.logs.slice(0, 100),
        navigation: navigation.slice(0, 100),
      };

      const reportJson = JSON.stringify(report, null, 2);

      // Try multiple upload methods in order of reliability

      // Method 1: Try backend proxy (works if backend is reachable)
      try {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          const resp = await fetch(`${backendUrl}/api/debug/upload-gofile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              device_id: deviceId,
              device_name: getDeviceName(),
              platform: report.device.platform,
              app_version: '1.5.0',
              interaction_logs: interactions.slice(0, 300),
              error_logs: errorLogService.logs.slice(0, 100),
              navigation_history: navigation.slice(0, 100),
              device_info: report.device,
            }),
          });
          const text = await resp.text();
          try {
            const data = JSON.parse(text);
            if (data.gofile_url) {
              return { success: true, gofileUrl: data.gofile_url, message: data.message || 'Uploaded via backend' };
            }
          } catch {}
        }
      } catch {}

      // Method 2: Upload to paste.rs (simple raw POST, works from any device)
      try {
        const pasteResp = await fetch('https://paste.rs/', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: reportJson,
        });
        const pasteUrl = await pasteResp.text();
        if (pasteUrl && pasteUrl.startsWith('http')) {
          return { success: true, gofileUrl: pasteUrl.trim(), message: `Debug uploaded (${reportJson.length} bytes)` };
        }
      } catch {}

      // Method 3: Upload to dpaste.org
      try {
        const formBody = `content=${encodeURIComponent(reportJson)}&syntax=json&expiry_days=30`;
        const dpasteResp = await fetch('https://dpaste.org/api/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody,
        });
        const dpasteUrl = await dpasteResp.text();
        if (dpasteUrl && dpasteUrl.startsWith('http')) {
          return { success: true, gofileUrl: dpasteUrl.trim(), message: `Debug uploaded (${reportJson.length} bytes)` };
        }
      } catch {}

      // Method 3: Upload to ix.io paste service
      try {
        const ixBody = `f:1=${encodeURIComponent(reportJson)}`;
        const ixResp = await fetch('http://ix.io', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: ixBody,
        });
        const ixUrl = await ixResp.text();
        if (ixUrl && ixUrl.startsWith('http')) {
          return { success: true, gofileUrl: ixUrl.trim(), message: `Debug uploaded (${reportJson.length} bytes)` };
        }
      } catch {}

      return { success: false, gofileUrl: null, message: 'All upload methods failed. Check network connection.' };
    } catch (error: any) {
      return { success: false, gofileUrl: null, message: error.message || 'Upload failed' };
    }
  },

  // Get stats for display
  getStats: () => ({
    totalInteractions: interactions.length,
    totalErrors: errorLogService.logs.filter(l => l.level === 'error').length,
    totalWarnings: errorLogService.logs.filter(l => l.level === 'warn').length,
    totalNavigations: navigation.length,
    currentScreen,
    lastCrash: interactions.find(i => i.type === 'crash')?.timestamp || 'None',
  }),

  // Clear all debug data
  clearAll: async () => {
    interactions = [];
    navigation = [];
    await AsyncStorage.multiRemove([INTERACTION_KEY, NAV_KEY]).catch(() => {});
    await errorLogService.clearLogs();
  },
};
