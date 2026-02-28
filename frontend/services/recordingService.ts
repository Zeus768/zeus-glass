import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from './notifications';

// Recording metadata interface
export interface Recording {
  id: string;
  title: string;
  channelName: string;
  channelLogo?: string;
  category: RecordingCategory;
  startTime: string;
  endTime?: string;
  duration: number; // in minutes
  filePath: string;
  fileSize: number;
  status: 'scheduled' | 'recording' | 'completed' | 'failed';
  streamUrl: string;
  description?: string;
  epgTitle?: string;
  thumbnail?: string;
  createdAt: string;
}

// Scheduled recording interface
export interface ScheduledRecording {
  id: string;
  channelName: string;
  channelId: string;
  streamUrl: string;
  channelLogo?: string;
  scheduledTime: string; // ISO string
  duration: number; // in minutes
  repeatType: 'once' | 'daily' | 'weekly';
  category?: RecordingCategory;
  epgTitle?: string;
  description?: string;
  enabled: boolean;
}

// Categories for recordings
export type RecordingCategory = 
  | 'Sports'
  | 'Drama'
  | 'News'
  | 'Movies'
  | 'Documentary'
  | 'Entertainment'
  | 'Kids'
  | 'Music'
  | 'Other';

const STORAGE_KEYS = {
  RECORDINGS: '@zeus_glass_recordings',
  SCHEDULED: '@zeus_glass_scheduled_recordings',
};

const RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings/`;

// Category detection based on channel name or EPG data
const detectCategory = (channelName: string, epgTitle?: string): RecordingCategory => {
  const name = (channelName + ' ' + (epgTitle || '')).toLowerCase();
  
  if (name.includes('sport') || name.includes('football') || name.includes('soccer') || 
      name.includes('nba') || name.includes('nfl') || name.includes('espn') ||
      name.includes('sky sports') || name.includes('bt sport') || name.includes('premier league')) {
    return 'Sports';
  }
  if (name.includes('movie') || name.includes('cinema') || name.includes('film') ||
      name.includes('hbo') || name.includes('showtime')) {
    return 'Movies';
  }
  if (name.includes('news') || name.includes('cnn') || name.includes('bbc news') ||
      name.includes('fox news') || name.includes('sky news')) {
    return 'News';
  }
  if (name.includes('drama') || name.includes('series') || name.includes('netflix')) {
    return 'Drama';
  }
  if (name.includes('discovery') || name.includes('nat geo') || name.includes('documentary') ||
      name.includes('history')) {
    return 'Documentary';
  }
  if (name.includes('nick') || name.includes('cartoon') || name.includes('disney') ||
      name.includes('kids') || name.includes('baby')) {
    return 'Kids';
  }
  if (name.includes('mtv') || name.includes('vh1') || name.includes('music')) {
    return 'Music';
  }
  if (name.includes('comedy') || name.includes('entertainment') || name.includes('e!')) {
    return 'Entertainment';
  }
  
  return 'Other';
};

export const recordingService = {
  // Active recording handles
  activeRecordings: new Map<string, { downloadResumable: FileSystem.DownloadResumable; timeout?: NodeJS.Timeout }>(),
  scheduledTimers: new Map<string, NodeJS.Timeout>(),

  // Initialize recordings directory
  init: async (): Promise<void> => {
    const dirInfo = await FileSystem.getInfoAsync(RECORDINGS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
    }
  },

  // Get all recordings
  getRecordings: async (): Promise<Recording[]> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RECORDINGS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading recordings:', error);
      return [];
    }
  },

  // Save recordings
  saveRecordings: async (recordings: Recording[]): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEYS.RECORDINGS, JSON.stringify(recordings));
  },

  // Get recordings by category
  getRecordingsByCategory: async (category: RecordingCategory): Promise<Recording[]> => {
    const recordings = await recordingService.getRecordings();
    return recordings.filter(r => r.category === category && r.status === 'completed');
  },

  // Get all categories with recordings
  getCategoriesWithRecordings: async (): Promise<{ category: RecordingCategory; count: number }[]> => {
    const recordings = await recordingService.getRecordings();
    const completed = recordings.filter(r => r.status === 'completed');
    
    const categoryMap = new Map<RecordingCategory, number>();
    completed.forEach(r => {
      categoryMap.set(r.category, (categoryMap.get(r.category) || 0) + 1);
    });

    return Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  },

  // Start recording a live stream
  startRecording: async (
    channelName: string,
    channelId: string,
    streamUrl: string,
    durationMinutes: number = 60,
    options?: {
      channelLogo?: string;
      epgTitle?: string;
      description?: string;
      category?: RecordingCategory;
    }
  ): Promise<string> => {
    await recordingService.init();

    const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sanitizedName = channelName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${sanitizedName}_${timestamp}.ts`;
    const filePath = `${RECORDINGS_DIR}${fileName}`;

    // Detect category
    const category = options?.category || detectCategory(channelName, options?.epgTitle);

    // Create recording entry
    const recording: Recording = {
      id: recordingId,
      title: options?.epgTitle || channelName,
      channelName,
      channelLogo: options?.channelLogo,
      category,
      startTime: new Date().toISOString(),
      duration: durationMinutes,
      filePath,
      fileSize: 0,
      status: 'recording',
      streamUrl,
      description: options?.description,
      epgTitle: options?.epgTitle,
      createdAt: new Date().toISOString(),
    };

    // Save initial recording entry
    const recordings = await recordingService.getRecordings();
    recordings.push(recording);
    await recordingService.saveRecordings(recordings);

    // Create download resumable for streaming
    const downloadResumable = FileSystem.createDownloadResumable(
      streamUrl,
      filePath,
      {},
      (progress) => {
        // Update file size periodically
        recording.fileSize = progress.totalBytesWritten;
      }
    );

    // Start the download
    try {
      await notificationService.sendRecordingStarted(channelName);

      // Set timeout to stop recording after duration
      const timeout = setTimeout(async () => {
        await recordingService.stopRecording(recordingId);
      }, durationMinutes * 60 * 1000);

      // Store handles
      recordingService.activeRecordings.set(recordingId, { downloadResumable, timeout });

      // Start recording (non-blocking)
      downloadResumable.downloadAsync().then(async (result) => {
        if (result) {
          await recordingService.completeRecording(recordingId, result.uri);
        }
      }).catch(async (error) => {
        console.error('Recording error:', error);
        await recordingService.failRecording(recordingId, error.message);
      });

      return recordingId;
    } catch (error: any) {
      await recordingService.failRecording(recordingId, error.message);
      throw error;
    }
  },

  // Stop an active recording
  stopRecording: async (recordingId: string): Promise<void> => {
    const handle = recordingService.activeRecordings.get(recordingId);
    if (handle) {
      if (handle.timeout) {
        clearTimeout(handle.timeout);
      }
      await handle.downloadResumable.pauseAsync();
      recordingService.activeRecordings.delete(recordingId);

      // Get file info and complete
      const recordings = await recordingService.getRecordings();
      const recording = recordings.find(r => r.id === recordingId);
      if (recording) {
        const fileInfo = await FileSystem.getInfoAsync(recording.filePath);
        if (fileInfo.exists && 'size' in fileInfo) {
          await recordingService.completeRecording(recordingId, recording.filePath, fileInfo.size);
        }
      }
    }
  },

  // Mark recording as complete
  completeRecording: async (recordingId: string, filePath: string, fileSize?: number): Promise<void> => {
    const recordings = await recordingService.getRecordings();
    const index = recordings.findIndex(r => r.id === recordingId);
    
    if (index !== -1) {
      recordings[index].status = 'completed';
      recordings[index].endTime = new Date().toISOString();
      recordings[index].filePath = filePath;
      if (fileSize) {
        recordings[index].fileSize = fileSize;
      }
      await recordingService.saveRecordings(recordings);

      const duration = Math.round(
        (new Date(recordings[index].endTime!).getTime() - new Date(recordings[index].startTime).getTime()) / 60000
      );
      await notificationService.sendRecordingComplete(recordings[index].channelName, `${duration} min`);
    }

    recordingService.activeRecordings.delete(recordingId);
  },

  // Mark recording as failed
  failRecording: async (recordingId: string, error: string): Promise<void> => {
    const recordings = await recordingService.getRecordings();
    const index = recordings.findIndex(r => r.id === recordingId);
    
    if (index !== -1) {
      recordings[index].status = 'failed';
      recordings[index].endTime = new Date().toISOString();
      await recordingService.saveRecordings(recordings);
    }

    recordingService.activeRecordings.delete(recordingId);
  },

  // Delete a recording
  deleteRecording: async (recordingId: string): Promise<void> => {
    const recordings = await recordingService.getRecordings();
    const recording = recordings.find(r => r.id === recordingId);
    
    if (recording) {
      // Delete file
      try {
        await FileSystem.deleteAsync(recording.filePath, { idempotent: true });
      } catch (e) {
        console.error('Error deleting file:', e);
      }
      
      // Remove from list
      const filtered = recordings.filter(r => r.id !== recordingId);
      await recordingService.saveRecordings(filtered);
    }
  },

  // ==========================================
  // SCHEDULED RECORDINGS
  // ==========================================

  // Get all scheduled recordings
  getScheduledRecordings: async (): Promise<ScheduledRecording[]> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading scheduled recordings:', error);
      return [];
    }
  },

  // Save scheduled recordings
  saveScheduledRecordings: async (scheduled: ScheduledRecording[]): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED, JSON.stringify(scheduled));
  },

  // Schedule a new recording
  scheduleRecording: async (
    channelName: string,
    channelId: string,
    streamUrl: string,
    scheduledTime: Date,
    durationMinutes: number,
    options?: {
      repeatType?: 'once' | 'daily' | 'weekly';
      channelLogo?: string;
      epgTitle?: string;
      description?: string;
      category?: RecordingCategory;
    }
  ): Promise<string> => {
    const scheduleId = `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const scheduled: ScheduledRecording = {
      id: scheduleId,
      channelName,
      channelId,
      streamUrl,
      channelLogo: options?.channelLogo,
      scheduledTime: scheduledTime.toISOString(),
      duration: durationMinutes,
      repeatType: options?.repeatType || 'once',
      category: options?.category || detectCategory(channelName, options?.epgTitle),
      epgTitle: options?.epgTitle,
      description: options?.description,
      enabled: true,
    };

    const schedules = await recordingService.getScheduledRecordings();
    schedules.push(scheduled);
    await recordingService.saveScheduledRecordings(schedules);

    // Set up the timer
    await recordingService.setupScheduleTimer(scheduled);

    return scheduleId;
  },

  // Set up timer for a scheduled recording
  setupScheduleTimer: async (scheduled: ScheduledRecording): Promise<void> => {
    const scheduledDate = new Date(scheduled.scheduledTime);
    const now = new Date();
    const delay = scheduledDate.getTime() - now.getTime();

    if (delay <= 0) {
      // Time has passed, start immediately if within 5 minutes
      if (delay > -5 * 60 * 1000) {
        await recordingService.startRecording(
          scheduled.channelName,
          scheduled.channelId,
          scheduled.streamUrl,
          scheduled.duration,
          {
            channelLogo: scheduled.channelLogo,
            epgTitle: scheduled.epgTitle,
            description: scheduled.description,
            category: scheduled.category,
          }
        );
      }
      return;
    }

    // Set timeout
    const timer = setTimeout(async () => {
      const schedules = await recordingService.getScheduledRecordings();
      const current = schedules.find(s => s.id === scheduled.id);
      
      if (current && current.enabled) {
        await recordingService.startRecording(
          current.channelName,
          current.channelId,
          current.streamUrl,
          current.duration,
          {
            channelLogo: current.channelLogo,
            epgTitle: current.epgTitle,
            description: current.description,
            category: current.category,
          }
        );

        // Handle repeat
        if (current.repeatType !== 'once') {
          const nextTime = new Date(current.scheduledTime);
          if (current.repeatType === 'daily') {
            nextTime.setDate(nextTime.getDate() + 1);
          } else if (current.repeatType === 'weekly') {
            nextTime.setDate(nextTime.getDate() + 7);
          }
          
          // Update schedule
          const updatedSchedules = schedules.map(s => 
            s.id === scheduled.id ? { ...s, scheduledTime: nextTime.toISOString() } : s
          );
          await recordingService.saveScheduledRecordings(updatedSchedules);
          
          // Set up next timer
          await recordingService.setupScheduleTimer({ ...current, scheduledTime: nextTime.toISOString() });
        } else {
          // Remove one-time schedule
          const filtered = schedules.filter(s => s.id !== scheduled.id);
          await recordingService.saveScheduledRecordings(filtered);
        }
      }
      
      recordingService.scheduledTimers.delete(scheduled.id);
    }, delay);

    recordingService.scheduledTimers.set(scheduled.id, timer);
  },

  // Cancel a scheduled recording
  cancelScheduledRecording: async (scheduleId: string): Promise<void> => {
    const timer = recordingService.scheduledTimers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      recordingService.scheduledTimers.delete(scheduleId);
    }

    const schedules = await recordingService.getScheduledRecordings();
    const filtered = schedules.filter(s => s.id !== scheduleId);
    await recordingService.saveScheduledRecordings(filtered);
  },

  // Toggle scheduled recording enabled/disabled
  toggleScheduledRecording: async (scheduleId: string): Promise<void> => {
    const schedules = await recordingService.getScheduledRecordings();
    const updated = schedules.map(s => {
      if (s.id === scheduleId) {
        return { ...s, enabled: !s.enabled };
      }
      return s;
    });
    await recordingService.saveScheduledRecordings(updated);

    const schedule = updated.find(s => s.id === scheduleId);
    if (schedule) {
      if (schedule.enabled) {
        await recordingService.setupScheduleTimer(schedule);
      } else {
        const timer = recordingService.scheduledTimers.get(scheduleId);
        if (timer) {
          clearTimeout(timer);
          recordingService.scheduledTimers.delete(scheduleId);
        }
      }
    }
  },

  // Initialize all scheduled recordings on app start
  initScheduledRecordings: async (): Promise<void> => {
    const schedules = await recordingService.getScheduledRecordings();
    for (const schedule of schedules) {
      if (schedule.enabled) {
        await recordingService.setupScheduleTimer(schedule);
      }
    }
  },

  // Format file size
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  },

  // Format duration
  formatDuration: (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  },
};
