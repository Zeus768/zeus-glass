import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import { castService, CastDevice } from '../services/castService';

interface CastDialogProps {
  visible: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
}

export const CastDialog: React.FC<CastDialogProps> = ({ visible, onClose, videoUrl, title }) => {
  const [savedDevices, setSavedDevices] = useState<CastDevice[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<CastDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ scanned: 0, total: 254 });
  const [casting, setCasting] = useState<string | null>(null);
  const [manualIp, setManualIp] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);

  useEffect(() => {
    if (visible) {
      castService.getSavedDevices().then(setSavedDevices);
    }
  }, [visible]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setDiscoveredDevices([]);
    setScanProgress({ scanned: 0, total: 254 });

    try {
      await castService.scanForDevices(
        (device) => {
          setDiscoveredDevices(prev => {
            if (prev.find(d => d.id === device.id)) return prev;
            return [...prev, device];
          });
        },
        (scanned, total) => {
          setScanProgress({ scanned, total });
        }
      );
    } catch (error) {
      console.warn('Scan error:', error);
    }

    setScanning(false);
  }, []);

  const handleCastDLNA = useCallback(async (device: CastDevice) => {
    setCasting(device.id);
    try {
      const success = await castService.castToDLNA(device, videoUrl, title);
      if (success) {
        Alert.alert('Casting', `Now casting "${title}" to ${device.name}`);
        onClose();
      } else {
        Alert.alert('Cast Failed', `Could not connect to ${device.name}. The device may not support DLNA playback.`);
      }
    } catch (error: any) {
      Alert.alert('Cast Error', error.message || 'Failed to cast');
    }
    setCasting(null);
  }, [videoUrl, title, onClose]);

  const handleManualAdd = useCallback(async () => {
    if (!manualIp.trim()) return;
    
    const device: CastDevice = {
      id: `manual-${manualIp.trim()}`,
      name: `TV at ${manualIp.trim()}`,
      type: 'manual',
      ip: manualIp.trim(),
      port: 8008,
    };

    setCasting(device.id);
    const success = await castService.castToDLNA(device, videoUrl, title);
    
    if (success) {
      await castService.saveDevice(device);
      setSavedDevices(await castService.getSavedDevices());
      Alert.alert('Casting', `Now casting to ${device.name}`);
      setManualIp('');
      setShowManualEntry(false);
      onClose();
    } else {
      // Try alternate ports
      for (const port of [1400, 49152, 8060, 7000]) {
        device.port = port;
        const altSuccess = await castService.castToDLNA(device, videoUrl, title);
        if (altSuccess) {
          await castService.saveDevice(device);
          setSavedDevices(await castService.getSavedDevices());
          Alert.alert('Casting', `Now casting to ${device.name} (port ${port})`);
          setManualIp('');
          setShowManualEntry(false);
          onClose();
          setCasting(null);
          return;
        }
      }
      Alert.alert('Cast Failed', 'Could not connect. Make sure the TV IP is correct and DLNA is enabled.');
    }
    setCasting(null);
  }, [manualIp, videoUrl, title, onClose]);

  const handleChromecast = useCallback(async () => {
    await castService.castToChromecast(videoUrl);
  }, [videoUrl]);

  const handleShare = useCallback(async () => {
    await castService.shareToApp(videoUrl, title);
  }, [videoUrl, title]);

  const handleRemoveDevice = useCallback(async (deviceId: string) => {
    await castService.removeDevice(deviceId);
    setSavedDevices(await castService.getSavedDevices());
  }, []);

  const allDevices = [
    ...savedDevices,
    ...discoveredDevices.filter(d => !savedDevices.find(s => s.ip === d.ip)),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="tv" size={isTV ? 28 : 24} color={theme.colors.primary} />
              <Text style={styles.headerTitle}>Cast to Device</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} data-testid="cast-dialog-close">
              <Ionicons name="close" size={isTV ? 24 : 20} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Cast</Text>
            <View style={styles.quickActions}>
              {Platform.OS === 'android' && (
                <Pressable style={styles.quickAction} onPress={handleChromecast} data-testid="cast-chromecast-btn">
                  <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(66, 133, 244, 0.15)' }]}>
                    <Ionicons name="logo-google" size={isTV ? 28 : 22} color="#4285F4" />
                  </View>
                  <Text style={styles.quickActionText}>Chromecast</Text>
                </Pressable>
              )}
              
              <Pressable style={styles.quickAction} onPress={handleShare} data-testid="cast-share-btn">
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(0, 217, 255, 0.15)' }]}>
                  <Ionicons name="share" size={isTV ? 28 : 22} color={theme.colors.primary} />
                </View>
                <Text style={styles.quickActionText}>Share to App</Text>
              </Pressable>

              <Pressable 
                style={styles.quickAction} 
                onPress={() => setShowManualEntry(!showManualEntry)}
                data-testid="cast-manual-btn"
              >
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(255, 149, 0, 0.15)' }]}>
                  <Ionicons name="create" size={isTV ? 28 : 22} color="#FF9500" />
                </View>
                <Text style={styles.quickActionText}>Enter IP</Text>
              </Pressable>
            </View>

            {/* Manual IP Entry */}
            {showManualEntry && (
              <View style={styles.manualEntry}>
                <TextInput
                  style={styles.manualInput}
                  placeholder="TV IP Address (e.g. 192.168.1.100)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={manualIp}
                  onChangeText={setManualIp}
                  keyboardType="numeric"
                  data-testid="cast-manual-ip-input"
                />
                <Pressable 
                  style={styles.manualCastBtn} 
                  onPress={handleManualAdd}
                  data-testid="cast-manual-connect-btn"
                >
                  {casting?.startsWith('manual-') ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.manualCastBtnText}>Connect</Text>
                  )}
                </Pressable>
              </View>
            )}

            {/* DLNA Devices */}
            <View style={styles.dlnaSection}>
              <View style={styles.dlnaHeader}>
                <Text style={styles.sectionTitle}>Smart TV / DLNA</Text>
                <Pressable 
                  style={styles.scanBtn} 
                  onPress={handleScan}
                  disabled={scanning}
                  data-testid="cast-scan-btn"
                >
                  {scanning ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Ionicons name="search" size={isTV ? 20 : 16} color={theme.colors.primary} />
                  )}
                  <Text style={styles.scanBtnText}>
                    {scanning ? `Scanning... ${Math.round((scanProgress.scanned / scanProgress.total) * 100)}%` : 'Scan Network'}
                  </Text>
                </Pressable>
              </View>

              {allDevices.length > 0 ? (
                allDevices.map(device => (
                  <Pressable
                    key={device.id}
                    style={styles.deviceItem}
                    onPress={() => handleCastDLNA(device)}
                    data-testid={`cast-device-${device.ip}`}
                  >
                    <View style={styles.deviceInfo}>
                      <Ionicons 
                        name={device.type === 'dlna' ? 'tv' : 'desktop'} 
                        size={isTV ? 24 : 20} 
                        color={theme.colors.primary} 
                      />
                      <View style={styles.deviceText}>
                        <Text style={styles.deviceName}>{device.name}</Text>
                        <Text style={styles.deviceIp}>{device.ip}:{device.port}</Text>
                      </View>
                    </View>
                    <View style={styles.deviceActions}>
                      {casting === device.id ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="play-circle" size={isTV ? 28 : 24} color="#22C55E" />
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleRemoveDevice(device.id);
                            }}
                            style={styles.removeBtn}
                          >
                            <Ionicons name="trash-outline" size={isTV ? 18 : 14} color="#FF4444" />
                          </Pressable>
                        </>
                      )}
                    </View>
                  </Pressable>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="tv-outline" size={isTV ? 40 : 32} color={theme.colors.textSecondary} />
                  <Text style={styles.emptyText}>
                    {scanning ? 'Looking for devices on your network...' : 'No devices found. Tap "Scan Network" or enter your TV\'s IP address manually.'}
                  </Text>
                </View>
              )}
            </View>

            {/* Info */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={isTV ? 18 : 16} color={theme.colors.textSecondary} />
              <Text style={styles.infoText}>
                DLNA: Your phone and TV must be on the same WiFi network. Chromecast: Opens Google Home app for casting. Share: Send the video URL to any casting app like VLC or BubbleUPnP.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTV ? 40 : 20,
  },
  dialog: {
    backgroundColor: theme.colors.surface,
    borderRadius: isTV ? 16 : 12,
    width: isTV ? 600 : '100%',
    maxHeight: isTV ? 500 : '80%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isTV ? 20 : 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 12 : 10,
  },
  headerTitle: {
    fontSize: isTV ? 20 : 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 8,
  },
  content: {
    padding: isTV ? 20 : 16,
  },
  sectionTitle: {
    fontSize: isTV ? 16 : 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: isTV ? 12 : 10,
  },
  quickActions: {
    flexDirection: 'row',
    gap: isTV ? 16 : 12,
    marginBottom: isTV ? 24 : 20,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: isTV ? 8 : 6,
  },
  quickActionIcon: {
    width: isTV ? 64 : 52,
    height: isTV ? 64 : 52,
    borderRadius: isTV ? 16 : 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: isTV ? 13 : 11,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  manualEntry: {
    flexDirection: 'row',
    gap: isTV ? 10 : 8,
    marginBottom: isTV ? 20 : 16,
  },
  manualInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: isTV ? 10 : 8,
    padding: isTV ? 14 : 12,
    fontSize: isTV ? 16 : 14,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  manualCastBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: isTV ? 10 : 8,
    paddingHorizontal: isTV ? 20 : 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualCastBtnText: {
    fontSize: isTV ? 15 : 13,
    fontWeight: '700',
    color: '#000',
  },
  dlnaSection: {
    marginBottom: isTV ? 20 : 16,
  },
  dlnaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isTV ? 12 : 10,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 6 : 4,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    paddingHorizontal: isTV ? 14 : 10,
    paddingVertical: isTV ? 8 : 6,
    borderRadius: isTV ? 8 : 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.3)',
  },
  scanBtnText: {
    fontSize: isTV ? 13 : 11,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: isTV ? 10 : 8,
    padding: isTV ? 14 : 12,
    marginBottom: isTV ? 8 : 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 12 : 10,
    flex: 1,
  },
  deviceText: {
    flex: 1,
  },
  deviceName: {
    fontSize: isTV ? 15 : 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  deviceIp: {
    fontSize: isTV ? 12 : 10,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  deviceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 12 : 8,
  },
  removeBtn: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: isTV ? 30 : 24,
    gap: isTV ? 12 : 10,
  },
  emptyText: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: isTV ? 20 : 18,
  },
  infoBox: {
    flexDirection: 'row',
    gap: isTV ? 10 : 8,
    padding: isTV ? 14 : 12,
    backgroundColor: 'rgba(0, 217, 255, 0.05)',
    borderRadius: isTV ? 10 : 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.15)',
    marginBottom: isTV ? 10 : 8,
  },
  infoText: {
    flex: 1,
    fontSize: isTV ? 12 : 10,
    color: theme.colors.textSecondary,
    lineHeight: isTV ? 18 : 15,
  },
});
