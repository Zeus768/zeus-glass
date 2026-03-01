import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, Dimensions, Platform, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { realDebridService, allDebridService, premiumizeService } from '../services/debrid';
import { traktService } from '../services/trakt';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isTV = Platform.isTV || SCREEN_WIDTH > 1200;
const isSmallScreen = SCREEN_WIDTH < 400;

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
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={[styles.modalContainer, isTV && styles.modalContainerTV]}>
            <View style={[styles.modal, isTV && styles.modalTV]}>
              {/* Header */}
              <View style={[styles.header, isTV && styles.headerTV]}>
                <Text style={[styles.title, isTV && styles.titleTV]}>Authorize {serviceNames[service]}</Text>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={isTV ? 36 : 24} color={theme.colors.text} />
                </Pressable>
              </View>

              {loading ? (
                <View style={[styles.loadingContainer, isTV && styles.loadingContainerTV]}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={[styles.loadingText, isTV && styles.loadingTextTV]}>Generating authorization code...</Text>
                </View>
              ) : error ? (
                <View style={[styles.errorContainer, isTV && styles.errorContainerTV]}>
                  <Ionicons name="alert-circle" size={isTV ? 72 : 48} color={theme.colors.error} />
                  <Text style={[styles.errorText, isTV && styles.errorTextTV]}>{error}</Text>
                  <Pressable style={[styles.retryButton, isTV && styles.retryButtonTV]} onPress={initializeAuth}>
                    <Text style={[styles.retryButtonText, isTV && styles.retryButtonTextTV]}>Retry</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={[styles.content, isTV && styles.contentTV]}>
                  {/* Instructions */}
                  <Text style={[styles.instructions, isTV && styles.instructionsTV]}>
                    Scan the QR code or enter the code at the URL below:
                  </Text>

                  {/* Responsive layout: Stack on mobile, side-by-side on tablet/TV */}
                  <View style={[styles.authContainer, isSmallScreen && styles.authContainerStacked]}>
                    {/* QR Code */}
                    <View style={[styles.qrContainer, isSmallScreen && styles.qrContainerStacked]}>
                      <View style={[styles.qrWrapper, isTV && styles.qrWrapperTV]}>
                        <QRCode
                          value={verificationUrl}
                          size={isTV ? 300 : isSmallScreen ? 150 : 180}
                          backgroundColor="white"
                          color="black"
                        />
                      </View>
                      <Text style={[styles.qrLabel, isTV && styles.qrLabelTV]}>Scan with Phone</Text>
                    </View>

                    {/* Divider - horizontal on mobile, vertical on larger screens */}
                    {isSmallScreen ? (
                      <View style={styles.dividerHorizontal} />
                    ) : (
                      <View style={[styles.divider, isTV && styles.dividerTV]} />
                    )}

                    {/* User Code */}
                    <View style={[styles.codeContainer, isSmallScreen && styles.codeContainerStacked]}>
                      <Text style={[styles.codeLabel, isTV && styles.codeLabelTV]}>Enter this code:</Text>
                      <View style={[styles.codeBadge, isTV && styles.codeBadgeTV]}>
                        <Text style={[styles.codeText, isTV && styles.codeTextTV]}>{userCode}</Text>
                      </View>
                      <Text style={[styles.urlLabel, isTV && styles.urlLabelTV]}>at this URL:</Text>
                      <Text style={[styles.urlText, isTV && styles.urlTextTV]} numberOfLines={2}>
                        {verificationUrl}
                      </Text>
                    </View>
                  </View>

                  {/* Status */}
                  {polling && (
                    <View style={[styles.statusContainer, isTV && styles.statusContainerTV]}>
                      <ActivityIndicator size={isTV ? "large" : "small"} color={theme.colors.primary} />
                      <Text style={[styles.statusText, isTV && styles.statusTextTV]}>
                        Waiting for authorization...
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
  },
  modalContainerTV: {
    maxWidth: 900,
  },
  modal: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  modalTV: {
    borderRadius: 24,
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTV: {
    padding: 30,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  titleTV: {
    fontSize: 32,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.lg,
  },
  contentTV: {
    padding: 40,
  },
  loadingContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  loadingContainerTV: {
    padding: 60,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  loadingTextTV: {
    fontSize: 22,
    marginTop: 20,
  },
  errorContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  errorContainerTV: {
    padding: 60,
  },
  errorText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.error,
    textAlign: 'center',
  },
  errorTextTV: {
    fontSize: 22,
    marginTop: 20,
  },
  retryButton: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
  },
  retryButtonTV: {
    paddingHorizontal: 40,
    paddingVertical: 18,
    marginTop: 30,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  retryButtonTextTV: {
    fontSize: 20,
  },
  instructions: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  instructionsTV: {
    fontSize: 22,
    marginBottom: 30,
  },
  authContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  authContainerStacked: {
    flexDirection: 'column',
  },
  qrContainer: {
    alignItems: 'center',
    flex: 1,
  },
  qrContainerStacked: {
    marginBottom: 20,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  qrWrapperTV: {
    padding: 24,
    borderRadius: 20,
  },
  qrLabel: {
    marginTop: 12,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  qrLabelTV: {
    fontSize: 18,
    marginTop: 20,
  },
  divider: {
    width: 1,
    height: 200,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.lg,
  },
  dividerTV: {
    height: 350,
    marginHorizontal: 40,
  },
  dividerHorizontal: {
    width: '80%',
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 20,
  },
  codeContainer: {
    alignItems: 'center',
    flex: 1,
  },
  codeContainerStacked: {
    marginTop: 10,
  },
  codeLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  codeLabelTV: {
    fontSize: 22,
    marginBottom: 15,
  },
  codeBadge: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  codeBadgeTV: {
    paddingHorizontal: 40,
    paddingVertical: 20,
    marginBottom: 20,
  },
  codeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 6,
  },
  codeTextTV: {
    fontSize: 42,
    letterSpacing: 10,
  },
  urlLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  urlLabelTV: {
    fontSize: 18,
    marginBottom: 12,
  },
  urlText: {
    fontSize: 12,
    color: theme.colors.primary,
    textAlign: 'center',
    fontWeight: '500',
  },
  urlTextTV: {
    fontSize: 20,
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
  statusContainerTV: {
    marginTop: 30,
    padding: 20,
  },
  statusText: {
    marginLeft: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  statusTextTV: {
    fontSize: 22,
    marginLeft: 20,
  },
});
