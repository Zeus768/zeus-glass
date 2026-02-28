import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format, formatDistanceToNow } from 'date-fns';
import { theme } from '../constants/theme';
import {
  recordingService,
  Recording,
  ScheduledRecording,
  RecordingCategory,
} from '../services/recordingService';

// Category icons mapping
const CATEGORY_ICONS: Record<RecordingCategory, string> = {
  Sports: 'football',
  Drama: 'film',
  News: 'newspaper',
  Movies: 'videocam',
  Documentary: 'earth',
  Entertainment: 'tv',
  Kids: 'happy',
  Music: 'musical-notes',
  Other: 'folder',
};

// Category colors
const CATEGORY_COLORS: Record<RecordingCategory, string> = {
  Sports: '#4CAF50',
  Drama: '#E91E63',
  News: '#2196F3',
  Movies: '#FF5722',
  Documentary: '#795548',
  Entertainment: '#9C27B0',
  Kids: '#FFEB3B',
  Music: '#00BCD4',
  Other: '#607D8B',
};

export default function CatchUpScreen() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledRecording[]>([]);
  const [categories, setCategories] = useState<{ category: RecordingCategory; count: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<RecordingCategory | 'all' | 'scheduled'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [allRecordings, allScheduled, categoryData] = await Promise.all([
        recordingService.getRecordings(),
        recordingService.getScheduledRecordings(),
        recordingService.getCategoriesWithRecordings(),
      ]);
      
      setRecordings(allRecordings);
      setScheduled(allScheduled);
      setCategories(categoryData);
    } catch (error) {
      console.error('Error loading catch up data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Initialize scheduled recordings
    recordingService.initScheduledRecordings();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getFilteredRecordings = (): Recording[] => {
    if (selectedCategory === 'all') {
      return recordings.filter(r => r.status === 'completed');
    }
    if (selectedCategory === 'scheduled') {
      return [];
    }
    return recordings.filter(r => r.status === 'completed' && r.category === selectedCategory);
  };

  const handlePlayRecording = (recording: Recording) => {
    router.push({
      pathname: '/player',
      params: {
        url: recording.filePath,
        title: recording.title,
      },
    });
  };

  const handleDeleteRecording = async () => {
    if (selectedRecording) {
      await recordingService.deleteRecording(selectedRecording.id);
      setShowDeleteModal(false);
      setSelectedRecording(null);
      await loadData();
    }
  };

  const handleCancelScheduled = async (scheduleId: string) => {
    Alert.alert(
      'Cancel Recording',
      'Are you sure you want to cancel this scheduled recording?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            await recordingService.cancelScheduledRecording(scheduleId);
            await loadData();
          },
        },
      ]
    );
  };

  const handleToggleScheduled = async (scheduleId: string) => {
    await recordingService.toggleScheduledRecording(scheduleId);
    await loadData();
  };

  const filteredRecordings = getFilteredRecordings();
  const completedCount = recordings.filter(r => r.status === 'completed').length;
  const recordingCount = recordings.filter(r => r.status === 'recording').length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading Catch Up...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
          <Text style={styles.statNumber}>{completedCount}</Text>
          <Text style={styles.statLabel}>Recorded</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="radio-button-on" size={24} color="#F44336" />
          <Text style={styles.statNumber}>{recordingCount}</Text>
          <Text style={styles.statLabel}>Recording</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="time" size={24} color={theme.colors.primary} />
          <Text style={styles.statNumber}>{scheduled.filter(s => s.enabled).length}</Text>
          <Text style={styles.statLabel}>Scheduled</Text>
        </View>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        <Pressable
          onPress={() => setSelectedCategory('all')}
          style={[
            styles.categoryChip,
            selectedCategory === 'all' && styles.categoryChipActive,
          ]}
        >
          <Ionicons name="grid" size={18} color={selectedCategory === 'all' ? '#000' : theme.colors.text} />
          <Text style={[styles.categoryChipText, selectedCategory === 'all' && styles.categoryChipTextActive]}>
            All ({completedCount})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setSelectedCategory('scheduled')}
          style={[
            styles.categoryChip,
            selectedCategory === 'scheduled' && styles.categoryChipActive,
          ]}
        >
          <Ionicons name="calendar" size={18} color={selectedCategory === 'scheduled' ? '#000' : theme.colors.text} />
          <Text style={[styles.categoryChipText, selectedCategory === 'scheduled' && styles.categoryChipTextActive]}>
            Scheduled ({scheduled.length})
          </Text>
        </Pressable>

        {categories.map(({ category, count }) => (
          <Pressable
            key={category}
            onPress={() => setSelectedCategory(category)}
            style={[
              styles.categoryChip,
              selectedCategory === category && { backgroundColor: CATEGORY_COLORS[category] },
            ]}
          >
            <Ionicons
              name={CATEGORY_ICONS[category] as any}
              size={18}
              color={selectedCategory === category ? '#000' : CATEGORY_COLORS[category]}
            />
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextActive,
              ]}
            >
              {category} ({count})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Scheduled Recordings Section */}
        {selectedCategory === 'scheduled' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scheduled Recordings</Text>
            {scheduled.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>No scheduled recordings</Text>
                <Text style={styles.emptySubtext}>Schedule recordings from the TV Guide</Text>
              </View>
            ) : (
              scheduled.map((sched) => (
                <View key={sched.id} style={styles.scheduledCard}>
                  <View style={styles.scheduledHeader}>
                    {sched.channelLogo ? (
                      <Image source={{ uri: sched.channelLogo }} style={styles.channelLogo} contentFit="contain" />
                    ) : (
                      <View style={[styles.channelLogoPlaceholder, { backgroundColor: CATEGORY_COLORS[sched.category || 'Other'] }]}>
                        <Ionicons name={CATEGORY_ICONS[sched.category || 'Other'] as any} size={20} color="#fff" />
                      </View>
                    )}
                    <View style={styles.scheduledInfo}>
                      <Text style={styles.scheduledTitle}>{sched.epgTitle || sched.channelName}</Text>
                      <Text style={styles.scheduledChannel}>{sched.channelName}</Text>
                      <View style={styles.scheduledMeta}>
                        <Ionicons name="time-outline" size={14} color={theme.colors.primary} />
                        <Text style={styles.scheduledTime}>
                          {format(new Date(sched.scheduledTime), 'EEE, MMM d • HH:mm')}
                        </Text>
                        <Text style={styles.scheduledDuration}>• {sched.duration} min</Text>
                      </View>
                    </View>
                    <View style={styles.scheduledActions}>
                      <Pressable
                        onPress={() => handleToggleScheduled(sched.id)}
                        style={[styles.toggleButton, !sched.enabled && styles.toggleButtonDisabled]}
                      >
                        <Ionicons
                          name={sched.enabled ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={sched.enabled ? theme.colors.success : theme.colors.textSecondary}
                        />
                      </Pressable>
                      <Pressable onPress={() => handleCancelScheduled(sched.id)} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={20} color="#F44336" />
                      </Pressable>
                    </View>
                  </View>
                  {sched.repeatType !== 'once' && (
                    <View style={styles.repeatBadge}>
                      <Ionicons name="repeat" size={14} color={theme.colors.primary} />
                      <Text style={styles.repeatText}>
                        Repeats {sched.repeatType}
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* Recordings Grid */}
        {selectedCategory !== 'scheduled' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {selectedCategory === 'all' ? 'All Recordings' : selectedCategory}
            </Text>
            {filteredRecordings.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="videocam-off-outline" size={48} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>No recordings yet</Text>
                <Text style={styles.emptySubtext}>Record live TV from the TV Guide</Text>
              </View>
            ) : (
              <View style={styles.recordingsGrid}>
                {filteredRecordings.map((recording) => (
                  <Pressable
                    key={recording.id}
                    style={styles.recordingCard}
                    onPress={() => handlePlayRecording(recording)}
                    onLongPress={() => {
                      setSelectedRecording(recording);
                      setShowDeleteModal(true);
                    }}
                  >
                    <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[recording.category] }]}>
                      <Ionicons name={CATEGORY_ICONS[recording.category] as any} size={12} color="#fff" />
                      <Text style={styles.categoryBadgeText}>{recording.category}</Text>
                    </View>
                    
                    {recording.channelLogo ? (
                      <Image source={{ uri: recording.channelLogo }} style={styles.recordingThumbnail} contentFit="cover" />
                    ) : (
                      <View style={[styles.recordingThumbnailPlaceholder, { backgroundColor: CATEGORY_COLORS[recording.category] + '40' }]}>
                        <Ionicons name="videocam" size={32} color={CATEGORY_COLORS[recording.category]} />
                      </View>
                    )}
                    
                    <View style={styles.recordingInfo}>
                      <Text style={styles.recordingTitle} numberOfLines={2}>
                        {recording.title}
                      </Text>
                      <Text style={styles.recordingChannel}>{recording.channelName}</Text>
                      <View style={styles.recordingMeta}>
                        <Text style={styles.recordingDate}>
                          {formatDistanceToNow(new Date(recording.createdAt), { addSuffix: true })}
                        </Text>
                        <Text style={styles.recordingSize}>
                          {recordingService.formatFileSize(recording.fileSize)}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.playOverlay}>
                      <Ionicons name="play-circle" size={40} color="#fff" />
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Active Recordings */}
        {recordings.filter(r => r.status === 'recording').length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.recordingIndicator} />
              <Text style={styles.sectionTitle}>Currently Recording</Text>
            </View>
            {recordings
              .filter(r => r.status === 'recording')
              .map((recording) => (
                <View key={recording.id} style={styles.activeRecordingCard}>
                  <View style={styles.activeRecordingInfo}>
                    <Text style={styles.activeRecordingTitle}>{recording.title}</Text>
                    <Text style={styles.activeRecordingChannel}>{recording.channelName}</Text>
                    <Text style={styles.activeRecordingTime}>
                      Started {format(new Date(recording.startTime), 'HH:mm')} • {recording.duration} min
                    </Text>
                  </View>
                  <Pressable
                    style={styles.stopButton}
                    onPress={() => recordingService.stopRecording(recording.id).then(loadData)}
                  >
                    <Ionicons name="stop-circle" size={32} color="#F44336" />
                  </Pressable>
                </View>
              ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Delete Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="trash" size={48} color="#F44336" />
            <Text style={styles.modalTitle}>Delete Recording?</Text>
            <Text style={styles.modalText}>
              "{selectedRecording?.title}" will be permanently deleted.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancelButton} onPress={() => setShowDeleteModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalDeleteButton} onPress={handleDeleteRecording}>
                <Text style={styles.modalDeleteText}>Delete</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.border,
  },
  categoriesContainer: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoriesContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
    flexDirection: 'row',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceLight,
    gap: 6,
    marginRight: theme.spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
  },
  categoryChipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  categoryChipTextActive: {
    color: '#000',
    fontWeight: theme.fontWeight.bold,
  },
  contentContainer: {
    flex: 1,
  },
  section: {
    padding: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F44336',
    marginRight: theme.spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  scheduledCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scheduledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelLogo: {
    width: 50,
    height: 35,
    marginRight: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  channelLogoPlaceholder: {
    width: 50,
    height: 35,
    marginRight: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduledInfo: {
    flex: 1,
  },
  scheduledTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  scheduledChannel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  scheduledMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  scheduledTime: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
  scheduledDuration: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  scheduledActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  toggleButton: {
    padding: 4,
  },
  toggleButtonDisabled: {
    opacity: 0.5,
  },
  deleteButton: {
    padding: 4,
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  repeatText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    textTransform: 'capitalize',
  },
  recordingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  recordingCard: {
    width: '47%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: theme.fontWeight.bold,
  },
  recordingThumbnail: {
    width: '100%',
    height: 100,
  },
  recordingThumbnailPlaceholder: {
    width: '100%',
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInfo: {
    padding: theme.spacing.sm,
  },
  recordingTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  recordingChannel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  recordingMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recordingDate: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  recordingSize: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    opacity: 0,
  },
  activeRecordingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  activeRecordingInfo: {
    flex: 1,
  },
  activeRecordingTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  activeRecordingChannel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  activeRecordingTime: {
    fontSize: theme.fontSize.xs,
    color: '#F44336',
    marginTop: 4,
  },
  stopButton: {
    padding: theme.spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  modalText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  modalDeleteButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F44336',
    alignItems: 'center',
  },
  modalDeleteText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#fff',
  },
});
