import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../constants/theme';
import { iptvService } from '../services/iptv';
import { VODItem } from '../types';
import { Ionicons } from '@expo/vector-icons';

export default function VODScreen() {
  const [vodContent, setVodContent] = useState<VODItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    loadVODContent();
  }, []);

  const loadVODContent = async () => {
    setLoading(true);
    try {
      const content = await iptvService.getVODContent();
      setVodContent(content);
    } catch (error) {
      console.error('Error loading VOD:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...new Set(vodContent.map((item) => item.category))];
  const filteredContent =
    selectedCategory === 'All'
      ? vodContent
      : vodContent.filter((item) => item.category === selectedCategory);

  const renderVODCard = ({ item }: { item: VODItem }) => (
    <Pressable style={styles.vodCard}>
      <View style={styles.posterContainer}>
        <Image
          source={{ uri: item.poster }}
          style={styles.poster}
          contentFit="cover"
        />
        <View style={styles.overlay}>
          <Ionicons name="play-circle" size={48} color={theme.colors.primary} />
        </View>
      </View>
      <Text style={styles.vodTitle} numberOfLines={2}>
        {item.name}
      </Text>
      {item.year && <Text style={styles.vodYear}>{item.year}</Text>}
      {item.duration && (
        <Text style={styles.duration}>
          {Math.floor(item.duration / 60)}h {item.duration % 60}m
        </Text>
      )}
    </Pressable>
  );

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
      <View style={styles.categoriesContainer}>
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
      </View>

      {/* VOD Grid */}
      <FlatList
        data={filteredContent}
        renderItem={renderVODCard}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.vodGrid}
        showsVerticalScrollIndicator={false}
      />
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
  vodGrid: {
    padding: theme.spacing.md,
  },
  vodCard: {
    flex: 1,
    margin: theme.spacing.xs,
    minWidth: 100,
    maxWidth: 150,
  },
  posterContainer: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vodTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: 2,
  },
  vodYear: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  duration: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    marginTop: 2,
  },
});
