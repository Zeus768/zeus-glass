import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, FlatList, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../constants/theme';
import { tmdbService } from '../services/tmdb';
import { TVShow, Genre } from '../types';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTV = Platform.isTV || SCREEN_WIDTH > 900;

const getNumColumns = () => {
  if (isTV) return 7;
  if (SCREEN_WIDTH > 600) return 5;
  if (SCREEN_WIDTH > 400) return 3;
  return 2;
};

const ITEM_WIDTH = isTV ? 200 : SCREEN_WIDTH / getNumColumns() - 20;

export default function TVShowsScreen() {
  const router = useRouter();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [shows, setShows] = useState<TVShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  useEffect(() => {
    loadGenres();
    loadShows(1, true);
  }, []);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    if (selectedGenre !== null) {
      loadShowsByGenre(1, true);
    } else {
      loadShows(1, true);
    }
  }, [selectedGenre]);

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
    } else {
      loadShows(nextPage, false);
    }
  }, [page, loadingMore, hasMore, selectedGenre]);

  const handleShowPress = (show: TVShow) => {
    router.push(`/tv/${show.id}`);
  };

  const renderShowCard = ({ item, index }: { item: TVShow; index: number }) => {
    const imageUrl = tmdbService.getImageUrl(item.poster_path, 'w342');
    const year = item.first_air_date?.split('-')[0];
    const isFocused = focusedIndex === index;

    return (
      <Pressable
        style={[styles.showCard, isFocused && styles.showCardFocused]}
        onPress={() => handleShowPress(item)}
        onFocus={() => setFocusedIndex(index)}
        onBlur={() => setFocusedIndex(null)}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.showPoster} contentFit="cover" />
        ) : (
          <View style={[styles.showPoster, styles.placeholderPoster]}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        <View style={styles.showInfo}>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {item.vote_average.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.showTitle} numberOfLines={2}>{item.name}</Text>
        {year && <Text style={styles.showYear}>{year}</Text>}
      </Pressable>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.genresContainer}
        contentContainerStyle={styles.genresContent}
      >
        <Pressable
          onPress={() => setSelectedGenre(null)}
          style={[styles.genreButton, selectedGenre === null && styles.genreButtonActive]}
        >
          <Text style={[styles.genreText, selectedGenre === null && styles.genreTextActive]}>All</Text>
        </Pressable>
        {genres.map((genre) => (
          <Pressable
            key={genre.id}
            onPress={() => setSelectedGenre(genre.id)}
            style={[styles.genreButton, selectedGenre === genre.id && styles.genreButtonActive]}
          >
            <Text style={[styles.genreText, selectedGenre === genre.id && styles.genreTextActive]}>
              {genre.name}
            </Text>
          </Pressable>
        ))}
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
          numColumns={getNumColumns()}
          key={getNumColumns()}
          contentContainerStyle={styles.showsGrid}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  genresContainer: { minHeight: isTV ? 80 : 60, maxHeight: isTV ? 80 : 60, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  genresContent: { paddingHorizontal: isTV ? 30 : 16, paddingVertical: isTV ? 16 : 12, alignItems: 'center', gap: isTV ? 16 : 10 },
  genreButton: { paddingHorizontal: isTV ? 28 : 18, paddingVertical: isTV ? 12 : 10, borderRadius: isTV ? 25 : 20, backgroundColor: theme.colors.surfaceLight, marginRight: isTV ? 12 : 8 },
  genreButtonActive: { backgroundColor: theme.colors.primary },
  genreText: { fontSize: isTV ? 20 : 15, color: theme.colors.textSecondary, fontWeight: '600' },
  genreTextActive: { color: '#000', fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: isTV ? 20 : 16, color: theme.colors.textSecondary },
  showsGrid: { padding: isTV ? 30 : 12 },
  showCard: { width: ITEM_WIDTH, margin: isTV ? 12 : 6, borderRadius: isTV ? 16 : 12, overflow: 'hidden' },
  showCardFocused: { borderWidth: 4, borderColor: theme.colors.primary, transform: [{ scale: 1.05 }] },
  showPoster: { width: '100%', aspectRatio: 2 / 3, borderRadius: isTV ? 16 : 12, marginBottom: isTV ? 12 : 8 },
  placeholderPoster: { backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: theme.colors.textMuted, fontSize: isTV ? 18 : 12 },
  showInfo: { position: 'absolute', top: isTV ? 12 : 8, right: isTV ? 12 : 8 },
  ratingBadge: { backgroundColor: 'rgba(0, 0, 0, 0.85)', paddingHorizontal: isTV ? 12 : 8, paddingVertical: isTV ? 6 : 4, borderRadius: isTV ? 10 : 6 },
  ratingText: { color: theme.colors.text, fontSize: isTV ? 16 : 12, fontWeight: '700' },
  showTitle: { fontSize: isTV ? 18 : 14, fontWeight: '600', color: theme.colors.text, marginBottom: 4, paddingHorizontal: 4 },
  showYear: { fontSize: isTV ? 16 : 12, color: theme.colors.textSecondary, paddingHorizontal: 4 },
  footerLoader: { paddingVertical: 30, alignItems: 'center' },
  loadingMoreText: { marginTop: 10, fontSize: isTV ? 18 : 14, color: theme.colors.textSecondary },
});
