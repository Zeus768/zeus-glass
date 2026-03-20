import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  Pressable, 
  ScrollView,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, isTV } from '../constants/theme';
import { streamScraperService, StreamSource } from '../services/streamScrapers';
import { debridCacheService } from '../services/debrid';
import { CachedTorrent } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SourceProgress {
  name: string;
  status: 'pending' | 'searching' | 'done' | 'error';
  count: number;
  results: StreamSource[];
}

interface SourcesSearchDialogProps {
  visible: boolean;
  onClose: () => void;
  onSelectSource: (source: StreamSource | CachedTorrent) => void;
  title: string;
  tmdbId: string;
  imdbId?: string;
  year?: number;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
}

export function SourcesSearchDialog({
  visible,
  onClose,
  onSelectSource,
  title,
  tmdbId,
  imdbId,
  year,
  type,
  season,
  episode,
}: SourcesSearchDialogProps) {
  const [sources, setSources] = useState<SourceProgress[]>([]);
  const [allResults, setAllResults] = useState<(StreamSource | CachedTorrent)[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'torrent' | 'embed' | 'direct'>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);

  // Initialize sources on open
  useEffect(() => {
    if (visible) {
      startSearch();
    } else {
      // Reset state on close
      setSources([]);
      setAllResults([]);
      setIsSearching(false);
    }
  }, [visible]);

  const startSearch = async () => {
    setIsSearching(true);
    setAllResults([]);
    
    // Initialize all scrapers as pending
    const scraperList = streamScraperService.getScraperList();
    const initialSources: SourceProgress[] = scraperList.map(name => ({
      name,
      status: 'pending',
      count: 0,
      results: [],
    }));
    setSources(initialSources);

    // Progress callback
    const onProgress = (name: string, status: 'searching' | 'done' | 'error', count: number, results?: StreamSource[]) => {
      setSources(prev => prev.map(s => 
        s.name === name ? { ...s, status, count, results: results || [] } : s
      ));
      
      if (status === 'done' && results && results.length > 0) {
        setAllResults(prev => [...prev, ...results]);
      }
    };

    try {
      // Fetch all streams with progress
      await streamScraperService.getAllSourcesWithProgress(
        type,
        tmdbId,
        imdbId,
        title,
        year,
        season,
        episode,
        onProgress
      );

      // Also search debrid cache if we have imdbId
      if (imdbId) {
        try {
          let debridResults: CachedTorrent[] = [];
          if (type === 'movie') {
            debridResults = await debridCacheService.searchCachedMovie(title, year, imdbId);
          } else {
            debridResults = await debridCacheService.searchCachedTV(title, season || 1, episode || 1, imdbId);
          }
          
          if (debridResults.length > 0) {
            // Add debrid results with cached status to all results
            setAllResults(prev => [...prev, ...debridResults]);
          }
        } catch (err) {
          console.log('[SourcesSearch] Debrid cache error:', err);
        }
      }
    } catch (error) {
      console.error('[SourcesSearch] Error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Filter results by type
  const filteredResults = allResults.filter(result => {
    if (activeTab === 'all') return true;
    if ('type' in result) {
      if (activeTab === 'torrent') return result.type === 'torrent' || ('cached' in result);
      if (activeTab === 'embed') return result.type === 'embed';
      if (activeTab === 'direct') return result.type === 'direct';
    } else if ('hash' in result) {
      return activeTab === 'torrent';
    }
    return true;
  });

  // Count completed
  const completedCount = sources.filter(s => s.status === 'done' || s.status === 'error').length;
  const totalCount = sources.length;
  const successCount = sources.filter(s => s.status === 'done' && s.count > 0).length;

  const renderSourceItem = ({ item }: { item: SourceProgress }) => {
    const getStatusIcon = () => {
      switch (item.status) {
        case 'pending': return <Ionicons name="time-outline" size={isTV ? 16 : 14} color={theme.colors.textMuted} />;
        case 'searching': return <ActivityIndicator size="small" color={theme.colors.primary} />;
        case 'done': return item.count > 0 
          ? <Ionicons name="checkmark-circle" size={isTV ? 16 : 14} color={theme.colors.success} />
          : <Ionicons name="close-circle" size={isTV ? 16 : 14} color={theme.colors.textMuted} />;
        case 'error': return <Ionicons name="alert-circle" size={isTV ? 16 : 14} color={theme.colors.error} />;
      }
    };

    return (
      <View style={styles.sourceRow}>
        <View style={styles.sourceStatus}>
          {getStatusIcon()}
        </View>
        <Text style={[styles.sourceName, item.status === 'done' && item.count > 0 && styles.sourceNameSuccess]}>
          {item.name}
        </Text>
        <Text style={styles.sourceCount}>
          {item.status === 'done' ? item.count : item.status === 'searching' ? '...' : '-'}
        </Text>
      </View>
    );
  };

  const renderResultItem = ({ item, index }: { item: StreamSource | CachedTorrent; index: number }) => {
    const isTorrent = 'hash' in item;
    const isCached = isTorrent && item.cached;
    const itemKey = isTorrent ? item.hash : `${item.source}-${index}`;
    const isFocused = focusedItem === itemKey;

    return (
      <Pressable
        style={[styles.resultItem, isFocused && styles.resultItemFocused]}
        onPress={() => onSelectSource(item)}
        onFocus={() => setFocusedItem(itemKey)}
        onBlur={() => setFocusedItem(null)}
        data-testid={`source-result-${index}`}
      >
        <View style={styles.resultLeft}>
          <View style={[styles.qualityBadge, isCached && styles.qualityBadgeCached]}>
            <Text style={styles.qualityText}>{item.quality}</Text>
          </View>
          {isCached && (
            <View style={styles.cachedBadge}>
              <Ionicons name="flash" size={10} color="#000" />
              <Text style={styles.cachedText}>CACHED</Text>
            </View>
          )}
        </View>
        <View style={styles.resultCenter}>
          <Text style={styles.resultTitle} numberOfLines={2}>
            {isTorrent ? item.title : item.name}
          </Text>
          <Text style={styles.resultMeta}>
            {item.source} {item.size ? `• ${item.size}` : ''} {item.seeders ? `• ${item.seeders} seeds` : ''}
          </Text>
        </View>
        <View style={styles.resultRight}>
          <Ionicons 
            name={isTorrent ? 'magnet-outline' : 'play-circle-outline'} 
            size={isTV ? 20 : 18} 
            color={isFocused ? '#000' : theme.colors.primary} 
          />
        </View>
      </Pressable>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Search Sources</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{title}</Text>
            <Pressable style={styles.closeButton} onPress={onClose} data-testid="close-sources-dialog">
              <Ionicons name="close" size={isTV ? 22 : 20} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>
                {isSearching 
                  ? `Searching ${completedCount}/${totalCount} sources...`
                  : `Found ${allResults.length} results from ${successCount} sources`
                }
              </Text>
              <Pressable 
                style={styles.expandButton}
                onPress={() => {}} // Could toggle expanded view
              >
                <Ionicons name="chevron-down" size={16} color={theme.colors.text} />
              </Pressable>
            </View>
            
            {/* Sources Grid */}
            <ScrollView style={styles.sourcesGrid} horizontal showsHorizontalScrollIndicator={false}>
              {sources.map((source, i) => (
                <View key={source.name} style={styles.sourceChip}>
                  {source.status === 'searching' ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : source.status === 'done' && source.count > 0 ? (
                    <Ionicons name="checkmark-circle" size={12} color={theme.colors.success} />
                  ) : source.status === 'error' ? (
                    <Ionicons name="alert-circle" size={12} color={theme.colors.error} />
                  ) : (
                    <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                  )}
                  <Text style={styles.sourceChipText}>{source.name}</Text>
                  {source.count > 0 && <Text style={styles.sourceChipCount}>({source.count})</Text>}
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['all', 'torrent', 'embed', 'direct'] as const).map(tab => (
              <Pressable
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Results List */}
          <FlatList
            data={filteredResults}
            renderItem={renderResultItem}
            keyExtractor={(item, index) => 'hash' in item ? item.hash : `${item.source}-${index}`}
            style={styles.resultsList}
            contentContainerStyle={styles.resultsContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                {isSearching ? (
                  <>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.emptyText}>Searching sources...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="search-outline" size={48} color={theme.colors.textMuted} />
                    <Text style={styles.emptyText}>No results found</Text>
                  </>
                )}
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTV ? 40 : 20,
  },
  dialog: {
    width: isTV ? Math.min(SCREEN_WIDTH * 0.7, 800) : SCREEN_WIDTH - 40,
    maxHeight: isTV ? '85%' : '90%',
    backgroundColor: theme.colors.card,
    borderRadius: isTV ? 16 : 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    backgroundColor: theme.colors.surface,
    padding: isTV ? 16 : 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: isTV ? 18 : 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: isTV ? 13 : 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    position: 'absolute',
    top: isTV ? 14 : 12,
    right: isTV ? 14 : 12,
    padding: 4,
  },
  progressSection: {
    padding: isTV ? 12 : 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceLight,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: isTV ? 13 : 12,
    color: theme.colors.text,
    fontWeight: '600',
  },
  expandButton: {
    padding: 4,
  },
  sourcesGrid: {
    flexDirection: 'row',
    marginTop: 8,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 6,
    gap: 4,
  },
  sourceChipText: {
    fontSize: isTV ? 11 : 10,
    color: theme.colors.text,
  },
  sourceChipCount: {
    fontSize: isTV ? 10 : 9,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sourceStatus: {
    width: 24,
    alignItems: 'center',
  },
  sourceName: {
    flex: 1,
    fontSize: isTV ? 13 : 12,
    color: theme.colors.textSecondary,
  },
  sourceNameSuccess: {
    color: theme.colors.text,
    fontWeight: '500',
  },
  sourceCount: {
    fontSize: isTV ? 12 : 11,
    color: theme.colors.primary,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'right',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: isTV ? 10 : 8,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: isTV ? 13 : 12,
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  resultsList: {
    flex: 1,
  },
  resultsContent: {
    padding: isTV ? 8 : 6,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: isTV ? 10 : 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  resultItemFocused: {
    backgroundColor: theme.colors.primary,
    borderColor: '#fff',
  },
  resultLeft: {
    alignItems: 'center',
    marginRight: isTV ? 10 : 8,
    gap: 4,
  },
  qualityBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qualityBadgeCached: {
    backgroundColor: theme.colors.success,
  },
  qualityText: {
    fontSize: isTV ? 11 : 10,
    fontWeight: '700',
    color: '#000',
  },
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    gap: 2,
  },
  cachedText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#000',
  },
  resultCenter: {
    flex: 1,
  },
  resultTitle: {
    fontSize: isTV ? 13 : 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  resultMeta: {
    fontSize: isTV ? 11 : 10,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  resultRight: {
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: isTV ? 14 : 13,
    color: theme.colors.textMuted,
    marginTop: 12,
  },
});
