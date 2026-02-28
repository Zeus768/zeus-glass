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
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tv-guide"
          options={{
            title: 'TV Guide',
            headerShown: true,
            headerTitle: 'TV Guide',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="tv" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="movies"
          options={{
            title: 'Movies',
            headerShown: true,
            headerTitle: 'Movies',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="film" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            headerShown: true,
            headerTitle: 'Search',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerShown: true,
            headerTitle: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
