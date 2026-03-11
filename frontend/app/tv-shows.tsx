import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, FlatList, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import { tmdbService } from '../services/tmdb';
import { TVShow, Genre } from '../types';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getNumColumns = () => {
  if (isTV) return 7;
  if (SCREEN_WIDTH > 600) return 5;
  if (SCREEN_WIDTH > 400) return 3;
  return 2;
};

const NUM_COLUMNS = getNumColumns();
const HORIZONTAL_PADDING = isTV ? 50 : 12;
const ITEM_MARGIN = isTV ? 15 : 8;
const ITEM_WIDTH = (SCREEN_WIDTH - (HORIZONTAL_PADDING * 2) - (ITEM_MARGIN * (NUM_COLUMNS + 1))) / NUM_COLUMNS;

export default function TVShowsScreen() {
  const router = useRouter();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'trending' | 'top_rated'>('all');
  const [shows, setShows] = useState<TVShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [focusedGenreIndex, setFocusedGenreIndex] = useState<number | null>(null);

  useEffect(() => {
    loadGenres();
    loadShows(1, true);
  }, []);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    if (selectedGenre !== null) {
      loadShowsByGenre(1, true);
    } else if (selectedCategory === 'trending') {
      loadTrendingShows(1, true);
    } else if (selectedCategory === 'top_rated') {
      loadTopRatedShows(1, true);
    } else {
      loadShows(1, true);
    }
  }, [selectedGenre, selectedCategory]);

  const loadGenres = async () => {
    try {
      const genresData = await tmdbService.getTVGenres();
      setGenres(genresData);
    } catch (error) {
      console.error('Error loading genres:', error);
    }
  };

  const loadShows = async (pageNum: number = 1, reset: boolean = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    
    try {
      const showsData = await tmdbService.getPopularTVShows(pageNum);
      if (showsData.length < 20) setHasMore(false);
      
      if (reset) {
        setShows(showsData);
      } else {
        setShows(prev => [...prev, ...showsData]);
      }
    } catch (error) {
      console.error('Error loading shows:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadTrendingShows = async (pageNum: number = 1, reset: boolean = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    
    try {
      const showsData = await tmdbService.getTrendingTVShows(pageNum);
      if (showsData.length < 20) setHasMore(false);
      
      if (reset) {
        setShows(showsData);
      } else {
        setShows(prev => [...prev, ...showsData]);
      }
    } catch (error) {
      console.error('Error loading trending shows:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadTopRatedShows = async (pageNum: number = 1, reset: boolean = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    
    try {
      const showsData = await tmdbService.getTopRatedTVShows(pageNum);
      if (showsData.length < 20) setHasMore(false);
      
      if (reset) {
        setShows(showsData);
      } else {
        setShows(prev => [...prev, ...showsData]);
      }
    } catch (error) {
      console.error('Error loading top rated shows:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadShowsByGenre = async (pageNum: number = 1, reset: boolean = false) => {
    if (!selectedGenre) return;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    
    try {
      const showsData = await tmdbService.getTVShowsByGenre(selectedGenre, pageNum);
      if (showsData.length < 20) setHasMore(false);
      
      if (reset) {
        setShows(showsData);
      } else {
        setShows(prev => [...prev, ...showsData]);
      }
    } catch (error) {
      console.error('Error loading shows by genre:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    
    const nextPage = page + 1;
    setPage(nextPage);
    
    if (selectedGenre !== null) {
      loadShowsByGenre(nextPage, false);
    } else if (selectedCategory === 'trending') {
      loadTrendingShows(nextPage, false);
    } else if (selectedCategory === 'top_rated') {
      loadTopRatedShows(nextPage, false);
    } else {
      loadShows(nextPage, false);
    }
  }, [page, loadingMore, hasMore, selectedGenre, selectedCategory]);

  const handleCategorySelect = (category: 'all' | 'trending' | 'top_rated') => {
    setSelectedGenre(null);
    setSelectedCategory(category);
  };

  const handleGenreSelect = (genreId: number | null) => {
    setSelectedCategory('all');
    setSelectedGenre(genreId);
  };

  const handleShowPress = useCallback((show: TVShow) => {
    router.push(`/tv/${show.id}`);
  }, [router]);

  const renderShowCard = useCallback(({ item, index }: { item: TVShow; index: number }) => {
    const imageUrl = tmdbService.getImageUrl(item.poster_path, 'w342');
    const year = item.first_air_date?.split('-')[0];
    const isFocused = focusedIndex === index;

    return (
      <Pressable
        style={[styles.showCard, isFocused && styles.showCardFocused]}
        onPress={() => handleShowPress(item)}
        onFocus={() => setFocusedIndex(index)}
        onBlur={() => setFocusedIndex(null)}
        data-testid={`show-card-${item.id}`}
        {...(Platform.isTV && index === 0 && { hasTVPreferredFocus: true })}
      >
        <View style={[styles.imageContainer, isFocused && styles.imageContainerFocused]}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.showPoster} contentFit="cover" />
          ) : (
            <View style={[styles.showPoster, styles.placeholderPoster]}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
          <View style={styles.showInfo}>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
            </View>
          </View>
          {isFocused && (
            <View style={styles.focusOverlay}>
              <View style={styles.playIcon}>
                <Text style={styles.playIconText}>▶</Text>
              </View>
            </View>
          )}
        </View>
        <Text style={[styles.showTitle, isFocused && styles.showTitleFocused]} numberOfLines={2}>
          {item.name}
        </Text>
        {year && <Text style={styles.showYear}>{year}</Text>}
      </Pressable>
    );
  }, [focusedIndex, handleShowPress]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  }, [loadingMore]);

  const renderGenreButton = useCallback((genre: Genre | null, index: number) => {
    const isSelected = genre === null ? selectedGenre === null && selectedCategory === 'all' : selectedGenre === genre?.id;
    const isFocused = focusedGenreIndex === index;
    
    return (
      <Pressable
        key={genre?.id ?? 'all'}
        onPress={() => genre === null ? handleCategorySelect('all') : handleGenreSelect(genre.id)}
        onFocus={() => setFocusedGenreIndex(index)}
        onBlur={() => setFocusedGenreIndex(null)}
        style={[
          styles.genreButton,
          isSelected && styles.genreButtonActive,
          isFocused && styles.genreButtonFocused,
        ]}
        data-testid={`tv-genre-${genre?.id ?? 'all'}`}
      >
        <Text style={[
          styles.genreText, 
          isSelected && styles.genreTextActive,
          isFocused && styles.genreTextFocused,
        ]}>
          {genre?.name ?? 'All'}
        </Text>
      </Pressable>
    );
  }, [selectedGenre, selectedCategory, focusedGenreIndex]);

  const renderCategoryButton = useCallback((category: { key: 'trending' | 'top_rated'; label: string; icon: string }, index: number) => {
    const isSelected = selectedCategory === category.key && selectedGenre === null;
    const isFocused = focusedGenreIndex === index;
    
    return (
      <Pressable
        key={category.key}
        onPress={() => handleCategorySelect(category.key)}
        onFocus={() => setFocusedGenreIndex(index)}
        onBlur={() => setFocusedGenreIndex(null)}
        style={[
          styles.genreButton,
          styles.categoryButton,
          isSelected && styles.categoryButtonActive,
          isFocused && styles.genreButtonFocused,
        ]}
        data-testid={`tv-category-${category.key}`}
      >
        <Ionicons name={category.icon as any} size={isTV ? 20 : 14} color={isSelected ? '#000' : theme.colors.gold} />
        <Text style={[
          styles.genreText, 
          styles.categoryText,
          isSelected && styles.genreTextActive,
          isFocused && styles.genreTextFocused,
        ]}>
          {category.label}
        </Text>
      </Pressable>
    );
  }, [selectedCategory, selectedGenre, focusedGenreIndex]);

  return (
    <View style={styles.container} data-testid="tv-shows-screen">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.genresContainer}
        contentContainerStyle={styles.genresContent}
      >
        {renderGenreButton(null, 0)}
        {renderCategoryButton({ key: 'trending', label: 'Trending', icon: 'flame' }, 1)}
        {renderCategoryButton({ key: 'top_rated', label: 'Top Rated', icon: 'star' }, 2)}
        {genres.map((genre, index) => renderGenreButton(genre, index + 3))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading TV shows...</Text>
        </View>
      ) : (
        <FlatList
          data={shows}
          renderItem={renderShowCard}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={NUM_COLUMNS}
          key={NUM_COLUMNS}
          contentContainerStyle={styles.showsGrid}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  genresContainer: { minHeight: isTV ? 90 : 60, maxHeight: isTV ? 90 : 60, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  genresContent: { paddingHorizontal: isTV ? 50 : 16, paddingVertical: isTV ? 20 : 12, alignItems: 'center', gap: isTV ? 16 : 10 },
  genreButton: { 
    paddingHorizontal: isTV ? 32 : 18, 
    paddingVertical: isTV ? 14 : 10, 
    borderRadius: isTV ? 28 : 20, 
    backgroundColor: theme.colors.surfaceLight, 
    marginRight: isTV ? 12 : 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genreButtonActive: { backgroundColor: theme.colors.primary },
  genreButtonFocused: { borderColor: theme.colors.focus, transform: [{ scale: 1.05 }] },
  genreText: { fontSize: isTV ? 22 : 15, color: theme.colors.textSecondary, fontWeight: '600' },
  genreTextActive: { color: '#000', fontWeight: '700' },
  genreTextFocused: { color: theme.colors.primary },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 8 : 6,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  categoryButtonActive: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
  categoryText: {
    color: theme.colors.gold,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: isTV ? 24 : 16, color: theme.colors.textSecondary },
  showsGrid: { padding: HORIZONTAL_PADDING },
  showCard: { width: ITEM_WIDTH, margin: ITEM_MARGIN },
  showCardFocused: { transform: [{ scale: 1.05 }] },
  imageContainer: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: isTV ? 16 : 12,
    overflow: 'hidden',
    marginBottom: isTV ? 12 : 8,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  imageContainerFocused: { borderColor: theme.colors.focus },
  showPoster: { width: '100%', height: '100%' },
  placeholderPoster: { backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: theme.colors.textMuted, fontSize: isTV ? 18 : 12 },
  showInfo: { position: 'absolute', top: isTV ? 12 : 8, right: isTV ? 12 : 8 },
  ratingBadge: { backgroundColor: 'rgba(0, 0, 0, 0.85)', paddingHorizontal: isTV ? 12 : 8, paddingVertical: isTV ? 6 : 4, borderRadius: isTV ? 10 : 6 },
  ratingText: { color: theme.colors.gold, fontSize: isTV ? 18 : 12, fontWeight: '700' },
  focusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 217, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    width: isTV ? 60 : 40,
    height: isTV ? 60 : 40,
    borderRadius: isTV ? 30 : 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconText: {
    color: '#000',
    fontSize: isTV ? 24 : 16,
    fontWeight: 'bold',
    marginLeft: isTV ? 4 : 2,
  },
  showTitle: { fontSize: isTV ? 20 : 14, fontWeight: '600', color: theme.colors.text, marginBottom: 4, paddingHorizontal: 4 },
  showTitleFocused: { color: theme.colors.primary },
  showYear: { fontSize: isTV ? 18 : 12, color: theme.colors.textSecondary, paddingHorizontal: 4 },
  footerLoader: { paddingVertical: isTV ? 50 : 30, alignItems: 'center' },
  loadingMoreText: { marginTop: 10, fontSize: isTV ? 20 : 14, color: theme.colors.textSecondary },
});
