import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useDashboard } from '@/hooks';
import { weeklyStreakApi } from '@/api';
import { Colors } from '@/theme';

interface StreakItem {
  id: string;
  title: string;
  weekNumber: number;
  completed: boolean;
  courseTitle: string;
}

export default function StreakHistoryScreen() {
  const { data: dashData } = useDashboard();
  const enrolled = dashData?.enrolledCourses ?? [];
  const courseIds = enrolled.map((c) => c.id);

  const { data: streakData, isLoading } = useQuery({
    queryKey: ['streak-history', courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return { streaks: [] as StreakItem[], completedCount: 0 };

      const results = await Promise.allSettled(
        enrolled.map((course) =>
          weeklyStreakApi.getByCourse(course.id).then((res) => ({
            courseTitle: course.title,
            streaks: res.streaks ?? [],
            completedCount: res.completedCount ?? 0,
          }))
        )
      );

      let allStreaks: StreakItem[] = [];
      let totalCompleted = 0;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          totalCompleted += result.value.completedCount;
          for (const streak of result.value.streaks) {
            allStreaks.push({
              id: streak.id,
              title: streak.title,
              weekNumber: streak.weekNumber,
              completed: streak.completed,
              courseTitle: result.value.courseTitle,
            });
          }
        }
      }

      return { streaks: allStreaks, completedCount: totalCompleted };
    },
    enabled: courseIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const streaks = streakData?.streaks ?? [];
  const completedCount = streakData?.completedCount ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weekly Streak</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>🔥</Text>
          <Text style={styles.summaryValue}>{completedCount}</Text>
          <Text style={styles.summaryLabel}>challenges completed</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading streak history...</Text>
          </View>
        ) : streaks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>⏳</Text>
            <Text style={styles.emptyText}>No streak challenges yet.</Text>
          </View>
        ) : (
          streaks.map((streak) => (
            <View key={streak.id} style={styles.streakCard}>
              <View style={styles.streakLeft}>
                <Text style={styles.weekBadge}>Week {streak.weekNumber}</Text>
                <Text style={styles.streakTitle}>{streak.title}</Text>
                <Text style={styles.streakCourse}>{streak.courseTitle}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: streak.completed
                      ? Colors.successLight
                      : Colors.warningLight,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: streak.completed ? Colors.success : Colors.warning },
                  ]}
                >
                  {streak.completed ? '✅ PASS' : '⏳ Pending'}
                </Text>
              </View>
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
  summaryLabel: { fontSize: 14, color: Colors.muted },
  loadingState: { alignItems: 'center', padding: 40, gap: 12 },
  loadingText: { color: Colors.muted, fontSize: 14 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: Colors.muted, fontSize: 14 },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  streakLeft: { flex: 1 },
  weekBadge: { color: Colors.purple, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  streakTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  streakCourse: { color: Colors.muted, fontSize: 12 },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
});
