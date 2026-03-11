import React, { useEffect, useState } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useContentStore } from '../store/contentStore';
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
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Tab configuration
const TABS = [
  { name: 'index', title: 'HOME', route: '/' },
  { name: 'movies', title: 'MOVIES', route: '/movies' },
  { name: 'tv-shows', title: 'TV SHOWS', route: '/tv-shows' },
  { name: 'providers', title: 'PROVIDERS', route: '/providers' },
  { name: 'tv-guide', title: 'LIVE TV', route: '/tv-guide' },
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
            <TouchableOpacity
              key={tab.name}
              onPress={() => router.push(tab.route as any)}
              onFocus={() => setFocusedTab(tab.name)}
              onBlur={() => setFocusedTab(null)}
              style={[
                tabBarStyles.tab,
                isActive && tabBarStyles.tabActive,
                isFocused && tabBarStyles.tabFocused,
              ]}
              activeOpacity={0.7}
              {...(Platform.isTV && index === 0 && { hasTVPreferredFocus: true })}
            >
              {/* Focus glow effect */}
              {isFocused && <View style={tabBarStyles.focusGlow} />}
              <Text style={[
                tabBarStyles.tabText,
                isActive && tabBarStyles.tabTextActive,
                isFocused && tabBarStyles.tabTextFocused,
              ]}>
                {tab.title}
              </Text>
              {isActive && <View style={tabBarStyles.activeIndicator} />}
            </TouchableOpacity>
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
    paddingHorizontal: isTV ? 40 : 12,
    paddingVertical: isTV ? 8 : 10,  // Reduced padding for TV
    gap: isTV ? 6 : 4,
  },
  tab: {
    paddingHorizontal: isTV ? 20 : 16,  // Smaller padding
    paddingVertical: isTV ? 8 : 8,  // Smaller padding
    borderRadius: isTV ? 10 : 8,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
  },
  tabFocused: {
    backgroundColor: theme.colors.primary,
    borderColor: '#FFFFFF',
    borderWidth: isTV ? 3 : 3,
    transform: [{ scale: isTV ? 1.1 : 1.1 }],  // Less scale
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: isTV ? 20 : 20,
    elevation: 20,
  },
  focusGlow: {
    position: 'absolute',
    top: isTV ? -5 : -5,
    left: isTV ? -5 : -5,
    right: isTV ? -5 : -5,
    bottom: isTV ? -5 : -5,
    backgroundColor: theme.colors.primary,
    borderRadius: isTV ? 15 : 12,
    opacity: 0.4,
  },
  tabText: {
    fontSize: isTV ? 16 : 14,  // Smaller text
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: isTV ? 1 : 0.8,
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
    left: isTV ? 20 : 16,
    right: isTV ? 20 : 16,
    height: isTV ? 4 : 3,
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
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
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
    Linking.openURL('https://buymeacoffee.com/zeus768?new=1');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={donationStyles.overlay}>
        <View style={[donationStyles.modal, isTV && donationStyles.modalTV]}>
          <FocusableButton style={donationStyles.closeButton} onPress={onClose} testID="close-donation-modal">
            <Ionicons name="close" size={isTV ? 40 : 28} color={theme.colors.text} />
          </FocusableButton>
          
          <View style={[donationStyles.coffeeIcon, isTV && donationStyles.coffeeIconTV]}>
            <Text style={[donationStyles.coffeeEmoji, isTV && { fontSize: 80 }]}>☕</Text>
          </View>
          
          <Text style={[donationStyles.title, isTV && donationStyles.titleTV]}>Support Zeus Glass</Text>
          <Text style={[donationStyles.subtitle, isTV && donationStyles.subtitleTV]}>
            If you enjoy the app, consider buying me a coffee!
          </Text>
          
          {/* QR Code */}
          <View style={[donationStyles.qrContainer, isTV && donationStyles.qrContainerTV]}>
            <Image 
              source={{ uri: 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https://buymeacoffee.com/zeus768' }}
              style={[donationStyles.qrCode, isTV && donationStyles.qrCodeTV]}
              contentFit="contain"
            />
            <Text style={[donationStyles.qrText, isTV && { fontSize: 20 }]}>Scan to donate</Text>
          </View>
          
          <FocusableButton 
            style={[donationStyles.donateButton, isTV && donationStyles.donateButtonTV]} 
            onPress={handleDonate}
            testID="donate-button"
          >
            <Ionicons name="heart" size={isTV ? 32 : 22} color="#000" />
            <Text style={[donationStyles.donateButtonText, isTV && { fontSize: 24 }]}>Buy Me a Coffee</Text>
          </FocusableButton>
          
          <Text style={[donationStyles.thankYou, isTV && { fontSize: 18 }]}>Thank you for your support!</Text>
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
    maxWidth: 700,
    padding: 50,
    borderRadius: 32,
    borderWidth: 3,
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
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 30,
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
    fontSize: 42,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  subtitleTV: {
    fontSize: 22,
    marginBottom: 36,
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  qrContainerTV: {
    padding: 30,
    marginBottom: 36,
    borderRadius: 20,
  },
  qrCode: {
    width: 200,
    height: 200,
  },
  qrCodeTV: {
    width: 320,
    height: 320,
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
    backgroundColor: '#FFDD00',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 10,
    marginBottom: 20,
  },
  donateButtonTV: {
    paddingVertical: 22,
    paddingHorizontal: 50,
    marginBottom: 28,
    borderRadius: 40,
  },
  donateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
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
    };
    init();
  }, []);

  const headerPaddingTop = isTV ? 30 : Platform.OS === 'ios' ? 50 : 35;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {/* Header with App Name and Donation Button */}
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <Text style={styles.appName}>ZEUS GLASS</Text>
        <FocusableButton 
          style={styles.donateBtn} 
          onPress={() => setShowDonation(true)}
          testID="open-donation-modal"
        >
          <Ionicons name="heart" size={isTV ? 28 : 18} color="#FFDD00" />
          <Text style={styles.donateBtnText}>Donate</Text>
        </FocusableButton>
      </View>
      
      {/* Custom Tab Bar - ALWAYS VISIBLE */}
      <CustomTabBar />
      
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
    paddingHorizontal: isTV ? 50 : 20,
    paddingBottom: isTV ? 8 : 12,
    paddingTop: isTV ? 10 : 0,
  },
  appName: {
    fontSize: isTV ? 28 : 24,  // Smaller on TV
    fontWeight: 'bold',
    color: theme.colors.primary,
    letterSpacing: isTV ? 3 : 2,
  },
  donateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 221, 0, 0.15)',
    paddingVertical: isTV ? 12 : 10,
    paddingHorizontal: isTV ? 24 : 18,
    borderRadius: isTV ? 25 : 25,
    borderWidth: isTV ? 2 : 2,
    borderColor: '#FFDD00',
    gap: isTV ? 8 : 8,
  },
  donateBtnText: {
    fontSize: isTV ? 18 : 14,
    fontWeight: '700',
    color: '#FFDD00',
  },
});
