import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StorageService } from '@/services';
import { Colors } from '@/theme';

const WATCHLIST_KEY = 'ck_watchlist';

interface WatchlistItem {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  savedAt: string;
}

export default function WatchlistScreen() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadWatchlist = useCallback(async () => {
    setIsLoading(true);
    try {
      const stored = await StorageService.getObject<WatchlistItem[]>(WATCHLIST_KEY);
      setItems(stored ?? []);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWatchlist();
    }, [loadWatchlist])
  );

  const removeItem = async (lessonId: string) => {
    const updated = items.filter((item) => item.lessonId !== lessonId);
    setItems(updated);
    await StorageService.setObject(WATCHLIST_KEY, updated);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Watchlist</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading watchlist...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📌</Text>
            <Text style={styles.emptyTitle}>No saved lessons yet</Text>
            <Text style={styles.emptyText}>
              Save a lesson from any course to see it here.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.lessonId} style={styles.itemCard}>
              <TouchableOpacity
                style={styles.itemContent}
                onPress={() => router.push(`/lesson/${item.lessonId}`)}
              >
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.lessonTitle}
                </Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {item.moduleTitle} · {item.courseTitle}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removeItem(item.lessonId)}
              >
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { color: Colors.primary, fontSize: 20, fontWeight: '600', paddingRight: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { padding: 16 },

  // Loading / Empty
  loadingState: { alignItems: 'center', padding: 60, gap: 12 },
  loadingText: { color: Colors.muted, fontSize: 14 },
  emptyState: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: Colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Item Cards
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemContent: { flex: 1 },
  itemTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  itemMeta: { color: Colors.muted, fontSize: 12 },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  removeBtnText: { color: Colors.danger, fontSize: 14, fontWeight: '700' },
});
