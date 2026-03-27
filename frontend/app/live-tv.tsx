import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ActivityIndicator, 
  Dimensions,
  Alert,
  Linking,
  Platform,
  BackHandler,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, isTV } from '../constants/theme';
import { iptvService, IPTVCategory } from '../services/iptv';
import { IPTVChannel } from '../types';
import { contentFilterService } from '../services/contentFilterService';
import { PlayerChoice } from '../components/PlayerChoice';
import { IPTVPipPlayer } from '../components/IPTVPipPlayer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Grid sizing for channels
const NUM_COLUMNS = isTV ? 5 : 3;
const GRID_PADDING = isTV ? 24 : 12;
const ITEM_GAP = isTV ? 10 : 6;
const ITEM_WIDTH = (SCREEN_WIDTH - (GRID_PADDING * 2) - (ITEM_GAP * (NUM_COLUMNS - 1))) / NUM_COLUMNS;

// Grid sizing for categories
const CAT_COLUMNS = isTV ? 4 : 2;
const CAT_ITEM_WIDTH = (SCREEN_WIDTH - (GRID_PADDING * 2) - (ITEM_GAP * (CAT_COLUMNS - 1))) / CAT_COLUMNS;

export default function LiveTVScreen() {
  const router = useRouter();
  const [channels, setChannels] = useState<IPTVChannel[]>([]);
  const [categories, setCategories] = useState<IPTVCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState({ channels: 0, categories: 0, status: 'Connecting...' });
  const [focusedChannel, setFocusedChannel] = useState<string | null>(null);
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);
  const [playerChoiceVisible, setPlayerChoiceVisible] = useState(false);
  const [selectedStream, setSelectedStream] = useState<{ url: string; title: string } | null>(null);
  
  // PiP Player State
  const [pipStream, setPipStream] = useState<{ url: string; title: string; logo?: string } | null>(null);
  const [showPipPlayer, setShowPipPlayer] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Handle back button on TV
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedCategory !== null) {
        setSelectedCategory(null);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [selectedCategory]);

  const loadData = async () => {
    setLoading(true);
    setLoadProgress({ channels: 0, categories: 0, status: 'Connecting to IPTV server...' });
    
    try {
      const isLoggedIn = await iptvService.isLoggedIn();
      if (!isLoggedIn) {
        setLoadProgress({ channels: 0, categories: 0, status: 'Not logged in to IPTV' });
        setLoading(false);
        return;
      }

      setLoadProgress(prev => ({ ...prev, status: 'Loading categories...' }));
      const categoriesData = await iptvService.getLiveCategories();
      // Filter adult categories
      const filteredCategories = contentFilterService.filterCategories(categoriesData || []);
      setCategories(filteredCategories);
      setLoadProgress(prev => ({ ...prev, categories: filteredCategories?.length || 0, status: 'Loading channels...' }));
      
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

  // Count channels per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    channels.forEach(ch => {
      const catId = ch.category_id || '';
      counts[catId] = (counts[catId] || 0) + 1;
    });
    return counts;
  }, [channels]);

  // Filtered channels for selected category
  const filteredChannels = useMemo(() => {
    if (selectedCategory === null) return [];
    if (selectedCategory === 'all') return channels;
    return channels.filter(ch => ch.category_id === selectedCategory);
  }, [channels, selectedCategory]);

  const handleChannelPress = (channel: IPTVChannel, usePip: boolean = false) => {
    if (!channel.stream_url) {
      Alert.alert('Error', 'No stream URL available');
      return;
    }
    
    if (usePip) {
      // Start in PiP mode - keep browsing
      setPipStream({ url: channel.stream_url, title: channel.name, logo: channel.logo });
      setShowPipPlayer(true);
    } else {
      // Normal play - show player choice dialog
      setSelectedStream({ url: channel.stream_url, title: channel.name });
      setPlayerChoiceVisible(true);
    }
  };
  
  const handleClosePip = () => {
    setShowPipPlayer(false);
    setPipStream(null);
  };
  
  const handlePipFullscreen = () => {
    if (pipStream) {
      // Close PiP and go to full player
      setShowPipPlayer(false);
      setSelectedStream({ url: pipStream.url, title: pipStream.title });
      setPlayerChoiceVisible(true);
      setPipStream(null);
    }
  };

  const handleExternalPlayer = (channel: IPTVChannel) => {
    // Long-press goes directly to VLC
    if (!channel.stream_url) return;
    const vlcUrl = Platform.OS === 'android' 
      ? `vlc://${channel.stream_url}`
      : channel.stream_url;
    Linking.openURL(vlcUrl).catch(() => Alert.alert('Error', 'VLC not installed'));
  };

  // CATEGORY GRID VIEW
  const renderCategoryCard = useCallback(({ item }: { item: { category_id: string; category_name: string } }) => {
    const isFocused = focusedCategory === item.category_id;
    const count = item.category_id === 'all' ? channels.length : (categoryCounts[item.category_id] || 0);
    
    return (
      <Pressable
        onPress={() => setSelectedCategory(item.category_id)}
        onFocus={() => setFocusedCategory(item.category_id)}
        onBlur={() => setFocusedCategory(null)}
        style={[
          styles.categoryCard,
          isFocused && styles.categoryCardFocused,
        ]}
        data-testid={`category-${item.category_id}`}
      >
        <Ionicons 
          name={item.category_id === 'all' ? 'grid' : 'folder'} 
          size={isTV ? 32 : 24} 
          color={isFocused ? '#000' : theme.colors.primary} 
        />
        <Text style={[styles.categoryCardName, isFocused && styles.categoryCardNameFocused]} numberOfLines={2}>
          {item.category_name}
        </Text>
        <Text style={[styles.categoryCardCount, isFocused && styles.categoryCardCountFocused]}>
          {count} channels
        </Text>
      </Pressable>
    );
  }, [focusedCategory, channels.length, categoryCounts]);

  // CHANNEL GRID VIEW
  const renderChannel = useCallback(({ item }: { item: IPTVChannel }) => {
    const isFocused = focusedChannel === item.id;
    
    return (
      <Pressable
        onPress={() => handleChannelPress(item, false)}
        onLongPress={() => handleChannelPress(item, true)} // Long press = PiP mode
        onFocus={() => setFocusedChannel(item.id)}
        onBlur={() => setFocusedChannel(null)}
        style={[
          styles.channelCard,
          isFocused && styles.channelCardFocused,
        ]}
        data-testid={`channel-${item.id}`}
      >
        {(item.stream_icon || item.logo) ? (
          <Image
            source={{ uri: item.stream_icon || item.logo }}
            style={styles.channelLogo}
            contentFit="contain"
          />
        ) : (
          <View style={styles.channelLogoPlaceholder}>
            <Ionicons name="tv" size={isTV ? 36 : 24} color={theme.colors.textMuted} />
          </View>
        )}
        <Text style={[styles.channelName, isFocused && styles.channelNameFocused]} numberOfLines={2}>
          {item.name}
        </Text>
        {isFocused && (
          <View style={styles.playOverlay}>
            <View style={styles.overlayButtons}>
              <Ionicons name="play-circle" size={isTV ? 22 : 18} color="#FFF" />
              <View style={styles.pipHint}>
                <Ionicons name="albums-outline" size={isTV ? 12 : 10} color="#FFF" />
                <Text style={styles.pipHintText}>Hold</Text>
              </View>
            </View>
          </View>
        )}
      </Pressable>
    );
  }, [focusedChannel]);

  // LOADING STATE
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

  // EMPTY STATE
  if (channels.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="tv-outline" size={80} color={theme.colors.textMuted} />
        <Text style={styles.emptyTitle}>No Channels</Text>
        <Text style={styles.emptyText}>Please log in to your IPTV service in Settings</Text>
        <Pressable style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <Text style={styles.settingsButtonText}>Go to Settings</Text>
        </Pressable>
      </View>
    );
  }

  // FULLSCREEN CHANNEL VIEW (when category is selected)
  if (selectedCategory !== null) {
    const categoryName = selectedCategory === 'all' 
      ? 'All Channels' 
      : categories.find(c => c.category_id === selectedCategory)?.category_name || 'Category';
    
    return (
      <View style={styles.container} data-testid="live-tv-channels">
        {/* Header bar */}
        <View style={styles.channelHeader}>
          <Pressable 
            onPress={() => setSelectedCategory(null)} 
            style={styles.backButton}
            data-testid="back-to-categories"
          >
            <Ionicons name="arrow-back" size={isTV ? 28 : 22} color={theme.colors.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.channelHeaderTitle}>{categoryName}</Text>
          <Text style={styles.channelCount}>{filteredChannels.length} channels</Text>
        </View>

        {/* Hint */}
        <Text style={styles.hintText}>Long-press a channel for external player</Text>

        {/* Full screen channel grid */}
        <FlashList
          data={filteredChannels}
          renderItem={renderChannel}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.channelsGrid}
          showsVerticalScrollIndicator={false}
          estimatedItemSize={isTV ? 120 : 100}
        />
        
        {selectedStream && (
          <PlayerChoice
            visible={playerChoiceVisible}
            onClose={() => setPlayerChoiceVisible(false)}
            streamUrl={selectedStream.url}
            title={selectedStream.title}
            type="live"
          />
        )}
      </View>
    );
  }

  // CATEGORIES GRID VIEW (main view)
  const allCategories = [
    { category_id: 'all', category_name: 'All Channels' },
    ...categories,
  ];

  return (
    <View style={styles.container} data-testid="live-tv-categories">
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Live TV</Text>
        <Text style={styles.headerSubtitle}>{channels.length} channels in {categories.length} categories</Text>
      </View>

      <FlashList
        data={allCategories}
        renderItem={renderCategoryCard}
        keyExtractor={(item) => item.category_id}
        numColumns={CAT_COLUMNS}
        contentContainerStyle={styles.categoriesGrid}
        showsVerticalScrollIndicator={false}
        estimatedItemSize={isTV ? 160 : 120}
      />
      
      {selectedStream && (
        <PlayerChoice
          visible={playerChoiceVisible}
          onClose={() => setPlayerChoiceVisible(false)}
          streamUrl={selectedStream.url}
          title={selectedStream.title}
          type="live"
        />
      )}
      
      {/* PiP Player - Watch while browsing */}
      {pipStream && (
        <IPTVPipPlayer
          url={pipStream.url}
          title={pipStream.title}
          channelLogo={pipStream.logo}
          visible={showPipPlayer}
          onClose={handleClosePip}
          onEnterFullscreen={handlePipFullscreen}
        />
      )}
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
    fontSize: isTV ? 18 : 16,
  },
  progressBox: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.lg,
    minWidth: 250,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  progressText: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 32,
  },
  emptyTitle: {
    fontSize: isTV ? 28 : 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: isTV ? 18 : 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  settingsButton: {
    marginTop: 24,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  settingsButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: isTV ? 18 : 16,
  },

  // Header
  headerBar: {
    paddingHorizontal: GRID_PADDING,
    paddingVertical: isTV ? 16 : 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: isTV ? 28 : 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: isTV ? 16 : 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  // Categories Grid
  categoriesGrid: {
    padding: GRID_PADDING,
    gap: ITEM_GAP,
  },
  categoryCard: {
    width: CAT_ITEM_WIDTH,
    backgroundColor: theme.colors.surface,
    borderRadius: isTV ? 16 : 12,
    padding: isTV ? 20 : 14,
    margin: ITEM_GAP / 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: isTV ? 120 : 90,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryCardFocused: {
    backgroundColor: theme.colors.primary,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
  },
  categoryCardName: {
    fontSize: isTV ? 16 : 13,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  categoryCardNameFocused: {
    color: '#000',
  },
  categoryCardCount: {
    fontSize: isTV ? 13 : 11,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  categoryCardCountFocused: {
    color: 'rgba(0,0,0,0.6)',
  },

  // Channel View Header
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GRID_PADDING,
    paddingVertical: isTV ? 12 : 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    fontSize: isTV ? 18 : 14,
    color: theme.colors.text,
    fontWeight: '600',
  },
  channelHeaderTitle: {
    flex: 1,
    fontSize: isTV ? 22 : 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  channelCount: {
    fontSize: isTV ? 15 : 13,
    color: theme.colors.textSecondary,
  },
  hintText: {
    fontSize: isTV ? 13 : 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 4,
  },

  // Channels Grid
  channelsGrid: {
    padding: GRID_PADDING,
  },
  channelCard: {
    width: ITEM_WIDTH,
    margin: ITEM_GAP / 2,
    backgroundColor: theme.colors.surface,
    borderRadius: isTV ? 12 : 8,
    padding: isTV ? 12 : 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: isTV ? 100 : 80,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  channelCardFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceLight,
    transform: [{ scale: isTV ? 1.08 : 1.04 }],
  },
  channelLogo: {
    width: isTV ? 70 : 48,
    height: isTV ? 44 : 32,
    marginBottom: 4,
  },
  channelLogoPlaceholder: {
    width: isTV ? 70 : 48,
    height: isTV ? 44 : 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 4,
    marginBottom: 4,
  },
  channelName: {
    fontSize: isTV ? 13 : 11,
    color: theme.colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  channelNameFocused: {
    color: theme.colors.primary,
  },
  playOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  overlayButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  pipHintText: {
    fontSize: isTV ? 10 : 8,
    color: '#FFF',
    fontWeight: '500',
  },
});
