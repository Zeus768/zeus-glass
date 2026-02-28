import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { Carousel } from '../components/Carousel';
import { useContentStore } from '../store/contentStore';
import { tmdbService } from '../services/tmdb';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.65;

export default function HomeScreen() {
  const {
    trendingMovies,
    popularMovies,
    nowPlayingMovies,
    trendingTVShows,
    popularTVShows,
    continueWatching,
    favorites,
    loading,
    loadHomeContent,
    loadContinueWatching,
    loadFavorites,
  } = useContentStore();

  const [refreshing, setRefreshing] = useState(false);
  const [heroMovie, setHeroMovie] = useState<any>(null);

  useEffect(() => {
    if (trendingMovies.length > 0 && !heroMovie) {
      setHeroMovie(trendingMovies[0]);
    }
  }, [trendingMovies]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadHomeContent(),
      loadContinueWatching(),
      loadFavorites(),
    ]);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Hero Section */}
        {heroMovie && (
          <View style={styles.heroContainer}>
            <Image
              source={{ uri: tmdbService.getImageUrl(heroMovie.backdrop_path, 'original') }}
              style={styles.heroImage}
              contentFit="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(10, 14, 39, 0.8)', theme.colors.background]}
              style={styles.heroGradient}
              locations={[0, 0.6, 1]}
            />
            <SafeAreaView style={styles.heroContent} edges={['top']}>
              {/* Top Bar with Logo */}
              <View style={styles.header}>
                <Text style={styles.appName}>ZEUS GLASS</Text>
                <View style={styles.headerRight}>
                  <Ionicons name="time-outline" size={20} color={theme.colors.text} />
                  <Text style={styles.timeText}>00:30</Text>
                </View>
              </View>

              {/* Featured Content */}
              <View style={styles.heroInfo}>
                <View style={styles.trendingBadge}>
                  <Ionicons name="star" size={14} color={theme.colors.primary} />
                  <Text style={styles.trendingText}>Trending Now</Text>
                </View>
                <Text style={styles.heroTitle} numberOfLines={2}>{heroMovie.title}</Text>
                <Text style={styles.heroDescription} numberOfLines={3}>
                  {heroMovie.overview}
                </Text>

                {/* Channel Badge (like Sky Atlantic) */}
                <View style={styles.channelBadge}>
                  <Text style={styles.channelText}>ZEUS</Text>
                  <View style={styles.ratingBox}>
                    <Text style={styles.ratingBoxText}>18</Text>
                  </View>
                </View>

                {/* Buttons */}
                <View style={styles.heroButtons}>
                  <Pressable 
                    style={styles.watchButton}
                    onPress={() => router.push(`/movie/${heroMovie.id}`)}
                  >
                    <Ionicons name="play" size={20} color={theme.colors.background} />
                    <Text style={styles.watchButtonText}>Watch Now</Text>
                  </Pressable>
                  <Pressable style={styles.addButton}>
                    <Ionicons name="add" size={20} color={theme.colors.text} />
                    <Text style={styles.addButtonText}>Playlist</Text>
                  </Pressable>
                  <Pressable style={styles.infoButton}>
                    <Ionicons name="information-circle-outline" size={20} color={theme.colors.text} />
                  </Pressable>
                </View>
              </View>
            </SafeAreaView>
          </View>
        )}

        {/* Carousels */}
        <View style={styles.carouselsContainer}>
          {continueWatching.length > 0 && (
            <Carousel title="Continue Watching" data={continueWatching.map((item) => item.media)} />
          )}
          
          {favorites.length > 0 && (
            <Carousel title="My Favorites" data={favorites} />
          )}

          <Carousel title="Trending Movies" data={trendingMovies} />
          <Carousel title="Popular Movies" data={popularMovies} />
          <Carousel title="In Cinemas" data={nowPlayingMovies} />
          <Carousel title="Trending TV Shows" data={trendingTVShows} />
          <Carousel title="Popular TV Shows" data={popularTVShows} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  heroContainer: {
    height: HERO_HEIGHT,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT,
  },
  heroContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  appName: {
    fontSize: 20,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    letterSpacing: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  heroInfo: {
    paddingHorizontal: theme.spacing.lg,
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
  },
  trendingText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.background,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    lineHeight: 48,
  },
  heroDescription: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    gap: 8,
  },
  channelText: {
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
  },
  ratingBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  ratingBoxText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    gap: 8,
  },
  watchButtonText: {
    fontSize: 16,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.background,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  infoButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 14,
    borderRadius: theme.borderRadius.md,
  },
  carouselsContainer: {
    paddingVertical: theme.spacing.xl,
  },
});
