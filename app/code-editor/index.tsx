/**
 * Code Editor — problem list. Mobile port of the desktop "Code Editor" page
 * (coding-playground.js): Coding Practice list with category / level filters,
 * the All Problems · My Problems · Coding Score tabs, custom problems, and the
 * per-problem leaderboard.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, Modal, TextInput,
  ActivityIndicator, Alert, RefreshControl, Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { playgroundApi, type PlaygroundProblem, type LeaderboardEntry } from '@/api';
import { useAuthStore } from '@/store';
import { CODING_LANGUAGES, getDefaultStarter, type CodingLangId } from '@/components/coding/codingLanguages';
import {
  loadMyProblems, saveMyProblems, scoreGet, currentStreak, dayKey, type ScoreData,
} from '@/components/coding/playgroundStore';
import { Colors } from '@/theme';

type Tab = 'all' | 'my' | 'score';
const DIFF_COLORS: Record<string, string> = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
const LEVELS = ['All Levels', 'Easy', 'Medium', 'Hard'];
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export default function CodeEditorHome() {
  const userId = useAuthStore((s) => s.user?.id);
  const [tab, setTab] = useState<Tab>('all');
  const [category, setCategory] = useState('All Categories');
  const [level, setLevel] = useState('All Levels');
  const [catOpen, setCatOpen] = useState(false);
  const [myProblems, setMyProblems] = useState<PlaygroundProblem[]>([]);
  const [score, setScore] = useState<ScoreData | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [lb, setLb] = useState<{ title: string; loading: boolean; error?: boolean; list: LeaderboardEntry[]; total: number } | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['pg-problems'],
    queryFn: () => playgroundApi.problems(),
  });
  const problems = useMemo(() => data?.problems ?? [], [data]);
  const categories = useMemo(
    () => ['All Categories', ...(data?.categories?.length ? data.categories : Array.from(new Set(problems.map((p) => p.category).filter(Boolean) as string[])))],
    [data, problems]
  );

  // Reload local data whenever the screen is focused (e.g. back from a solved problem).
  useFocusEffect(useCallback(() => {
    loadMyProblems(userId).then(setMyProblems);
    scoreGet(userId).then(setScore);
  }, [userId]));

  const source = tab === 'my' ? myProblems : problems;
  const filtered = useMemo(() => source.filter((p) => {
    if (category !== 'All Categories' && p.category !== category) return false;
    if (level !== 'All Levels' && (p.difficulty || '').toLowerCase() !== level.toLowerCase()) return false;
    return true;
  }), [source, category, level]);

  const open = (p: PlaygroundProblem) => router.push({ pathname: '/code-editor/[problemId]', params: { problemId: p.id } } as never);

  const deleteProblem = (p: PlaygroundProblem) => {
    Alert.alert('Delete this problem?', p.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: '🗑 Delete', style: 'destructive',
        onPress: async () => {
          const next = myProblems.filter((m) => m.id !== p.id);
          setMyProblems(next);
          await saveMyProblems(userId, next);
        },
      },
    ]);
  };

  const showLeaderboard = async (problemId: string, title: string) => {
    setLb({ title, loading: true, list: [], total: 0 });
    try {
      const r = await playgroundApi.leaderboardGet(problemId);
      if (!r?.success) throw new Error('x');
      setLb({ title, loading: false, list: r.leaderboard ?? [], total: r.totalParticipants ?? 0 });
    } catch {
      setLb({ title, loading: false, error: true, list: [], total: 0 });
    }
  };

  const addProblem = async (p: PlaygroundProblem) => {
    const next = [p, ...myProblems];
    setMyProblems(next);
    await saveMyProblems(userId, next);
    setAddOpen(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back"><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.title}>🚀 Code Arena</Text>
        {tab === 'my' && (
          <TouchableOpacity onPress={() => setAddOpen(true)} style={styles.addBtn} accessibilityLabel="Add custom problem">
            <Text style={styles.addText}>＋</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabs}>
        {([['all', '🎯 Challenges'], ['my', '⭐ My Own'], ['score', '🏆 Scoreboard']] as [Tab, string][]).map(([k, label]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]} numberOfLines={1}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab !== 'score' && (
        <View style={styles.filters}>
          <TouchableOpacity style={styles.catBtn} onPress={() => setCatOpen(true)}>
            <Text style={styles.catText} numberOfLines={1}>{category}  ▾</Text>
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
            {LEVELS.map((l) => (
              <TouchableOpacity key={l} style={[styles.chip, level === l && styles.chipOn]} onPress={() => setLevel(l)}>
                <Text style={[styles.chipText, level === l && { color: '#fff' }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {tab === 'score' ? (
        <ScoreTab data={score} onRank={showLeaderboard} />
      ) : tab === 'all' && isLoading ? (
        <View style={styles.centerFill}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : tab === 'all' && isError && problems.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.muted}>Could not load problems.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 40, flexGrow: 1 }}
          refreshControl={tab === 'all' ? <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={Colors.primary} /> : undefined}
          ListEmptyComponent={
            tab === 'my' && myProblems.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={styles.emptyTitle}>No challenges of your own yet.</Text>
                <Text style={styles.muted}>Tap ＋ to create one!</Text>
              </View>
            ) : (
              <View style={styles.empty}><Text style={styles.muted}>No problems found for this filter.</Text></View>
            )
          }
          renderItem={({ item }) => {
            const d = (item.difficulty || 'medium').toLowerCase();
            const c = DIFF_COLORS[d] || '#f59e0b';
            const solved = !!score?.solvedProblems.some((s) => s.problemId === item.id);
            return (
              <TouchableOpacity style={styles.card} onPress={() => open(item)} activeOpacity={0.8}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{solved ? '✅ ' : ''}{item.title}</Text>
                  <View style={styles.cardMeta}>
                    <View style={[styles.diff, { backgroundColor: c + '20', borderColor: c + '40' }]}>
                      <Text style={[styles.diffText, { color: c }]}>{d}</Text>
                    </View>
                    {!!item.category && <Text style={styles.cat} numberOfLines={1}>{item.category}</Text>}
                  </View>
                </View>
                {tab === 'my' && (
                  <TouchableOpacity onPress={() => deleteProblem(item)} hitSlop={10} style={styles.menuBtn} accessibilityLabel="Delete problem">
                    <Text style={styles.menuText}>🗑</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Category picker */}
      <Modal visible={catOpen} transparent animationType="fade" onRequestClose={() => setCatOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setCatOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Category</Text>
            <ScrollView>
              {categories.map((c) => (
                <TouchableOpacity key={c} style={styles.sheetRow} onPress={() => { setCategory(c); setCatOpen(false); }}>
                  <Text style={[styles.sheetRowText, c === category && { color: Colors.purple, fontWeight: '800' }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <AddProblemModal visible={addOpen} onClose={() => setAddOpen(false)} onAdd={addProblem} categories={categories.slice(1)} />

      {/* Leaderboard popup */}
      <Modal visible={!!lb} transparent animationType="fade" onRequestClose={() => setLb(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setLb(null)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} numberOfLines={2}>🏆 Leaderboard — {lb?.title}</Text>
              <TouchableOpacity onPress={() => setLb(null)} hitSlop={10}><Text style={styles.close}>✕</Text></TouchableOpacity>
            </View>
            {lb?.loading ? <ActivityIndicator color={Colors.primary} style={{ margin: 24 }} />
              : lb?.error ? <Text style={[styles.muted, { padding: 20, textAlign: 'center' }]}>Could not load leaderboard.</Text>
              : (
                <ScrollView>
                  <Text style={styles.participants}>{lb?.total} participants</Text>
                  {lb && lb.list.length === 0 ? (
                    <Text style={[styles.muted, { padding: 24, textAlign: 'center' }]}>No submissions yet. Be the first!</Text>
                  ) : lb?.list.map((e) => {
                    const rc = e.rank <= 3 ? '#fbbf24' : e.rank <= 20 ? '#22c55e' : e.rank <= 50 ? '#60a5fa' : '#94a3b8';
                    return (
                      <View key={`${e.rank}-${e.name}`} style={styles.lbRow}>
                        <Text style={[styles.lbRank, { color: rc }]}>#{e.rank}</Text>
                        <Text style={styles.lbName} numberOfLines={1}>{e.name}</Text>
                        {e.coins > 0 && <Text style={styles.lbCoins}>+{e.coins}🪙</Text>}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Coding Score tab ─────────────────────────────────────────────────────────
function ScoreTab({ data, onRank }: { data: ScoreData | null; onRank: (id: string, title: string) => void }) {
  if (!data) return <View style={styles.centerFill}><ActivityIndicator color={Colors.primary} /></View>;
  const streak = currentStreak(data.submissionCalendar);
  const progress = Math.min(streak, 7);
  const totalSubs = Object.values(data.submissionCalendar).reduce((s, v) => s + v, 0);
  const cells: { key: string; count: number }[] = [];
  for (let d = 48; d >= 0; d--) {
    const dt = new Date(); dt.setDate(dt.getDate() - d);
    const k = dayKey(dt);
    cells.push({ key: k, count: data.submissionCalendar[k] || 0 });
  }
  const solved = [...data.solvedProblems].sort((a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime());

  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
      <View style={styles.scoreCard}>
        <Text style={styles.scoreNum}>{data.totalPoints}</Text>
        <Text style={styles.scoreLbl}>Total Points</Text>
        <Text style={styles.scoreCoins}>🪙 {data.totalCoins} coins earned</Text>
      </View>

      <View style={styles.streakCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.streakTitle}>🔥 Current Streak: {streak} day{streak !== 1 ? 's' : ''}</Text>
          {streak >= 7
            ? <Text style={styles.streakOn}>✅ Streak Active!</Text>
            : <Text style={styles.muted}>{7 - progress} more to bonus</Text>}
        </View>
        <View style={styles.segRow}>
          {Array.from({ length: 7 }).map((_, i) => <View key={i} style={[styles.seg, i < progress && styles.segOn]} />)}
        </View>
        <Text style={[styles.muted, { marginTop: 6, fontSize: 11 }]}>Complete 7 consecutive days → +10 bonus coins 🪙</Text>
      </View>

      <View style={styles.heatCard}>
        <Text style={styles.heatTitle}>{totalSubs} Submissions in {new Date().getFullYear()}</Text>
        <View style={styles.heat}>
          {cells.map((c) => (
            <View key={c.key} style={[styles.heatCell, { backgroundColor: `rgba(34,197,94,${c.count === 0 ? 0.1 : c.count === 1 ? 0.4 : c.count === 2 ? 0.6 : 0.9})` }]} />
          ))}
        </View>
      </View>

      {solved.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.muted}>No problems solved yet.{'\n'}Start solving to earn points!</Text>
        </View>
      ) : (
        <>
          <Text style={styles.solvedHead}>Solved Problems ({solved.length})</Text>
          {solved.map((s) => {
            const c = DIFF_COLORS[s.difficulty] || '#f59e0b';
            return (
              <View key={s.problemId} style={styles.solvedCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.solvedTitle} numberOfLines={1}>✅ {s.title}</Text>
                  <View style={[styles.diff, { backgroundColor: c + '20', borderColor: c + '40' }]}>
                    <Text style={[styles.diffText, { color: c }]}>{(s.difficulty || '').toUpperCase()}</Text>
                  </View>
                </View>
                <View style={[styles.rowBetween, { marginTop: 6 }]}>
                  <Text style={styles.solvedMeta} numberOfLines={1}>
                    <Text style={{ color: '#a78bfa' }}>+{s.points}pts  </Text>
                    <Text style={{ color: '#fbbf24' }}>+{s.coins}🪙  </Text>
                    {(s.language || '').toUpperCase()}  {new Date(s.solvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity style={styles.rankBtn} onPress={() => onRank(s.problemId, s.title)}>
                    <Text style={styles.rankBtnText}>🏆 Rank</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

// ── Add custom problem ───────────────────────────────────────────────────────
function AddProblemModal({ visible, onClose, onAdd, categories }: {
  visible: boolean; onClose: () => void; onAdd: (p: PlaygroundProblem) => void; categories: string[];
}) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('');
  const [diff, setDiff] = useState('easy');
  const [lang, setLang] = useState<CodingLangId>('java');
  const [tin, setTin] = useState('');
  const [tout, setTout] = useState('');
  const [err, setErr] = useState('');

  const reset = () => { setTitle(''); setDesc(''); setCat(''); setDiff('easy'); setLang('java'); setTin(''); setTout(''); setErr(''); };

  const submit = () => {
    if (!title.trim() || !desc.trim()) { setErr('⚠ Title and Description are required.'); return; }
    onAdd({
      id: 'my-' + Date.now(),
      title: title.trim(),
      description: desc.trim(),
      category: cat.trim() || 'My Problems',
      difficulty: diff,
      defaultLanguage: lang,
      lockedLanguage: true,
      starterCode: { [lang]: getDefaultStarter(lang) },
      testCases: tin.trim() || tout.trim() ? [{ input: tin, expectedOutput: tout, isHidden: false }] : [],
    });
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={10}><Text style={styles.back}>✕</Text></TouchableOpacity>
          <Text style={styles.title}>➕ Create Your Own Challenge</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Sum of two numbers" placeholderTextColor={Colors.muted} />
          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]} value={desc} onChangeText={setDesc} multiline placeholder="Describe the problem" placeholderTextColor={Colors.muted} />
          <Text style={styles.label}>Category</Text>
          <TextInput style={styles.input} value={cat} onChangeText={setCat} placeholder={categories[0] || 'e.g. Arrays'} placeholderTextColor={Colors.muted} />
          <Text style={styles.label}>Difficulty</Text>
          <View style={styles.pickRow}>
            {['easy', 'medium', 'hard'].map((d) => (
              <TouchableOpacity key={d} style={[styles.chip, diff === d && styles.chipOn]} onPress={() => setDiff(d)}>
                <Text style={[styles.chipText, diff === d && { color: '#fff' }]}>{d[0].toUpperCase() + d.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Language (locked once created)</Text>
          <View style={styles.pickRow}>
            {CODING_LANGUAGES.map((l) => (
              <TouchableOpacity key={l.id} style={[styles.chip, lang === l.id && styles.chipOn]} onPress={() => setLang(l.id)}>
                <Text style={[styles.chipText, lang === l.id && { color: '#fff' }]}>{l.icon} {l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Test case — Input</Text>
          <TextInput style={[styles.input, styles.mono, { minHeight: 60, textAlignVertical: 'top' }]} value={tin} onChangeText={setTin} multiline autoCapitalize="none" autoCorrect={false} />
          <Text style={styles.label}>Test case — Expected output</Text>
          <TextInput style={[styles.input, styles.mono, { minHeight: 60, textAlignVertical: 'top' }]} value={tout} onChangeText={setTout} multiline autoCapitalize="none" autoCorrect={false} />
          {!!err && <Text style={styles.err}>{err}</Text>}
          <TouchableOpacity style={styles.saveBtn} onPress={submit}><Text style={styles.saveText}>Add Problem</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { color: Colors.primary, fontSize: 22, fontWeight: '700', paddingRight: 4 },
  title: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '800' },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: -2 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: Colors.primary },
  tabText: { color: Colors.muted, fontSize: 12, fontWeight: '700' },
  tabTextOn: { color: '#fff' },
  filters: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  catBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '100%' },
  catText: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  chip: { borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.04)' },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: Colors.muted, fontSize: 13 },
  retry: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8 },
  retryText: { color: '#fff', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyIcon: { fontSize: 30 },
  emptyTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.border },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  cat: { flex: 1, color: Colors.purple, fontSize: 11, fontWeight: '600' },
  diff: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  diffText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  menuBtn: { paddingLeft: 12 },
  menuText: { fontSize: 18 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#1a1a2e', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)', padding: 16, maxHeight: '75%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  sheetTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 8 },
  sheetRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  sheetRowText: { color: Colors.text, fontSize: 14 },
  close: { color: '#fff', fontSize: 16, paddingHorizontal: 6 },
  participants: { color: '#94a3b8', fontSize: 12, marginBottom: 10 },
  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, marginBottom: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  lbRank: { width: 40, fontSize: 13, fontWeight: '800' },
  lbName: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  lbCoins: { color: '#fbbf24', fontSize: 12, fontWeight: '700' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  scoreCard: { padding: 18, borderRadius: 14, backgroundColor: 'rgba(108,71,255,0.12)', borderWidth: 1, borderColor: 'rgba(108,71,255,0.2)', alignItems: 'center', marginBottom: 12 },
  scoreNum: { color: '#fff', fontSize: 34, fontWeight: '800' },
  scoreLbl: { color: '#a78bfa', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  scoreCoins: { color: '#fbbf24', fontSize: 15, fontWeight: '700' },
  streakCard: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.06)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)', marginBottom: 12 },
  streakTitle: { color: '#fbbf24', fontSize: 13, fontWeight: '700' },
  streakOn: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  segRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' },
  segOn: { backgroundColor: '#fbbf24' },
  heatCard: { padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  heatTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  heat: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  heatCell: { width: '13%', aspectRatio: 1, borderRadius: 3 },
  solvedHead: { color: Colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  solvedCard: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  solvedTitle: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '700' },
  solvedMeta: { flex: 1, color: Colors.muted, fontSize: 11 },
  rankBtn: { backgroundColor: 'rgba(108,71,255,0.1)', borderWidth: 1, borderColor: 'rgba(108,71,255,0.25)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  rankBtnText: { color: '#a78bfa', fontSize: 11, fontWeight: '700' },

  label: { color: Colors.muted, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, color: Colors.text, fontSize: 14 },
  mono: { fontFamily: MONO, fontSize: 13 },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  err: { color: Colors.danger, marginTop: 12, fontSize: 13 },
  saveBtn: { marginTop: 20, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
