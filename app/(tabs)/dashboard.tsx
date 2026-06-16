import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store';
import { useDashboard, useCoins, useWeeklyStreakCount } from '@/hooks';
import { CoinsModal } from '@/components/common/CoinsModal';
import { Colors } from '@/theme';

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, refetch, isRefetching } = useDashboard();
  const { data: coinsData } = useCoins();
  const { data: streakCount } = useWeeklyStreakCount();
  const [coinsModalVisible, setCoinsModalVisible] = useState(false);

  const enrolled = data?.enrolledCourses ?? [];
  const enrolledCount = data?.enrolledCount ?? 0;
  const completedCount = enrolled.reduce((sum, c) => sum + (c.completedLessons ?? 0), 0);
  const certCount = enrolled.filter((c) => c.progressPercent === 100).length;
  const totalCoins = coinsData?.totalCoins ?? 0;

  const statCards = [
    { emoji: '📚', value: enrolledCount, label: 'Enrolled Courses', color: Colors.primary, glow: 'rgba(108,71,255,0.25)' },
    { emoji: '✅', value: completedCount, label: 'Videos Completed', color: Colors.success, glow: 'rgba(34,197,94,0.25)' },
    { emoji: '🏆', value: certCount, label: 'Certificates', color: Colors.warning, glow: 'rgba(245,158,11,0.25)' },
    { emoji: '🔥', value: streakCount ?? 0, label: 'Weekly Streak', color: Colors.danger, glow: 'rgba(239,68,68,0.25)' },
  ];

  const handleStatPress = (label: string, value: number) => {
    switch (label) {
      case 'Enrolled Courses':
        router.push('/enrolled-courses');
        break;
      case 'Videos Completed':
        router.push('/completed-videos');
        break;
      case 'Certificates':
        router.push('/achievements');
        break;
      case 'Weekly Streak':
        router.push('/streak-history');
        break;
      default:
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        {/* Welcome Banner — exact desktop style */}
        <View style={styles.welcomeBanner}>
          {/* Radial glow */}
          <View style={styles.welcomeGlow} />

          <View style={styles.welcomeLeft}>
            <Text style={styles.welcomeText}>
              Welcome, {'\n'}
              <Text style={styles.welcomeName}>{user?.name ?? 'Learner'}! 👋</Text>
            </Text>
            <Text style={styles.welcomeSubtitle}>Keep learning, keep growing. You're doing great!</Text>
            <TouchableOpacity style={styles.continueBtn} onPress={() => router.push('/(tabs)/courses')}>
              <Text style={styles.continueBtnText}>Continue Learning →</Text>
            </TouchableOpacity>
          </View>

          {/* Coins badge */}
          <TouchableOpacity style={styles.coinsBadge} onPress={() => setCoinsModalVisible(true)}>
            <Text style={styles.coinsEmoji}>🪙</Text>
            <Text style={styles.coinsText}>{totalCoins}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row — exact desktop card style */}
        <View style={styles.statsGrid}>
          {statCards.map((stat) => (
            <TouchableOpacity
              key={stat.label}
              style={[styles.statCard, { borderColor: `${stat.color}20` }]}
              onPress={() => handleStatPress(stat.label, stat.value)}
              activeOpacity={0.7}
            >
              <View style={[styles.statGlow, { backgroundColor: stat.glow }]} />
              <View style={[styles.statIconWrap, { backgroundColor: `${stat.color}20`, borderColor: `${stat.color}40` }]}>
                <Text style={styles.statEmoji}>{stat.emoji}</Text>
              </View>
              <Text style={styles.statValue}>{isLoading ? '—' : stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Continue Learning */}
        {data?.lastWatched && (
          <TouchableOpacity
            style={styles.continueCard}
            onPress={() => router.push(`/course/${data.lastWatched!.courseId}`)}
          >
            <View style={styles.continueThumbnail}>
              <Text style={styles.continueThumbnailIcon}>▶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.continueCourseTitle}>{data.lastWatched.courseTitle}</Text>
              <Text style={styles.continueMeta}>
                {data.lastWatched.moduleTitle} · {data.lastWatched.lessonTitle}
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${data.lastWatched.progressPercent}%` as any }]} />
              </View>
            </View>
            <TouchableOpacity style={styles.resumeBtn}>
              <Text style={styles.resumeBtnText}>Resume ▶</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* My Courses */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Courses</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/courses')}>
            <Text style={styles.seeAll}>View all →</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.skeletonCard} />
        ) : enrolled.length === 0 ? (
          <View style={styles.emptyCard}>
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
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.courseTitle}>{course.title}</Text>
                <Text style={styles.courseMeta}>
                  {course.completedLessons}/{course.totalLessons} lessons
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${course.progressPercent}%` as any }]} />
                </View>
              </View>
              <Text style={[styles.percent, { color: course.progressPercent === 100 ? Colors.success : Colors.purple }]}>
                {course.progressPercent}%
              </Text>
            </TouchableOpacity>
          ))
        )}

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/leaderboard')}>
            <Text style={styles.quickActionEmoji}>🏆</Text>
            <Text style={styles.quickActionLabel}>Leaderboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/downloads')}>
            <Text style={styles.quickActionEmoji}>📥</Text>
            <Text style={styles.quickActionLabel}>Downloads</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/watchlist')}>
            <Text style={styles.quickActionEmoji}>📌</Text>
            <Text style={styles.quickActionLabel}>Watchlist</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Coins Modal */}
      <CoinsModal visible={coinsModalVisible} onClose={() => setCoinsModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Welcome Banner
  welcomeBanner: {
    margin: 16, borderRadius: 20, padding: 24, minHeight: 160,
    backgroundColor: '#2e1065',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden', position: 'relative',
  },
  welcomeGlow: {
    position: 'absolute', top: '50%', left: '50%',
    width: 300, height: 300,
    backgroundColor: 'rgba(139,92,246,0.25)',
    borderRadius: 150, transform: [{ translateX: -150 }, { translateY: -150 }],
  },
  welcomeLeft: { maxWidth: '75%', zIndex: 2 },
  welcomeText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 4 },
  welcomeName: { fontSize: 22, fontWeight: '800', color: '#fff' },
  welcomeSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 8, marginBottom: 16, lineHeight: 20 },
  continueBtn: {
    backgroundColor: '#fff', borderRadius: 50, paddingVertical: 10, paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  continueBtnText: { color: '#1a1a2e', fontSize: 13, fontWeight: '700' },
  coinsBadge: {
    position: 'absolute', bottom: 12, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4,
  },
  coinsEmoji: { fontSize: 12 },
  coinsText: { fontSize: 12, fontWeight: '700', color: '#fbbf24' },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 12, marginBottom: 20,
  },
  statCard: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24, padding: 20,
    borderWidth: 1, position: 'relative', overflow: 'hidden',
  },
  statGlow: {
    position: 'absolute', top: -30, left: -30,
    width: 120, height: 120, borderRadius: 60,
  },
  statIconWrap: {
    width: 50, height: 50, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 12,
  },
  statEmoji: { fontSize: 24 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },

  // Continue Learning Card
  continueCard: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: Colors.card2,
    borderRadius: 18, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  continueThumbnail: {
    width: 64, height: 64, borderRadius: 14,
    backgroundColor: '#000', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
  },
  continueThumbnailIcon: { fontSize: 24, color: '#F59E0B' },
  continueCourseTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  continueMeta: { color: Colors.muted, fontSize: 12, marginBottom: 10 },
  resumeBtn: {
    backgroundColor: '#4A1D96', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  resumeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Progress bar
  progressBar: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 50, overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 50,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 12,
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  seeAll: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },

  // Course cards
  skeletonCard: {
    marginHorizontal: 16, height: 80,
    backgroundColor: Colors.card, borderRadius: 12,
  },
  emptyCard: { alignItems: 'center', padding: 40, marginHorizontal: 16 },
  emptyText: { color: Colors.muted, fontSize: 14, marginBottom: 12 },
  exploreLink: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  courseCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.card2, borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  courseTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  courseMeta: { color: Colors.muted, fontSize: 11, marginBottom: 10 },
  percent: { fontSize: 16, fontWeight: '800', marginLeft: 8 },

  // Quick Actions
  quickActions: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  quickActionBtn: {
    flex: 1, backgroundColor: Colors.card2, borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  quickActionEmoji: { fontSize: 24, marginBottom: 8 },
  quickActionLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
