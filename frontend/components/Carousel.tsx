import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
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
}

const isMovie = (item: Movie | TVShow): item is Movie => 'title' in item;

interface CarouselItemProps {
  item: Movie | TVShow;
  index: number;
  onPress: (item: Movie | TVShow) => void;
}

const CarouselItem: React.FC<CarouselItemProps> = ({ item, index, onPress }) => {
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
        {/* Focus Play Indicator */}
        {isFocused && (
          <View style={styles.focusPlayOverlay}>
            <View style={styles.playCircle}>
              <Text style={styles.playIcon}>▶</Text>
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

export const Carousel: React.FC<CarouselProps> = ({ title, data, onSeeAll }) => {
  const router = useRouter();

  const handlePress = useCallback((item: Movie | TVShow) => {
    if (isMovie(item)) {
      router.push(`/movie/${item.id}`);
    } else {
      router.push(`/tv/${item.id}`);
    }
  }, [router]);

  if (!data || data.length === 0) return null;

  return (
    <View style={styles.container} data-testid={`carousel-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} data-testid={`see-all-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {data.map((item, index) => (
          <CarouselItem
            key={item.id}
            item={item}
            index={index}
            onPress={handlePress}
          />
        ))}
      </ScrollView>
    </View>
  );
};

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
  listContent: {
    paddingHorizontal: isTV ? 50 : 16,
  },
  card: {
    width: CARD_WIDTH,
  },
  cardFocused: {
    transform: [{ scale: isTV ? 1.08 : 1.02 }],
  },
  imageContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: isTV ? 16 : 12,
    overflow: 'hidden',
    marginBottom: isTV ? 12 : 8,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  imageContainerFocused: {
    borderColor: theme.colors.focus,
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
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: isTV ? 12 : 8,
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
    backgroundColor: 'rgba(0, 217, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: isTV ? 70 : 50,
    height: isTV ? 70 : 50,
    borderRadius: isTV ? 35 : 25,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#000',
    fontSize: isTV ? 28 : 20,
    fontWeight: 'bold',
    marginLeft: isTV ? 4 : 2,
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
