import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable, RefreshControl, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, isTV } from '../constants/theme';
import { Carousel } from '../components/Carousel';
import { ContinueWatchingCarousel } from '../components/ContinueWatchingCarousel';
import { NextUpCarousel } from '../components/NextUpCarousel';
import { RecentlyPlayedCarousel } from '../components/RecentlyPlayedCarousel';
import { useContentStore } from '../store/contentStore';
import { tmdbService } from '../services/tmdb';
import { useWatchedStore } from '../stores/useWatchedStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = isTV ? SCREEN_HEIGHT * 0.75 : SCREEN_HEIGHT * 0.65;

export default function HomeScreen() {
  const router = useRouter();
  const {
    trendingMovies,
    popularMovies,
    nowPlayingMovies,
    trendingTVShows,
    popularTVShows,
    continueWatching,
    watchlistMovies,
    watchlistShows,
    favorites,
    localContinueWatching,
    localRecentlyWatched,
    loading,
    loadHomeContent,
    loadContinueWatching,
    loadLocalWatchHistory,
    loadFavorites,
    loadTraktLists,
  } = useContentStore();

  const [refreshing, setRefreshing] = useState(false);
  const [heroMovie, setHeroMovie] = useState<any>(null);
  const [heroFocused, setHeroFocused] = useState(false);

  // Watched status from Trakt
  const watchedMovies = useWatchedStore((s) => s.watchedMovies);
  const watchedShows = useWatchedStore((s) => s.watchedShows);
  const nextUpItems = useWatchedStore((s) => s.nextUpItems);
  const isLoadingNextUp = useWatchedStore((s) => s.isLoadingNextUp);
  const recommendedMovieIds = useWatchedStore((s) => s.recommendedMovieIds);
  const recommendedShowIds = useWatchedStore((s) => s.recommendedShowIds);

  // Recommended content (resolved from TMDB)
  const [recommendedMovies, setRecommendedMovies] = useState<any[]>([]);
  const [recommendedShows, setRecommendedShows] = useState<any[]>([]);

  useEffect(() => {
    if (trendingMovies.length > 0 && !heroMovie) {
      setHeroMovie(trendingMovies[0]);
    }
  }, [trendingMovies]);

  // Load Trakt lists on mount
  useEffect(() => {
    loadTraktLists();
    loadLocalWatchHistory();
  }, []);

  // Resolve recommendation IDs to full TMDB objects
  useEffect(() => {
    const loadRecommendedMovies = async () => {
      if (recommendedMovieIds.length === 0) return;
      try {
        const results = await tmdbService.getMoviesByIds(recommendedMovieIds.slice(0, 15));
        setRecommendedMovies(results);
      } catch {}
    };
    const loadRecommendedShows = async () => {
      if (recommendedShowIds.length === 0) return;
      try {
        const results = await tmdbService.getTVShowsByIds(recommendedShowIds.slice(0, 15));
        setRecommendedShows(results);
      } catch {}
    };
    loadRecommendedMovies();
    loadRecommendedShows();
  }, [recommendedMovieIds, recommendedShowIds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadHomeContent(),
      loadTraktLists(),
      loadFavorites(),
      loadLocalWatchHistory(),
    ]);
    setRefreshing(false);
  }, [loadHomeContent, loadTraktLists, loadFavorites, loadLocalWatchHistory]);

  const handleWatchNow = useCallback(() => {
    if (heroMovie) {
      router.push(`/movie/${heroMovie.id}`);
    }
  }, [heroMovie, router]);

  return (
    <View style={styles.container} data-testid="home-screen">
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
              locations={[0, 0.5, 1]}
            />
            <SafeAreaView style={styles.heroContent} edges={['top']}>
              {/* Featured Content */}
              <View style={styles.heroInfo}>
                <View style={styles.trendingBadge}>
                  <Ionicons name="star" size={isTV ? 20 : 14} color={theme.colors.primary} />
                  <Text style={styles.trendingText}>Trending Now</Text>
                </View>
                <Text style={styles.heroTitle} numberOfLines={2}>{heroMovie.title}</Text>
                <Text style={styles.heroDescription} numberOfLines={isTV ? 4 : 3}>
                  {heroMovie.overview}
                </Text>

                {/* Channel Badge */}
                <View style={styles.channelBadge}>
                  <Text style={styles.channelText}>ZEUS</Text>
                  <View style={styles.ratingBox}>
                    <Text style={styles.ratingBoxText}>{Math.round(heroMovie.vote_average)}</Text>
                  </View>
                </View>

                {/* Buttons */}
                <View style={styles.heroButtons}>
                  <Pressable 
                    style={[styles.watchButton, heroFocused && styles.watchButtonFocused]}
                    onPress={handleWatchNow}
                    onFocus={() => setHeroFocused(true)}
                    onBlur={() => setHeroFocused(false)}
                    data-testid="hero-watch-now"
                    {...(Platform.isTV && { hasTVPreferredFocus: true })}
                  >
                    <Ionicons name="play" size={isTV ? 28 : 20} color={theme.colors.background} />
                    <Text style={styles.watchButtonText}>Watch Now</Text>
                  </Pressable>
                  <Pressable style={styles.addButton} data-testid="hero-playlist">
                    <Ionicons name="add" size={isTV ? 28 : 20} color={theme.colors.text} />
                    <Text style={styles.addButtonText}>Playlist</Text>
                  </Pressable>
                  <Pressable style={styles.infoButton} data-testid="hero-info">
                    <Ionicons name="information-circle-outline" size={isTV ? 28 : 20} color={theme.colors.text} />
                  </Pressable>
                </View>
              </View>
            </SafeAreaView>
          </View>
        )}

        {/* Carousels */}
        <View style={styles.carouselsContainer}>
          {/* Local Continue Watching (with progress bars) */}
          {localContinueWatching.length > 0 && (
            <ContinueWatchingCarousel 
              title="Continue Watching" 
              data={localContinueWatching}
            />
          )}
          
          {/* Continue Watching - Trakt (fallback if no local history) */}
          {localContinueWatching.length === 0 && continueWatching.length > 0 && (
            <Carousel 
              title="Continue Watching (Trakt)" 
              data={continueWatching.map((item) => item.media)} 
              icon="play-circle"
            />
          )}

          {/* Next Up - Shows you're watching with next unwatched episode */}
          <NextUpCarousel items={nextUpItems} isLoading={isLoadingNextUp} />

          {/* Recently Played - Watch history with progress bars */}
          <RecentlyPlayedCarousel items={localRecentlyWatched} />
          
          {/* My Watchlist - Movies - Trakt */}
          {watchlistMovies.length > 0 && (
            <Carousel 
              title="My Watchlist (Movies)" 
              data={watchlistMovies} 
              icon="bookmark"
            />
          )}

          {/* My Watchlist - TV Shows - Trakt */}
          {watchlistShows.length > 0 && (
            <Carousel 
              title="My Watchlist (TV Shows)" 
              data={watchlistShows} 
              icon="bookmark"
            />
          )}
          
          {/* Local Favorites */}
          {favorites.length > 0 && (
            <Carousel 
              title="My Favorites" 
              data={favorites}
              icon="heart"
            />
          )}

          {/* Trakt Recommended Movies */}
          {recommendedMovies.length > 0 && (
            <Carousel 
              title="Recommended Movies" 
              data={recommendedMovies}
              icon="sparkles"
              watchedIds={watchedMovies}
            />
          )}

          {/* Trakt Recommended Shows */}
          {recommendedShows.length > 0 && (
            <Carousel 
              title="Recommended Shows" 
              data={recommendedShows}
              icon="sparkles"
              watchedIds={watchedShows}
            />
          )}

          {/* Trending Movies - with flame icon */}
          <Carousel title="Trending Movies" data={trendingMovies} icon="flame" watchedIds={watchedMovies} />
          
          {/* Trending TV Shows - with flame icon */}
          <Carousel title="Trending TV Shows" data={trendingTVShows} icon="flame" watchedIds={watchedShows} />
          
          {/* Popular Movies */}
          <Carousel title="Popular Movies" data={popularMovies} icon="star" watchedIds={watchedMovies} />
          
          {/* Popular TV Shows */}
          <Carousel title="Popular TV Shows" data={popularTVShows} icon="star" watchedIds={watchedShows} />
          
          {/* In Cinemas */}
          <Carousel title="In Cinemas" data={nowPlayingMovies} icon="film" watchedIds={watchedMovies} />
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
    justifyContent: 'flex-end',
    paddingBottom: isTV ? 60 : 32,
  },
  heroInfo: {
    paddingHorizontal: isTV ? 60 : 24,
    maxWidth: isTV ? 800 : '100%',
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: isTV ? 18 : 12,
    paddingVertical: isTV ? 10 : 6,
    borderRadius: theme.borderRadius.sm,
    marginBottom: isTV ? 24 : 16,
  },
  trendingText: {
    marginLeft: isTV ? 10 : 6,
    fontSize: isTV ? 18 : 13,
    fontWeight: '700',
    color: theme.colors.background,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: isTV ? 64 : 42,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: isTV ? 20 : 12,
    lineHeight: isTV ? 72 : 48,
  },
  heroDescription: {
    fontSize: isTV ? 22 : 15,
    color: theme.colors.textSecondary,
    lineHeight: isTV ? 32 : 22,
    marginBottom: isTV ? 24 : 16,
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: isTV ? 32 : 20,
    gap: isTV ? 16 : 8,
  },
  channelText: {
    fontSize: isTV ? 20 : 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  ratingBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: isTV ? 14 : 8,
    paddingVertical: isTV ? 6 : 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  ratingBoxText: {
    fontSize: isTV ? 16 : 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: isTV ? 24 : 16,
    alignItems: 'center',
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    paddingHorizontal: isTV ? 42 : 28,
    paddingVertical: isTV ? 20 : 14,
    borderRadius: isTV ? 16 : 12,
    gap: isTV ? 12 : 8,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  watchButtonFocused: {
    borderColor: theme.colors.focus,
    backgroundColor: theme.colors.primary,
  },
  watchButtonText: {
    fontSize: isTV ? 24 : 16,
    fontWeight: '700',
    color: theme.colors.background,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: isTV ? 32 : 20,
    paddingVertical: isTV ? 20 : 14,
    borderRadius: isTV ? 16 : 12,
    gap: isTV ? 12 : 8,
  },
  addButtonText: {
    fontSize: isTV ? 22 : 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  infoButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: isTV ? 20 : 14,
    borderRadius: isTV ? 16 : 12,
  },
  carouselsContainer: {
    paddingVertical: isTV ? 40 : 24,
  },
});
