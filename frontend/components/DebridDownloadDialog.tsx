import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import {
  realDebridService,
  allDebridService,
  torboxService,
  premiumizeService,
  debridCacheService,
} from '../services/debrid';
import { CachedTorrent } from '../types';
import axios from 'axios';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DebridType = 'torbox' | 'realdebrid' | 'alldebrid' | 'premiumize';

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
  const [activeServiceName, setActiveServiceName] = useState<string>('Debrid');
  const progressAnim = useRef(new Animated.Value(0)).current;
  const cancelledRef = useRef(false);

  const stageInfo: Record<DownloadStage, { icon: string; color: string }> = {
    checking_auth: { icon: 'key', color: theme.colors.primary },
    adding_torrent: { icon: 'magnet', color: '#8A2BE2' },
    checking_cache: { icon: 'flash', color: theme.colors.gold },
    downloading: { icon: 'cloud-download', color: theme.colors.info },
    selecting_file: { icon: 'folder-open', color: theme.colors.success },
    getting_link: { icon: 'link', color: theme.colors.primary },
    ready: { icon: 'play-circle', color: theme.colors.success },
    error: { icon: 'alert-circle', color: theme.colors.error },
  };

  useEffect(() => {
    if (visible && torrent) {
      cancelledRef.current = false;
      startDownloadProcess();
    } else {
      cancelledRef.current = true;
      setStage('checking_auth');
      setProgress(0);
      setError(null);
      setStatusText('Initializing...');
    }
    return () => {
      cancelledRef.current = true;
    };
  }, [visible, torrent]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Detect active debrid service (priority: TorBox > AllDebrid > Premiumize > Real-Debrid)
  const getActiveDebrid = async (): Promise<
    { name: string; token: string; type: DebridType } | null
  > => {
    const tb = await torboxService.getToken();
    if (tb) return { name: 'TorBox', token: tb, type: 'torbox' };

    const ad = await allDebridService.getToken();
    if (ad) return { name: 'AllDebrid', token: ad, type: 'alldebrid' };

    const pm = await premiumizeService.getToken();
    if (pm) return { name: 'Premiumize', token: pm, type: 'premiumize' };

    const rd = await realDebridService.getToken();
    if (rd) return { name: 'Real-Debrid', token: rd, type: 'realdebrid' };

    return null;
  };

  const startDownloadProcess = async () => {
    if (!torrent) return;
    try {
      setStage('checking_auth');
      setStatusText('Finding debrid service...');
      setProgress(5);

      const debrid = await getActiveDebrid();
      if (!debrid) {
        setStage('error');
        setError('No debrid service connected. Please login to TorBox, AllDebrid, Premiumize, or Real-Debrid in Settings.');
        return;
      }
      setActiveServiceName(debrid.name);
      setStatusText(`Using ${debrid.name}...`);
      setProgress(10);

      if (cancelledRef.current) return;

      let streamUrl: string | null = null;
      if (debrid.type === 'torbox') {
        streamUrl = await resolveTorbox(debrid.token);
      } else if (debrid.type === 'realdebrid') {
        streamUrl = await resolveRealDebrid(debrid.token);
      } else if (debrid.type === 'alldebrid') {
        streamUrl = await resolveAllDebrid(debrid.token);
      } else if (debrid.type === 'premiumize') {
        streamUrl = await resolvePremiumize(debrid.token);
      }

      if (cancelledRef.current) return;
      if (streamUrl) {
        setStage('ready');
        setStatusText('Ready to play!');
        setProgress(100);
        setTimeout(() => {
          if (!cancelledRef.current) onStreamReady(streamUrl!);
        }, 600);
      } else if (stage !== 'error') {
        setStage('error');
        setError(`${debrid.name} could not resolve this torrent. Try another source.`);
      }
    } catch (err: any) {
      console.error('[DebridDownload] Error:', err);
      if (!cancelledRef.current) {
        setStage('error');
        setError(err.message || 'An unexpected error occurred');
      }
    }
  };

  // ---------------- TORBOX ----------------
  const resolveTorbox = async (token: string): Promise<string | null> => {
    if (!torrent) return null;
    const headers = { Authorization: `Bearer ${token}` };
    const magnetUrl = `magnet:?xt=urn:btih:${torrent.hash}`;

    setStage('checking_cache');
    setStatusText('Checking TorBox cache...');
    setProgress(20);

    let isCached = false;
    try {
      const cachedResp = await axios.get(
        `https://api.torbox.app/v1/api/torrents/checkcached?hash=${torrent.hash}&format=object`,
        { headers, timeout: 12000 }
      );
      const cd = cachedResp.data?.data;
      isCached = !!(cd && (cd[torrent.hash] || cd[torrent.hash.toLowerCase()] || cd[torrent.hash.toUpperCase()]));
    } catch (e) {
      // ignore - we'll still try adding
    }

    setStage('adding_torrent');
    setStatusText(isCached ? 'Adding cached torrent...' : 'Adding torrent to TorBox...');
    setProgress(30);

    // Add (create) torrent - returns existing id if already added
    const formData = new FormData();
    formData.append('magnet', magnetUrl);

    let torrentId: number | string | null = null;
    try {
      const addResp = await axios.post(
        'https://api.torbox.app/v1/api/torrents/createtorrent',
        formData,
        { headers, timeout: 20000 }
      );
      torrentId = addResp.data?.data?.torrent_id ?? addResp.data?.data?.id ?? null;
    } catch (e: any) {
      // If already exists, the API responds with the existing id in error payload
      torrentId = e?.response?.data?.data?.torrent_id ?? null;
    }

    if (!torrentId) {
      setStage('error');
      setError('TorBox could not add this torrent.');
      return null;
    }

    if (!isCached) {
      // Poll for download completion
      setStage('downloading');
      setStatusText('Downloading on TorBox...');
      let attempts = 0;
      const maxAttempts = 60; // ~120s
      while (attempts < maxAttempts) {
        if (cancelledRef.current) return null;
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
        try {
          const infoResp = await axios.get(
            `https://api.torbox.app/v1/api/torrents/mylist?id=${torrentId}`,
            { headers, timeout: 10000 }
          );
          const info = infoResp.data?.data;
          if (info?.download_finished || info?.cached || info?.download_state === 'completed') {
            break;
          }
          const p = typeof info?.progress === 'number' ? info.progress : 0;
          setProgress(30 + Math.min(50, p * 50));
          setStatusText(`Downloading: ${(p * 100).toFixed(0)}%`);
        } catch {
          // ignore single-poll errors
        }
      }
      if (attempts >= maxAttempts) {
        setStage('error');
        setError('TorBox is still downloading. Try again shortly or pick another source.');
        return null;
      }
    }

    // Request download link
    setStage('getting_link');
    setStatusText('Getting streaming link...');
    setProgress(90);

    try {
      const linkResp = await axios.get(
        `https://api.torbox.app/v1/api/torrents/requestdl?token=${encodeURIComponent(token)}&torrent_id=${torrentId}&zip_link=false`,
        { headers, timeout: 15000 }
      );
      const link = linkResp.data?.data;
      if (typeof link === 'string' && link.startsWith('http')) {
        return link;
      }
    } catch (e: any) {
      console.error('[TorBox] requestdl failed', e?.response?.data || e?.message);
    }
    return null;
  };

  // ---------------- REAL-DEBRID ----------------
  const resolveRealDebrid = async (_token: string): Promise<string | null> => {
    if (!torrent) return null;
    setStage('checking_cache');
    setStatusText(torrent.cached ? 'Cached! Preparing instant stream...' : 'Adding torrent...');
    setProgress(torrent.cached ? 50 : 25);

    if (!torrent.cached) {
      setStage('downloading');
      setStatusText('Processing torrent...');
      setProgress(40);
    }

    setStage('getting_link');
    setStatusText('Getting streaming link...');
    setProgress(85);

    const url = await debridCacheService.getStreamUrl(torrent.hash, torrent.file_id, 'realdebrid');
    return url;
  };

  // ---------------- ALLDEBRID ----------------
  const resolveAllDebrid = async (token: string): Promise<string | null> => {
    if (!torrent) return null;
    const magnetUrl = `magnet:?xt=urn:btih:${torrent.hash}`;

    setStage('adding_torrent');
    setStatusText('Adding to AllDebrid...');
    setProgress(25);

    try {
      const addResp = await axios.get(
        `https://api.alldebrid.com/v4/magnet/upload?agent=zeus-glass&apikey=${encodeURIComponent(token)}&magnets[]=${encodeURIComponent(magnetUrl)}`,
        { timeout: 20000 }
      );
      const magnet = addResp.data?.data?.magnets?.[0];
      const magnetId = magnet?.id;
      if (!magnetId) {
        setStage('error');
        setError('AllDebrid could not add this magnet.');
        return null;
      }

      // Poll status
      setStage('downloading');
      setStatusText('AllDebrid is processing...');
      let attempts = 0;
      const maxAttempts = 60;
      let links: any[] = [];
      while (attempts < maxAttempts) {
        if (cancelledRef.current) return null;
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
        try {
          const statusResp = await axios.get(
            `https://api.alldebrid.com/v4/magnet/status?agent=zeus-glass&apikey=${encodeURIComponent(token)}&id=${magnetId}`,
            { timeout: 10000 }
          );
          const m = statusResp.data?.data?.magnets;
          if (m?.status === 'Ready' || m?.statusCode === 4) {
            links = m.links || [];
            break;
          }
          const dl = m?.downloaded ?? 0;
          const sz = m?.size ?? 0;
          const pct = sz > 0 ? dl / sz : 0;
          setProgress(30 + Math.min(50, pct * 50));
          setStatusText(`Processing: ${(pct * 100).toFixed(0)}%`);
        } catch {
          // ignore
        }
      }
      if (!links.length) {
        setStage('error');
        setError('AllDebrid still processing. Try again shortly.');
        return null;
      }

      // Pick largest video link
      const sorted = [...links].sort((a, b) => (b?.size || 0) - (a?.size || 0));
      const targetLink = sorted[0]?.link;
      if (!targetLink) return null;

      setStage('getting_link');
      setStatusText('Unlocking link...');
      setProgress(90);

      const unlockResp = await axios.get(
        `https://api.alldebrid.com/v4/link/unlock?agent=zeus-glass&apikey=${encodeURIComponent(token)}&link=${encodeURIComponent(targetLink)}`,
        { timeout: 15000 }
      );
      return unlockResp.data?.data?.link || null;
    } catch (e: any) {
      console.error('[AllDebrid] resolve failed', e?.response?.data || e?.message);
      return null;
    }
  };

  // ---------------- PREMIUMIZE ----------------
  const resolvePremiumize = async (token: string): Promise<string | null> => {
    if (!torrent) return null;
    setStage('adding_torrent');
    setStatusText('Resolving via Premiumize...');
    setProgress(40);
    try {
      const magnetUrl = `magnet:?xt=urn:btih:${torrent.hash}`;
      const form = new URLSearchParams();
      form.append('apikey', token);
      form.append('src', magnetUrl);
      const resp = await axios.post(
        'https://www.premiumize.me/api/transfer/directdl',
        form.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 20000,
        }
      );
      if (resp.data?.status === 'success' && Array.isArray(resp.data?.content)) {
        // Pick largest file
        const files = [...resp.data.content].sort((a, b) => (b?.size || 0) - (a?.size || 0));
        return files[0]?.stream_link || files[0]?.link || null;
      }
    } catch (e: any) {
      console.error('[Premiumize] resolve failed', e?.response?.data || e?.message);
    }
    return null;
  };

  const handleRetry = () => {
    setStage('checking_auth');
    setProgress(0);
    setError(null);
    cancelledRef.current = false;
    startDownloadProcess();
  };

  if (!visible) return null;

  const currentStage = stageInfo[stage];
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const showSpinner =
    stage === 'downloading' ||
    stage === 'adding_torrent' ||
    stage === 'checking_cache' ||
    stage === 'getting_link';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} testID="debrid-dialog-service-name">
              {activeServiceName}
            </Text>
            <TouchableOpacity
              focusable
              hasTVPreferredFocus={false}
              style={styles.closeButton}
              onPress={onClose}
              testID="debrid-dialog-close-button"
            >
              <Ionicons name="close" size={isTV ? 22 : 20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.torrentTitle} numberOfLines={2}>
              {torrent?.title || 'Loading...'}
            </Text>

            {torrent && (
              <View style={styles.torrentMeta}>
                <Text style={styles.metaText}>{torrent.quality}</Text>
                {torrent.size ? <Text style={styles.metaText}>• {torrent.size}</Text> : null}
                <Text style={styles.metaText}>• {torrent.source}</Text>
              </View>
            )}

            <View style={[styles.stageIcon, { backgroundColor: currentStage.color + '20' }]}>
              {showSpinner ? (
                <ActivityIndicator size={isTV ? 'large' : 'small'} color={currentStage.color} />
              ) : (
                <Ionicons name={currentStage.icon as any} size={isTV ? 48 : 40} color={currentStage.color} />
              )}
            </View>

            <Text style={[styles.statusText, { color: currentStage.color }]} testID="debrid-dialog-status-text">
              {statusText}
            </Text>

            {stage !== 'error' && stage !== 'ready' && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      { width: progressWidth, backgroundColor: currentStage.color },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>{progress.toFixed(0)}%</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText} testID="debrid-dialog-error-text">{error}</Text>
                <TouchableOpacity
                  focusable
                  style={styles.retryButton}
                  onPress={handleRetry}
                  testID="debrid-dialog-retry-button"
                >
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {stage === 'ready' && (
              <View style={styles.readyContainer}>
                <Ionicons name="checkmark-circle" size={isTV ? 60 : 48} color={theme.colors.success} />
                <Text style={styles.readyText}>Starting playback...</Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              focusable
              style={styles.cancelButton}
              onPress={onClose}
              testID="debrid-dialog-cancel-button"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
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
