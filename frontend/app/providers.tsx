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
  const [content, setContent] = useState<ProviderContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<'popularity' | 'rating' | 'newest'>('popularity');

  const providers = Object.keys(STREAMING_PROVIDERS) as ProviderKey[];

  // Load content from ALL providers combined
  const loadAllProviderContent = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (loading && append) return;
    
    setLoading(true);
    try {
      // Get popular providers to aggregate content from
      const popularProviders: ProviderKey[] = ['netflix', 'disney', 'prime', 'hbo', 'apple', 'paramount', 'hulu', 'peacock'];
      
      // Determine sort parameter
      let sortBy = 'popularity.desc';
      if (selectedSort === 'rating') sortBy = 'vote_average.desc';
      if (selectedSort === 'newest') sortBy = mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
      
      // Fetch from multiple providers in parallel
      const results = await Promise.allSettled(
        popularProviders.map(provider => 
          mediaType === 'movie'
            ? providersService.discoverMoviesByProvider(provider, pageNum, sortBy)
            : providersService.discoverTVByProvider(provider, pageNum, sortBy)
        )
      );
      
      // Combine and deduplicate results
      const allContent: ProviderContent[] = [];
      const seenIds = new Set<number>();
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          result.value.results.forEach(item => {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              allContent.push(item);
            }
          });
        }
      });
      
      // Sort combined results
      if (selectedSort === 'popularity') {
        allContent.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      } else if (selectedSort === 'rating') {
        allContent.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      } else if (selectedSort === 'newest') {
        allContent.sort((a, b) => {
          const dateA = a.release_date || a.first_air_date || '';
          const dateB = b.release_date || b.first_air_date || '';
          return dateB.localeCompare(dateA);
        });
      }
      
      if (append) {
        setContent(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newItems = allContent.filter(item => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      } else {
        setContent(allContent);
      }
      
      setHasMore(allContent.length >= 20);
    } catch (error) {
      console.error('Error loading provider content:', error);
    } finally {
      setLoading(false);
    }
  }, [mediaType, selectedSort]);

  useEffect(() => {
    setPage(1);
    setContent([]);
    loadAllProviderContent(1, false);
  }, [mediaType, selectedSort]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadAllProviderContent(nextPage, true);
    }
  };

  const handleItemPress = (item: ProviderContent) => {
    if (item.media_type === 'movie') {
      router.push(`/movie/${item.id}`);
    } else {
      router.push(`/tv/${item.id}`);
    }
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
          {/* Streaming badge */}
          <View style={styles.streamingBadge}>
            <Ionicons name="play-circle" size={12} color="#fff" />
            <Text style={styles.streamingBadgeText}>STREAMING</Text>
          </View>
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

      {/* Sort Options */}
      <View style={styles.sortSection}>
        <Text style={styles.sortLabel}>Sort by:</Text>
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
                size={14} 
                color={selectedSort === sort.key ? '#000' : theme.colors.textSecondary} 
              />
              <Text style={[styles.sortChipText, selectedSort === sort.key && styles.sortChipTextActive]}>
                {sort.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={18} color={theme.colors.primary} />
        <Text style={styles.infoBannerText}>
          Browse content from Netflix, Disney+, Prime Video, HBO Max & more. Select any title to find links via your Debrid service or IPTV.
        </Text>
      </View>

      {/* Content Grid */}
      <View style={styles.contentContainer}>
        <View style={styles.contentHeader}>
          <Text style={styles.contentHeaderTitle}>
            All {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
          </Text>
          <Text style={styles.contentCount}>{content.length} titles</Text>
        </View>
        
        {loading && content.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading content from all providers...</Text>
          </View>
        ) : content.length > 0 ? (
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
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="film-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>No content found</Text>
          </View>
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
  sortSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTV ? 40 : 16,
    marginBottom: 12,
  },
  sortLabel: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textSecondary,
    marginRight: 12,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    paddingHorizontal: isTV ? 16 : 12,
    paddingVertical: isTV ? 10 : 8,
    borderRadius: 20,
    gap: 6,
  },
  sortChipActive: {
    backgroundColor: theme.colors.primary,
  },
  sortChipText: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  sortChipTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    paddingHorizontal: isTV ? 40 : 16,
    paddingVertical: 12,
    marginHorizontal: isTV ? 40 : 16,
    marginBottom: 16,
    borderRadius: 10,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textSecondary,
    lineHeight: isTV ? 20 : 18,
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
    borderWidth: 3,
    borderColor: 'transparent',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  contentCardFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: theme.colors.primary,
    transform: [{ scale: isTV ? 1.1 : 1.05 }],
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 50,
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
  streamingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  streamingBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '700',
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
