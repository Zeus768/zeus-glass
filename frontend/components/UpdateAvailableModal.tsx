import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import { UpdateInfo, updateChecker } from '../services/updateChecker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface UpdateAvailableModalProps {
  visible: boolean;
  info: UpdateInfo | null;
  onClose: () => void;
  /** If true, the "Skip this version" button is shown (auto-launch popup). Hidden when manually triggered from Settings. */
  showSkip?: boolean;
}

export function UpdateAvailableModal({ visible, info, onClose, showSkip = true }: UpdateAvailableModalProps) {
  if (!info) return null;

  const handleDownload = async () => {
    await updateChecker.openDownload(info);
    onClose();
  };

  const handleSkip = async () => {
    if (info.latestVersion) {
      await updateChecker.dismissVersion(info.latestVersion);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="rocket" size={isTV ? 22 : 18} color={theme.colors.primary} />
              <Text style={styles.headerTitle} testID="update-modal-title">
                Update Available
              </Text>
            </View>
            <TouchableOpacity
              focusable
              style={styles.closeButton}
              onPress={onClose}
              testID="update-modal-close-button"
            >
              <Ionicons name="close" size={isTV ? 24 : 20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.versionRow}>
            <View style={styles.versionPill}>
              <Text style={styles.versionPillLabel}>You</Text>
              <Text style={styles.versionPillValue}>v{info.currentVersion}</Text>
            </View>
            <Ionicons name="arrow-forward" size={isTV ? 22 : 18} color={theme.colors.primary} />
            <View style={[styles.versionPill, styles.versionPillNew]}>
              <Text style={[styles.versionPillLabel, { color: '#000' }]}>New</Text>
              <Text style={[styles.versionPillValue, { color: '#000' }]} testID="update-modal-latest-version">
                v{info.latestVersion}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            <Text style={styles.notesHeader}>What's new</Text>
            {info.releaseNotes ? (
              <Text style={styles.notesText}>{info.releaseNotes}</Text>
            ) : (
              <Text style={styles.notesEmpty}>No release notes provided.</Text>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {showSkip && (
              <TouchableOpacity
                focusable
                style={[styles.button, styles.skipButton]}
                onPress={handleSkip}
                testID="update-modal-skip-button"
              >
                <Text style={styles.skipButtonText}>Skip this version</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              focusable
              hasTVPreferredFocus
              style={[styles.button, styles.downloadButton]}
              onPress={handleDownload}
              testID="update-modal-download-button"
            >
              <Ionicons name="download" size={isTV ? 20 : 16} color="#000" />
              <Text style={styles.downloadButtonText}>
                {info.downloadUrl ? 'Download APK' : 'Open Release Page'}
              </Text>
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
    padding: isTV ? 40 : 16,
  },
  dialog: {
    width: isTV ? Math.min(SCREEN_WIDTH * 0.55, 700) : SCREEN_WIDTH - 32,
    maxHeight: SCREEN_HEIGHT * 0.85,
    backgroundColor: theme.colors.card,
    borderRadius: isTV ? 16 : 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: isTV ? 20 : 16,
    paddingVertical: isTV ? 14 : 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: isTV ? 20 : 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeButton: { padding: 4 },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: isTV ? 20 : 16,
    paddingHorizontal: 16,
  },
  versionPill: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    paddingHorizontal: isTV ? 18 : 14,
    paddingVertical: isTV ? 10 : 8,
    alignItems: 'center',
    minWidth: isTV ? 120 : 100,
  },
  versionPillNew: {
    backgroundColor: theme.colors.primary,
  },
  versionPillLabel: {
    fontSize: isTV ? 12 : 11,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  versionPillValue: {
    fontSize: isTV ? 18 : 16,
    color: theme.colors.text,
    fontWeight: '700',
    marginTop: 2,
  },
  content: { flexGrow: 0 },
  contentInner: {
    padding: isTV ? 20 : 16,
    paddingTop: 0,
  },
  notesHeader: {
    fontSize: isTV ? 14 : 13,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  notesText: {
    color: theme.colors.text,
    fontSize: isTV ? 15 : 13,
    lineHeight: isTV ? 22 : 19,
  },
  notesEmpty: {
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: isTV ? 16 : 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: isTV ? 22 : 18,
    paddingVertical: isTV ? 12 : 10,
    borderRadius: 8,
  },
  skipButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skipButtonText: {
    color: theme.colors.textSecondary,
    fontSize: isTV ? 14 : 13,
    fontWeight: '600',
  },
  downloadButton: {
    backgroundColor: theme.colors.primary,
  },
  downloadButtonText: {
    color: '#000',
    fontSize: isTV ? 15 : 13,
    fontWeight: '800',
  },
});

export default UpdateAvailableModal;
