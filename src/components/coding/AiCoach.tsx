/**
 * ✨ AI Coach — Hints · Algorithm · Optimal Solution · Next Step · Analyze.
 *
 * Shared by the Code Arena problem screen and the lesson exercise editor so a
 * student gets the same help in both places. Everything is derived from the
 * problem's best solution (GET /api/coding-problems/best-solution, which works
 * for course exercise ids too) — no AI call per tap.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Platform } from 'react-native';
import { playgroundApi, type BestSolution } from '@/api';
import {
  getLangSolution, extractHints, detectAlgorithm, nextStepLine, analyzeMistake,
} from '@/components/coding/playgroundAi';

interface Props {
  /** Exercise / problem id used to fetch the best solution. */
  problemId: string;
  /** Already-known best solution (skips the fetch). */
  initialSolution?: BestSolution | null;
  lang: string;
  getCode: () => string;
  /** Optimal Solution: replace the whole editor text. */
  onReplaceCode: (code: string) => void;
  /** Next Step: append one line to the editor. */
  onAppendLine: (line: string) => void;
  /** Called so the screen can switch to its Code pane. */
  onShowCode: () => void;
}

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function AiCoach({ problemId, initialSolution, lang, getCode, onReplaceCode, onAppendLine, onShowCode }: Props) {
  const [solution, setSolution] = useState<BestSolution | null>(initialSolution ?? null);
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<{ title: string; body: ReactNode } | null>(null);

  useEffect(() => {
    if (initialSolution) { setSolution(initialSolution); return; }
    setSolution(null);
    if (!problemId || problemId.startsWith('my-')) return; // custom problems have no server solution
    let alive = true;
    playgroundApi.bestSolution(problemId)
      .then((d) => { if (alive && d?.success && d.solution) setSolution(d.solution); })
      .catch(() => {});
    return () => { alive = false; };
  }, [problemId, initialSolution]);

  const notLoaded = (title: string) => setPanel({
    title, body: <Text style={s.warn}>Best solution not loaded yet. Please wait a moment and try again.</Text>,
  });

  const hints = () => {
    setMenu(false);
    const sol = getLangSolution(solution, lang);
    if (!sol) return notLoaded('💡 Hints');
    const list = extractHints(sol.code || '');
    const tc = sol.timeComplexity || sol.tc; const sc = sol.spaceComplexity || sol.sc;
    setPanel({
      title: '💡 Hints',
      body: (
        <>
          <Text style={s.sub}>Based on optimal {lang.toUpperCase()} solution:</Text>
          {list.map((h, i) => (
            <View key={i} style={s.hintRow}><Text style={s.hintNum}>{i + 1}.</Text><Text style={s.hintBody}>{h}</Text></View>
          ))}
          {!!(tc || sc) && <Text style={s.target}>⏱ Target TC: {tc || '?'} | 💾 Target SC: {sc || '?'}</Text>}
        </>
      ),
    });
  };

  const algorithm = () => {
    setMenu(false);
    const sol = getLangSolution(solution, lang);
    if (!sol) return notLoaded('🔬 Algorithm');
    const a = detectAlgorithm(sol.code || '');
    setPanel({
      title: '🔬 Algorithm',
      body: (
        <>
          <Text style={s.sub}>Algorithm used in optimal {lang.toUpperCase()} solution:</Text>
          <Text style={s.badge}>{a.name}</Text>
          <View style={s.box}><Text style={s.boxText}>{a.explanation}</Text></View>
          {a.steps.length > 0 && (
            <>
              <Text style={s.stepsHead}>STEP-BY-STEP:</Text>
              {a.steps.map((st, i) => (
                <View key={i} style={s.stepRow}><Text style={s.stepArrow}>→</Text><Text style={s.stepText}>{st}</Text></View>
              ))}
            </>
          )}
          <View style={s.chipRow}>
            <Text style={[s.chip, { color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)' }]}>⏱ {sol.timeComplexity || sol.tc || '?'}</Text>
            <Text style={[s.chip, { color: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)' }]}>💾 {sol.spaceComplexity || sol.sc || '?'}</Text>
          </View>
          {!!sol.explanation && <Text style={s.summary}><Text style={{ color: '#22c55e', fontWeight: '800' }}>Summary: </Text>{sol.explanation}</Text>}
        </>
      ),
    });
  };

  const optimal = () => {
    setMenu(false);
    const sol = getLangSolution(solution, lang);
    if (!sol?.code) return notLoaded('💻 Optimal Solution');
    onReplaceCode(sol.code);
    setPanel(null);
    onShowCode();
  };

  const nextStep = () => {
    setMenu(false);
    const sol = getLangSolution(solution, lang);
    if (!sol?.code) return notLoaded('➡️ Next Step');
    const line = nextStepLine(sol.code, getCode());
    if (line === null) {
      setPanel({ title: '➡️ Next Step', body: <Text style={s.ok}>✅ Your code already covers all steps of the optimal solution! Try running or submitting.</Text> });
      return;
    }
    onShowCode();
    onAppendLine(line);
  };

  const analyze = () => {
    setMenu(false);
    const sol = getLangSolution(solution, lang);
    if (!sol?.code) return notLoaded('🔍 Analyze');
    const code = getCode();
    if (!code || code.trim().length < 5) {
      setPanel({ title: '🔍 Analyze', body: <Text style={s.warn}>Write some code first, then analyze.</Text> });
      return;
    }
    const r = analyzeMistake(sol.code, code);
    setPanel({
      title: '🔍 Analyze Mistakes',
      body: r.match ? (
        <Text style={s.ok}>✅ Your code structure matches the optimal solution! Check logic/variable names if output differs.</Text>
      ) : (
        <>
          <Text style={s.coverage}>📊 Solution coverage: {r.coverage}%</Text>
          {r.missing.length > 0 && (
            <>
              <Text style={s.missHead}>❌ MISSING LOGIC ({r.missing.length} LINES):</Text>
              {r.missing.slice(0, 6).map((l, i) => <Text key={i} style={s.missLine}>{l}</Text>)}
              {r.missing.length > 6 && <Text style={s.more}>... and {r.missing.length - 6} more lines</Text>}
            </>
          )}
          {r.extra.length > 0 && (
            <>
              <Text style={s.extraHead}>⚠️ EXTRA/DIFFERENT LINES ({r.extra.length}):</Text>
              {r.extra.slice(0, 4).map((l, i) => <Text key={i} style={s.extraLine}>{l}</Text>)}
              {r.extra.length > 4 && <Text style={s.more}>... and {r.extra.length - 4} more lines</Text>}
            </>
          )}
        </>
      ),
    });
  };

  return (
    <>
      <TouchableOpacity style={s.btn} onPress={() => setMenu(true)} accessibilityLabel="AI Coach">
        <Text style={s.btnText}>✨ AI</Text>
      </TouchableOpacity>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setMenu(false)}>
          <View style={s.menu}>
            <Text style={s.menuTitle}>✨ AI Coach{solution ? '' : '  (getting ready…)'}</Text>
            <Item icon="💡" label="Hints" onPress={hints} />
            <Item icon="🔬" label="Algorithm" onPress={algorithm} />
            <Item icon="💻" label="Optimal Solution" onPress={optimal} />
            <View style={s.sep} />
            <Item icon="➡️" label="Next Step" onPress={nextStep} />
            <Item icon="🔍" label="Analyze My Code" onPress={analyze} />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!panel} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
        <View style={s.panelWrap}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPanel(null)} />
          <View style={s.panel}>
            <View style={s.panelHead}>
              <Text style={s.panelTitle}>{panel?.title}</Text>
              <TouchableOpacity onPress={() => setPanel(null)} hitSlop={10} accessibilityLabel="Close"><Text style={s.close}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>{panel?.body}</ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Item({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.item} onPress={onPress}>
      <Text style={s.itemIcon}>{icon}</Text><Text style={s.itemLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { backgroundColor: 'rgba(108,71,255,0.15)', borderWidth: 1, borderColor: 'rgba(108,71,255,0.35)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  btnText: { color: '#c4b5fd', fontSize: 12, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'flex-end', paddingTop: 130, paddingRight: 12 },
  menu: { width: 240, backgroundColor: '#1a1a2e', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(108,71,255,0.35)', paddingVertical: 8 },
  menuTitle: { color: '#a78bfa', fontSize: 12, fontWeight: '800', paddingHorizontal: 14, paddingVertical: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  itemIcon: { fontSize: 16 },
  itemLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
  panelWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: { maxHeight: '75%', backgroundColor: '#12101f', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)', padding: 16 },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  close: { color: '#fff', fontSize: 18, paddingHorizontal: 6 },
  sub: { color: '#94a3b8', fontSize: 12, marginBottom: 10 },
  warn: { color: '#f59e0b', fontSize: 14, lineHeight: 20 },
  ok: { color: '#22c55e', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  hintRow: { flexDirection: 'row', gap: 8, marginBottom: 8, padding: 10, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.06)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.15)' },
  hintNum: { color: '#fbbf24', fontWeight: '800', fontSize: 13, minWidth: 20 },
  hintBody: { flex: 1, color: '#e2e8f0', fontSize: 13, lineHeight: 19 },
  target: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.06)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  badge: { alignSelf: 'flex-start', color: '#60a5fa', fontSize: 14, fontWeight: '800', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(96,165,250,0.12)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)', marginBottom: 12, overflow: 'hidden' },
  box: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 10 },
  boxText: { color: '#e2e8f0', fontSize: 13, lineHeight: 20 },
  stepsHead: { color: '#a78bfa', fontSize: 11, fontWeight: '800', marginBottom: 6, letterSpacing: 0.5 },
  stepRow: { flexDirection: 'row', gap: 8, padding: 8, marginBottom: 6, borderRadius: 6, backgroundColor: 'rgba(108,71,255,0.05)' },
  stepArrow: { color: '#a78bfa', fontWeight: '800', fontSize: 12 },
  stepText: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 12.5, lineHeight: 18 },
  chipRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  chip: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  summary: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.05)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.12)', color: 'rgba(255,255,255,0.75)', fontSize: 12.5, lineHeight: 19, overflow: 'hidden' },
  coverage: { padding: 10, borderRadius: 8, backgroundColor: 'rgba(108,71,255,0.08)', borderWidth: 1, borderColor: 'rgba(108,71,255,0.2)', color: '#a78bfa', fontSize: 13, fontWeight: '700', marginBottom: 10, overflow: 'hidden' },
  missHead: { color: '#ef4444', fontSize: 11, fontWeight: '800', marginBottom: 6 },
  missLine: { padding: 6, marginBottom: 3, borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', color: '#fca5a5', fontFamily: MONO, fontSize: 12, overflow: 'hidden' },
  extraHead: { color: '#f59e0b', fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  extraLine: { padding: 6, marginBottom: 3, borderRadius: 6, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)', color: '#fde68a', fontFamily: MONO, fontSize: 12, overflow: 'hidden' },
  more: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
});
