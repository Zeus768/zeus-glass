import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions, BackHandler, Platform, StatusBar as RNStatusBar, Modal, ScrollView, TextInput, Linking, Alert } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import * as DocumentPicker from 'expo-document-picker';
import { subtitleService, SubtitleTrack, SubtitleSettings } from '../services/subtitleService';
import { traktService } from '../services/trakt';
import { watchHistoryService } from '../services/watchHistoryService';
import { useContentStore } from '../store/contentStore';
import { playerState } from '../utils/playerState';
import * as Clipboard from 'expo-clipboard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlayerScreen() {
  const { url, title, type, imdbId, tmdbId, season, episode, episodeTitle, posterPath, backdropPath, mediaType, duration: paramDuration, resumePosition } = useLocalSearchParams<{ 
    url: string; 
    title: string; 
    type?: 'video' | 'embed';
    imdbId?: string;
    tmdbId?: string;
    season?: string;
    episode?: string;
    episodeTitle?: string;
    posterPath?: string;
    backdropPath?: string;
    mediaType?: 'movie' | 'tv';
    duration?: string;
    resumePosition?: string;
  }>();
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const { updateWatchProgress, loadLocalWatchHistory } = useContentStore();
  
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [focusedButton, setFocusedButton] = useState<string | null>(null);
  const [isEmbed, setIsEmbed] = useState(false);
  const [hasSeekToResume, setHasSeekToResume] = useState(false);
  
  // Subtitle state
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleTrack | null>(null);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings | null>(null);
  const [loadingSubtitles, setLoadingSubtitles] = useState(false);
  const [showSubtitleSettings, setShowSubtitleSettings] = useState(false);
  
  // Quick Settings overlay
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  
  // External player modal
  const [showExternalPlayerModal, setShowExternalPlayerModal] = useState(false);
  
  // Subtitle language picker
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  
  // Scrobbling/Watch tracking state
  const [isScrobbling, setIsScrobbling] = useState(false);
  const [lastScrobbleTime, setLastScrobbleTime] = useState(0);
  const scrobbleInterval = useRef<NodeJS.Timeout | null>(null);
  
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Available subtitle languages
  const availableLanguages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'tr', name: 'Turkish' },
  ];

  const toggleLanguagePreference = async (langCode: string) => {
    if (!subtitleSettings) return;
    
    const currentLangs = subtitleSettings.preferredLanguages || ['en'];
    let newLangs: string[];
    
    if (currentLangs.includes(langCode)) {
      // Remove language (but keep at least one)
      newLangs = currentLangs.filter(l => l !== langCode);
      if (newLangs.length === 0) newLangs = ['en'];
    } else {
      // Add language
      newLangs = [...currentLangs, langCode];
    }
    
    await subtitleService.saveSettings({ preferredLanguages: newLangs });
    setSubtitleSettings(subtitleService.getSettings());
  };

  // Scrobbling and watch history functions
  const startScrobbling = async () => {
    if (!imdbId || isScrobbling) return;
    
    try {
      const isAuthenticated = await traktService.isAuthenticated();
      if (!isAuthenticated) return;
      
      setIsScrobbling(true);
      
      if (mediaType === 'movie') {
        await traktService.startWatching({ imdb: imdbId }, 0);
      } else if (season && episode) {
        await traktService.startWatching(
          { imdb: imdbId },
          0,
          parseInt(season),
          parseInt(episode)
        );
      }
      
      console.log('[Scrobble] Started watching');
    } catch (error) {
      console.error('[Scrobble] Error starting:', error);
    }
  };

  const updateScrobbleProgress = async (progress: number) => {
    if (!imdbId || !isScrobbling) return;
    
    // Only update every 30 seconds minimum
    const now = Date.now();
    if (now - lastScrobbleTime < 30000) return;
    
    try {
      setLastScrobbleTime(now);
      
      if (mediaType === 'movie') {
        await traktService.startWatching({ imdb: imdbId }, progress);
      } else if (season && episode) {
        await traktService.startWatching(
          { imdb: imdbId },
          progress,
          parseInt(season),
          parseInt(episode)
        );
      }
      
      console.log(`[Scrobble] Progress: ${progress.toFixed(1)}%`);
    } catch (error) {
      console.error('[Scrobble] Error updating progress:', error);
    }
  };

  const stopScrobbling = async (progress: number) => {
    if (!imdbId) return;
    
    try {
      const isAuthenticated = await traktService.isAuthenticated();
      
      if (isAuthenticated && isScrobbling) {
        if (mediaType === 'movie') {
          await traktService.stopWatching({ imdb: imdbId }, progress);
        } else if (season && episode) {
          await traktService.stopWatching(
            { imdb: imdbId },
            progress,
            parseInt(season),
            parseInt(episode)
          );
        }
        console.log(`[Scrobble] Stopped at ${progress.toFixed(1)}%`);
      }
      
      setIsScrobbling(false);
    } catch (error) {
      console.error('[Scrobble] Error stopping:', error);
    }
  };

  // Update local watch history
  const updateLocalWatchHistory = async (currentPos: number, totalDuration: number) => {
    if (!tmdbId || !title) return;
    
    const progress = totalDuration > 0 ? (currentPos / totalDuration) * 100 : 0;
    
    try {
      await updateWatchProgress({
        id: Date.now(),
        tmdbId: parseInt(tmdbId),
        imdbId: imdbId,
        title: title,
        poster_path: posterPath,
        backdrop_path: backdropPath,
        type: mediaType || 'movie',
        season: season ? parseInt(season) : undefined,
        episode: episode ? parseInt(episode) : undefined,
        episodeTitle: episodeTitle,
        progress: progress,
        duration: totalDuration,
        currentTime: currentPos,
        streamUrl: url,
      });
    } catch (error) {
      console.error('[WatchHistory] Error updating:', error);
    }
  };

  // External player options
  const externalPlayers = [
    { name: 'VLC', scheme: 'vlc://', icon: 'play-circle' },
    { name: 'MX Player', scheme: 'intent://play?url=', intentExtra: '#Intent;package=com.mxtech.videoplayer.ad;end', icon: 'film' },
    { name: 'nPlayer', scheme: 'nplayer-', icon: 'videocam' },
    { name: 'Just Player', scheme: 'intent://play?url=', intentExtra: '#Intent;package=com.brouken.player;end', icon: 'play' },
    { name: 'Copy URL', scheme: 'copy', icon: 'copy' },
  ];

  const openInExternalPlayer = async (player: typeof externalPlayers[0]) => {
    if (!url) return;
    
    try {
      if (player.scheme === 'copy') {
        await Clipboard.setStringAsync(url);
        Alert.alert('Copied!', 'URL copied to clipboard');
        setShowExternalPlayerModal(false);
        return;
      }
      
      let playerUrl = '';
      
      if (player.name === 'VLC') {
        playerUrl = `vlc://${url}`;
      } else if (player.name === 'MX Player' || player.name === 'Just Player') {
        playerUrl = `intent:${url}${player.intentExtra}`;
      } else if (player.name === 'nPlayer') {
        playerUrl = `nplayer-${url}`;
      }
      
      const canOpen = await Linking.canOpenURL(playerUrl);
      if (canOpen) {
        await Linking.openURL(playerUrl);
        setShowExternalPlayerModal(false);
      } else {
        Alert.alert(
          'Player Not Found',
          `${player.name} is not installed on your device. Would you like to copy the URL instead?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Copy URL', onPress: async () => {
              await Clipboard.setStringAsync(url);
              Alert.alert('Copied!', 'URL copied to clipboard');
            }},
          ]
        );
      }
    } catch (error) {
      console.error('Error opening external player:', error);
      Alert.alert('Error', 'Could not open external player');
    }
  };

  // Load subtitle settings on mount
  useEffect(() => {
    subtitleService.init().then(() => {
      setSubtitleSettings(subtitleService.getSettings());
    });
  }, []);

  // Signal to layout that player is active (hides header/tabs)
  useEffect(() => {
    playerState.setActive(true);
    return () => {
      playerState.setActive(false);
    };
  }, []);

  useEffect(() => {
    // Determine if this is an embed URL
    const embedPatterns = ['vidsrc', 'embed', 'flixmomo', 'cineby', 'hydrahd', 'yflix', 'autoembed', 'smashystream', '2embed', 'multiembed'];
    const isEmbedUrl = type === 'embed' || embedPatterns.some(p => url?.toLowerCase().includes(p));
    setIsEmbed(isEmbedUrl);

    // Enter immersive fullscreen mode
    const enterFullscreen = async () => {
      try {
        // TV devices are already in landscape, just hide system UI
        if (Platform.isTV) {
          if (Platform.OS === 'android') {
            RNStatusBar.setHidden(true, 'fade');
            try {
              await NavigationBar.setVisibilityAsync('hidden');
              await NavigationBar.setBehaviorAsync('overlay-swipe');
            } catch (navError) {
              console.log('NavigationBar API not available:', navError);
            }
          }
        } else {
          // Mobile: Lock to landscape for fullscreen video
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          
          // Hide Android navigation bar for true fullscreen
          if (Platform.OS === 'android') {
            RNStatusBar.setHidden(true, 'fade');
            try {
              await NavigationBar.setVisibilityAsync('hidden');
              await NavigationBar.setBehaviorAsync('overlay-swipe');
            } catch (navError) {
              console.log('NavigationBar API not available:', navError);
            }
          }
        }
        
        // Web fullscreen
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          try {
            await document.documentElement.requestFullscreen?.();
          } catch (e) {}
        }
      } catch (e) {
        console.log('Could not enter fullscreen:', e);
      }
    };
    
    enterFullscreen();

    // Handle back button on TV/Android
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });

    return () => {
      backHandler.remove();
    };
  }, [url, type]);

  // Use useFocusEffect to handle cleanup when leaving the screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Cleanup when screen loses focus
        resetOrientation();
      };
    }, [])
  );

  const resetOrientation = async () => {
    try {
      // Restore navigation bar visibility first
      if (Platform.OS === 'android') {
        RNStatusBar.setHidden(false, 'fade');
        try {
          await NavigationBar.setVisibilityAsync('visible');
        } catch (navError) {
          console.log('NavigationBar API not available:', navError);
        }
      }
      
      // Exit web fullscreen
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.fullscreenElement) {
        try {
          await document.exitFullscreen?.();
        } catch (e) {}
      }
      
      // On TV devices, don't change orientation (TVs are always landscape)
      if (isTV) {
        return;
      }
      
      // Unlock orientation
      await ScreenOrientation.unlockAsync();
      
      // Force back to portrait on mobile (not TV)
      if (Platform.OS !== 'web') {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        // Unlock after a short delay to allow normal rotation
        setTimeout(async () => {
          try {
            await ScreenOrientation.unlockAsync();
          } catch (e) {
            console.log('Could not unlock orientation:', e);
          }
        }, 300);
      }
    } catch (e) {
      console.log('Could not reset orientation:', e);
    }
  };

  useEffect(() => {
    // Auto-hide controls after 3 seconds (reduced from 5 for better TV UX)
    if (showControls && status && 'isPlaying' in status && status.isPlaying) {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, [showControls, status]);

  // On TV, reset controls auto-hide timer when a button gets focus
  useEffect(() => {
    if (Platform.isTV && showControls && focusedButton) {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [focusedButton]);

  const handleClose = useCallback(async () => {
    // Save final watch position and stop scrobbling
    if (status && 'positionMillis' in status && 'durationMillis' in status) {
      const currentPos = status.positionMillis / 1000;
      const totalDuration = status.durationMillis / 1000;
      const progress = totalDuration > 0 ? (currentPos / totalDuration) * 100 : 0;
      
      // Update local watch history
      if (tmdbId && title) {
        await updateLocalWatchHistory(currentPos, totalDuration);
      }
      
      // Stop Trakt scrobbling
      await stopScrobbling(progress);
      
      // Reload watch history on home
      loadLocalWatchHistory();
    }
    
    if (videoRef.current) {
      await videoRef.current.stopAsync();
    }
    await resetOrientation();
    router.back();
  }, [router, status, tmdbId, title]);

  const handlePlayPause = () => {
    if (status && 'isPlaying' in status) {
      if (status.isPlaying) {
        videoRef.current?.pauseAsync();
      } else {
        videoRef.current?.playAsync();
      }
    }
    setShowControls(true);
  };

  const handleSeek = (seconds: number) => {
    if (status && 'positionMillis' in status) {
      const newPosition = status.positionMillis + (seconds * 1000);
      videoRef.current?.setPositionAsync(Math.max(0, newPosition));
    }
    setShowControls(true);
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isPlaying = status && 'isPlaying' in status && status.isPlaying;
  const position = status && 'positionMillis' in status ? status.positionMillis : 0;
  const duration = status && 'durationMillis' in status ? status.durationMillis : 0;
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  // Render WebView for embed sources
  if (isEmbed) {
    return (
      <Modal visible={true} transparent={false} animationType="none" statusBarTranslucent={true}>
        <View style={styles.container}>
          <Stack.Screen options={{ headerShown: false }} />
          <StatusBar hidden />
        
        {/* Close Button for Embed */}
        <Pressable 
          onPress={handleClose}
          style={[styles.embedCloseButton, focusedButton === 'close' && styles.buttonFocused]}
          onFocus={() => setFocusedButton('close')}
          onBlur={() => setFocusedButton(null)}
        >
          <Ionicons name="close" size={isTV ? 36 : 28} color="#fff" />
        </Pressable>
        
        {/* Quick Settings Button */}
        <Pressable 
          onPress={() => setShowQuickSettings(!showQuickSettings)}
          style={[styles.quickSettingsButton, focusedButton === 'quicksettings' && styles.buttonFocused]}
          onFocus={() => setFocusedButton('quicksettings')}
          onBlur={() => setFocusedButton(null)}
        >
          <Ionicons name="settings-outline" size={isTV ? 32 : 24} color="#fff" />
        </Pressable>
        
        {/* Title */}
        <View style={styles.embedTitleBar}>
          <Text style={styles.embedTitle} numberOfLines={1}>{title || 'Playing'}</Text>
        </View>
        
        {/* Quick Settings Panel */}
        {showQuickSettings && (
          <View style={styles.quickSettingsPanel}>
            <Text style={styles.quickSettingsTitle}>Quick Settings</Text>
            
            {/* Subtitles Toggle */}
            <Pressable 
              style={styles.quickSettingRow}
              onPress={() => {
                if (subtitleSettings) {
                  const newEnabled = !subtitleSettings.enabled;
                  subtitleService.saveSettings({ enabled: newEnabled });
                  setSubtitleSettings({ ...subtitleSettings, enabled: newEnabled });
                }
              }}
            >
              <View style={styles.quickSettingInfo}>
                <Ionicons name="text" size={20} color={theme.colors.primary} />
                <Text style={styles.quickSettingLabel}>Subtitles</Text>
              </View>
              <View style={[
                styles.quickSettingToggle,
                subtitleSettings?.enabled && styles.quickSettingToggleOn,
              ]}>
                <Text style={styles.quickSettingToggleText}>
                  {subtitleSettings?.enabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </Pressable>

            {/* Subtitle Size */}
            <View style={styles.quickSettingSizeRow}>
              <Text style={styles.quickSettingSizeLabel}>Size:</Text>
              {(['small', 'medium', 'large', 'extra-large'] as const).map((size) => (
                <Pressable
                  key={size}
                  style={[
                    styles.sizeButton,
                    subtitleSettings?.fontSize === size && styles.sizeButtonActive,
                  ]}
                  onPress={() => {
                    subtitleService.saveSettings({ fontSize: size });
                    setSubtitleSettings(subtitleService.getSettings());
                  }}
                >
                  <Text style={[
                    styles.sizeButtonText,
                    subtitleSettings?.fontSize === size && styles.sizeButtonTextActive,
                  ]}>
                    {size === 'extra-large' ? 'XL' : size.charAt(0).toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
            
            {/* Language Preferences Button */}
            <Pressable 
              style={styles.quickSettingRow}
              onPress={() => setShowLanguagePicker(true)}
            >
              <View style={styles.quickSettingInfo}>
                <Ionicons name="language" size={20} color={theme.colors.primary} />
                <Text style={styles.quickSettingLabel}>Languages</Text>
              </View>
              <View style={styles.languageChips}>
                {(subtitleSettings?.preferredLanguages || ['en']).slice(0, 3).map(lang => (
                  <Text key={lang} style={styles.languageChipSmall}>
                    {lang.toUpperCase()}
                  </Text>
                ))}
                {(subtitleSettings?.preferredLanguages?.length || 0) > 3 && (
                  <Text style={styles.languageChipSmall}>+{(subtitleSettings?.preferredLanguages?.length || 0) - 3}</Text>
                )}
              </View>
            </Pressable>
            
            <Pressable 
              style={styles.closeQuickSettings}
              onPress={() => setShowQuickSettings(false)}
            >
              <Text style={styles.closeQuickSettingsText}>Close</Text>
            </Pressable>
          </View>
        )}
        
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          allowsFullscreenVideo={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading stream...</Text>
            </View>
          )}
        />
        
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading stream...</Text>
          </View>
        )}
      </View>
      </Modal>
    );
  }

  // Render native Video player for direct streams
  return (
    <Modal visible={true} transparent={false} animationType="none" statusBarTranslucent={true}>
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      
      {/* Video Player - Full Screen */}
      <Pressable 
        style={styles.videoContainer}
        onPress={() => setShowControls(!showControls)}
      >
        <Video
          ref={videoRef}
          source={{ uri: url }}
          style={styles.video}
          useNativeControls={false}
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
          onPlaybackStatusUpdate={(playbackStatus) => {
            setStatus(playbackStatus);
            if (playbackStatus.isLoaded && loading) {
              setLoading(false);
              
              // Seek to resume position if provided
              if (resumePosition && !hasSeekToResume && videoRef.current) {
                const seekTo = parseFloat(resumePosition) * 1000; // Convert to milliseconds
                if (seekTo > 0) {
                  videoRef.current.setPositionAsync(seekTo);
                  setHasSeekToResume(true);
                  console.log(`[Player] Seeking to resume position: ${resumePosition}s`);
                }
              }
            }
            
            // Handle scrobbling and watch history
            if (playbackStatus.isLoaded && 'positionMillis' in playbackStatus && 'durationMillis' in playbackStatus) {
              const currentPos = playbackStatus.positionMillis / 1000;
              const totalDuration = playbackStatus.durationMillis / 1000;
              const progress = totalDuration > 0 ? (currentPos / totalDuration) * 100 : 0;
              
              // Start scrobbling when playback begins
              if (playbackStatus.isPlaying && !isScrobbling && progress > 1) {
                startScrobbling();
              }
              
              // Update progress periodically
              if (playbackStatus.isPlaying && progress > 0) {
                updateScrobbleProgress(progress);
              }
              
              // Update local watch history every 15 seconds
              if (playbackStatus.isPlaying && totalDuration > 0) {
                const now = Date.now();
                if (now - lastScrobbleTime >= 15000) {
                  updateLocalWatchHistory(currentPos, totalDuration);
                }
              }
            }
          }}
          onLoad={() => setLoading(false)}
          onError={(error) => {
            console.error('Video error:', error);
            setError('Failed to load video. Try another source.');
            setLoading(false);
          }}
          shouldPlay
        />

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading video...</Text>
          </View>
        )}

        {/* Buffering Indicator */}
        {status && 'isBuffering' in status && status.isBuffering && !loading && (
          <View style={styles.bufferingIndicator}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorOverlay}>
            <Ionicons name="alert-circle" size={64} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable 
              style={[styles.errorButton, focusedButton === 'back' && styles.buttonFocused]} 
              onPress={handleClose}
              onFocus={() => setFocusedButton('back')}
              onBlur={() => setFocusedButton(null)}
            >
              <Text style={styles.errorButtonText}>Go Back</Text>
            </Pressable>
          </View>
        )}

        {/* Controls Overlay */}
        {showControls && !loading && !error && (
          <View style={styles.controlsOverlay}>
            {/* Top Bar */}
            <View style={styles.topBar}>
              <Pressable 
                onPress={handleClose} 
                style={[styles.closeButton, focusedButton === 'close' && styles.buttonFocused]}
                onFocus={() => setFocusedButton('close')}
                onBlur={() => setFocusedButton(null)}
              >
                <Ionicons name="arrow-back" size={isTV ? 36 : 28} color="#fff" />
              </Pressable>
              <Text style={styles.titleText} numberOfLines={1}>{title || 'Playing'}</Text>
              <Pressable 
                onPress={() => setShowExternalPlayerModal(true)} 
                style={[styles.externalPlayerButton, focusedButton === 'external' && styles.buttonFocused]}
                onFocus={() => setFocusedButton('external')}
                onBlur={() => setFocusedButton(null)}
              >
                <Ionicons name="open-outline" size={isTV ? 28 : 22} color="#fff" />
              </Pressable>
            </View>

            {/* Center Controls */}
            <View style={styles.centerControls}>
              <Pressable 
                onPress={() => handleSeek(-10)} 
                style={[styles.controlButton, focusedButton === 'rewind' && styles.buttonFocused]}
                onFocus={() => setFocusedButton('rewind')}
                onBlur={() => setFocusedButton(null)}
              >
                <Ionicons name="play-back" size={isTV ? 56 : 44} color="#fff" />
                <Text style={styles.controlLabel}>-10s</Text>
              </Pressable>

              <Pressable 
                onPress={handlePlayPause} 
                style={[styles.playButton, focusedButton === 'play' && styles.playButtonFocused]}
                onFocus={() => setFocusedButton('play')}
                onBlur={() => setFocusedButton(null)}
                {...(Platform.isTV && { hasTVPreferredFocus: true })}
              >
                <Ionicons 
                  name={isPlaying ? 'pause' : 'play'} 
                  size={isTV ? 72 : 56} 
                  color="#fff" 
                />
              </Pressable>

              <Pressable 
                onPress={() => handleSeek(10)} 
                style={[styles.controlButton, focusedButton === 'forward' && styles.buttonFocused]}
                onFocus={() => setFocusedButton('forward')}
                onBlur={() => setFocusedButton(null)}
              >
                <Ionicons name="play-forward" size={isTV ? 56 : 44} color="#fff" />
                <Text style={styles.controlLabel}>+10s</Text>
              </Pressable>
            </View>

            {/* Bottom Bar */}
            <View style={styles.bottomBar}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              
              {/* Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
              </View>
              
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>
        )}
      </Pressable>
      
      {/* External Player Modal */}
      <Modal
        visible={showExternalPlayerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExternalPlayerModal(false)}
      >
        <View style={styles.externalPlayerOverlay}>
          <View style={styles.externalPlayerModal}>
            <View style={styles.externalPlayerHeader}>
              <Text style={styles.externalPlayerTitle}>Open in External Player</Text>
              <Pressable onPress={() => setShowExternalPlayerModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>
            <Text style={styles.externalPlayerSubtitle}>Choose a player to open this video</Text>
            
            <View style={styles.externalPlayerList}>
              {externalPlayers.map((player, index) => (
                <Pressable
                  key={player.name}
                  style={styles.externalPlayerItem}
                  onPress={() => openInExternalPlayer(player)}
                >
                  <View style={styles.externalPlayerIcon}>
                    <Ionicons name={player.icon as any} size={24} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.externalPlayerName}>{player.name}</Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <View style={styles.languagePickerOverlay}>
          <View style={styles.languagePickerModal}>
            <View style={styles.languagePickerHeader}>
              <Text style={styles.languagePickerTitle}>Subtitle Languages</Text>
              <Pressable onPress={() => setShowLanguagePicker(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>
            <Text style={styles.languagePickerSubtitle}>
              Select your preferred subtitle languages (tap to toggle)
            </Text>
            
            <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
              {availableLanguages.map((lang) => {
                const isSelected = subtitleSettings?.preferredLanguages?.includes(lang.code);
                return (
                  <Pressable
                    key={lang.code}
                    style={[styles.languageItem, isSelected && styles.languageItemSelected]}
                    onPress={() => toggleLanguagePreference(lang.code)}
                  >
                    <View style={styles.languageInfo}>
                      <Text style={[styles.languageName, isSelected && styles.languageNameSelected]}>
                        {lang.name}
                      </Text>
                      <Text style={[styles.languageCode, isSelected && styles.languageCodeSelected]}>
                        {lang.code.toUpperCase()}
                      </Text>
                    </View>
                    <View style={[styles.languageCheckbox, isSelected && styles.languageCheckboxSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={18} color="#000" />}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            
            <Pressable 
              style={styles.languagePickerDone}
              onPress={() => setShowLanguagePicker(false)}
            >
              <Text style={styles.languagePickerDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    ...(Platform.OS === 'web' ? {
      position: 'fixed' as any,
    } : {
      position: 'absolute',
    }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  embedCloseButton: {
    position: 'absolute',
    top: isTV ? 20 : 40,
    left: isTV ? 20 : 16,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    padding: 10,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  embedTitleBar: {
    position: 'absolute',
    top: isTV ? 20 : 40,
    left: 0,
    right: 0,
    zIndex: 50,
    alignItems: 'center',
    paddingHorizontal: 80,
  },
  embedTitle: {
    fontSize: isTV ? 24 : 18,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: isTV ? 24 : 18,
    color: '#fff',
  },
  bufferingIndicator: {
    position: 'absolute',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    marginTop: theme.spacing.md,
    fontSize: isTV ? 24 : 18,
    color: theme.colors.error,
    textAlign: 'center',
  },
  errorButton: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: isTV ? 40 : 30,
    paddingVertical: isTV ? 16 : 12,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  errorButtonText: {
    fontSize: isTV ? 22 : 16,
    fontWeight: 'bold',
    color: '#000',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isTV ? 30 : 20,
    paddingTop: isTV ? 40 : 48,
  },
  closeButton: {
    padding: theme.spacing.sm,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  titleText: {
    flex: 1,
    fontSize: isTV ? 28 : 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: theme.spacing.md,
  },
  placeholder: {
    width: isTV ? 60 : 48,
  },
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: isTV ? 80 : 50,
  },
  controlButton: {
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  controlLabel: {
    fontSize: isTV ? 18 : 14,
    color: '#fff',
    marginTop: theme.spacing.xs,
    fontWeight: '500',
  },
  playButton: {
    backgroundColor: 'rgba(0, 217, 255, 0.4)',
    borderRadius: isTV ? 60 : 50,
    padding: isTV ? 24 : 18,
    borderWidth: 4,
    borderColor: 'transparent',
  },
  playButtonFocused: {
    backgroundColor: theme.colors.primary,
    borderColor: '#fff',
    transform: [{ scale: 1.15 }],
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 30,
  },
  buttonFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(0, 217, 255, 0.3)',
    transform: [{ scale: 1.1 }],
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isTV ? 30 : 20,
    paddingBottom: isTV ? 40 : 30,
    gap: theme.spacing.md,
  },
  timeText: {
    fontSize: isTV ? 20 : 14,
    color: '#fff',
    fontWeight: '500',
    minWidth: isTV ? 100 : 60,
  },
  progressBarContainer: {
    flex: 1,
    height: isTV ? 8 : 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  // Quick Settings Styles
  quickSettingsButton: {
    position: 'absolute',
    top: isTV ? 28 : 20,
    right: isTV ? 100 : 70,
    zIndex: 1001,
    padding: isTV ? 16 : 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quickSettingsPanel: {
    position: 'absolute',
    top: isTV ? 80 : 60,
    right: isTV ? 30 : 20,
    zIndex: 1002,
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    borderRadius: 16,
    padding: isTV ? 24 : 20,
    minWidth: isTV ? 320 : 280,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
  },
  quickSettingsTitle: {
    fontSize: isTV ? 20 : 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: isTV ? 20 : 16,
  },
  quickSettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: isTV ? 16 : 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  quickSettingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickSettingLabel: {
    fontSize: isTV ? 18 : 14,
    color: theme.colors.text,
  },
  quickSettingToggle: {
    paddingHorizontal: isTV ? 16 : 12,
    paddingVertical: isTV ? 8 : 6,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
  },
  quickSettingToggleOn: {
    backgroundColor: theme.colors.primary,
  },
  quickSettingToggleText: {
    fontSize: isTV ? 14 : 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  quickSettingSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: isTV ? 16 : 12,
    gap: 10,
  },
  quickSettingSizeLabel: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textSecondary,
  },
  sizeButton: {
    paddingHorizontal: isTV ? 14 : 10,
    paddingVertical: isTV ? 8 : 6,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sizeButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(0, 217, 255, 0.2)',
  },
  sizeButtonText: {
    fontSize: isTV ? 14 : 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  sizeButtonTextActive: {
    color: theme.colors.primary,
  },
  closeQuickSettings: {
    marginTop: isTV ? 20 : 16,
    alignItems: 'center',
    paddingVertical: isTV ? 12 : 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
  },
  closeQuickSettingsText: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  // External Player Styles
  externalPlayerButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: isTV ? 12 : 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  externalPlayerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  externalPlayerModal: {
    width: isTV ? 500 : '85%',
    maxWidth: 400,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: isTV ? 30 : 24,
  },
  externalPlayerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  externalPlayerTitle: {
    fontSize: isTV ? 24 : 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  externalPlayerSubtitle: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  externalPlayerList: {
    gap: 12,
  },
  externalPlayerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: isTV ? 18 : 14,
    borderRadius: 12,
  },
  externalPlayerIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  externalPlayerName: {
    flex: 1,
    fontSize: isTV ? 18 : 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  // Language picker styles
  languageChips: {
    flexDirection: 'row',
    gap: 4,
  },
  languageChipSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.primary,
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  languagePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'flex-end',
  },
  languagePickerModal: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: isTV ? 30 : 24,
    maxHeight: '70%',
  },
  languagePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  languagePickerTitle: {
    fontSize: isTV ? 24 : 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  languagePickerSubtitle: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  languageList: {
    maxHeight: 350,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: isTV ? 16 : 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languageName: {
    fontSize: isTV ? 18 : 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  languageNameSelected: {
    color: theme.colors.primary,
  },
  languageCode: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textSecondary,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  languageCodeSelected: {
    backgroundColor: 'rgba(0, 217, 255, 0.2)',
    color: theme.colors.primary,
  },
  languageCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageCheckboxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  languagePickerDone: {
    backgroundColor: theme.colors.primary,
    paddingVertical: isTV ? 16 : 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  languagePickerDoneText: {
    fontSize: isTV ? 18 : 16,
    fontWeight: 'bold',
    color: '#000',
  },
});
