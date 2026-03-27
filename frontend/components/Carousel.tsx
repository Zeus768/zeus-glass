import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import { Movie, TVShow } from '../types';
import { tmdbService } from '../services/tmdb';
import { useRouter } from 'expo-router';

const CARD_WIDTH = isTV ? theme.tv.cardWidth : theme.mobile.cardWidth;
const CARD_HEIGHT = isTV ? theme.tv.cardHeight : theme.mobile.cardHeight;
const CARD_SPACING = isTV ? theme.tv.carouselItemSpacing : theme.mobile.carouselItemSpacing;

interface CarouselProps {
  title: string;
  data: (Movie | TVShow)[];
  onSeeAll?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  watchedIds?: Set<number>;
  mediaType?: 'movie' | 'tv' | 'mixed';
  progressMap?: Map<number, number>; // tmdbId -> progress (0-100)
}

const isMovie = (item: Movie | TVShow): item is Movie => 'title' in item;

interface CarouselItemProps {
  item: Movie | TVShow;
  index: number;
  onPress: (item: Movie | TVShow) => void;
  isWatched?: boolean;
  progress?: number; // 0-100
}

const CarouselItem: React.FC<CarouselItemProps> = ({ item, index, onPress, isWatched, progress }) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const imageUrl = tmdbService.getImageUrl(item.poster_path, 'w342');
  const displayTitle = isMovie(item) ? item.title : item.name;
  const year = isMovie(item)
    ? item.release_date?.split('-')[0]
    : item.first_air_date?.split('-')[0];

  return (
    <Pressable
      onPress={() => onPress(item)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={[
        styles.card,
        index > 0 && { marginLeft: CARD_SPACING },
        isFocused && styles.cardFocused,
      ]}
      data-testid={`carousel-item-${item.id}`}
      {...(Platform.isTV && {
        hasTVPreferredFocus: index === 0,
      })}
    >
      {/* FOCUS HIGHLIGHT - Big glowing border */}
      {isFocused && <View style={styles.focusHighlight} />}
      
      <View style={[styles.imageContainer, isFocused && styles.imageContainerFocused]}>
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
        {/* Rating Badge */}
        <View style={styles.overlay}>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>
              {item.vote_average.toFixed(1)}
            </Text>
          </View>
        </View>
        {/* Watched tick badge */}
        {isWatched && (
          <View style={styles.watchedBadge} data-testid={`watched-carousel-${item.id}`}>
            <Text style={styles.watchedCheck}>✓</Text>
          </View>
        )}
        {/* Focus Play Indicator - BIG and OBVIOUS */}
        {isFocused && (
          <View style={styles.focusPlayOverlay}>
            <View style={styles.playCircle}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
            <Text style={styles.focusLabel}>PRESS TO PLAY</Text>
          </View>
        )}
      </View>
      {/* Progress bar — Netflix-style red bar at bottom of card */}
      {progress !== undefined && progress > 0 && progress < 95 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
        </View>
      )}
      <Text style={[styles.title, isFocused && styles.titleFocused]} numberOfLines={2}>
        {displayTitle}
      </Text>
      {year && <Text style={[styles.year, isFocused && styles.yearFocused]}>{year}</Text>}
    </Pressable>
  );
};

export const Carousel: React.FC<CarouselProps> = ({ title, data, onSeeAll, icon, watchedIds, mediaType = 'mixed', progressMap }) => {
  const router = useRouter();

  const handlePress = useCallback((item: Movie | TVShow) => {
    if (isMovie(item)) {
      router.push(`/movie/${item.id}`);
    } else {
      router.push(`/tv/${item.id}`);
    }
  }, [router]);

  const checkWatched = useCallback((item: Movie | TVShow): boolean => {
    if (!watchedIds || watchedIds.size === 0) return false;
    return watchedIds.has(item.id);
  }, [watchedIds]);

  // Return empty container when no data to avoid layout issues
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} data-testid={`carousel-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          {icon && (
            <Ionicons 
              name={icon} 
              size={isTV ? 28 : 20} 
              color={theme.colors.primary} 
              style={styles.headerIcon}
            />
          )}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} data-testid={`see-all-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.scrollWrapper}>
        <FlashList
          data={data}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          estimatedItemSize={CARD_WIDTH + CARD_SPACING}
          renderItem={({ item, index }) => (
            <CarouselItem
              key={item.id}
              item={item}
              index={index}
              onPress={handlePress}
              isWatched={checkWatched(item)}
              progress={progressMap?.get(item.id)}
            />
          )}
          keyExtractor={(item) => item.id.toString()}
        />
      </View>
    </View>
  );
};

// Calculate total card height including title and year text
const TOTAL_CARD_HEIGHT = CARD_HEIGHT + (isTV ? 80 : 55);

const styles = StyleSheet.create({
  container: {
    marginBottom: isTV ? 40 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTV ? 50 : 16,
    marginBottom: isTV ? 20 : 12,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: isTV ? 12 : 8,
  },
  headerTitle: {
    fontSize: isTV ? 32 : 20,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: isTV ? 1 : 0,
  },
  seeAll: {
    fontSize: isTV ? 20 : 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  scrollWrapper: {
    height: TOTAL_CARD_HEIGHT,
  },
  listContent: {
    paddingHorizontal: isTV ? 50 : 16,
  },
  card: {
    width: CARD_WIDTH,
    position: 'relative',
  },
  cardFocused: {
    transform: [{ scale: isTV ? 1.15 : 1.05 }],
    zIndex: 100,
  },
  focusHighlight: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: theme.colors.primary,
    borderRadius: isTV ? 24 : 16,
    opacity: 0.3,
    zIndex: -1,
  },
  imageContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: isTV ? 16 : 12,
    overflow: 'hidden',
    marginBottom: isTV ? 12 : 8,
    borderWidth: 4,
    borderColor: 'transparent',
  },
  imageContainerFocused: {
    borderColor: theme.colors.primary,
    borderWidth: isTV ? 6 : 4,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 30,
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
    fontSize: isTV ? 18 : 12,
  },
  overlay: {
    position: 'absolute',
    top: isTV ? 12 : 8,
    right: isTV ? 12 : 8,
    pointerEvents: 'none',
  },
  ratingBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: isTV ? 12 : 8,
    paddingVertical: isTV ? 6 : 4,
    borderRadius: isTV ? 8 : 6,
  },
  ratingText: {
    color: theme.colors.gold,
    fontSize: isTV ? 16 : 12,
    fontWeight: '700',
  },
  focusPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 217, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: isTV ? 80 : 50,
    height: isTV ? 80 : 50,
    borderRadius: isTV ? 40 : 25,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  playIcon: {
    color: '#000',
    fontSize: isTV ? 32 : 20,
    fontWeight: 'bold',
    marginLeft: isTV ? 6 : 2,
  },
  focusLabel: {
    marginTop: isTV ? 12 : 8,
    color: '#FFFFFF',
    fontSize: isTV ? 16 : 10,
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 1,
  },
  title: {
    fontSize: isTV ? 18 : 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  titleFocused: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  year: {
    fontSize: isTV ? 16 : 12,
    color: theme.colors.textSecondary,
  },
  yearFocused: {
    color: theme.colors.primary,
  },
  watchedBadge: {
    position: 'absolute',
    top: isTV ? 12 : 8,
    left: isTV ? 12 : 8,
    backgroundColor: '#22C55E',
    borderRadius: isTV ? 14 : 10,
    width: isTV ? 28 : 20,
    height: isTV ? 28 : 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  watchedCheck: {
    color: '#fff',
    fontSize: isTV ? 16 : 12,
    fontWeight: '900',
  },
});
