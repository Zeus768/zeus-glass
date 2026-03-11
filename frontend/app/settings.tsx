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
  }, []);

  // Zeus Vault functions
  const handleSaveVault = async () => {
    setVaultLoading(true);
    try {
      const success = await zeusVaultService.saveVault();
      if (success) {
        const status = await zeusVaultService.getVaultStatus();
        setVaultStatus(status);
        Alert.alert('Zeus Vault', 'All accounts and settings saved to vault!');
      } else {
        Alert.alert('Error', 'Failed to save vault');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save vault');
    } finally {
      setVaultLoading(false);
    }
  };

  const handleRestoreVault = async () => {
    setVaultLoading(true);
    try {
      const vault = await zeusVaultService.restoreVault();
      if (vault) {
        await zeusVaultService.applyVaultData(vault);
        const status = await zeusVaultService.getVaultStatus();
        setVaultStatus(status);
        Alert.alert('Zeus Vault', 'Vault restored successfully! Please restart the app to apply all changes.');
      } else {
        Alert.alert('Zeus Vault', 'No vault backup found');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore vault');
    } finally {
      setVaultLoading(false);
    }
  };

  const handleExportVault = async () => {
    setVaultLoading(true);
    try {
      const vaultJson = await zeusVaultService.exportVault();
      if (vaultJson) {
        await Share.share({
          message: vaultJson,
          title: 'Zeus Vault Backup',
        });
      }
    } catch (error) {
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

  const handleToggleParentalSetting = async (key: keyof ParentalSettings, value: boolean) => {
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
            <Ionicons name={icon as any} size={isTV ? 32 : 24} color={theme.colors.primary} />
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
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
              >
                {vaultLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="save" size={18} color="#000" />
                    <Text style={styles.vaultButtonTextPrimary}>Save to Vault</Text>
                  </>
                )}
              </Pressable>

              <Pressable 
                style={[styles.vaultButton, focusedElement === 'vault-restore' && styles.buttonFocused]}
                onPress={handleRestoreVault}
                onFocus={() => setFocusedElement('vault-restore')}
                onBlur={() => setFocusedElement(null)}
                disabled={vaultLoading}
              >
                <Ionicons name="cloud-download" size={18} color={theme.colors.text} />
                <Text style={styles.vaultButtonText}>Restore</Text>
              </Pressable>

              <Pressable 
                style={[styles.vaultButton, focusedElement === 'vault-export' && styles.buttonFocused]}
                onPress={handleExportVault}
                onFocus={() => setFocusedElement('vault-export')}
                onBlur={() => setFocusedElement(null)}
                disabled={vaultLoading}
              >
                <Ionicons name="share" size={18} color={theme.colors.text} />
                <Text style={styles.vaultButtonText}>Export</Text>
              </Pressable>

              <Pressable 
                style={[styles.vaultButton, focusedElement === 'vault-modal' && styles.buttonFocused]}
                onPress={() => setVaultModalVisible(true)}
                onFocus={() => setFocusedElement('vault-modal')}
                onBlur={() => setFocusedElement(null)}
              >
                <Ionicons name="settings" size={18} color={theme.colors.text} />
                <Text style={styles.vaultButtonText}>Import</Text>
              </Pressable>
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
            <Text style={styles.infoText}>Zeus Glass v1.0.0</Text>
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
    padding: isTV ? 40 : theme.spacing.md,
  },
  sectionTitle: {
    fontSize: isTV ? 36 : theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: isTV ? 24 : theme.spacing.md,
  },
  accountCard: {
    backgroundColor: theme.colors.card,
    borderRadius: isTV ? 20 : theme.borderRadius.md,
    padding: isTV ? 28 : theme.spacing.md,
    marginBottom: isTV ? 20 : theme.spacing.md,
    borderWidth: isTV ? 3 : 1,
    borderColor: theme.colors.border,
  },
  accountCardFocused: {
    borderColor: '#FFFFFF',
    borderWidth: isTV ? 5 : 3,
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    shadowColor: '#00D9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: isTV ? 30 : 20,
    elevation: 30,
    transform: [{ scale: isTV ? 1.03 : 1.01 }],
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isTV ? 20 : theme.spacing.md,
  },
  accountTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountTitle: {
    fontSize: isTV ? 28 : theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginLeft: isTV ? 16 : theme.spacing.sm,
  },
  loginButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: isTV ? 32 : theme.spacing.lg,
    paddingVertical: isTV ? 16 : theme.spacing.sm,
    borderRadius: isTV ? 16 : theme.borderRadius.md,
    borderWidth: isTV ? 4 : 2,
    borderColor: 'transparent',
  },
  loginText: {
    fontSize: isTV ? 22 : theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#000',
  },
  logoutButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: isTV ? 32 : theme.spacing.lg,
    paddingVertical: isTV ? 16 : theme.spacing.sm,
    borderRadius: isTV ? 16 : theme.borderRadius.md,
    borderWidth: isTV ? 4 : 2,
    borderColor: 'transparent',
  },
  logoutText: {
    fontSize: isTV ? 22 : theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  buttonFocused: {
    borderColor: '#FFFFFF',
    borderWidth: isTV ? 5 : 4,
    transform: [{ scale: isTV ? 1.18 : 1.12 }],
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: isTV ? 30 : 25,
    elevation: 40,
  },
  buttonTextFocused: {
    fontWeight: '900' as const,
  },
  // Zeus Vault styles
  vaultCard: {
    backgroundColor: theme.colors.card,
    borderRadius: isTV ? 20 : theme.borderRadius.md,
    padding: isTV ? 28 : theme.spacing.md,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  vaultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isTV ? 20 : theme.spacing.md,
  },
  vaultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 16 : 12,
  },
  vaultTitleContainer: {
    gap: 2,
  },
  vaultTitle: {
    fontSize: isTV ? 26 : 20,
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
});
