import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  // Request permissions
  requestPermissions: async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00D9FF',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  },

  // Check account expiry and send notifications
  checkAccountExpiry: async (
    serviceName: string,
    expiryDate: string,
    daysLeft: number
  ): Promise<void> => {
    // Only notify if 10 days or less
    if (daysLeft <= 10 && daysLeft > 0) {
      await notificationService.sendExpiryWarning(serviceName, daysLeft);
    } else if (daysLeft <= 0) {
      await notificationService.sendExpiredNotification(serviceName);
    }
  },

  // Send expiry warning notification
  sendExpiryWarning: async (serviceName: string, daysLeft: number): Promise<void> => {
    const hasPermission = await notificationService.requestPermissions();
    if (!hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ ${serviceName} Expiring Soon!`,
        body: `Your ${serviceName} account expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Please renew to continue using the service.`,
        data: { serviceName, daysLeft },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Show immediately
    });
  },

  // Send expired notification
  sendExpiredNotification: async (serviceName: string): Promise<void> => {
    const hasPermission = await notificationService.requestPermissions();
    if (!hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `❌ ${serviceName} Expired`,
        body: `Your ${serviceName} account has expired. Please renew to continue streaming.`,
        data: { serviceName, expired: true },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  },

  // Send download complete notification
  sendDownloadComplete: async (title: string, size: string): Promise<void> => {
    const hasPermission = await notificationService.requestPermissions();
    if (!hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Download Complete',
        body: `${title} (${size}) has been downloaded successfully.`,
        data: { type: 'download_complete', title },
        sound: true,
      },
      trigger: null,
    });
  },

  // Send download failed notification
  sendDownloadFailed: async (title: string, error: string): Promise<void> => {
    const hasPermission = await notificationService.requestPermissions();
    if (!hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '❌ Download Failed',
        body: `Failed to download ${title}: ${error}`,
        data: { type: 'download_failed', title },
        sound: true,
      },
      trigger: null,
    });
  },

  // Send recording started notification
  sendRecordingStarted: async (channelName: string): Promise<void> => {
    const hasPermission = await notificationService.requestPermissions();
    if (!hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔴 Recording Started',
        body: `Recording ${channelName}...`,
        data: { type: 'recording_started', channelName },
      },
      trigger: null,
    });
  },

  // Send recording complete notification
  sendRecordingComplete: async (channelName: string, duration: string): Promise<void> => {
    const hasPermission = await notificationService.requestPermissions();
    if (!hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Recording Complete',
        body: `${channelName} (${duration}) saved successfully.`,
        data: { type: 'recording_complete', channelName },
        sound: true,
      },
      trigger: null,
    });
  },
};
