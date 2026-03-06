import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator, Modal, Alert, Linking } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { tmdbService } from '../../services/tmdb';
import { debridCacheService, realDebridService } from '../../services/debrid';
import { streamScraperService, StreamSource } from '../../services/streamScrapers';
import { useContentStore } from '../../store/contentStore';
import { TVShow, CachedTorrent } from '../../types';
import { errorLogService } from '../../services/errorLogService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TVShowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { favorites, addToFavorites, removeFromFavorites, isFavorite } = useContentStore();
  
  const [tvShow, setTVShow] = useState<TVShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [cachedTorrents, setCachedTorrents] = useState<CachedTorrent[]>([]);
  const [directStreams, setDirectStreams] = useState<StreamSource[]>([]);
  const [activeTab, setActiveTab] = useState<'debrid' | 'direct'>('debrid');
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [gettingStream, setGettingStream] = useState(false);
  const [selectedTorrent, setSelectedTorrent] = useState<CachedTorrent | null>(null);

  useEffect(() => {
    if (id) {
      loadTVShowDetails();
    }
  }, [id]);

  const loadTVShowDetails = async () => {
    setLoading(true);
    try {
      const showData = await tmdbService.getTVShowDetails(parseInt(id));
      setTVShow(showData);
    } catch (error) {
      console.error('Error loading TV show details:', error);
    } finally {
      setLoading(false);
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

  const loadStreamLinks = async () => {
    setLoadingLinks(true);
    setShowLinksModal(true);
    setCachedTorrents([]);
    setDirectStreams([]);
    
    try {
      if (!tvShow) return;
      
      const year = tvShow.first_air_date ? parseInt(tvShow.first_air_date.split('-')[0]) : undefined;
      
      // Fetch both debrid and direct streams in parallel
      const [debridResults, directResults] = await Promise.allSettled([
        // Debrid cache search
        (async () => {
          const token = await realDebridService.getToken();
          if (!token) return [];
          errorLogService.info(`Searching cached torrents for "${tvShow.name}" S${selectedSeason}E${selectedEpisode}`, 'TVDetail');
          return await debridCacheService.searchCachedTV(
            tvShow.name,
            selectedSeason,
            selectedEpisode,
            year
          );
        })(),
        // Direct streaming sources
        (async () => {
          errorLogService.info(`Searching direct streams for "${tvShow.name}" S${selectedSeason}E${selectedEpisode}`, 'TVDetail');
          return await streamScraperService.getTVStreams(
            id, 
            undefined, 
            tvShow.name, 
            selectedSeason, 
            selectedEpisode, 
            year
          );
        })(),
      ]);
      
      if (debridResults.status === 'fulfilled') {
        setCachedTorrents(debridResults.value);
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
    setSelectedTorrent(torrent);
    setGettingStream(true);
    
    try {
      const streamUrl = await debridCacheService.getStreamUrl(torrent.hash, torrent.file_id);
      
      if (streamUrl) {
        setShowLinksModal(false);
        router.push({
          pathname: '/player',
          params: { url: streamUrl, title: `${tvShow?.name} S${selectedSeason}E${selectedEpisode}` }
        });
      } else {
        Alert.alert('Error', 'Failed to get streaming link.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start stream');
    } finally {
      setGettingStream(false);
      setSelectedTorrent(null);
    }
  };

  const handlePlayDirectStream = async (stream: StreamSource) => {
    try {
      if (stream.type === 'embed') {
        const supported = await Linking.canOpenURL(stream.url);
        if (supported) {
          await Linking.openURL(stream.url);
        }
      } else {
        setShowLinksModal(false);
        router.push({
          pathname: '/player',
          params: { url: stream.url, title: `${tvShow?.name} S${selectedSeason}E${selectedEpisode}` }
        });
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to play stream');
    }
  };

  if (loading || !tvShow) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const backdropUrl = tmdbService.getImageUrl(tvShow.backdrop_path, 'original');
  const posterUrl = tmdbService.getImageUrl(tvShow.poster_path, 'w500');
  const year = tvShow.first_air_date?.split('-')[0];

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
              <Text style={styles.title}>{tvShow.name}</Text>
              <View style={styles.metaRow}>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={16} color={theme.colors.gold} />
                  <Text style={styles.ratingText}>{tvShow.vote_average.toFixed(1)}</Text>
                </View>
                {year && <Text style={styles.metaText}>{year}</Text>}
                {tvShow.genres && tvShow.genres.length > 0 && (
                  <Text style={styles.metaText}>{tvShow.genres[0].name}</Text>
                )}
              </View>
              <Text style={styles.overview}>{tvShow.overview}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable style={styles.playButton} onPress={loadStreamLinks}>
              <Ionicons name="play" size={24} color={theme.colors.text} />
              <Text style={styles.playButtonText}>Watch Now</Text>
            </Pressable>
            <Pressable
              style={styles.favoriteButton}
              onPress={handleFavoriteToggle}
            >
              <Ionicons
                name={isFavorite(tvShow.id) ? 'heart' : 'heart-outline'}
                size={24}
                color={isFavorite(tvShow.id) ? theme.colors.error : theme.colors.text}
              />
            </Pressable>
            <Pressable style={styles.shareButton}>
              <Ionicons name="share-outline" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Season/Episode Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Episode</Text>
            <View style={styles.episodeSelector}>
              <View style={styles.selectorRow}>
                <Text style={styles.selectorLabel}>Season</Text>
                <View style={styles.selectorButtons}>
                  <Pressable 
                    style={styles.selectorBtn}
                    onPress={() => setSelectedSeason(Math.max(1, selectedSeason - 1))}
                  >
                    <Ionicons name="remove" size={20} color={theme.colors.text} />
                  </Pressable>
                  <Text style={styles.selectorValue}>{selectedSeason}</Text>
                  <Pressable 
                    style={styles.selectorBtn}
                    onPress={() => setSelectedSeason(selectedSeason + 1)}
                  >
                    <Ionicons name="add" size={20} color={theme.colors.text} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.selectorRow}>
                <Text style={styles.selectorLabel}>Episode</Text>
                <View style={styles.selectorButtons}>
                  <Pressable 
                    style={styles.selectorBtn}
                    onPress={() => setSelectedEpisode(Math.max(1, selectedEpisode - 1))}
                  >
                    <Ionicons name="remove" size={20} color={theme.colors.text} />
                  </Pressable>
                  <Text style={styles.selectorValue}>{selectedEpisode}</Text>
                  <Pressable 
                    style={styles.selectorBtn}
                    onPress={() => setSelectedEpisode(selectedEpisode + 1)}
                  >
                    <Ionicons name="add" size={20} color={theme.colors.text} />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          {/* Genres */}
          {tvShow.genres && tvShow.genres.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Genres</Text>
              <View style={styles.genresList}>
                {tvShow.genres.map((genre) => (
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
              <Text style={styles.modalTitle}>S{selectedSeason}E{selectedEpisode} - Stream Sources</Text>
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
              </View>
            ) : activeTab === 'debrid' ? (
              cachedTorrents.length === 0 ? (
                <View style={styles.modalLoading}>
                  <Ionicons name="cloud-offline" size={48} color={theme.colors.textSecondary} />
                  <Text style={styles.loadingText}>No Debrid streams found</Text>
                </View>
              ) : (
                <ScrollView style={styles.modalScroll}>
                  {cachedTorrents.map((torrent, index) => (
                    <Pressable 
                      key={index} 
                      style={[styles.linkCard, selectedTorrent?.hash === torrent.hash && gettingStream && styles.linkCardActive]}
                      onPress={() => handlePlayTorrent(torrent)}
                      disabled={gettingStream}
                    >
                      <View style={styles.linkInfo}>
                        <View style={torrent.cached ? styles.cachedBadge : styles.uncachedBadge}>
                          <Ionicons name={torrent.cached ? "flash" : "cloud-download"} size={12} color={torrent.cached ? "#000" : theme.colors.text} />
                          <Text style={torrent.cached ? styles.cachedText : styles.uncachedText}>
                            {torrent.cached ? 'CACHED' : 'DOWNLOAD'}
                          </Text>
                        </View>
                        <Text style={styles.linkSource}>{torrent.source.toUpperCase()}</Text>
                        {torrent.size && <Text style={styles.linkSize}>{torrent.size}</Text>}
                      </View>
                      {selectedTorrent?.hash === torrent.hash && gettingStream ? (
                        <ActivityIndicator size="small" color={theme.colors.gold} />
                      ) : (
                        <Ionicons name="play-circle" size={32} color={torrent.cached ? theme.colors.gold : theme.colors.primary} />
                      )}
                    </Pressable>
                  ))}
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
  // Episode Selector Styles
  episodeSelector: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  selectorLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  selectorButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  selectorBtn: {
    backgroundColor: theme.colors.surfaceLight,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  selectorValue: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
    minWidth: 30,
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
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
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  modalScroll: {
    padding: theme.spacing.lg,
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
  linkCardActive: {
    borderColor: theme.colors.gold,
    borderWidth: 2,
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
  linkQuality: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
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
