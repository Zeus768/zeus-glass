import React, { useEffect, useState } from 'react';
import { Tabs, usePathname, useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useContentStore } from '../store/contentStore';
import { playerState } from '../utils/playerState';
import { initWatchedStore } from '../stores/useWatchedStore';
import { updateService, UpdateInfo } from '../services/updateService';
import { UpdateDialog } from '../components/UpdateDialog';
import { ChangelogOverlay } from '../components/ChangelogOverlay';
import { focusSoundService } from '../services/focusSoundService';
import { BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Platform, 
  StatusBar, 
  View, 
  Text, 
  Pressable, 
  Modal, 
  StyleSheet, 
  Linking, 
  Dimensions,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Tab configuration
const TABS = [
  { name: 'index', title: 'HOME', route: '/' },
  { name: 'movies', title: 'MOVIES', route: '/movies' },
  { name: 'tv-shows', title: 'TV SHOWS', route: '/tv-shows' },
  { name: 'providers', title: 'PROVIDERS', route: '/providers' },
  { name: 'live-tv', title: 'LIVE TV', route: '/live-tv' },
  { name: 'tv-guide', title: 'TV GUIDE', route: '/tv-guide' },
  { name: 'catch-up', title: 'CATCH UP', route: '/catch-up' },
  { name: 'search', title: 'SEARCH', route: '/search' },
  { name: 'vod', title: 'VOD', route: '/vod' },
  { name: 'settings', title: 'SETTINGS', route: '/settings' },
];

// Custom Tab Bar Component
function CustomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [focusedTab, setFocusedTab] = useState<string | null>(null);

  const getActiveTab = () => {
    if (pathname === '/') return 'index';
    const tab = TABS.find(t => t.route === pathname || pathname.startsWith(t.route + '/'));
    return tab?.name || 'index';
  };

  const activeTab = getActiveTab();

  return (
    <View style={tabBarStyles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tabBarStyles.scrollContent}
      >
        {TABS.map((tab, index) => {
          const isActive = activeTab === tab.name;
          const isFocused = focusedTab === tab.name;
          
          return (
            <Pressable
              key={tab.name}
              onPress={() => {
                focusSoundService.playSelect();
                router.push(tab.route as any);
              }}
              onFocus={() => {
                setFocusedTab(tab.name);
                focusSoundService.playFocus();
              }}
              onBlur={() => setFocusedTab(null)}
              style={[
                tabBarStyles.tab,
                isActive && tabBarStyles.tabActive,
                isFocused && tabBarStyles.tabFocused,
              ]}
              data-testid={`tab-${tab.name}`}
              {...(Platform.isTV && index === 0 && { hasTVPreferredFocus: true })}
            >
              <Text style={[
                tabBarStyles.tabText,
                isActive && tabBarStyles.tabTextActive,
                isFocused && tabBarStyles.tabTextFocused,
              ]}>
                {tab.title}
              </Text>
              {isActive && <View style={tabBarStyles.activeIndicator} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const tabBarStyles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  scrollContent: {
    paddingHorizontal: isTV ? 16 : 12,
    paddingVertical: isTV ? 4 : 10,
    gap: isTV ? 2 : 4,
  },
  tab: {
    paddingHorizontal: isTV ? 10 : 16,
    paddingVertical: isTV ? 5 : 8,
    borderRadius: isTV ? 6 : 8,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    borderColor: 'rgba(0, 217, 255, 0.3)',
  },
  tabFocused: {
    backgroundColor: '#00D9FF',
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  tabText: {
    fontSize: isTV ? 11 : 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: isTV ? 0.8 : 0.8,
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  tabTextFocused: {
    color: '#000000',
    fontWeight: '900',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: isTV ? 12 : 16,    // Reduced from 20
    right: isTV ? 12 : 16,
    height: isTV ? 3 : 3,    // Reduced from 4
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
});

// Focusable Button Component for TV
const FocusableButton = ({ 
  onPress, 
  style, 
  focusedStyle,
  children,
  testID,
  ...props 
}: any) => {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <Pressable
      onPress={() => {
        focusSoundService.playSelect();
        onPress?.();
      }}
      onFocus={() => {
        setIsFocused(true);
        focusSoundService.playFocus();
      }}
      onBlur={() => setIsFocused(false)}
      style={[
        style,
        isFocused && { 
          borderWidth: 3, 
          borderColor: theme.colors.focus,
          transform: [{ scale: 1.05 }],
        },
        isFocused && focusedStyle,
      ]}
      data-testid={testID}
      {...props}
    >
      {children}
    </Pressable>
  );
};

// Donation Modal Component
function DonationModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const handleDonate = () => {
    Linking.openURL('https://ko-fi.com/zeus768');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={donationStyles.overlay}>
        <View style={[donationStyles.modal, isTV && donationStyles.modalTV]}>
          <FocusableButton style={donationStyles.closeButton} onPress={onClose} testID="close-donation-modal">
            <Ionicons name="close" size={isTV ? 40 : 28} color={theme.colors.text} />
          </FocusableButton>
          
          <View style={[donationStyles.coffeeIcon, isTV && donationStyles.coffeeIconTV]}>
            <Ionicons name="heart" size={isTV ? 40 : 28} color="#FF5E5B" />
          </View>
          
          <Text style={[donationStyles.title, isTV && donationStyles.titleTV]}>Support Zeus Glass</Text>
          <Text style={[donationStyles.subtitle, isTV && donationStyles.subtitleTV]}>
            If you enjoy the app, consider supporting us on Ko-fi!
          </Text>
          
          {/* QR Code */}
          <View style={[donationStyles.qrContainer, isTV && donationStyles.qrContainerTV]}>
            <Image 
              source={{ uri: 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https://ko-fi.com/zeus768' }}
              style={[donationStyles.qrCode, isTV && donationStyles.qrCodeTV]}
              contentFit="contain"
            />
            <Text style={[donationStyles.qrText, isTV && { fontSize: 14 }]}>Scan to donate</Text>
          </View>
          
          <FocusableButton 
            style={[donationStyles.donateButton, isTV && donationStyles.donateButtonTV]} 
            onPress={handleDonate}
            testID="donate-button"
          >
            <Ionicons name="heart" size={isTV ? 32 : 22} color="#fff" />
            <Text style={[donationStyles.donateButtonText, isTV && { fontSize: 16 }]}>Support on Ko-fi</Text>
          </FocusableButton>
          
          <Text style={[donationStyles.thankYou, isTV && { fontSize: 13 }]}>Thank you for your support!</Text>
        </View>
      </View>
    </Modal>
  );
}

const donationStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.gold,
  },
  modalTV: {
    maxWidth: 450,  // Reduced from 700
    padding: 30,    // Reduced from 50
    borderRadius: 24,
    borderWidth: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 10,
    zIndex: 10,
    borderRadius: 20,
  },
  coffeeIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFDD00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  coffeeIconTV: {
    width: 80,  // Reduced from 150
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  coffeeEmoji: {
    fontSize: 50,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 10,
  },
  titleTV: {
    fontSize: 26,  // Reduced from 42
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  subtitleTV: {
    fontSize: 16,  // Reduced from 22
    marginBottom: 20,
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  qrContainerTV: {
    padding: 16,  // Reduced from 30
    marginBottom: 20,
    borderRadius: 12,
  },
  qrCode: {
    width: 180,  // Reduced from 200
    height: 180,
  },
  qrCodeTV: {
    width: 180,  // Reduced from 320
    height: 180,
  },
  qrText: {
    marginTop: 12,
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#29ABE0',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 10,
    marginBottom: 20,
  },
  donateButtonTV: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginBottom: 16,
    borderRadius: 24,
  },
  donateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  thankYou: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});

export default function TabLayout() {
  const loadAllAccounts = useAuthStore((state) => state.loadAllAccounts);
  const loadHomeContent = useContentStore((state) => state.loadHomeContent);
  const loadFavorites = useContentStore((state) => state.loadFavorites);
  const [showDonation, setShowDonation] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogVersion, setChangelogVersion] = useState('');
  const [changelogText, setChangelogText] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        await loadAllAccounts().catch(() => {});
      } catch {}
      try {
        await loadHomeContent();
      } catch {}
      try {
        await loadFavorites();
      } catch {}
      // Initialize watched store (loads cache + syncs from Trakt if connected)
      try {
        await initWatchedStore();
      } catch {}
      // Initialize focus sounds for TV navigation
      try {
        await focusSoundService.init();
      } catch {}
      // Check for app updates (Android only)
      try {
        const update = await updateService.checkForUpdate();
        if (update) {
          setUpdateInfo(update);
          setShowUpdate(true);
        }
      } catch {}
      // Show changelog if version changed since last launch
      try {
        const currentVer = updateService.getCurrentVersion();
        const lastSeenVer = await AsyncStorage.getItem('zeus_last_seen_version');
        if (lastSeenVer && lastSeenVer !== currentVer) {
          // Version changed — fetch changelog from version.json or use local
          const versionData = require('../version.json');
          setChangelogVersion(currentVer);
          setChangelogText(versionData.changelog || 'Bug fixes and improvements');
          setShowChangelog(true);
        }
        // Save current version
        await AsyncStorage.setItem('zeus_last_seen_version', currentVer);
      } catch {}
    };
    init();
  }, []);

  const headerPaddingTop = isTV ? 30 : Platform.OS === 'ios' ? 50 : 35;
  
  // Hide header and tab bar when player is active
  const [isPlayerActive, setIsPlayerActive] = useState(false);
  
  useEffect(() => {
    const unsub = playerState.subscribe((active) => setIsPlayerActive(active));
    return unsub;
  }, []);
  
  const pathname = usePathname();
  const segments = useSegments();
  const isPlayerScreen = isPlayerActive || segments[0] === 'player' || pathname === '/player' || pathname?.startsWith('/player');

  // Failsafe: If we're NOT on the player screen but playerState is still active, reset it
  useEffect(() => {
    if (!isPlayerScreen) return;
    // When we leave the player screen, ensure playerState is reset
  }, [isPlayerScreen]);

  useEffect(() => {
    const isOnPlayer = segments[0] === 'player' || pathname === '/player' || pathname?.startsWith('/player');
    if (!isOnPlayer && isPlayerActive) {
      // User navigated away from player but playerState still active - force reset
      console.log('[Layout] Failsafe: Resetting playerState - navigated away from player');
      playerState.setActive(false);
    }
  }, [pathname, segments]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={isPlayerScreen ? '#000' : theme.colors.background} />
      
      {/* Header with App Name, Exit and Donation Buttons - hidden on player */}
      {!isPlayerScreen && (
        <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
          <Text style={styles.appName}>ZEUS GLASS</Text>
          <View style={{ flexDirection: 'row', gap: isTV ? 8 : 10 }}>
            {Platform.isTV && (
              <FocusableButton 
                style={styles.exitBtn} 
                onPress={() => BackHandler.exitApp()}
                testID="exit-app-btn"
              >
                <Ionicons name="power" size={isTV ? 16 : 16} color="#FF4444" />
                <Text style={styles.exitBtnText}>Exit</Text>
              </FocusableButton>
            )}
            <FocusableButton 
              style={styles.donateBtn} 
              onPress={() => setShowDonation(true)}
              testID="open-donation-modal"
              {...(Platform.isTV && { focusable: false, accessible: false })}
            >
              <Ionicons name="heart" size={isTV ? 16 : 18} color="#FFDD00" />
              <Text style={styles.donateBtnText}>Donate</Text>
            </FocusableButton>
          </View>
        </View>
      )}
      
      {/* Custom Tab Bar - hidden on player */}
      {!isPlayerScreen && <CustomTabBar />}
      
      {/* Screen Content via Tabs (hidden tab bar) */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, // Hide default tab bar
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="movies" />
        <Tabs.Screen name="tv-shows" />
        <Tabs.Screen name="providers" />
        <Tabs.Screen name="live-tv" />
        <Tabs.Screen name="tv-guide" />
        <Tabs.Screen name="catch-up" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="vod" />
        <Tabs.Screen name="settings" />
        
        {/* Hidden screens */}
        <Tabs.Screen name="movie/[id]" options={{ href: null }} />
        <Tabs.Screen name="tv/[id]" options={{ href: null }} />
        <Tabs.Screen name="player" options={{ href: null }} />
      </Tabs>
      
      {/* Donation Modal */}
      <DonationModal visible={showDonation} onClose={() => setShowDonation(false)} />
      
      {/* Auto-Update Dialog */}
      {updateInfo && (
        <UpdateDialog 
          visible={showUpdate} 
          updateInfo={updateInfo} 
          onDismiss={() => setShowUpdate(false)} 
        />
      )}

      {/* Changelog Overlay — shows after version changes */}
      <ChangelogOverlay
        visible={showChangelog}
        version={changelogVersion}
        changelog={changelogText}
        onClose={() => setShowChangelog(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: isTV ? 20 : 20,
    paddingBottom: isTV ? 2 : 12,
    paddingTop: isTV ? 4 : 0,
  },
  appName: {
    fontSize: isTV ? 16 : 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    letterSpacing: isTV ? 1.5 : 2,
  },
  donateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 221, 0, 0.15)',
    paddingVertical: isTV ? 5 : 10,
    paddingHorizontal: isTV ? 12 : 18,
    borderRadius: isTV ? 16 : 25,
    borderWidth: isTV ? 1 : 2,
    borderColor: '#FFDD00',
    gap: isTV ? 4 : 8,
  },
  donateBtnText: {
    fontSize: isTV ? 12 : 14,
    fontWeight: '700',
    color: '#FFDD00',
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    paddingVertical: isTV ? 5 : 10,
    paddingHorizontal: isTV ? 12 : 18,
    borderRadius: isTV ? 16 : 25,
    borderWidth: isTV ? 1 : 2,
    borderColor: '#FF4444',
    gap: isTV ? 4 : 8,
  },
  exitBtnText: {
    fontSize: isTV ? 12 : 14,
    fontWeight: '700',
    color: '#FF4444',
  },
});
