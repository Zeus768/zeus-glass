import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { notificationService } from './notifications';

export interface DownloadTask {
  id: string;
  title: string;
  url: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused';
  downloadedBytes: number;
  totalBytes: number;
  filePath?: string;
  error?: string;
}

export const downloadService = {
  activeDownloads: new Map<string, FileSystem.DownloadResumable>(),
  downloadTasks: new Map<string, DownloadTask>(),

  // Request storage permissions
  requestPermissions: async (): Promise<boolean> => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
  },

  // Start download
  startDownload: async (
    url: string,
    title: string,
    type: 'movie' | 'tv' | 'recording' = 'movie'
  ): Promise<string> => {
    const hasPermission = await downloadService.requestPermissions();
    if (!hasPermission) {
      throw new Error('Storage permission not granted');
    }

    const downloadId = `download_${Date.now()}`;
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${sanitizedTitle}_${downloadId}.mp4`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    // Create download task
    const task: DownloadTask = {
      id: downloadId,
      title,
      url,
      progress: 0,
      status: 'pending',
      downloadedBytes: 0,
      totalBytes: 0,
    };

    downloadService.downloadTasks.set(downloadId, task);

    // Create download resumable
    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      fileUri,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        
        task.progress = progress;
        task.downloadedBytes = downloadProgress.totalBytesWritten;
        task.totalBytes = downloadProgress.totalBytesExpectedToWrite;
        task.status = 'downloading';
        
        downloadService.downloadTasks.set(downloadId, task);
      }
    );

    downloadService.activeDownloads.set(downloadId, downloadResumable);

    try {
      task.status = 'downloading';
      const result = await downloadResumable.downloadAsync();

      if (result) {
        task.status = 'completed';
        task.filePath = result.uri;
        task.progress = 1;

        // Save to media library
        await MediaLibrary.saveToLibraryAsync(result.uri);

        // Send notification
        const size = downloadService.formatBytes(task.totalBytes);
        await notificationService.sendDownloadComplete(title, size);

        downloadService.downloadTasks.set(downloadId, task);
      }

      return downloadId;
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      downloadService.downloadTasks.set(downloadId, task);

      await notificationService.sendDownloadFailed(title, error.message);
      throw error;
    } finally {
      downloadService.activeDownloads.delete(downloadId);
    }
  },

  // Pause download
  pauseDownload: async (downloadId: string): Promise<void> => {
    const downloadResumable = downloadService.activeDownloads.get(downloadId);
    if (downloadResumable) {
      await downloadResumable.pauseAsync();
      const task = downloadService.downloadTasks.get(downloadId);
      if (task) {
        task.status = 'paused';
        downloadService.downloadTasks.set(downloadId, task);
      }
    }
  },

  // Resume download
  resumeDownload: async (downloadId: string): Promise<void> => {
    const downloadResumable = downloadService.activeDownloads.get(downloadId);
    if (downloadResumable) {
      await downloadResumable.resumeAsync();
      const task = downloadService.downloadTasks.get(downloadId);
      if (task) {
        task.status = 'downloading';
        downloadService.downloadTasks.set(downloadId, task);
      }
    }
  },

  // Cancel download
  cancelDownload: async (downloadId: string): Promise<void> => {
    const downloadResumable = downloadService.activeDownloads.get(downloadId);
    if (downloadResumable) {
      await downloadResumable.pauseAsync();
      downloadService.activeDownloads.delete(downloadId);
      
      const task = downloadService.downloadTasks.get(downloadId);
      if (task && task.filePath) {
        await FileSystem.deleteAsync(task.filePath, { idempotent: true });
      }
      
      downloadService.downloadTasks.delete(downloadId);
    }
  },

  // Get download status
  getDownloadStatus: (downloadId: string): DownloadTask | undefined => {
    return downloadService.downloadTasks.get(downloadId);
  },

  // Get all downloads
  getAllDownloads: (): DownloadTask[] => {
    return Array.from(downloadService.downloadTasks.values());
  },

  // Format bytes to readable size
  formatBytes: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  },

  // Record live TV
  startRecording: async (
    channelName: string,
    streamUrl: string,
    durationMinutes: number = 60
  ): Promise<string> => {
    const hasPermission = await downloadService.requestPermissions();
    if (!hasPermission) {
      throw new Error('Storage permission not granted');
    }

    const downloadId = await downloadService.startDownload(
      streamUrl,
      `${channelName}_${new Date().toISOString()}`,
      'recording'
    );

    await notificationService.sendRecordingStarted(channelName);

    // Set timeout to stop recording after duration
    setTimeout(async () => {
      const task = downloadService.getDownloadStatus(downloadId);
      if (task && task.status === 'downloading') {
        await downloadService.pauseDownload(downloadId);
        await notificationService.sendRecordingComplete(
          channelName,
          `${durationMinutes} min`
        );
      }
    }, durationMinutes * 60 * 1000);

    return downloadId;
  },
};
