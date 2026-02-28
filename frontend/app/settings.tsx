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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { QRAuthModal } from '../components/QRAuthModal';
import { useAuthStore } from '../store/authStore';
import { iptvService } from '../services/iptv';
import { errorLogService, LogEntry } from '../services/errorLogService';
import { parentalControlService, ParentalSettings } from '../services/parentalControlService';
import { formatDistanceToNow, format } from 'date-fns';

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
  const [parentalSettings, setParentalSettings] = useState<ParentalSettings | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinMode, setPinMode] = useState<'setup' | 'verify' | 'change'>('setup');

  useEffect(() => {
    // Initialize services
    errorLogService.init();
    parentalControlService.init().then(() => {
      setParentalSettings(parentalControlService.getSettings());
    });
  }, []);

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
  }) => (
    <View style={styles.accountCard}>
      <View style={styles.accountHeader}>
        <View style={styles.accountTitleContainer}>
          <Ionicons name={icon as any} size={24} color={theme.colors.primary} />
          <Text style={styles.accountTitle}>{title}</Text>
        </View>
        {account ? (
          <Pressable onPress={onLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onLogin} style={styles.loginButton}>
            <Text style={styles.loginText}>Login</Text>
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
    padding: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  accountCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  accountTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  loginButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  loginText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#000',
  },
  logoutButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  logoutText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  accountInfo: {
    gap: theme.spacing.sm,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  accountValue: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  settingsCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  parentalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  parentalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  parentalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  parentalButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  parentalButtonEnabled: {
    backgroundColor: theme.colors.success,
  },
  parentalButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: '#000',
  },
  parentalOptions: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
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
});
