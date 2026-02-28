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
              colors={['transparent', theme.colors.background]}
              style={styles.heroGradient}
            />
            <SafeAreaView style={styles.heroContent} edges={['top']}>
              {/* Logo / App Name */}
              <View style={styles.header}>
                <Text style={styles.appName}>ZEUS GLASS</Text>
                <Ionicons name="time-outline" size={24} color={theme.colors.text} />
              </View>

              {/* Featured Content */}
              <View style={styles.heroInfo}>
                <View style={styles.trendingBadge}>
                  <Ionicons name="trending-up" size={16} color={theme.colors.text} />
                  <Text style={styles.trendingText}>Trending Now</Text>
                </View>
                <Text style={styles.heroTitle}>{heroMovie.title}</Text>
                <Text style={styles.heroDescription} numberOfLines={3}>
                  {heroMovie.overview}
                </Text>

                {/* Buttons */}
                <View style={styles.heroButtons}>
                  <Pressable style={styles.watchButton}>
                    <Ionicons name="play" size={24} color={theme.colors.text} />
                    <Text style={styles.watchButtonText}>Watch Now</Text>
                  </Pressable>
                  <Pressable style={styles.addButton}>
                    <Ionicons name="add" size={24} color={theme.colors.text} />
                    <Text style={styles.addButtonText}>Playlist</Text>
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
    height: HERO_HEIGHT * 0.6,
  },
  heroContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  appName: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    letterSpacing: 2,
  },
  heroInfo: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 255, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
  },
  trendingText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  heroTitle: {
    fontSize: theme.fontSize.huge,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  heroDescription: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    flex: 1,
    justifyContent: 'center',
  },
  watchButtonText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.background,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
  },
  addButtonText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  carouselsContainer: {
    paddingVertical: theme.spacing.lg,
  },
});
