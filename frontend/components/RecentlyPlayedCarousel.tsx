import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, isTV } from '../constants/theme';
import { tmdbService } from '../services/tmdb';
import { WatchHistoryItem } from '../services/watchHistoryService';
import { formatDistanceToNow } from 'date-fns';

const CARD_WIDTH = isTV ? 260 : 200;
const CARD_HEIGHT = isTV ? 150 : 120;
const CARD_SPACING = isTV ? 14 : 10;

interface RecentlyPlayedCarouselProps {
  items: WatchHistoryItem[];
}

const RecentlyPlayedCard: React.FC<{ item: WatchHistoryItem; index: number; onPress: (item: WatchHistoryItem) => void }> = ({ item, index, onPress }) => {
  const [isFocused, setIsFocused] = useState(false);

  const posterUrl = tmdbService.getImageUrl(item.backdrop_path || item.poster_path, 'w500');
  const progressPercent = Math.min(item.progress, 100);
  const timeAgo = item.watchedAt ? formatDistanceToNow(new Date(item.watchedAt), { addSuffix: true }) : '';
  const episodeLabel = item.type === 'tv' && item.season && item.episode 
    ? `S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}`
    : null;

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
      data-testid={`recently-played-${item.tmdbId}`}
      {...(Platform.isTV && { hasTVPreferredFocus: index === 0 })}
    >
      {isFocused && <View style={styles.focusGlow} />}

      <View style={[styles.imageContainer, isFocused && styles.imageContainerFocused]}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.image} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons name="film" size={isTV ? 36 : 28} color={theme.colors.textSecondary} />
          </View>
        )}

        {/* Dark overlay at bottom */}
        <View style={styles.gradient} />

        {/* Episode badge */}
        {episodeLabel && (
          <View style={styles.episodeBadge}>
            <Text style={styles.episodeBadgeText}>{episodeLabel}</Text>
          </View>
        )}

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
        </View>

        {/* Info overlay */}
        <View style={styles.infoOverlay}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>

        {/* Play overlay on focus */}
        {isFocused && (
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={isTV ? 24 : 18} color="#000" />
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
};

export const RecentlyPlayedCarousel: React.FC<RecentlyPlayedCarouselProps> = ({ items }) => {
  const router = useRouter();

  const handlePress = useCallback((item: WatchHistoryItem) => {
    if (item.type === 'movie') {
      router.push(`/movie/${item.tmdbId}`);
    } else {
      router.push(`/tv/${item.tmdbId}`);
    }
  }, [router]);

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.container} data-testid="recently-played-carousel">
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="time" size={isTV ? 24 : 18} color="#FF9500" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>Recently Played</Text>
        </View>
        <Text style={styles.subtitle}>{items.length} items</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {items.map((item, index) => (
          <RecentlyPlayedCard
            key={`${item.tmdbId}-${item.season || 0}-${item.episode || 0}`}
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
    marginBottom: isTV ? 28 : 22,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTV ? 60 : 16,
    marginBottom: isTV ? 14 : 10,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: isTV ? 10 : 8,
  },
  headerTitle: {
    fontSize: isTV ? 24 : 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: isTV ? 13 : 11,
    color: theme.colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: isTV ? 60 : 16,
    paddingBottom: 4,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: isTV ? 10 : 8,
    overflow: 'visible',
  },
  cardFocused: {
    transform: [{ scale: 1.05 }],
  },
  focusGlow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: isTV ? 13 : 11,
    borderWidth: 2,
    borderColor: '#FF9500',
    zIndex: -1,
  },
  imageContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: isTV ? 10 : 8,
    overflow: 'hidden',
    backgroundColor: theme.colors.cardBackground,
  },
  imageContainerFocused: {},
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  episodeBadge: {
    position: 'absolute',
    top: isTV ? 8 : 6,
    right: isTV ? 8 : 6,
    backgroundColor: '#FF9500',
    borderRadius: 4,
    paddingHorizontal: isTV ? 8 : 6,
    paddingVertical: isTV ? 3 : 2,
  },
  episodeBadgeText: {
    color: '#000',
    fontSize: isTV ? 11 : 9,
    fontWeight: '800',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: isTV ? 4 : 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF9500',
    borderRadius: 2,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: isTV ? 8 : 6,
    left: isTV ? 10 : 8,
    right: isTV ? 10 : 8,
  },
  title: {
    fontSize: isTV ? 14 : 12,
    fontWeight: '700',
    color: '#fff',
  },
  timeAgo: {
    fontSize: isTV ? 11 : 9,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playCircle: {
    width: isTV ? 48 : 36,
    height: isTV ? 48 : 36,
    borderRadius: isTV ? 24 : 18,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: isTV ? 3 : 2,
  },
});
