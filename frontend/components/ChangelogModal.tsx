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
import { versionService } from '../services/versionService';
import { ChangelogEntry } from '../constants/changelog';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChangelogModalProps {
  visible: boolean;
  onClose: () => void;
  /** If provided, only entries newer than this version are shown. If omitted, all entries are shown. */
  sinceVersion?: string | null;
  /** Modal title override. Defaults to "What's New" if sinceVersion is set, else "Changelog". */
  title?: string;
}

export function ChangelogModal({ visible, onClose, sinceVersion, title }: ChangelogModalProps) {
  const entries: ChangelogEntry[] = sinceVersion !== undefined
    ? versionService.getChangelogSince(sinceVersion ?? null)
    : versionService.getAllChangelog();

  const currentVersion = versionService.getCurrentVersion();
  const headerTitle = title || (sinceVersion !== undefined ? "What's New" : 'Changelog');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="sparkles" size={isTV ? 22 : 18} color={theme.colors.primary} />
              <Text style={styles.headerTitle} testID="changelog-title">
                {headerTitle}
              </Text>
            </View>
            <Text style={styles.headerVersion}>v{currentVersion}</Text>
            <TouchableOpacity
              focusable
              style={styles.closeButton}
              onPress={onClose}
              testID="changelog-close-button"
            >
              <Ionicons name="close" size={isTV ? 24 : 20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            {entries.length === 0 ? (
              <Text style={styles.emptyText}>You're all caught up — no new changes.</Text>
            ) : (
              entries.map((entry) => (
                <View key={entry.version} style={styles.entryBlock} testID={`changelog-entry-${entry.version}`}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryVersion}>v{entry.version}</Text>
                    <Text style={styles.entryDate}>{entry.date}</Text>
                  </View>
                  {entry.highlights.map((h, idx) => (
                    <View key={idx} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{h}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              focusable
              hasTVPreferredFocus
              style={styles.gotItButton}
              onPress={onClose}
              testID="changelog-got-it-button"
            >
              <Text style={styles.gotItButtonText}>Got it</Text>
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
    gap: 12,
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
  headerVersion: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flexGrow: 0,
  },
  contentInner: {
    padding: isTV ? 24 : 16,
    gap: isTV ? 20 : 16,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: isTV ? 16 : 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  entryBlock: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: isTV ? 16 : 14,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  entryVersion: {
    fontSize: isTV ? 16 : 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  entryDate: {
    fontSize: isTV ? 13 : 12,
    color: theme.colors.textSecondary,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 3,
  },
  bulletDot: {
    color: theme.colors.primary,
    fontSize: isTV ? 18 : 16,
    lineHeight: isTV ? 22 : 20,
  },
  bulletText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: isTV ? 15 : 13,
    lineHeight: isTV ? 22 : 19,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: isTV ? 16 : 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  gotItButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: isTV ? 28 : 22,
    paddingVertical: isTV ? 12 : 10,
    borderRadius: 8,
  },
  gotItButtonText: {
    color: '#000',
    fontSize: isTV ? 16 : 14,
    fontWeight: '700',
  },
});

export default ChangelogModal;
