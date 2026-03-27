import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator, Modal, Alert, Linking } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../../constants/theme';
import { tmdbService } from '../../services/tmdb';
import { debridCacheService, realDebridService } from '../../services/debrid';
import { streamScraperService, StreamSource } from '../../services/streamScrapers';
import { streamFilterService, FilterableStream, StreamFilterSettings } from '../../services/streamFilterService';
import { resolveUrlService } from '../../services/resolveUrl';
import { iptvService } from '../../services/iptv';
import { watchHistoryService, WatchHistoryItem } from '../../services/watchHistoryService';
import { useContentStore } from '../../store/contentStore';
import { Movie, CachedTorrent } from '../../types';
import { QUALITY_OPTIONS } from '../../config/constants';
import { errorLogService } from '../../services/errorLogService';
import { PlayerChoice } from '../../components/PlayerChoice';
import { SourcesSearchDialog } from '../../components/SourcesSearchDialog';
import { DebridDownloadDialog } from '../../components/DebridDownloadDialog';
import { CastDialog } from '../../components/CastDialog';
import { freeStreamService, FreeServer } from '../../services/freeStreamService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MovieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { favorites, addToFavorites, removeFromFavorites, isFavorite } = useContentStore();
  
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [cachedTorrents, setCachedTorrents] = useState<CachedTorrent[]>([]);
  const [directStreams, setDirectStreams] = useState<StreamSource[]>([]);
  const [iptvVODStream, setIptvVODStream] = useState<any>(null);
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [selectedTorrent, setSelectedTorrent] = useState<CachedTorrent | null>(null);
  const [gettingStream, setGettingStream] = useState(false);
  const [activeTab, setActiveTab] = useState<'debrid' | 'direct' | 'iptv'>('debrid');
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterQuality, setFilterQuality] = useState<string | null>(null);
  const [filterMinSize, setFilterMinSize] = useState<number | null>(null);
  const [filterMaxSize, setFilterMaxSize] = useState<number | null>(null);
  const [filterHoster, setFilterHoster] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'quality' | 'size' | 'seeders'>('quality');
  
  // One-click play
  const [oneClickEnabled, setOneClickEnabled] = useState(false);

  // Search progress state
  interface SearchProgress {
    source: string;
    status: 'searching' | 'done' | 'error';
    count: number;
  }
  const [searchProgress, setSearchProgress] = useState<SearchProgress[]>([]);

  // Resume playback state
  const [resumeData, setResumeData] = useState<WatchHistoryItem | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [pendingStreamUrl, setPendingStreamUrl] = useState<string | null>(null);
  const [playerChoiceVisible, setPlayerChoiceVisible] = useState(false);
  const [pendingPlayerStream, setPendingPlayerStream] = useState<{ url: string; title: string } | null>(null);
  
  // Sources search dialog state
  const [showSourcesDialog, setShowSourcesDialog] = useState(false);
  
  // TV Focus state for stream sources
  const [focusedStream, setFocusedStream] = useState<string | null>(null);
  
  // TV Focus state for action buttons
  const [focusedBtn, setFocusedBtn] = useState<string | null>(null);
  
  // Debrid download dialog state
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [showCastDialog, setShowCastDialog] = useState(false);
  const [castUrl, setCastUrl] = useState('');
  const [lastResolvedUrl, setLastResolvedUrl] = useState('');
  const [downloadingTorrent, setDownloadingTorrent] = useState<CachedTorrent | null>(null);

  // Free streams state
  const [freeServers, setFreeServers] = useState<FreeServer[]>([]);
  const [showFreeModal, setShowFreeModal] = useState(false);
  const [loadingFree, setLoadingFree] = useState(false);

  // Check for resume position on load
  useEffect(() => {
    const checkResumePosition = async () => {
      if (id) {
        const lastWatched = await watchHistoryService.getLastWatched(parseInt(id), 'movie');
        if (lastWatched && lastWatched.progress > 5 && lastWatched.progress < 95) {
          setResumeData(lastWatched);
        }
      }
    };
    checkResumePosition();
  }, [id]);

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
    setSearchProgress([]);
    
    try {
      if (!movie) return;
      
      const year = movie.release_date ? parseInt(movie.release_date.split('-')[0]) : undefined;
      const imdbId = movie.imdb_id || undefined;
      
      // Initialize progress tracking
      const initialProgress: SearchProgress[] = [
        { source: 'Torrentio', status: 'searching', count: 0 },
        { source: 'VidSrc', status: 'searching', count: 0 },
        { source: 'VidSrc Pro', status: 'searching', count: 0 },
        { source: 'SuperEmbed', status: 'searching', count: 0 },
        { source: 'SmashyStream', status: 'searching', count: 0 },
        { source: 'Other Sources', status: 'searching', count: 0 },
      ];
      setSearchProgress(initialProgress);
      
      errorLogService.info(`Searching streams for "${movie.title}" (IMDB: ${imdbId || 'N/A'})`, 'MovieDetail');
      
      // Update progress helper
      const updateProgress = (source: string, status: 'searching' | 'done' | 'error', count: number) => {
        setSearchProgress(prev => prev.map(p => 
          p.source === source ? { ...p, status, count } : p
        ));
      };
      
      // Fetch debrid streams with progress
      const debridPromise = (async () => {
        try {
          const results = await debridCacheService.searchCachedMovie(movie.title, year, imdbId);
          updateProgress('Torrentio', 'done', results.length);
          return results;
        } catch (err: any) {
          updateProgress('Torrentio', 'error', 0);
          return [];
        }
      })();
      
      // Fetch direct streams with individual progress
      const directPromise = (async () => {
        const allStreams: StreamSource[] = [];
        
        // VidSrc
        try {
          const vidSrcStreams = await streamScraperService.scrapeVidSrc('movie', id);
          updateProgress('VidSrc', 'done', vidSrcStreams.length);
          allStreams.push(...vidSrcStreams);
        } catch { updateProgress('VidSrc', 'error', 0); }
        
        // VidSrc Pro
        try {
          const vidSrcProStreams = await streamScraperService.scrapeVidSrcPro('movie', id);
          updateProgress('VidSrc Pro', 'done', vidSrcProStreams.length);
          allStreams.push(...vidSrcProStreams);
        } catch { updateProgress('VidSrc Pro', 'error', 0); }
        
        // SuperEmbed
        try {
          const superEmbedStreams = await streamScraperService.scrapeSuperEmbed('movie', id, imdbId);
          updateProgress('SuperEmbed', 'done', superEmbedStreams.length);
          allStreams.push(...superEmbedStreams);
        } catch { updateProgress('SuperEmbed', 'error', 0); }
        
        // SmashyStream
        try {
          const smashyStreams = await streamScraperService.scrapeSmashyStream('movie', id);
          updateProgress('SmashyStream', 'done', smashyStreams.length);
          allStreams.push(...smashyStreams);
        } catch { updateProgress('SmashyStream', 'error', 0); }
        
        // Other sources in parallel
        try {
          const otherResults = await Promise.allSettled([
            streamScraperService.scrapeVidSrcXyz('movie', id),
            streamScraperService.scrapeVidSrcNl('movie', id),
            streamScraperService.scrapeTwoEmbed('movie', id, imdbId),
            streamScraperService.scrapeAutoEmbed('movie', id),
            streamScraperService.scrapeEmbedSu('movie', id),
            streamScraperService.scrapeMoviesApi('movie', id),
            streamScraperService.scrapeVideasy('movie', id),
            streamScraperService.scrapeRive('movie', id, imdbId),
            streamScraperService.scrapeFrembed('movie', id),
            streamScraperService.scrapeWarezCDN('movie', id, imdbId),
          ]);
          
          let otherCount = 0;
          otherResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
              otherCount += result.value.length;
              allStreams.push(...result.value);
            }
          });
          updateProgress('Other Sources', 'done', otherCount);
        } catch { updateProgress('Other Sources', 'error', 0); }
        
        return allStreams;
      })();
      
      // Wait for all results
      const [debridResults, directResults] = await Promise.allSettled([debridPromise, directPromise]);
      
      // Process results
      if (debridResults.status === 'fulfilled') {
        setCachedTorrents(debridResults.value);
      }
      
      if (directResults.status === 'fulfilled') {
        setDirectStreams(directResults.value);
      }
      
      // Switch to direct tab if no debrid results
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

  // Format time for resume display
  const formatResumeTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m`;
    }
    return `${mins}m`;
  };

  // Navigate to player with all metadata for tracking
  const navigateToPlayer = (streamUrl: string, streamType: 'video' | 'embed' = 'video', resumePosition?: number) => {
    // Track the last resolved URL for cast feature
    setLastResolvedUrl(streamUrl);
    // Delay to let the links modal fully close before opening player choice
    // Prevents modal overlap issues on Android/TV
    setTimeout(() => {
      setPendingPlayerStream({ url: streamUrl, title: movie?.title || 'Movie' });
      setPlayerChoiceVisible(true);
    }, 350);
  };

  // Check if should show resume prompt before playing
  const checkResumeAndPlay = (streamUrl: string, streamType: 'video' | 'embed' = 'video') => {
    if (resumeData && resumeData.currentTime > 60) { // Only show if more than 1 minute watched
      setPendingStreamUrl(streamUrl);
      setShowResumeModal(true);
    } else {
      navigateToPlayer(streamUrl, streamType);
    }
  };

  // Handle resume choice
  const handleResumeChoice = (shouldResume: boolean) => {
    setShowResumeModal(false);
    if (pendingStreamUrl) {
      navigateToPlayer(
        pendingStreamUrl, 
        'video', 
        shouldResume ? resumeData?.currentTime : undefined
      );
      setPendingStreamUrl(null);
    }
  };

  const handlePlayDirectStream = async (stream: StreamSource) => {
    try {
      if (stream.type === 'embed') {
        // Open embed URL in our player's WebView
        setShowLinksModal(false);
        navigateToPlayer(stream.url, 'embed');
      } else if (stream.type === 'torrent') {
        // For torrent links, try to resolve via Real-Debrid if available
        const token = await realDebridService.getToken();
        if (token && stream.url.startsWith('magnet:')) {
          errorLogService.info(`Resolving torrent via Real-Debrid: ${stream.name}`, 'MovieDetail');
          const directUrl = await realDebridService.addMagnetAndGetLink(stream.url, movie?.title || 'Movie');
          if (directUrl) {
            setShowLinksModal(false);
            checkResumeAndPlay(directUrl, 'video');
          } else {
            Alert.alert('Error', 'Failed to resolve torrent. Try another source.');
          }
        } else {
          Alert.alert('Login Required', 'Please login to Real-Debrid to play torrent sources.');
        }
      } else {
        // Direct stream - check for resume
        setShowLinksModal(false);
        checkResumeAndPlay(stream.url, 'video');
      }
    } catch (error: any) {
      errorLogService.error(`Error playing stream: ${error.message}`, 'MovieDetail', error);
      Alert.alert('Error', 'Failed to play stream');
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
    
    // Check for resume and play
    checkResumeAndPlay(streamUrl, 'video');
  };
  
  const handleTorrentSelect = async (torrent: CachedTorrent) => {
    // For sources dialog selection
    setShowSourcesDialog(false);
    setDownloadingTorrent(torrent);
    setShowDownloadDialog(true);
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

  // Free stream handlers
  const handleWatchFree = async () => {
    if (!movie) return;
    setLoadingFree(true);
    setShowFreeModal(true);
    try {
      const servers = await freeStreamService.getMovieServers(id, movie.imdb_id || undefined);
      setFreeServers(servers);
      // Auto-play the best server immediately
      if (servers.length > 0) {
        setShowFreeModal(true); // Keep modal open to show all servers
      }
    } catch (error) {
      console.error('Error fetching free streams:', error);
    } finally {
      setLoadingFree(false);
    }
  };

  const handlePlayFreeServer = (server: FreeServer) => {
    setShowFreeModal(false);
    // Direct streams (extracted m3u8/mp4) play in native player, embeds play in WebView with ad-blocking
    navigateToPlayer(server.url, server.type === 'direct' ? 'video' : 'embed');
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
        {/* Ambient Background — blurred backdrop glow behind hero */}
        {backdropUrl && (
          <View style={styles.ambientContainer} pointerEvents="none">
            <Image
              source={{ uri: backdropUrl }}
              style={styles.ambientImage}
              contentFit="cover"
              blurRadius={60}
            />
            <View style={styles.ambientOverlay} />
          </View>
        )}

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
                {movie.release_date && (
                  <Text style={styles.releaseDateText}>
                    {new Date(movie.release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                )}
                {movie.genres && movie.genres.length > 0 && (
                  <Text style={styles.metaText}>{movie.genres[0].name}</Text>
                )}
              </View>
              <Text style={styles.overview}>{movie.overview}</Text>
            </View>
          </View>

          {/* Quick Resume Banner */}
          {resumeData && resumeData.currentTime > 60 && (
            <Pressable
              style={[styles.resumeBanner, focusedBtn === 'resume' && styles.resumeBannerFocused]}
              onPress={() => {
                if (resumeData.streamUrl) {
                  navigateToPlayer(resumeData.streamUrl, 'video', resumeData.currentTime);
                } else {
                  loadStreamLinks();
                }
              }}
              onFocus={() => setFocusedBtn('resume')}
              onBlur={() => setFocusedBtn(null)}
              data-testid="quick-resume-btn"
            >
              <View style={styles.resumeBannerLeft}>
                <View style={styles.resumePlayIcon}>
                  <Ionicons name="play" size={isTV ? 22 : 18} color="#000" />
                </View>
                <View>
                  <Text style={styles.resumeBannerTitle}>Resume Watching</Text>
                  <Text style={styles.resumeBannerSub}>
                    {formatResumeTime(resumeData.currentTime)} watched - {Math.round(resumeData.progress)}% complete
                  </Text>
                </View>
              </View>
              <View style={styles.resumeProgressTrack}>
                <View style={[styles.resumeProgressFill, { width: `${resumeData.progress}%` }]} />
              </View>
            </Pressable>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable 
              style={[styles.playButton, focusedBtn === 'play' && styles.btnFocused]}
              onPress={loadStreamLinks} 
              onFocus={() => setFocusedBtn('play')}
              onBlur={() => setFocusedBtn(null)}
              data-testid="play-btn"
            >
              <Ionicons name="play" size={24} color={focusedBtn === 'play' ? '#000' : theme.colors.text} />
              <Text style={[styles.playButtonText, focusedBtn === 'play' && styles.btnTextFocused]}>Play</Text>
            </Pressable>
            <Pressable 
              style={[styles.freePlayButton, focusedBtn === 'free' && styles.freeBtnFocused]}
              onPress={handleWatchFree}
              onFocus={() => setFocusedBtn('free')}
              onBlur={() => setFocusedBtn(null)}
              data-testid="watch-free-btn"
            >
              {loadingFree ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="videocam" size={20} color="#000" />
              )}
              <Text style={styles.freePlayButtonText}>Watch Free</Text>
            </Pressable>
            <Pressable 
              style={[styles.searchAllButton, focusedBtn === 'sources' && styles.btnFocused]}
              onPress={() => setShowSourcesDialog(true)}
              onFocus={() => setFocusedBtn('sources')}
              onBlur={() => setFocusedBtn(null)}
              data-testid="search-all-sources-btn"
            >
              <Ionicons name="search" size={20} color={focusedBtn === 'sources' ? '#000' : theme.colors.text} />
              <Text style={[styles.searchAllButtonText, focusedBtn === 'sources' && styles.btnTextFocused]}>All Sources</Text>
            </Pressable>
            <Pressable
              style={[styles.favoriteButton, focusedBtn === 'fav' && styles.btnFocused]}
              onPress={handleFavoriteToggle}
              onFocus={() => setFocusedBtn('fav')}
              onBlur={() => setFocusedBtn(null)}
              data-testid="favorite-btn"
            >
              <Ionicons
                name={isFavorite(movie.id) ? 'heart' : 'heart-outline'}
                size={24}
                color={focusedBtn === 'fav' ? '#000' : (isFavorite(movie.id) ? theme.colors.error : theme.colors.text)}
              />
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
              {iptvVODStream && (
                <Pressable 
                  style={[styles.tabButton, styles.tabButtonIPTV, activeTab === 'iptv' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('iptv')}
                >
                  <Ionicons name="diamond" size={16} color={activeTab === 'iptv' ? '#000' : '#FFD700'} />
                  <Text style={[styles.tabButtonText, styles.tabButtonTextIPTV, activeTab === 'iptv' && styles.tabButtonTextActive]}>
                    IPTV
                  </Text>
                </Pressable>
              )}
            </View>
            
            {/* Filter Bar */}
            {!loadingLinks && (cachedTorrents.length > 0 || directStreams.length > 0) && (
              <View style={styles.filterBar}>
                <Pressable 
                  style={[styles.filterButton, showFilters && styles.filterButtonActive]}
                  onPress={() => setShowFilters(!showFilters)}
                >
                  <Ionicons name="filter" size={16} color={showFilters ? '#000' : theme.colors.text} />
                  <Text style={[styles.filterButtonText, showFilters && styles.filterButtonTextActive]}>
                    Filters
                  </Text>
                </Pressable>
                
                {/* Quick Quality Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFilters}>
                  {['4K', '1080p', '720p'].map((q) => (
                    <Pressable
                      key={q}
                      style={[styles.quickFilterChip, filterQuality === q && styles.quickFilterChipActive]}
                      onPress={() => setFilterQuality(filterQuality === q ? null : q)}
                    >
                      <Text style={[styles.quickFilterText, filterQuality === q && styles.quickFilterTextActive]}>
                        {q}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            
            {/* Expanded Filter Panel */}
            {showFilters && (
              <View style={styles.filterPanel}>
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Size:</Text>
                  <View style={styles.sizeFilters}>
                    {[
                      { label: '< 2GB', max: 2 },
                      { label: '2-5GB', min: 2, max: 5 },
                      { label: '5-10GB', min: 5, max: 10 },
                      { label: '> 10GB', min: 10 },
                    ].map((size) => (
                      <Pressable
                        key={size.label}
                        style={[
                          styles.sizeFilterChip,
                          filterMinSize === size.min && filterMaxSize === size.max && styles.sizeFilterChipActive,
                        ]}
                        onPress={() => {
                          if (filterMinSize === size.min && filterMaxSize === size.max) {
                            setFilterMinSize(null);
                            setFilterMaxSize(null);
                          } else {
                            setFilterMinSize(size.min || null);
                            setFilterMaxSize(size.max || null);
                          }
                        }}
                      >
                        <Text style={styles.sizeFilterText}>{size.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Sort:</Text>
                  <View style={styles.sortButtons}>
                    {[
                      { key: 'quality', icon: 'diamond', label: 'Quality' },
                      { key: 'size', icon: 'resize', label: 'Size' },
                      { key: 'seeders', icon: 'people', label: 'Seeders' },
                    ].map((s) => (
                      <Pressable
                        key={s.key}
                        style={[styles.sortButton, sortBy === s.key && styles.sortButtonActive]}
                        onPress={() => setSortBy(s.key as 'quality' | 'size' | 'seeders')}
                      >
                        <Ionicons name={s.icon as any} size={14} color={sortBy === s.key ? '#000' : theme.colors.text} />
                        <Text style={[styles.sortButtonText, sortBy === s.key && styles.sortButtonTextActive]}>
                          {s.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}
            
            {loadingLinks ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Searching sources...</Text>
                
                {/* Progress List */}
                <View style={styles.progressContainer}>
                  {searchProgress.map((progress, index) => (
                    <View key={index} style={styles.progressItem}>
                      <View style={styles.progressLeft}>
                        {progress.status === 'searching' ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : progress.status === 'done' ? (
                          <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                        ) : (
                          <Ionicons name="close-circle" size={18} color={theme.colors.error} />
                        )}
                        <Text style={styles.progressSource}>{progress.source}</Text>
                      </View>
                      <Text style={[
                        styles.progressCount,
                        progress.count > 0 && styles.progressCountActive
                      ]}>
                        {progress.status === 'searching' ? '...' : `${progress.count} links`}
                      </Text>
                    </View>
                  ))}
                </View>
                
                <Text style={styles.loadingSubtext}>
                  Found: {cachedTorrents.length} debrid + {directStreams.length} direct
                </Text>
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
                        {groupedTorrents[quality].map((torrent, index) => {
                          const isSelected = selectedTorrent?.hash === torrent.hash;
                          const isFocusedItem = focusedStream === `torrent-${torrent.hash}`;
                          
                          return (
                            <Pressable 
                              key={index} 
                              style={[
                                styles.linkCard,
                                !torrent.cached && styles.linkCardUncached,
                                isSelected && gettingStream && styles.linkCardActive,
                                isFocusedItem && styles.linkCardFocused,
                              ]}
                              onPress={() => handlePlayTorrent(torrent)}
                              onFocus={() => setFocusedStream(`torrent-${torrent.hash}`)}
                              onBlur={() => setFocusedStream(null)}
                              disabled={gettingStream}
                              data-testid={`torrent-${torrent.hash?.substring(0, 8)}`}
                            >
                              <View style={styles.linkInfo}>
                                {torrent.cached ? (
                                  <View style={styles.cachedBadge}>
                                    <Ionicons name="flash" size={12} color="#000" />
                                    <Text style={styles.cachedText}>INSTANT</Text>
                                  </View>
                                ) : (
                                  <View style={styles.torrentBadge}>
                                    <Ionicons name="magnet" size={12} color={theme.colors.text} />
                                    <Text style={styles.torrentText}>TORRENT</Text>
                                  </View>
                                )}
                                <Text style={[
                                  styles.linkSource, 
                                  !torrent.cached && styles.linkSourceUncached,
                                  isFocusedItem && styles.linkSourceFocused
                                ]}>
                                  {torrent.source.toUpperCase()}
                                </Text>
                                {torrent.size && (
                                  <Text style={[
                                    styles.linkSize, 
                                    !torrent.cached && styles.linkSizeUncached,
                                    isFocusedItem && styles.linkSizeFocused
                                  ]}>
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
                              {isSelected && gettingStream ? (
                                <ActivityIndicator size="small" color={torrent.cached ? theme.colors.gold : theme.colors.primary} />
                              ) : (
                                <Ionicons 
                                  name="play-circle" 
                                  size={isTV ? 28 : 32} 
                                  color={isFocusedItem ? '#000' : (torrent.cached ? theme.colors.gold : theme.colors.primary)} 
                                />
                              )}
                            </Pressable>
                          );
                        })}
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
                  {directStreams.map((stream, index) => {
                    const isIPTV = stream.source?.toLowerCase().includes('iptv') || 
                                   stream.type === 'iptv' ||
                                   stream.source?.toLowerCase().includes('vod');
                    
                    return (
                      <Pressable 
                        key={index} 
                        style={[
                          styles.directLinkCard,
                          isIPTV && styles.directLinkCardIPTV,
                        ]}
                        onPress={() => handlePlayDirectStream(stream)}
                      >
                        <View style={styles.directLinkInfo}>
                          <View style={[
                            styles.streamTypeBadge,
                            stream.type === 'embed' && styles.streamTypeBadgeEmbed,
                            stream.type === 'torrent' && styles.streamTypeBadgeTorrent,
                            stream.type === 'direct' && styles.streamTypeBadgeDirect,
                            isIPTV && styles.streamTypeBadgeIPTV,
                          ]}>
                            <Ionicons 
                              name={isIPTV ? 'flame' : stream.type === 'embed' ? 'globe' : stream.type === 'torrent' ? 'magnet' : 'play'} 
                              size={12} 
                              color={isIPTV ? '#000' : '#fff'} 
                            />
                            <Text style={[
                              styles.streamTypeBadgeText,
                              isIPTV && styles.streamTypeBadgeTextIPTV,
                            ]}>
                              {isIPTV ? 'PREMIUM' : stream.type.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={[
                            styles.directLinkSource,
                            isIPTV && styles.directLinkSourceIPTV,
                          ]}>{stream.source}</Text>
                          <Text style={styles.directLinkQuality}>{stream.quality}</Text>
                          {isIPTV && (
                            <View style={styles.iptvPremiumIcon}>
                              <Ionicons name="star" size={14} color="#FFD700" />
                            </View>
                          )}
                        </View>
                        <Ionicons 
                          name={isIPTV ? 'flame' : 'open-outline'} 
                          size={24} 
                          color={isIPTV ? '#FFD700' : theme.colors.primary} 
                        />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )
            )}
          </View>
        </View>
      </Modal>
      
      {/* Resume Playback Modal */}
      <Modal
        visible={showResumeModal}
        transparent
        animationType="fade"
        onRequestClose={() => handleResumeChoice(false)}
      >
        <View style={styles.resumeModalOverlay}>
          <View style={styles.resumeModalContent}>
            <View style={styles.resumeModalIcon}>
              <Ionicons name="play-circle" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.resumeModalTitle}>Resume Playback</Text>
            <Text style={styles.resumeModalSubtitle}>
              You were watching this at {resumeData ? formatResumeTime(resumeData.currentTime) : ''}
            </Text>
            <View style={styles.resumeProgressContainer}>
              <View style={styles.resumeProgressBar}>
                <View 
                  style={[
                    styles.resumeProgressFill, 
                    { width: `${resumeData?.progress || 0}%` }
                  ]} 
                />
              </View>
              <Text style={styles.resumeProgressText}>
                {resumeData ? `${Math.round(resumeData.progress)}% watched` : ''}
              </Text>
            </View>
            <View style={styles.resumeModalButtons}>
              <Pressable
                style={styles.resumeModalButton}
                onPress={() => handleResumeChoice(true)}
              >
                <Ionicons name="play" size={20} color="#000" />
                <Text style={styles.resumeModalButtonText}>Resume</Text>
              </Pressable>
              <Pressable
                style={[styles.resumeModalButton, styles.resumeModalButtonSecondary]}
                onPress={() => handleResumeChoice(false)}
              >
                <Ionicons name="refresh" size={20} color={theme.colors.text} />
                <Text style={[styles.resumeModalButtonText, styles.resumeModalButtonTextSecondary]}>
                  Start Over
                </Text>
              </Pressable>
            </View>
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
          type="movie"
        />
      )}
      
      {/* Sources Search Dialog */}
      {movie && (
        <SourcesSearchDialog
          visible={showSourcesDialog}
          onClose={() => setShowSourcesDialog(false)}
          onSelectSource={(source) => {
            setShowSourcesDialog(false);
            // Handle source selection
            if ('hash' in source) {
              // It's a torrent - resolve debrid link
              handleTorrentSelect(source as CachedTorrent);
            } else {
              // It's a direct stream
              setPendingPlayerStream({ url: source.url, title: source.name });
              setPlayerChoiceVisible(true);
            }
          }}
          title={movie.title}
          tmdbId={id!}
          imdbId={movie.imdb_id || undefined}
          year={movie.release_date ? parseInt(movie.release_date.split('-')[0]) : undefined}
          type="movie"
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

      {/* Cast Dialog */}
      <CastDialog
        visible={showCastDialog}
        onClose={() => setShowCastDialog(false)}
        videoUrl={castUrl}
        title={movie?.title || 'Movie'}
      />

      {/* Free Servers Modal */}
      <Modal
        visible={showFreeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFreeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.freeModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.freeModalTitleRow}>
                <Ionicons name="videocam" size={22} color="#00E676" />
                <Text style={styles.modalTitle}>Free Servers</Text>
              </View>
              <Pressable onPress={() => setShowFreeModal(false)} data-testid="close-free-modal">
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>
            
            {loadingFree ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#00E676" />
                <Text style={styles.loadingText}>Finding free servers...</Text>
              </View>
            ) : freeServers.length === 0 ? (
              <View style={styles.modalLoading}>
                <Ionicons name="cloud-offline" size={48} color={theme.colors.textSecondary} />
                <Text style={styles.loadingText}>No free servers found</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.freeServerNote}>
                  Tap any server to play instantly — no account needed
                </Text>
                {freeServers.map((server, index) => (
                  <Pressable
                    key={`${server.name}-${index}`}
                    style={[styles.freeServerCard, index === 0 && styles.freeServerCardBest]}
                    onPress={() => handlePlayFreeServer(server)}
                    data-testid={`free-server-${server.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <View style={styles.freeServerInfo}>
                      {index === 0 && (
                        <View style={styles.bestServerBadge}>
                          <Ionicons name="star" size={10} color="#000" />
                          <Text style={styles.bestServerText}>BEST</Text>
                        </View>
                      )}
                      {server.type === 'direct' && (
                        <View style={[styles.bestServerBadge, { backgroundColor: '#2196F3' }]}>
                          <Ionicons name="shield-checkmark" size={10} color="#fff" />
                          <Text style={[styles.bestServerText, { color: '#fff' }]}>AD-FREE</Text>
                        </View>
                      )}
                      <View style={styles.freeServerBadge}>
                        <Ionicons name="server" size={12} color="#00E676" />
                        <Text style={styles.freeServerBadgeText}>SERVER {index + 1}</Text>
                      </View>
                      <Text style={styles.freeServerName}>{server.name}</Text>
                      <Text style={styles.freeServerQuality}>{server.quality}</Text>
                    </View>
                    <Ionicons name="play-circle" size={32} color={index === 0 ? '#00E676' : theme.colors.primary} />
                  </Pressable>
                ))}
              </ScrollView>
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
  // Ambient background — blurred backdrop image creating immersive glow
  ambientContainer: {
    position: 'absolute',
    top: -40,
    left: -40,
    right: -40,
    height: SCREEN_HEIGHT * 0.7,
    overflow: 'hidden',
    zIndex: 0,
  },
  ambientImage: {
    width: '120%',
    height: '120%',
    opacity: 0.35,
  },
  ambientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 39, 0.4)',
  },
  // Quick Resume Banner
  resumeBanner: {
    flexDirection: 'column',
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.25)',
    borderRadius: 14,
    padding: isTV ? 18 : 14,
    marginBottom: theme.spacing.lg,
  },
  resumeBannerFocused: {
    backgroundColor: 'rgba(0, 217, 255, 0.2)',
    borderColor: theme.colors.primary,
    borderWidth: 2,
    transform: [{ scale: 1.02 }],
  },
  resumeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 14 : 10,
    marginBottom: 10,
  },
  resumePlayIcon: {
    width: isTV ? 44 : 36,
    height: isTV ? 44 : 36,
    borderRadius: isTV ? 22 : 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeBannerTitle: {
    fontSize: isTV ? 18 : 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  resumeBannerSub: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  resumeProgressTrack: {
    height: isTV ? 6 : 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  resumeProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
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
  releaseDateText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
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
  freePlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E676',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  freePlayButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#000',
  },
  // TV Focus styles for action buttons
  btnFocused: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#FFD700',
    transform: [{ scale: 1.08 }],
  },
  freeBtnFocused: {
    borderWidth: 3,
    borderColor: '#FFD700',
    transform: [{ scale: 1.08 }],
    backgroundColor: '#00C853',
  },
  btnTextFocused: {
    color: '#000',
  },
  searchAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    gap: theme.spacing.xs,
  },
  searchAllButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
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
  castButton: {
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.3)',
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
    padding: isTV ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: isTV ? 3 : 1,
    borderColor: theme.colors.border,
  },
  linkCardFocused: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
    borderWidth: 3,
    transform: [{ scale: 1.03 }],
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
  linkSourceFocused: {
    color: '#000',
    fontWeight: '800',
  },
  linkSizeFocused: {
    color: '#333',
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
  progressContainer: {
    width: '100%',
    maxWidth: 300,
    marginVertical: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  progressItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  progressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  progressSource: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '500',
  },
  progressCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  progressCountActive: {
    color: theme.colors.success,
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
  streamTypeBadgeIPTV: {
    backgroundColor: '#FFD700',
  },
  streamTypeBadgeText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: '#fff',
  },
  streamTypeBadgeTextIPTV: {
    color: '#000',
  },
  directLinkCardIPTV: {
    borderColor: '#FFD700',
    borderWidth: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  directLinkSourceIPTV: {
    color: '#FFD700',
    fontWeight: theme.fontWeight.bold,
  },
  iptvPremiumIcon: {
    marginLeft: 'auto',
    marginRight: theme.spacing.sm,
  },
  // IPTV Tab Button
  tabButtonIPTV: {
    borderWidth: 1,
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  tabButtonTextIPTV: {
    color: '#FFD700',
  },
  // Filter Bar Styles
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  filterButtonTextActive: {
    color: '#000',
  },
  quickFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  quickFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickFilterChipActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.2)',
    borderColor: theme.colors.primary,
  },
  quickFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  quickFilterTextActive: {
    color: theme.colors.primary,
  },
  filterPanel: {
    padding: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  filterLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    minWidth: 40,
  },
  sizeFilters: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  sizeFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sizeFilterChipActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.2)',
    borderColor: theme.colors.primary,
  },
  sizeFilterText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  sortButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  sortButtonText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  sortButtonTextActive: {
    color: '#000',
  },
  // Resume Modal Styles
  resumeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resumeModalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: 24,
    padding: isTV ? 40 : 28,
    width: isTV ? 450 : '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  resumeModalIcon: {
    marginBottom: 16,
  },
  resumeModalTitle: {
    fontSize: isTV ? 26 : 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  resumeModalSubtitle: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  resumeProgressContainer: {
    width: '100%',
    marginBottom: 24,
  },
  resumeProgressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  resumeProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  resumeProgressText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  resumeModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  resumeModalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: isTV ? 16 : 14,
    borderRadius: 12,
  },
  resumeModalButtonSecondary: {
    backgroundColor: theme.colors.surface,
  },
  resumeModalButtonText: {
    fontSize: isTV ? 16 : 14,
    fontWeight: '600',
    color: '#000',
  },
  resumeModalButtonTextSecondary: {
    color: theme.colors.text,
  },
  // Free Servers Modal Styles
  freeModalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: SCREEN_HEIGHT * 0.75,
    borderWidth: 1,
    borderColor: '#00E676',
  },
  freeModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  freeServerNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  freeServerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: isTV ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  freeServerCardBest: {
    borderColor: '#00E676',
    borderWidth: 2,
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
  },
  freeServerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  freeServerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  freeServerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E676',
    letterSpacing: 0.5,
  },
  bestServerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E676',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    gap: 2,
  },
  bestServerText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
  },
  freeServerName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  freeServerQuality: {
    fontSize: theme.fontSize.sm,
    color: '#00E676',
    fontWeight: theme.fontWeight.medium,
  },
});
