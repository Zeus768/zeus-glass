import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { tmdbService } from '../services/tmdb';
import { Movie, TVShow } from '../types';
import { useRouter } from 'expo-router';

type MediaItem = (Movie | TVShow) & { media_type?: string };

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    
    if (searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchResults = await tmdbService.searchMulti(searchQuery);
      setResults(searchResults);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const isMovie = (item: MediaItem): item is Movie => {
    return 'title' in item || item.media_type === 'movie';
  };

  const handleItemPress = (item: MediaItem) => {
    if (isMovie(item)) {
      router.push(`/movie/${item.id}`);
    } else {
      router.push(`/tv/${item.id}`);
    }
  };

  const renderItem = ({ item }: { item: MediaItem }) => {
    const imageUrl = tmdbService.getImageUrl(item.poster_path, 'w185');
    const displayTitle = isMovie(item) ? item.title : (item as TVShow).name;
    const year = isMovie(item)
      ? item.release_date?.split('-')[0]
      : (item as TVShow).first_air_date?.split('-')[0];

    return (
      <Pressable style={styles.resultCard} onPress={() => handleItemPress(item)}>
        <View style={styles.posterContainer}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.poster}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.poster, styles.placeholderPoster]}>
              <Ionicons name="film-outline" size={32} color={theme.colors.textMuted} />
            </View>
          )}
        </View>
        <View style={styles.resultInfo}>
          <Text style={styles.resultTitle} numberOfLines={2}>
            {displayTitle}
          </Text>
          <Text style={styles.resultMeta}>
            {year} • {isMovie(item) ? 'Movie' : 'TV Show'}
          </Text>
          <Text style={styles.resultOverview} numberOfLines={3}>
            {item.overview}
          </Text>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color={theme.colors.gold} />
            <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color={theme.colors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search movies, TV shows..."
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={handleSearch}
          autoFocus
        />
        {query.length > 0 && (
          <Pressable onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.id}-${item.media_type || 'unknown'}`}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
        />
      ) : query.length >= 2 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>No results found</Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>Start typing to search</Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.lg,
    color: theme.colors.textMuted,
  },
  resultsList: {
    padding: theme.spacing.md,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  posterContainer: {
    width: 100,
    height: 150,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  placeholderPoster: {
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    padding: theme.spacing.md,
  },
  resultTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  resultMeta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  resultOverview: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
});
