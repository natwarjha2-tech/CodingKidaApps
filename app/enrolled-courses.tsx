import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDashboard } from '@/hooks';
import { Colors } from '@/theme';

export default function EnrolledCoursesScreen() {
  const { data, isLoading } = useDashboard();
  const enrolled = data?.enrolledCourses ?? [];

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
          enrolled.map((course) => (
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
                <Text style={styles.courseTitle}>{course.title}</Text>
                <Text style={styles.courseMeta}>
                  {course.completedLessons}/{course.totalLessons} lessons completed
                </Text>
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
              </View>
              <Text
                style={[
                  styles.percent,
                  { color: course.progressPercent === 100 ? Colors.success : Colors.purple },
                ]}
              >
                {course.progressPercent}%
              </Text>
            </TouchableOpacity>
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
  courseInfo: { flex: 1 },
  courseTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  courseMeta: { color: Colors.muted, fontSize: 12, marginBottom: 10 },
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
