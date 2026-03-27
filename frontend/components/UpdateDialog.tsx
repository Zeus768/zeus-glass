import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import { updateService, UpdateInfo, DownloadProgress } from '../services/updateService';

interface UpdateDialogProps {
  visible: boolean;
  updateInfo: UpdateInfo;
  onDismiss: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({ visible, updateInfo, onDismiss }) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    setDownloading(true);
    setError(null);
    setProgress({ totalBytesWritten: 0, totalBytesExpectedToWrite: 0, percentage: 0 });

    const localUri = await updateService.downloadUpdate(updateInfo, (p) => {
      setProgress(p);
    });

    setDownloading(false);

    if (localUri) {
      setInstalling(true);
      const success = await updateService.installUpdate(localUri);
      setInstalling(false);
      if (!success) {
        setError('Installation failed. Make sure "Install from Unknown Sources" is enabled.');
      }
    } else {
      setError('Download failed. Check your internet connection and try again.');
    }
  };

  const handleCancel = () => {
    if (downloading) {
      updateService.cancelDownload();
    }
    setDownloading(false);
    setProgress(null);
    setError(null);
    onDismiss();
  };

  const currentVersion = updateService.getCurrentVersion();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="download-outline" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>Update Available</Text>
            <Text style={styles.versionInfo}>
              {currentVersion} {'-->'} {updateInfo.version}
            </Text>
          </View>

          {/* Changelog */}
          {updateInfo.changelog && (
            <View style={styles.changelogContainer}>
              <Text style={styles.changelogLabel}>What's New:</Text>
              <Text style={styles.changelogText}>{updateInfo.changelog}</Text>
            </View>
          )}

          {/* Progress */}
          {downloading && progress && (
            <View style={styles.progressSection}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progress.percentage}%` }]} />
              </View>
              <View style={styles.progressInfo}>
                <Text style={styles.progressText}>{progress.percentage}%</Text>
                <Text style={styles.progressSize}>
                  {updateService.formatSize(progress.totalBytesWritten)}
                  {progress.totalBytesExpectedToWrite > 0 && (
                    ` / ${updateService.formatSize(progress.totalBytesExpectedToWrite)}`
                  )}
                </Text>
              </View>
            </View>
          )}

          {/* Installing */}
          {installing && (
            <View style={styles.installingSection}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.installingText}>Opening installer...</Text>
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={styles.errorSection}>
              <Ionicons name="warning-outline" size={18} color="#FF6B6B" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttons}>
            {!updateInfo.forceUpdate && (
              <Pressable
                style={styles.laterButton}
                onPress={handleCancel}
                disabled={installing}
                data-testid="update-later-btn"
              >
                <Text style={styles.laterButtonText}>Later</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.updateButton, (downloading || installing) && styles.updateButtonDisabled]}
              onPress={handleUpdate}
              disabled={downloading || installing}
              data-testid="update-now-btn"
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="cloud-download" size={18} color="#000" />
              )}
              <Text style={styles.updateButtonText}>
                {downloading ? 'Downloading...' : error ? 'Retry' : 'Update Now'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: isTV ? 28 : 24,
    width: '100%',
    maxWidth: isTV ? 500 : 400,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${theme.colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: isTV ? 22 : 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  versionInfo: {
    fontSize: isTV ? 14 : 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  changelogContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  changelogLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  changelogText: {
    fontSize: isTV ? 14 : 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  progressSize: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  installingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  installingText: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  errorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#FF6B6B',
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  laterButton: {
    flex: 1,
    paddingVertical: isTV ? 12 : 14,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
  laterButtonText: {
    fontSize: isTV ? 14 : 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  updateButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: isTV ? 12 : 14,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateButtonText: {
    fontSize: isTV ? 14 : 16,
    fontWeight: '700',
    color: '#000',
  },
});
