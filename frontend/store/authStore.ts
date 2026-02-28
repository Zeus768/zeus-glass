import { create } from 'zustand';
import { DebridAccount, TraktUser, IPTVConfig } from '../types';
import { realDebridService, allDebridService, premiumizeService } from '../services/debrid';
import { traktService } from '../services/trakt';
import { iptvService } from '../services/iptv';

interface AuthState {
  // Trakt
  traktUser: TraktUser | null;
  traktLoading: boolean;
  
  // Real-Debrid
  realDebridAccount: DebridAccount | null;
  realDebridLoading: boolean;
  
  // AllDebrid
  allDebridAccount: DebridAccount | null;
  allDebridLoading: boolean;
  
  // Premiumize
  premiumizeAccount: DebridAccount | null;
  premiumizeLoading: boolean;
  
  // IPTV
  iptvConfig: IPTVConfig | null;
  iptvAccount: { username: string; expiryDate: string; daysLeft: number } | null;
  iptvLoading: boolean;
  
  // Actions
  loadAllAccounts: () => Promise<void>;
  loadTraktAccount: () => Promise<void>;
  loadRealDebridAccount: () => Promise<void>;
  loadAllDebridAccount: () => Promise<void>;
  loadPremiumizeAccount: () => Promise<void>;
  loadIPTVAccount: () => Promise<void>;
  logoutTrakt: () => Promise<void>;
  logoutRealDebrid: () => Promise<void>;
  logoutAllDebrid: () => Promise<void>;
  logoutPremiumize: () => Promise<void>;
  logoutIPTV: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  traktUser: null,
  traktLoading: false,
  realDebridAccount: null,
  realDebridLoading: false,
  allDebridAccount: null,
  allDebridLoading: false,
  premiumizeAccount: null,
  premiumizeLoading: false,
  iptvConfig: null,
  iptvAccount: null,
  iptvLoading: false,

  loadAllAccounts: async () => {
    const store = useAuthStore.getState();
    await Promise.all([
      store.loadTraktAccount(),
      store.loadRealDebridAccount(),
      store.loadAllDebridAccount(),
      store.loadPremiumizeAccount(),
      store.loadIPTVAccount(),
    ]);
  },

  loadTraktAccount: async () => {
    set({ traktLoading: true });
    try {
      const token = await traktService.getToken();
      if (token) {
        const user = await traktService.getCurrentUser();
        set({ traktUser: user });
      }
    } catch (error) {
      console.error('Error loading Trakt account:', error);
    } finally {
      set({ traktLoading: false });
    }
  },

  loadRealDebridAccount: async () => {
    set({ realDebridLoading: true });
    try {
      const account = await realDebridService.getAccountInfo();
      set({ realDebridAccount: account });
    } catch (error) {
      console.error('Error loading Real-Debrid account:', error);
    } finally {
      set({ realDebridLoading: false });
    }
  },

  loadAllDebridAccount: async () => {
    set({ allDebridLoading: true });
    try {
      const account = await allDebridService.getAccountInfo();
      set({ allDebridAccount: account });
    } catch (error) {
      console.error('Error loading AllDebrid account:', error);
    } finally {
      set({ allDebridLoading: false });
    }
  },

  loadPremiumizeAccount: async () => {
    set({ premiumizeLoading: true });
    try {
      const account = await premiumizeService.getAccountInfo();
      set({ premiumizeAccount: account });
    } catch (error) {
      console.error('Error loading Premiumize account:', error);
    } finally {
      set({ premiumizeLoading: false });
    }
  },

  loadIPTVAccount: async () => {
    set({ iptvLoading: true });
    try {
      const config = await iptvService.getConfig();
      const account = await iptvService.getAccountInfo();
      set({ iptvConfig: config, iptvAccount: account });
    } catch (error) {
      console.error('Error loading IPTV account:', error);
    } finally {
      set({ iptvLoading: false });
    }
  },

  logoutTrakt: async () => {
    await traktService.logout();
    set({ traktUser: null });
  },

  logoutRealDebrid: async () => {
    await realDebridService.logout();
    set({ realDebridAccount: null });
  },

  logoutAllDebrid: async () => {
    await allDebridService.logout();
    set({ allDebridAccount: null });
  },

  logoutPremiumize: async () => {
    await premiumizeService.logout();
    set({ premiumizeAccount: null });
  },

  logoutIPTV: async () => {
    await iptvService.logout();
    set({ iptvConfig: null, iptvAccount: null });
  },
}));
