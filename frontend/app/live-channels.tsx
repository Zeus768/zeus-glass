import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, isTV } from '../constants/theme';
import { iptvService } from '../services/iptv';
import { IPTVChannel } from '../types';

export default function LiveChannelsScreen() {
  const router = useRouter();
  const [channels, setChannels] = useState<IPTVChannel[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [focusedChannel, setFocusedChannel] = useState<string | null>(null);
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const [channelData, categoryData] = await Promise.all([
        iptvService.getLiveChannels(),
        iptvService.getLiveCategories(),
      ]);
      
      setChannels(channelData || []);
      setCategories([{ id: 'all', name: 'All Channels' }, ...(categoryData || [])]);
    } catch (error) {
      console.error('Error loading channels:', error);
      setChannels([]);
      setCategories([{ id: 'all', name: 'All Channels' }]);
    } finally {
      setLoading(false);
    }
  };

  const filteredChannels = selectedCategory === 'all' 
    ? channels 
    : channels.filter(ch => ch.category_id === selectedCategory);

  const playChannel = (channel: IPTVChannel) => {
    router.push({
      pathname: '/player',
      params: { 
        url: channel.stream_url, 
        title: channel.name,
        type: 'video'
      },
    });
  };

  const renderCategory = ({ item }: { item: { id: string; name: string } }) => {
    const isFocused = focusedCategory === item.id;
    const isSelected = selectedCategory === item.id;
    const channelCount = item.id === 'all' 
      ? channels.length 
      : channels.filter(ch => ch.category_id === item.id).length;

    return (
      <Pressable
        style={[
          styles.categoryCard,
          isSelected && styles.categoryCardSelected,
          isFocused && styles.categoryCardFocused,
        ]}
        onPress={() => setSelectedCategory(item.id)}
        onFocus={() => setFocusedCategory(item.id)}
        onBlur={() => setFocusedCategory(null)}
      >
        <View style={styles.categoryIcon}>
          <Ionicons 
            name={item.id === 'all' ? 'grid' : 'folder'} 
            size={isTV ? 28 : 22} 
            color={isSelected ? '#000' : theme.colors.primary} 
          />
        </View>
        <Text style={[
          styles.categoryName,
          isSelected && styles.categoryNameSelected,
        ]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[
          styles.categoryCount,
          isSelected && styles.categoryCountSelected,
        ]}>
          {channelCount} channels
        </Text>
      </Pressable>
    );
  };

  const renderChannel = ({ item }: { item: IPTVChannel }) => {
    const isFocused = focusedChannel === item.id;

    return (
      <Pressable
        style={[
          styles.channelCard,
          isFocused && styles.channelCardFocused,
        ]}
        onPress={() => playChannel(item)}
        onFocus={() => setFocusedChannel(item.id)}
        onBlur={() => setFocusedChannel(null)}
        data-testid={`channel-${item.id}`}
      >
        <View style={styles.channelLogo}>
          {item.logo ? (
            <Image
              source={{ uri: item.logo }}
              style={styles.logo}
              contentFit="contain"
            />
          ) : (
            <Ionicons name="tv" size={isTV ? 36 : 28} color={theme.colors.textMuted} />
          )}
        </View>
        <View style={styles.channelInfo}>
          <Text style={styles.channelName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.epg_now && (
            <Text style={styles.channelNowPlaying} numberOfLines={1}>
              Now: {item.epg_now}
            </Text>
          )}
        </View>
        {isFocused && (
          <View style={styles.playIcon}>
            <Ionicons name="play-circle" size={isTV ? 40 : 32} color={theme.colors.primary} />
          </View>
        )}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading Live TV Channels...</Text>
      </View>
    );
  }

  if (channels.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="tv-outline" size={80} color={theme.colors.textMuted} />
        <Text style={styles.emptyTitle}>No Channels Available</Text>
        <Text style={styles.emptySubtext}>
          Please configure your IPTV account in Settings to access Live TV channels.
        </Text>
        <Pressable
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="settings" size={20} color="#000" />
          <Text style={styles.settingsButtonText}>Go to Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>Live TV Channels</Text>
        </View>
        <Text style={styles.channelCount}>{channels.length} channels</Text>
      </View>

      {/* Categories Section */}
      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      {/* Channels Grid */}
      <View style={styles.channelsSection}>
        <Text style={styles.sectionTitle}>
          {selectedCategory === 'all' ? 'All Channels' : categories.find(c => c.id === selectedCategory)?.name || 'Channels'}
          {' '}({filteredChannels.length})
        </Text>
        <FlatList
          data={filteredChannels}
          renderItem={renderChannel}
          keyExtractor={(item) => item.id}
          numColumns={isTV ? 4 : 2}
          contentContainerStyle={styles.channelsGrid}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyCategory}>
              <Ionicons name="tv-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyCategoryText}>No channels in this category</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: isTV ? 28 : 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: isTV ? 18 : 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    maxWidth: 400,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: isTV ? 16 : 12,
    paddingHorizontal: isTV ? 32 : 24,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  settingsButtonText: {
    fontSize: isTV ? 18 : 16,
    fontWeight: 'bold',
    color: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTV ? 40 : 16,
    paddingTop: isTV ? 20 : 50,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: isTV ? 32 : 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  channelCount: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textSecondary,
  },
  categoriesSection: {
    paddingHorizontal: isTV ? 40 : 16,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: isTV ? 20 : 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  categoriesList: {
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  categoryCard: {
    backgroundColor: theme.colors.card,
    borderRadius: isTV ? 16 : 12,
    padding: isTV ? 20 : 16,
    marginRight: theme.spacing.md,
    minWidth: isTV ? 160 : 120,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryCardSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryCardFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 20,
  },
  categoryIcon: {
    marginBottom: theme.spacing.sm,
  },
  categoryName: {
    fontSize: isTV ? 16 : 14,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryNameSelected: {
    color: '#000',
  },
  categoryCount: {
    fontSize: isTV ? 12 : 11,
    color: theme.colors.textSecondary,
  },
  categoryCountSelected: {
    color: 'rgba(0,0,0,0.7)',
  },
  channelsSection: {
    flex: 1,
    paddingHorizontal: isTV ? 40 : 16,
  },
  channelsGrid: {
    paddingBottom: 100,
  },
  channelCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: isTV ? 14 : 10,
    padding: isTV ? 16 : 12,
    margin: isTV ? 8 : 6,
    maxWidth: isTV ? '24%' : '48%',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  channelCardFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    transform: [{ scale: 1.02 }],
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  channelLogo: {
    width: isTV ? 60 : 48,
    height: isTV ? 60 : 48,
    borderRadius: isTV ? 10 : 8,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: isTV ? 16 : 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  channelNowPlaying: {
    fontSize: isTV ? 12 : 11,
    color: theme.colors.primary,
  },
  playIcon: {
    marginLeft: theme.spacing.sm,
  },
  emptyCategory: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyCategoryText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
  },
});
