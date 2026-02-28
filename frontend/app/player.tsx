import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { StatusBar } from 'expo-status-bar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlayerScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title: string }>();
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    // Hide controls after 3 seconds
    const timer = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(timer);
  }, [showControls]);

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

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {/* Video Player */}
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
          onPlaybackStatusUpdate={(status) => setStatus(status)}
          onLoad={() => setLoading(false)}
          onError={(error) => {
            console.error('Video error:', error);
            setError('Failed to load video');
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

        {/* Error */}
        {error && (
          <View style={styles.errorOverlay}>
            <Ionicons name="alert-circle" size={64} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </Pressable>
          </View>
        )}

        {/* Controls Overlay */}
        {showControls && !loading && !error && (
          <View style={styles.controlsOverlay}>
            {/* Top Bar */}
            <View style={styles.topBar}>
              <Pressable onPress={() => router.back()} style={styles.closeButton}>
                <Ionicons name="close" size={32} color={theme.colors.text} />
              </Pressable>
              <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
              <View style={styles.placeholder} />
            </View>

            {/* Center Controls */}
            <View style={styles.centerControls}>
              <Pressable onPress={() => handleSeek(-10)} style={styles.controlButton}>
                <Ionicons name="play-back" size={48} color={theme.colors.text} />
                <Text style={styles.controlLabel}>-10s</Text>
              </Pressable>

              <Pressable onPress={handlePlayPause} style={styles.playButton}>
                <Ionicons 
                  name={status && 'isPlaying' in status && status.isPlaying ? 'pause' : 'play'} 
                  size={64} 
                  color={theme.colors.text} 
                />
              </Pressable>

              <Pressable onPress={() => handleSeek(10)} style={styles.controlButton}>
                <Ionicons name="play-forward" size={48} color={theme.colors.text} />
                <Text style={styles.controlLabel}>+10s</Text>
              </Pressable>
            </View>

            {/* Bottom Bar */}
            <View style={styles.bottomBar}>
              {status && 'positionMillis' in status && 'durationMillis' in status && (
                <>
                  <Text style={styles.timeText}>
                    {formatTime(status.positionMillis || 0)} / {formatTime(status.durationMillis || 0)}
                  </Text>
                  
                  {/* Progress Bar */}
                  <View style={styles.progressBarContainer}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { width: `${((status.positionMillis || 0) / (status.durationMillis || 1)) * 100}%` }
                      ]} 
                    />
                  </View>
                </>
              )}
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
    backgroundColor: theme.colors.background,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.lg,
    color: theme.colors.error,
    textAlign: 'center',
  },
  backButton: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
  },
  backButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    paddingTop: 48,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  titleText: {
    flex: 1,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginHorizontal: theme.spacing.md,
  },
  placeholder: {
    width: 48,
  },
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xxl,
  },
  controlButton: {
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  controlLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  playButton: {
    backgroundColor: 'rgba(0, 217, 255, 0.3)',
    borderRadius: 50,
    padding: theme.spacing.lg,
  },
  bottomBar: {
    padding: theme.spacing.lg,
    paddingBottom: 48,
  },
  timeText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
});
