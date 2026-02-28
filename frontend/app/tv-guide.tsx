import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../constants/theme';
import { iptvService } from '../services/iptv';
import { IPTVChannel } from '../types';
import { format } from 'date-fns';

export default function TVGuideScreen() {
  const [channels, setChannels] = useState<IPTVChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    loadChannels();
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

  const categories = ['All', ...new Set(channels.map((c) => c.category))];
  const filteredChannels =
    selectedCategory === 'All'
      ? channels
      : channels.filter((c) => c.category === selectedCategory);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
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
        {filteredChannels.map((channel) => (
          <Pressable key={channel.id} style={styles.channelCard}>
            <View style={styles.channelHeader}>
              {channel.logo && (
                <Image
                  source={{ uri: channel.logo }}
                  style={styles.channelLogo}
                  contentFit="contain"
                />
              )}
              <View style={styles.channelInfo}>
                <Text style={styles.channelName}>{channel.name}</Text>
                <Text style={styles.channelCategory}>{channel.category}</Text>
              </View>
            </View>

            {/* EPG */}
            {channel.epg && channel.epg.length > 0 && (
              <View style={styles.epgContainer}>
                {channel.epg.map((program) => (
                  <View key={program.id} style={styles.programCard}>
                    <View style={styles.programTime}>
                      <Text style={styles.programTimeText}>
                        {format(new Date(program.start), 'HH:mm')}
                      </Text>
                      <Text style={styles.programTimeText}>-</Text>
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
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
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
  categoriesContainer: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoriesContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
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
    color: theme.colors.text,
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
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  channelLogo: {
    width: 60,
    height: 40,
    marginRight: theme.spacing.md,
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  channelCategory: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  epgContainer: {
    gap: theme.spacing.sm,
  },
  programCard: {
    flexDirection: 'row',
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
});
