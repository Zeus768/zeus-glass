import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import { providersService, STREAMING_PROVIDERS, ProviderKey, ProviderContent } from '../services/providersService';
import { tmdbService } from '../services/tmdb';

const { width } = Dimensions.get('window');
const CARD_WIDTH = isTV ? 200 : 140;
const CARD_HEIGHT = isTV ? 300 : 210;

export default function ProvidersScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: 'movie' | 'tv' }>();
  
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>(type === 'tv' ? 'tv' : 'movie');
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey | null>(null);
  const [content, setContent] = useState<ProviderContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const [focusedProvider, setFocusedProvider] = useState<string | null>(null);

  const providers = Object.keys(STREAMING_PROVIDERS) as ProviderKey[];

  // Auto-select first provider on mount
  useEffect(() => {
    if (providers.length > 0 && !selectedProvider) {
      setSelectedProvider(providers[0]);
    }
  }, []);

  const loadContent = useCallback(async (provider: ProviderKey, pageNum: number = 1, append: boolean = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const data = mediaType === 'movie'
        ? await providersService.discoverMoviesByProvider(provider, pageNum)
        : await providersService.discoverTVByProvider(provider, pageNum);
      
      if (append) {
        setContent(prev => [...prev, ...data.results]);
      } else {
        setContent(data.results);
      }
      setHasMore(pageNum < data.total_pages);
    } catch (error) {
      console.error('Error loading provider content:', error);
    } finally {
      setLoading(false);
    }
  }, [mediaType, loading]);

  useEffect(() => {
    if (selectedProvider) {
      setPage(1);
      loadContent(selectedProvider, 1, false);
    }
  }, [selectedProvider, mediaType]);

  const handleProviderSelect = (provider: ProviderKey) => {
    setSelectedProvider(provider);
    setContent([]);
    setPage(1);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore && selectedProvider) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadContent(selectedProvider, nextPage, true);
    }
  };

  const handleItemPress = (item: ProviderContent) => {
    if (item.media_type === 'movie') {
      router.push(`/movie/${item.id}`);
    } else {
      router.push(`/tv/${item.id}`);
    }
  };

  const renderProviderChip = (provider: ProviderKey) => {
    const providerData = STREAMING_PROVIDERS[provider];
    const isSelected = selectedProvider === provider;
    const isFocused = focusedProvider === provider;

    return (
      <Pressable
        key={provider}
        style={[
          styles.providerChip,
          isSelected && styles.providerChipSelected,
          isFocused && styles.providerChipFocused,
        ]}
        onPress={() => handleProviderSelect(provider)}
        onFocus={() => setFocusedProvider(provider)}
        onBlur={() => setFocusedProvider(null)}
      >
        <Image
          source={{ uri: providersService.getProviderLogo(provider) }}
          style={styles.providerLogo}
          contentFit="contain"
        />
        <Text style={[
          styles.providerName,
          isSelected && styles.providerNameSelected,
        ]} numberOfLines={1}>
          {providerData.name}
        </Text>
      </Pressable>
    );
  };

  const renderContentItem = ({ item }: { item: ProviderContent }) => {
    const posterUrl = item.poster_path
      ? tmdbService.getImageUrl(item.poster_path, 'w342')
      : null;
    const displayTitle = item.title || item.name || 'Unknown';
    const year = (item.release_date || item.first_air_date)?.split('-')[0];
    const key = `${item.media_type}-${item.id}`;
    const isFocused = focusedItem === key;

    return (
      <Pressable
        style={[styles.contentCard, isFocused && styles.contentCardFocused]}
        onPress={() => handleItemPress(item)}
        onFocus={() => setFocusedItem(key)}
        onBlur={() => setFocusedItem(null)}
      >
        <View style={styles.posterContainer}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
          ) : (
            <View style={[styles.poster, styles.placeholderPoster]}>
              <Ionicons name="film-outline" size={40} color={theme.colors.textMuted} />
            </View>
          )}
          {item.vote_average > 0 && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color="#FFD700" />
              <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.contentTitle} numberOfLines={2}>{displayTitle}</Text>
        {year && <Text style={styles.contentYear}>{year}</Text>}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>Providers</Text>
        </View>
        
        {/* Media Type Toggle */}
        <View style={styles.mediaTypeToggle}>
          <Pressable
            style={[styles.toggleButton, mediaType === 'movie' && styles.toggleButtonActive]}
            onPress={() => setMediaType('movie')}
          >
            <Ionicons name="film" size={16} color={mediaType === 'movie' ? '#000' : theme.colors.text} />
            <Text style={[styles.toggleText, mediaType === 'movie' && styles.toggleTextActive]}>Movies</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, mediaType === 'tv' && styles.toggleButtonActive]}
            onPress={() => setMediaType('tv')}
          >
            <Ionicons name="tv" size={16} color={mediaType === 'tv' ? '#000' : theme.colors.text} />
            <Text style={[styles.toggleText, mediaType === 'tv' && styles.toggleTextActive]}>TV Shows</Text>
          </Pressable>
        </View>
      </View>

      {/* Provider Selection */}
      <View style={styles.providersSection}>
        <Text style={styles.sectionTitle}>Select Streaming Service</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.providersScroll}
        >
          {providers.map(renderProviderChip)}
        </ScrollView>
      </View>

      {/* Content Grid */}
      {selectedProvider ? (
        <View style={styles.contentContainer}>
          <View style={styles.contentHeader}>
            <Text style={styles.contentHeaderTitle}>
              {STREAMING_PROVIDERS[selectedProvider].name} {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
            </Text>
            <Text style={styles.contentCount}>{content.length} titles</Text>
          </View>
          
          {content.length > 0 ? (
            <FlashList
              data={content}
              renderItem={renderContentItem}
              estimatedItemSize={CARD_HEIGHT + 60}
              numColumns={isTV ? 6 : 3}
              keyExtractor={(item) => `${item.media_type}-${item.id}`}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              contentContainerStyle={styles.gridContent}
              ListFooterComponent={
                loading && hasMore ? (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Loading more...</Text>
                  </View>
                ) : null
              }
            />
          ) : loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading {STREAMING_PROVIDERS[selectedProvider].name} content...</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="apps-outline" size={64} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>Select a streaming service above</Text>
          <Text style={styles.emptySubtext}>Browse content available on Netflix, Disney+, and more</Text>
        </View>
      )}
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
  mediaTypeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 4,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTV ? 20 : 16,
    paddingVertical: isTV ? 10 : 8,
    borderRadius: 16,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleText: {
    color: theme.colors.text,
    fontSize: isTV ? 16 : 14,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  providersSection: {
    paddingHorizontal: isTV ? 40 : 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: isTV ? 18 : 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  providersScroll: {
    gap: 12,
    paddingRight: 40,
  },
  providerChip: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: isTV ? 16 : 12,
    width: isTV ? 120 : 90,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  providerChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
  },
  providerChipFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
    shadowColor: '#00D9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 20,
  },
  providerLogo: {
    width: isTV ? 50 : 40,
    height: isTV ? 50 : 40,
    borderRadius: 10,
    marginBottom: 8,
  },
  providerName: {
    fontSize: isTV ? 13 : 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  providerNameSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: isTV ? 40 : 16,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  contentHeaderTitle: {
    fontSize: isTV ? 22 : 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  contentCount: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textSecondary,
  },
  gridContent: {
    paddingBottom: 100,
  },
  contentCard: {
    flex: 1,
    margin: isTV ? 8 : 6,
    maxWidth: CARD_WIDTH + 20,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 12,
    overflow: 'hidden',
  },
  contentCardFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
    shadowColor: '#00D9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 30,
  },
  posterContainer: {
    position: 'relative',
  },
  poster: {
    width: '100%',
    aspectRatio: 2/3,
    borderRadius: 10,
  },
  placeholderPoster: {
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
  },
  contentTitle: {
    fontSize: isTV ? 14 : 12,
    fontWeight: '500',
    color: theme.colors.text,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  contentYear: {
    fontSize: isTV ? 12 : 10,
    color: theme.colors.textMuted,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.textSecondary,
    marginTop: 12,
    fontSize: isTV ? 16 : 14,
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: isTV ? 20 : 18,
    fontWeight: '500',
    color: theme.colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});
