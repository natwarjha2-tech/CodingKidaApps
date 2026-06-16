import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useDashboard } from '@/hooks';
import { leaderboardApi } from '@/api';
import { Colors } from '@/theme';

const rankMedals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardScreen() {
  const { data: dashData } = useDashboard();
  const enrolledCourses = dashData?.enrolledCourses ?? [];
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    enrolledCourses.length > 0 ? enrolledCourses[0].id : null
  );

  // Update selectedCourseId when enrolledCourses load
  const courseId = selectedCourseId ?? enrolledCourses[0]?.id ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', courseId],
    queryFn: () => leaderboardApi.get(courseId),
    enabled: !!courseId,
  });

  const leaderboard = data?.leaderboard ?? [];
  const currentUserRank = data?.currentUserRank;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Course Selector */}
      {enrolledCourses.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContainer}
        >
          {enrolledCourses.map((course) => (
            <TouchableOpacity
              key={course.id}
              style={[
                styles.pill,
                courseId === course.id && styles.pillActive,
              ]}
              onPress={() => setSelectedCourseId(course.id)}
            >
              <Text
                style={[
                  styles.pillText,
                  courseId === course.id && styles.pillTextActive,
                ]}
                numberOfLines={1}
              >
                {course.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {!courseId ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={styles.emptyTitle}>No courses enrolled</Text>
            <Text style={styles.emptyText}>Enroll in a course to see leaderboard rankings.</Text>
          </View>
        ) : isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading leaderboard...</Text>
          </View>
        ) : leaderboard.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={styles.emptyTitle}>No leaderboard data yet</Text>
            <Text style={styles.emptyText}>Complete quizzes to appear on the leaderboard!</Text>
          </View>
        ) : (
          <>
            {/* Current User Rank Highlight */}
            {currentUserRank && (
              <View style={styles.currentUserCard}>
                <Text style={styles.currentUserLabel}>Your Rank</Text>
                <View style={styles.currentUserRow}>
                  <Text style={styles.currentUserRank}>#{currentUserRank.rank}</Text>
                  <Text style={styles.currentUserScore}>
                    {currentUserRank.scorePercent ?? currentUserRank.score ?? 0}%
                  </Text>
                </View>
              </View>
            )}

            {/* Leaderboard List */}
            {leaderboard.map((entry, index) => {
              const rank = entry.rank ?? index + 1;
              const isTop3 = rank <= 3;
              const isCurrentUser = entry.isCurrentUser;

              return (
                <View
                  key={entry.userId || index}
                  style={[
                    styles.leaderboardRow,
                    isTop3 && styles.leaderboardRowTop3,
                    isCurrentUser && styles.leaderboardRowYou,
                  ]}
                >
                  <View style={styles.rankWrap}>
                    {isTop3 ? (
                      <Text style={styles.rankMedal}>{rankMedals[rank]}</Text>
                    ) : (
                      <Text style={styles.rankNumber}>{rank}</Text>
                    )}
                  </View>
                  <View style={styles.entryInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.entryName} numberOfLines={1}>
                        {entry.name || 'Student'}
                      </Text>
                      {isCurrentUser && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>You</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.entryScore}>
                    {entry.scorePercent ?? entry.score ?? 0}%
                  </Text>
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

  // Course Pills
  pillsContainer: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  pillText: { color: Colors.muted, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: Colors.primary },

  // Loading / Empty
  loadingState: { alignItems: 'center', padding: 60, gap: 12 },
  loadingText: { color: Colors.muted, fontSize: 14 },
  emptyState: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: Colors.muted, fontSize: 14, textAlign: 'center' },

  // Current User Card
  currentUserCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  currentUserLabel: { color: Colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  currentUserRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  currentUserRank: { color: '#fff', fontSize: 24, fontWeight: '800' },
  currentUserScore: { color: Colors.primary, fontSize: 18, fontWeight: '700' },

  // Leaderboard Rows
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  leaderboardRowTop3: {
    borderColor: 'rgba(245,158,11,0.3)',
    backgroundColor: 'rgba(245,158,11,0.05)',
  },
  leaderboardRowYou: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  rankWrap: { width: 36, alignItems: 'center' },
  rankMedal: { fontSize: 22 },
  rankNumber: { color: Colors.muted, fontSize: 14, fontWeight: '700' },
  entryInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryName: { color: '#fff', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  youBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  youBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  entryScore: { color: Colors.success, fontSize: 14, fontWeight: '700' },
});
