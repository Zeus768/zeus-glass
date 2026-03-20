import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, Dimensions, BackHandler } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';

// Only import expo-pip on native platforms
let ExpoPip: any = null;
if (Platform.OS === 'android') {
  try {
    ExpoPip = require('expo-pip');
  } catch (e) {
    console.log('[PiP] expo-pip not available (web or unsupported platform)');
  }
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface IPTVPipPlayerProps {
  url: string;
  title: string;
  channelLogo?: string;
  onClose: () => void;
  onEnterFullscreen?: () => void;
  visible: boolean;
}

export function IPTVPipPlayer({
  url,
  title,
  channelLogo,
  onClose,
  onEnterFullscreen,
  visible,
}: IPTVPipPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isInPipMode, setIsInPipMode] = useState(false);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Use expo-pip hook if available
  const pipState = ExpoPip?.useIsInPip?.();
  const isPipModeActive = pipState?.isInPipMode || isInPipMode;

  // Handle back button during PiP
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isPipModeActive) {
        // Exit PiP mode
        exitPipMode();
        return true;
      }
      onClose();
      return true;
    });

    return () => backHandler.remove();
  }, [visible, isPipModeActive]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && !isPipModeActive) {
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    }
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, [showControls, isPipModeActive]);

  const enterPipMode = useCallback(async () => {
    if (!ExpoPip || Platform.OS !== 'android') {
      console.log('[PiP] PiP not available on this platform');
      return;
    }

    try {
      // Enter PiP with 16:9 aspect ratio
      await ExpoPip.enterPipMode({ 
        width: 16, 
        height: 9,
      });
      setIsInPipMode(true);
      console.log('[PiP] Entered PiP mode');
    } catch (err) {
      console.error('[PiP] Error entering PiP:', err);
    }
  }, []);

  const exitPipMode = useCallback(async () => {
    if (!ExpoPip) return;
    
    try {
      // ExpoPip doesn't have explicit exit - user controls it
      setIsInPipMode(false);
    } catch (err) {
      console.error('[PiP] Error exiting PiP:', err);
    }
  }, []);

  const handlePlaybackStatusUpdate = (newStatus: AVPlaybackStatus) => {
    setStatus(newStatus);
    if (newStatus.isLoaded) {
      setIsLoading(false);
      setError(null);
    } else if ('error' in newStatus) {
      setError(newStatus.error || 'Playback error');
      setIsLoading(false);
    }
  };

  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current || !status?.isLoaded) return;
    
    if (status.isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  }, [status]);

  if (!visible) return null;

  // In PiP mode, only show the video (no UI overlay)
  if (isPipModeActive && Platform.OS === 'android') {
    return (
      <View style={styles.pipContainer}>
        <Video
          ref={videoRef}
          source={{ uri: url }}
          style={styles.pipVideo}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />
      </View>
    );
  }

  // Normal mini-player UI (corner overlay)
  return (
    <View style={styles.miniPlayerContainer}>
      <Pressable 
        style={styles.miniPlayer}
        onPress={() => setShowControls(!showControls)}
      >
        {/* Video */}
        <Video
          ref={videoRef}
          source={{ uri: url }}
          style={styles.miniVideo}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorOverlay}>
            <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
          </View>
        )}

        {/* Controls Overlay */}
        {showControls && !isLoading && !error && (
          <View style={styles.controlsOverlay}>
            {/* Top Bar - Title & Close */}
            <View style={styles.topBar}>
              <Text style={styles.miniTitle} numberOfLines={1}>{title}</Text>
              <Pressable 
                style={styles.closeBtn}
                onPress={onClose}
                data-testid="pip-close-btn"
              >
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </View>

            {/* Center Controls */}
            <View style={styles.centerControls}>
              <Pressable style={styles.controlBtn} onPress={togglePlayPause}>
                <Ionicons 
                  name={status?.isLoaded && status.isPlaying ? 'pause' : 'play'} 
                  size={24} 
                  color="#fff" 
                />
              </Pressable>
            </View>

            {/* Bottom Bar - PiP & Fullscreen */}
            <View style={styles.bottomBar}>
              {Platform.OS === 'android' && ExpoPip && (
                <Pressable 
                  style={styles.bottomBtn}
                  onPress={enterPipMode}
                  data-testid="pip-enter-btn"
                >
                  <Ionicons name="albums-outline" size={14} color="#fff" />
                  <Text style={styles.bottomBtnText}>PiP</Text>
                </Pressable>
              )}
              
              {onEnterFullscreen && (
                <Pressable 
                  style={styles.bottomBtn}
                  onPress={onEnterFullscreen}
                  data-testid="pip-fullscreen-btn"
                >
                  <Ionicons name="expand" size={14} color="#fff" />
                  <Text style={styles.bottomBtnText}>Full</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </Pressable>

      {/* Drag handle (future: could make draggable) */}
      <View style={styles.dragHandle}>
        <View style={styles.dragIndicator} />
      </View>
    </View>
  );
}

// Mini player dimensions
const MINI_WIDTH = isTV ? 320 : 200;
const MINI_HEIGHT = isTV ? 180 : 112;

const styles = StyleSheet.create({
  pipContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  pipVideo: {
    flex: 1,
  },
  miniPlayerContainer: {
    position: 'absolute',
    bottom: isTV ? 100 : 80,
    right: isTV ? 24 : 16,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  miniPlayer: {
    width: MINI_WIDTH,
    height: MINI_HEIGHT,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  miniVideo: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  miniTitle: {
    fontSize: isTV ? 12 : 10,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  closeBtn: {
    padding: 4,
    backgroundColor: 'rgba(255,0,0,0.6)',
    borderRadius: 12,
  },
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtn: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 6,
    gap: 8,
  },
  bottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  bottomBtnText: {
    fontSize: isTV ? 11 : 9,
    color: '#fff',
    fontWeight: '600',
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.textMuted,
    borderRadius: 2,
  },
});

export default IPTVPipPlayer;
