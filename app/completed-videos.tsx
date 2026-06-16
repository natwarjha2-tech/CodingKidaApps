import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDashboard } from '@/hooks';
import { Colors } from '@/theme';

export default function CompletedVideosScreen() {
  const { data, isLoading } = useDashboard();
  const enrolled = data?.enrolledCourses ?? [];
  const totalCompleted = enrolled.reduce((sum, c) => sum + (c.completedLessons ?? 0), 0);
  const totalCourses = enrolled.length;

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
            {enrolled.map((course) => (
              <TouchableOpacity
                key={course.id}
                style={styles.courseCard}
                onPress={() => router.push(`/course/${course.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.courseHeader}>
                  <Text style={styles.courseIcon}>{course.icon || '📘'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseTitle}>{course.title}</Text>
                    <Text style={styles.courseMeta}>
                      {course.completedLessons} of {course.totalLessons} lessons
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.percent,
                      { color: course.progressPercent === 100 ? Colors.success : Colors.purple },
                    ]}
                  >
                    {course.progressPercent}%
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${course.progressPercent}%` as any,
                        backgroundColor:
                          course.progressPercent === 100 ? Colors.success : Colors.primary,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            ))}
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
  courseIcon: { fontSize: 22 },
  courseTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  courseMeta: { color: Colors.muted, fontSize: 12 },
  percent: { fontSize: 16, fontWeight: '800' },
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
