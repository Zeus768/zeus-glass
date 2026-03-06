import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, Dimensions, Platform, ScrollView, Alert, TextInput } from 'react-native';
import * as Clipboard from 'expo-clipboard';
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
  const [pollStatus, setPollStatus] = useState<string>('Waiting for authorization...');
  const [pollCount, setPollCount] = useState<number>(0);
  const [pollIntervalId, setPollIntervalId] = useState<NodeJS.Timeout | null>(null);
  
  // Premiumize API key input
  const [premiumizeApiKey, setPremiumizeApiKey] = useState<string>('');
  const [verifyingApiKey, setVerifyingApiKey] = useState<boolean>(false);

  const serviceNames = {
    'real-debrid': 'Real-Debrid',
    'alldebrid': 'AllDebrid',
    'premiumize': 'Premiumize',
    'trakt': 'Trakt',
  };

  useEffect(() => {
    if (visible) {
      initializeAuth();
    }
    
    return () => {
      // Cleanup polling on unmount or close
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
      }
    };
  }, [visible, service]);

  const resetState = () => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      setPollIntervalId(null);
    }
    setDeviceCode('');
    setUserCode('');
    setVerificationUrl('');
    setLoading(true);
    setPolling(false);
    setError('');
    setPollStatus('Waiting for authorization...');
    setPollCount(0);
    setPremiumizeApiKey('');
    setVerifyingApiKey(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const initializeAuth = async () => {
    resetState();
    setLoading(true);
    setError('');
    
    try {
      let codeData;
      
      switch (service) {
        case 'real-debrid':
          codeData = await realDebridService.getDeviceCode();
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

      console.log(`[QRAuthModal] ${service} device code:`, codeData);
      
      setDeviceCode(codeData.device_code);
      setUserCode(codeData.user_code);
      setVerificationUrl(codeData.verification_url);
      setLoading(false);
      
      // Start polling (except for Premiumize which uses direct API key entry)
      if (service !== 'premiumize') {
        startPolling(codeData.device_code, codeData.interval || 5);
      }
    } catch (err: any) {
      console.error('[QRAuthModal] Auth initialization error:', err);
      setError(err.message || 'Failed to initialize authentication');
      setLoading(false);
    }
  };

  const startPolling = (code: string, interval: number) => {
    setPolling(true);
    setPollStatus('Waiting for authorization...');
    setPollCount(0);
    
    const pollInterval = setInterval(async () => {
      try {
        setPollCount(prev => prev + 1);
        let tokenData;
        
        switch (service) {
          case 'real-debrid':
            setPollStatus(`Checking authorization... (attempt ${pollCount + 1})`);
            tokenData = await realDebridService.pollForToken(code);
            if (tokenData && tokenData.access_token) {
              setPollStatus('Authorization successful! Saving...');
              console.log('[QRAuthModal] Real-Debrid auth successful!');
              await realDebridService.saveToken(tokenData.access_token);
              clearInterval(pollInterval);
              setPollIntervalId(null);
              setPolling(false);
              setPollStatus('Complete!');
              setTimeout(() => {
                onSuccess();
                handleClose();
              }, 500);
            }
            break;
            
          case 'alldebrid':
            setPollStatus(`Checking PIN... (attempt ${pollCount + 1})`);
            tokenData = await allDebridService.pollForToken(code);
            if (tokenData && tokenData.access_token) {
              setPollStatus('Authorization successful! Saving...');
              console.log('[QRAuthModal] AllDebrid auth successful!');
              await allDebridService.saveToken(tokenData.access_token);
              clearInterval(pollInterval);
              setPollIntervalId(null);
              setPolling(false);
              onSuccess();
              handleClose();
            }
            break;
            
          case 'trakt':
            setPollStatus(`Checking authorization... (attempt ${pollCount + 1})`);
            tokenData = await traktService.pollForToken(code);
            if (tokenData) {
              setPollStatus('Authorization successful! Saving...');
              console.log('[QRAuthModal] Trakt auth successful!');
              await traktService.saveToken(tokenData);
              clearInterval(pollInterval);
              setPollIntervalId(null);
              setPolling(false);
              onSuccess();
              handleClose();
            }
            break;
        }
      } catch (err: any) {
        console.error('[QRAuthModal] Polling error:', err);
        // Don't stop polling on error, just update status
        setPollStatus(`Waiting... (${err.message || 'checking'})`);
      }
    }, interval * 1000);

    setPollIntervalId(pollInterval);

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (polling) {
        setPolling(false);
        setError('Authentication timeout. Please try again.');
        setPollStatus('Timeout - please try again');
      }
    }, 600000);
  };

  // Handle Premiumize API key submission
  const handlePremiumizeApiKeySubmit = async () => {
    if (!premiumizeApiKey.trim()) {
      Alert.alert('Error', 'Please enter your API key');
      return;
    }

    setVerifyingApiKey(true);
    setPollStatus('Verifying API key...');

    try {
      const success = await premiumizeService.authenticateWithApiKey(premiumizeApiKey.trim());
      
      if (success) {
        setPollStatus('API key verified! Saving...');
        onSuccess();
        handleClose();
      } else {
        setError('Invalid API key. Please check and try again.');
        setPollStatus('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify API key');
      setPollStatus('');
    } finally {
      setVerifyingApiKey(false);
    }
  };

  // Render Premiumize-specific content (API key input)
  const renderPremiumizeContent = () => (
    <View style={[styles.content, isTV && styles.contentTV]}>
      <Text style={[styles.instructions, isTV && styles.instructionsTV]}>
        Premiumize requires your API key. Get it from your account page:
      </Text>

      {/* URL to get API key */}
      <View style={[styles.urlContainer, isTV && styles.urlContainerTV]}>
        <Text style={[styles.urlText, isTV && styles.urlTextTV]}>
          {verificationUrl}
        </Text>
        <Pressable 
          style={[styles.copyButton, isTV && styles.copyButtonTV]}
          onPress={async () => {
            await Clipboard.setStringAsync(verificationUrl);
            Alert.alert('Copied!', 'URL copied to clipboard');
          }}
        >
          <Ionicons name="link-outline" size={isTV ? 24 : 18} color={theme.colors.text} />
          <Text style={[styles.copyButtonText, isTV && styles.copyButtonTextTV]}>Open in Browser</Text>
        </Pressable>
      </View>

      {/* API Key Input */}
      <View style={styles.apiKeyInputContainer}>
        <Text style={[styles.inputLabel, isTV && styles.inputLabelTV]}>Enter your API Key:</Text>
        <TextInput
          style={[styles.apiKeyInput, isTV && styles.apiKeyInputTV]}
          placeholder="Paste your API key here"
          placeholderTextColor={theme.colors.textMuted}
          value={premiumizeApiKey}
          onChangeText={setPremiumizeApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={false}
        />
        <Pressable 
          style={[styles.submitButton, isTV && styles.submitButtonTV, verifyingApiKey && styles.submitButtonDisabled]}
          onPress={handlePremiumizeApiKeySubmit}
          disabled={verifyingApiKey}
        >
          {verifyingApiKey ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={isTV ? 24 : 20} color="#000" />
              <Text style={[styles.submitButtonText, isTV && styles.submitButtonTextTV]}>Verify & Save</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Status */}
      {pollStatus && (
        <View style={[styles.statusContainer, isTV && styles.statusContainerTV]}>
          <ActivityIndicator size={isTV ? "large" : "small"} color={theme.colors.primary} />
          <Text style={[styles.statusText, isTV && styles.statusTextTV]}>{pollStatus}</Text>
        </View>
      )}
    </View>
  );

  // Render QR code auth content (Real-Debrid, AllDebrid, Trakt)
  const renderQRContent = () => (
    <View style={[styles.content, isTV && styles.contentTV]}>
      <Text style={[styles.instructions, isTV && styles.instructionsTV]}>
        Scan the QR code or enter the code at the URL below:
      </Text>

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

        {/* Divider */}
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
          
          <Pressable 
            style={[styles.copyButton, isTV && styles.copyButtonTV]}
            onPress={async () => {
              await Clipboard.setStringAsync(userCode);
              Alert.alert('Copied!', `Code "${userCode}" copied to clipboard`);
            }}
          >
            <Ionicons name="copy-outline" size={isTV ? 24 : 18} color={theme.colors.text} />
            <Text style={[styles.copyButtonText, isTV && styles.copyButtonTextTV]}>Copy Code</Text>
          </Pressable>
          
          <Text style={[styles.urlLabel, isTV && styles.urlLabelTV]}>at this URL:</Text>
          <Text style={[styles.urlTextSmall, isTV && styles.urlTextSmallTV]} numberOfLines={2}>
            {verificationUrl}
          </Text>
          
          <Pressable 
            style={[styles.copyButton, isTV && styles.copyButtonTV]}
            onPress={async () => {
              await Clipboard.setStringAsync(verificationUrl);
              Alert.alert('Copied!', 'URL copied to clipboard');
            }}
          >
            <Ionicons name="link-outline" size={isTV ? 24 : 18} color={theme.colors.text} />
            <Text style={[styles.copyButtonText, isTV && styles.copyButtonTextTV]}>Copy URL</Text>
          </Pressable>
        </View>
      </View>

      {/* Status */}
      {polling && (
        <View style={[styles.statusContainer, isTV && styles.statusContainerTV]}>
          <ActivityIndicator size={isTV ? "large" : "small"} color={theme.colors.primary} />
          <Text style={[styles.statusText, isTV && styles.statusTextTV]}>{pollStatus}</Text>
        </View>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <BlurView intensity={80} style={styles.blurContainer}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={[styles.modalContainer, isTV && styles.modalContainerTV]}>
            <View style={[styles.modal, isTV && styles.modalTV]}>
              {/* Header */}
              <View style={[styles.header, isTV && styles.headerTV]}>
                <Text style={[styles.title, isTV && styles.titleTV]}>Authorize {serviceNames[service]}</Text>
                <Pressable onPress={handleClose} style={styles.closeButton}>
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
              ) : service === 'premiumize' ? (
                renderPremiumizeContent()
              ) : (
                renderQRContent()
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
  urlTextSmall: {
    fontSize: 12,
    color: theme.colors.primary,
    textAlign: 'center',
    fontWeight: '500',
  },
  urlTextSmallTV: {
    fontSize: 20,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  copyButtonTV: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 24,
    gap: 12,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  copyButtonTextTV: {
    fontSize: 22,
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
  // Premiumize-specific styles
  urlContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  urlContainerTV: {
    marginBottom: 30,
  },
  urlText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
  },
  urlTextTV: {
    fontSize: 24,
    marginBottom: 20,
  },
  apiKeyInputContainer: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    fontWeight: '600',
  },
  inputLabelTV: {
    fontSize: 22,
    marginBottom: 15,
  },
  apiKeyInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  apiKeyInputTV: {
    padding: 20,
    fontSize: 22,
    marginBottom: 20,
    borderRadius: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    gap: 8,
  },
  submitButtonTV: {
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    gap: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  submitButtonTextTV: {
    fontSize: 24,
  },
});
