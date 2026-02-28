import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useContentStore } from '../store/contentStore';
import { Platform, StatusBar, View, Text, Pressable, Modal, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';

// Donation Modal Component
function DonationModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const handleDonate = () => {
    Linking.openURL('https://buymeacoffee.com/zeus768?new=1');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={donationStyles.overlay}>
        <View style={donationStyles.modal}>
          <Pressable style={donationStyles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
          
          <View style={donationStyles.coffeeIcon}>
            <Text style={donationStyles.coffeeEmoji}>☕</Text>
          </View>
          
          <Text style={donationStyles.title}>Support Zeus Glass</Text>
          <Text style={donationStyles.subtitle}>
            If you enjoy the app, consider buying me a coffee!
          </Text>
          
          {/* QR Code */}
          <View style={donationStyles.qrContainer}>
            <Image 
              source={{ uri: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://buymeacoffee.com/zeus768' }}
              style={donationStyles.qrCode}
              contentFit="contain"
            />
            <Text style={donationStyles.qrText}>Scan to donate</Text>
          </View>
          
          <Pressable style={donationStyles.donateButton} onPress={handleDonate}>
            <Ionicons name="heart" size={20} color="#000" />
            <Text style={donationStyles.donateButtonText}>Buy Me a Coffee</Text>
          </Pressable>
          
          <Text style={donationStyles.thankYou}>Thank you for your support! 💛</Text>
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
    width: '85%',
    maxWidth: 340,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.gold,
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
  coffeeEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  qrCode: {
    width: 150,
    height: 150,
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
    // Load all data on app start
    loadAllAccounts();
    loadHomeContent();
    loadFavorites();
  }, []);

  // Check if IPTV is enabled and active
  const showVODTab = iptvConfig && iptvConfig.enabled;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {/* Header with App Name and Donation Button */}
      <View style={headerStyles.header}>
        <Text style={headerStyles.appName}>ZEUS GLASS</Text>
        <Pressable style={headerStyles.donateBtn} onPress={() => setShowDonation(true)}>
          <Ionicons name="heart" size={16} color="#FFDD00" />
          <Text style={headerStyles.donateBtnText}>Donate</Text>
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
            height: 50,
            elevation: 0,
            shadowOpacity: 0,
            paddingTop: 0,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          },
          tabBarItemStyle: {
            paddingTop: 0,
            paddingBottom: 8,
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
          name="tv-guide"
          options={{
            title: 'TV GUIDE',
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
        {showVODTab && (
          <Tabs.Screen
            name="vod"
            options={{
              title: 'VOD',
              tabBarIcon: () => null,
            }}
          />
        )}
        <Tabs.Screen
          name="search"
          options={{
            title: 'SEARCH',
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
          name="settings"
          options={{
            title: 'SETTINGS',
            tabBarIcon: () => null,
          }}
        />
        <Tabs.Screen
          name="player"
          options={{
            href: null, // Hide from tabs
          }}
        />
        <Tabs.Screen
          name="movie/[id]"
          options={{
            href: null, // Hide from tabs
          }}
        />
        <Tabs.Screen
          name="tv/[id]"
          options={{
            href: null, // Hide from tabs
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
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
    letterSpacing: 2,
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
  donateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFDD00',
  },
});
