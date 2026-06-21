import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { useCourseStore } from '@/store';
import { useDashboard, useCoins, useCourses, usePrefetchDashboard } from '@/hooks';
import { achievementsApi } from '@/api';
import { CoinsModal } from '@/components/common/CoinsModal';
import { Colors } from '@/theme';
import type { Achievement } from '@/types';

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, refetch, isRefetching } = useDashboard();
  const { data: coinsData } = useCoins();
  const { data: allCoursesData } = useCourses('All', '');
  const [coinsModalVisible, setCoinsModalVisible] = useState(false);
  const lessonContext = useCourseStore((s) => s.lessonContext);

  // Prefetch leaderboard, achievements & streak so child screens open instantly
  usePrefetchDashboard();

  const enrolledCount = data?.enrolledCount ?? 0;
  const totalCoins = coinsData?.totalCoins ?? 0;

  // Fetch achievements to get latest badge
  const { data: achievementsData } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => achievementsApi.get(),
    staleTime: 1000 * 60 * 5,
  });

  const achievements: Achievement[] = achievementsData?.achievements ?? [];
  // Sort by earnedAt/createdAt descending to get latest badge
  const latestBadge = achievements.length > 0
    ? [...achievements].sort((a, b) => {
        const dateA = new Date(a.earnedAt || a.createdAt).getTime();
        const dateB = new Date(b.earnedAt || b.createdAt).getTime();
        return dateB - dateA;
      })[0]
    : null;

  const badgeEmoji: Record<string, string> = {
    'super-master': '🥇',
    master: '🥈',
    pro: '🥉',
  };

  // Use lessonContext (latest opened lesson) if available, else fall back to API lastWatched
  const resumeData = lessonContext
    ? {
        courseId: lessonContext.courseId,
        courseTitle: lessonContext.courseTitle,
        moduleTitle: lessonContext.moduleTitle,
        lessonId: lessonContext.lessonId,
        lessonTitle: lessonContext.lessonTitle,
        progressPercent: data?.lastWatched?.progressPercent ?? 0,
      }
    : data?.lastWatched ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        {/* Welcome Banner wrapper — needed to position coins badge outside overflow:hidden */}
        <View style={styles.welcomeWrapper}>
          {/* Welcome Banner */}
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

            {/* Student Illustration */}
            <Image
              source={require('../../assets/student.png')}
              style={styles.studentImage}
              resizeMode="contain"
            />
          </View>

          {/* Coins badge — outside overflow:hidden so touch works */}
          <TouchableOpacity style={styles.coinsBadge} onPress={() => setCoinsModalVisible(true)} activeOpacity={0.7}>
            <Text style={styles.coinsEmoji}>🪙</Text>
            <Text style={styles.coinsText}>{totalCoins}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row — Enrolled Courses + Latest Badge */}
        <View style={styles.statsGrid}>
          {/* Enrolled Courses Card */}
          <TouchableOpacity
            style={[styles.statCard, { borderColor: `${Colors.primary}20` }]}
            onPress={() => router.push('/enrolled-courses')}
            activeOpacity={0.7}
          >
            <View style={[styles.statGlow, { backgroundColor: 'rgba(108,71,255,0.25)' }]} />
            <View style={[styles.statIconWrap, { backgroundColor: `${Colors.primary}20`, borderColor: `${Colors.primary}40` }]}>
              <Text style={styles.statEmoji}>📚</Text>
            </View>
            <Text style={styles.statValue}>{isLoading ? '—' : enrolledCount}</Text>
            <Text style={styles.statLabel}>Enrolled Courses</Text>
          </TouchableOpacity>

          {/* Latest Achievement Badge Card — always visible */}
          <TouchableOpacity
            style={[styles.statCard, { borderColor: `${Colors.warning}20` }]}
            onPress={() => router.push('/achievements')}
            activeOpacity={0.7}
          >
            <View style={[styles.statGlow, { backgroundColor: 'rgba(245,158,11,0.25)' }]} />
            <View style={[styles.statIconWrap, { backgroundColor: `${Colors.warning}20`, borderColor: `${Colors.warning}40` }]}>
              <Text style={styles.statEmoji}>{latestBadge ? (badgeEmoji[latestBadge.badgeType] || '🏅') : '🏆'}</Text>
            </View>
            <Text style={styles.latestBadgeTitle} numberOfLines={1}>
              {latestBadge ? latestBadge.title : 'No Badges Yet'}
            </Text>
            <Text style={styles.statLabel}>{latestBadge ? 'Latest Badge' : 'Earn your first badge!'}</Text>
          </TouchableOpacity>
        </View>

        {/* Continue Learning */}
        {resumeData && (
          <TouchableOpacity
            style={styles.continueCard}
            onPress={() => {
              if (resumeData.lessonId) {
                router.push(`/lesson/${resumeData.lessonId}`);
              } else {
                router.push(`/course/${resumeData.courseId}`);
              }
            }}
          >
            <View style={styles.continueThumbnail}>
              <Text style={styles.continueThumbnailIcon}>▶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.continueCourseTitle}>{resumeData.courseTitle}</Text>
              <Text style={styles.continueMeta}>
                {resumeData.moduleTitle} · {resumeData.lessonTitle}
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${resumeData.progressPercent}%` as any }]} />
              </View>
            </View>
            <View style={styles.resumeBtn}>
              <Text style={styles.resumeBtnText}>Resume ▶</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Recommended for You */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recommended for You</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/courses')}>
            <Text style={styles.seeAll}>View all →</Text>
          </TouchableOpacity>
        </View>

        {(allCoursesData?.courses ?? []).slice(0, 4).map((course) => (
          <TouchableOpacity
            key={course.id}
            style={styles.courseCard}
            onPress={() => router.push(`/course/${course.id}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.courseTitle}>{course.title || ''}</Text>
              <Text style={styles.courseMeta}>{course.subtitle || ''}</Text>
            </View>
            <View style={[styles.priceBadge, { backgroundColor: course.isFree ? Colors.successLight : Colors.primaryLight }]}>
              <Text style={[styles.priceText, { color: course.isFree ? Colors.success : Colors.purple }]}>
                {course.isFree ? 'Free' : 'Pro'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/leaderboard')}>
            <Text style={styles.quickActionEmoji}>🏆</Text>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Leaderboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/downloads')}>
            <Text style={styles.quickActionEmoji}>📥</Text>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Downloads</Text>
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
  welcomeWrapper: {
    margin: 16,
    position: 'relative',
  },
  welcomeBanner: {
    borderRadius: 20, padding: 24, minHeight: 160,
    backgroundColor: '#2e1065',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden', position: 'relative',
  },
  studentImage: {
    position: 'absolute', right: -10, bottom: 0,
    width: 120, height: 140, zIndex: 1, opacity: 0.9,
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
    position: 'absolute', bottom: 12, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4,
    zIndex: 10,
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
  latestBadgeTitle: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 4 },

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
  continueCourseTitle: { color: '#c4b5fd', fontSize: 16, fontWeight: '800', marginBottom: 4 },
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
  courseTitle: { color: '#c4b5fd', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  courseMeta: { color: Colors.muted, fontSize: 11, marginBottom: 10 },
  percent: { fontSize: 16, fontWeight: '800', marginLeft: 8 },
  priceBadge: { borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  priceText: { fontSize: 11, fontWeight: '800' },

  // Quick Actions
  quickActions: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  quickActionBtn: {
    flex: 1, backgroundColor: Colors.card2, borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  quickActionEmoji: { fontSize: 24, marginBottom: 8 },
  quickActionLabel: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
