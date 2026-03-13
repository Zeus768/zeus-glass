import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, isTV } from '../constants/theme';
import { tmdbService } from '../services/tmdb';
import { Movie } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FRANCHISE_CARD_WIDTH = isTV ? 220 : 160;
const FRANCHISE_CARD_HEIGHT = isTV ? 330 : 240;

interface Franchise {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  parts: Movie[];
  movieCount: number;
}

export default function FranchisesScreen() {
  const router = useRouter();
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFranchise, setSelectedFranchise] = useState<Franchise | null>(null);
  const [focusedFranchise, setFocusedFranchise] = useState<number | null>(null);
  const [focusedMovie, setFocusedMovie] = useState<number | null>(null);

  useEffect(() => {
    loadFranchises();
  }, []);

  const loadFranchises = async () => {
    setLoading(true);
    try {
      const data = await tmdbService.getPopularFranchises();
      setFranchises(data);
    } catch (error) {
      console.error('Error loading franchises:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFranchisePress = (franchise: Franchise) => {
    setSelectedFranchise(franchise);
  };

  const handleMoviePress = (movie: Movie) => {
    router.push(`/movie/${movie.id}`);
  };

  const handleBack = () => {
    if (selectedFranchise) {
      setSelectedFranchise(null);
    } else {
      router.back();
    }
  };

  const renderFranchiseCard = ({ item, index }: { item: Franchise; index: number }) => {
    const isFocused = focusedFranchise === index;
    const imageUrl = tmdbService.getImageUrl(item.poster_path, 'w342');

    return (
      <Pressable
        style={[styles.franchiseCard, isFocused && styles.franchiseCardFocused]}
        onPress={() => handleFranchisePress(item)}
        onFocus={() => setFocusedFranchise(index)}
        onBlur={() => setFocusedFranchise(null)}
        data-testid={`franchise-${item.id}`}
      >
        <View style={styles.franchiseImageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.franchiseImage} contentFit="cover" />
          ) : (
            <View style={[styles.franchiseImage, styles.placeholderImage]}>
              <Ionicons name="film" size={40} color={theme.colors.textMuted} />
            </View>
          )}
          <View style={styles.franchiseBadge}>
            <Ionicons name="layers" size={12} color="#000" />
            <Text style={styles.franchiseBadgeText}>{item.movieCount} movies</Text>
          </View>
        </View>
        <Text style={styles.franchiseName} numberOfLines={2}>{item.name}</Text>
      </Pressable>
    );
  };

  const renderMovieCard = ({ item, index }: { item: Movie; index: number }) => {
    const isFocused = focusedMovie === index;
    const imageUrl = tmdbService.getImageUrl(item.poster_path, 'w342');
    const year = item.release_date?.split('-')[0];

    return (
      <Pressable
        style={[styles.movieCard, isFocused && styles.movieCardFocused]}
        onPress={() => handleMoviePress(item)}
        onFocus={() => setFocusedMovie(index)}
        onBlur={() => setFocusedMovie(null)}
        data-testid={`franchise-movie-${item.id}`}
      >
        <View style={styles.movieImageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.movieImage} contentFit="cover" />
          ) : (
            <View style={[styles.movieImage, styles.placeholderImage]}>
              <Ionicons name="film" size={40} color={theme.colors.textMuted} />
            </View>
          )}
          {item.vote_average > 0 && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color="#FFD700" />
              <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.movieTitle} numberOfLines={2}>{item.title}</Text>
        {year && <Text style={styles.movieYear}>{year}</Text>}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading Franchises...</Text>
      </View>
    );
  }

  // Show franchise details view
  if (selectedFranchise) {
    const backdropUrl = tmdbService.getImageUrl(selectedFranchise.backdrop_path, 'w1280');
    const sortedMovies = [...selectedFranchise.parts].sort((a, b) => {
      const dateA = a.release_date || '';
      const dateB = b.release_date || '';
      return dateA.localeCompare(dateB);
    });

    return (
      <View style={styles.container}>
        {/* Header with backdrop */}
        <View style={styles.detailHeader}>
          {backdropUrl && (
            <Image source={{ uri: backdropUrl }} style={styles.backdrop} contentFit="cover" />
          )}
          <View style={styles.backdropGradient} />
          <View style={styles.detailHeaderContent}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <View style={styles.detailInfo}>
              <Text style={styles.detailTitle}>{selectedFranchise.name}</Text>
              <Text style={styles.detailCount}>{selectedFranchise.movieCount} Movies</Text>
            </View>
          </View>
        </View>

        {/* Overview */}
        {selectedFranchise.overview && (
          <View style={styles.overviewContainer}>
            <Text style={styles.overviewText} numberOfLines={3}>
              {selectedFranchise.overview}
            </Text>
          </View>
        )}

        {/* Movies in franchise */}
        <FlatList
          data={sortedMovies}
          renderItem={renderMovieCard}
          keyExtractor={(item) => item.id.toString()}
          numColumns={isTV ? 6 : 3}
          contentContainerStyle={styles.moviesGrid}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  // Show franchises list
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Movie Franchises</Text>
        <Text style={styles.subtitle}>{franchises.length} collections</Text>
      </View>

      <FlatList
        data={franchises}
        renderItem={renderFranchiseCard}
        keyExtractor={(item) => item.id.toString()}
        numColumns={isTV ? 6 : 3}
        contentContainerStyle={styles.franchisesGrid}
        showsVerticalScrollIndicator={false}
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
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTV ? 40 : 16,
    paddingTop: isTV ? 20 : 50,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: isTV ? 32 : 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textSecondary,
  },
  franchisesGrid: {
    paddingHorizontal: isTV ? 40 : 16,
    paddingBottom: 100,
  },
  franchiseCard: {
    flex: 1,
    margin: isTV ? 10 : 6,
    maxWidth: FRANCHISE_CARD_WIDTH + 20,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  franchiseCardFocused: {
    borderColor: theme.colors.primary,
    transform: [{ scale: 1.03 }],
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 15,
  },
  franchiseImageContainer: {
    position: 'relative',
  },
  franchiseImage: {
    width: '100%',
    aspectRatio: 2/3,
    borderRadius: 12,
  },
  placeholderImage: {
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  franchiseBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  franchiseBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  franchiseName: {
    fontSize: isTV ? 14 : 12,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  // Detail view styles
  detailHeader: {
    height: isTV ? 300 : 220,
    position: 'relative',
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  backdropGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 14, 39, 0.7)',
  },
  detailHeaderContent: {
    position: 'absolute',
    top: isTV ? 20 : 50,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: isTV ? 40 : 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  detailInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 20,
  },
  detailTitle: {
    fontSize: isTV ? 36 : 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  detailCount: {
    fontSize: isTV ? 18 : 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  overviewContainer: {
    paddingHorizontal: isTV ? 40 : 16,
    paddingVertical: 16,
  },
  overviewText: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textSecondary,
    lineHeight: isTV ? 24 : 20,
  },
  moviesGrid: {
    paddingHorizontal: isTV ? 40 : 16,
    paddingBottom: 100,
  },
  movieCard: {
    flex: 1,
    margin: isTV ? 10 : 6,
    maxWidth: FRANCHISE_CARD_WIDTH + 20,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  movieCardFocused: {
    borderColor: theme.colors.primary,
    transform: [{ scale: 1.03 }],
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 15,
  },
  movieImageContainer: {
    position: 'relative',
  },
  movieImage: {
    width: '100%',
    aspectRatio: 2/3,
    borderRadius: 12,
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
  movieTitle: {
    fontSize: isTV ? 14 : 12,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  movieYear: {
    fontSize: isTV ? 12 : 10,
    color: theme.colors.textMuted,
    paddingHorizontal: 4,
    marginTop: 2,
  },
});
