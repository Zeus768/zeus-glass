import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, ScrollView, Alert, Modal } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { theme, isTV } from '../constants/theme';
import { iptvService } from '../services/iptv';
import { VODItem } from '../types';
import { Ionicons } from '@expo/vector-icons';

type ContentType = 'movies' | 'series';

export default function VODScreen() {
  const router = useRouter();
  const [movies, setMovies] = useState<VODItem[]>([]);
  const [series, setSeries] = useState<VODItem[]>([]);
  const [movieCategories, setMovieCategories] = useState<{ category_id: string; category_name: string }[]>([]);
  const [seriesCategories, setSeriesCategories] = useState<{ category_id: string; category_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [contentType, setContentType] = useState<ContentType>('movies');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [moviesPage, setMoviesPage] = useState(1);
  const [seriesPage, setSeriesPage] = useState(1);
  const [hasMoreMovies, setHasMoreMovies] = useState(true);
  const [hasMoreSeries, setHasMoreSeries] = useState(true);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);
  const [focusedTab, setFocusedTab] = useState<string | null>(null);
  
  // Series detail modal
  const [selectedSeries, setSelectedSeries] = useState<VODItem | null>(null);
  const [seriesInfo, setSeriesInfo] = useState<any>(null);
  const [loadingSeriesInfo, setLoadingSeriesInfo] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>('1');

  useEffect(() => {
    loadInitialContent();
  }, []);

  useEffect(() => {
    // Reset and reload when category changes
    if (contentType === 'movies') {
      setMovies([]);
      setMoviesPage(1);
      setHasMoreMovies(true);
      loadMovies(1, selectedCategory);
    } else {
      setSeries([]);
      setSeriesPage(1);
      setHasMoreSeries(true);
      loadSeries(1, selectedCategory);
    }
  }, [selectedCategory, contentType]);

  const loadInitialContent = async () => {
    setLoading(true);
    try {
      const [movCats, serCats] = await Promise.all([
        iptvService.getVODCategories(),
        iptvService.getSeriesCategories(),
      ]);
      setMovieCategories([{ category_id: 'all', category_name: 'All' }, ...movCats]);
      setSeriesCategories([{ category_id: 'all', category_name: 'All' }, ...serCats]);
      
      await loadMovies(1);
    } catch (error) {
      console.error('Error loading VOD:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMovies = async (page: number, category?: string) => {
    try {
      const newMovies = await iptvService.getVODContent(category || selectedCategory, page, 30);
      if (page === 1) {
        setMovies(newMovies);
      } else {
        setMovies(prev => [...prev, ...newMovies]);
      }
      setHasMoreMovies(newMovies.length === 30);
      setMoviesPage(page);
    } catch (error) {
      console.error('Error loading movies:', error);
    }
  };

  const loadSeries = async (page: number, category?: string) => {
    try {
      const newSeries = await iptvService.getSeries(category || selectedCategory, page, 30);
      if (page === 1) {
        setSeries(newSeries);
      } else {
        setSeries(prev => [...prev, ...newSeries]);
      }
      setHasMoreSeries(newSeries.length === 30);
      setSeriesPage(page);
    } catch (error) {
      console.error('Error loading series:', error);
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    
    setLoadingMore(true);
    try {
      if (contentType === 'movies' && hasMoreMovies) {
        await loadMovies(moviesPage + 1);
      } else if (contentType === 'series' && hasMoreSeries) {
        await loadSeries(seriesPage + 1);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [contentType, moviesPage, seriesPage, hasMoreMovies, hasMoreSeries, loadingMore, selectedCategory]);

  const handleItemPress = async (item: VODItem) => {
    if (item.type === 'series') {
      // Open series detail modal
      setSelectedSeries(item);
      setLoadingSeriesInfo(true);
      try {
        const info = await iptvService.getSeriesInfo(item.id);
        setSeriesInfo(info);
        if (info?.episodes) {
          const seasons = Object.keys(info.episodes);
          if (seasons.length > 0) {
            setSelectedSeason(seasons[0]);
          }
        }
      } catch (error) {
        console.error('Error loading series info:', error);
      } finally {
        setLoadingSeriesInfo(false);
      }
    } else {
      // Play movie directly
      playContent(item.stream_url, item.name);
    }
  };

  const playContent = (url: string, title: string) => {
    // Use internal fullscreen player
    router.push({
      pathname: '/player',
      params: { url, title },
    });
  };

  const currentContent = contentType === 'movies' ? movies : series;
  const currentCategories = contentType === 'movies' ? movieCategories : seriesCategories;

  const renderVODCard = ({ item }: { item: VODItem }) => {
    const isFocused = focusedItem === item.id;
    
    return (
      <Pressable 
        style={[
          styles.vodCard,
          isFocused && styles.vodCardFocused,
        ]}
        onPress={() => handleItemPress(item)}
        onFocus={() => setFocusedItem(item.id)}
        onBlur={() => setFocusedItem(null)}
        testID={`vod-item-${item.id}`}
      >
        <View style={styles.posterContainer}>
          <Image
            source={{ uri: item.poster || 'https://via.placeholder.com/200x300?text=No+Image' }}
            style={styles.poster}
            contentFit="cover"
          />
          {isFocused && (
            <View style={styles.focusOverlay}>
              <Ionicons name="play-circle" size={isTV ? 64 : 48} color="#fff" />
              <Text style={styles.focusText}>PRESS TO PLAY</Text>
            </View>
          )}
          {item.type === 'series' && (
            <View style={styles.seriesBadge}>
              <Ionicons name="tv" size={12} color="#fff" />
              <Text style={styles.seriesBadgeText}>SERIES</Text>
            </View>
          )}
        </View>
        <Text style={styles.vodTitle} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.vodMeta}>
          {item.year && <Text style={styles.vodYear}>{item.year}</Text>}
          {item.rating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color={theme.colors.gold} />
              <Text style={styles.ratingText}>{item.rating}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading VOD Content...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Content Type Tabs */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[
            styles.tab,
            contentType === 'movies' && styles.tabActive,
            focusedTab === 'movies' && styles.tabFocused,
          ]}
          onPress={() => setContentType('movies')}
          onFocus={() => setFocusedTab('movies')}
          onBlur={() => setFocusedTab(null)}
          testID="tab-movies"
        >
          <Ionicons 
            name="film" 
            size={isTV ? 28 : 20} 
            color={contentType === 'movies' ? '#000' : theme.colors.text} 
          />
          <Text style={[
            styles.tabText,
            contentType === 'movies' && styles.tabTextActive,
          ]}>
            Movies
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            contentType === 'series' && styles.tabActive,
            focusedTab === 'series' && styles.tabFocused,
          ]}
          onPress={() => setContentType('series')}
          onFocus={() => setFocusedTab('series')}
          onBlur={() => setFocusedTab(null)}
          testID="tab-series"
        >
          <Ionicons 
            name="tv" 
            size={isTV ? 28 : 20} 
            color={contentType === 'series' ? '#000' : theme.colors.text} 
          />
          <Text style={[
            styles.tabText,
            contentType === 'series' && styles.tabTextActive,
          ]}>
            TV Shows
          </Text>
        </Pressable>
      </View>

      {/* Categories */}
      <View style={styles.categoriesWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {currentCategories.map((category) => {
            const isCatFocused = focusedCategory === category.category_id;
            return (
              <Pressable
                key={category.category_id}
                onPress={() => setSelectedCategory(category.category_id)}
                onFocus={() => setFocusedCategory(category.category_id)}
                onBlur={() => setFocusedCategory(null)}
                style={[
                  styles.categoryButton,
                  selectedCategory === category.category_id && styles.categoryButtonActive,
                  isCatFocused && styles.categoryButtonFocused,
                ]}
                testID={`category-${category.category_id}`}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === category.category_id && styles.categoryTextActive,
                  ]}
                >
                  {category.category_name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content Count */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {currentContent.length} {contentType === 'movies' ? 'Movies' : 'TV Shows'}
        </Text>
      </View>

      {/* VOD Grid with Infinite Scroll */}
      <FlatList
        data={currentContent}
        renderItem={renderVODCard}
        keyExtractor={(item) => `${contentType}-${item.id}`}
        numColumns={isTV ? 6 : 3}
        contentContainerStyle={styles.vodGrid}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="film-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>No content found in this category</Text>
          </View>
        }
      />

      {/* Series Detail Modal */}
      <Modal
        visible={!!selectedSeries}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSelectedSeries(null);
          setSeriesInfo(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedSeries?.name}
              </Text>
              <Pressable onPress={() => {
                setSelectedSeries(null);
                setSeriesInfo(null);
              }}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </Pressable>
            </View>
            
            {loadingSeriesInfo ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading episodes...</Text>
              </View>
            ) : seriesInfo ? (
              <View style={styles.seriesContent}>
                {/* Season Selector */}
                {seriesInfo.episodes && (
                  <>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.seasonScroll}
                    >
                      {Object.keys(seriesInfo.episodes).map((season) => (
                        <Pressable
                          key={season}
                          style={[
                            styles.seasonButton,
                            selectedSeason === season && styles.seasonButtonActive,
                          ]}
                          onPress={() => setSelectedSeason(season)}
                        >
                          <Text style={[
                            styles.seasonText,
                            selectedSeason === season && styles.seasonTextActive,
                          ]}>
                            Season {season}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    
                    {/* Episodes */}
                    <ScrollView style={styles.episodesScroll}>
                      {seriesInfo.episodes[selectedSeason]?.map((episode: any, index: number) => (
                        <Pressable
                          key={episode.id || index}
                          style={styles.episodeCard}
                          onPress={() => playContent(episode.stream_url, `${selectedSeries?.name} S${selectedSeason}E${episode.episode_num || index + 1}`)}
                        >
                          <View style={styles.episodeThumb}>
                            <Ionicons name="play-circle" size={32} color={theme.colors.primary} />
                          </View>
                          <View style={styles.episodeInfo}>
                            <Text style={styles.episodeTitle}>
                              Episode {episode.episode_num || index + 1}
                              {episode.title && `: ${episode.title}`}
                            </Text>
                            {episode.plot && (
                              <Text style={styles.episodePlot} numberOfLines={2}>
                                {episode.plot}
                              </Text>
                            )}
                            {episode.duration && (
                              <Text style={styles.episodeDuration}>
                                {Math.floor(parseInt(episode.duration) / 60)}m
                              </Text>
                            )}
                          </View>
                          <Ionicons name="chevron-forward" size={24} color={theme.colors.textSecondary} />
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.modalLoading}>
                <Text style={styles.errorText}>Could not load series information</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTV ? 20 : 14,
    borderRadius: isTV ? 16 : theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    gap: theme.spacing.sm,
    borderWidth: isTV ? 3 : 2,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 15,
  },
  tabText: {
    fontSize: isTV ? 22 : theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  tabTextActive: {
    color: '#000',
  },
  // Categories
  categoriesWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoriesContainer: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: isTV ? 24 : theme.spacing.lg,
    paddingVertical: isTV ? 14 : theme.spacing.sm,
    borderRadius: isTV ? 12 : theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    marginRight: theme.spacing.sm,
    borderWidth: isTV ? 3 : 2,
    borderColor: 'transparent',
  },
  categoryButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  categoryButtonFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  categoryText: {
    fontSize: isTV ? 20 : theme.fontSize.md,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  categoryTextActive: {
    color: '#000',
    fontWeight: theme.fontWeight.bold,
  },
  // Count Bar
  countBar: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  countText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  // VOD Grid
  vodGrid: {
    padding: theme.spacing.md,
  },
  vodCard: {
    flex: 1,
    margin: isTV ? 10 : theme.spacing.xs,
    maxWidth: isTV ? 200 : 130,
    borderWidth: isTV ? 3 : 2,
    borderColor: 'transparent',
    borderRadius: theme.borderRadius.md,
    padding: isTV ? 8 : 4,
  },
  vodCardFocused: {
    borderColor: theme.colors.primary,
    transform: [{ scale: isTV ? 1.1 : 1.05 }],
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 15,
    zIndex: 100,
  },
  posterContainer: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  focusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusText: {
    color: '#fff',
    fontSize: isTV ? 16 : 12,
    fontWeight: theme.fontWeight.bold,
    marginTop: theme.spacing.xs,
  },
  seriesBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  seriesBadgeText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: '#000',
  },
  vodTitle: {
    fontSize: isTV ? 16 : theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: 2,
  },
  vodMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  vodYear: {
    fontSize: isTV ? 14 : theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: isTV ? 14 : theme.fontSize.xs,
    color: theme.colors.gold,
    fontWeight: theme.fontWeight.medium,
  },
  // Loading More
  loadingMore: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  loadingMoreText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xxl,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    flex: 1,
    fontSize: isTV ? 28 : theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginRight: theme.spacing.md,
  },
  modalLoading: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  errorText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.error,
  },
  seriesContent: {
    flex: 1,
  },
  seasonScroll: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  seasonButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginHorizontal: theme.spacing.xs,
  },
  seasonButtonActive: {
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.primary,
  },
  seasonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  seasonTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
  },
  episodesScroll: {
    flex: 1,
    padding: theme.spacing.md,
  },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  episodeThumb: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  episodeInfo: {
    flex: 1,
  },
  episodeTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  episodePlot: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  episodeDuration: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
  },
});
