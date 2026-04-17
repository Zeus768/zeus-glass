import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as MailComposer from 'expo-mail-composer';
import { Platform } from 'react-native';

// Error log entry interface
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: string;
  stack?: string;
  deviceInfo?: {
    platform: string;
    version: string;
  };
}

const STORAGE_KEY = '@zeus_glass_error_logs';
const DEVICE_ID_KEY = '@zeus_glass_device_id';
const MAX_LOGS = 500;

// Support contact info
const SUPPORT_EMAIL = 'thealphaddon@gmail.com';
const TELEGRAM_BOT = 'https://t.me/zeusglasssupport';

// Get backend URL
const getBackendUrl = (): string => {
  return process.env.EXPO_PUBLIC_BACKEND_URL || '';
};

// Generate or retrieve a persistent device ID
const getDeviceId = async (): Promise<string> => {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return `device_${Date.now()}`;
  }
};

const getDeviceName = (): string => {
  if (Platform.isTV) {
    return Platform.OS === 'android' ? 'Android TV / Fire TV' : 'TV Device';
  }
  return Platform.OS === 'android' ? 'Android Phone' : Platform.OS === 'ios' ? 'iPhone' : 'Web Browser';
};

export const errorLogService = {
  logs: [] as LogEntry[],

  // Initialize and load existing logs
  init: async (): Promise<void> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        errorLogService.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    }

    // Auto-upload errors to cloud on startup (silent, non-blocking)
    errorLogService.autoUploadOnStartup();
  },

  // Silently upload any error logs to cloud on app startup
  autoUploadOnStartup: async (): Promise<void> => {
    try {
      const errors = errorLogService.getErrors();
      if (errors.length === 0) return;

      const lastAutoUpload = await AsyncStorage.getItem('@zeus_last_auto_upload');
      const now = Date.now();

      // Throttle: only auto-upload once per 5 minutes to avoid spam
      if (lastAutoUpload && now - parseInt(lastAutoUpload) < 5 * 60 * 1000) return;

      const result = await errorLogService.uploadToCloud(true);
      if (result.success) {
        await AsyncStorage.setItem('@zeus_last_auto_upload', now.toString());
        console.log(`[ErrorLog] Auto-uploaded ${errors.length} errors to cloud`);
      }
    } catch (e) {
      // Silent fail - don't disrupt app startup
      console.log('[ErrorLog] Auto-upload skipped:', e);
    }
  },

  // Add a log entry
  log: async (
    level: LogEntry['level'],
    message: string,
    context?: string,
    error?: Error
  ): Promise<void> => {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      stack: error?.stack,
      deviceInfo: {
        platform: Platform.OS,
        version: Platform.Version?.toString() || 'unknown',
      },
    };

    // Add to beginning of array
    errorLogService.logs.unshift(entry);

    // Keep only last MAX_LOGS
    if (errorLogService.logs.length > MAX_LOGS) {
      errorLogService.logs = errorLogService.logs.slice(0, MAX_LOGS);
    }

    // Persist to storage
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(errorLogService.logs));
    } catch (e) {
      console.error('Error saving logs:', e);
    }

    // Also log to console in dev
    if (__DEV__) {
      const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      logFn(`[${level.toUpperCase()}] ${context ? `[${context}] ` : ''}${message}`);
    }
  },

  // Convenience methods
  info: (message: string, context?: string) => errorLogService.log('info', message, context),
  warn: (message: string, context?: string) => errorLogService.log('warn', message, context),
  error: (message: string, context?: string, error?: Error) => errorLogService.log('error', message, context, error),
  debug: (message: string, context?: string) => errorLogService.log('debug', message, context),

  // Get all logs
  getLogs: (): LogEntry[] => {
    return errorLogService.logs;
  },

  // Get logs filtered by level
  getLogsByLevel: (level: LogEntry['level']): LogEntry[] => {
    return errorLogService.logs.filter(log => log.level === level);
  },

  // Get error logs only
  getErrors: (): LogEntry[] => {
    return errorLogService.logs.filter(log => log.level === 'error');
  },

  // Clear all logs
  clearLogs: async (): Promise<void> => {
    errorLogService.logs = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
  },

  // Format logs for sending
  formatLogsForExport: (logs?: LogEntry[]): string => {
    const logsToExport = logs || errorLogService.logs;
    
    let output = '=== Zeus Glass Error Report ===\n';
    output += `Generated: ${new Date().toISOString()}\n`;
    output += `Platform: ${Platform.OS} ${Platform.Version}\n`;
    output += `Total Entries: ${logsToExport.length}\n`;
    output += '\n=== Logs ===\n\n';

    logsToExport.forEach((log, index) => {
      output += `--- Entry ${index + 1} ---\n`;
      output += `Time: ${log.timestamp}\n`;
      output += `Level: ${log.level.toUpperCase()}\n`;
      output += `Context: ${log.context || 'N/A'}\n`;
      output += `Message: ${log.message}\n`;
      if (log.stack) {
        output += `Stack:\n${log.stack}\n`;
      }
      output += '\n';
    });

    return output;
  },

  // Send logs via email
  sendLogsViaEmail: async (errorsOnly: boolean = false): Promise<boolean> => {
    try {
      const isAvailable = await MailComposer.isAvailableAsync();
      
      if (!isAvailable) {
        // Fallback to mailto link
        const logs = errorsOnly ? errorLogService.getErrors() : errorLogService.logs;
        const body = errorLogService.formatLogsForExport(logs.slice(0, 50)); // Limit for email
        const subject = `Zeus Glass ${errorsOnly ? 'Error' : 'Debug'} Report - ${new Date().toLocaleDateString()}`;
        
        const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        await Linking.openURL(mailtoUrl);
        return true;
      }

      const logs = errorsOnly ? errorLogService.getErrors() : errorLogService.logs;
      const body = errorLogService.formatLogsForExport(logs.slice(0, 100));

      const result = await MailComposer.composeAsync({
        recipients: [SUPPORT_EMAIL],
        subject: `Zeus Glass ${errorsOnly ? 'Error' : 'Debug'} Report - ${new Date().toLocaleDateString()}`,
        body: body,
        isHtml: false,
      });

      return result.status === MailComposer.MailComposerStatus.SENT;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  },

  // Send logs via Telegram
  sendLogsViaTelegram: async (errorsOnly: boolean = false): Promise<void> => {
    try {
      const logs = errorsOnly ? errorLogService.getErrors() : errorLogService.logs;
      const recentLogs = logs.slice(0, 20); // Limit for Telegram
      
      // Create a summary message
      let message = '🔴 Zeus Glass Error Report\n\n';
      message += `📅 ${new Date().toLocaleString()}\n`;
      message += `📱 ${Platform.OS} ${Platform.Version}\n`;
      message += `📊 Total errors: ${errorLogService.getErrors().length}\n\n`;
      
      recentLogs.forEach((log, index) => {
        const emoji = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : 'ℹ️';
        message += `${emoji} ${log.context || 'App'}: ${log.message.substring(0, 100)}\n`;
      });

      // Open Telegram with the message
      // For now, just open Telegram - in production you'd use a bot
      const telegramUrl = `tg://msg?text=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(telegramUrl);
      
      if (canOpen) {
        await Linking.openURL(telegramUrl);
      } else {
        // Fallback to web Telegram share
        const webUrl = `https://t.me/share/url?url=${encodeURIComponent('Zeus Glass Report')}&text=${encodeURIComponent(message)}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Error opening Telegram:', error);
    }
  },

  // Copy logs to clipboard (for manual sharing)
  getLogsAsText: (errorsOnly: boolean = false): string => {
    const logs = errorsOnly ? errorLogService.getErrors() : errorLogService.logs;
    return errorLogService.formatLogsForExport(logs);
  },

  // Upload logs to cloud backend (works on ALL devices including Fire TV)
  uploadToCloud: async (errorsOnly: boolean = false): Promise<{ success: boolean; message: string }> => {
    try {
      const backendUrl = getBackendUrl();
      if (!backendUrl) {
        return { success: false, message: 'Backend URL not configured' };
      }

      const deviceId = await getDeviceId();
      const logs = errorsOnly ? errorLogService.getErrors() : errorLogService.logs;
      
      if (logs.length === 0) {
        return { success: false, message: 'No logs to upload' };
      }

      const response = await fetch(`${backendUrl}/api/logs/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          device_name: getDeviceName(),
          platform: `${Platform.OS}${Platform.isTV ? '-tv' : ''} ${Platform.Version || ''}`.trim(),
          app_version: '1.5.0',
          logs: logs.slice(0, 200), // Cap at 200 entries per upload
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        return { success: true, message: `Uploaded ${data.log_count} logs to cloud` };
      } else {
        return { success: false, message: data.detail || 'Upload failed' };
      }
    } catch (error: any) {
      console.error('[ErrorLog] Cloud upload error:', error);
      return { success: false, message: error.message || 'Network error' };
    }
  },
};

// Global error handler wrapper
export const withErrorLogging = <T extends (...args: any[]) => any>(
  fn: T,
  context: string
): T => {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((error: Error) => {
          errorLogService.error(error.message, context, error);
          throw error;
        });
      }
      return result;
    } catch (error: any) {
      errorLogService.error(error.message, context, error);
      throw error;
    }
  }) as T;
};
