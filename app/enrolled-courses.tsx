import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDashboard, useCourses } from '@/hooks';
import { useCourseStore } from '@/store';
import { courseDurationSeconds } from '@/utils/course.util';
import { Colors } from '@/theme';

// Human "X min / Xh Ym remaining" from seconds. '' when unknown (hide, no fake).
function formatRemaining(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  return `${Math.max(m, 1)} min`;
}

// Difficulty badge by progress (mirrors desktop)
function difficultyByProgress(pct: number): { label: string; color: string } {
  if (pct >= 70) return { label: '🟠 Advanced', color: '#fdba74' };
  if (pct >= 30) return { label: '🟡 Intermediate', color: '#fde047' };
  return { label: '🟢 Beginner', color: '#6ee7b7' };
}

export default function EnrolledCoursesScreen() {
  const { data, isLoading } = useDashboard();
  const enrolled = data?.enrolledCourses ?? [];
  const lessonContext = useCourseStore((s) => s.lessonContext);
  // Course list (cached/prefetched) carries the real total duration per course —
  // dashboard doesn't. Reuse it to compute a real, proportional remaining time.
  const { data: allCoursesData } = useCourses('All', '');
  const allCourses = allCoursesData?.courses ?? [];

  // Header stats: total courses + average progress
  const avgProgress = enrolled.length > 0
    ? Math.round(enrolled.reduce((s, c) => s + (c.progressPercent ?? 0), 0) / enrolled.length)
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Enrolled Courses</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Loading courses...</Text>
          </View>
        ) : enrolled.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={styles.emptyText}>No enrolled courses yet.</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/courses')}>
              <Text style={styles.exploreLink}>Explore Courses →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Header stats: courses + avg progress (mirrors desktop) */}
            <View style={styles.statsBar}>
              <View style={styles.statChip}>
                <Text style={styles.statChipText}>📚 {enrolled.length} Course{enrolled.length > 1 ? 's' : ''}</Text>
              </View>
              <View style={[styles.statChip, styles.statChipGold]}>
                <Text style={[styles.statChipText, { color: '#fbbf24' }]}>⚡ {avgProgress}% Progress</Text>
              </View>
            </View>

            {enrolled.map((course) => {
              const pct = course.progressPercent ?? 0;
              const completed = course.completedLessons ?? 0;
              const total = course.totalLessons ?? 0;
              const remaining = Math.max(total - completed, 0);
              const isComplete = pct >= 100;
              const diff = difficultyByProgress(pct);
              const lastLearned = (lessonContext && lessonContext.courseId === course.id) ? lessonContext.lessonTitle : '';
              // Real remaining time: course's total duration × (remaining/total lessons).
              // Real backend duration (list route); '' when unavailable → chip hidden.
              const totalSec = courseDurationSeconds(allCourses.find((c) => c.id === course.id) ?? ({} as any));
              const remainingSec = total > 0 ? totalSec * (remaining / total) : 0;
              const remainingLabel = formatRemaining(remainingSec);
              return (
                <TouchableOpacity
                  key={course.id}
                  style={styles.courseCard}
                  onPress={() => router.push(`/course/${course.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.courseIconWrap}>
                    <View style={styles.courseIconGlow} />
                    <Text style={styles.courseIcon}>📖</Text>
                  </View>
                  <View style={styles.courseInfo}>
                    <View style={styles.courseTitleRow}>
                      <Text style={styles.courseTitle} numberOfLines={1}>{course.title}</Text>
                      <View style={[styles.diffBadge, { borderColor: `${diff.color}55` }]}>
                        <Text style={[styles.diffText, { color: diff.color }]}>{diff.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.courseMeta}>⚡ {completed} of {total} lessons completed</Text>
                    {lastLearned ? (
                      <Text style={styles.courseSub} numberOfLines={1}>📍 Last learned: {lastLearned}</Text>
                    ) : null}
                    {!isComplete && remaining > 0 ? (
                      <Text style={styles.courseSub}>▶ Next: {remaining} lesson{remaining > 1 ? 's' : ''} remaining</Text>
                    ) : null}
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${pct}%` as any, backgroundColor: isComplete ? Colors.success : Colors.primary },
                        ]}
                      />
                    </View>
                    {isComplete ? (
                      <Text style={styles.courseFoot}>✅ Course Complete!</Text>
                    ) : remainingLabel ? (
                      <Text style={styles.courseFoot}>⏱ ~{remainingLabel} remaining</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.percent, { color: isComplete ? Colors.success : Colors.purple }]}>{pct}%</Text>
                </TouchableOpacity>
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
  loadingCard: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: { color: Colors.muted, fontSize: 14 },
  emptyState: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: Colors.muted, fontSize: 14, marginBottom: 12 },
  exploreLink: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
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
  courseInfo: { flex: 1, minWidth: 0 },
  courseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  courseTitle: { color: '#fff', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  courseMeta: { color: Colors.muted, fontSize: 12, marginBottom: 4 },
  courseSub: { color: Colors.muted, fontSize: 11, marginBottom: 4 },
  courseFoot: { color: Colors.muted, fontSize: 11, marginTop: 6 },
  diffBadge: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1,
  },
  diffText: { fontSize: 9, fontWeight: '700' },
  statsBar: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statChip: {
    backgroundColor: 'rgba(139,92,246,0.1)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  statChipGold: { backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.2)' },
  statChipText: { color: '#c4b5fd', fontSize: 12, fontWeight: '700' },
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
  percent: { fontSize: 16, fontWeight: '800' },
});
