import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getWatchlist, setWatchlist, type WatchlistItem } from '@/utils/watchlist.util';
import { Colors } from '@/theme';

// Subject thumbnail per course title (real desktop images; emoji fallback).
// Shared visual logic identical to the Courses / Profile screens.
let wImgC: any = null, wImgJava: any = null, wImgPython: any = null, wImgAI: any = null;
try { wImgC = require('../assets/courses/c.jpeg'); } catch {}
try { wImgJava = require('../assets/courses/java.jpeg'); } catch {}
try { wImgPython = require('../assets/courses/python.jpeg'); } catch {}
try { wImgAI = require('../assets/logos/ai.png'); } catch {}
function courseThumb(title: string): { img: any; icon: string } {
  const t = (title || '').toLowerCase().trim();
  if (t.includes('python')) return { img: wImgPython, icon: '🐍' };
  if (t.includes('java') && !t.includes('javascript')) return { img: wImgJava, icon: '☕' };
  if (t.includes('ai') || t.includes('intelligence')) return { img: wImgAI, icon: '🧠' };
  if (t === 'c' || t.startsWith('c ') || t.includes('c programming')) return { img: wImgC, icon: 'C' };
  if (t.includes('web') || t.includes('html')) return { img: null, icon: '🌐' };
  if (t.includes('scratch') || t.includes('game')) return { img: null, icon: '🎮' };
  return { img: null, icon: '📘' };
}

// Course → Module → Lesson tree built from the flat saved list (mirrors the
// desktop watchlist grouping). Preserves save order within each module.
interface CourseGroup {
  courseTitle: string;
  lessonCount: number;
  modules: { moduleTitle: string; lessons: WatchlistItem[] }[];
}

function buildTree(items: WatchlistItem[]): CourseGroup[] {
  const courseOrder: string[] = [];
  const byCourse: Record<string, { moduleOrder: string[]; modules: Record<string, WatchlistItem[]> }> = {};

  for (const it of items) {
    const course = it.courseTitle || 'Uncategorized';
    const mod = it.moduleTitle || 'General';
    if (!byCourse[course]) { byCourse[course] = { moduleOrder: [], modules: {} }; courseOrder.push(course); }
    if (!byCourse[course].modules[mod]) { byCourse[course].modules[mod] = []; byCourse[course].moduleOrder.push(mod); }
    byCourse[course].modules[mod].push(it);
  }

  return courseOrder.map((course) => {
    const c = byCourse[course];
    let lessonCount = 0;
    const modules = c.moduleOrder.map((moduleTitle) => {
      const lessons = c.modules[moduleTitle];
      lessonCount += lessons.length;
      return { moduleTitle, lessons };
    });
    return { courseTitle: course, lessonCount, modules };
  });
}

export default function WatchlistScreen() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Which course sections are expanded (first one open by default, like desktop).
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadWatchlist = useCallback(async () => {
    setIsLoading(true);
    try {
      const stored = await getWatchlist();
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

  const tree = useMemo(() => buildTree(items), [items]);

  // Default-open the first course section whenever the tree changes.
  useEffect(() => {
    if (tree.length > 0) {
      setExpanded((prev) => (prev[tree[0].courseTitle] === undefined ? { ...prev, [tree[0].courseTitle]: true } : prev));
    }
  }, [tree]);

  const toggleCourse = (courseTitle: string) => {
    setExpanded((prev) => ({ ...prev, [courseTitle]: !prev[courseTitle] }));
  };

  const removeItem = async (lessonId: string) => {
    const updated = items.filter((item) => item.lessonId !== lessonId);
    setItems(updated);
    await setWatchlist(updated);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Watchlist</Text>
          <Text style={styles.headerSub}>Lessons you want to learn next</Text>
        </View>
        <View style={{ width: 30 }} />
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
            <Text style={styles.emptyTitle}>My Watchlist is empty</Text>
            <Text style={styles.emptyText}>
              Save lessons you want to learn later and they&apos;ll appear here.
            </Text>
            <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/(tabs)/courses')}>
              <Text style={styles.exploreBtnText}>🧭 Explore Courses</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tree.map((course) => {
            const th = courseThumb(course.courseTitle);
            const isOpen = !!expanded[course.courseTitle];
            return (
              <View key={course.courseTitle} style={styles.courseCard}>
                {/* Course header — collapsible */}
                <TouchableOpacity
                  style={styles.courseHeader}
                  activeOpacity={0.7}
                  onPress={() => toggleCourse(course.courseTitle)}
                >
                  <View style={styles.courseLogo}>
                    {th.img ? (
                      <Image source={th.img} style={styles.courseLogoImg} resizeMode="cover" />
                    ) : (
                      <Text style={styles.courseLogoTxt}>{th.icon}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseName} numberOfLines={1}>{course.courseTitle}</Text>
                    <Text style={styles.courseMeta}>
                      {course.lessonCount} saved lesson{course.lessonCount > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>⌄</Text>
                </TouchableOpacity>

                {/* Course body — modules + lessons */}
                {isOpen && (
                  <View style={styles.courseBody}>
                    {course.modules.map((mod) => (
                      <View key={mod.moduleTitle} style={styles.module}>
                        <View style={styles.moduleHeader}>
                          <View style={styles.moduleAccent} />
                          <Text style={styles.moduleName} numberOfLines={1}>{mod.moduleTitle}</Text>
                          <Text style={styles.moduleCount}>{mod.lessons.length}</Text>
                        </View>

                        {mod.lessons.map((lesson, idx) => (
                          <View key={lesson.lessonId} style={styles.lessonRow}>
                            <TouchableOpacity
                              style={styles.lessonBody}
                              activeOpacity={0.7}
                              onPress={() => router.push(`/lesson/${lesson.lessonId}`)}
                            >
                              <Text style={styles.lessonNum}>{(idx < 9 ? '0' : '') + (idx + 1)}</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.lessonTitle} numberOfLines={1}>{lesson.lessonTitle}</Text>
                                <Text style={styles.lessonContext} numberOfLines={1}>{lesson.moduleTitle || mod.moduleTitle}</Text>
                              </View>
                            </TouchableOpacity>
                            <View style={styles.lessonActions}>
                              <TouchableOpacity
                                style={styles.watchBtn}
                                activeOpacity={0.7}
                                onPress={() => router.push(`/lesson/${lesson.lessonId}`)}
                              >
                                <Text style={styles.watchBtnText}>Watch ▶</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.removeBtn}
                                onPress={() => removeItem(lesson.lessonId)}
                              >
                                <Text style={styles.removeBtnText}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  backBtn: { color: Colors.primary, fontSize: 20, fontWeight: '600', paddingRight: 4 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSub: { color: Colors.muted, fontSize: 11, marginTop: 1 },
  content: { padding: 16 },

  // Loading / Empty
  loadingState: { alignItems: 'center', padding: 60, gap: 12 },
  loadingText: { color: Colors.muted, fontSize: 14 },
  emptyState: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: Colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  exploreBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  exploreBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Course card (collapsible)
  courseCard: {
    backgroundColor: Colors.card2,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  courseHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  courseLogo: {
    width: 40, height: 40, borderRadius: 11, overflow: 'hidden',
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  courseLogoImg: { width: '100%', height: '100%' },
  courseLogoTxt: { fontSize: 20, fontWeight: '900', color: Colors.primary },
  courseName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  courseMeta: { color: Colors.muted, fontSize: 11, marginTop: 2 },
  chevron: { color: Colors.muted, fontSize: 18, fontWeight: '700', paddingHorizontal: 4 },
  chevronOpen: { color: Colors.primary },

  // Course body
  courseBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 12 },

  // Module
  module: {},
  moduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  moduleAccent: { width: 3, height: 14, borderRadius: 2, backgroundColor: Colors.purple },
  moduleName: { flex: 1, color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  moduleCount: {
    color: Colors.muted, fontSize: 11, fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1,
  },

  // Lesson row
  lessonRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12, padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  lessonBody: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  lessonNum: { color: Colors.primary, fontSize: 12, fontWeight: '800', width: 22 },
  lessonTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  lessonContext: { color: Colors.muted, fontSize: 11, marginTop: 2 },
  lessonActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
  watchBtn: {
    backgroundColor: Colors.primaryLight, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  watchBtnText: { color: Colors.primary, fontSize: 11, fontWeight: '800' },
  removeBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { color: Colors.danger, fontSize: 13, fontWeight: '700' },
});
