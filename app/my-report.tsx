import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Share } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useDashboard, useCoins, useWeeklyStreakCount } from '@/hooks';
import { achievementsApi, weeklyStreakApi, coinsApi } from '@/api';
import { AttendanceService } from '@/services';
import { Colors } from '@/theme';
import type { Achievement } from '@/types';

const badgeEmoji: Record<string, string> = {
  'super-master': '🥇',
  master: '🥈',
  pro: '🥉',
};

const badgeLabel: Record<string, string> = {
  'super-master': 'Super Master',
  master: 'Master',
  pro: 'Pro',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function MyReportScreen() {
  const { data: dashData, isLoading: dashLoading } = useDashboard();
  const { data: coinsData, isLoading: coinsLoading } = useCoins();
  const { data: streakCount } = useWeeklyStreakCount();
  const [todayMins, setTodayMins] = useState(0);
  const [weekMins, setWeekMins] = useState(0);
  const [calendarDays, setCalendarDays] = useState<{ date: string; day: number; mins: number; active: boolean; isToday: boolean }[]>([]);
  const [selectedBadgeType, setSelectedBadgeType] = useState<string | null>(null);

  // Achievements
  const { data: achievementsData, isLoading: achievementsLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => achievementsApi.get(),
    staleTime: 1000 * 60 * 5,
  });

  // Weekly Streak full data
  const enrolled = dashData?.enrolledCourses ?? [];
  const courseIds = enrolled.map((c) => c.id);

  const { data: streakData, isLoading: streakLoading } = useQuery({
    queryKey: ['streak-history', courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return { streaks: [] as any[], completedCount: 0 };
      const results = await Promise.allSettled(
        enrolled.map((course) =>
          weeklyStreakApi.getByCourse(course.id).then((res) => ({
            courseTitle: course.title,
            streaks: res.streaks ?? [],
            completedCount: res.completedCount ?? 0,
          }))
        )
      );
      let allStreaks: any[] = [];
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

  // Coins full transaction data
  const { data: coinsFullData, isLoading: coinsFullLoading } = useQuery({
    queryKey: ['coins'],
    queryFn: () => coinsApi.get(),
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = dashLoading || coinsLoading;

  // Load attendance data
  useEffect(() => {
    AttendanceService.getTodayMins().then(setTodayMins);
    AttendanceService.getWeekMins().then(setWeekMins);
    AttendanceService.getLast30Days().then(setCalendarDays);
  }, []);

  const enrolledCourses = dashData?.enrolledCourses ?? [];
  const totalEnrolled = dashData?.enrolledCount ?? enrolledCourses.length;
  const totalCoins = coinsFullData?.totalCoins ?? coinsData?.totalCoins ?? 0;
  const transactions = coinsFullData?.transactions ?? [];

  // Calculate stats
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

  // Attendance calendar
  const activeCalendar = calendarDays;
  const activeDaysCount = calendarDays.filter((d) => d.active).length;

  // Achievements grouped by badge type
  const achievements: Achievement[] = achievementsData?.achievements ?? [];
  const badgeCounts: Record<string, number> = {
    'super-master': 0,
    master: 0,
    pro: 0,
  };
  for (const a of achievements) {
    if (badgeCounts[a.badgeType] !== undefined) {
      badgeCounts[a.badgeType]++;
    }
  }

  // Filtered achievements for selected badge
  const filteredAchievements = selectedBadgeType
    ? achievements.filter((a) => a.badgeType === selectedBadgeType)
    : [];

  // Streak data
  const streaks = streakData?.streaks ?? [];
  const streakCompletedCount = streakData?.completedCount ?? streakCount ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Report</Text>
        <TouchableOpacity onPress={() => {
          Share.share({
            message: `📊 CodingKida Learning Report\n\n📚 Courses Enrolled: ${totalEnrolled}\n✅ Lessons Completed: ${totalVideosWatched}\n⏱ Today: ${AttendanceService.formatMins(todayMins)}\n📅 This Week: ${AttendanceService.formatMins(weekMins)}\n🏆 Achievements: ${achievements.length}\n🔥 Weekly Streak: ${streakCompletedCount}\n🪙 Coins: ${totalCoins}\n\n— CodingKida App`,
          });
        }}>
          <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '600' }}>📤 Share</Text>
        </TouchableOpacity>
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
                <Text style={styles.statLabel}>Enrolled Courses</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statCard} onPress={() => router.push('/completed-videos')}>
                <Text style={styles.statEmoji}>✅</Text>
                <Text style={styles.statValue}>{totalVideosWatched}</Text>
                <Text style={styles.statLabel}>Video Completed</Text>
              </TouchableOpacity>
              <View style={styles.statCard}>
                <Text style={styles.statEmoji}>⏱</Text>
                <Text style={styles.statValue}>{AttendanceService.formatMins(todayMins)}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statEmoji}>📅</Text>
                <Text style={styles.statValue}>{AttendanceService.formatMins(weekMins)}</Text>
                <Text style={styles.statLabel}>This Week</Text>
              </View>
            </View>

            {/* ═══════════ ACHIEVEMENTS SECTION ═══════════ */}
            <Text style={styles.sectionTitle}>🏆 Achievements</Text>
            {achievementsLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
            ) : achievements.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🏆</Text>
                <Text style={styles.emptyTitle}>No achievements yet</Text>
                <Text style={styles.emptyText}>Complete quizzes to earn badges!</Text>
              </View>
            ) : (
              <>
                {/* 3 Badge Cards */}
                <View style={styles.badgeGrid}>
                  {(['super-master', 'master', 'pro'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.badgeCard,
                        selectedBadgeType === type && styles.badgeCardActive,
                      ]}
                      onPress={() => setSelectedBadgeType(selectedBadgeType === type ? null : type)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.badgeCardEmoji}>{badgeEmoji[type]}</Text>
                      <Text style={styles.badgeCardCount}>{badgeCounts[type]}</Text>
                      <Text style={styles.badgeCardLabel}>{badgeLabel[type]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Filtered badge details */}
                {selectedBadgeType && (
                  <View style={styles.badgeDetailSection}>
                    <Text style={styles.badgeDetailTitle}>
                      {badgeEmoji[selectedBadgeType]} {badgeLabel[selectedBadgeType]} Badges ({filteredAchievements.length})
                    </Text>
                    {filteredAchievements.length === 0 ? (
                      <Text style={styles.badgeDetailEmpty}>No {badgeLabel[selectedBadgeType]} badges earned yet.</Text>
                    ) : (
                      filteredAchievements.map((achievement) => (
                        <View key={achievement.id} style={styles.achievementCard}>
                          <View style={styles.achievementInfo}>
                            <Text style={styles.achievementTitle}>{achievement.title}</Text>
                            {achievement.courseTitle && (
                              <Text style={styles.achievementMeta}>
                                {achievement.courseTitle}
                                {achievement.lessonTitle ? ` · ${achievement.lessonTitle}` : ''}
                              </Text>
                            )}
                            <View style={styles.achievementStatsRow}>
                              {achievement.score != null && (
                                <View style={styles.achievementStatBadge}>
                                  <Text style={styles.achievementStatText}>Score: {achievement.score}</Text>
                                </View>
                              )}
                              {achievement.rank != null && (
                                <View style={[styles.achievementStatBadge, { backgroundColor: Colors.warningLight }]}>
                                  <Text style={[styles.achievementStatText, { color: Colors.warning }]}>
                                    Rank #{achievement.rank}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.achievementDate}>
                              {formatDate(achievement.earnedAt || achievement.createdAt)}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </>
            )}

            {/* ═══════════ WEEKLY STREAK SECTION ═══════════ */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🔥 Weekly Streak</Text>
            {streakLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
            ) : (
              <>
                <View style={styles.streakSummary}>
                  <Text style={styles.streakSummaryEmoji}>🔥</Text>
                  <Text style={styles.streakSummaryValue}>{streakCompletedCount}</Text>
                  <Text style={styles.streakSummaryLabel}>challenges completed</Text>
                </View>

                {streaks.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyEmoji}>⏳</Text>
                    <Text style={styles.emptyText}>No streak challenges yet.</Text>
                  </View>
                ) : (
                  streaks.slice(0, 10).map((streak: any) => (
                    <View key={streak.id} style={styles.streakCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.streakWeek}>Week {streak.weekNumber}</Text>
                        <Text style={styles.streakTitle}>{streak.title}</Text>
                        <Text style={styles.streakCourse}>{streak.courseTitle}</Text>
                      </View>
                      <View
                        style={[
                          styles.streakBadge,
                          {
                            backgroundColor: streak.completed
                              ? Colors.successLight
                              : Colors.warningLight,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.streakBadgeText,
                            { color: streak.completed ? Colors.success : Colors.warning },
                          ]}
                        >
                          {streak.completed ? '✅ PASS' : '⏳ Pending'}
                        </Text>
                      </View>
                    </View>
                  ))
                )}

                {streaks.length > 10 && (
                  <TouchableOpacity style={styles.viewAllBtn} onPress={() => router.push('/streak-history')}>
                    <Text style={styles.viewAllText}>View All ({streaks.length}) →</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* ═══════════ MY COINS SECTION ═══════════ */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🪙 My Coins</Text>
            {coinsFullLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
            ) : (
              <>
                <View style={styles.coinsSummary}>
                  <Text style={styles.coinsSummaryValue}>{totalCoins}</Text>
                  <Text style={styles.coinsSummaryLabel}>Total Coins Earned</Text>
                  <Text style={styles.coinsFooter}>100+ coins = ₹ discount on next course</Text>
                </View>

                {/* Transactions */}
                <Text style={styles.subsectionTitle}>Recent Rewards</Text>
                {transactions.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No rewards yet. Complete quizzes to earn coins!</Text>
                  </View>
                ) : (
                  transactions.map((tx: any, i: number) => (
                    <View key={i} style={styles.txItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txReason}>{tx.reason}</Text>
                      </View>
                      <Text style={[
                        styles.txCoins,
                        { color: tx.type === 'EARNED' ? Colors.success : Colors.danger },
                      ]}>
                        {tx.type === 'EARNED' ? '+' : '-'}{tx.coins}
                      </Text>
                      <Text style={styles.txTime}>{formatTime(tx.createdAt)}</Text>
                    </View>
                  ))
                )}
              </>
            )}

            {/* ═══════════ COURSE PROGRESS SECTION ═══════════ */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Course Progress</Text>
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

  // Section titles
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  subsectionTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 12 },

  // Achievements
  badgeGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  badgeCard: {
    flex: 1,
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeCardActive: {
    borderColor: Colors.warning,
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  badgeCardEmoji: { fontSize: 28, marginBottom: 6 },
  badgeCardCount: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 2 },
  badgeCardLabel: { color: Colors.muted, fontSize: 11, fontWeight: '600' },

  badgeDetailSection: { marginBottom: 8 },
  badgeDetailTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  badgeDetailEmpty: { color: Colors.muted, fontSize: 13, marginBottom: 12 },

  achievementCard: {
    backgroundColor: Colors.card2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  achievementInfo: {},
  achievementTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  achievementMeta: { color: Colors.muted, fontSize: 12, marginBottom: 8 },
  achievementStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  achievementStatBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  achievementStatText: { color: Colors.primary, fontSize: 11, fontWeight: '600' },
  achievementDate: { color: Colors.muted, fontSize: 11 },

  // Weekly Streak
  streakSummary: {
    alignItems: 'center',
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  streakSummaryEmoji: { fontSize: 32, marginBottom: 6 },
  streakSummaryValue: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 2 },
  streakSummaryLabel: { fontSize: 13, color: Colors.muted },

  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  streakWeek: { color: Colors.purple, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  streakTitle: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  streakCourse: { color: Colors.muted, fontSize: 11 },
  streakBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  streakBadgeText: { fontSize: 11, fontWeight: '700' },

  viewAllBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  viewAllText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  // Coins
  coinsSummary: {
    alignItems: 'center',
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  coinsSummaryValue: { fontSize: 32, fontWeight: '800', color: '#fbbf24', marginBottom: 4 },
  coinsSummaryLabel: { fontSize: 14, color: Colors.muted, marginBottom: 8 },
  coinsFooter: { fontSize: 12, color: Colors.success, fontWeight: '500' },

  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  txReason: { color: '#fff', fontSize: 13, fontWeight: '500' },
  txCoins: { fontSize: 14, fontWeight: '700' },
  txTime: { color: Colors.muted, fontSize: 11, width: 42 },

  // Course Cards
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
  emptyState: { alignItems: 'center', padding: 24 },
  emptyEmoji: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emptyText: { color: Colors.muted, fontSize: 13 },
});
