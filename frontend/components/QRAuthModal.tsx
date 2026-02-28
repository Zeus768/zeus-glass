import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { realDebridService, allDebridService, premiumizeService } from '../services/debrid';
import { traktService } from '../services/trakt';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ServiceType = 'real-debrid' | 'alldebrid' | 'premiumize' | 'trakt';

interface QRAuthModalProps {
  visible: boolean;
  service: ServiceType;
  onClose: () => void;
  onSuccess: () => void;
}

export const QRAuthModal: React.FC<QRAuthModalProps> = ({
  visible,
  service,
  onClose,
  onSuccess,
}) => {
  const [deviceCode, setDeviceCode] = useState<string>('');
  const [userCode, setUserCode] = useState<string>('');
  const [verificationUrl, setVerificationUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [polling, setPolling] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');

  const serviceNames = {
    'real-debrid': 'Real-Debrid',
    'alldebrid': 'AllDebrid',
    'premiumize': 'Premiumize',
    'trakt': 'Trakt',
  };

  useEffect(() => {
    if (visible) {
      initializeAuth();
    } else {
      // Reset state when modal closes
      setDeviceCode('');
      setUserCode('');
      setVerificationUrl('');
      setLoading(true);
      setPolling(false);
      setError('');
    }
  }, [visible, service]);

  const initializeAuth = async () => {
    setLoading(true);
    setError('');
    
    try {
      let codeData;
      
      switch (service) {
        case 'real-debrid':
          codeData = await realDebridService.getDeviceCode();
          setClientId(codeData.client_id || '');
          setClientSecret(codeData.client_secret || '');
          break;
        case 'alldebrid':
          codeData = await allDebridService.getDeviceCode();
          break;
        case 'premiumize':
          codeData = await premiumizeService.getDeviceCode();
          break;
        case 'trakt':
          codeData = await traktService.getDeviceCode();
          break;
      }

      setDeviceCode(codeData.device_code);
      setUserCode(codeData.user_code);
      setVerificationUrl(codeData.verification_url);
      setLoading(false);
      
      // Start polling
      startPolling(codeData.device_code, codeData.interval || 5);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize authentication');
      setLoading(false);
    }
  };

  const startPolling = (code: string, interval: number) => {
    setPolling(true);
    
    const pollInterval = setInterval(async () => {
      try {
        let tokenData;
        
        switch (service) {
          case 'real-debrid':
            tokenData = await realDebridService.pollForToken(code, clientId, clientSecret);
            if (tokenData) {
              await realDebridService.saveToken(tokenData.access_token);
              clearInterval(pollInterval);
              setPolling(false);
              onSuccess();
              onClose();
            }
            break;
          case 'alldebrid':
            tokenData = await allDebridService.pollForToken(code);
            if (tokenData) {
              await allDebridService.saveToken(tokenData.access_token);
              clearInterval(pollInterval);
              setPolling(false);
              onSuccess();
              onClose();
            }
            break;
          case 'premiumize':
            tokenData = await premiumizeService.pollForToken(code);
            if (tokenData) {
              await premiumizeService.saveToken(tokenData.access_token);
              clearInterval(pollInterval);
              setPolling(false);
              onSuccess();
              onClose();
            }
            break;
          case 'trakt':
            tokenData = await traktService.pollForToken(code);
            if (tokenData) {
              await traktService.saveToken(tokenData);
              clearInterval(pollInterval);
              setPolling(false);
              onSuccess();
              onClose();
            }
            break;
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, interval * 1000);

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (polling) {
        setPolling(false);
        setError('Authentication timeout. Please try again.');
      }
    }, 600000);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={80} style={styles.blurContainer}>
        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Authorize {serviceNames[service]}</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Generating authorization code...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
                <Text style={styles.errorText}>{error}</Text>
                <Pressable style={styles.retryButton} onPress={initializeAuth}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.content}>
                {/* Instructions */}
                <Text style={styles.instructions}>
                  Scan the QR code with your phone or enter the code manually:
                </Text>

                {/* Side by side: QR Code and User Code */}
                <View style={styles.authContainer}>
                  {/* QR Code */}
                  <View style={styles.qrContainer}>
                    <View style={styles.qrWrapper}>
                      <QRCode
                        value={verificationUrl}
                        size={180}
                        backgroundColor="white"
                        color="black"
                      />
                    </View>
                    <Text style={styles.qrLabel}>Scan with Phone</Text>
                  </View>

                  {/* Divider */}
                  <View style={styles.divider} />

                  {/* User Code */}
                  <View style={styles.codeContainer}>
                    <Text style={styles.codeLabel}>Enter Code:</Text>
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeText}>{userCode}</Text>
                    </View>
                    <Text style={styles.urlText} numberOfLines={2}>
                      {verificationUrl}
                    </Text>
                  </View>
                </View>

                {/* Status */}
                {polling && (
                  <View style={styles.statusContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={styles.statusText}>
                      Waiting for authorization...
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 600,
  },
  modal: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.lg,
  },
  loadingContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  errorText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  instructions: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  authContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  qrContainer: {
    alignItems: 'center',
    flex: 1,
  },
  qrWrapper: {
    padding: theme.spacing.md,
    backgroundColor: 'white',
    borderRadius: theme.borderRadius.md,
  },
  qrLabel: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  divider: {
    width: 1,
    height: 200,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.lg,
  },
  codeContainer: {
    alignItems: 'center',
    flex: 1,
  },
  codeLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  codeBadge: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  codeText: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    letterSpacing: 4,
  },
  urlText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
  },
  statusText: {
    marginLeft: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
});
