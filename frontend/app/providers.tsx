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
const CARD_WIDTH = isTV ? 130 : 140;
const CARD_HEIGHT = isTV ? 195 : 210;
const PROVIDER_LOGO_SIZE = isTV ? 56 : 48;

// Provider brand colors
const PROVIDER_COLORS: Record<string, string> = {
  netflix: '#E50914',
  disney: '#113CCF',
  prime: '#00A8E1',
  hulu: '#1CE783',
  hbo: '#B026FF',
  apple: '#000000',
  paramount: '#0064FF',
  peacock: '#000000',
  showtime: '#B6002B',
  starz: '#C48A00',
  crunchyroll: '#F47521',
  mubi: '#00C7AE',
  curiositystream: '#1F5B9D',
  britbox: '#FC1D89',
  stan: '#00AEEF',
  now: '#2BD665',
  skygo: '#0072C6',
  tubi: '#FA382F',
  pluto: '#242422',
  freevee: '#97FF05',
  plex: '#EBAF00',
};

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
  const [selectedSort, setSelectedSort] = useState<'popularity' | 'rating' | 'newest'>('popularity');

  const providers = Object.keys(STREAMING_PROVIDERS) as ProviderKey[];

  // Load content for selected provider with pagination
  const loadProviderContent = useCallback(async (provider: ProviderKey, pageNum: number = 1, append: boolean = false) => {
    if (loading && append) return;
    
    setLoading(true);
    try {
      let sortBy = 'popularity.desc';
      if (selectedSort === 'rating') sortBy = 'vote_average.desc';
      if (selectedSort === 'newest') sortBy = mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
      
      const result = mediaType === 'movie'
        ? await providersService.discoverMoviesByProvider(provider, pageNum, sortBy)
        : await providersService.discoverTVByProvider(provider, pageNum, sortBy);
      
      const items = result.results || [];
      
      if (append) {
        setContent(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newItems = items.filter((item: ProviderContent) => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      } else {
        setContent(items);
      }
      
      setHasMore(items.length >= 20);
    } catch (error) {
      console.error('Error loading provider content:', error);
    } finally {
      setLoading(false);
    }
  }, [mediaType, selectedSort, loading]);

  // When provider, media type, or sort changes, reload
  useEffect(() => {
    if (selectedProvider) {
      setPage(1);
      setContent([]);
      loadProviderContent(selectedProvider, 1, false);
    }
  }, [selectedProvider, mediaType, selectedSort]);

  const handleLoadMore = () => {
    if (!loading && hasMore && selectedProvider) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadProviderContent(selectedProvider, nextPage, true);
    }
  };

  const handleProviderSelect = (provider: ProviderKey) => {
    setSelectedProvider(provider);
    setPage(1);
    setContent([]);
  };

  const handleItemPress = (item: ProviderContent) => {
    if (mediaType === 'movie') {
      router.push(`/movie/${item.id}`);
    } else {
      router.push(`/tv/${item.id}`);
    }
  };

  const renderProviderCard = (providerKey: ProviderKey) => {
    const provider = STREAMING_PROVIDERS[providerKey];
    const logoUrl = providersService.getProviderLogo(providerKey);
    const isSelected = selectedProvider === providerKey;
    const isFocused = focusedProvider === providerKey;
    const brandColor = PROVIDER_COLORS[providerKey] || theme.colors.primary;

    return (
      <Pressable
        key={providerKey}
        style={[
          styles.providerCard,
          isSelected && { borderColor: brandColor, backgroundColor: `${brandColor}22` },
          isFocused && styles.providerCardFocused,
        ]}
        onPress={() => handleProviderSelect(providerKey)}
        onFocus={() => setFocusedProvider(providerKey)}
        onBlur={() => setFocusedProvider(null)}
        data-testid={`provider-${providerKey}`}
      >
        <Image
          source={{ uri: logoUrl }}
          style={styles.providerLogo}
          contentFit="contain"
        />
        <Text style={[
          styles.providerName,
          isSelected && { color: '#fff', fontWeight: '700' },
        ]} numberOfLines={1}>
          {provider.name}
        </Text>
        {isSelected && (
          <View style={[styles.selectedDot, { backgroundColor: brandColor }]} />
        )}
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
        data-testid={`provider-content-${item.id}`}
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
          {selectedProvider && (
            <View style={[styles.providerBadge, { backgroundColor: PROVIDER_COLORS[selectedProvider] || theme.colors.primary }]}>
              <Text style={styles.providerBadgeText}>
                {STREAMING_PROVIDERS[selectedProvider].name.split(' ')[0]}
              </Text>
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
          <Text style={styles.title}>Streaming Providers</Text>
        </View>
        
        {/* Media Type Toggle */}
        <View style={styles.mediaTypeToggle}>
          <Pressable
            style={[styles.toggleButton, mediaType === 'movie' && styles.toggleButtonActive]}
            onPress={() => setMediaType('movie')}
            data-testid="providers-movies-toggle"
          >
            <Ionicons name="film" size={14} color={mediaType === 'movie' ? '#000' : theme.colors.text} />
            <Text style={[styles.toggleText, mediaType === 'movie' && styles.toggleTextActive]}>Movies</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, mediaType === 'tv' && styles.toggleButtonActive]}
            onPress={() => setMediaType('tv')}
            data-testid="providers-tv-toggle"
          >
            <Ionicons name="tv" size={14} color={mediaType === 'tv' ? '#000' : theme.colors.text} />
            <Text style={[styles.toggleText, mediaType === 'tv' && styles.toggleTextActive]}>TV Shows</Text>
          </Pressable>
        </View>
      </View>

      {/* Provider Logos Grid */}
      <View style={styles.providerSection}>
        <Text style={styles.providerSectionTitle}>Select a Provider</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.providerScroll}
        >
          {providers.map(renderProviderCard)}
        </ScrollView>
      </View>

      {/* Sort Options - only show when provider selected */}
      {selectedProvider && (
        <View style={styles.sortSection}>
          <Text style={styles.sortLabel}>Sort:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortOptions}>
            {[
              { key: 'popularity', label: 'Popular', icon: 'flame' },
              { key: 'rating', label: 'Top Rated', icon: 'star' },
              { key: 'newest', label: 'Newest', icon: 'time' },
            ].map((sort) => (
              <Pressable
                key={sort.key}
                style={[styles.sortChip, selectedSort === sort.key && styles.sortChipActive]}
                onPress={() => setSelectedSort(sort.key as any)}
              >
                <Ionicons 
                  name={sort.icon as any} 
                  size={12} 
                  color={selectedSort === sort.key ? '#000' : theme.colors.textSecondary} 
                />
                <Text style={[styles.sortChipText, selectedSort === sort.key && styles.sortChipTextActive]}>
                  {sort.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content Grid */}
      <View style={styles.contentContainer}>
        {!selectedProvider ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="tv-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Select a streaming provider above</Text>
            <Text style={styles.emptySubtext}>Browse movies and TV shows from Netflix, Hulu, HBO Max, Disney+ and more</Text>
          </View>
        ) : (
          <>
            <View style={styles.contentHeader}>
              <View style={styles.contentHeaderRow}>
                <Image
                  source={{ uri: providersService.getProviderLogo(selectedProvider) }}
                  style={styles.contentHeaderLogo}
                  contentFit="contain"
                />
                <Text style={styles.contentHeaderTitle}>
                  {STREAMING_PROVIDERS[selectedProvider].name} - {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
                </Text>
              </View>
              <Text style={styles.contentCount}>{content.length} titles</Text>
            </View>
            
            {loading && content.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={PROVIDER_COLORS[selectedProvider] || theme.colors.primary} />
                <Text style={styles.loadingText}>Loading {STREAMING_PROVIDERS[selectedProvider].name} content...</Text>
              </View>
            ) : content.length > 0 ? (
              <FlashList
                data={content}
                renderItem={renderContentItem}
                estimatedItemSize={CARD_HEIGHT + 60}
                numColumns={isTV ? 7 : 3}
                keyExtractor={(item) => `${item.media_type}-${item.id}`}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                contentContainerStyle={styles.gridContent}
                ListFooterComponent={
                  loading && hasMore ? (
                    <View style={styles.loadingMore}>
                      <ActivityIndicator size="small" color={PROVIDER_COLORS[selectedProvider] || theme.colors.primary} />
                      <Text style={styles.loadingText}>Loading more...</Text>
                    </View>
                  ) : null
                }
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="film-outline" size={64} color={theme.colors.textMuted} />
                <Text style={styles.emptyText}>No content found</Text>
              </View>
            )}
          </>
        )}
      </View>
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
    paddingHorizontal: isTV ? 30 : 16,
    paddingTop: isTV ? 16 : 50,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: isTV ? 22 : 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  mediaTypeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 3,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTV ? 14 : 16,
    paddingVertical: isTV ? 6 : 8,
    borderRadius: 16,
    gap: 4,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleText: {
    color: theme.colors.text,
    fontSize: isTV ? 12 : 14,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  // Provider logo section
  providerSection: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  providerSectionTitle: {
    fontSize: isTV ? 13 : 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    paddingHorizontal: isTV ? 30 : 16,
    marginBottom: 8,
  },
  providerScroll: {
    paddingHorizontal: isTV ? 30 : 16,
    gap: isTV ? 10 : 8,
  },
  providerCard: {
    alignItems: 'center',
    paddingVertical: isTV ? 8 : 10,
    paddingHorizontal: isTV ? 10 : 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    minWidth: isTV ? 72 : 70,
  },
  providerCardFocused: {
    borderColor: theme.colors.primary,
    transform: [{ scale: 1.08 }],
  },
  providerLogo: {
    width: PROVIDER_LOGO_SIZE,
    height: PROVIDER_LOGO_SIZE,
    borderRadius: 10,
    marginBottom: 4,
  },
  providerName: {
    fontSize: isTV ? 9 : 10,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 64,
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3,
  },
  // Sort section
  sortSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTV ? 30 : 16,
    marginBottom: 6,
    marginTop: 4,
  },
  sortLabel: {
    fontSize: isTV ? 12 : 14,
    color: theme.colors.textSecondary,
    marginRight: 8,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    paddingHorizontal: isTV ? 10 : 12,
    paddingVertical: isTV ? 5 : 8,
    borderRadius: 20,
    gap: 4,
  },
  sortChipActive: {
    backgroundColor: theme.colors.primary,
  },
  sortChipText: {
    fontSize: isTV ? 11 : 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  sortChipTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  // Content area
  contentContainer: {
    flex: 1,
    paddingHorizontal: isTV ? 30 : 16,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  contentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contentHeaderLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  contentHeaderTitle: {
    fontSize: isTV ? 16 : 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  contentCount: {
    fontSize: isTV ? 11 : 12,
    color: theme.colors.textSecondary,
  },
  gridContent: {
    paddingBottom: 100,
  },
  contentCard: {
    flex: 1,
    margin: isTV ? 5 : 6,
    maxWidth: CARD_WIDTH + 20,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  contentCardFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: theme.colors.primary,
    transform: [{ scale: isTV ? 1.08 : 1.05 }],
    shadowColor: '#FFFFFF',
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
    borderRadius: 8,
  },
  placeholderPoster: {
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    gap: 2,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '600',
  },
  providerBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  providerBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  contentTitle: {
    fontSize: isTV ? 11 : 12,
    fontWeight: '500',
    color: theme.colors.text,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  contentYear: {
    fontSize: isTV ? 10 : 10,
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
    marginTop: 10,
    fontSize: isTV ? 12 : 14,
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: isTV ? 16 : 18,
    fontWeight: '500',
    color: theme.colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: isTV ? 12 : 14,
    color: theme.colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});
