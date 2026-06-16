import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DownloadService } from '@/services';
import { PdfViewer } from '@/components/lesson/PdfViewer';
import type { DownloadItem } from '@/services';
import { Colors } from '@/theme';

export default function DownloadsScreen() {
  const [organized, setOrganized] = useState<Record<string, { courseTitle: string; modules: Record<string, { moduleTitle: string; items: DownloadItem[] }> }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [pdfViewerVisible, setPdfViewerVisible] = useState(false);
  const [activePdfUri, setActivePdfUri] = useState('');

  const loadDownloads = useCallback(async () => {
    setIsLoading(true);
    try {
      await DownloadService.cleanExpired(); // Clean expired first
      const data = await DownloadService.getOrganized();
      setOrganized(data);
      const all = await DownloadService.getAll();
      setTotalItems(all.length);
    } catch {
      setOrganized({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadDownloads(); }, [loadDownloads]));

  const handleRemove = (item: DownloadItem) => {
    Alert.alert('Remove Download', `Remove "${item.lessonTitle}" (${item.type})?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await DownloadService.remove(item.id);
        loadDownloads();
      }},
    ]);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb > 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  const courseIds = Object.keys(organized);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Downloads</Text>
        <Text style={styles.headerCount}>{totalItems}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading downloads...</Text>
          </View>
        ) : courseIds.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📥</Text>
            <Text style={styles.emptyTitle}>No downloads yet</Text>
            <Text style={styles.emptyText}>
              Download lessons from any course for offline access.{'\n'}
              Downloads expire after 30 days.
            </Text>
          </View>
        ) : (
          courseIds.map((courseId) => {
            const course = organized[courseId];
            const moduleKeys = Object.keys(course.modules);

            return (
              <View key={courseId} style={styles.courseSection}>
                {/* Course Header */}
                <View style={styles.courseHeader}>
                  <Text style={styles.courseIcon}>📚</Text>
                  <Text style={styles.courseTitle}>{course.courseTitle}</Text>
                </View>

                {/* Modules */}
                {moduleKeys.map((moduleKey) => {
                  const mod = course.modules[moduleKey];
                  return (
                    <View key={moduleKey} style={styles.moduleSection}>
                      {/* Module Header */}
                      <Text style={styles.moduleTitle}>📁 {mod.moduleTitle}</Text>

                      {/* Items */}
                      {mod.items.map((item) => {
                        const daysLeft = DownloadService.getRemainingDays(item.expiresAt);
                        return (
                          <View key={item.id} style={styles.itemCard}>
                            <TouchableOpacity style={styles.itemLeft} onPress={() => {
                              if (item.type === 'video') {
                                router.push({ pathname: '/offline-player', params: { uri: item.fileUri, title: item.lessonTitle } });
                              } else {
                                setActivePdfUri(item.fileUri);
                                setPdfViewerVisible(true);
                              }
                            }}>
                              <View style={[styles.itemIcon, { backgroundColor: item.type === 'video' ? 'rgba(108,71,255,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                                <Text style={styles.itemIconText}>{item.type === 'video' ? '🎬' : '📄'}</Text>
                              </View>
                              <View style={styles.itemInfo}>
                                <Text style={styles.itemTitle} numberOfLines={1}>{item.lessonTitle}</Text>
                                <View style={styles.itemMeta}>
                                  <Text style={styles.itemType}>{item.type === 'video' ? 'Video' : 'PDF'}</Text>
                                  {item.fileSize ? <Text style={styles.itemSize}>{formatSize(item.fileSize)}</Text> : null}
                                  <Text style={[styles.itemExpiry, daysLeft < 7 && { color: Colors.danger }]}>
                                    {daysLeft}d left
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                            <View style={styles.itemActions}>
                              <TouchableOpacity style={styles.playBtn} onPress={() => {
                                if (item.type === 'video') {
                                  // Play from local file offline
                                  router.push({ pathname: '/offline-player', params: { uri: item.fileUri, title: item.lessonTitle } });
                                } else {
                                  // Open local PDF in WebView
                                  setActivePdfUri(item.fileUri);
                                  setPdfViewerVisible(true);
                                }
                              }}>
                                <Text style={styles.playBtnText}>{item.type === 'video' ? '▶' : '📖'}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item)}>
                                <Text style={styles.removeBtnText}>🗑️</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            );
          })
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* PDF Viewer for offline PDFs */}
      <PdfViewer
        visible={pdfViewerVisible}
        pdfUrl={activePdfUri}
        onClose={() => { setPdfViewerVisible(false); setActivePdfUri(''); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { color: Colors.primary, fontSize: 20, fontWeight: '600', paddingRight: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerCount: { color: Colors.muted, fontSize: 13, fontWeight: '600', backgroundColor: Colors.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  content: { padding: 16 },

  // Loading/Empty
  loadingState: { alignItems: 'center', padding: 60, gap: 12 },
  loadingText: { color: Colors.muted, fontSize: 14 },
  emptyState: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Course
  courseSection: { marginBottom: 24 },
  courseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  courseIcon: { fontSize: 18 },
  courseTitle: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },

  // Module
  moduleSection: { marginLeft: 12, marginBottom: 12 },
  moduleTitle: { color: Colors.purple, fontSize: 12, fontWeight: '600', marginBottom: 8 },

  // Item
  itemCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card2, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  itemIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemIconText: { fontSize: 18 },
  itemInfo: { flex: 1 },
  itemTitle: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  itemMeta: { flexDirection: 'row', gap: 8 },
  itemType: { color: Colors.muted, fontSize: 11 },
  itemSize: { color: Colors.muted, fontSize: 11 },
  itemExpiry: { color: Colors.success, fontSize: 11, fontWeight: '600' },
  itemActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  playBtnText: { fontSize: 14, color: Colors.primary },
  removeBtn: { padding: 8 },
  removeBtnText: { fontSize: 16 },
});
