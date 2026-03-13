import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable, 
  ActivityIndicator, 
  FlatList,
  Dimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, isTV } from '../constants/theme';
import { iptvService, IPTVChannel, IPTVCategory } from '../services/iptv';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = isTV ? 6 : 3;
const ITEM_MARGIN = isTV ? 12 : 8;
const ITEM_WIDTH = (SCREEN_WIDTH - (isTV ? 100 : 24) - (ITEM_MARGIN * (NUM_COLUMNS + 1))) / NUM_COLUMNS;

export default function LiveTVScreen() {
  const router = useRouter();
  const [channels, setChannels] = useState<IPTVChannel[]>([]);
  const [categories, setCategories] = useState<IPTVCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState({ channels: 0, categories: 0, status: 'Connecting...' });
  const [focusedChannel, setFocusedChannel] = useState<string | null>(null);
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadProgress({ channels: 0, categories: 0, status: 'Connecting to IPTV server...' });
    
    try {
      // Check if logged in
      const isLoggedIn = await iptvService.isLoggedIn();
      if (!isLoggedIn) {
        setLoadProgress({ channels: 0, categories: 0, status: 'Not logged in to IPTV' });
        setLoading(false);
        return;
      }

      setLoadProgress(prev => ({ ...prev, status: 'Loading categories...' }));
      
      // Load categories first
      const categoriesData = await iptvService.getLiveCategories();
      setCategories(categoriesData || []);
      setLoadProgress(prev => ({ ...prev, categories: categoriesData?.length || 0, status: 'Loading channels...' }));
      
      // Load all channels
      const channelsData = await iptvService.getLiveChannels();
      setChannels(channelsData || []);
      setLoadProgress(prev => ({ 
        ...prev, 
        channels: channelsData?.length || 0, 
        status: 'Ready!' 
      }));
    } catch (error) {
      console.error('Error loading IPTV data:', error);
      setLoadProgress(prev => ({ ...prev, status: 'Error loading data' }));
    } finally {
      setLoading(false);
    }
  };

  const filteredChannels = selectedCategory === 'all' 
    ? channels 
    : channels.filter(ch => ch.category_id === selectedCategory);

  const handleChannelPress = (channel: IPTVChannel) => {
    if (channel.stream_url) {
      router.push({
        pathname: '/player',
        params: { 
          url: channel.stream_url, 
          title: channel.name,
          type: 'live'
        }
      });
    } else {
      Alert.alert('Error', 'No stream URL available for this channel');
    }
  };

  const renderCategory = useCallback(({ item }: { item: IPTVCategory | { category_id: string; category_name: string } }) => {
    const isSelected = selectedCategory === item.category_id;
    const isFocused = focusedCategory === item.category_id;
    
    return (
      <Pressable
        onPress={() => setSelectedCategory(item.category_id)}
        onFocus={() => setFocusedCategory(item.category_id)}
        onBlur={() => setFocusedCategory(null)}
        style={[
          styles.categoryButton,
          isSelected && styles.categoryButtonActive,
          isFocused && styles.categoryButtonFocused,
        ]}
      >
        <Text style={[
          styles.categoryText,
          isSelected && styles.categoryTextActive,
          isFocused && styles.categoryTextFocused,
        ]} numberOfLines={1}>
          {item.category_name}
        </Text>
      </Pressable>
    );
  }, [selectedCategory, focusedCategory]);

  const renderChannel = useCallback(({ item }: { item: IPTVChannel }) => {
    const isFocused = focusedChannel === item.id;
    
    return (
      <Pressable
        onPress={() => handleChannelPress(item)}
        onFocus={() => setFocusedChannel(item.id)}
        onBlur={() => setFocusedChannel(null)}
        style={[
          styles.channelCard,
          isFocused && styles.channelCardFocused,
        ]}
        data-testid={`channel-${item.id}`}
      >
        {item.stream_icon ? (
          <Image
            source={{ uri: item.stream_icon }}
            style={styles.channelLogo}
            contentFit="contain"
          />
        ) : (
          <View style={styles.channelLogoPlaceholder}>
            <Ionicons name="tv" size={isTV ? 40 : 30} color={theme.colors.textMuted} />
          </View>
        )}
        <Text style={styles.channelName} numberOfLines={2}>{item.name}</Text>
        {item.epg_channel_id && (
          <View style={styles.epgBadge}>
            <Text style={styles.epgBadgeText}>EPG</Text>
          </View>
        )}
      </Pressable>
    );
  }, [focusedChannel, router]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{loadProgress.status}</Text>
        <View style={styles.progressBox}>
          <View style={styles.progressRow}>
            <Ionicons 
              name={loadProgress.categories > 0 ? "checkmark-circle" : "radio-button-on"} 
              size={18} 
              color={loadProgress.categories > 0 ? theme.colors.success : theme.colors.primary} 
            />
            <Text style={styles.progressText}>
              Categories: {loadProgress.categories > 0 ? `${loadProgress.categories} loaded` : 'Loading...'}
            </Text>
          </View>
          <View style={styles.progressRow}>
            <Ionicons 
              name={loadProgress.channels > 0 ? "checkmark-circle" : "radio-button-on"} 
              size={18} 
              color={loadProgress.channels > 0 ? theme.colors.success : theme.colors.textMuted} 
            />
            <Text style={styles.progressText}>
              Channels: {loadProgress.channels > 0 ? `${loadProgress.channels} loaded` : 'Waiting...'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (channels.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="tv-outline" size={80} color={theme.colors.textMuted} />
        <Text style={styles.emptyTitle}>No Channels</Text>
        <Text style={styles.emptyText}>
          {iptvService.isLoggedIn() ? 'No live channels found in your IPTV service' : 'Please log in to your IPTV service in Settings'}
        </Text>
        <Pressable style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <Text style={styles.settingsButtonText}>Go to Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} data-testid="live-tv-screen">
      {/* Category Selector */}
      <View style={styles.categoriesContainer}>
        <FlatList
          data={[{ category_id: 'all', category_name: 'All Channels' }, ...categories]}
          renderItem={renderCategory}
          keyExtractor={(item) => item.category_id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        />
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {filteredChannels.length} channels
          {selectedCategory !== 'all' && ` in ${categories.find(c => c.category_id === selectedCategory)?.category_name || 'category'}`}
        </Text>
      </View>

      {/* Channels Grid */}
      <FlatList
        data={filteredChannels}
        renderItem={renderChannel}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.channelsGrid}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={5}
      />
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
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  progressBox: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    minWidth: 250,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  progressText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  settingsButton: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
  },
  settingsButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: theme.fontSize.md,
  },
  categoriesContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoriesContent: {
    paddingHorizontal: isTV ? 50 : 16,
    paddingVertical: isTV ? 12 : 10,
    gap: isTV ? 10 : 8,
  },
  categoryButton: {
    paddingHorizontal: isTV ? 20 : 16,
    paddingVertical: isTV ? 10 : 8,
    borderRadius: isTV ? 20 : 16,
    backgroundColor: theme.colors.surface,
    marginRight: isTV ? 10 : 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  categoryButtonFocused: {
    borderColor: theme.colors.focus,
    transform: [{ scale: 1.05 }],
  },
  categoryText: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  categoryTextFocused: {
    color: theme.colors.primary,
  },
  statsBar: {
    paddingHorizontal: isTV ? 50 : 16,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  statsText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  channelsGrid: {
    paddingHorizontal: isTV ? 50 : 12,
    paddingVertical: theme.spacing.md,
  },
  channelCard: {
    width: ITEM_WIDTH,
    margin: ITEM_MARGIN / 2,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  channelCardFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceLight,
    transform: [{ scale: isTV ? 1.08 : 1.03 }],
  },
  channelLogo: {
    width: isTV ? 80 : 60,
    height: isTV ? 50 : 40,
    marginBottom: theme.spacing.sm,
  },
  channelLogoPlaceholder: {
    width: isTV ? 80 : 60,
    height: isTV ? 50 : 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
  },
  channelName: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  epgBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: theme.colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  epgBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#000',
  },
});
