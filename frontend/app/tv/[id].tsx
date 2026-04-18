import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator, Modal, Alert, FlatList, Platform, BackHandler } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../../constants/theme';
import { tmdbService } from '../../services/tmdb';
import { debridCacheService, realDebridService } from '../../services/debrid';
import { streamScraperService, StreamSource } from '../../services/streamScrapers';
import { useContentStore } from '../../store/contentStore';
import { TVShow, CachedTorrent, Season, Episode } from '../../types';
import { errorLogService } from '../../services/errorLogService';
import { traktService } from '../../services/trakt';
import { PlayerChoice } from '../../components/PlayerChoice';
import { DebridDownloadDialog } from '../../components/DebridDownloadDialog';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export default function TVShowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { favorites, addToFavorites, removeFromFavorites, isFavorite } = useContentStore();
  
  const [tvShow, setTVShow] = useState<TVShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  
  // Stream modal states
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [cachedTorrents, setCachedTorrents] = useState<CachedTorrent[]>([]);
  const [directStreams, setDirectStreams] = useState<StreamSource[]>([]);
  const [activeTab, setActiveTab] = useState<'debrid' | 'direct'>('debrid');
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [gettingStream, setGettingStream] = useState(false);
  const [selectedTorrent, setSelectedTorrent] = useState<CachedTorrent | null>(null);
  
  // Focus states
  const [focusedSeason, setFocusedSeason] = useState<number | null>(null);
  const [focusedEpisode, setFocusedEpisode] = useState<number | null>(null);
  const [focusedStream, setFocusedStream] = useState<string | null>(null);
  const [nextUpEpisode, setNextUpEpisode] = useState<{ season: number; number: number; title: string } | null>(null);
  
  // Download dialog state
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadingTorrent, setDownloadingTorrent] = useState<CachedTorrent | null>(null);
  const [showProgress, setShowProgress] = useState<{ completed: number; aired: number } | null>(null);
  const [playerChoiceVisible, setPlayerChoiceVisible] = useState(false);
  const [pendingPlayerStream, setPendingPlayerStream] = useState<{ url: string; title: string } | null>(null);

  // TV Back button handler - navigate back to previous screen
  useFocusEffect(
    useCallback(() => {
      if (!Platform.isTV) return;
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (showLinksModal) {
          setShowLinksModal(false);
          return true;
        }
        router.back();
        return true;
      });
      return () => backHandler.remove();
    }, [showLinksModal])
  );

  useEffect(() => {
    if (id) {
      loadTVShowDetails();
      loadTraktProgress();
    }
  }, [id]);

  useEffect(() => {
    if (tvShow && selectedSeason) {
      loadSeasonEpisodes(selectedSeason);
    }
  }, [tvShow, selectedSeason]);

  const loadTVShowDetails = async () => {
    setLoading(true);
    try {
      const showData = await tmdbService.getTVShowDetails(parseInt(id));
      setTVShow(showData);
      
      // Set first season (skip season 0 which is usually specials)
      if (showData.seasons && showData.seasons.length > 0) {
        const firstSeason = showData.seasons.find(s => s.season_number > 0) || showData.seasons[0];
        setSelectedSeason(firstSeason.season_number);
      }
    } catch (error) {
      console.error('Error loading TV show details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTraktProgress = async () => {
    try {
      const isAuthed = await traktService.isAuthenticated();
      if (!isAuthed) return;
      
      // Get Trakt show ID from TMDB external IDs
      // We use the TMDB ID as lookup - Trakt supports this format
      const progress = await traktService.getShowProgress(parseInt(id));
      if (progress) {
        setNextUpEpisode(progress.nextEpisode);
        setShowProgress({ completed: progress.completed, aired: progress.aired });
        
        // Auto-jump to next up episode's season
        if (progress.nextEpisode) {
          setSelectedSeason(progress.nextEpisode.season);
        }
      }
    } catch (e) {
      console.warn('[TV Detail] Failed to load Trakt progress:', e);
    }
  };

  const loadSeasonEpisodes = async (seasonNum: number) => {
    setLoadingEpisodes(true);
    try {
      const seasonData = await tmdbService.getSeasonEpisodes(parseInt(id), seasonNum);
      setEpisodes(seasonData.episodes || []);
    } catch (error) {
      console.error('Error loading episodes:', error);
      setEpisodes([]);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const handleFavoriteToggle = () => {
    if (tvShow) {
      if (isFavorite(tvShow.id)) {
        removeFromFavorites(tvShow.id);
      } else {
        addToFavorites(tvShow);
      }
    }
  };

  const handleEpisodePress = (episode: Episode) => {
    setSelectedEpisode(episode);
    loadStreamLinks(episode);
  };

  const loadStreamLinks = async (episode: Episode) => {
    setLoadingLinks(true);
    setShowLinksModal(true);
    setCachedTorrents([]);
    setDirectStreams([]);
    
    try {
      if (!tvShow) return;
      
      // Use IMDB ID for Torrentio - this is critical!
      const imdbId = tvShow.imdb_id;
      
      errorLogService.info(`TV Show IMDB ID: ${imdbId || 'NOT FOUND'}`, 'TVDetail');
      
      // Fetch both debrid and direct streams in parallel
      const [debridResults, directResults] = await Promise.allSettled([
        // Debrid cache search - needs IMDB ID
        (async () => {
          errorLogService.info(`Searching Torrentio for "${tvShow.name}" S${episode.season_number}E${episode.episode_number} (IMDB: ${imdbId})`, 'TVDetail');
          return await debridCacheService.searchCachedTV(
            tvShow.name,
            episode.season_number,
            episode.episode_number,
            imdbId
          );
        })(),
        // Direct streaming sources
        (async () => {
          errorLogService.info(`Searching direct streams for "${tvShow.name}" S${episode.season_number}E${episode.episode_number}`, 'TVDetail');
          return await streamScraperService.getTVStreams(
            id, 
            imdbId, 
            tvShow.name, 
            episode.season_number, 
            episode.episode_number
          );
        })(),
      ]);
      
      if (debridResults.status === 'fulfilled') {
        setCachedTorrents(debridResults.value);
        errorLogService.info(`Found ${debridResults.value.length} torrent results`, 'TVDetail');
      }
      
      if (directResults.status === 'fulfilled') {
        setDirectStreams(directResults.value);
        if (debridResults.status === 'fulfilled' && debridResults.value.length === 0 && directResults.value.length > 0) {
          setActiveTab('direct');
        }
      }
    } catch (error: any) {
      errorLogService.error(`Error loading streams: ${error.message}`, 'TVDetail', error);
      Alert.alert('Error', 'Failed to load streams.');
    } finally {
      setLoadingLinks(false);
    }
  };

  const handlePlayTorrent = async (torrent: CachedTorrent) => {
    // Close the links modal and open the download dialog
    setShowLinksModal(false);
    setDownloadingTorrent(torrent);
    setShowDownloadDialog(true);
  };
  
  const handleStreamReady = (streamUrl: string) => {
    setShowDownloadDialog(false);
    setDownloadingTorrent(null);
    
    // Navigate to player
    const title = `${tvShow?.name} S${selectedEpisode?.season_number}E${selectedEpisode?.episode_number}`;
    setPendingPlayerStream({ url: streamUrl, title });
    setPlayerChoiceVisible(true);
  };

  const handlePlayDirectStream = async (stream: StreamSource) => {
    setShowLinksModal(false);
    const title = `${tvShow?.name} S${selectedEpisode?.season_number}E${selectedEpisode?.episode_number}`;
    setPendingPlayerStream({ url: stream.url, title });
    setPlayerChoiceVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!tvShow) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color={theme.colors.error} />
        <Text style={styles.errorText}>Failed to load TV show</Text>
      </View>
    );
  }

  const validSeasons = tvShow.seasons?.filter(s => s.season_number > 0) || [];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Backdrop Header */}
        <View style={styles.header}>
          <Image
            source={{ uri: `${TMDB_IMAGE_BASE}/w1280${tvShow.backdrop_path}` }}
            style={styles.backdrop}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(10, 14, 39, 0.8)', theme.colors.background]}
            style={styles.gradient}
          />
          
          {/* Back Button */}
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </Pressable>
        </View>

        {/* Show Info */}
        <View style={styles.content}>
          <View style={styles.infoRow}>
            <Image
              source={{ uri: `${TMDB_IMAGE_BASE}/w342${tvShow.poster_path}` }}
              style={styles.poster}
              contentFit="cover"
            />
            <View style={styles.infoText}>
              <Text style={styles.title}>{tvShow.name}</Text>
              <View style={styles.metaRow}>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={16} color={theme.colors.gold} />
                  <Text style={styles.ratingText}>{tvShow.vote_average?.toFixed(1)}</Text>
                </View>
                <Text style={styles.year}>
                  {tvShow.first_air_date?.split('-')[0]}
                </Text>
                {tvShow.number_of_seasons && (
                  <Text style={styles.seasons}>
                    {tvShow.number_of_seasons} Season{tvShow.number_of_seasons > 1 ? 's' : ''}
                  </Text>
                )}
                {/* Show status badge */}
                {tvShow.status && (
                  <View style={[
                    styles.statusBadge,
                    tvShow.status === 'Ended' || tvShow.status === 'Canceled' 
                      ? styles.statusBadgeEnded 
                      : styles.statusBadgeAiring,
                  ]}>
                    <Text style={styles.statusBadgeText}>
                      {tvShow.status === 'Returning Series' ? 'Airing' : tvShow.status}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.overview} numberOfLines={4}>{tvShow.overview}</Text>
              
              {/* Favorite Button */}
              <Pressable style={styles.favButton} onPress={handleFavoriteToggle}>
                <Ionicons
                  name={isFavorite(tvShow.id) ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isFavorite(tvShow.id) ? theme.colors.error : theme.colors.text}
                />
                <Text style={styles.favButtonText}>
                  {isFavorite(tvShow.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Next Up Episode (from Trakt) */}
          {nextUpEpisode && (
            <Pressable 
              style={styles.nextUpContainer}
              onPress={() => {
                setSelectedSeason(nextUpEpisode.season);
                // The episode will be visible in the episodes list
              }}
              data-testid="next-up-episode"
            >
              <View style={styles.nextUpHeader}>
                <Ionicons name="play-forward" size={20} color={theme.colors.primary} />
                <Text style={styles.nextUpLabel}>NEXT UP</Text>
              </View>
              <Text style={styles.nextUpTitle}>
                S{nextUpEpisode.season}E{nextUpEpisode.number} - {nextUpEpisode.title}
              </Text>
              {showProgress && (
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { width: `${Math.round((showProgress.completed / Math.max(showProgress.aired, 1)) * 100)}%` }
                    ]} 
                  />
                  <Text style={styles.progressText}>
                    {showProgress.completed}/{showProgress.aired} episodes watched
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Season Selector */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Seasons</Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.seasonsScroll}
            contentContainerStyle={styles.seasonsContent}
          >
            {validSeasons.map((season) => {
              const isFocused = focusedSeason === season.season_number;
              const isSelected = selectedSeason === season.season_number;
              return (
                <Pressable
                  key={season.id}
                  onPress={() => setSelectedSeason(season.season_number)}
                  onFocus={() => setFocusedSeason(season.season_number)}
                  onBlur={() => setFocusedSeason(null)}
                  style={[
                    styles.seasonButton,
                    isSelected && styles.seasonButtonActive,
                    isFocused && styles.seasonButtonFocused,
                  ]}
                >
                  <Text style={[
                    styles.seasonButtonText,
                    isSelected && styles.seasonButtonTextActive,
                  ]}>
                    Season {season.season_number}
                  </Text>
                  <Text style={styles.seasonEpisodeCount}>
                    {season.episode_count} Episodes
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Episodes List */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Episodes</Text>
            {loadingEpisodes && (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            )}
          </View>
          
          {loadingEpisodes ? (
            <View style={styles.episodesLoading}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading episodes...</Text>
            </View>
          ) : episodes.length === 0 ? (
            <View style={styles.episodesLoading}>
              <Text style={styles.noEpisodes}>No episodes found</Text>
            </View>
          ) : (
            <View style={styles.episodesList}>
              {episodes.map((episode) => {
                const isFocused = focusedEpisode === episode.episode_number;
                return (
                  <Pressable
                    key={episode.id}
                    onPress={() => handleEpisodePress(episode)}
                    onFocus={() => setFocusedEpisode(episode.episode_number)}
                    onBlur={() => setFocusedEpisode(null)}
                    style={[
                      styles.episodeCard,
                      isFocused && styles.episodeCardFocused,
                    ]}
                  >
                    <View style={styles.episodeThumb}>
                      {episode.still_path ? (
                        <Image
                          source={{ uri: `${TMDB_IMAGE_BASE}/w300${episode.still_path}` }}
                          style={styles.episodeImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.episodePlaceholder}>
                          <Ionicons name="tv" size={32} color={theme.colors.textMuted} />
                        </View>
                      )}
                      {isFocused && (
                        <View style={styles.episodePlayOverlay}>
                          <Ionicons name="play-circle" size={48} color="#fff" />
                        </View>
                      )}
                      <View style={styles.episodeNumber}>
                        <Text style={styles.episodeNumberText}>E{episode.episode_number}</Text>
                      </View>
                    </View>
                    <View style={styles.episodeInfo}>
                      <Text style={styles.episodeTitle} numberOfLines={1}>
                        {episode.name}
                      </Text>
                      {episode.overview && (
                        <Text style={styles.episodeOverview} numberOfLines={2}>
                          {episode.overview}
                        </Text>
                      )}
                      <View style={styles.episodeMeta}>
                        {episode.air_date && (
                          <Text style={styles.episodeAirDate}>
                            {new Date(episode.air_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        )}
                        {episode.runtime && (
                          <Text style={styles.episodeRuntime}>{episode.runtime}m</Text>
                        )}
                        {episode.vote_average ? (
                          <View style={styles.episodeRating}>
                            <Ionicons name="star" size={12} color={theme.colors.gold} />
                            <Text style={styles.episodeRatingText}>
                              {episode.vote_average.toFixed(1)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Ionicons name="play" size={24} color={theme.colors.primary} />
                  </Pressable>
                );
              })}
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
              <Text style={styles.modalTitle}>
                S{selectedEpisode?.season_number}E{selectedEpisode?.episode_number}: {selectedEpisode?.name}
              </Text>
              <Pressable onPress={() => setShowLinksModal(false)}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
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
              </View>
            ) : activeTab === 'debrid' ? (
              cachedTorrents.length === 0 ? (
                <View style={styles.modalLoading}>
                  <Ionicons name="cloud-offline" size={48} color={theme.colors.textSecondary} />
                  <Text style={styles.loadingText}>No Debrid streams found</Text>
                  <Text style={styles.noStreamsHint}>Try Direct streams or login to Real-Debrid</Text>
                </View>
              ) : (
                <ScrollView style={styles.modalScroll}>
                  {cachedTorrents.map((torrent, index) => {
                    const isFocused = focusedStream === `torrent-${torrent.hash}`;
                    const isSelected = selectedTorrent?.hash === torrent.hash;
                    
                    return (
                      <Pressable 
                        key={index} 
                        style={[
                          styles.linkCard, 
                          isSelected && gettingStream && styles.linkCardActive,
                          isFocused && styles.linkCardFocused,
                        ]}
                        onPress={() => handlePlayTorrent(torrent)}
                        onFocus={() => setFocusedStream(`torrent-${torrent.hash}`)}
                        onBlur={() => setFocusedStream(null)}
                        disabled={gettingStream}
                        data-testid={`torrent-${torrent.hash?.substring(0, 8)}`}
                      >
                        <View style={styles.linkInfo}>
                          <View style={torrent.cached ? styles.cachedBadge : styles.torrentBadge}>
                            <Ionicons name={torrent.cached ? "flash" : "magnet"} size={12} color={torrent.cached ? "#000" : theme.colors.text} />
                            <Text style={torrent.cached ? styles.cachedText : styles.torrentText}>
                              {torrent.cached ? 'INSTANT' : 'TORRENT'}
                            </Text>
                          </View>
                          <Text style={[styles.linkSource, isFocused && styles.linkSourceFocused]}>
                            {torrent.source.toUpperCase()}
                          </Text>
                          {torrent.size && (
                            <Text style={[styles.linkSize, isFocused && styles.linkSizeFocused]}>
                              {torrent.size}
                            </Text>
                          )}
                          {torrent.quality && (
                            <Text style={[styles.linkQuality, isFocused && styles.linkQualityFocused]}>
                              {torrent.quality}
                            </Text>
                          )}
                        </View>
                        {isSelected && gettingStream ? (
                          <ActivityIndicator size="small" color={theme.colors.gold} />
                        ) : (
                          <Ionicons 
                            name="play-circle" 
                            size={isTV ? 28 : 32} 
                            color={isFocused ? '#000' : (torrent.cached ? theme.colors.gold : theme.colors.primary)} 
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )
            ) : (
              directStreams.length === 0 ? (
                <View style={styles.modalLoading}>
                  <Ionicons name="globe-outline" size={48} color={theme.colors.textSecondary} />
                  <Text style={styles.loadingText}>No direct streams found</Text>
                </View>
              ) : (
                <ScrollView style={styles.modalScroll}>
                  {directStreams.map((stream, index) => (
                    <Pressable 
                      key={index} 
                      style={styles.linkCard}
                      onPress={() => handlePlayDirectStream(stream)}
                    >
                      <View style={styles.linkInfo}>
                        <View style={[styles.streamTypeBadge, stream.type === 'embed' && styles.streamTypeBadgeEmbed]}>
                          <Ionicons name={stream.type === 'embed' ? 'globe' : 'play'} size={12} color="#fff" />
                          <Text style={styles.streamTypeBadgeText}>{stream.type.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.linkSource}>{stream.source}</Text>
                        <Text style={styles.linkQuality}>{stream.quality}</Text>
                      </View>
                      <Ionicons name="play-circle" size={32} color={theme.colors.primary} />
                    </Pressable>
                  ))}
                </ScrollView>
              )
            )}
          </View>
        </View>
      </Modal>
      
      {/* Player Choice Dialog */}
      {pendingPlayerStream && (
        <PlayerChoice
          visible={playerChoiceVisible}
          onClose={() => setPlayerChoiceVisible(false)}
          streamUrl={pendingPlayerStream.url}
          title={pendingPlayerStream.title}
          type="tv"
        />
      )}
      
      {/* Debrid Download Progress Dialog */}
      <DebridDownloadDialog
        visible={showDownloadDialog}
        torrent={downloadingTorrent}
        onClose={() => {
          setShowDownloadDialog(false);
          setDownloadingTorrent(null);
        }}
        onStreamReady={handleStreamReady}
      />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  errorText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.lg,
    color: theme.colors.error,
  },
  // Header
  header: {
    height: isTV ? 400 : 280,
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
    height: '70%',
  },
  backButton: {
    position: 'absolute',
    top: isTV ? 30 : 48,
    left: isTV ? 30 : 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Content
  content: {
    paddingHorizontal: isTV ? 40 : 16,
    marginTop: -60,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
  },
  poster: {
    width: isTV ? 180 : 120,
    height: isTV ? 270 : 180,
    borderRadius: theme.borderRadius.md,
  },
  infoText: {
    flex: 1,
    marginLeft: theme.spacing.lg,
    justifyContent: 'center',
  },
  title: {
    fontSize: isTV ? 32 : 24,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  ratingText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.gold,
  },
  year: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  seasons: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 4,
  },
  statusBadgeEnded: {
    backgroundColor: '#EF4444',
  },
  statusBadgeAiring: {
    backgroundColor: '#22C55E',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  overview: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textSecondary,
    lineHeight: isTV ? 24 : 20,
    marginBottom: theme.spacing.md,
  },
  favButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  favButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  nextUpContainer: {
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.3)',
    borderRadius: 12,
    padding: isTV ? 16 : 12,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  nextUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  nextUpLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  nextUpTitle: {
    fontSize: isTV ? 18 : 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  // Sections
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: isTV ? 24 : 20,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  // Seasons
  seasonsScroll: {
    marginBottom: theme.spacing.md,
  },
  seasonsContent: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.lg,
  },
  seasonButton: {
    paddingHorizontal: isTV ? 24 : 16,
    paddingVertical: isTV ? 16 : 12,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: isTV ? 3 : 2,
    borderColor: 'transparent',
    alignItems: 'center',
    minWidth: isTV ? 140 : 100,
  },
  seasonButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  seasonButtonFocused: {
    borderColor: '#fff',
    transform: [{ scale: 1.05 }],
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 15,
  },
  seasonButtonText: {
    fontSize: isTV ? 18 : 14,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  seasonButtonTextActive: {
    color: '#000',
  },
  seasonEpisodeCount: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  // Episodes
  episodesLoading: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  noEpisodes: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
  },
  episodesList: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    borderWidth: isTV ? 3 : 2,
    borderColor: 'transparent',
  },
  episodeCardFocused: {
    borderColor: theme.colors.primary,
    transform: [{ scale: 1.02 }],
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  episodeThumb: {
    width: isTV ? 180 : 140,
    height: isTV ? 100 : 80,
    position: 'relative',
  },
  episodeImage: {
    width: '100%',
    height: '100%',
  },
  episodePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodePlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeNumber: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  episodeNumberText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
    color: '#000',
  },
  episodeInfo: {
    flex: 1,
    padding: theme.spacing.md,
  },
  episodeTitle: {
    fontSize: isTV ? 18 : 16,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  episodeOverview: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textSecondary,
    lineHeight: isTV ? 20 : 16,
    marginBottom: 8,
  },
  episodeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  episodeAirDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  episodeRuntime: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  episodeRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  episodeRatingText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gold,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '80%',
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
    flex: 1,
    fontSize: isTV ? 22 : 18,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginRight: theme.spacing.md,
  },
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
  modalLoading: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  noStreamsHint: {
    marginTop: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  modalScroll: {
    padding: theme.spacing.lg,
  },
  linkCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: isTV ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: isTV ? 3 : 1,
    borderColor: theme.colors.border,
  },
  linkCardFocused: {
    backgroundColor: theme.colors.primary,
    borderColor: '#FFFFFF',
    borderWidth: 3,
    transform: [{ scale: 1.02 }],
  },
  linkCardActive: {
    borderColor: theme.colors.gold,
    borderWidth: 2,
  },
  linkInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  linkSource: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  linkSourceFocused: {
    color: '#000',
    fontWeight: '800',
  },
  linkSize: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  linkSizeFocused: {
    color: '#333',
  },
  linkQuality: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
  linkQualityFocused: {
    color: '#222',
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
  torrentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(138, 43, 226, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    gap: 2,
    borderWidth: 1,
    borderColor: '#8A2BE2',
  },
  torrentText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: '#D8BFD8',
  },
  streamTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
    backgroundColor: theme.colors.success,
  },
  streamTypeBadgeEmbed: {
    backgroundColor: '#7C4DFF',
  },
  streamTypeBadgeText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: '#fff',
  },
});
