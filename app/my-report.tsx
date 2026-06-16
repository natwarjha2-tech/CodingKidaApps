import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDashboard, useCoins } from '@/hooks';
import { CoinsModal } from '@/components/common/CoinsModal';
import { Colors } from '@/theme';

export default function MyReportScreen() {
  const { data: dashData, isLoading: dashLoading } = useDashboard();
  const { data: coinsData, isLoading: coinsLoading } = useCoins();
  const [coinsModalVisible, setCoinsModalVisible] = useState(false);

  const isLoading = dashLoading || coinsLoading;

  const enrolledCourses = dashData?.enrolledCourses ?? [];
  const totalEnrolled = dashData?.enrolledCount ?? enrolledCourses.length;
  const totalCoins = coinsData?.totalCoins ?? 0;

  // Calculate stats
  const completedCourses = enrolledCourses.filter(
    (c) => c.progressPercent >= 100
  ).length;

  const totalVideosWatched = enrolledCourses.reduce(
    (sum, c) => sum + (c.completedLessons ?? 0),
    0
  );

  const overallProgress =
    enrolledCourses.length > 0
      ? Math.round(
          enrolledCourses.reduce((sum, c) => sum + (c.progressPercent ?? 0), 0) /
            enrolledCourses.length
        )
      : 0;

  // Generate 30-day calendar
  const today = new Date();
  const calendar = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (29 - i));
    return {
      day: date.getDate(),
      date: date.toISOString().split('T')[0],
      isToday: i === 29,
    };
  });

  // Mark days as "active" based on total completed videos (spread across recent days)
  const activeDaysCount = Math.min(totalVideosWatched, 30);
  const activeCalendar = calendar.map((day, idx) => ({
    ...day,
    active: idx >= (30 - activeDaysCount),
  }));

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Report</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading report...</Text>
          </View>
        ) : (
          <>
            {/* Overall Progress Card */}
            <View style={styles.overallCard}>
              <Text style={styles.overallLabel}>Overall Learning Progress</Text>
              <View style={styles.overallRow}>
                <View style={styles.progressCircle}>
                  <Text style={styles.progressPercent}>{overallProgress}%</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.overallSubtext}>
                    Keep going! You&apos;re making great progress.
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[styles.progressBarFill, { width: `${overallProgress}%` }]}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* 30-Day Activity Calendar */}
            <View style={styles.calendarSection}>
              <Text style={styles.calendarTitle}>📅 30-Day Activity</Text>
              <Text style={styles.calendarMeta}>
                {activeDaysCount} active day{activeDaysCount !== 1 ? 's' : ''} out of 30
              </Text>
              <View style={styles.calendarGrid}>
                {activeCalendar.map((day, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.calendarDay,
                      {
                        backgroundColor: day.active
                          ? day.isToday
                            ? Colors.primary
                            : Colors.successLight
                          : Colors.card2,
                        borderWidth: day.isToday ? 2 : 1,
                        borderColor: day.isToday
                          ? Colors.primary
                          : day.active
                          ? Colors.success
                          : Colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        {
                          color: day.active
                            ? day.isToday
                              ? '#fff'
                              : Colors.success
                            : Colors.muted,
                        },
                      ]}
                    >
                      {day.day}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsGrid}>
              <TouchableOpacity style={styles.statCard} onPress={() => router.push('/enrolled-courses')}>
                <Text style={styles.statEmoji}>📚</Text>
                <Text style={styles.statValue}>{totalEnrolled}</Text>
                <Text style={styles.statLabel}>Enrolled</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statCard} onPress={() => router.push('/completed-videos')}>
                <Text style={styles.statEmoji}>✅</Text>
                <Text style={styles.statValue}>{totalVideosWatched}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statCard} onPress={() => router.push('/achievements')}>
                <Text style={styles.statEmoji}>🏅</Text>
                <Text style={styles.statValue}>{completedCourses}</Text>
                <Text style={styles.statLabel}>Certificates</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statCard} onPress={() => setCoinsModalVisible(true)}>
                <Text style={styles.statEmoji}>🪙</Text>
                <Text style={styles.statValue}>{totalCoins}</Text>
                <Text style={styles.statLabel}>Coins</Text>
              </TouchableOpacity>
            </View>

            {/* Per-Course Progress */}
            <Text style={styles.sectionTitle}>Course Progress</Text>
            {enrolledCourses.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📖</Text>
                <Text style={styles.emptyTitle}>No courses enrolled</Text>
                <Text style={styles.emptyText}>Enroll in a course to see progress here.</Text>
              </View>
            ) : (
              enrolledCourses.map((course) => (
                <View key={course.id} style={styles.courseCard}>
                  <View style={styles.courseHeader}>
                    <Text style={styles.courseTitle} numberOfLines={1}>
                      {course.title}
                    </Text>
                    <Text style={styles.coursePercent}>{course.progressPercent}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${course.progressPercent}%`,
                          backgroundColor:
                            course.progressPercent >= 100
                              ? Colors.success
                              : course.progressPercent >= 50
                              ? Colors.warning
                              : Colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.courseMeta}>
                    {course.completedLessons ?? 0} / {course.totalLessons ?? 0} lessons completed
                  </Text>
                </View>
              ))
            )}

            <View style={{ height: 32 }} />
          </>
        )}
      </ScrollView>

      <CoinsModal visible={coinsModalVisible} onClose={() => setCoinsModalVisible(false)} />
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
  loadingState: { alignItems: 'center', padding: 60, gap: 12 },
  loadingText: { color: Colors.muted, fontSize: 14 },

  // Overall Progress
  overallCard: {
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  overallLabel: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  overallRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  progressCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  progressPercent: { color: Colors.primary, fontSize: 18, fontWeight: '800' },
  overallSubtext: { color: Colors.muted, fontSize: 13, marginBottom: 10 },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },

  // Calendar
  calendarSection: { marginBottom: 24 },
  calendarTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  calendarMeta: { color: Colors.muted, fontSize: 12, marginBottom: 12 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  calendarDay: {
    width: '13%',
    aspectRatio: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: { fontSize: 10, fontWeight: '600' },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card2,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statEmoji: { fontSize: 24, marginBottom: 8 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: Colors.muted, fontSize: 12 },

  // Course Cards
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  courseTitle: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  coursePercent: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  courseMeta: { color: Colors.muted, fontSize: 12, marginTop: 8 },

  // Empty
  emptyState: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: Colors.muted, fontSize: 14 },
});
