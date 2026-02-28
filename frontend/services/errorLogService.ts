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
const MAX_LOGS = 500;

// Support contact info
const SUPPORT_EMAIL = 'thealphaddon@gmail.com';
const TELEGRAM_BOT = 'https://t.me/zeusglasssupport'; // User can create this bot

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
