import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, isTV } from '../constants/theme';

interface PlayerChoiceProps {
  visible: boolean;
  onClose: () => void;
  streamUrl: string;
  title: string;
  type?: 'live' | 'movie' | 'tv' | 'vod';
}

export const PlayerChoice: React.FC<PlayerChoiceProps> = ({ visible, onClose, streamUrl, title, type = 'movie' }) => {
  const router = useRouter();

  const handleInternalPlayer = () => {
    onClose();
    router.push({
      pathname: '/player',
      params: { url: streamUrl, title, type },
    });
  };

  const handleVLC = () => {
    onClose();
    const vlcUrl = Platform.OS === 'android' 
      ? `vlc://${streamUrl}`
      : `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(streamUrl)}`;
    
    Linking.openURL(vlcUrl).catch(() => {
      Alert.alert('VLC Not Found', 'Please install VLC Player from the Play Store.');
    });
  };

  const handleMXPlayer = () => {
    onClose();
    if (Platform.OS === 'android') {
      Linking.openURL(`intent:${streamUrl}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(title)};end`).catch(() => {
        // Try pro version
        Linking.openURL(`intent:${streamUrl}#Intent;package=com.mxtech.videoplayer.pro;S.title=${encodeURIComponent(title)};end`).catch(() => {
          Alert.alert('MX Player Not Found', 'Please install MX Player from the Play Store.');
        });
      });
    } else {
      Alert.alert('MX Player', 'MX Player is only available on Android.');
    }
  };

  const handleJustPlayer = () => {
    onClose();
    if (Platform.OS === 'android') {
      Linking.openURL(`intent:${streamUrl}#Intent;package=com.brouken.player;S.title=${encodeURIComponent(title)};end`).catch(() => {
        Alert.alert('Just Player Not Found', 'Please install Just Player from the Play Store.');
      });
    }
  };

  const handleSystemDefault = () => {
    onClose();
    Linking.openURL(streamUrl).catch(() => {
      Alert.alert('Error', 'Could not open stream URL.');
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.container}>
          <Text style={styles.header}>Choose Player</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{title}</Text>

          <PlayerOption 
            icon="play-circle" 
            label="Zeus Player (Internal)" 
            sublabel="Built-in player with subtitles"
            onPress={handleInternalPlayer}
            primary
          />
          <PlayerOption 
            icon="logo-android" 
            label="VLC Player" 
            sublabel="Recommended for IPTV"
            onPress={handleVLC}
          />
          <PlayerOption 
            icon="videocam" 
            label="MX Player" 
            sublabel="Popular Android player"
            onPress={handleMXPlayer}
          />
          {Platform.OS === 'android' && (
            <PlayerOption 
              icon="film" 
              label="Just Player" 
              sublabel="Lightweight player"
              onPress={handleJustPlayer}
            />
          )}
          <PlayerOption 
            icon="open" 
            label="System Default" 
            sublabel="Open with default app"
            onPress={handleSystemDefault}
          />

          <Pressable style={styles.cancelButton} onPress={onClose} data-testid="player-choice-cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

const PlayerOption: React.FC<{
  icon: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  primary?: boolean;
}> = ({ icon, label, sublabel, onPress, primary }) => {
  const [isFocused, setIsFocused] = React.useState(false);
  
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={[
        styles.option,
        primary && styles.optionPrimary,
        isFocused && styles.optionFocused,
      ]}
      data-testid={`player-option-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <Ionicons 
        name={icon as any} 
        size={isTV ? 28 : 22} 
        color={isFocused ? '#000' : primary ? theme.colors.primary : theme.colors.text} 
      />
      <View style={styles.optionText}>
        <Text style={[
          styles.optionLabel, 
          isFocused && styles.optionLabelFocused,
          primary && styles.optionLabelPrimary,
        ]}>
          {label}
        </Text>
        {sublabel && (
          <Text style={[styles.optionSublabel, isFocused && styles.optionSublabelFocused]}>
            {sublabel}
          </Text>
        )}
      </View>
      <Ionicons 
        name="chevron-forward" 
        size={isTV ? 22 : 16} 
        color={isFocused ? '#000' : theme.colors.textMuted} 
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: isTV ? 20 : 16,
    padding: isTV ? 28 : 20,
    width: isTV ? 500 : '85%',
    maxWidth: 450,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    fontSize: isTV ? 24 : 20,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: isTV ? 14 : 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: isTV ? 20 : 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: isTV ? 14 : 12,
    paddingHorizontal: isTV ? 16 : 12,
    borderRadius: isTV ? 12 : 10,
    marginBottom: isTV ? 8 : 6,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  optionPrimary: {
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    borderColor: 'rgba(0, 217, 255, 0.3)',
  },
  optionFocused: {
    backgroundColor: theme.colors.primary,
    borderColor: '#fff',
    transform: [{ scale: 1.02 }],
  },
  optionText: {
    flex: 1,
    marginLeft: isTV ? 14 : 10,
  },
  optionLabel: {
    fontSize: isTV ? 18 : 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  optionLabelPrimary: {
    color: theme.colors.primary,
  },
  optionLabelFocused: {
    color: '#000',
  },
  optionSublabel: {
    fontSize: isTV ? 13 : 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  optionSublabelFocused: {
    color: 'rgba(0, 0, 0, 0.6)',
  },
  cancelButton: {
    marginTop: isTV ? 12 : 8,
    paddingVertical: isTV ? 12 : 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  cancelText: {
    fontSize: isTV ? 16 : 14,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
});
