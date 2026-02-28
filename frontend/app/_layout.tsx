import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useContentStore } from '../store/contentStore';
import { Platform, StatusBar } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

export default function TabLayout() {
  const loadAllAccounts = useAuthStore((state) => state.loadAllAccounts);
  const loadHomeContent = useContentStore((state) => state.loadHomeContent);
  const loadFavorites = useContentStore((state) => state.loadFavorites);

  useEffect(() => {
    // Load all data on app start
    loadAllAccounts();
    loadHomeContent();
    loadFavorites();
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
            borderBottomWidth: 1,
            height: 56,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '600',
            textTransform: 'uppercase',
          },
          tabBarItemStyle: {
            paddingTop: 8,
          },
          tabBarIndicatorStyle: {
            backgroundColor: theme.colors.primary,
            height: 3,
          },
          tabBarPosition: 'top',
          headerShown: false,
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
          name="search"
          options={{
            title: 'SEARCH',
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
      </Tabs>
    </>
  );
}
