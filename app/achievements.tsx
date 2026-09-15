import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { achievementsApi } from '@/api';
import { Colors } from '@/theme';
import type { Achievement } from '@/types';

const badgeEmoji: Record<string, string> = {
  'super-master': '🥇',
  master: '🥈',
  pro: '🥉',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AchievementsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => achievementsApi.get(),
    staleTime: 1000 * 60 * 5, // 5 min cache - instant on revisit
  });

  const achievements: Achievement[] = data?.achievements ?? [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Achievements</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Badges earned count (mirrors desktop) */}
        {!isLoading && achievements.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>🏆 {achievements.length} Badge{achievements.length !== 1 ? 's' : ''} Earned</Text>
          </View>
        )}
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading achievements...</Text>
          </View>
        ) : achievements.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={styles.emptyTitle}>No achievements yet</Text>
            <Text style={styles.emptyText}>Complete quizzes to earn achievements!</Text>
          </View>
        ) : (
          achievements.map((achievement) => (
            <View key={achievement.id} style={styles.achievementCard}>
              <View style={styles.badgeWrap}>
                <Text style={styles.badgeEmoji}>
                  {badgeEmoji[achievement.badgeType] || '🏅'}
                </Text>
              </View>
              <View style={styles.achievementInfo}>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                {achievement.courseTitle && (
                  <Text style={styles.achievementMeta}>
                    {achievement.courseTitle}
                    {achievement.lessonTitle ? ` · ${achievement.lessonTitle}` : ''}
                  </Text>
                )}
                <View style={styles.statsRow}>
                  {achievement.score != null && (
                    <View style={styles.statBadge}>
                      <Text style={styles.statBadgeText}>Score: {achievement.score}</Text>
                    </View>
                  )}
                  {achievement.rank != null && (
                    <View style={[styles.statBadge, { backgroundColor: Colors.warningLight }]}>
                      <Text style={[styles.statBadgeText, { color: Colors.warning }]}>
                        Rank #{achievement.rank}
                      </Text>
                    </View>
                  )}
                </View>
                {/* Awarded to + Instructor · date (mirrors desktop) */}
                {achievement.studentName ? (
                  <Text style={styles.metaLine}>
                    Awarded to: <Text style={styles.metaHighlight}>{achievement.studentName}</Text>
                  </Text>
                ) : null}
                <Text style={styles.metaLine}>
                  {achievement.instructor ? `Instructor: ${achievement.instructor} · ` : ''}
                  {formatDate(achievement.earnedAt || achievement.createdAt)}
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
  loadingState: { alignItems: 'center', padding: 60, gap: 12 },
  loadingText: { color: Colors.muted, fontSize: 14 },
  emptyState: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: Colors.muted, fontSize: 14 },
  achievementCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  badgeWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 26 },
  achievementInfo: { flex: 1 },
  achievementTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  achievementMeta: { color: Colors.muted, fontSize: 12, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  statBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statBadgeText: { color: Colors.primary, fontSize: 11, fontWeight: '600' },
  dateText: { color: Colors.muted, fontSize: 11 },
  countBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16,
  },
  countBadgeText: { color: '#fbbf24', fontSize: 12, fontWeight: '700' },
  metaLine: { color: Colors.muted, fontSize: 11, lineHeight: 17 },
  metaHighlight: { color: '#fff', fontWeight: '600' },
});
