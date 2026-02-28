import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { QRAuthModal } from '../components/QRAuthModal';
import { useAuthStore } from '../store/authStore';
import { iptvService } from '../services/iptv';
import { formatDistanceToNow } from 'date-fns';

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

  const handleQRAuth = (service: ServiceType) => {
    setSelectedService(service);
    setQrModalVisible(true);
  };

  const handleQRSuccess = () => {
    // Reload account data based on service
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
      alert('Please fill in all fields');
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
      }
    } catch (error) {
      console.error('IPTV login error:', error);
      alert('Failed to authenticate. Please check your credentials.');
    } finally {
      setIptvLoading(false);
    }
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
                    { color: account.daysLeft < 30 ? theme.colors.warning : theme.colors.success },
                  ]}
                >
                  {account.daysLeft} days
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

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Accounts Section */}
        <AccountSection title="Accounts">
          {/* Trakt */}
          <AccountCard
            title="Trakt"
            icon="play-circle"
            account={traktUser}
            onLogin={() => handleQRAuth('trakt')}
            onLogout={logoutTrakt}
          />

          {/* Real-Debrid */}
          <AccountCard
            title="Real-Debrid"
            icon="cloud-download"
            account={realDebridAccount}
            onLogin={() => handleQRAuth('real-debrid')}
            onLogout={logoutRealDebrid}
          />

          {/* AllDebrid */}
          <AccountCard
            title="AllDebrid"
            icon="cloud-download"
            account={allDebridAccount}
            onLogin={() => handleQRAuth('alldebrid')}
            onLogout={logoutAllDebrid}
          />

          {/* Premiumize */}
          <AccountCard
            title="Premiumize"
            icon="cloud-download"
            account={premiumizeAccount}
            onLogin={() => handleQRAuth('premiumize')}
            onLogout={logoutPremiumize}
          />

          {/* IPTV */}
          <AccountCard
            title="Premium IPTV"
            icon="tv"
            account={iptvAccount}
            onLogin={() => setIptvModalVisible(true)}
            onLogout={logoutIPTV}
          />
        </AccountSection>

        {/* App Info */}
        <AccountSection title="About">
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>Zeus Glass v1.0.0</Text>
            <Text style={styles.infoSubtext}>Premium Streaming Platform</Text>
          </View>
        </AccountSection>
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
    color: theme.colors.text,
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
    color: theme.colors.text,
  },
});
