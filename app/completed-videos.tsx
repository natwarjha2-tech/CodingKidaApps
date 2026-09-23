import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboard } from '@/hooks';
import { coursesApi } from '@/api';
import { formatLessonDuration } from '@/utils/course.util';
import { Colors } from '@/theme';
import type { CourseDetail } from '@/types';

export default function CompletedVideosScreen() {
  const { data, isLoading } = useDashboard();
  const enrolled = data?.enrolledCourses ?? [];
  const totalCompleted = enrolled.reduce((sum, c) => sum + (c.completedLessons ?? 0), 0);
  const totalCourses = enrolled.length;

  const queryClient = useQueryClient();
  // Expandable dropdown: tap a course → reveal modules and the completed lessons
  // inside each. Course detail (modules + completedLessons) is fetched lazily on
  // first expand and cached so re-expanding is instant.
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [courseDetails, setCourseDetails] = useState<Record<string, CourseDetail>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const toggleExpand = useCallback(async (courseId: string) => {
    if (expandedCourseId === courseId) {
      setExpandedCourseId(null);
      return;
    }
    setExpandedCourseId(courseId);
    if (!courseDetails[courseId]) {
      setDetailLoadingId(courseId);
      try {
        const res = await queryClient.fetchQuery({
          queryKey: ['course', courseId],
          queryFn: () => coursesApi.getById(courseId),
          staleTime: 1000 * 60 * 2,
        });
        if (res?.success && res.course) {
          setCourseDetails((prev) => ({ ...prev, [courseId]: res.course }));
        }
      } catch {
        // Silent — dropdown shows a friendly retry message.
      } finally {
        setDetailLoadingId(null);
      }
    }
  }, [expandedCourseId, courseDetails, queryClient]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Videos Completed</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>✅</Text>
          <Text style={styles.summaryValue}>{totalCompleted}</Text>
          <Text style={styles.summaryLabel}>
            videos completed across {totalCourses} course{totalCourses !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Course Breakdown */}
        {isLoading ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : enrolled.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No progress yet. Start watching lessons!</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Course Breakdown</Text>
            {enrolled.map((course) => {
              const pct = course.progressPercent ?? 0;
              const isComplete = pct >= 100;
              const ringColor = isComplete ? Colors.success : Colors.purple;
              const statusLabel = isComplete ? '✅ Completed' : '🟢 In Progress';
              const motivational =
                isComplete ? '🏆 Course mastered!' :
                pct >= 75 ? "🔥 You're almost there!" :
                pct >= 40 ? '🎉 Great progress!' :
                '🚀 Good start, keep going!';
              const isExpanded = expandedCourseId === course.id;
              const detail = courseDetails[course.id];
              const completedSet = new Set(detail?.completedLessons ?? []);
              const isDetailLoading = detailLoadingId === course.id;
              return (
                <View key={course.id} style={styles.courseCard}>
                  {/* Tappable header — toggles the module/lesson dropdown */}
                  <TouchableOpacity onPress={() => toggleExpand(course.id)} activeOpacity={0.7}>
                    <View style={styles.courseHeader}>
                      {/* Completion ring (percentage circle) */}
                      <View style={[styles.ring, { borderColor: ringColor }]}>
                        <Text style={[styles.ringPct, { color: ringColor }]}>{pct}%</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.courseTitleRow}>
                          <Text style={styles.courseTitle} numberOfLines={1}>{course.title}</Text>
                          <Text style={[styles.statusLabel, { color: isComplete ? Colors.success : '#6ee7b7' }]}>{statusLabel}</Text>
                        </View>
                        <Text style={styles.courseMeta}>{course.completedLessons} of {course.totalLessons} lessons completed</Text>
                      </View>
                      <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${pct}%` as any, backgroundColor: isComplete ? Colors.success : Colors.primary },
                        ]}
                      />
                    </View>
                    {/* Motivational message + Watch Again */}
                    <View style={styles.courseFooterRow}>
                      <Text style={styles.motivational}>{motivational}</Text>
                      <TouchableOpacity onPress={() => router.push(`/course/${course.id}`)}>
                        <Text style={styles.watchAgain}>Watch Again ▶</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {/* Dropdown: modules → completed lessons inside each */}
                  {isExpanded && (
                    <View style={styles.moduleDropdown}>
                      {isDetailLoading && !detail ? (
                        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />
                      ) : !detail || detail.modules.length === 0 ? (
                        <Text style={styles.moduleEmpty}>Couldn't load lessons. Tap again to retry.</Text>
                      ) : (
                        (() => {
                          // Only COMPLETED lessons here (this is the "Videos
                          // Completed" screen). Skip modules with none. "Watch
                          // Again" still opens the full course with everything.
                          const modulesWithDone = detail.modules
                            .map((mod) => ({ mod, done: mod.lessons.filter((l) => completedSet.has(l.id)) }))
                            .filter((x) => x.done.length > 0);
                          if (modulesWithDone.length === 0) {
                            return <Text style={styles.moduleEmpty}>No completed lessons in this course yet.</Text>;
                          }
                          return modulesWithDone.map(({ mod, done }) => (
                            <View key={mod.id} style={styles.moduleBlock}>
                              <View style={styles.moduleHead}>
                                <Text style={styles.moduleName} numberOfLines={1}>{mod.title}</Text>
                                <Text style={styles.moduleCount}>{done.length}/{mod.lessons.length}</Text>
                              </View>
                              {done.map((lesson) => (
                                <TouchableOpacity
                                  key={lesson.id}
                                  style={styles.lessonRow}
                                  activeOpacity={0.7}
                                  onPress={() => router.push(`/course/${course.id}`)}
                                >
                                  <Text style={[styles.lessonCheck, { color: Colors.success }]}>✅</Text>
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={[styles.lessonName, styles.lessonNameDone]} numberOfLines={1}>
                                      {lesson.title}
                                    </Text>
                                    <Text style={styles.lessonDur}>{formatLessonDuration(lesson.duration)}</Text>
                                  </View>
                                  <Text style={styles.lessonDoneTag}>Completed</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          ));
                        })()
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
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
  summaryCard: {
    alignItems: 'center',
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 28,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryEmoji: { fontSize: 40, marginBottom: 8 },
  summaryValue: { fontSize: 36, fontWeight: '800', color: '#fff', marginBottom: 4 },
  summaryLabel: { fontSize: 14, color: Colors.muted, textAlign: 'center' },
  loadingCard: { alignItems: 'center', padding: 40 },
  loadingText: { color: Colors.muted, fontSize: 14 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: Colors.muted, fontSize: 14 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  courseCard: {
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  courseIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4C26A8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  courseIconGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(108,71,255,0.4)',
  },
  courseIcon: { fontSize: 22, zIndex: 1 },
  courseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  courseTitle: { color: '#fff', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  courseMeta: { color: Colors.muted, fontSize: 12 },
  percent: { fontSize: 16, fontWeight: '800' },
  // Completion ring (percentage circle — no SVG dependency)
  ring: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  ringPct: { fontSize: 13, fontWeight: '800' },
  statusLabel: { fontSize: 10, fontWeight: '700' },
  courseFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  motivational: { color: '#6ee7b7', fontSize: 11, fontWeight: '500', flexShrink: 1 },
  watchAgain: { color: Colors.success, fontSize: 12, fontWeight: '700' },
  chevron: { color: Colors.muted, fontSize: 10, marginLeft: 8 },

  // Dropdown: modules → completed lessons
  moduleDropdown: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  moduleEmpty: { color: Colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  moduleBlock: { marginBottom: 12 },
  moduleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  moduleName: {
    color: '#c4b5fd', fontSize: 12, fontWeight: '700', flex: 1, marginRight: 8,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  moduleCount: { color: Colors.muted, fontSize: 11, fontWeight: '600' },
  lessonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 4,
  },
  lessonCheck: { fontSize: 12, width: 18 },
  lessonName: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5 },
  lessonNameDone: { color: '#fff' },
  lessonDur: { color: Colors.muted, fontSize: 10.5, marginTop: 1 },
  lessonDoneTag: {
    color: Colors.success, fontSize: 9.5, fontWeight: '700',
    backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 50,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 50,
  },
});
