import React, { useEffect, useState, useRef } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
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
  TVFocusGuideView,
  useTVEventHandler,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isTV = Platform.isTV || SCREEN_WIDTH > 900;

// Focusable Button Component for TV
const FocusableButton = ({ 
  onPress, 
  style, 
  focusedStyle,
  children,
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
          borderColor: theme.colors.primary,
          transform: [{ scale: 1.05 }],
        },
        isFocused && focusedStyle,
      ]}
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
          <FocusableButton style={donationStyles.closeButton} onPress={onClose}>
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
          >
            <Ionicons name="heart" size={isTV ? 32 : 22} color="#000" />
            <Text style={[donationStyles.donateButtonText, isTV && { fontSize: 24 }]}>Buy Me a Coffee</Text>
          </FocusableButton>
          
          <Text style={[donationStyles.thankYou, isTV && { fontSize: 18 }]}>Thank you for your support! 💛</Text>
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
  const iptvConfig = useAuthStore((state) => state.iptvConfig);
  const [showDonation, setShowDonation] = useState(false);

  useEffect(() => {
    loadAllAccounts();
    loadHomeContent();
    loadFavorites();
  }, []);

  // Tab bar height based on device
  const tabBarHeight = isTV ? 80 : 55;
  const tabFontSize = isTV ? 20 : 14;
  const headerPaddingTop = isTV ? 20 : Platform.OS === 'ios' ? 50 : 35;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {/* Header with App Name and Donation Button */}
      <View style={[headerStyles.header, { paddingTop: headerPaddingTop }, isTV && headerStyles.headerTV]}>
        <Text style={[headerStyles.appName, isTV && headerStyles.appNameTV]}>ZEUS GLASS</Text>
        <FocusableButton 
          style={[headerStyles.donateBtn, isTV && headerStyles.donateBtnTV]} 
          onPress={() => setShowDonation(true)}
        >
          <Ionicons name="heart" size={isTV ? 28 : 18} color="#FFDD00" />
          <Text style={[headerStyles.donateBtnText, isTV && headerStyles.donateBtnTextTV]}>Donate</Text>
        </FocusableButton>
      </View>
      
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.border,
            borderBottomWidth: 1,
            height: tabBarHeight,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: tabFontSize,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: isTV ? 1.5 : 0.8,
            marginBottom: isTV ? 12 : 6,
          },
          tabBarItemStyle: {
            paddingVertical: isTV ? 10 : 6,
            minWidth: isTV ? 180 : 90,
          },
          tabBarIndicatorStyle: {
            backgroundColor: theme.colors.primary,
            height: isTV ? 4 : 3,
            borderRadius: 2,
          },
          tabBarPosition: 'top',
          headerShown: false,
          tabBarScrollEnabled: true,
          tabBarAllowFontScaling: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'HOME',
            tabBarIcon: () => null,
          }}
        />
        <Tabs.Screen
          name="movies"
          options={{
            title: 'MOVIES',
            tabBarIcon: () => null,
          }}
        />
        <Tabs.Screen
          name="tv-shows"
          options={{
            title: 'TV SHOWS',
            tabBarIcon: () => null,
          }}
        />
        <Tabs.Screen
          name="tv-guide"
          options={{
            title: 'LIVE TV',
            tabBarIcon: () => null,
          }}
        />
        <Tabs.Screen
          name="catch-up"
          options={{
            title: 'CATCH UP',
            tabBarIcon: () => null,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'SEARCH',
            tabBarIcon: () => null,
          }}
        />
        <Tabs.Screen
          name="vod"
          options={{
            title: 'VOD',
            tabBarIcon: () => null,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'SETTINGS',
            tabBarIcon: () => null,
          }}
        />
        
        {/* Hidden screens */}
        <Tabs.Screen name="movie/[id]" options={{ href: null }} />
        <Tabs.Screen name="player" options={{ href: null }} />
        <Tabs.Screen name="+html" options={{ href: null }} />
        <Tabs.Screen name="+not-found" options={{ href: null }} />
        <Tabs.Screen name="tv/[id]" options={{ href: null }} />
      </Tabs>
      
      {/* Donation Modal */}
      <DonationModal visible={showDonation} onClose={() => setShowDonation(false)} />
    </View>
  );
}

const headerStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTV: {
    paddingHorizontal: 50,
    paddingBottom: 20,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    letterSpacing: 2,
  },
  appNameTV: {
    fontSize: 40,
    letterSpacing: 4,
  },
  donateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 221, 0, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFDD00',
    gap: 8,
  },
  donateBtnTV: {
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 35,
    gap: 12,
    borderWidth: 3,
  },
  donateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFDD00',
  },
  donateBtnTextTV: {
    fontSize: 22,
  },
});
