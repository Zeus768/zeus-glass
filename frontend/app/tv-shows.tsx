import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../constants/theme';
import { tmdbService } from '../services/tmdb';
import { TVShow, Genre } from '../types';
import { useRouter } from 'expo-router';

export default function TVShowsScreen() {
  const router = useRouter();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [tvShows, setTVShows] = useState<TVShow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGenres();
    loadTVShows();
  }, []);

  useEffect(() => {
    if (selectedGenre !== null) {
      // Would load by genre - for now just reload all
      loadTVShows();
    } else {
      loadTVShows();
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

  const loadTVShows = async () => {
    setLoading(true);
    try {
      const showsData = await tmdbService.getPopularTVShows();
      setTVShows(showsData);
    } catch (error) {
      console.error('Error loading TV shows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShowPress = (show: TVShow) => {
    router.push(`/tv/${show.id}`);
  };

  const renderShowCard = ({ item }: { item: TVShow }) => {
    const imageUrl = tmdbService.getImageUrl(item.poster_path, 'w342');
    const year = item.first_air_date?.split('-')[0];

    return (
      <Pressable
        style={styles.showCard}
        onPress={() => handleShowPress(item)}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.showPoster}
            contentFit="cover"
          />
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
        <Text style={styles.showTitle} numberOfLines={2}>
          {item.name}
        </Text>
        {year && <Text style={styles.showYear}>{year}</Text>}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Genres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.genresContainer}
        contentContainerStyle={styles.genresContent}
      >
        <Pressable
          onPress={() => setSelectedGenre(null)}
          style={[
            styles.genreButton,
            selectedGenre === null && styles.genreButtonActive,
          ]}
        >
          <Text
            style={[
              styles.genreText,
              selectedGenre === null && styles.genreTextActive,
            ]}
          >
            All
          </Text>
        </Pressable>
        {genres.map((genre) => (
          <Pressable
            key={genre.id}
            onPress={() => setSelectedGenre(genre.id)}
            style={[
              styles.genreButton,
              selectedGenre === genre.id && styles.genreButtonActive,
            ]}
          >
            <Text
              style={[
                styles.genreText,
                selectedGenre === genre.id && styles.genreTextActive,
              ]}
            >
              {genre.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* TV Shows Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={tvShows}
          renderItem={renderShowCard}
          keyExtractor={(item) => item.id.toString()}
          numColumns={3}
          contentContainerStyle={styles.showsGrid}
          showsVerticalScrollIndicator={false}
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
  genresContainer: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  genresContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  genreButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
  },
  genreButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  genreText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  genreTextActive: {
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showsGrid: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  showCard: {
    flex: 1,
    margin: theme.spacing.xs,
    minWidth: 100,
    maxWidth: 150,
  },
  showPoster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  placeholderPoster: {
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  showInfo: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
  },
  ratingBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  ratingText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  showTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: 2,
  },
  showYear: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
});
