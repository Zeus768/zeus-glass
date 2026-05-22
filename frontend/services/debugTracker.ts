import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Dimensions } from 'react-native';
import { errorLogService } from './errorLogService';

const INTERACTION_KEY = '@zeus_debug_interactions';
const NAV_KEY = '@zeus_debug_navigation';
const MAX_INTERACTIONS = 1000;
const MAX_NAV = 500;

const getBackendUrl = (): string => {
  if (Platform.OS === 'web') return '';
  return process.env.EXPO_PUBLIC_BACKEND_URL || '';
};

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

  // Upload debug bundle to GoFile via backend
  uploadDebugBundle: async (): Promise<{ success: boolean; gofileUrl: string | null; message: string }> => {
    try {
      const backendUrl = getBackendUrl();
      if (!backendUrl) return { success: false, gofileUrl: null, message: 'Backend URL not configured' };

      const deviceId = await getDeviceId();
      const { width, height } = Dimensions.get('window');

      const body = {
        device_id: deviceId,
        device_name: getDeviceName(),
        platform: `${Platform.OS}${Platform.isTV ? '-tv' : ''} ${Platform.Version || ''}`.trim(),
        app_version: '1.5.0',
        interaction_logs: interactions.slice(0, 500),
        error_logs: errorLogService.logs.slice(0, 200),
        navigation_history: navigation.slice(0, 200),
        device_info: {
          os: Platform.OS,
          version: Platform.Version,
          isTV: Platform.isTV,
          screenWidth: width,
          screenHeight: height,
        },
        app_state: {
          totalInteractions: interactions.length,
          totalErrors: errorLogService.logs.filter(l => l.level === 'error').length,
          totalNavigations: navigation.length,
          currentScreen,
          uptime: `${Math.floor((Date.now() - (interactions[interactions.length - 1] ? new Date(interactions[interactions.length - 1].timestamp).getTime() : Date.now())) / 60000)} minutes`,
        },
      };

      const response = await fetch(`${backendUrl}/api/debug/upload-gofile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      return {
        success: data.success || false,
        gofileUrl: data.gofile_url || null,
        message: data.message || 'Upload complete',
      };
    } catch (error: any) {
      return { success: false, gofileUrl: null, message: error.message || 'Network error' };
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
