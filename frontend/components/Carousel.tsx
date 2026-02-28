import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { theme } from '../constants/theme';
import { Movie, TVShow } from '../types';
import { tmdbService } from '../services/tmdb';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 150;
const CARD_HEIGHT = 220;
const CARD_SPACING = 12;

interface CarouselProps {
  title: string;
  data: (Movie | TVShow)[];
  onSeeAll?: () => void;
}

const isMovie = (item: Movie | TVShow): item is Movie => {
  return 'title' in item;
};

export const Carousel: React.FC<CarouselProps> = ({ title, data, onSeeAll }) => {
  const router = useRouter();

  const handlePress = (item: Movie | TVShow) => {
    if (isMovie(item)) {
      router.push(`/movie/${item.id}`);
    } else {
      router.push(`/tv/${item.id}`);
    }
  };

  const renderItem = ({ item }: { item: Movie | TVShow }) => {
    const imageUrl = tmdbService.getImageUrl(item.poster_path, 'w342');
    const displayTitle = isMovie(item) ? item.title : item.name;
    const year = isMovie(item)
      ? item.release_date?.split('-')[0]
      : item.first_air_date?.split('-')[0];

    return (
      <Pressable
        onPress={() => handlePress(item)}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.image, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
          <View style={styles.overlay}>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>
                ⭐ {item.vote_average.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {displayTitle}
        </Text>
        {year && <Text style={styles.year}>{year}</Text>}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
        {onSeeAll && (
          <Pressable onPress={onSeeAll}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        )}
      </View>
      <FlashList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        estimatedItemSize={CARD_WIDTH}
        ItemSeparatorComponent={() => <View style={{ width: CARD_SPACING }} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  seeAll: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
  },
  card: {
    width: CARD_WIDTH,
  },
  cardPressed: {
    opacity: 0.7,
  },
  imageContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: theme.spacing.sm,
  },
  ratingBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  ratingText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  title: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: 2,
  },
  year: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
});
