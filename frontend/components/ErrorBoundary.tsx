import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="warning" size={isTV ? 80 : 50} color={theme.colors.error} />
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              The app encountered an unexpected error. Please try again.
            </Text>
            
            {__DEV__ && this.state.error && (
              <ScrollView style={styles.errorDetails} horizontal={false}>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text style={styles.stackTrace}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            )}
            
            <Pressable style={styles.retryButton} onPress={this.handleRetry}>
              <Ionicons name="refresh" size={isTV ? 28 : 20} color="#000" />
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTV ? 60 : 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 500,
  },
  iconContainer: {
    marginBottom: isTV ? 30 : 20,
  },
  title: {
    fontSize: isTV ? 36 : 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: isTV ? 16 : 10,
    textAlign: 'center',
  },
  message: {
    fontSize: isTV ? 20 : 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: isTV ? 30 : 20,
    lineHeight: isTV ? 28 : 22,
  },
  errorDetails: {
    maxHeight: 200,
    marginBottom: 20,
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    width: '100%',
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.error,
    fontFamily: 'monospace',
  },
  stackTrace: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: isTV ? 18 : 14,
    paddingHorizontal: isTV ? 40 : 28,
    borderRadius: isTV ? 16 : 12,
    gap: isTV ? 12 : 8,
  },
  retryText: {
    fontSize: isTV ? 22 : 16,
    fontWeight: '700',
    color: '#000',
  },
});

export default ErrorBoundary;
