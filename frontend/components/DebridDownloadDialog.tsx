import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import { debridCacheService, realDebridService } from '../services/debrid';
import { CachedTorrent } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DownloadStage = 
  | 'checking_auth'
  | 'adding_torrent'
  | 'checking_cache'
  | 'downloading'
  | 'selecting_file'
  | 'getting_link'
  | 'ready'
  | 'error';

interface DebridDownloadDialogProps {
  visible: boolean;
  torrent: CachedTorrent | null;
  onClose: () => void;
  onStreamReady: (streamUrl: string) => void;
}

export function DebridDownloadDialog({
  visible,
  torrent,
  onClose,
  onStreamReady,
}: DebridDownloadDialogProps) {
  const [stage, setStage] = useState<DownloadStage>('checking_auth');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Initializing...');
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Stage descriptions
  const stageInfo: Record<DownloadStage, { icon: string; text: string; color: string }> = {
    checking_auth: { icon: 'key', text: 'Checking authentication...', color: theme.colors.primary },
    adding_torrent: { icon: 'magnet', text: 'Adding torrent to Real-Debrid...', color: '#8A2BE2' },
    checking_cache: { icon: 'flash', text: 'Checking cache status...', color: theme.colors.gold },
    downloading: { icon: 'cloud-download', text: 'Downloading...', color: theme.colors.info },
    selecting_file: { icon: 'folder-open', text: 'Selecting video file...', color: theme.colors.success },
    getting_link: { icon: 'link', text: 'Getting streaming link...', color: theme.colors.primary },
    ready: { icon: 'play-circle', text: 'Ready to play!', color: theme.colors.success },
    error: { icon: 'alert-circle', text: 'Error occurred', color: theme.colors.error },
  };

  useEffect(() => {
    if (visible && torrent) {
      startDownloadProcess();
    } else {
      // Reset state
      setStage('checking_auth');
      setProgress(0);
      setError(null);
      setStatusText('Initializing...');
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    }

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [visible, torrent]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const startDownloadProcess = async () => {
    if (!torrent) return;

    try {
      // Stage 1: Check authentication
      setStage('checking_auth');
      setStatusText('Verifying Real-Debrid account...');
      setProgress(5);

      const token = await realDebridService.getToken();
      if (!token) {
        setStage('error');
        setError('Not logged into Real-Debrid. Please login in Settings.');
        return;
      }

      // Stage 2: Add torrent
      setStage('adding_torrent');
      setStatusText(`Adding "${torrent.title}" to Real-Debrid...`);
      setProgress(15);

      // If it's cached, we can skip downloading
      if (torrent.cached) {
        setStage('checking_cache');
        setStatusText('Torrent is cached! Preparing instant stream...');
        setProgress(50);
        
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UX
        
        // Get stream URL directly
        await getStreamUrl();
      } else {
        // Need to add and potentially wait for download
        setStage('checking_cache');
        setStatusText('Checking if torrent is available...');
        setProgress(20);

        // Add magnet to Real-Debrid
        const magnetUrl = `magnet:?xt=urn:btih:${torrent.hash}`;
        const addResult = await realDebridService.addMagnet(magnetUrl);
        
        if (!addResult || !addResult.id) {
          setStage('error');
          setError('Failed to add torrent to Real-Debrid. The torrent may be invalid.');
          return;
        }

        // Check torrent status and wait for download if needed
        setStage('downloading');
        setStatusText('Processing torrent...');
        setProgress(30);

        // Poll for download status
        await pollDownloadStatus(addResult.id);
      }
    } catch (err: any) {
      console.error('[DebridDownload] Error:', err);
      setStage('error');
      setError(err.message || 'An unexpected error occurred');
    }
  };

  const pollDownloadStatus = async (torrentId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max

    const checkStatus = async () => {
      try {
        const info = await realDebridService.getTorrentInfo(torrentId);
        
        if (!info) {
          setStage('error');
          setError('Failed to get torrent info');
          return true; // Stop polling
        }

        const status = info.status;
        const downloadProgress = info.progress || 0;

        if (status === 'downloaded' || status === 'seeding') {
          // Download complete
          setProgress(70);
          setStatusText('Download complete!');
          
          // Select files
          setStage('selecting_file');
          setStatusText('Selecting video file...');
          setProgress(80);
          
          // Get stream URL
          await getStreamUrl();
          return true; // Stop polling
        } else if (status === 'downloading') {
          setProgress(30 + (downloadProgress * 0.4)); // 30-70%
          setStatusText(`Downloading: ${downloadProgress.toFixed(0)}%`);
          return false; // Continue polling
        } else if (status === 'waiting_files_selection') {
          // Need to select files
          await realDebridService.selectFiles(torrentId);
          return false; // Continue polling
        } else if (status === 'magnet_error' || status === 'error' || status === 'dead') {
          setStage('error');
          setError('Torrent is unavailable or dead. Please try another source.');
          return true; // Stop polling
        } else if (status === 'queued') {
          setStatusText('Queued for download...');
          return false; // Continue polling
        } else {
          setStatusText(`Status: ${status}...`);
          return false; // Continue polling
        }
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts) {
          setStage('error');
          setError('Timeout waiting for download. Please try again.');
          return true;
        }
        return false;
      }
    };

    // Initial check
    const done = await checkStatus();
    if (done) return;

    // Start polling
    pollInterval.current = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        if (pollInterval.current) clearInterval(pollInterval.current);
        setStage('error');
        setError('Timeout waiting for download');
        return;
      }
      
      const done = await checkStatus();
      if (done && pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    }, 1000);
  };

  const getStreamUrl = async () => {
    if (!torrent) return;

    try {
      setStage('getting_link');
      setStatusText('Getting streaming link...');
      setProgress(90);

      const streamUrl = await debridCacheService.getStreamUrl(torrent.hash, torrent.file_id);

      if (streamUrl) {
        setStage('ready');
        setStatusText('Ready to play!');
        setProgress(100);
        
        // Auto-play after brief delay
        setTimeout(() => {
          onStreamReady(streamUrl);
        }, 800);
      } else {
        setStage('error');
        setError('Failed to get streaming link. Please try another source.');
      }
    } catch (err: any) {
      setStage('error');
      setError(err.message || 'Failed to get streaming link');
    }
  };

  const handleRetry = () => {
    setStage('checking_auth');
    setProgress(0);
    setError(null);
    startDownloadProcess();
  };

  if (!visible) return null;

  const currentStage = stageInfo[stage];
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Real-Debrid</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={isTV ? 22 : 20} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Torrent Info */}
            <Text style={styles.torrentTitle} numberOfLines={2}>
              {torrent?.title || 'Loading...'}
            </Text>
            
            {torrent && (
              <View style={styles.torrentMeta}>
                <Text style={styles.metaText}>{torrent.quality}</Text>
                {torrent.size && <Text style={styles.metaText}>• {torrent.size}</Text>}
                <Text style={styles.metaText}>• {torrent.source}</Text>
              </View>
            )}

            {/* Stage Icon */}
            <View style={[styles.stageIcon, { backgroundColor: currentStage.color + '20' }]}>
              {stage === 'downloading' || stage === 'adding_torrent' || stage === 'checking_cache' || stage === 'getting_link' ? (
                <ActivityIndicator size={isTV ? 'large' : 'small'} color={currentStage.color} />
              ) : (
                <Ionicons name={currentStage.icon as any} size={isTV ? 48 : 40} color={currentStage.color} />
              )}
            </View>

            {/* Status Text */}
            <Text style={[styles.statusText, { color: currentStage.color }]}>
              {statusText}
            </Text>

            {/* Progress Bar */}
            {stage !== 'error' && stage !== 'ready' && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <Animated.View 
                    style={[
                      styles.progressFill, 
                      { width: progressWidth, backgroundColor: currentStage.color }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>{progress.toFixed(0)}%</Text>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable style={styles.retryButton} onPress={handleRetry}>
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              </View>
            )}

            {/* Ready State */}
            {stage === 'ready' && (
              <View style={styles.readyContainer}>
                <Ionicons name="checkmark-circle" size={isTV ? 60 : 48} color={theme.colors.success} />
                <Text style={styles.readyText}>Starting playback...</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTV ? 40 : 20,
  },
  dialog: {
    width: isTV ? Math.min(SCREEN_WIDTH * 0.5, 600) : SCREEN_WIDTH - 40,
    backgroundColor: theme.colors.card,
    borderRadius: isTV ? 16 : 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: isTV ? 20 : 16,
    paddingVertical: isTV ? 14 : 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: isTV ? 18 : 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: isTV ? 24 : 20,
    alignItems: 'center',
  },
  torrentTitle: {
    fontSize: isTV ? 16 : 14,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  torrentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: isTV ? 24 : 20,
  },
  metaText: {
    fontSize: isTV ? 13 : 12,
    color: theme.colors.textSecondary,
  },
  stageIcon: {
    width: isTV ? 100 : 80,
    height: isTV ? 100 : 80,
    borderRadius: isTV ? 50 : 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isTV ? 20 : 16,
  },
  statusText: {
    fontSize: isTV ? 16 : 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: isTV ? 20 : 16,
  },
  progressContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: isTV ? 10 : 8,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    fontSize: isTV ? 14 : 12,
    fontWeight: '600',
    color: theme.colors.text,
    minWidth: 45,
    textAlign: 'right',
  },
  errorContainer: {
    alignItems: 'center',
    marginTop: isTV ? 16 : 12,
  },
  errorText: {
    fontSize: isTV ? 14 : 13,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: isTV ? 16 : 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: isTV ? 20 : 16,
    paddingVertical: isTV ? 10 : 8,
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    fontSize: isTV ? 14 : 13,
    fontWeight: '600',
    color: '#fff',
  },
  readyContainer: {
    alignItems: 'center',
    marginTop: isTV ? 16 : 12,
  },
  readyText: {
    fontSize: isTV ? 16 : 14,
    fontWeight: '600',
    color: theme.colors.success,
    marginTop: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: isTV ? 16 : 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cancelButton: {
    paddingHorizontal: isTV ? 24 : 20,
    paddingVertical: isTV ? 10 : 8,
  },
  cancelButtonText: {
    fontSize: isTV ? 14 : 13,
    color: theme.colors.textSecondary,
  },
});

export default DebridDownloadDialog;
