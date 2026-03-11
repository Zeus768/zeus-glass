import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions, BackHandler, Platform, StatusBar as RNStatusBar, Modal, ScrollView, TextInput } from 'react-native';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlayerScreen() {
  const { url, title, type, imdbId, season, episode } = useLocalSearchParams<{ 
    url: string; 
    title: string; 
    type?: 'video' | 'embed';
    imdbId?: string;
    season?: string;
    episode?: string;
  }>();
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [focusedButton, setFocusedButton] = useState<string | null>(null);
  const [isEmbed, setIsEmbed] = useState(false);
  
  // Subtitle state
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleTrack | null>(null);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings | null>(null);
  const [loadingSubtitles, setLoadingSubtitles] = useState(false);
  const [showSubtitleSettings, setShowSubtitleSettings] = useState(false);
  
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Determine if this is an embed URL
    const embedPatterns = ['vidsrc', 'embed', 'flixmomo', 'cineby', 'hydrahd', 'yflix', 'autoembed', 'smashystream', '2embed', 'multiembed'];
    const isEmbedUrl = type === 'embed' || embedPatterns.some(p => url?.toLowerCase().includes(p));
    setIsEmbed(isEmbedUrl);

    // Enter immersive fullscreen mode
    const enterFullscreen = async () => {
      try {
        // Lock to landscape for fullscreen video
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
      
      // Unlock orientation
      await ScreenOrientation.unlockAsync();
      
      // Force back to portrait on mobile (not TV)
      if (!isTV && Platform.OS !== 'web') {
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
    // Auto-hide controls after 5 seconds
    if (showControls && status && 'isPlaying' in status && status.isPlaying) {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    }

    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, [showControls, status]);

  const handleClose = useCallback(async () => {
    if (videoRef.current) {
      await videoRef.current.stopAsync();
    }
    await resetOrientation();
    router.back();
  }, [router]);

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
        
        {/* Title */}
        <View style={styles.embedTitleBar}>
          <Text style={styles.embedTitle} numberOfLines={1}>{title || 'Playing'}</Text>
        </View>
        
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
    );
  }

  // Render native Video player for direct streams
  return (
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
          onPlaybackStatusUpdate={(status) => {
            setStatus(status);
            if (status.isLoaded && loading) {
              setLoading(false);
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
              <View style={styles.placeholder} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
});
