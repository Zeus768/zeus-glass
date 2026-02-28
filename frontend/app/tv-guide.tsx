import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format, addMinutes } from 'date-fns';
import { theme } from '../constants/theme';
import { iptvService } from '../services/iptv';
import { recordingService, RecordingCategory } from '../services/recordingService';
import { IPTVChannel, EPGProgram } from '../types';

export default function TVGuideScreen() {
  const router = useRouter();
  const [channels, setChannels] = useState<IPTVChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<IPTVChannel | null>(null);
  const [recordDuration, setRecordDuration] = useState('60');
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [repeatType, setRepeatType] = useState<'once' | 'daily' | 'weekly'>('once');
  const [isScheduling, setIsScheduling] = useState(false);
  const [recordingChannels, setRecordingChannels] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadChannels();
    checkActiveRecordings();
  }, []);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const channelData = await iptvService.getLiveChannels();
      setChannels(channelData);
    } catch (error) {
      console.error('Error loading channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkActiveRecordings = async () => {
    const recordings = await recordingService.getRecordings();
    const activeChannels = new Set(
      recordings.filter(r => r.status === 'recording').map(r => r.channelName)
    );
    setRecordingChannels(activeChannels);
  };

  const handlePlayChannel = (channel: IPTVChannel) => {
    router.push({
      pathname: '/player',
      params: {
        url: channel.stream_url,
        title: channel.name,
        isLive: 'true',
      },
    });
  };

  const handleRecordPress = (channel: IPTVChannel) => {
    setSelectedChannel(channel);
    setRecordDuration('60');
    setScheduleDate(null);
    setRepeatType('once');
    setIsScheduling(false);
    setShowRecordModal(true);
  };

  const handleStartRecording = async () => {
    if (!selectedChannel) return;

    try {
      if (isScheduling && scheduleDate) {
        // Schedule for later
        await recordingService.scheduleRecording(
          selectedChannel.name,
          selectedChannel.id,
          selectedChannel.stream_url,
          scheduleDate,
          parseInt(recordDuration),
          {
            repeatType,
            channelLogo: selectedChannel.logo,
          }
        );
        Alert.alert(
          'Recording Scheduled',
          `Recording of ${selectedChannel.name} scheduled for ${format(scheduleDate, 'EEE, MMM d at HH:mm')}`
        );
      } else {
        // Start immediately
        await recordingService.startRecording(
          selectedChannel.name,
          selectedChannel.id,
          selectedChannel.stream_url,
          parseInt(recordDuration),
          {
            channelLogo: selectedChannel.logo,
          }
        );
        Alert.alert(
          'Recording Started',
          `Now recording ${selectedChannel.name} for ${recordDuration} minutes`
        );
        setRecordingChannels(prev => new Set([...prev, selectedChannel.name]));
      }
      setShowRecordModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start recording');
    }
  };

  const handleStopRecording = async (channel: IPTVChannel) => {
    const recordings = await recordingService.getRecordings();
    const activeRecording = recordings.find(
      r => r.status === 'recording' && r.channelName === channel.name
    );
    
    if (activeRecording) {
      Alert.alert(
        'Stop Recording',
        `Stop recording ${channel.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop',
            style: 'destructive',
            onPress: async () => {
              await recordingService.stopRecording(activeRecording.id);
              setRecordingChannels(prev => {
                const newSet = new Set(prev);
                newSet.delete(channel.name);
                return newSet;
              });
            },
          },
        ]
      );
    }
  };

  const categories = ['All', ...new Set(channels.map((c) => c.category))];
  const filteredChannels =
    selectedCategory === 'All'
      ? channels
      : channels.filter((c) => c.category === selectedCategory);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading TV Guide...</Text>
      </View>
    );
  }

  if (channels.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="tv-outline" size={64} color={theme.colors.textSecondary} />
        <Text style={styles.emptyTitle}>No Channels Available</Text>
        <Text style={styles.emptyText}>
          Please configure your IPTV settings to access live TV channels.
        </Text>
        <Pressable style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={20} color="#000" />
          <Text style={styles.settingsButtonText}>Go to Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((category) => (
          <Pressable
            key={category}
            onPress={() => setSelectedCategory(category)}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.categoryButtonActive,
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextActive,
              ]}
            >
              {category}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Channels List */}
      <ScrollView style={styles.channelsList} showsVerticalScrollIndicator={false}>
        {filteredChannels.map((channel) => {
          const isRecording = recordingChannels.has(channel.name);
          
          return (
            <View key={channel.id} style={[styles.channelCard, isRecording && styles.channelCardRecording]}>
              <Pressable onPress={() => handlePlayChannel(channel)} style={styles.channelPressable}>
                <View style={styles.channelHeader}>
                  {channel.logo ? (
                    <Image
                      source={{ uri: channel.logo }}
                      style={styles.channelLogo}
                      contentFit="contain"
                    />
                  ) : (
                    <View style={styles.channelLogoPlaceholder}>
                      <Ionicons name="tv" size={24} color={theme.colors.primary} />
                    </View>
                  )}
                  <View style={styles.channelInfo}>
                    <View style={styles.channelNameRow}>
                      <Text style={styles.channelName}>{channel.name}</Text>
                      {isRecording && (
                        <View style={styles.recordingBadge}>
                          <View style={styles.recordingDot} />
                          <Text style={styles.recordingText}>REC</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.channelCategory}>{channel.category}</Text>
                  </View>
                  
                  {/* Action Buttons */}
                  <View style={styles.channelActions}>
                    {isRecording ? (
                      <Pressable
                        style={styles.stopRecordButton}
                        onPress={() => handleStopRecording(channel)}
                      >
                        <Ionicons name="stop-circle" size={28} color="#F44336" />
                      </Pressable>
                    ) : (
                      <Pressable
                        style={styles.recordButton}
                        onPress={() => handleRecordPress(channel)}
                      >
                        <Ionicons name="radio-button-on" size={24} color="#F44336" />
                      </Pressable>
                    )}
                    <Pressable
                      style={styles.playButton}
                      onPress={() => handlePlayChannel(channel)}
                    >
                      <Ionicons name="play-circle" size={32} color={theme.colors.primary} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>

              {/* EPG */}
              {channel.epg && channel.epg.length > 0 && (
                <View style={styles.epgContainer}>
                  {channel.epg.map((program) => (
                    <Pressable
                      key={program.id}
                      style={styles.programCard}
                      onPress={() => {
                        setSelectedChannel(channel);
                        setIsScheduling(true);
                        setScheduleDate(new Date(program.start));
                        const durationMs = new Date(program.end).getTime() - new Date(program.start).getTime();
                        setRecordDuration(String(Math.ceil(durationMs / 60000)));
                        setShowRecordModal(true);
                      }}
                    >
                      <View style={styles.programTime}>
                        <Text style={styles.programTimeText}>
                          {format(new Date(program.start), 'HH:mm')}
                        </Text>
                        <Text style={styles.programTimeSeparator}>-</Text>
                        <Text style={styles.programTimeText}>
                          {format(new Date(program.end), 'HH:mm')}
                        </Text>
                      </View>
                      <View style={styles.programInfo}>
                        <Text style={styles.programTitle}>{program.title}</Text>
                        <Text style={styles.programDescription} numberOfLines={2}>
                          {program.description}
                        </Text>
                      </View>
                      <Ionicons name="timer-outline" size={20} color={theme.colors.textSecondary} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Record Modal */}
      <Modal visible={showRecordModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isScheduling ? 'Schedule Recording' : 'Record Now'}
              </Text>
              <Pressable onPress={() => setShowRecordModal(false)}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </Pressable>
            </View>

            {selectedChannel && (
              <View style={styles.channelPreview}>
                {selectedChannel.logo ? (
                  <Image source={{ uri: selectedChannel.logo }} style={styles.previewLogo} contentFit="contain" />
                ) : (
                  <View style={styles.previewLogoPlaceholder}>
                    <Ionicons name="tv" size={20} color={theme.colors.primary} />
                  </View>
                )}
                <Text style={styles.previewName}>{selectedChannel.name}</Text>
              </View>
            )}

            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <Pressable
                style={[styles.modeButton, !isScheduling && styles.modeButtonActive]}
                onPress={() => setIsScheduling(false)}
              >
                <Ionicons name="radio-button-on" size={18} color={!isScheduling ? '#000' : '#F44336'} />
                <Text style={[styles.modeButtonText, !isScheduling && styles.modeButtonTextActive]}>
                  Record Now
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, isScheduling && styles.modeButtonActive]}
                onPress={() => {
                  setIsScheduling(true);
                  if (!scheduleDate) setScheduleDate(new Date());
                }}
              >
                <Ionicons name="calendar" size={18} color={isScheduling ? '#000' : theme.colors.primary} />
                <Text style={[styles.modeButtonText, isScheduling && styles.modeButtonTextActive]}>
                  Schedule
                </Text>
              </Pressable>
            </View>

            {/* Duration */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Duration (minutes)</Text>
              <View style={styles.durationButtons}>
                {['30', '60', '90', '120', '180'].map((dur) => (
                  <Pressable
                    key={dur}
                    style={[styles.durationButton, recordDuration === dur && styles.durationButtonActive]}
                    onPress={() => setRecordDuration(dur)}
                  >
                    <Text style={[styles.durationButtonText, recordDuration === dur && styles.durationButtonTextActive]}>
                      {dur}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.durationInput}
                value={recordDuration}
                onChangeText={setRecordDuration}
                keyboardType="number-pad"
                placeholder="Custom duration"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            {/* Schedule Options */}
            {isScheduling && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Schedule Time</Text>
                  <Text style={styles.scheduleTimeDisplay}>
                    {scheduleDate ? format(scheduleDate, 'EEEE, MMMM d, yyyy • HH:mm') : 'Select time'}
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Repeat</Text>
                  <View style={styles.repeatButtons}>
                    {(['once', 'daily', 'weekly'] as const).map((type) => (
                      <Pressable
                        key={type}
                        style={[styles.repeatButton, repeatType === type && styles.repeatButtonActive]}
                        onPress={() => setRepeatType(type)}
                      >
                        <Ionicons
                          name={type === 'once' ? 'remove' : 'repeat'}
                          size={16}
                          color={repeatType === type ? '#000' : theme.colors.text}
                        />
                        <Text style={[styles.repeatButtonText, repeatType === type && styles.repeatButtonTextActive]}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Actions */}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setShowRecordModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.startButton} onPress={handleStartRecording}>
                <Ionicons name={isScheduling ? 'calendar' : 'radio-button-on'} size={20} color="#fff" />
                <Text style={styles.startButtonText}>
                  {isScheduling ? 'Schedule' : 'Start Recording'}
                </Text>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  settingsButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#000',
  },
  categoriesContainer: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoriesContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    flexDirection: 'row',
  },
  categoryButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    marginRight: theme.spacing.sm,
  },
  categoryButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  categoryText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  categoryTextActive: {
    color: '#000',
    fontWeight: theme.fontWeight.bold,
  },
  channelsList: {
    flex: 1,
  },
  channelCard: {
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  channelCardRecording: {
    borderColor: '#F44336',
    borderWidth: 2,
  },
  channelPressable: {
    padding: theme.spacing.md,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelLogo: {
    width: 60,
    height: 40,
    marginRight: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  channelLogoPlaceholder: {
    width: 60,
    height: 40,
    marginRight: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelInfo: {
    flex: 1,
  },
  channelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  channelName: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  recordingText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: '#fff',
  },
  channelCategory: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  channelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  recordButton: {
    padding: theme.spacing.sm,
  },
  stopRecordButton: {
    padding: theme.spacing.sm,
  },
  playButton: {
    padding: theme.spacing.sm,
  },
  epgContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  programTime: {
    marginRight: theme.spacing.md,
    alignItems: 'center',
  },
  programTimeText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  programTimeSeparator: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  programInfo: {
    flex: 1,
  },
  programTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  programDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  channelPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  previewLogo: {
    width: 50,
    height: 35,
    marginRight: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  previewLogoPlaceholder: {
    width: 50,
    height: 35,
    marginRight: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewName: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: 4,
    marginBottom: theme.spacing.lg,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.sm,
  },
  modeButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  modeButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  modeButtonTextActive: {
    color: '#000',
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  durationButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  durationButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceLight,
    minWidth: 50,
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  durationButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  durationButtonTextActive: {
    color: '#000',
    fontWeight: theme.fontWeight.bold,
  },
  durationInput: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },
  scheduleTimeDisplay: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    backgroundColor: theme.colors.surfaceLight,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  repeatButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  repeatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    gap: theme.spacing.xs,
  },
  repeatButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  repeatButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  repeatButtonTextActive: {
    color: '#000',
    fontWeight: theme.fontWeight.bold,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  startButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F44336',
    gap: theme.spacing.sm,
  },
  startButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#fff',
  },
});
