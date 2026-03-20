import React, { useState, useCallback, memo } from 'react';
import { Pressable, StyleSheet, View, Text, Platform } from 'react-native';
import { Image } from 'expo-image';
import { theme, isTV } from '../constants/theme';
import { tmdbService } from '../services/tmdb';
import { Movie, TVShow } from '../types';
import { useRouter } from 'expo-router';

interface FocusableCardProps {
  item: Movie | TVShow;
  width?: number;
  height?: number;
  index?: number;
  autoFocus?: boolean;
  isWatched?: boolean;
}

const isMovie = (item: Movie | TVShow): item is Movie => 'title' in item;

// Memoized component for better performance on TV (prevents re-renders)
export const FocusableCard: React.FC<FocusableCardProps> = memo(({
  item,
  width = isTV ? theme.tv.cardWidth : theme.mobile.cardWidth,
  height = isTV ? theme.tv.cardHeight : theme.mobile.cardHeight,
  index = 0,
  autoFocus = false,
  isWatched = false,
}) => {
  const router = useRouter();
  const [isFocused, setIsFocused] = useState(false);

  const imageUrl = tmdbService.getImageUrl(item.poster_path, 'w342');
  const displayTitle = isMovie(item) ? item.title : item.name;
  const year = isMovie(item)
    ? item.release_date?.split('-')[0]
    : item.first_air_date?.split('-')[0];
  const showStatus = !isMovie(item) ? (item as TVShow).status : undefined;

  const handlePress = useCallback(() => {
    if (isMovie(item)) {
      router.push(`/movie/${item.id}`);
    } else {
      router.push(`/tv/${item.id}`);
    }
  }, [item, router]);

  return (
    <Pressable
      onPress={handlePress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={[
        styles.card,
        { width },
        isFocused && styles.cardFocused,
      ]}
      // TV-specific props
      {...(Platform.isTV && {
        hasTVPreferredFocus: autoFocus && index === 0,
        tvParallaxProperties: {
          enabled: true,
          magnification: 1.1,
        },
      })}
      data-testid={`content-card-${item.id}`}
    >
      <View style={[styles.imageContainer, { height }]}>
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
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>
            {item.vote_average.toFixed(1)}
          </Text>
        </View>
        {/* Watched tick */}
        {isWatched && (
          <View style={styles.watchedBadge} data-testid={`watched-${item.id}`}>
            <Text style={styles.watchedCheck}>✓</Text>
          </View>
        )}
        {/* Show status badge (Ended/Cancelled) */}
        {showStatus && (showStatus === 'Ended' || showStatus === 'Canceled') && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{showStatus}</Text>
          </View>
        )}
        {/* Focus Indicator Overlay */}
        {isFocused && (
          <View style={styles.focusOverlay}>
            <View style={styles.playIcon}>
              <Text style={styles.playIconText}>▶</Text>
            </View>
          </View>
        )}
      </View>
      <Text style={[styles.title, isFocused && styles.titleFocused]} numberOfLines={2}>
        {displayTitle}
      </Text>
      {year && <Text style={styles.year}>{year}</Text>}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: isTV ? 16 : 12,
    overflow: 'visible',
    borderWidth: isTV ? 4 : 3,
    borderColor: 'transparent',
  },
  cardFocused: {
    // MAXIMUM VISIBILITY for TV remote navigation
    transform: [{ scale: isTV ? 1.18 : 1.08 }],
    borderColor: '#FFFFFF',
    borderWidth: isTV ? 6 : 4,
    shadowColor: '#00D9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: isTV ? 45 : 30,
    elevation: 50,
    zIndex: 1000,
  },
  imageContainer: {
    borderRadius: isTV ? 14 : 10,
    overflow: 'hidden',
    marginBottom: isTV ? 12 : 8,
    borderWidth: 0,
    borderColor: 'transparent',
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
  ratingBadge: {
    position: 'absolute',
    top: isTV ? 12 : 8,
    right: isTV ? 12 : 8,
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
  },
  watchedCheck: {
    color: '#fff',
    fontSize: isTV ? 16 : 12,
    fontWeight: '900',
  },
  statusBadge: {
    position: 'absolute',
    bottom: isTV ? 8 : 6,
    left: isTV ? 8 : 6,
    backgroundColor: '#EF4444',
    borderRadius: 4,
    paddingHorizontal: isTV ? 6 : 4,
    paddingVertical: 1,
  },
  statusText: {
    color: '#fff',
    fontSize: isTV ? 10 : 8,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  focusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 217, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0, // Border is now on the card itself
    borderRadius: isTV ? 14 : 10,
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
  },
  title: {
    fontSize: isTV ? 18 : 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  titleFocused: {
    color: theme.colors.primary,
  },
  year: {
    fontSize: isTV ? 16 : 12,
    color: theme.colors.textSecondary,
  },
});

// Custom comparison for memo - only re-render if these props change
const areEqual = (prevProps: FocusableCardProps, nextProps: FocusableCardProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.isWatched === nextProps.isWatched &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height
  );
};

// Export with custom memo comparison
export default memo(FocusableCard, areEqual);
