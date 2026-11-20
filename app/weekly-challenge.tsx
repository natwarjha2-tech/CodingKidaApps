/**
 * Weekly Coding Challenge — one logic program a week (C / C++ / Java / Python,
 * picked from the course coding exercises). Same question for every student;
 * a new one every Monday. Solve it (all tests pass) for 10 coins, once a week.
 */
import { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { weeklyCodingApi } from '@/api';
import { Colors } from '@/theme';

const LANG_LABEL: Record<string, string> = { c: 'C', cpp: 'C++', java: 'Java', python: 'Python' };
const DIFF_COLOR: Record<string, string> = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };

function fmtDay(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function WeeklyChallengeScreen() {
  const info = useQuery({ queryKey: ['weekly-coding'], queryFn: () => weeklyCodingApi.get(), staleTime: 60_000 });
  const board = useQuery({ queryKey: ['weekly-coding-board'], queryFn: () => weeklyCodingApi.leaderboard(), staleTime: 60_000 });

  useFocusEffect(useCallback(() => { info.refetch(); board.refetch(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const data = info.data;
  const ex = data?.exercise;
  const diff = (ex?.difficulty || 'medium').toLowerCase();

  const start = () => {
    if (!ex) return;
    router.push({ pathname: '/coding/[exerciseId]', params: { exerciseId: ex.id, weekly: '1' } } as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Weekly Challenge</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={info.isRefetching} onRefresh={() => { info.refetch(); board.refetch(); }} tintColor={Colors.primary} />}
      >
        {info.isLoading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
        ) : info.isError || !data?.success ? (
          <View style={styles.center}>
            <Text style={styles.muted}>Couldn't load this week's challenge.</Text>
            <TouchableOpacity style={styles.retry} onPress={() => info.refetch()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
          </View>
        ) : !ex ? (
          <View style={styles.center}><Text style={styles.muted}>No challenge this week yet. Check back soon!</Text></View>
        ) : (
          <>
            {/* This week's problem */}
            <View style={styles.card}>
              <Text style={styles.week}>📅 {fmtDay(data.week.start)} – {fmtDay(data.week.end)}</Text>
              <Text style={styles.title}>{ex.title}</Text>
              <View style={styles.tags}>
                {!!ex.language && <Text style={styles.tag}>{LANG_LABEL[ex.language] || ex.language}</Text>}
                <Text style={[styles.tag, { color: DIFF_COLOR[diff] || '#f59e0b', borderColor: (DIFF_COLOR[diff] || '#f59e0b') + '66' }]}>{diff}</Text>
                <Text style={[styles.tag, styles.coinTag]}>🪙 up to {data.reward} coins · +{data.xp ?? 50} XP</Text>
              </View>
              <Text style={styles.desc} numberOfLines={6}>{ex.description}</Text>

              {data.completed ? (
                <View style={styles.doneBox}>
                  <Text style={styles.doneText}>
                    {data.medal ? `${data.medal.icon} ${data.medal.label}` : '✅ Solved'} this week! You earned {data.coinsEarned ?? 0} coins and {data.xp ?? 50} XP.
                  </Text>
                  <TouchableOpacity onPress={start}><Text style={styles.link}>Open the code again →</Text></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.startBtn} onPress={start} activeOpacity={0.85}>
                  <Text style={styles.startText}>Start coding ▶</Text>
                </TouchableOpacity>
              )}
              <View style={styles.tiers}>
                <Text style={styles.tiersHead}>Pass every test case to win a medal:</Text>
                <Text style={styles.tierLine}>🏆 1st · Weekly Champion · {data.rewards?.champion ?? 15} coins</Text>
                <Text style={styles.tierLine}>🎖️ 2nd–3rd · Weekly Finalist · {data.rewards?.finalist ?? 10} coins</Text>
                <Text style={styles.tierLine}>✅ Everyone else · Weekly Solver · {data.rewards?.solver ?? 5} coins</Text>
                <Text style={styles.note}>A new challenge comes every Monday.</Text>
              </View>
            </View>

            {/* This week's leaderboard */}
            <Text style={styles.section}>🏆 This week's solvers</Text>
            {board.isLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
            ) : !board.data?.leaderboard?.length ? (
              <Text style={styles.muted}>Nobody has solved it yet. Be the first!</Text>
            ) : (
              <>
                {board.data.currentUserRank && (
                  <Text style={styles.myRank}>You are #{board.data.currentUserRank.rank} of {board.data.totalSolvers} solvers</Text>
                )}
                {board.data.leaderboard.map((r) => (
                  <View key={r.rank} style={[styles.row, r.isCurrentUser && styles.rowMe]}>
                    <Text style={styles.rank}>{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : `#${r.rank}`}</Text>
                    <Text style={styles.name} numberOfLines={1}>{r.name}{r.isCurrentUser ? ' (You)' : ''}</Text>
                    <Text style={styles.weeks}>{r.weeksSolved} wk{r.weeksSolved === 1 ? '' : 's'}</Text>
                  </View>
                ))}
              </>
            )}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  back: { color: Colors.primary, fontSize: 20, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { padding: 16 },
  center: { alignItems: 'center', marginTop: 60, gap: 12 },
  muted: { color: Colors.muted, fontSize: 13, textAlign: 'center' },
  retry: { backgroundColor: Colors.primaryLight, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: Colors.primary, fontWeight: '700' },
  card: {
    backgroundColor: 'rgba(108,71,255,0.1)', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)', marginBottom: 22,
  },
  week: { color: Colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: {
    color: '#c4b5fd', fontSize: 11.5, fontWeight: '700', borderWidth: 1, borderColor: 'rgba(196,181,253,0.4)',
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden', textTransform: 'capitalize',
  },
  coinTag: { color: '#fbbf24', borderColor: 'rgba(251,191,36,0.5)', textTransform: 'none', flexShrink: 1, lineHeight: 17, paddingVertical: 4 },
  desc: { color: '#e2e8f0', fontSize: 13.5, lineHeight: 20, marginBottom: 16 },
  startBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  startText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  doneBox: { backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 12, padding: 12, gap: 6 },
  doneText: { color: '#4ade80', fontSize: 13.5, fontWeight: '700' },
  link: { color: '#a78bfa', fontSize: 13, fontWeight: '700' },
  tiers: { marginTop: 14, gap: 5 },
  tiersHead: { color: '#e2e8f0', fontSize: 12.5, fontWeight: '700', marginBottom: 2 },
  tierLine: { color: '#cbd5e1', fontSize: 12.5, lineHeight: 18 },
  note: { color: Colors.muted, fontSize: 11.5, marginTop: 10, textAlign: 'center' },
  section: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  myRank: { color: '#a78bfa', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 6, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  rowMe: { borderColor: 'rgba(167,139,250,0.6)', backgroundColor: 'rgba(108,71,255,0.12)' },
  rank: { color: '#fff', fontSize: 15, fontWeight: '800', width: 38 },
  name: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  weeks: { color: Colors.muted, fontSize: 12, fontWeight: '700' },
});
