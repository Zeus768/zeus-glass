import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, isTV } from '../constants/theme';
import { WatchHistoryItem } from '../services/watchHistoryService';
import { tmdbService } from '../services/tmdb';

interface ContinueWatchingCarouselProps {
  data: WatchHistoryItem[];
  title?: string;
}

const CARD_WIDTH = isTV ? 280 : 200;
const CARD_HEIGHT = isTV ? 170 : 120;

export function ContinueWatchingCarousel({ data, title = 'Continue Watching' }: ContinueWatchingCarouselProps) {
  const router = useRouter();
  const [focusedId, setFocusedId] = React.useState<string | null>(null);

  if (data.length === 0) return null;

  const handlePress = (item: WatchHistoryItem) => {
    if (item.type === 'movie') {
      router.push(`/movie/${item.tmdbId}`);
    } else {
      router.push(`/tv/${item.tmdbId}`);
    }
  };

  const formatProgress = (progress: number) => {
    return `${Math.round(progress)}% watched`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m left`;
    }
    return `${mins}m left`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="play-circle" size={isTV ? 24 : 18} color={theme.colors.primary} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.count}>{data.length} items</Text>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {data.map((item) => {
          const isFocused = focusedId === `${item.type}-${item.tmdbId}`;
          const remainingTime = item.duration - item.currentTime;
          
          return (
            <Pressable
              key={`${item.type}-${item.tmdbId}-${item.season || ''}-${item.episode || ''}`}
              style={[styles.card, isFocused && styles.cardFocused]}
              onPress={() => handlePress(item)}
              onFocus={() => setFocusedId(`${item.type}-${item.tmdbId}`)}
              onBlur={() => setFocusedId(null)}
              data-testid={`continue-watching-${item.tmdbId}`}
            >
              <View style={styles.imageContainer}>
                {item.backdrop_path ? (
                  <Image
                    source={{ uri: tmdbService.getImageUrl(item.backdrop_path, 'w500') }}
                    style={styles.image}
                    contentFit="cover"
                  />
                ) : item.poster_path ? (
                  <Image
                    source={{ uri: tmdbService.getImageUrl(item.poster_path, 'w342') }}
                    style={styles.image}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.image, styles.placeholderImage]}>
                    <Ionicons name="film" size={40} color={theme.colors.textMuted} />
                  </View>
                )}
                
                {/* Gradient overlay */}
                <View style={styles.gradient} />
                
                {/* Progress bar */}
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${item.progress}%` }]} />
                </View>
                
                {/* Play button overlay */}
                {isFocused && (
                  <View style={styles.playOverlay}>
                    <View style={styles.playButton}>
                      <Ionicons name="play" size={isTV ? 36 : 28} color="#000" />
                    </View>
                  </View>
                )}
                
                {/* Type badge */}
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {item.type === 'tv' ? 'TV' : 'MOVIE'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.info}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.type === 'tv' && item.season && item.episode && (
                  <Text style={styles.episodeInfo}>
                    S{item.season} E{item.episode} {item.episodeTitle ? `- ${item.episodeTitle}` : ''}
                  </Text>
                )}
                <View style={styles.progressInfo}>
                  <Text style={styles.progressText}>
                    {formatProgress(item.progress)}
                  </Text>
                  {remainingTime > 0 && (
                    <Text style={styles.timeText}>
                      {formatTime(remainingTime)}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: isTV ? 30 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTV ? 40 : 16,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: isTV ? 22 : 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  count: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textSecondary,
  },
  scrollContent: {
    paddingHorizontal: isTV ? 40 : 16,
    gap: isTV ? 16 : 12,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: isTV ? 14 : 10,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardFocused: {
    borderColor: theme.colors.primary,
    transform: [{ scale: 1.02 }],
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 15,
  },
  imageContainer: {
    width: '100%',
    height: CARD_HEIGHT,
    position: 'relative',
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
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  playButton: {
    width: isTV ? 60 : 48,
    height: isTV ? 60 : 48,
    borderRadius: isTV ? 30 : 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  info: {
    padding: isTV ? 14 : 10,
  },
  itemTitle: {
    fontSize: isTV ? 16 : 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  episodeInfo: {
    fontSize: isTV ? 13 : 11,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: isTV ? 12 : 10,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  timeText: {
    fontSize: isTV ? 12 : 10,
    color: theme.colors.textMuted,
  },
});
