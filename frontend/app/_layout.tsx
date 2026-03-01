import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useContentStore } from '../store/contentStore';
import { Platform, StatusBar, View, Text, Pressable, Modal, StyleSheet, Linking, Dimensions, TVFocusGuideView } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTV = Platform.isTV || SCREEN_WIDTH > 1200;

// Donation Modal Component
function DonationModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const handleDonate = () => {
    Linking.openURL('https://buymeacoffee.com/zeus768?new=1');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={donationStyles.overlay}>
        <View style={[donationStyles.modal, isTV && donationStyles.modalTV]}>
          <Pressable style={donationStyles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={isTV ? 32 : 24} color={theme.colors.text} />
          </Pressable>
          
          <View style={[donationStyles.coffeeIcon, isTV && donationStyles.coffeeIconTV]}>
            <Text style={[donationStyles.coffeeEmoji, isTV && { fontSize: 60 }]}>☕</Text>
          </View>
          
          <Text style={[donationStyles.title, isTV && donationStyles.titleTV]}>Support Zeus Glass</Text>
          <Text style={[donationStyles.subtitle, isTV && donationStyles.subtitleTV]}>
            If you enjoy the app, consider buying me a coffee!
          </Text>
          
          {/* QR Code */}
          <View style={[donationStyles.qrContainer, isTV && donationStyles.qrContainerTV]}>
            <Image 
              source={{ uri: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://buymeacoffee.com/zeus768' }}
              style={[donationStyles.qrCode, isTV && donationStyles.qrCodeTV]}
              contentFit="contain"
            />
            <Text style={[donationStyles.qrText, isTV && { fontSize: 16 }]}>Scan to donate</Text>
          </View>
          
          <Pressable style={[donationStyles.donateButton, isTV && donationStyles.donateButtonTV]} onPress={handleDonate}>
            <Ionicons name="heart" size={isTV ? 28 : 20} color="#000" />
            <Text style={[donationStyles.donateButtonText, isTV && { fontSize: 20 }]}>Buy Me a Coffee</Text>
          </Pressable>
          
          <Text style={[donationStyles.thankYou, isTV && { fontSize: 16 }]}>Thank you for your support! 💛</Text>
        </View>
      </View>
    </Modal>
  );
}

const donationStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '90%',
    maxWidth: 380,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.gold,
  },
  modalTV: {
    maxWidth: 600,
    padding: 40,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 10,
  },
  coffeeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFDD00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  coffeeIconTV: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
  },
  coffeeEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  titleTV: {
    fontSize: 32,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  subtitleTV: {
    fontSize: 18,
    marginBottom: 30,
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  qrContainerTV: {
    padding: 24,
    marginBottom: 30,
  },
  qrCode: {
    width: 180,
    height: 180,
  },
  qrCodeTV: {
    width: 280,
    height: 280,
  },
  qrText: {
    marginTop: 8,
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFDD00',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    gap: 8,
    marginBottom: 16,
  },
  donateButtonTV: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    marginBottom: 24,
  },
  donateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  thankYou: {
    fontSize: 12,
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

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {/* Header with App Name and Donation Button */}
      <View style={[headerStyles.header, isTV && headerStyles.headerTV]}>
        <Text style={[headerStyles.appName, isTV && headerStyles.appNameTV]}>ZEUS GLASS</Text>
        <Pressable style={[headerStyles.donateBtn, isTV && headerStyles.donateBtnTV]} onPress={() => setShowDonation(true)}>
          <Ionicons name="heart" size={isTV ? 24 : 16} color="#FFDD00" />
          <Text style={[headerStyles.donateBtnText, isTV && headerStyles.donateBtnTextTV]}>Donate</Text>
        </Pressable>
      </View>
      
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.colors.background,
            borderBottomColor: 'transparent',
            borderBottomWidth: 0,
            height: isTV ? 70 : 50,
            elevation: 0,
            shadowOpacity: 0,
            paddingTop: 0,
          },
          tabBarLabelStyle: {
            fontSize: isTV ? 18 : 13,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: isTV ? 1 : 0.5,
          },
          tabBarItemStyle: {
            paddingTop: 0,
            paddingBottom: isTV ? 12 : 8,
            minWidth: isTV ? 150 : 80,
          },
          tabBarIndicatorStyle: {
            backgroundColor: theme.colors.primary,
            height: 3,
            borderRadius: 2,
          },
          tabBarPosition: 'top',
          headerShown: false,
          tabBarPressColor: 'transparent',
          tabBarScrollEnabled: true,
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
            title: 'VOD-P',
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
        <Tabs.Screen
          name="movie/[id]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="player"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="+html"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="+not-found"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="tv/[id]"
          options={{
            href: null,
          }}
        />
      </Tabs>
      
      {/* Donation Modal */}
      <DonationModal visible={showDonation} onClose={() => setShowDonation(false)} />
    </>
  );
}

const headerStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 12,
  },
  headerTV: {
    paddingHorizontal: 40,
    paddingTop: 30,
    paddingBottom: 20,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
    letterSpacing: 2,
  },
  appNameTV: {
    fontSize: 32,
    letterSpacing: 3,
  },
  donateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 221, 0, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFDD00',
    gap: 6,
  },
  donateBtnTV: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    gap: 10,
  },
  donateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFDD00',
  },
  donateBtnTextTV: {
    fontSize: 18,
  },
});
