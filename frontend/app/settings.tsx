import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Switch,
  Alert,
  Clipboard,
  Linking,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { BlurView } from 'expo-blur';
import { theme, isTV } from '../constants/theme';
import { QRAuthModal } from '../components/QRAuthModal';
import { useAuthStore } from '../store/authStore';
import { iptvService } from '../services/iptv';
import { errorLogService, LogEntry } from '../services/errorLogService';
import { parentalControlService, ParentalControlSettings } from '../services/parentalControlService';
import { subtitleService, SubtitleSettings } from '../services/subtitleService';
import { streamFilterService, OneClickPlaySettings } from '../services/streamFilterService';
import { zeusVaultService, VaultData } from '../services/zeusVaultService';
import { proxyService, ProxySettings, getAvailableCountries } from '../services/proxyService';
import { scraperStatusService, ScraperStatus } from '../services/scraperStatusService';
import { contentFilterService, ContentFilterSettings } from '../services/contentFilterService';
import { formatDistanceToNow, format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ServiceType = 'real-debrid' | 'alldebrid' | 'premiumize' | 'trakt';

export default function SettingsScreen() {
  const {
    traktUser,
    realDebridAccount,
    allDebridAccount,
    premiumizeAccount,
    iptvAccount,
    iptvConfig,
    loadTraktAccount,
    loadRealDebridAccount,
    loadAllDebridAccount,
    loadPremiumizeAccount,
    loadIPTVAccount,
    logoutTrakt,
    logoutRealDebrid,
    logoutAllDebrid,
    logoutPremiumize,
    logoutIPTV,
  } = useAuthStore();

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceType>('real-debrid');
  const [iptvModalVisible, setIptvModalVisible] = useState(false);
  const [iptvDomain, setIptvDomain] = useState('');
  const [iptvUsername, setIptvUsername] = useState('');
  const [iptvPassword, setIptvPassword] = useState('');
  const [iptvLoading, setIptvLoading] = useState(false);

  // Error log state
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showErrorsOnly, setShowErrorsOnly] = useState(true);

  // Parental control state
  const [parentalModalVisible, setParentalModalVisible] = useState(false);
  const [parentalSettings, setParentalSettings] = useState<ParentalControlSettings | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinMode, setPinMode] = useState<'setup' | 'verify' | 'change'>('setup');

  // Subtitle settings state
  const [subtitleModalVisible, setSubtitleModalVisible] = useState(false);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings | null>(null);
  const [openSubtitlesApiKey, setOpenSubtitlesApiKey] = useState('');
  const [openSubtitlesUsername, setOpenSubtitlesUsername] = useState('');
  const [openSubtitlesPassword, setOpenSubtitlesPassword] = useState('');

  // One-click play settings
  const [oneClickModalVisible, setOneClickModalVisible] = useState(false);
  const [oneClickSettings, setOneClickSettings] = useState<OneClickPlaySettings | null>(null);

  // Focus state for TV navigation
  const [focusedElement, setFocusedElement] = useState<string | null>(null);

  // Zeus Vault state
  const [vaultModalVisible, setVaultModalVisible] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<{
    exists: boolean;
    lastSaved: string | null;
    lastRestored: string | null;
    accountCount: number;
  } | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultImportText, setVaultImportText] = useState('');

  // Torrentio configuration state
  const [torrentioModalVisible, setTorrentioModalVisible] = useState(false);
  const [torrentioConfig, setTorrentioConfig] = useState<string | null>(null);
  const [torrentioApiKey, setTorrentioApiKey] = useState('');
  const [torrentioProvider, setTorrentioProvider] = useState<'realdebrid' | 'alldebrid' | 'premiumize'>('realdebrid');

  // Torrentio configuration URL
  const TORRENTIO_CONFIGURE_URL = 'https://torrentio.strem.fun/configure';

  // VPN/Proxy state
  const [proxySettings, setProxySettings] = useState<ProxySettings | null>(null);
  const [proxyCountries, setProxyCountries] = useState<{ code: string; name: string; flag: string }[]>([]);

  // Scraper status state
  const [scraperStatuses, setScraperStatuses] = useState<ScraperStatus[]>([]);
  const [checkingScrapers, setCheckingScrapers] = useState(false);
  const [scraperCheckProgress, setScraperCheckProgress] = useState({ completed: 0, total: 0 });

  // Content filter state
  const [contentFilterSettings, setContentFilterSettings] = useState<ContentFilterSettings>({
    enabled: true,
    blockAdultStreams: true,
    blockAdultCategories: true,
    customBlockedKeywords: [],
  });

  useEffect(() => {
    // Initialize services
    errorLogService.init();
    parentalControlService.init().then(() => {
      setParentalSettings(parentalControlService.getSettings());
    });
    subtitleService.init().then(() => {
      setSubtitleSettings(subtitleService.getSettings());
    });
    streamFilterService.init().then(() => {
      setOneClickSettings(streamFilterService.getOneClickSettings());
    });
    
    // Initialize Zeus Vault
    zeusVaultService.init().then(async () => {
      const status = await zeusVaultService.getVaultStatus();
      setVaultStatus(status);
      
      // Auto-restore on first launch
      const result = await zeusVaultService.autoRestore();
      if (result.restored && result.accountsRestored.length > 0) {
        Alert.alert(
          'Zeus Vault',
          `Restored ${result.accountsRestored.length} account(s): ${result.accountsRestored.join(', ')}`,
          [{ text: 'OK' }]
        );
      }
    });
    
    // Load Torrentio config
    loadTorrentioConfig();
    
    // Load VPN/Proxy settings
    proxyService.getSettings().then(settings => {
      setProxySettings(settings);
    });
    setProxyCountries(getAvailableCountries());

    // Load content filter settings
    contentFilterService.init().then(() => {
      setContentFilterSettings(contentFilterService.getSettings());
    });
  }, []);

  // Zeus Vault functions
  const handleSaveVault = async () => {
    setVaultLoading(true);
    try {
      // First, save to internal storage (always works)
      const internalSuccess = await zeusVaultService.saveVault();
      
      if (internalSuccess) {
        // Update status
        const status = await zeusVaultService.getVaultStatus();
        setVaultStatus(status);
        
        // Now try file export (may fail on TV devices)
        try {
          await zeusVaultService.exportToFile();
        } catch (fileError) {
          // File export failed, but internal save worked
          console.log('[ZeusVault] File export not available, using internal storage');
        }
        
        Alert.alert('Zeus Vault', `Backup saved successfully! ${status.accountCount} account(s) backed up.`);
      } else {
        Alert.alert('Error', 'Failed to save vault');
      }
    } catch (error) {
      console.error('[ZeusVault] Save error:', error);
      Alert.alert('Error', 'Failed to export vault');
    } finally {
      setVaultLoading(false);
    }
  };

  const handleRestoreVault = async () => {
    setVaultLoading(true);
    try {
      // First try file import (for mobile devices)
      let success = false;
      
      try {
        success = await zeusVaultService.importFromFile();
      } catch (fileError) {
        console.log('[ZeusVault] File import not available, trying internal restore');
      }
      
      // If file import didn't work, try internal restore
      if (!success) {
        const vault = await zeusVaultService.restoreVault();
        if (vault) {
          await zeusVaultService.applyVaultData(vault);
          success = true;
        }
      }
      
      if (success) {
        const status = await zeusVaultService.getVaultStatus();
        setVaultStatus(status);
        Alert.alert('Zeus Vault', 'Vault restored successfully! Please restart the app to see your accounts.');
      } else {
        Alert.alert('Zeus Vault', 'No backup found. Please create a backup first.');
      }
    } catch (error) {
      console.error('[ZeusVault] Restore error:', error);
      Alert.alert('Error', 'Failed to import vault');
    } finally {
      setVaultLoading(false);
    }
  };

  const handleExportVault = async () => {
    setVaultLoading(true);
    try {
      const vaultJson = await zeusVaultService.exportVault();
      if (vaultJson) {
        try {
          await Share.share({
            message: vaultJson,
            title: 'Zeus Vault Backup',
          });
        } catch (shareError) {
          // Share not available (e.g., on TV), copy to clipboard instead
          Clipboard.setString(vaultJson);
          Alert.alert('Zeus Vault', 'Backup data copied to clipboard. You can paste it to restore on another device.');
        }
      } else {
        Alert.alert('Zeus Vault', 'No data to export. Please add some accounts first.');
      }
    } catch (error) {
      console.error('[ZeusVault] Export error:', error);
      Alert.alert('Error', 'Failed to export vault');
    } finally {
      setVaultLoading(false);
    }
  };

  const handleImportVault = async () => {
    if (!vaultImportText.trim()) {
      Alert.alert('Error', 'Please paste vault data first');
      return;
    }
    
    setVaultLoading(true);
    try {
      const success = await zeusVaultService.importVault(vaultImportText);
      if (success) {
        const status = await zeusVaultService.getVaultStatus();
        setVaultStatus(status);
        setVaultImportText('');
        Alert.alert('Zeus Vault', 'Vault imported successfully! Please restart the app.');
      } else {
        Alert.alert('Error', 'Invalid vault data');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to import vault');
    } finally {
      setVaultLoading(false);
    }
  };

  // Check all scrapers status
  const handleCheckScrapers = async () => {
    setCheckingScrapers(true);
    setScraperStatuses([]);
    
    const list = scraperStatusService.getList();
    setScraperCheckProgress({ completed: 0, total: list.length });
    
    try {
      const results = await scraperStatusService.checkAll((completed, total, result) => {
        setScraperCheckProgress({ completed, total });
        setScraperStatuses(prev => [...prev, result]);
      });
      
      // Sort by status (online first) then by name
      const sorted = results.sort((a, b) => {
        if (a.status === b.status) return a.name.localeCompare(b.name);
        return a.status === 'online' ? -1 : 1;
      });
      setScraperStatuses(sorted);
    } catch (error) {
      console.error('[Settings] Error checking scrapers:', error);
      Alert.alert('Error', 'Failed to check scraper status');
    } finally {
      setCheckingScrapers(false);
    }
  };

  const loadTorrentioConfig = async () => {
    try {
      const config = await AsyncStorage.getItem('torrentio_config');
      if (config) {
        setTorrentioConfig(config);
      }
    } catch (e) {
      console.log('Error loading Torrentio config:', e);
    }
  };

  const saveTorrentioConfig = async () => {
    if (!torrentioApiKey.trim()) {
      Alert.alert('Error', 'Please enter your Debrid API key');
      return;
    }

    const configUrl = `${torrentioProvider}=${torrentioApiKey.trim()}`;
    try {
      await AsyncStorage.setItem('torrentio_config', configUrl);
      setTorrentioConfig(configUrl);
      setTorrentioModalVisible(false);
      Alert.alert('Success', 'Torrentio configuration saved!');
    } catch (e) {
      Alert.alert('Error', 'Failed to save configuration');
    }
  };

  const clearTorrentioConfig = async () => {
    try {
      await AsyncStorage.removeItem('torrentio_config');
      setTorrentioConfig(null);
      setTorrentioApiKey('');
    } catch (e) {
      console.log('Error clearing Torrentio config:', e);
    }
  };

  const handleQRAuth = (service: ServiceType) => {
    setSelectedService(service);
    setQrModalVisible(true);
  };

  const handleQRSuccess = () => {
    switch (selectedService) {
      case 'trakt':
        loadTraktAccount();
        break;
      case 'real-debrid':
        loadRealDebridAccount();
        break;
      case 'alldebrid':
        loadAllDebridAccount();
        break;
      case 'premiumize':
        loadPremiumizeAccount();
        break;
    }
  };

  const handleIPTVLogin = async () => {
    if (!iptvDomain || !iptvUsername || !iptvPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIptvLoading(true);
    try {
      const success = await iptvService.authenticate(iptvDomain, iptvUsername, iptvPassword);
      if (success) {
        await iptvService.saveConfig({
          domain: iptvDomain,
          username: iptvUsername,
          password: iptvPassword,
          enabled: true,
        });
        await loadIPTVAccount();
        setIptvModalVisible(false);
        setIptvDomain('');
        setIptvUsername('');
        setIptvPassword('');
        errorLogService.info('IPTV login successful', 'Settings');
      } else {
        errorLogService.error('IPTV authentication failed', 'Settings');
        Alert.alert('Error', 'Authentication failed. Please check your credentials.');
      }
    } catch (error: any) {
      errorLogService.error(error.message, 'Settings', error);
      Alert.alert('Error', 'Failed to authenticate. Please check your credentials.');
    } finally {
      setIptvLoading(false);
    }
  };

  // Error log handlers
  const handleOpenLogs = () => {
    setLogs(showErrorsOnly ? errorLogService.getErrors() : errorLogService.getLogs());
    setLogModalVisible(true);
  };

  const handleSendLogsEmail = async () => {
    const success = await errorLogService.sendLogsViaEmail(showErrorsOnly);
    if (success) {
      Alert.alert('Success', 'Email app opened with logs');
    }
  };

  const handleSendLogsTelegram = async () => {
    await errorLogService.sendLogsViaTelegram(showErrorsOnly);
  };

  const handleCopyLogs = () => {
    const logsText = errorLogService.getLogsAsText(showErrorsOnly);
    Clipboard.setString(logsText);
    Alert.alert('Success', 'Logs copied to clipboard');
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await errorLogService.clearLogs();
            setLogs([]);
          },
        },
      ]
    );
  };

  // Parental control handlers
  const handleParentalSetup = async () => {
    if (newPinInput.length < 4) {
      Alert.alert('Error', 'PIN must be at least 4 digits');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }

    const success = await parentalControlService.enable(newPinInput);
    if (success) {
      setParentalSettings(parentalControlService.getSettings());
      setParentalModalVisible(false);
      setNewPinInput('');
      setConfirmPinInput('');
      Alert.alert('Success', 'Parental controls enabled');
    }
  };

  const handleParentalVerify = async () => {
    const success = await parentalControlService.unlock(pinInput);
    if (success) {
      setParentalSettings(parentalControlService.getSettings());
      setPinInput('');
      Alert.alert('Success', 'Parental controls unlocked for 30 minutes');
    } else {
      Alert.alert('Error', 'Incorrect PIN');
    }
  };

  const handleParentalDisable = async () => {
    const success = await parentalControlService.disable(pinInput);
    if (success) {
      setParentalSettings(parentalControlService.getSettings());
      setParentalModalVisible(false);
      setPinInput('');
      Alert.alert('Success', 'Parental controls disabled');
    } else {
      Alert.alert('Error', 'Incorrect PIN');
    }
  };

  const handleToggleParentalSetting = async (key: keyof ParentalControlSettings, value: boolean) => {
    await parentalControlService.saveSettings({ [key]: value });
    setParentalSettings(parentalControlService.getSettings());
  };

  const AccountSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  // Focus state for account cards
  const [focusedCard, setFocusedCard] = useState<string | null>(null);
  const [focusedButton, setFocusedButton] = useState<string | null>(null);

  const AccountCard = ({
    title,
    icon,
    account,
    onLogin,
    onLogout,
  }: {
    title: string;
    icon: string;
    account?: any;
    onLogin: () => void;
    onLogout: () => void;
  }) => {
    const cardId = title.toLowerCase().replace(/\s+/g, '-');
    const isCardFocused = focusedCard === cardId;
    const isLoginFocused = focusedButton === `${cardId}-login`;
    const isLogoutFocused = focusedButton === `${cardId}-logout`;
    
    return (
      <View style={[
        styles.accountCard,
        isCardFocused && styles.accountCardFocused,
      ]}>
        <View style={styles.accountHeader}>
          <View style={styles.accountTitleContainer}>
            <Ionicons name={icon as any} size={isTV ? 20 : 24} color={theme.colors.primary} />
            <Text style={styles.accountTitle}>{title}</Text>
          </View>
          {account ? (
            <Pressable 
              onPress={onLogout} 
              onFocus={() => {
                setFocusedCard(cardId);
                setFocusedButton(`${cardId}-logout`);
              }}
              onBlur={() => {
                setFocusedCard(null);
                setFocusedButton(null);
              }}
              style={[
                styles.logoutButton,
                isLogoutFocused && styles.buttonFocused,
              ]}
              testID={`logout-${cardId}`}
            >
              <Text style={[styles.logoutText, isLogoutFocused && styles.buttonTextFocused]}>
                Logout
              </Text>
            </Pressable>
          ) : (
            <Pressable 
              onPress={onLogin} 
              onFocus={() => {
                setFocusedCard(cardId);
                setFocusedButton(`${cardId}-login`);
              }}
              onBlur={() => {
                setFocusedCard(null);
                setFocusedButton(null);
              }}
              style={[
                styles.loginButton,
                isLoginFocused && styles.buttonFocused,
              ]}
              testID={`login-${cardId}`}
            >
              <Text style={[styles.loginText, isLoginFocused && styles.buttonTextFocused]}>
                Login
              </Text>
            </Pressable>
          )}
        </View>
        {account && (
          <View style={styles.accountInfo}>
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>Username:</Text>
              <Text style={styles.accountValue}>{account.username}</Text>
            </View>
            {account.email && (
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Email:</Text>
                <Text style={styles.accountValue}>{account.email}</Text>
              </View>
            )}
            {account.expiryDate && (
              <>
                <View style={styles.accountRow}>
                  <Text style={styles.accountLabel}>Expires:</Text>
                  <Text style={styles.accountValue}>
                    {formatDistanceToNow(new Date(account.expiryDate), { addSuffix: true })}
                  </Text>
                </View>
                <View style={styles.accountRow}>
                  <Text style={styles.accountLabel}>Days Left:</Text>
                  <Text
                    style={[
                      styles.accountValue,
                      { color: account.daysLeft <= 10 ? theme.colors.error : account.daysLeft < 30 ? theme.colors.warning : theme.colors.success },
                    ]}
                  >
                    {account.daysLeft} days {account.daysLeft <= 10 && '⚠️'}
                  </Text>
                </View>
              </>
            )}
            {account.type && (
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Type:</Text>
                <Text style={[styles.accountValue, { color: theme.colors.gold }]}>
                  {account.type.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const SettingToggle = ({
    label,
    value,
    onValueChange,
    description,
  }: {
    label: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    description?: string;
  }) => (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description && <Text style={styles.toggleDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.surfaceLight, true: theme.colors.primary }}
        thumbColor={theme.colors.text}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        {...(Platform.isTV && {
          scrollEnabled: true,
          keyboardDismissMode: 'none',
          removeClippedSubviews: false,
        })}
      >
        {/* Accounts Section */}
        <AccountSection title="Accounts">
          <AccountCard
            title="Trakt"
            icon="play-circle"
            account={traktUser}
            onLogin={() => handleQRAuth('trakt')}
            onLogout={logoutTrakt}
          />
          <AccountCard
            title="Real-Debrid"
            icon="cloud-download"
            account={realDebridAccount}
            onLogin={() => handleQRAuth('real-debrid')}
            onLogout={logoutRealDebrid}
          />
          <AccountCard
            title="AllDebrid"
            icon="cloud-download"
            account={allDebridAccount}
            onLogin={() => handleQRAuth('alldebrid')}
            onLogout={logoutAllDebrid}
          />
          <AccountCard
            title="Premiumize"
            icon="cloud-download"
            account={premiumizeAccount}
            onLogin={() => handleQRAuth('premiumize')}
            onLogout={logoutPremiumize}
          />
          <AccountCard
            title="Premium IPTV"
            icon="tv"
            account={iptvAccount}
            onLogin={() => setIptvModalVisible(true)}
            onLogout={logoutIPTV}
          />
          
          {/* Torrentio Configuration Card */}
          <View style={styles.accountCard}>
            <View style={styles.accountHeader}>
              <Ionicons name="magnet" size={isTV ? 32 : 24} color={theme.colors.primary} />
              <Text style={styles.accountTitle}>Torrentio</Text>
            </View>
            {torrentioConfig ? (
              <View style={styles.accountInfo}>
                <Text style={styles.accountLabel}>Provider</Text>
                <Text style={styles.accountValue}>
                  {torrentioConfig.includes('realdebrid') ? 'Real-Debrid' : 
                   torrentioConfig.includes('alldebrid') ? 'AllDebrid' : 'Premiumize'}
                </Text>
                <Text style={[styles.accountLabel, { marginTop: 8 }]}>Status</Text>
                <Text style={[styles.accountValue, { color: theme.colors.success }]}>Configured</Text>
              </View>
            ) : (
              <Text style={styles.accountNotConnected}>Not configured</Text>
            )}
            <View style={styles.accountActions}>
              <Pressable
                style={[styles.accountButton, torrentioConfig && styles.logoutButton]}
                onPress={() => torrentioConfig ? clearTorrentioConfig() : setTorrentioModalVisible(true)}
              >
                <Text style={[styles.accountButtonText, torrentioConfig && styles.logoutButtonText]}>
                  {torrentioConfig ? 'Clear' : 'Configure'}
                </Text>
              </Pressable>
              {torrentioConfig && (
                <Pressable
                  style={styles.accountButton}
                  onPress={() => setTorrentioModalVisible(true)}
                >
                  <Text style={styles.accountButtonText}>Edit</Text>
                </Pressable>
              )}
            </View>
          </View>
        </AccountSection>

        {/* Zeus Vault Section */}
        <AccountSection title="Zeus Vault">
          <View style={styles.vaultCard}>
            <View style={styles.vaultHeader}>
              <View style={styles.vaultTitleRow}>
                <Ionicons name="shield" size={isTV ? 36 : 28} color="#FFD700" />
                <View style={styles.vaultTitleContainer}>
                  <Text style={styles.vaultTitle}>Zeus Vault</Text>
                  <Text style={styles.vaultSubtitle}>Secure account backup</Text>
                </View>
              </View>
              <View style={styles.vaultStatusBadge}>
                <View style={[
                  styles.vaultStatusDot,
                  { backgroundColor: vaultStatus?.exists ? theme.colors.success : theme.colors.textMuted }
                ]} />
                <Text style={styles.vaultStatusText}>
                  {vaultStatus?.exists ? `${vaultStatus.accountCount} accounts saved` : 'No backup'}
                </Text>
              </View>
            </View>

            <Text style={styles.vaultDescription}>
              Save all your accounts (IPTV, Debrid, Trakt) to device storage. 
              If you reinstall the app, Zeus Vault will automatically restore your settings.
            </Text>

            {vaultStatus?.lastSaved && (
              <Text style={styles.vaultLastSaved}>
                Last saved: {formatDistanceToNow(new Date(vaultStatus.lastSaved), { addSuffix: true })}
              </Text>
            )}

            <View style={styles.vaultActions}>
              <Pressable 
                style={[styles.vaultButton, styles.vaultButtonPrimary, focusedElement === 'vault-save' && styles.buttonFocused]}
                onPress={handleSaveVault}
                onFocus={() => setFocusedElement('vault-save')}
                onBlur={() => setFocusedElement(null)}
                disabled={vaultLoading}
                data-testid="vault-save-btn"
              >
                {vaultLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#000" />
                    <Text style={styles.vaultButtonTextPrimary}>Save Backup</Text>
                  </>
                )}
              </Pressable>

              <Pressable 
                style={[styles.vaultButton, focusedElement === 'vault-restore' && styles.buttonFocused]}
                onPress={handleRestoreVault}
                onFocus={() => setFocusedElement('vault-restore')}
                onBlur={() => setFocusedElement(null)}
                disabled={vaultLoading}
                data-testid="vault-restore-btn"
              >
                <Ionicons name="cloud-download-outline" size={18} color={theme.colors.text} />
                <Text style={styles.vaultButtonText}>Restore Backup</Text>
              </Pressable>

              <Pressable 
                style={[styles.vaultButton, focusedElement === 'vault-export' && styles.buttonFocused]}
                onPress={handleExportVault}
                onFocus={() => setFocusedElement('vault-export')}
                onBlur={() => setFocusedElement(null)}
                disabled={vaultLoading}
                data-testid="vault-share-btn"
              >
                <Ionicons name="share-outline" size={18} color={theme.colors.text} />
                <Text style={styles.vaultButtonText}>Share/Copy</Text>
              </Pressable>

              <Pressable 
                style={[styles.vaultButton, focusedElement === 'vault-modal' && styles.buttonFocused]}
                onPress={() => setVaultModalVisible(true)}
                onFocus={() => setFocusedElement('vault-modal')}
                onBlur={() => setFocusedElement(null)}
                data-testid="vault-import-btn"
              >
                <Ionicons name="clipboard-outline" size={18} color={theme.colors.text} />
                <Text style={styles.vaultButtonText}>Paste Import</Text>
              </Pressable>
            </View>
          </View>
        </AccountSection>

        {/* VPN / Proxy Section */}
        <AccountSection title="VPN / Proxy">
          <View style={styles.settingsCard}>
            <View style={styles.vpnHeader}>
              <View style={styles.vpnTitleRow}>
                <Ionicons 
                  name="shield" 
                  size={24} 
                  color={proxySettings?.enabled ? theme.colors.success : theme.colors.textSecondary} 
                />
                <View style={styles.vpnTitleContainer}>
                  <Text style={styles.vpnTitle}>Streaming Proxy</Text>
                  <Text style={styles.vpnSubtitle}>
                    {proxySettings?.enabled 
                      ? `Connected to ${proxyCountries.find(c => c.code === proxySettings.selectedCountry)?.name || 'Unknown'}`
                      : 'Route traffic through proxy servers'
                    }
                  </Text>
                </View>
              </View>
              <Switch
                value={proxySettings?.enabled || false}
                onValueChange={async (value) => {
                  if (value && !proxySettings?.selectedCountry) {
                    // Need to select a country first
                    Alert.alert('Select Country', 'Please select a country first');
                    return;
                  }
                  if (value && proxySettings?.selectedCountry) {
                    await proxyService.enableProxy(proxySettings.selectedCountry);
                  } else {
                    await proxyService.disableProxy();
                  }
                  const updated = await proxyService.getSettings();
                  setProxySettings(updated);
                }}
                trackColor={{ false: theme.colors.surfaceLight, true: theme.colors.success + '50' }}
                thumbColor={proxySettings?.enabled ? theme.colors.success : theme.colors.textSecondary}
              />
            </View>

            <Text style={styles.vpnCountryLabel}>Select Country:</Text>
            <View style={styles.vpnCountryGrid}>
              {proxyCountries.map(country => {
                const isSelected = proxySettings?.selectedCountry === country.code;
                return (
                  <Pressable
                    key={country.code}
                    style={[
                      styles.vpnCountryButton,
                      isSelected && styles.vpnCountryButtonSelected,
                      focusedElement === `vpn-${country.code}` && styles.vpnCountryButtonFocused,
                    ]}
                    onPress={async () => {
                      const newSettings = {
                        ...proxySettings!,
                        selectedCountry: country.code,
                        enabled: true,
                      };
                      await proxyService.saveSettings(newSettings);
                      setProxySettings(newSettings);
                      if (proxySettings?.enabled) {
                        await proxyService.enableProxy(country.code);
                      }
                    }}
                    onFocus={() => setFocusedElement(`vpn-${country.code}`)}
                    onBlur={() => setFocusedElement(null)}
                    data-testid={`vpn-country-${country.code}`}
                  >
                    <Text style={styles.vpnCountryFlag}>{country.flag}</Text>
                    <Text style={[
                      styles.vpnCountryName, 
                      isSelected && styles.vpnCountryNameSelected
                    ]}>
                      {country.name}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.vpnInfoBox}>
              <Ionicons name="information-circle-outline" size={18} color={theme.colors.textSecondary} />
              <Text style={styles.vpnInfoText}>
                Proxy routes streaming traffic only. May help access geo-restricted content.
                Free proxies may be slower than direct connection.
              </Text>
            </View>

            {/* Speed Test */}
            <Pressable
              style={[
                styles.speedTestBtn,
                focusedElement === 'speed-test' && styles.vpnCountryButtonFocused,
              ]}
              onPress={async () => {
                if (!proxySettings?.enabled || !proxySettings?.selectedCountry) {
                  Alert.alert('Enable Proxy', 'Please enable proxy and select a country first');
                  return;
                }
                setFocusedElement('speed-testing');
                try {
                  const proxyUrl = await proxyService.getProxyUrl();
                  if (!proxyUrl) {
                    Alert.alert('No Proxy', 'No proxy server configured');
                    setFocusedElement(null);
                    return;
                  }
                  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
                  const response = await fetch(`${backendUrl}/api/proxy/test?proxy_url=${encodeURIComponent(proxyUrl)}`, {
                    signal: AbortSignal.timeout(15000),
                  });
                  const data = await response.json();
                  if (data.success) {
                    Alert.alert(
                      'Speed Test Result',
                      `Proxy is online!\n\nLatency: ${data.latency_ms}ms\nIP: ${data.ip}\n\n${data.latency_ms < 500 ? 'Good speed for streaming.' : data.latency_ms < 1500 ? 'Average speed, may buffer on HD.' : 'Slow connection, may not work well for streaming.'}`
                    );
                  } else {
                    Alert.alert('Speed Test Failed', `Proxy is offline or unreachable.\n\n${data.error || 'Connection timed out'}`);
                  }
                } catch (error: any) {
                  Alert.alert('Speed Test Error', error.message || 'Test failed');
                } finally {
                  setFocusedElement(null);
                }
              }}
              onFocus={() => setFocusedElement('speed-test')}
              onBlur={() => setFocusedElement(null)}
              data-testid="proxy-speed-test-btn"
            >
              <Ionicons 
                name={focusedElement === 'speed-testing' ? 'hourglass' : 'speedometer'} 
                size={20} 
                color={theme.colors.primary} 
              />
              <Text style={styles.speedTestText}>
                {focusedElement === 'speed-testing' ? 'Testing...' : 'Run Speed Test'}
              </Text>
            </Pressable>
          </View>
        </AccountSection>

        {/* Scraper Status Section */}
        <AccountSection title="Scraper Status">
          <View style={styles.settingsCard}>
            <View style={styles.scraperHeader}>
              <View style={styles.scraperTitleRow}>
                <Ionicons name="cloud-outline" size={24} color={theme.colors.primary} />
                <View style={styles.scraperTitleContainer}>
                  <Text style={styles.scraperTitle}>Stream Sources</Text>
                  <Text style={styles.scraperSubtitle}>
                    {scraperStatuses.length > 0 
                      ? `${scraperStatuses.filter(s => s.status === 'online').length}/${scraperStatuses.length} online`
                      : 'Check which scrapers are available'
                    }
                  </Text>
                </View>
              </View>
              <Pressable
                style={[
                  styles.scraperCheckButton,
                  checkingScrapers && styles.scraperCheckButtonDisabled,
                  focusedElement === 'check-scrapers' && styles.scraperCheckButtonFocused,
                ]}
                onPress={handleCheckScrapers}
                onFocus={() => setFocusedElement('check-scrapers')}
                onBlur={() => setFocusedElement(null)}
                disabled={checkingScrapers}
                data-testid="check-scrapers-btn"
              >
                {checkingScrapers ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={18} color={theme.colors.text} />
                    <Text style={styles.scraperCheckButtonText}>Check All</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Progress indicator */}
            {checkingScrapers && scraperCheckProgress.total > 0 && (
              <View style={styles.scraperProgressContainer}>
                <View style={styles.scraperProgressBar}>
                  <View 
                    style={[
                      styles.scraperProgressFill, 
                      { width: `${(scraperCheckProgress.completed / scraperCheckProgress.total) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.scraperProgressText}>
                  {scraperCheckProgress.completed}/{scraperCheckProgress.total}
                </Text>
              </View>
            )}

            {/* Scraper list */}
            {scraperStatuses.length > 0 && (
              <View style={styles.scraperList}>
                {scraperStatuses.map((scraper, index) => (
                  <View key={scraper.name} style={styles.scraperItem}>
                    <View style={styles.scraperItemLeft}>
                      <View style={[
                        styles.scraperStatusDot,
                        scraper.status === 'online' && styles.scraperStatusOnline,
                        scraper.status === 'offline' && styles.scraperStatusOffline,
                        scraper.status === 'checking' && styles.scraperStatusChecking,
                      ]} />
                      <Text style={styles.scraperItemName}>{scraper.name}</Text>
                    </View>
                    <View style={styles.scraperItemRight}>
                      {scraper.latency && scraper.status === 'online' && (
                        <Text style={styles.scraperLatency}>{scraper.latency}ms</Text>
                      )}
                      <Text style={[
                        styles.scraperStatusText,
                        scraper.status === 'online' && styles.scraperStatusTextOnline,
                        scraper.status === 'offline' && styles.scraperStatusTextOffline,
                      ]}>
                        {scraper.status === 'online' ? 'Online' : scraper.status === 'offline' ? 'Offline' : 'Checking'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Initial state */}
            {scraperStatuses.length === 0 && !checkingScrapers && (
              <View style={styles.scraperEmptyState}>
                <Ionicons name="search-outline" size={32} color={theme.colors.textMuted} />
                <Text style={styles.scraperEmptyText}>
                  Tap "Check All" to test which stream sources are available
                </Text>
              </View>
            )}
          </View>
        </AccountSection>


        {/* Content Filter Section */}
        <AccountSection title="Content Filter">
          <View style={styles.settingsCard}>
            <View style={styles.scraperHeader}>
              <View style={styles.scraperTitleRow}>
                <Ionicons name="shield-checkmark" size={24} color="#22C55E" />
                <View style={styles.scraperTitleContainer}>
                  <Text style={styles.scraperTitle}>Content Safety</Text>
                  <Text style={styles.scraperSubtitle}>
                    {contentFilterSettings.enabled ? 'Adult content blocked' : 'Filter disabled'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>Block Adult Streams</Text>
                <Text style={styles.settingDescription}>Filter NSFW links from free scrapers</Text>
              </View>
              <Pressable
                style={[
                  styles.toggleButton,
                  contentFilterSettings.blockAdultStreams && styles.toggleButtonActive,
                ]}
                onPress={async () => {
                  const newVal = !contentFilterSettings.blockAdultStreams;
                  await contentFilterService.saveSettings({ blockAdultStreams: newVal });
                  setContentFilterSettings(contentFilterService.getSettings());
                }}
                data-testid="toggle-block-adult-streams"
              >
                <Text style={[styles.toggleText, contentFilterSettings.blockAdultStreams && styles.toggleTextActive]}>
                  {contentFilterSettings.blockAdultStreams ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>Block Adult IPTV Categories</Text>
                <Text style={styles.settingDescription}>Hide adult categories from IPTV listings</Text>
              </View>
              <Pressable
                style={[
                  styles.toggleButton,
                  contentFilterSettings.blockAdultCategories && styles.toggleButtonActive,
                ]}
                onPress={async () => {
                  const newVal = !contentFilterSettings.blockAdultCategories;
                  await contentFilterService.saveSettings({ blockAdultCategories: newVal });
                  setContentFilterSettings(contentFilterService.getSettings());
                }}
                data-testid="toggle-block-adult-categories"
              >
                <Text style={[styles.toggleText, contentFilterSettings.blockAdultCategories && styles.toggleTextActive]}>
                  {contentFilterSettings.blockAdultCategories ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>Link Snooper</Text>
                <Text style={styles.settingDescription}>Follow redirects to find clean direct video links</Text>
              </View>
              <View style={[styles.toggleButton, styles.toggleButtonActive]}>
                <Text style={[styles.toggleText, styles.toggleTextActive]}>AUTO</Text>
              </View>
            </View>
          </View>
        </AccountSection>

        {/* Parental Controls Section */}
        <AccountSection title="Parental Controls">
          <View style={styles.settingsCard}>
            <View style={styles.parentalHeader}>
              <View style={styles.parentalTitleRow}>
                <Ionicons name="shield-checkmark" size={24} color={parentalSettings?.enabled ? theme.colors.success : theme.colors.textSecondary} />
                <Text style={styles.parentalTitle}>Adult Content Filter</Text>
              </View>
              <Pressable
                style={[styles.parentalButton, parentalSettings?.enabled && styles.parentalButtonEnabled]}
                onPress={() => {
                  if (parentalSettings?.enabled) {
                    setPinMode('verify');
                  } else {
                    setPinMode('setup');
                  }
                  setParentalModalVisible(true);
                }}
                data-testid="parental-enable-btn"
              >
                <Text style={styles.parentalButtonText}>
                  {parentalSettings?.enabled ? 'Manage' : 'Enable'}
                </Text>
              </Pressable>
            </View>

            {parentalSettings?.enabled && (
              <View style={styles.parentalOptions}>
                <SettingToggle
                  label="Hide Adult Content"
                  value={parentalSettings.hideAdultContent}
                  onValueChange={(v) => handleToggleParentalSetting('hideAdultContent', v)}
                  description="Filter content with adult keywords"
                />
                <SettingToggle
                  label="Hide XXX Categories"
                  value={parentalSettings.hideXXXCategories}
                  onValueChange={(v) => handleToggleParentalSetting('hideXXXCategories', v)}
                  description="Hide adult categories from IPTV"
                />
                <SettingToggle
                  label="Require PIN for Settings"
                  value={parentalSettings.requirePinForSettings}
                  onValueChange={(v) => handleToggleParentalSetting('requirePinForSettings', v)}
                />
              </View>
            )}
          </View>
        </AccountSection>

        {/* Subtitles & Player Settings */}
        <AccountSection title="Player Settings">
          <View style={styles.settingsCard}>
            {/* Subtitle Settings */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="text" size={24} color={theme.colors.primary} style={{ marginRight: 12 }} />
                <View>
                  <Text style={styles.settingLabel}>Subtitles</Text>
                  <Text style={styles.settingDescription}>
                    {subtitleSettings?.enabled ? 'Enabled' : 'Disabled'} • Size: {subtitleSettings?.fontSize || 'Medium'}
                  </Text>
                </View>
              </View>
              <Pressable
                style={[styles.configureButton, focusedElement === 'subtitles' && styles.buttonFocused]}
                onPress={() => setSubtitleModalVisible(true)}
                onFocus={() => setFocusedElement('subtitles')}
                onBlur={() => setFocusedElement(null)}
              >
                <Text style={styles.configureButtonText}>Configure</Text>
              </Pressable>
            </View>

            {/* OpenSubtitles Account */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="cloud-download" size={24} color={theme.colors.gold} style={{ marginRight: 12 }} />
                <View>
                  <Text style={styles.settingLabel}>OpenSubtitles</Text>
                  <Text style={styles.settingDescription}>
                    {openSubtitlesApiKey ? 'Connected' : 'Not configured'}
                  </Text>
                </View>
              </View>
              <Pressable
                style={[styles.configureButton, focusedElement === 'opensubtitles' && styles.buttonFocused]}
                onPress={() => setSubtitleModalVisible(true)}
                onFocus={() => setFocusedElement('opensubtitles')}
                onBlur={() => setFocusedElement(null)}
              >
                <Text style={styles.configureButtonText}>Setup</Text>
              </Pressable>
            </View>

            {/* One-Click Play */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="flash" size={24} color="#FFD700" style={{ marginRight: 12 }} />
                <View>
                  <Text style={styles.settingLabel}>One-Click Play</Text>
                  <Text style={styles.settingDescription}>
                    {oneClickSettings?.enabled 
                      ? `${oneClickSettings.preferredQuality} • ${oneClickSettings.preferredHoster || 'Any Hoster'}` 
                      : 'Disabled'}
                  </Text>
                </View>
              </View>
              <Pressable
                style={[styles.configureButton, focusedElement === 'oneclick' && styles.buttonFocused]}
                onPress={() => setOneClickModalVisible(true)}
                onFocus={() => setFocusedElement('oneclick')}
                onBlur={() => setFocusedElement(null)}
              >
                <Text style={styles.configureButtonText}>Configure</Text>
              </Pressable>
            </View>
          </View>
        </AccountSection>

        {/* Error Logs Section */}
        <AccountSection title="Debug & Support">
          <View style={styles.settingsCard}>
            <Pressable style={styles.debugButton} onPress={handleOpenLogs}>
              <Ionicons name="bug" size={24} color={theme.colors.primary} />
              <View style={styles.debugButtonText}>
                <Text style={styles.debugTitle}>Error Logs</Text>
                <Text style={styles.debugSubtitle}>
                  {errorLogService.getErrors().length} errors recorded
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </Pressable>

            <View style={styles.supportActions}>
              <Pressable style={styles.supportButton} onPress={handleSendLogsEmail}>
                <Ionicons name="mail" size={20} color={theme.colors.text} />
                <Text style={styles.supportButtonText}>Send via Email</Text>
              </Pressable>
              <Pressable style={styles.supportButton} onPress={handleSendLogsTelegram}>
                <Ionicons name="paper-plane" size={20} color={theme.colors.text} />
                <Text style={styles.supportButtonText}>Send to Telegram</Text>
              </Pressable>
            </View>

            <Text style={styles.supportInfo}>
              Support: thealphaddon@gmail.com
            </Text>
          </View>
        </AccountSection>

        {/* App Info */}
        <AccountSection title="About">
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>Zeus Glass v1.5.0</Text>
            <Text style={styles.infoSubtext}>Premium Streaming Platform</Text>
          </View>
        </AccountSection>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* QR Auth Modal */}
      <QRAuthModal
        visible={qrModalVisible}
        service={selectedService}
        onClose={() => setQrModalVisible(false)}
        onSuccess={handleQRSuccess}
      />

      {/* IPTV Login Modal */}
      <Modal
        visible={iptvModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIptvModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.iptvModal}>
            <View style={styles.iptvHeader}>
              <Text style={styles.iptvTitle}>IPTV Xtreme Codes Login</Text>
              <Pressable onPress={() => setIptvModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>
            <View style={styles.iptvForm}>
              <TextInput
                style={styles.iptvInput}
                placeholder="Domain (e.g., provider.com)"
                placeholderTextColor={theme.colors.textMuted}
                value={iptvDomain}
                onChangeText={setIptvDomain}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.iptvInput}
                placeholder="Username"
                placeholderTextColor={theme.colors.textMuted}
                value={iptvUsername}
                onChangeText={setIptvUsername}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.iptvInput}
                placeholder="Password"
                placeholderTextColor={theme.colors.textMuted}
                value={iptvPassword}
                onChangeText={setIptvPassword}
                secureTextEntry
              />
              <Pressable
                style={[styles.iptvButton, iptvLoading && styles.iptvButtonDisabled]}
                onPress={handleIPTVLogin}
                disabled={iptvLoading}
              >
                {iptvLoading ? (
                  <ActivityIndicator color={theme.colors.text} />
                ) : (
                  <Text style={styles.iptvButtonText}>Login</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Torrentio Configuration Modal */}
      <Modal
        visible={torrentioModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTorrentioModalVisible(false)}
      >
        <BlurView intensity={80} style={styles.modalOverlay}>
          <View style={[styles.iptvModal, { maxWidth: 600 }]}>
            <View style={styles.iptvHeader}>
              <Text style={styles.iptvTitle}>Configure Torrentio</Text>
              <Pressable onPress={() => setTorrentioModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>
            
            <ScrollView style={{ maxHeight: 500 }}>
              {/* QR Code for Configure Page */}
              <View style={styles.torrentioQRSection}>
                <Text style={styles.torrentioSectionTitle}>Option 1: Configure Online</Text>
                <Text style={styles.torrentioDescription}>
                  Scan this QR code or visit the URL to configure Torrentio with your Debrid provider:
                </Text>
                <View style={styles.torrentioQRWrapper}>
                  <QRCode
                    value={TORRENTIO_CONFIGURE_URL}
                    size={isTV ? 200 : 150}
                    backgroundColor="white"
                    color="black"
                  />
                </View>
                <Text style={styles.torrentioUrl}>{TORRENTIO_CONFIGURE_URL}</Text>
                <Pressable 
                  style={styles.torrentioLinkButton}
                  onPress={() => Linking.openURL(TORRENTIO_CONFIGURE_URL)}
                >
                  <Ionicons name="open-outline" size={18} color={theme.colors.text} />
                  <Text style={styles.torrentioLinkButtonText}>Open in Browser</Text>
                </Pressable>
              </View>

              <View style={styles.torrentioDivider} />

              {/* Manual Configuration */}
              <View style={styles.torrentioManualSection}>
                <Text style={styles.torrentioSectionTitle}>Option 2: Quick Setup</Text>
                <Text style={styles.torrentioDescription}>
                  Enter your Debrid API key directly:
                </Text>
                
                {/* Provider Selection */}
                <Text style={styles.torrentioLabel}>Debrid Provider:</Text>
                <View style={styles.torrentioProviderButtons}>
                  {(['realdebrid', 'alldebrid', 'premiumize'] as const).map((provider) => (
                    <Pressable
                      key={provider}
                      style={[
                        styles.torrentioProviderButton,
                        torrentioProvider === provider && styles.torrentioProviderButtonActive
                      ]}
                      onPress={() => setTorrentioProvider(provider)}
                    >
                      <Text style={[
                        styles.torrentioProviderButtonText,
                        torrentioProvider === provider && styles.torrentioProviderButtonTextActive
                      ]}>
                        {provider === 'realdebrid' ? 'Real-Debrid' : 
                         provider === 'alldebrid' ? 'AllDebrid' : 'Premiumize'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* API Key Input */}
                <Text style={styles.torrentioLabel}>API Key:</Text>
                <TextInput
                  style={styles.iptvInput}
                  placeholder="Paste your API key here"
                  placeholderTextColor={theme.colors.textMuted}
                  value={torrentioApiKey}
                  onChangeText={setTorrentioApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Pressable style={styles.iptvButton} onPress={saveTorrentioConfig}>
                  <Text style={styles.iptvButtonText}>Save Configuration</Text>
                </Pressable>

                <Text style={styles.torrentioHint}>
                  💡 Get your API key from your Debrid provider's website under Account settings.
                </Text>
              </View>
            </ScrollView>
          </View>
        </BlurView>
      </Modal>

      {/* Error Logs Modal */}
      <Modal
        visible={logModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLogModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.logsModal}>
            <View style={styles.logsHeader}>
              <Text style={styles.logsTitle}>Error Logs</Text>
              <View style={styles.logsActions}>
                <Pressable onPress={handleCopyLogs} style={styles.logAction}>
                  <Ionicons name="copy" size={20} color={theme.colors.text} />
                </Pressable>
                <Pressable onPress={handleClearLogs} style={styles.logAction}>
                  <Ionicons name="trash" size={20} color={theme.colors.error} />
                </Pressable>
                <Pressable onPress={() => setLogModalVisible(false)} style={styles.logAction}>
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </Pressable>
              </View>
            </View>

            <View style={styles.logsFilter}>
              <Pressable
                style={[styles.filterButton, showErrorsOnly && styles.filterButtonActive]}
                onPress={() => {
                  setShowErrorsOnly(true);
                  setLogs(errorLogService.getErrors());
                }}
              >
                <Text style={[styles.filterButtonText, showErrorsOnly && styles.filterButtonTextActive]}>
                  Errors Only
                </Text>
              </Pressable>
              <Pressable
                style={[styles.filterButton, !showErrorsOnly && styles.filterButtonActive]}
                onPress={() => {
                  setShowErrorsOnly(false);
                  setLogs(errorLogService.getLogs());
                }}
              >
                <Text style={[styles.filterButtonText, !showErrorsOnly && styles.filterButtonTextActive]}>
                  All Logs
                </Text>
              </Pressable>
            </View>

            <ScrollView style={styles.logsList}>
              {logs.length === 0 ? (
                <View style={styles.emptyLogs}>
                  <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} />
                  <Text style={styles.emptyLogsText}>No errors recorded</Text>
                </View>
              ) : (
                logs.map((log) => (
                  <View key={log.id} style={styles.logEntry}>
                    <View style={styles.logEntryHeader}>
                      <Ionicons
                        name={log.level === 'error' ? 'alert-circle' : log.level === 'warn' ? 'warning' : 'information-circle'}
                        size={16}
                        color={log.level === 'error' ? theme.colors.error : log.level === 'warn' ? theme.colors.warning : theme.colors.primary}
                      />
                      <Text style={styles.logContext}>{log.context || 'App'}</Text>
                      <Text style={styles.logTime}>{format(new Date(log.timestamp), 'HH:mm:ss')}</Text>
                    </View>
                    <Text style={styles.logMessage}>{log.message}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Parental Control Modal */}
      <Modal
        visible={parentalModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setParentalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.parentalModal}>
            <View style={styles.parentalModalHeader}>
              <Text style={styles.parentalModalTitle}>
                {pinMode === 'setup' ? 'Setup Parental PIN' : pinMode === 'verify' ? 'Enter PIN' : 'Change PIN'}
              </Text>
              <Pressable onPress={() => setParentalModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>

            <View style={styles.parentalForm}>
              {pinMode === 'setup' && (
                <>
                  <TextInput
                    style={styles.pinInput}
                    placeholder="Enter new PIN (min 4 digits)"
                    placeholderTextColor={theme.colors.textMuted}
                    value={newPinInput}
                    onChangeText={setNewPinInput}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                  />
                  <TextInput
                    style={styles.pinInput}
                    placeholder="Confirm PIN"
                    placeholderTextColor={theme.colors.textMuted}
                    value={confirmPinInput}
                    onChangeText={setConfirmPinInput}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                  />
                  <Pressable style={styles.pinButton} onPress={handleParentalSetup}>
                    <Text style={styles.pinButtonText}>Enable Parental Controls</Text>
                  </Pressable>
                </>
              )}

              {pinMode === 'verify' && (
                <>
                  <TextInput
                    style={styles.pinInput}
                    placeholder="Enter PIN"
                    placeholderTextColor={theme.colors.textMuted}
                    value={pinInput}
                    onChangeText={setPinInput}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                  />
                  <Pressable style={styles.pinButton} onPress={handleParentalVerify}>
                    <Text style={styles.pinButtonText}>Unlock</Text>
                  </Pressable>
                  <Pressable style={styles.pinButtonSecondary} onPress={handleParentalDisable}>
                    <Text style={styles.pinButtonSecondaryText}>Disable Parental Controls</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: isTV ? 20 : theme.spacing.md,  // Reduced from 40
  },
  sectionTitle: {
    fontSize: isTV ? 22 : theme.fontSize.xl,  // Reduced from 36
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: isTV ? 14 : theme.spacing.md,  // Reduced from 24
  },
  accountCard: {
    backgroundColor: theme.colors.card,
    borderRadius: isTV ? 14 : theme.borderRadius.md,  // Reduced from 20
    padding: isTV ? 16 : theme.spacing.md,           // Reduced from 28
    marginBottom: isTV ? 12 : theme.spacing.md,      // Reduced from 20
    borderWidth: isTV ? 2 : 1,                       // Reduced from 3
    borderColor: theme.colors.border,
  },
  accountCardFocused: {
    borderColor: '#FFFFFF',
    borderWidth: isTV ? 3 : 3,  // Reduced from 5
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    shadowColor: '#00D9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: isTV ? 20 : 20,  // Reduced from 30
    elevation: 20,
    transform: [{ scale: isTV ? 1.02 : 1.01 }],  // Reduced from 1.03
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isTV ? 12 : theme.spacing.md,  // Reduced from 20
  },
  accountTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountTitle: {
    fontSize: isTV ? 18 : theme.fontSize.lg,  // Reduced from 28
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginLeft: isTV ? 10 : theme.spacing.sm,  // Reduced from 16
  },
  loginButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: isTV ? 18 : theme.spacing.lg,  // Reduced from 32
    paddingVertical: isTV ? 10 : theme.spacing.sm,    // Reduced from 16
    borderRadius: isTV ? 10 : theme.borderRadius.md,  // Reduced from 16
    borderWidth: isTV ? 2 : 2,                        // Reduced from 4
    borderColor: 'transparent',
  },
  loginText: {
    fontSize: isTV ? 15 : theme.fontSize.md,  // Reduced from 22
    fontWeight: theme.fontWeight.semibold,
    color: '#000',
  },
  logoutButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: isTV ? 18 : theme.spacing.lg,  // Reduced from 32
    paddingVertical: isTV ? 10 : theme.spacing.sm,    // Reduced from 16
    borderRadius: isTV ? 10 : theme.borderRadius.md,  // Reduced from 16
    borderWidth: isTV ? 2 : 2,                        // Reduced from 4
    borderColor: 'transparent',
  },
  logoutText: {
    fontSize: isTV ? 15 : theme.fontSize.md,  // Reduced from 22
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  buttonFocused: {
    borderColor: '#FFFFFF',
    borderWidth: isTV ? 3 : 4,   // Reduced from 5
    transform: [{ scale: isTV ? 1.1 : 1.12 }],  // Reduced from 1.18
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: isTV ? 18 : 25,  // Reduced from 30
    elevation: 30,
  },
  buttonTextFocused: {
    fontWeight: '900' as const,
  },
  // Zeus Vault styles
  vaultCard: {
    backgroundColor: theme.colors.card,
    borderRadius: isTV ? 14 : theme.borderRadius.md,  // Reduced from 20
    padding: isTV ? 16 : theme.spacing.md,            // Reduced from 28
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  vaultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isTV ? 12 : theme.spacing.md,  // Reduced from 20
  },
  vaultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 10 : 12,  // Reduced from 16
  },
  vaultTitleContainer: {
    gap: 2,
  },
  vaultTitle: {
    fontSize: isTV ? 18 : 20,  // Reduced from 26
    fontWeight: '700',
    color: '#FFD700',
  },
  vaultSubtitle: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textSecondary,
  },
  vaultStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: isTV ? 16 : 12,
    paddingVertical: isTV ? 10 : 6,
    borderRadius: 20,
    gap: 8,
  },
  vaultStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vaultStatusText: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.text,
  },
  vaultDescription: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textSecondary,
    lineHeight: isTV ? 24 : 20,
    marginBottom: isTV ? 16 : 12,
  },
  vaultLastSaved: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textMuted,
    marginBottom: isTV ? 20 : 16,
  },
  vaultActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isTV ? 16 : 12,
  },
  vaultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: isTV ? 20 : 16,
    paddingVertical: isTV ? 14 : 10,
    borderRadius: isTV ? 14 : 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    gap: 8,
  },
  vaultButtonPrimary: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  vaultButtonText: {
    fontSize: isTV ? 16 : 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  vaultButtonTextPrimary: {
    fontSize: isTV ? 16 : 14,
    fontWeight: '600',
    color: '#000',
  },
  accountInfo: {
    gap: isTV ? 16 : theme.spacing.sm,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountLabel: {
    fontSize: isTV ? 22 : theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  accountValue: {
    fontSize: isTV ? 22 : theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  settingsCard: {
    backgroundColor: theme.colors.card,
    borderRadius: isTV ? 20 : theme.borderRadius.md,
    padding: isTV ? 28 : theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: isTV ? 20 : theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: isTV ? 22 : theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  settingDescription: {
    fontSize: isTV ? 16 : theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  settingLabelContainer: {
    flex: 1,
    marginRight: isTV ? 16 : 12,
  },
  toggleButton: {
    paddingHorizontal: isTV ? 16 : 12,
    paddingVertical: isTV ? 8 : 6,
    borderRadius: isTV ? 8 : 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: isTV ? 60 : 48,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: '#22C55E',
  },
  toggleText: {
    fontSize: isTV ? 13 : 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  toggleTextActive: {
    color: '#22C55E',
  },
  configureButton: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: isTV ? 24 : theme.spacing.md,
    paddingVertical: isTV ? 12 : theme.spacing.sm,
    borderRadius: isTV ? 12 : theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  configureButtonText: {
    fontSize: isTV ? 18 : theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  parentalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isTV ? 20 : theme.spacing.md,
  },
  parentalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 16 : theme.spacing.sm,
  },
  parentalTitle: {
    fontSize: isTV ? 28 : theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  parentalButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: isTV ? 28 : theme.spacing.md,
    paddingVertical: isTV ? 14 : theme.spacing.sm,
    borderRadius: isTV ? 16 : theme.borderRadius.md,
  },
  parentalButtonEnabled: {
    backgroundColor: theme.colors.success,
  },
  parentalButtonText: {
    fontSize: isTV ? 20 : theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: '#000',
  },
  parentalOptions: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: isTV ? 20 : theme.spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  toggleInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  toggleLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  toggleDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  debugButtonText: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  debugTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  debugSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  supportActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  supportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  supportButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  supportInfo: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoText: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  infoSubtext: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iptvModal: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iptvHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iptvTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  iptvForm: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  iptvInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iptvButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  iptvButtonDisabled: {
    opacity: 0.5,
  },
  iptvButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#000',
  },
  logsModal: {
    width: '95%',
    height: '80%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  logsTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  logsActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  logAction: {
    padding: theme.spacing.sm,
  },
  logsFilter: {
    flexDirection: 'row',
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  filterButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  filterButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  filterButtonTextActive: {
    color: '#000',
    fontWeight: theme.fontWeight.bold,
  },
  logsList: {
    flex: 1,
    padding: theme.spacing.sm,
  },
  emptyLogs: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyLogsText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  logEntry: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  logEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: 4,
  },
  logContext: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    flex: 1,
  },
  logTime: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  logMessage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  parentalModal: {
    width: '90%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  parentalModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  parentalModalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  parentalForm: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  pinInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    textAlign: 'center',
    letterSpacing: 8,
  },
  pinButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  pinButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#000',
  },
  pinButtonSecondary: {
    backgroundColor: theme.colors.error,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  pinButtonSecondaryText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  // Torrentio styles
  torrentioQRSection: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  torrentioSectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  torrentioDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    alignSelf: 'flex-start',
  },
  torrentioQRWrapper: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginVertical: theme.spacing.md,
  },
  torrentioUrl: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    marginTop: theme.spacing.sm,
  },
  torrentioLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
  },
  torrentioLinkButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  torrentioDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  torrentioManualSection: {
    padding: theme.spacing.lg,
  },
  torrentioLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  torrentioProviderButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  torrentioProviderButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  torrentioProviderButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}20`,
  },
  torrentioProviderButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  torrentioProviderButtonTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
  },
  torrentioHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Missing styles for Torrentio card
  accountNotConnected: {
    fontSize: isTV ? 18 : 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  accountActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  accountButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: isTV ? 24 : 16,
    paddingVertical: isTV ? 12 : 8,
    borderRadius: theme.borderRadius.md,
  },
  accountButtonText: {
    fontSize: isTV ? 16 : 14,
    fontWeight: theme.fontWeight.semibold,
    color: '#000',
  },
  logoutButtonText: {
    color: theme.colors.text,
  },
  // VPN / Proxy styles
  vpnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isTV ? 16 : 12,
  },
  vpnTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 12 : 10,
    flex: 1,
  },
  vpnTitleContainer: {
    flex: 1,
  },
  vpnTitle: {
    fontSize: isTV ? 18 : 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  vpnSubtitle: {
    fontSize: isTV ? 13 : 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  vpnCountryLabel: {
    fontSize: isTV ? 14 : 13,
    color: theme.colors.textSecondary,
    marginBottom: isTV ? 12 : 10,
    fontWeight: '600',
  },
  vpnCountryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isTV ? 12 : 10,
    marginBottom: isTV ? 16 : 14,
  },
  vpnCountryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: isTV ? 16 : 14,
    paddingVertical: isTV ? 12 : 10,
    borderRadius: isTV ? 12 : 10,
    gap: isTV ? 10 : 8,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: isTV ? 160 : 140,
  },
  vpnCountryButtonSelected: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.success + '15',
  },
  vpnCountryButtonFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '20',
    transform: [{ scale: 1.05 }],
  },
  vpnCountryFlag: {
    fontSize: isTV ? 24 : 20,
  },
  vpnCountryName: {
    fontSize: isTV ? 14 : 13,
    color: theme.colors.text,
    fontWeight: '500',
    flex: 1,
  },
  vpnCountryNameSelected: {
    color: theme.colors.success,
    fontWeight: '600',
  },
  vpnInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceLight,
    padding: isTV ? 14 : 12,
    borderRadius: 8,
    gap: 10,
  },
  vpnInfoText: {
    fontSize: isTV ? 12 : 11,
    color: theme.colors.textSecondary,
    flex: 1,
    lineHeight: isTV ? 18 : 16,
  },
  speedTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isTV ? 10 : 8,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: isTV ? 10 : 8,
    padding: isTV ? 14 : 12,
    marginTop: isTV ? 16 : 12,
  },
  speedTestText: {
    fontSize: isTV ? 14 : 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  // Scraper Status styles
  scraperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isTV ? 16 : 12,
  },
  scraperTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 12 : 10,
    flex: 1,
  },
  scraperTitleContainer: {
    flex: 1,
  },
  scraperTitle: {
    fontSize: isTV ? 18 : 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  scraperSubtitle: {
    fontSize: isTV ? 13 : 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  scraperCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: isTV ? 16 : 14,
    paddingVertical: isTV ? 10 : 8,
    borderRadius: isTV ? 10 : 8,
    gap: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  scraperCheckButtonDisabled: {
    opacity: 0.6,
  },
  scraperCheckButtonFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '20',
  },
  scraperCheckButtonText: {
    fontSize: isTV ? 14 : 13,
    color: theme.colors.text,
    fontWeight: '600',
  },
  scraperProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: isTV ? 16 : 14,
  },
  scraperProgressBar: {
    flex: 1,
    height: isTV ? 8 : 6,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scraperProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  scraperProgressText: {
    fontSize: isTV ? 13 : 12,
    color: theme.colors.textSecondary,
    minWidth: 50,
    textAlign: 'right',
  },
  scraperList: {
    gap: isTV ? 8 : 6,
  },
  scraperItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: isTV ? 14 : 12,
    paddingVertical: isTV ? 12 : 10,
    borderRadius: isTV ? 10 : 8,
  },
  scraperItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 12 : 10,
  },
  scraperStatusDot: {
    width: isTV ? 12 : 10,
    height: isTV ? 12 : 10,
    borderRadius: isTV ? 6 : 5,
    backgroundColor: theme.colors.textMuted,
  },
  scraperStatusOnline: {
    backgroundColor: theme.colors.success,
  },
  scraperStatusOffline: {
    backgroundColor: theme.colors.error,
  },
  scraperStatusChecking: {
    backgroundColor: theme.colors.warning,
  },
  scraperItemName: {
    fontSize: isTV ? 14 : 13,
    color: theme.colors.text,
    fontWeight: '500',
  },
  scraperItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 12 : 10,
  },
  scraperLatency: {
    fontSize: isTV ? 12 : 11,
    color: theme.colors.textSecondary,
  },
  scraperStatusText: {
    fontSize: isTV ? 12 : 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    minWidth: 50,
    textAlign: 'right',
  },
  scraperStatusTextOnline: {
    color: theme.colors.success,
  },
  scraperStatusTextOffline: {
    color: theme.colors.error,
  },
  scraperEmptyState: {
    alignItems: 'center',
    paddingVertical: isTV ? 24 : 20,
    gap: isTV ? 12 : 10,
  },
  scraperEmptyText: {
    fontSize: isTV ? 13 : 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
