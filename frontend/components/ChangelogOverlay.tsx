import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChangelogOverlayProps {
  visible: boolean;
  version: string;
  changelog: string;
  onClose: () => void;
}

export const ChangelogOverlay: React.FC<ChangelogOverlayProps> = ({ visible, version, changelog, onClose }) => {
  const changelogLines = changelog.split('\n').filter(line => line.trim());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconRow}>
              <View style={styles.iconBadge}>
                <Ionicons name="sparkles" size={isTV ? 28 : 22} color="#00E676" />
              </View>
              <View>
                <Text style={styles.title}>What's New</Text>
                <Text style={styles.versionTag}>v{version}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} data-testid="close-changelog">
              <Ionicons name="close" size={isTV ? 28 : 22} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Changelog Items */}
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {changelogLines.map((line, index) => {
              const cleanLine = line.replace(/^[-*]\s*/, '').trim();
              return (
                <View key={index} style={styles.changeItem}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.changeText}>{cleanLine}</Text>
                </View>
              );
            })}
          </ScrollView>

          {/* Close Button */}
          <Pressable style={styles.gotItBtn} onPress={onClose} data-testid="changelog-got-it">
            <Text style={styles.gotItText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.80)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTV ? 60 : 24,
  },
  dialog: {
    backgroundColor: theme.colors.card,
    borderRadius: isTV ? 18 : 14,
    width: '100%',
    maxWidth: isTV ? 520 : 400,
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderWidth: 1,
    borderColor: '#00E676',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTV ? 24 : 20,
    paddingTop: isTV ? 24 : 20,
    paddingBottom: isTV ? 16 : 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 14 : 12,
  },
  iconBadge: {
    width: isTV ? 48 : 40,
    height: isTV ? 48 : 40,
    borderRadius: isTV ? 24 : 20,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: isTV ? 20 : 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  versionTag: {
    fontSize: isTV ? 13 : 12,
    fontWeight: '600',
    color: '#00E676',
    marginTop: 2,
  },
  closeBtn: {
    width: isTV ? 40 : 34,
    height: isTV ? 40 : 34,
    borderRadius: isTV ? 20 : 17,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    paddingHorizontal: isTV ? 24 : 20,
    paddingVertical: isTV ? 16 : 14,
    maxHeight: SCREEN_HEIGHT * 0.4,
  },
  changeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: isTV ? 14 : 12,
    gap: isTV ? 12 : 10,
  },
  bulletDot: {
    width: isTV ? 8 : 6,
    height: isTV ? 8 : 6,
    borderRadius: isTV ? 4 : 3,
    backgroundColor: '#00E676',
    marginTop: isTV ? 7 : 6,
  },
  changeText: {
    flex: 1,
    fontSize: isTV ? 15 : 14,
    color: theme.colors.text,
    lineHeight: isTV ? 22 : 20,
  },
  gotItBtn: {
    marginHorizontal: isTV ? 24 : 20,
    marginBottom: isTV ? 24 : 20,
    marginTop: isTV ? 8 : 6,
    paddingVertical: isTV ? 14 : 12,
    backgroundColor: '#00E676',
    borderRadius: isTV ? 12 : 10,
    alignItems: 'center',
  },
  gotItText: {
    fontSize: isTV ? 16 : 15,
    fontWeight: '700',
    color: '#000',
  },
});
