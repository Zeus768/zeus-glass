import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, isTV } from '../constants/theme';
import { tmdbService } from '../services/tmdb';
import { NextUpItem } from '../stores/useWatchedStore';

const CARD_WIDTH = isTV ? 320 : 260;
const CARD_HEIGHT = isTV ? 200 : 160;
const CARD_SPACING = isTV ? 16 : 12;

interface NextUpCarouselProps {
  items: NextUpItem[];
  isLoading?: boolean;
}

const NextUpCard: React.FC<{ item: NextUpItem; index: number; onPress: (item: NextUpItem) => void }> = ({ item, index, onPress }) => {
  const [isFocused, setIsFocused] = useState(false);

  const stillUrl = tmdbService.getImageUrl(item.episodeStill, 'w500');
  const posterUrl = tmdbService.getImageUrl(item.showPoster, 'w185');
  const episodeLabel = `S${String(item.seasonNumber).padStart(2, '0')}E${String(item.episodeNumber).padStart(2, '0')}`;

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
      data-testid={`next-up-card-${item.showTmdbId}`}
      {...(Platform.isTV && { hasTVPreferredFocus: index === 0 })}
    >
      {isFocused && <View style={styles.focusGlow} />}
      
      <View style={[styles.imageContainer, isFocused && styles.imageContainerFocused]}>
        {stillUrl ? (
          <Image
            source={{ uri: stillUrl }}
            style={styles.stillImage}
            contentFit="cover"
            transition={200}
          />
        ) : posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.stillImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.stillImage, styles.placeholder]}>
            <Ionicons name="tv" size={isTV ? 40 : 30} color={theme.colors.textSecondary} />
          </View>
        )}

        {/* Dark gradient overlay */}
        <View style={styles.gradient} />

        {/* Episode badge */}
        <View style={styles.episodeBadge}>
          <Text style={styles.episodeBadgeText}>{episodeLabel}</Text>
        </View>

        {/* Play button overlay */}
        {isFocused && (
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={isTV ? 28 : 22} color="#000" />
            </View>
          </View>
        )}

        {/* Bottom info overlay */}
        <View style={styles.infoOverlay}>
          <Text style={styles.showTitle} numberOfLines={1}>{item.showTitle}</Text>
          <Text style={styles.episodeTitle} numberOfLines={1}>{item.episodeTitle}</Text>
        </View>
      </View>
    </Pressable>
  );
};

export const NextUpCarousel: React.FC<NextUpCarouselProps> = ({ items, isLoading }) => {
  const router = useRouter();

  const handlePress = useCallback((item: NextUpItem) => {
    router.push(`/tv/${item.showTmdbId}`);
  }, [router]);

  if (!items || items.length === 0) {
    if (isLoading) {
      return (
        <View style={styles.container} data-testid="next-up-loading">
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Ionicons name="play-forward" size={isTV ? 28 : 20} color="#22C55E" style={styles.headerIcon} />
              <Text style={styles.headerTitle}>Next Up</Text>
            </View>
          </View>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading your shows...</Text>
          </View>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={styles.container} data-testid="next-up-carousel">
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="play-forward" size={isTV ? 28 : 20} color="#22C55E" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>Next Up</Text>
        </View>
        <Text style={styles.subtitle}>Continue watching your shows</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {items.map((item, index) => (
          <NextUpCard
            key={`${item.showTmdbId}-${item.seasonNumber}-${item.episodeNumber}`}
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
    marginBottom: isTV ? 30 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTV ? 60 : 16,
    marginBottom: isTV ? 16 : 12,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: isTV ? 12 : 8,
  },
  headerTitle: {
    fontSize: isTV ? 26 : 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: isTV ? 60 : 16,
    paddingBottom: 4,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: isTV ? 12 : 10,
    overflow: 'visible',
  },
  cardFocused: {
    transform: [{ scale: 1.05 }],
  },
  focusGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: isTV ? 16 : 14,
    borderWidth: 3,
    borderColor: '#22C55E',
    zIndex: -1,
  },
  imageContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: isTV ? 12 : 10,
    overflow: 'hidden',
    backgroundColor: theme.colors.cardBackground,
  },
  imageContainerFocused: {
    borderWidth: 0,
  },
  stillImage: {
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
    height: '60%',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  episodeBadge: {
    position: 'absolute',
    top: isTV ? 10 : 8,
    right: isTV ? 10 : 8,
    backgroundColor: '#22C55E',
    borderRadius: 6,
    paddingHorizontal: isTV ? 10 : 8,
    paddingVertical: isTV ? 4 : 3,
  },
  episodeBadgeText: {
    color: '#000',
    fontSize: isTV ? 13 : 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playCircle: {
    width: isTV ? 56 : 44,
    height: isTV ? 56 : 44,
    borderRadius: isTV ? 28 : 22,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: isTV ? 4 : 3,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: isTV ? 14 : 10,
  },
  showTitle: {
    fontSize: isTV ? 16 : 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  episodeTitle: {
    fontSize: isTV ? 13 : 11,
    color: 'rgba(255,255,255,0.8)',
  },
  loadingContainer: {
    paddingHorizontal: isTV ? 60 : 16,
    paddingVertical: isTV ? 30 : 20,
  },
  loadingText: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textSecondary,
  },
});
