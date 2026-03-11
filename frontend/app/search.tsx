import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TextInput, Pressable, 
  ActivityIndicator, ScrollView, Dimensions 
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import { tmdbService } from '../services/tmdb';
import { iptvService } from '../services/iptv';
import { resolveUrlService } from '../services/resolveUrl';
import { Movie, TVShow, IPTVVODItem } from '../types';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

type MediaItem = (Movie | TVShow) & { media_type?: string };

interface SearchResult {
  type: 'movie' | 'tvshow' | 'iptv_movie' | 'iptv_series';
  item: MediaItem | IPTVVODItem;
  source: 'tmdb' | 'iptv';
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<MediaItem[]>([]);
  const [iptvMovieResults, setIptvMovieResults] = useState<IPTVVODItem[]>([]);
  const [iptvSeriesResults, setIptvSeriesResults] = useState<IPTVVODItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'tvshows' | 'iptv'>('all');
  const [hasDebrid, setHasDebrid] = useState(false);
  const [hasIPTV, setHasIPTV] = useState(false);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);

  useEffect(() => {
    // Check debrid status
    resolveUrlService.init().then(() => {
      setHasDebrid(resolveUrlService.hasDebridEnabled());
    });
    // Check IPTV status
    setHasIPTV(iptvService.isLoggedIn());
  }, []);

  const handleSearch = useCallback(async (searchQuery: string) => {
    setQuery(searchQuery);
    
    if (searchQuery.trim().length < 2) {
      setTmdbResults([]);
      setIptvMovieResults([]);
      setIptvSeriesResults([]);
      return;
    }

    setLoading(true);
    try {
      // Search TMDB
      const tmdbPromise = tmdbService.searchMulti(searchQuery);
      
      // Search IPTV VOD if logged in and (no debrid OR we want to show IPTV as additional source)
      let iptvMoviesPromise = Promise.resolve([] as IPTVVODItem[]);
      let iptvSeriesPromise = Promise.resolve([] as IPTVVODItem[]);
      
      if (hasIPTV) {
        iptvMoviesPromise = iptvService.searchVODMovies(searchQuery);
        iptvSeriesPromise = iptvService.searchVODSeries(searchQuery);
      }

      const [tmdb, iptvMovies, iptvSeries] = await Promise.all([
        tmdbPromise,
        iptvMoviesPromise,
        iptvSeriesPromise,
      ]);

      setTmdbResults(tmdb);
      setIptvMovieResults(iptvMovies);
      setIptvSeriesResults(iptvSeries);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  }, [hasIPTV]);

  const isMovie = (item: MediaItem): item is Movie => {
    return 'title' in item || item.media_type === 'movie';
  };

  const handleTMDBItemPress = (item: MediaItem) => {
    if (isMovie(item)) {
      router.push(`/movie/${item.id}`);
    } else {
      router.push(`/tv/${item.id}`);
    }
  };

  const handleIPTVItemPress = (item: IPTVVODItem, type: 'movie' | 'series') => {
    // Navigate to IPTV VOD player
    if (type === 'movie') {
      router.push({
        pathname: '/player',
        params: {
          url: item.stream_url || '',
          title: item.name,
          type: 'video',
          source: 'iptv',
        }
      });
    } else {
      // For series, go to episode selection (if exists) or play first episode
      router.push({
        pathname: '/iptv-vod-detail',
        params: {
          id: item.stream_id?.toString() || '',
          name: item.name,
          type: 'series',
        }
      });
    }
  };

  // Render TMDB item
  const renderTMDBItem = (item: MediaItem) => {
    const imageUrl = tmdbService.getImageUrl(item.poster_path, 'w185');
    const displayTitle = isMovie(item) ? item.title : (item as TVShow).name;
    const year = isMovie(item)
      ? item.release_date?.split('-')[0]
      : (item as TVShow).first_air_date?.split('-')[0];
    const key = `tmdb-${item.id}`;
    const isFocused = focusedItem === key;

    return (
      <Pressable 
        key={key}
        style={[styles.resultCard, isFocused && styles.resultCardFocused]} 
        onPress={() => handleTMDBItemPress(item)}
        onFocus={() => setFocusedItem(key)}
        onBlur={() => setFocusedItem(null)}
      >
        <View style={styles.posterContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.poster} contentFit="cover" />
          ) : (
            <View style={[styles.poster, styles.placeholderPoster]}>
              <Ionicons name="film-outline" size={32} color={theme.colors.textMuted} />
            </View>
          )}
        </View>
        <View style={styles.resultInfo}>
          <Text style={styles.resultTitle} numberOfLines={2}>{displayTitle}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.resultMeta}>{year} • {isMovie(item) ? 'Movie' : 'TV Show'}</Text>
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText}>TMDB</Text>
            </View>
          </View>
          <Text style={styles.resultOverview} numberOfLines={2}>{item.overview}</Text>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color={theme.colors.gold} />
            <Text style={styles.ratingText}>{item.vote_average?.toFixed(1) || 'N/A'}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  // Render IPTV VOD item (gold premium badge)
  const renderIPTVItem = (item: IPTVVODItem, type: 'movie' | 'series') => {
    const key = `iptv-${type}-${item.stream_id || item.name}`;
    const isFocused = focusedItem === key;

    return (
      <Pressable 
        key={key}
        style={[styles.resultCard, isFocused && styles.resultCardFocused]} 
        onPress={() => handleIPTVItemPress(item, type)}
        onFocus={() => setFocusedItem(key)}
        onBlur={() => setFocusedItem(null)}
      >
        <View style={styles.posterContainer}>
          {item.stream_icon || item.cover ? (
            <Image 
              source={{ uri: item.stream_icon || item.cover }} 
              style={styles.poster} 
              contentFit="cover" 
            />
          ) : (
            <View style={[styles.poster, styles.placeholderPoster]}>
              <Ionicons 
                name={type === 'movie' ? 'film-outline' : 'tv-outline'} 
                size={32} 
                color={theme.colors.textMuted} 
              />
            </View>
          )}
          {/* Gold IPTV Premium badge */}
          <View style={styles.iptvPremiumBadge}>
            <Ionicons name="diamond" size={10} color="#000" />
            <Text style={styles.iptvPremiumText}>IPTV PREMIUM</Text>
          </View>
        </View>
        <View style={styles.resultInfo}>
          <Text style={styles.resultTitle} numberOfLines={2}>{item.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.resultMeta}>
              {item.year || ''} • {type === 'movie' ? 'Movie' : 'Series'}
            </Text>
            <View style={[styles.sourceBadge, styles.iptvSourceBadge]}>
              <Text style={styles.iptvSourceBadgeText}>VOD</Text>
            </View>
          </View>
          {item.plot && (
            <Text style={styles.resultOverview} numberOfLines={2}>{item.plot}</Text>
          )}
          {item.rating && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color={theme.colors.gold} />
              <Text style={styles.ratingText}>{item.rating}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  // Get filtered results based on active tab
  const getFilteredResults = () => {
    switch (activeTab) {
      case 'movies':
        return [
          ...tmdbResults.filter(r => isMovie(r)).map(item => renderTMDBItem(item)),
          ...iptvMovieResults.map(item => renderIPTVItem(item, 'movie')),
        ];
      case 'tvshows':
        return [
          ...tmdbResults.filter(r => !isMovie(r)).map(item => renderTMDBItem(item)),
          ...iptvSeriesResults.map(item => renderIPTVItem(item, 'series')),
        ];
      case 'iptv':
        return [
          ...iptvMovieResults.map(item => renderIPTVItem(item, 'movie')),
          ...iptvSeriesResults.map(item => renderIPTVItem(item, 'series')),
        ];
      default: // 'all'
        return [
          ...tmdbResults.map(item => renderTMDBItem(item)),
          ...iptvMovieResults.map(item => renderIPTVItem(item, 'movie')),
          ...iptvSeriesResults.map(item => renderIPTVItem(item, 'series')),
        ];
    }
  };

  const totalResults = tmdbResults.length + iptvMovieResults.length + iptvSeriesResults.length;
  const iptvTotal = iptvMovieResults.length + iptvSeriesResults.length;

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search movies, TV shows, IPTV VOD..."
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={handleSearch}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => handleSearch('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      {totalResults > 0 && (
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable 
              style={[styles.tab, activeTab === 'all' && styles.tabActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                All ({totalResults})
              </Text>
            </Pressable>
            <Pressable 
              style={[styles.tab, activeTab === 'movies' && styles.tabActive]}
              onPress={() => setActiveTab('movies')}
            >
              <Text style={[styles.tabText, activeTab === 'movies' && styles.tabTextActive]}>
                Movies ({tmdbResults.filter(r => isMovie(r)).length + iptvMovieResults.length})
              </Text>
            </Pressable>
            <Pressable 
              style={[styles.tab, activeTab === 'tvshows' && styles.tabActive]}
              onPress={() => setActiveTab('tvshows')}
            >
              <Text style={[styles.tabText, activeTab === 'tvshows' && styles.tabTextActive]}>
                TV Shows ({tmdbResults.filter(r => !isMovie(r)).length + iptvSeriesResults.length})
              </Text>
            </Pressable>
            {hasIPTV && iptvTotal > 0 && (
              <Pressable 
                style={[styles.tab, styles.iptvTab, activeTab === 'iptv' && styles.tabActive]}
                onPress={() => setActiveTab('iptv')}
              >
                <Ionicons name="diamond" size={12} color={activeTab === 'iptv' ? '#000' : '#FFD700'} />
                <Text style={[
                  styles.tabText, 
                  styles.iptvTabText,
                  activeTab === 'iptv' && styles.tabTextActive
                ]}>
                  IPTV Premium ({iptvTotal})
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {/* Results */}
      {!loading && totalResults > 0 && (
        <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
          {getFilteredResults()}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* No Results */}
      {!loading && query.length >= 2 && totalResults === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>No results found for "{query}"</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      )}

      {/* Initial State */}
      {!loading && query.length < 2 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={64} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>Search for movies, TV shows</Text>
          {hasIPTV && (
            <View style={styles.iptvHint}>
              <Ionicons name="diamond" size={16} color="#FFD700" />
              <Text style={styles.iptvHintText}>IPTV VOD included in search</Text>
            </View>
          )}
          {!hasDebrid && !hasIPTV && (
            <Text style={styles.emptySubtext}>
              Connect Debrid or IPTV for premium content
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: isTV ? 20 : 50,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    marginHorizontal: isTV ? 40 : 16,
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: isTV ? 60 : 50,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: isTV ? 20 : 16,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  tabsContainer: {
    paddingHorizontal: isTV ? 40 : 16,
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontSize: isTV ? 16 : 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  iptvTab: {
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  iptvTabText: {
    color: '#FFD700',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: isTV ? 40 : 16,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  resultCardFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: isTV ? 1.02 : 1.01 }],
    shadowColor: '#00D9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: isTV ? 25 : 15,
    elevation: 30,
  },
  posterContainer: {
    position: 'relative',
  },
  poster: {
    width: isTV ? 120 : 100,
    height: isTV ? 180 : 150,
  },
  placeholderPoster: {
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iptvPremiumBadge: {
    position: 'absolute',
    top: 8,
    left: 0,
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  iptvPremiumText: {
    color: '#000',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  resultInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  resultTitle: {
    color: theme.colors.text,
    fontSize: isTV ? 18 : 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  resultMeta: {
    color: theme.colors.textSecondary,
    fontSize: isTV ? 14 : 12,
  },
  sourceBadge: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceBadgeText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  iptvSourceBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  iptvSourceBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
  },
  resultOverview: {
    color: theme.colors.textMuted,
    fontSize: isTV ? 13 : 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: theme.colors.gold,
    fontSize: isTV ? 14 : 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.textSecondary,
    marginTop: 12,
    fontSize: isTV ? 18 : 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: isTV ? 20 : 18,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: theme.colors.textMuted,
    fontSize: isTV ? 16 : 14,
    marginTop: 8,
    textAlign: 'center',
  },
  iptvHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  iptvHintText: {
    color: '#FFD700',
    fontSize: isTV ? 14 : 12,
  },
});
