/**
 * Leaderboard for ONE lesson. Opened from the 🏆 button under the lesson video.
 * Two boards: the lesson quiz and the lesson coding exercises. Everyone who
 * attempted it is listed. (The Home leaderboard is the course-wide learning score.)
 */
import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { lessonLeaderboardApi, type LessonBoardRow } from '@/api/misc.api';
import { Colors } from '@/theme';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
type Kind = 'quiz' | 'exercise';

export function LessonLeaderboardModal({ visible, lessonId, lessonTitle, onClose }: {
  visible: boolean; lessonId: string; lessonTitle?: string; onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>('quiz');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['lesson-leaderboard', lessonId, kind],
    queryFn: () => lessonLeaderboardApi.get(lessonId, kind),
    enabled: visible && !!lessonId,
    staleTime: 20_000,
  });

  const rows: LessonBoardRow[] = data?.leaderboard ?? [];
  const me = data?.currentUserRank;
  const detail = (r: LessonBoardRow) =>
    kind === 'quiz'
      ? `${r.correctCount ?? 0}/${r.totalQuestions ?? data?.totalQuestions ?? 0} correct`
      : `${r.passed ?? 0}/${r.totalExercises ?? data?.totalExercises ?? 0} solved`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>🏆 Lesson Leaderboard</Text>
            {!!lessonTitle && <Text style={s.sub} numberOfLines={1}>{lessonTitle}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={s.close}>✕ Close</Text></TouchableOpacity>
        </View>

        <View style={s.tabs}>
          {(['quiz', 'exercise'] as Kind[]).map((k) => (
            <TouchableOpacity key={k} style={[s.tab, kind === k && s.tabOn]} onPress={() => setKind(k)} activeOpacity={0.8}>
              <Text style={[s.tabText, kind === k && s.tabTextOn]}>{k === 'quiz' ? '🧠 Quiz' : '💻 Exercise'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={s.content}>
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
          ) : isError ? (
            <View style={s.center}>
              <Text style={s.muted}>Couldn't load the leaderboard.</Text>
              <TouchableOpacity style={s.retry} onPress={() => refetch()}><Text style={s.retryText}>Retry</Text></TouchableOpacity>
            </View>
          ) : rows.length === 0 ? (
            <View style={s.center}>
              <Text style={{ fontSize: 40 }}>{kind === 'quiz' ? '🧠' : '💻'}</Text>
              <Text style={s.emptyTitle}>
                {kind === 'exercise' && data?.totalExercises === 0 ? 'No coding exercise in this lesson' : 'Nobody has attempted it yet'}
              </Text>
              <Text style={s.muted}>
                {kind === 'exercise' && data?.totalExercises === 0 ? 'Try the Quiz leaderboard.' : 'Be the first and take the top spot!'}
              </Text>
            </View>
          ) : (
            <>
              {me && (
                <View style={s.meCard}>
                  <Text style={s.meLabel}>Your rank</Text>
                  <Text style={s.meRank}>#{me.rank} <Text style={s.meOf}>of {me.totalStudents}</Text></Text>
                </View>
              )}
              <Text style={s.hint}>
                {kind === 'quiz'
                  ? 'Ranked by your first answer to each question: score, then speed.'
                  : 'Ranked by exercises solved, then who finished first.'}
              </Text>
              {rows.map((r) => (
                <View key={r.rank} style={[s.row, r.rank <= 3 && s.rowTop, r.isCurrentUser && s.rowMe]}>
                  <Text style={s.rank}>{MEDALS[r.rank] ?? r.rank}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={1}>{r.name}{r.isCurrentUser ? '  (You)' : ''}</Text>
                    <Text style={s.meta}>{detail(r)}</Text>
                  </View>
                  <Text style={s.score}>{r.score}%</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  sub: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  close: { color: Colors.danger, fontSize: 13, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tabOn: { backgroundColor: 'rgba(108,71,255,0.25)', borderColor: Colors.primary },
  tabText: { color: Colors.muted, fontSize: 14, fontWeight: '700' },
  tabTextOn: { color: '#fff' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  center: { alignItems: 'center', gap: 8, marginTop: 50 },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  muted: { color: Colors.muted, fontSize: 13, textAlign: 'center' },
  retry: { backgroundColor: Colors.primaryLight, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10, marginTop: 6 },
  retryText: { color: Colors.primary, fontWeight: '700' },
  meCard: { backgroundColor: 'rgba(108,71,255,0.15)', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(108,71,255,0.35)' },
  meLabel: { color: '#a78bfa', fontSize: 12, fontWeight: '700' },
  meRank: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 2 },
  meOf: { color: Colors.muted, fontSize: 14, fontWeight: '600' },
  hint: { color: Colors.muted, fontSize: 11.5, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  rowTop: { backgroundColor: 'rgba(251,191,36,0.07)', borderColor: 'rgba(251,191,36,0.2)' },
  rowMe: { borderColor: 'rgba(167,139,250,0.7)', backgroundColor: 'rgba(108,71,255,0.14)' },
  rank: { color: '#fff', fontSize: 16, fontWeight: '800', width: 34, textAlign: 'center' },
  name: { color: '#fff', fontSize: 14, fontWeight: '700' },
  meta: { color: Colors.muted, fontSize: 11.5, marginTop: 2 },
  score: { color: Colors.success, fontSize: 15, fontWeight: '800' },
});
