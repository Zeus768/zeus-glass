import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator, Modal, Alert, Linking } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../../constants/theme';
import { tmdbService } from '../../services/tmdb';
import { debridCacheService, realDebridService } from '../../services/debrid';
import { streamScraperService, StreamSource } from '../../services/streamScrapers';
import { useContentStore } from '../../store/contentStore';
import { Movie, CachedTorrent } from '../../types';
import { QUALITY_OPTIONS } from '../../config/constants';
import { errorLogService } from '../../services/errorLogService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MovieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { favorites, addToFavorites, removeFromFavorites, isFavorite } = useContentStore();
  
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [cachedTorrents, setCachedTorrents] = useState<CachedTorrent[]>([]);
  const [directStreams, setDirectStreams] = useState<StreamSource[]>([]);
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [selectedTorrent, setSelectedTorrent] = useState<CachedTorrent | null>(null);
  const [gettingStream, setGettingStream] = useState(false);
  const [activeTab, setActiveTab] = useState<'debrid' | 'direct'>('debrid');

  useEffect(() => {
    if (id) {
      loadMovieDetails();
    }
  }, [id]);

  const loadMovieDetails = async () => {
    setLoading(true);
    try {
      const movieData = await tmdbService.getMovieDetails(parseInt(id));
      setMovie(movieData);
    } catch (error) {
      console.error('Error loading movie details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStreamLinks = async () => {
    setLoadingLinks(true);
    setShowLinksModal(true);
    setCachedTorrents([]);
    setDirectStreams([]);
    
    try {
      if (!movie) return;
      
      const year = movie.release_date ? parseInt(movie.release_date.split('-')[0]) : undefined;
      const imdbId = movie.imdb_id || undefined;
      
      // Fetch both debrid and direct streams in parallel
      const [debridResults, directResults] = await Promise.allSettled([
        // Debrid cache search (only if logged in)
        (async () => {
          const token = await realDebridService.getToken();
          if (!token) {
            errorLogService.info('No Real-Debrid token, skipping debrid search', 'MovieDetail');
            return [];
          }
          errorLogService.info(`Searching cached torrents for "${movie.title}"`, 'MovieDetail');
          return await debridCacheService.searchCachedMovie(movie.title, year);
        })(),
        // Direct streaming sources
        (async () => {
          errorLogService.info(`Searching direct streams for "${movie.title}"`, 'MovieDetail');
          return await streamScraperService.getMovieStreams(id, imdbId, movie.title, year);
        })(),
      ]);
      
      // Process debrid results
      if (debridResults.status === 'fulfilled') {
        setCachedTorrents(debridResults.value);
        if (debridResults.value.length === 0) {
          errorLogService.warn(`No cached torrents found for "${movie.title}"`, 'MovieDetail');
        }
      }
      
      // Process direct stream results
      if (directResults.status === 'fulfilled') {
        setDirectStreams(directResults.value);
        errorLogService.info(`Found ${directResults.value.length} direct streams`, 'MovieDetail');
      }
      
      // If we have direct streams but no debrid, switch to direct tab
      if (debridResults.status === 'fulfilled' && debridResults.value.length === 0 && 
          directResults.status === 'fulfilled' && directResults.value.length > 0) {
        setActiveTab('direct');
      }
      
    } catch (error: any) {
      errorLogService.error(`Error loading streams: ${error.message}`, 'MovieDetail', error);
      Alert.alert('Error', 'Failed to load streams. Please try again.');
    } finally {
      setLoadingLinks(false);
    }
  };

  const handlePlayDirectStream = async (stream: StreamSource) => {
    try {
      if (stream.type === 'embed') {
        // Open embed URL in our player's WebView
        setShowLinksModal(false);
        router.push({
          pathname: '/player',
          params: { 
            url: stream.url, 
            title: movie?.title || 'Movie',
            type: 'embed'
          }
        });
      } else if (stream.type === 'torrent') {
        // For torrent links, try to resolve via Real-Debrid if available
        const token = await realDebridService.getToken();
        if (token && stream.url.startsWith('magnet:')) {
          errorLogService.info(`Resolving torrent via Real-Debrid: ${stream.name}`, 'MovieDetail');
          const directUrl = await realDebridService.addMagnetAndGetLink(stream.url, movie?.title || 'Movie');
          if (directUrl) {
            setShowLinksModal(false);
            router.push({
              pathname: '/player',
              params: { url: directUrl, title: movie?.title || 'Movie', type: 'video' }
            });
          } else {
            Alert.alert('Error', 'Failed to resolve torrent. Try another source.');
          }
        } else {
          Alert.alert('Login Required', 'Please login to Real-Debrid to play torrent sources.');
        }
      } else {
        // Direct stream - open in player
        setShowLinksModal(false);
        router.push({
          pathname: '/player',
          params: { url: stream.url, title: movie?.title || 'Movie', type: 'video' }
        });
      }
    } catch (error: any) {
      errorLogService.error(`Error playing stream: ${error.message}`, 'MovieDetail', error);
      Alert.alert('Error', 'Failed to play stream');
    }
  };

  const handlePlayTorrent = async (torrent: CachedTorrent) => {
    setSelectedTorrent(torrent);
    setGettingStream(true);
    
    try {
      if (torrent.cached) {
        errorLogService.info(`Getting cached stream for "${torrent.title}"`, 'MovieDetail');
      } else {
        errorLogService.info(`Starting download for "${torrent.title}" (not cached)`, 'MovieDetail');
      }
      
      // Get direct stream URL from Real-Debrid
      const streamUrl = await debridCacheService.getStreamUrl(
        torrent.hash,
        torrent.file_id
      );
      
      if (streamUrl) {
        errorLogService.info('Got stream URL, navigating to player', 'MovieDetail');
        setShowLinksModal(false);
        
        router.push({
          pathname: '/player',
          params: {
            url: streamUrl,
            title: movie?.title || 'Movie'
          }
        });
      } else {
        errorLogService.error('Failed to get stream URL', 'MovieDetail');
        Alert.alert('Error', 'Failed to get streaming link. Please try again.');
      }
    } catch (error: any) {
      errorLogService.error(`Stream error: ${error.message}`, 'MovieDetail', error);
      Alert.alert('Error', error.message || 'Failed to start stream');
    } finally {
      setGettingStream(false);
      setSelectedTorrent(null);
    }
  };

  const handleFavoriteToggle = () => {
    if (movie) {
      if (isFavorite(movie.id)) {
        removeFromFavorites(movie.id);
      } else {
        addToFavorites(movie);
      }
    }
  };

  const groupTorrentsByQuality = (torrents: CachedTorrent[]) => {
    const grouped: { [key: string]: CachedTorrent[] } = {
      '4K': [],
      '1080p': [],
      '720p': [],
      '480p': [],
    };
    
    torrents.forEach(torrent => {
      const quality = torrent.quality || '720p';
      if (grouped[quality]) {
        grouped[quality].push(torrent);
      } else {
        grouped['720p'].push(torrent);
      }
    });
    
    return grouped;
  };

  if (loading || !movie) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const backdropUrl = tmdbService.getImageUrl(movie.backdrop_path, 'original');
  const posterUrl = tmdbService.getImageUrl(movie.poster_path, 'w500');
  const year = movie.release_date?.split('-')[0];
  const groupedTorrents = groupTorrentsByQuality(cachedTorrents);
  const qualityOptions = ['4K', '1080p', '720p', '480p'];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          {backdropUrl && (
            <Image
              source={{ uri: backdropUrl }}
              style={styles.backdrop}
              contentFit="cover"
            />
          )}
          <LinearGradient
            colors={['transparent', theme.colors.background]}
            style={styles.gradient}
          />
          
          {/* Back Button */}
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.mainInfo}>
            {posterUrl && (
              <Image
                source={{ uri: posterUrl }}
                style={styles.poster}
                contentFit="cover"
              />
            )}
            <View style={styles.infoContainer}>
              <Text style={styles.title}>{movie.title}</Text>
              <View style={styles.metaRow}>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={16} color={theme.colors.gold} />
                  <Text style={styles.ratingText}>{movie.vote_average.toFixed(1)}</Text>
                </View>
                {year && <Text style={styles.metaText}>{year}</Text>}
                {movie.genres && movie.genres.length > 0 && (
                  <Text style={styles.metaText}>{movie.genres[0].name}</Text>
                )}
              </View>
              <Text style={styles.overview}>{movie.overview}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable style={styles.playButton} onPress={loadStreamLinks}>
              <Ionicons name="play" size={24} color={theme.colors.text} />
              <Text style={styles.playButtonText}>Play</Text>
            </Pressable>
            <Pressable
              style={styles.favoriteButton}
              onPress={handleFavoriteToggle}
            >
              <Ionicons
                name={isFavorite(movie.id) ? 'heart' : 'heart-outline'}
                size={24}
                color={isFavorite(movie.id) ? theme.colors.error : theme.colors.text}
              />
            </Pressable>
            <Pressable style={styles.shareButton}>
              <Ionicons name="share-outline" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Genres */}
          {movie.genres && movie.genres.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Genres</Text>
              <View style={styles.genresList}>
                {movie.genres.map((genre) => (
                  <View key={genre.id} style={styles.genreChip}>
                    <Text style={styles.genreText}>{genre.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Stream Links Modal */}
      <Modal
        visible={showLinksModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLinksModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Stream Sources</Text>
              <Pressable onPress={() => setShowLinksModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>
            
            {/* Tab Switcher */}
            <View style={styles.tabSwitcher}>
              <Pressable 
                style={[styles.tabButton, activeTab === 'debrid' && styles.tabButtonActive]}
                onPress={() => setActiveTab('debrid')}
              >
                <Ionicons name="flash" size={18} color={activeTab === 'debrid' ? '#000' : theme.colors.text} />
                <Text style={[styles.tabButtonText, activeTab === 'debrid' && styles.tabButtonTextActive]}>
                  Debrid ({cachedTorrents.length})
                </Text>
              </Pressable>
              <Pressable 
                style={[styles.tabButton, activeTab === 'direct' && styles.tabButtonActive]}
                onPress={() => setActiveTab('direct')}
              >
                <Ionicons name="globe" size={18} color={activeTab === 'direct' ? '#000' : theme.colors.text} />
                <Text style={[styles.tabButtonText, activeTab === 'direct' && styles.tabButtonTextActive]}>
                  Direct ({directStreams.length})
                </Text>
              </Pressable>
            </View>
            
            {loadingLinks ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Searching sources...</Text>
                <Text style={styles.loadingSubtext}>Torrentio • VidSrc • FlixMomo • YTS • More...</Text>
              </View>
            ) : activeTab === 'debrid' ? (
              // Debrid Tab Content
              cachedTorrents.length === 0 ? (
                <View style={styles.modalLoading}>
                  <Ionicons name="cloud-offline" size={48} color={theme.colors.textSecondary} />
                  <Text style={styles.loadingText}>No Debrid streams found</Text>
                  <Text style={styles.noLinksSubtext}>
                    Login to Real-Debrid or try Direct streams
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.modalScroll}>
                  {/* Stats bar */}
                  <View style={styles.statsBar}>
                    <View style={styles.statItem}>
                      <Ionicons name="flash" size={16} color={theme.colors.gold} />
                      <Text style={styles.statText}>
                        {cachedTorrents.filter(t => t.cached).length} Cached
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="cloud-download" size={16} color={theme.colors.primary} />
                      <Text style={styles.statText}>
                        {cachedTorrents.filter(t => !t.cached).length} Available
                      </Text>
                    </View>
                  </View>
                  
                  {qualityOptions.map((quality) => (
                    groupedTorrents[quality]?.length > 0 && (
                      <View key={quality} style={styles.qualitySection}>
                        <Text style={styles.qualityTitle}>{quality}</Text>
                        {groupedTorrents[quality].map((torrent, index) => (
                          <Pressable 
                            key={index} 
                            style={[
                              styles.linkCard,
                              !torrent.cached && styles.linkCardUncached,
                              selectedTorrent?.hash === torrent.hash && gettingStream && styles.linkCardActive
                            ]}
                            onPress={() => handlePlayTorrent(torrent)}
                            disabled={gettingStream}
                          >
                            <View style={styles.linkInfo}>
                              {torrent.cached ? (
                                <View style={styles.cachedBadge}>
                                  <Ionicons name="flash" size={12} color="#000" />
                                  <Text style={styles.cachedText}>CACHED</Text>
                                </View>
                              ) : (
                                <View style={styles.uncachedBadge}>
                                  <Ionicons name="cloud-download" size={12} color={theme.colors.text} />
                                  <Text style={styles.uncachedText}>DOWNLOAD</Text>
                                </View>
                              )}
                              <Text style={[styles.linkSource, !torrent.cached && styles.linkSourceUncached]}>
                                {torrent.source.toUpperCase()}
                              </Text>
                              {torrent.size && (
                                <Text style={[styles.linkSize, !torrent.cached && styles.linkSizeUncached]}>
                                  {torrent.size}
                                </Text>
                              )}
                              {torrent.seeders > 0 && (
                                <View style={styles.seedersContainer}>
                                  <Ionicons name="people" size={14} color={torrent.cached ? theme.colors.success : theme.colors.textSecondary} />
                                  <Text style={[styles.seedersText, !torrent.cached && styles.seedersTextUncached]}>
                                    {torrent.seeders}
                                  </Text>
                                </View>
                              )}
                            </View>
                            {selectedTorrent?.hash === torrent.hash && gettingStream ? (
                              <ActivityIndicator size="small" color={torrent.cached ? theme.colors.gold : theme.colors.primary} />
                            ) : (
                              <Ionicons 
                                name="play-circle" 
                                size={32} 
                                color={torrent.cached ? theme.colors.gold : theme.colors.primary} 
                              />
                            )}
                          </Pressable>
                        ))}
                      </View>
                    )
                  ))}
                </ScrollView>
              )
            ) : (
              // Direct Streams Tab Content
              directStreams.length === 0 ? (
                <View style={styles.modalLoading}>
                  <Ionicons name="globe-outline" size={48} color={theme.colors.textSecondary} />
                  <Text style={styles.loadingText}>No direct streams found</Text>
                  <Text style={styles.noLinksSubtext}>
                    Try Debrid sources for more options
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.modalScroll}>
                  <Text style={styles.directStreamNote}>
                    Direct streams open in browser or external player
                  </Text>
                  {directStreams.map((stream, index) => (
                    <Pressable 
                      key={index} 
                      style={styles.directLinkCard}
                      onPress={() => handlePlayDirectStream(stream)}
                    >
                      <View style={styles.directLinkInfo}>
                        <View style={[
                          styles.streamTypeBadge,
                          stream.type === 'embed' && styles.streamTypeBadgeEmbed,
                          stream.type === 'torrent' && styles.streamTypeBadgeTorrent,
                          stream.type === 'direct' && styles.streamTypeBadgeDirect,
                        ]}>
                          <Ionicons 
                            name={stream.type === 'embed' ? 'globe' : stream.type === 'torrent' ? 'magnet' : 'play'} 
                            size={12} 
                            color="#fff" 
                          />
                          <Text style={styles.streamTypeBadgeText}>{stream.type.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.directLinkSource}>{stream.source}</Text>
                        <Text style={styles.directLinkQuality}>{stream.quality}</Text>
                      </View>
                      <Ionicons name="open-outline" size={24} color={theme.colors.primary} />
                    </Pressable>
                  ))}
                </ScrollView>
              )
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  heroContainer: {
    height: SCREEN_HEIGHT * 0.4,
    position: 'relative',
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: theme.spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.lg,
  },
  mainInfo: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
  },
  poster: {
    width: 120,
    height: 180,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.md,
  },
  infoContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.gold,
  },
  metaText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  overview: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  playButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  playButtonText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  favoriteButton: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  shareButton: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  genresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  genreChip: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  genreText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: SCREEN_HEIGHT * 0.8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  modalLoading: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  modalScroll: {
    padding: theme.spacing.lg,
  },
  qualitySection: {
    marginBottom: theme.spacing.lg,
  },
  qualityTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
  },
  linkCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  linkInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  linkSource: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  linkSize: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  seedersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seedersText: {
    marginLeft: 4,
    fontSize: theme.fontSize.sm,
    color: theme.colors.success,
  },
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    gap: 2,
  },
  cachedText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: '#000',
  },
  uncachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    gap: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  uncachedText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textSecondary,
  },
  linkCardActive: {
    borderColor: theme.colors.gold,
    borderWidth: 2,
  },
  linkCardUncached: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    opacity: 0.85,
  },
  linkSourceUncached: {
    color: theme.colors.textSecondary,
  },
  linkSizeUncached: {
    color: theme.colors.textMuted,
  },
  seedersTextUncached: {
    color: theme.colors.textSecondary,
  },
  noLinksSubtext: {
    marginTop: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  loadingSubtext: {
    marginTop: theme.spacing.xs,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  // Tab Switcher Styles
  tabSwitcher: {
    flexDirection: 'row',
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    gap: theme.spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  tabButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  tabButtonTextActive: {
    color: '#000',
  },
  // Direct Stream Styles
  directStreamNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  directLinkCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  directLinkInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  directLinkSource: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  directLinkQuality: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
  streamTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
    backgroundColor: theme.colors.textMuted,
  },
  streamTypeBadgeEmbed: {
    backgroundColor: '#7C4DFF',
  },
  streamTypeBadgeTorrent: {
    backgroundColor: '#FF6B6B',
  },
  streamTypeBadgeDirect: {
    backgroundColor: theme.colors.success,
  },
  streamTypeBadgeText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: '#fff',
  },
});
