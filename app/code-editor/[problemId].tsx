/**
 * Code Editor — problem screen. Mobile port of the desktop playground
 * (codingkidadesktop/src/renderer/coding-playground.js).
 *
 *  - Problem view, language (locked for course exercises / custom problems)
 *  - Auto-save per problem + language, Format, dark/light theme, font size
 *  - AI ▾ : Hints · Algorithm · Optimal Solution · Next Step · Analyze
 *    (heuristics over the preloaded best solution — no AI call per tap)
 *  - Run → /api/code/run (+ complexity), Submit → every test case via /api/code/run
 *  - Score + 7-day streak + problem leaderboard rank on first accepted solve
 *  - Local submission history, C/Java compile-check underline
 *
 * Code runs on the SERVER — the phone only edits text. /api/code/run is rate
 * limited (10/min), so test cases run 2 at a time and retry when throttled.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Keyboard,
  Platform, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import {
  codeApi, playgroundApi, type PlaygroundProblem, type BestSolution, type CodeRunResult,
} from '@/api';
import { CodeEditorWebView, type CodeEditorHandle, type EditorTheme } from '@/components/coding/CodeEditorWebView';
import {
  CODING_LANGUAGES, getLanguage, getDefaultStarter, isDefaultOrEmpty, THEME_KEY, FONT_KEY, type CodingLangId,
} from '@/components/coding/codingLanguages';
import {
  getLangSolution, extractHints, detectAlgorithm, nextStepLine, analyzeMistake, formatCode, camelFileName,
} from '@/components/coding/playgroundAi';
import {
  loadPgCode, savePgCode, loadMyProblems, loadHistory, addHistory, scoreAward, type PgSubmission,
} from '@/components/coding/playgroundStore';
import { Colors } from '@/theme';

type Pane = 'problem' | 'code' | 'output' | 'history';
type OutTab = 'output' | 'results';
type ExtraProblem = PlaygroundProblem & { bestSolution?: BestSolution; courseId?: string; lessonId?: string };

interface TcResult { n: number; passed: boolean; hidden: boolean; input: string; expected: string; actual: string; status: string; time?: string | null }
type RunView =
  | { kind: 'idle' } | { kind: 'busy'; text: string } | { kind: 'error'; text: string }
  | { kind: 'run'; data: CodeRunResult; tc?: string; sc?: string };
type SubmitView =
  | { kind: 'idle' } | { kind: 'busy'; text: string } | { kind: 'error'; text: string }
  | { kind: 'noTests' }
  | { kind: 'result'; results: TcResult[]; passed: number; total: number; rank?: number; coinsAwarded?: number };

const DIFF_COLORS: Record<string, string> = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
const SAVE_DEBOUNCE_MS = 1500;
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const RUN_CONCURRENCY = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isConnErr = (m: string) => /network error|timeout|ECONN|Failed to fetch/i.test(m);
const isThrottled = (m: string) => /too many|rate|limit|429|slow down/i.test(m);

/** /api/code/run with retry while throttled (10 requests / minute). */
async function runOnce(body: { source_code: string; language_id: number; stdin: string }): Promise<CodeRunResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await codeApi.run(body);
    } catch (e) {
      const msg = (e as Error)?.message || '';
      if (attempt < 4 && isThrottled(msg)) { await sleep(6000 * (attempt + 1)); continue; }
      throw e;
    }
  }
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export default function CodeEditorProblemScreen() {
  const { problemId } = useLocalSearchParams<{ problemId: string }>();
  const userId = useAuthStore((s) => s.user?.id);

  // ── Problem ────────────────────────────────────────────────────────────────
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['pg-problems'],
    queryFn: () => playgroundApi.problems(),
  });
  const [mine, setMine] = useState<PlaygroundProblem[] | null>(null);
  useEffect(() => { loadMyProblems(userId).then(setMine); }, [userId]);
  const problem = useMemo<ExtraProblem | null>(() => {
    const id = String(problemId || '');
    return (listData?.problems.find((p) => p.id === id) || mine?.find((p) => p.id === id) || null) as ExtraProblem | null;
  }, [listData, mine, problemId]);

  const lockedLang = !!problem && (problem.category === 'Course Exercise' || !!problem.lockedLanguage);

  // ── Editor state ───────────────────────────────────────────────────────────
  const editorRef = useRef<CodeEditorHandle>(null);
  const codeRef = useRef('');
  const [lang, setLang] = useState<CodingLangId>('c');
  const langRef = useRef<CodingLangId>('c');
  langRef.current = lang;
  const langObj = getLanguage(lang);
  const [initialCode, setInitialCode] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [editorFallback, setEditorFallback] = useState(false);
  const [theme, setTheme] = useState<EditorTheme>('dark');
  const [fontSize, setFontSize] = useState(14);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errCount, setErrCount] = useState(0);

  // ── Panels ─────────────────────────────────────────────────────────────────
  const [pane, setPane] = useState<Pane>('code');
  const [outTab, setOutTab] = useState<OutTab>('output');
  const [stdin, setStdin] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [runView, setRunView] = useState<RunView>({ kind: 'idle' });
  const [submitView, setSubmitView] = useState<SubmitView>({ kind: 'idle' });
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<PgSubmission[]>([]);
  const [kbOpen, setKbOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── AI ─────────────────────────────────────────────────────────────────────
  const [solution, setSolution] = useState<BestSolution | null>(null);
  const [aiMenu, setAiMenu] = useState(false);
  const [aiPanel, setAiPanel] = useState<{ title: string; body: ReactNode } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbOpen(true));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbOpen(false));
    return () => { a.remove(); b.remove(); };
  }, []);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(THEME_KEY), AsyncStorage.getItem(FONT_KEY)]).then(([t, fRaw]) => {
      const f = Number(fRaw);
      if (t === 'light' || t === 'dark') { setTheme(t); editorRef.current?.setTheme(t); }
      if (f >= 11 && f <= 24) { setFontSize(f); editorRef.current?.setFontSize(f); }
    }).catch(() => {});
  }, []);

  // ── Initial code: saved → problem starter → default starter ────────────────
  const initedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!problem || initedFor.current === problem.id) return;
    initedFor.current = problem.id;
    const startLang = (CODING_LANGUAGES.some((l) => l.id === problem.defaultLanguage) ? problem.defaultLanguage : 'c') as CodingLangId;
    setLang(startLang);
    langRef.current = startLang;
    loadPgCode(userId, problem.id, startLang).then((saved) => {
      const code = saved ?? problem.starterCode?.[startLang] ?? getDefaultStarter(startLang);
      codeRef.current = code;
      setInitialCode(code);
    });
    // Custom input prefilled with the first visible sample (desktop behaviour).
    const sample = (problem.testCases || []).find((t) => !t.isHidden);
    if (sample) setStdin(sample.input);
    loadHistory(userId, problem.id).then(setHistory);
    // Best solution preload for the AI menu.
    setSolution(null);
    if (problem.bestSolution) setSolution(problem.bestSolution);
    else if (!problem.id.startsWith('my-')) {
      playgroundApi.bestSolution(problem.id)
        .then((d) => { if (d?.success && d.solution) setSolution(d.solution); })
        .catch(() => {});
    }
  }, [problem, userId]);

  const flushSave = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (problem) savePgCode(userId, problem.id, langRef.current, codeRef.current);
  }, [problem, userId]);
  const flushRef = useRef(flushSave);
  flushRef.current = flushSave;
  useEffect(() => () => {
    flushRef.current();
    if (compileTimer.current) clearTimeout(compileTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // Compile-check (C / Java only), 2 s after typing stops.
  const scheduleCompileCheck = useCallback(() => {
    if (compileTimer.current) clearTimeout(compileTimer.current);
    compileTimer.current = setTimeout(async () => {
      const lo = getLanguage(langRef.current);
      const code = codeRef.current;
      if (lo.judge0Id === 71 || lo.judge0Id === 63 || code.trim().length < 5) {
        editorRef.current?.setErrors([]); setErrCount(0); return;
      }
      try {
        const r = await playgroundApi.compileCheck({ source_code: code, language_id: lo.judge0Id });
        const errs = r?.success && r.has_errors && r.errors ? r.errors : [];
        editorRef.current?.setErrors(errs);
        setErrCount(errs.length);
      } catch { /* silent, like desktop */ }
    }, 2000);
  }, []);

  const onCodeChange = useCallback((code: string) => {
    codeRef.current = code;
    if (!problem) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const forLang = langRef.current;
    saveTimer.current = setTimeout(() => savePgCode(userId, problem.id, forLang, code), SAVE_DEBOUNCE_MS);
    scheduleCompileCheck();
  }, [problem, userId, scheduleCompileCheck]);

  const setEditorCode = useCallback((code: string) => {
    codeRef.current = code;
    editorRef.current?.setCode(code);
    if (problem) savePgCode(userId, problem.id, langRef.current, code);
  }, [problem, userId]);

  const changeLanguage = useCallback(async (next: CodingLangId) => {
    setShowLangPicker(false);
    if (!problem || next === lang) return;
    flushSave();
    const saved = await loadPgCode(userId, problem.id, next);
    let code = codeRef.current;
    if (saved !== null) code = saved;
    else if (isDefaultOrEmpty(code) || code === (problem.starterCode?.[lang] ?? '')) code = problem.starterCode?.[next] ?? getDefaultStarter(next);
    setLang(next);
    langRef.current = next;
    editorRef.current?.setMode(getLanguage(next).cmMode);
    editorRef.current?.setErrors([]); setErrCount(0);
    if (code !== codeRef.current) { codeRef.current = code; editorRef.current?.setCode(code); }
  }, [problem, lang, userId, flushSave]);

  // ── Format ─────────────────────────────────────────────────────────────────
  const format = () => {
    const out = formatCode(codeRef.current, lang);
    if (out !== codeRef.current) setEditorCode(out);
    setPane('code');
  };

  // ── Run ────────────────────────────────────────────────────────────────────
  const run = useCallback(async () => {
    Keyboard.dismiss();
    setPane('output'); setOutTab('output');
    const code = codeRef.current;
    if (!code.trim()) { setRunView({ kind: 'error', text: 'Write some code first.' }); return; }
    setRunning(true);
    setRunView({ kind: 'busy', text: 'Running...' });
    try {
      const data = await runOnce({ source_code: code, language_id: langObj.judge0Id, stdin });
      if (!data?.success) { setRunView({ kind: 'error', text: data?.message || 'Execution failed.' }); return; }
      setRunView({ kind: 'run', data });
      // Complexity of the student's code (non-blocking, after a successful run).
      if (data.status === 'accepted' || (!data.status_description?.includes('Error') && !data.stderr && !data.compile_output)) {
        if (code.trim().length >= 10) {
          playgroundApi.analyzeComplexity({ code, language: lang })
            .then((c) => setRunView((v) => (v.kind === 'run' && v.data === data ? { ...v, tc: c.timeComplexity, sc: c.spaceComplexity } : v)))
            .catch(() => {});
        }
      }
    } catch (e) {
      const msg = (e as Error)?.message || '';
      setRunView({ kind: 'error', text: isConnErr(msg) || !msg ? 'Connection failed.' : msg });
    } finally {
      setRunning(false);
    }
  }, [langObj.judge0Id, lang, stdin]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    Keyboard.dismiss();
    if (!problem) return;
    setPane('output'); setOutTab('results');
    const code = codeRef.current;
    if (!code.trim()) { setSubmitView({ kind: 'error', text: 'Write your solution first.' }); return; }
    flushSave();
    const tests = problem.testCases || [];
    setSubmitting(true);
    setSubmitView({ kind: 'busy', text: 'Testing against all cases...' });
    try {
      if (tests.length === 0) {
        setSubmitView({ kind: 'noTests' });
        const data = await runOnce({ source_code: code, language_id: langObj.judge0Id, stdin: '' }).catch(() => null);
        if (data) setRunView({ kind: 'run', data });
        setHistory(await addHistory(userId, problem.id, { at: new Date().toISOString(), language: lang, status: 'submitted', passed: 0, total: 0 }));
        return;
      }

      const results = await pool(tests, RUN_CONCURRENCY, async (t, i): Promise<TcResult> => {
        let r: CodeRunResult | null = null;
        try { r = await runOnce({ source_code: code, language_id: langObj.judge0Id, stdin: t.input }); } catch { r = null; }
        const actual = (r?.stdout ?? '').toString();
        const ok = !!r && !!r.success && r.status === 'accepted' && actual.trim() === (t.expectedOutput ?? '').trim();
        return {
          n: i + 1, passed: ok, hidden: !!t.isHidden, input: t.input, expected: t.expectedOutput ?? '',
          actual: r ? (actual || r.compile_output || r.stderr || '') : 'Could not run', status: r?.status || 'error', time: r?.time ?? null,
        };
      });
      const passed = results.filter((r) => r.passed).length;
      const total = results.length;
      const view: SubmitView = { kind: 'result', results, passed, total };
      setSubmitView(view);
      setHistory(await addHistory(userId, problem.id, {
        at: new Date().toISOString(), language: lang, status: passed === total ? 'accepted' : 'failed', passed, total,
      }));

      if (passed === total) {
        const award = await scoreAward(userId, problem.id, problem.title, (problem.difficulty || 'easy').toLowerCase(), lang);
        if (award.awarded) showToast(`🎉 +${award.points} points | +${award.coins} coins earned!`);
        if (award.streakBonus) setTimeout(() => showToast('🔥 7-Day Streak Complete! +10 bonus coins awarded!'), award.awarded ? 4200 : 0);

        // Course exercise: also record on the server so Student Progress counts it.
        if (problem.category === 'Course Exercise' && problem.courseId) {
          codeApi.submit({ exerciseId: problem.id, source_code: code, language_id: langObj.judge0Id, courseId: problem.courseId }).catch(() => {});
        }
        // Per-problem leaderboard (custom problems aren't on the server).
        if (!problem.id.startsWith('my-')) {
          playgroundApi.leaderboardPost({
            problemId: problem.id, problemTitle: problem.title, qualityTag: 'green',
            lessonId: problem.lessonId, courseId: problem.courseId,
          }).then((d) => {
            if (d?.success && !d.alreadyRanked && d.rank) {
              setSubmitView((v) => (v.kind === 'result' && v.results === results ? { ...v, rank: d.rank, coinsAwarded: d.coinsAwarded } : v));
            }
          }).catch(() => {});
        }
      }
    } catch (e) {
      const msg = (e as Error)?.message || '';
      setSubmitView({ kind: 'error', text: isConnErr(msg) || !msg ? 'Connection failed.' : msg });
    } finally {
      setSubmitting(false);
    }
  }, [problem, userId, lang, langObj.judge0Id, flushSave, showToast]);

  // ── AI actions ─────────────────────────────────────────────────────────────
  const notLoaded = (title: string) => setAiPanel({
    title, body: <Text style={styles.aiWarn}>Best solution not loaded yet. Please wait a moment and try again.</Text>,
  });

  const aiHints = () => {
    setAiMenu(false);
    const sol = getLangSolution(solution, lang);
    if (!sol) return notLoaded('💡 Hints');
    const hints = extractHints(sol.code || '');
    const tc = sol.timeComplexity || sol.tc; const sc = sol.spaceComplexity || sol.sc;
    setAiPanel({
      title: '💡 Hints',
      body: (
        <>
          <Text style={styles.aiSub}>Based on optimal {lang.toUpperCase()} solution:</Text>
          {hints.map((h, i) => (
            <View key={i} style={styles.hintRow}>
              <Text style={styles.hintNum}>{i + 1}.</Text>
              <Text style={styles.hintBody}>{h}</Text>
            </View>
          ))}
          {!!(tc || sc) && <Text style={styles.targetBox}>⏱ Target TC: {tc || '?'} | 💾 Target SC: {sc || '?'}</Text>}
        </>
      ),
    });
  };

  const aiAlgorithm = () => {
    setAiMenu(false);
    const sol = getLangSolution(solution, lang);
    if (!sol) return notLoaded('🔬 Algorithm');
    const algo = detectAlgorithm(sol.code || '');
    setAiPanel({
      title: '🔬 Algorithm',
      body: (
        <>
          <Text style={styles.aiSub}>Algorithm used in optimal {lang.toUpperCase()} solution:</Text>
          <Text style={styles.algoBadge}>{algo.name}</Text>
          <View style={styles.algoBox}><Text style={styles.algoText}>{algo.explanation}</Text></View>
          {algo.steps.length > 0 && (
            <>
              <Text style={styles.stepsHead}>STEP-BY-STEP:</Text>
              {algo.steps.map((s, i) => (
                <View key={i} style={styles.stepRow}><Text style={styles.stepArrow}>→</Text><Text style={styles.stepText}>{s}</Text></View>
              ))}
            </>
          )}
          <View style={styles.chipRow}>
            <Text style={[styles.cxChip, { color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)' }]}>⏱ {sol.timeComplexity || sol.tc || '?'}</Text>
            <Text style={[styles.cxChip, { color: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)' }]}>💾 {sol.spaceComplexity || sol.sc || '?'}</Text>
          </View>
          {!!sol.explanation && (
            <Text style={styles.summaryBox}><Text style={{ color: '#22c55e', fontWeight: '800' }}>Summary: </Text>{sol.explanation}</Text>
          )}
        </>
      ),
    });
  };

  const aiOptimal = () => {
    setAiMenu(false);
    const sol = getLangSolution(solution, lang);
    if (!sol?.code) return notLoaded('💻 Optimal Solution');
    setEditorCode(sol.code);
    setAiPanel(null);
    setPane('code');
  };

  const aiNextStep = () => {
    setAiMenu(false);
    const sol = getLangSolution(solution, lang);
    if (!sol?.code) return notLoaded('➡️ Next Step');
    const line = nextStepLine(sol.code, codeRef.current);
    if (line === null) {
      setAiPanel({ title: '➡️ Next Step', body: <Text style={styles.aiOk}>✅ Your code already covers all steps of the optimal solution! Try running or submitting.</Text> });
      return;
    }
    setPane('code');
    editorRef.current?.appendLine(line);
    codeRef.current = codeRef.current.replace(/\s+$/, '') + '\n' + line;
  };

  const aiAnalyze = () => {
    setAiMenu(false);
    const sol = getLangSolution(solution, lang);
    if (!sol?.code) return notLoaded('🔍 Analyze');
    if (!codeRef.current || codeRef.current.trim().length < 5) {
      setAiPanel({ title: '🔍 Analyze', body: <Text style={styles.aiWarn}>Write some code first, then analyze.</Text> });
      return;
    }
    const r = analyzeMistake(sol.code, codeRef.current);
    setAiPanel({
      title: '🔍 Analyze Mistakes',
      body: r.match ? (
        <Text style={styles.aiOk}>✅ Your code structure matches the optimal solution! Check logic/variable names if output differs.</Text>
      ) : (
        <>
          <Text style={styles.coverage}>📊 Solution coverage: {r.coverage}%</Text>
          {r.missing.length > 0 && (
            <>
              <Text style={styles.missHead}>❌ MISSING LOGIC ({r.missing.length} LINES):</Text>
              {r.missing.slice(0, 6).map((l, i) => <Text key={i} style={styles.missLine}>{l}</Text>)}
              {r.missing.length > 6 && <Text style={styles.more}>... and {r.missing.length - 6} more lines</Text>}
            </>
          )}
          {r.extra.length > 0 && (
            <>
              <Text style={styles.extraHead}>⚠️ EXTRA/DIFFERENT LINES ({r.extra.length}):</Text>
              {r.extra.slice(0, 4).map((l, i) => <Text key={i} style={styles.extraLine}>{l}</Text>)}
              {r.extra.length > 4 && <Text style={styles.more}>... and {r.extra.length - 4} more lines</Text>}
            </>
          )}
        </>
      ),
    });
  };

  // ── Prefs ──────────────────────────────────────────────────────────────────
  const toggleTheme = () => {
    const t: EditorTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(t); editorRef.current?.setTheme(t);
    AsyncStorage.setItem(THEME_KEY, t).catch(() => {});
  };
  const changeFont = (d: number) => {
    const n = Math.max(11, Math.min(24, fontSize + d));
    setFontSize(n); editorRef.current?.setFontSize(n);
    AsyncStorage.setItem(FONT_KEY, String(n)).catch(() => {});
  };
  const clearOutput = () => { setRunView({ kind: 'idle' }); setSubmitView({ kind: 'idle' }); };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderRun = () => {
    if (runView.kind === 'idle') return <Text style={styles.placeholder}>Run your code to see output...</Text>;
    if (runView.kind === 'busy') return <BusyLine text={runView.text} />;
    if (runView.kind === 'error') return <Text style={styles.errText}>⚠ {runView.text}</Text>;
    const d = runView.data;
    const stats = (
      <View style={styles.stats}>
        {!!d.time && <Text style={styles.statText}>⏱ {Number(d.time).toFixed(3)}s</Text>}
        {!!d.memory && <Text style={styles.statText}>💾 {d.memory >= 1024 ? (d.memory / 1024).toFixed(2) + ' MB' : d.memory + ' KB'}</Text>}
        {!!runView.tc && <Text style={[styles.statText, { color: '#22c55e' }]}>TC {runView.tc}</Text>}
        {!!runView.sc && <Text style={[styles.statText, { color: '#60a5fa' }]}>SC {runView.sc}</Text>}
      </View>
    );
    if (d.status === 'compilation_error') return (<><Banner text="Compilation Error" color={Colors.danger} /><Pre text={d.compile_output || d.stderr || ''} error />{stats}</>);
    if (d.status === 'runtime_error') return (<><Banner text="Runtime Error" color={Colors.danger} /><Pre text={d.stderr || d.stdout || ''} error />{stats}</>);
    if (d.status === 'time_limit') return (<><Banner text="Time Limit Exceeded" color={Colors.warning} />{stats}</>);
    return (
      <>
        <Banner text="Executed Successfully" color={Colors.success} />
        {d.stdout ? <Pre text={d.stdout} /> : <Text style={styles.noOutput}>(no output)</Text>}
        {stats}
      </>
    );
  };

  const renderSubmit = () => {
    if (submitView.kind === 'idle') return <Text style={styles.placeholder}>Submit your code to see test results here...</Text>;
    if (submitView.kind === 'busy') return <BusyLine text={submitView.text} />;
    if (submitView.kind === 'error') return <Text style={styles.errText}>⚠ {submitView.text}</Text>;
    if (submitView.kind === 'noTests') {
      return (
        <>
          <Banner text="✅ Submitted successfully" color={Colors.success} />
          <Text style={styles.noOutput}>No test cases configured — output shown below (not verified).</Text>
          <View style={{ height: 8 }} />
          {renderRun()}
        </>
      );
    }
    const { results, passed, total } = submitView;
    return (
      <>
        {passed === total
          ? <Banner text={`✅ Accepted — All ${total} Test Cases Passed!`} color={Colors.success} />
          : <Banner text={`❌ ${passed}/${total} test cases passed.`} color={Colors.danger} />}
        {results.map((r) => (
          <View key={r.n} style={[styles.tcItem, r.passed ? styles.tcPass : styles.tcFail]}>
            <Text style={styles.tcHeader}>
              {r.passed ? '✅' : '❌'} Test Case {r.n}
              {r.time ? <Text style={styles.tcTime}>  ({r.time}s)</Text> : null}
              {r.hidden ? <Text style={styles.tcTime}>  {r.passed ? '(correct)' : '(wrong)'}</Text> : null}
            </Text>
            {!r.passed && (
              <View style={styles.tcDetail}>
                <TcRow label="Input:" value={r.hidden ? '(hidden)' : r.input} />
                <TcRow label="Expected:" value={r.hidden ? '(hidden)' : r.expected} />
                <TcRow label="Got:" value={r.hidden ? '(hidden)' : r.actual} />
              </View>
            )}
          </View>
        ))}
        {!!submitView.rank && (
          <View style={styles.rankBox}>
            <Text style={styles.rankLabel}>🏆 Rank #{submitView.rank}</Text>
            {!!submitView.coinsAwarded && submitView.coinsAwarded > 0 && <Text style={styles.rankCoins}>+{submitView.coinsAwarded} 🪙 coins</Text>}
          </View>
        )}
      </>
    );
  };

  // ── Loading / not found ────────────────────────────────────────────────────
  if (!problem) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>←</Text></TouchableOpacity>
          <Text style={styles.title}>Code Editor</Text>
        </View>
        <View style={styles.center}>
          {listLoading || mine === null ? <ActivityIndicator color={Colors.primary} size="large" /> : <Text style={styles.muted}>Problem not found.</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const diff = (problem.difficulty || 'medium').toLowerCase();
  const diffColor = DIFF_COLORS[diff] || '#f59e0b';
  const hintText = Array.isArray(problem.hints) ? problem.hints.filter(Boolean).join(' | ') : '';
  const visibleSamples = (problem.testCases || []).filter((t) => !t.isHidden);
  const busy = running || submitting;
  const fileName = camelFileName(problem.title) + langObj.extension;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back"><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{problem.title}</Text>
        <View style={[styles.diff, { backgroundColor: diffColor + '20', borderColor: diffColor + '40' }]}>
          <Text style={[styles.diffText, { color: diffColor }]}>{diff}</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn} accessibilityLabel={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
          <Text style={styles.iconBtnText}>{theme === 'dark' ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => changeFont(-1)} style={styles.iconBtn} accessibilityLabel="Smaller text"><Text style={styles.fontBtn}>A−</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => changeFont(1)} style={styles.iconBtn} accessibilityLabel="Larger text"><Text style={styles.fontBtn}>A+</Text></TouchableOpacity>
      </View>

      {/* Toolbar: language · Format · AI ▾ · Run · Submit */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.langBtn} onPress={() => !lockedLang && setShowLangPicker((v) => !v)} disabled={lockedLang} accessibilityLabel={`Language: ${langObj.label}`}>
          <Text style={styles.langText}>{langObj.icon} {langObj.label}{lockedLang ? '' : ' ▾'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={format} accessibilityLabel="Format code"><Text style={styles.toolText}>Format</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.toolBtn, styles.aiBtn]} onPress={() => setAiMenu(true)} accessibilityLabel="AI assist"><Text style={[styles.toolText, { color: '#c4b5fd' }]}>✨ AI</Text></TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[styles.runBtn, busy && styles.dim]} onPress={run} disabled={busy}>
          {running ? <ActivityIndicator size="small" color={Colors.success} /> : null}
          <Text style={styles.runText}>{running ? '…' : '▶ Run'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.submitBtn, busy && styles.dim]} onPress={submit} disabled={busy}>
          {submitting ? <ActivityIndicator size="small" color="#fff" /> : null}
          <Text style={styles.submitText}>{submitting ? '…' : '✈ Submit'}</Text>
        </TouchableOpacity>
      </View>
      {showLangPicker && (
        <View style={styles.langRow}>
          {CODING_LANGUAGES.map((l) => (
            <TouchableOpacity key={l.id} style={[styles.langChip, l.id === lang && styles.langChipOn]} onPress={() => changeLanguage(l.id)}>
              <Text style={[styles.langChipText, l.id === lang && { color: '#fff' }]}>{l.icon} {l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!kbOpen && (
        <View style={styles.paneTabs}>
          {([['problem', '📄 Problem'], ['code', '💻 Code'], ['output', '▶ Output'], ['history', '🕘 History']] as [Pane, string][]).map(([k, label]) => (
            <TouchableOpacity key={k} style={[styles.paneTab, pane === k && styles.paneTabOn]} onPress={() => setPane(k)}>
              <Text style={[styles.paneTabText, pane === k && styles.paneTabTextOn]} numberOfLines={1}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Code pane (always mounted) */}
      <View style={[styles.flex, pane !== 'code' && styles.hidden]}>
        <View style={styles.fileBar}>
          <Text style={styles.fileName} numberOfLines={1}>{'</>'} {fileName}{editorFallback ? '  · basic editor' : ''}{errCount > 0 ? `  · ⚠ ${errCount}` : ''}</Text>
          <Text style={styles.cursor}>Ln {cursor.line}, Col {cursor.col}</Text>
        </View>
        {initialCode === null ? (
          <View style={styles.center}><ActivityIndicator color={Colors.primary} /><Text style={styles.muted}>  Loading editor...</Text></View>
        ) : (
          <CodeEditorWebView
            ref={editorRef}
            initialCode={initialCode}
            mode={langObj.cmMode}
            theme={theme}
            fontSize={fontSize}
            onChange={onCodeChange}
            onCursor={(line, col) => setCursor({ line, col })}
            onReady={(fb) => setEditorFallback(fb)}
          />
        )}
        {!kbOpen && (
          <View style={styles.inputSection}>
            <TouchableOpacity style={styles.inputHeader} onPress={() => setShowInput((v) => !v)} activeOpacity={0.7}>
              <Text style={styles.inputTitle}>{'>_'} Custom Input</Text>
              <Text style={styles.toggle}>{showInput ? '▼' : '▶'}</Text>
            </TouchableOpacity>
            {showInput && (
              <TextInput
                style={styles.stdin}
                value={stdin}
                onChangeText={setStdin}
                placeholder="Enter all input in line by line before run"
                placeholderTextColor={Colors.muted}
                multiline autoCapitalize="none" autoCorrect={false} spellCheck={false}
              />
            )}
          </View>
        )}
      </View>

      {/* Problem pane */}
      {pane === 'problem' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.paneBody}>
          <View style={styles.tagRow}>
            <View style={[styles.diff, { backgroundColor: diffColor + '20', borderColor: diffColor + '40' }]}><Text style={[styles.diffText, { color: diffColor }]}>{diff}</Text></View>
            {!!problem.category && <Text style={styles.catChip}>{problem.category}</Text>}
          </View>
          <Text style={styles.body}>{problem.description}</Text>
          {!!problem.inputFormat && <Section title="Input Format"><Text style={styles.body}>{problem.inputFormat}</Text></Section>}
          {!!problem.outputFormat && <Section title="Output Format"><Text style={styles.body}>{problem.outputFormat}</Text></Section>}
          {visibleSamples.length > 0 && (
            <Section title="🧪 Sample Test Cases">
              {visibleSamples.map((s, i) => (
                <View key={i} style={styles.sample}>
                  <Text style={styles.sampleTitle}>Sample {i + 1}</Text>
                  <Text style={styles.sampleLabel}>Input</Text><Pre text={s.input} />
                  <Text style={styles.sampleLabel}>Expected</Text><Pre text={s.expectedOutput} />
                </View>
              ))}
            </Section>
          )}
          {!!hintText && <View style={styles.hint}><Text style={styles.hintText}>💡 {hintText}</Text></View>}
          {!!problem.explanation && <Section title="Explanation"><Text style={styles.body}>{problem.explanation}</Text></Section>}
          {!!problem.tags?.length && (
            <View style={styles.tags}>{problem.tags.map((t) => <Text key={t} style={styles.tag}>#{t}</Text>)}</View>
          )}
          {!!(problem.constraints || problem.timeComplexity || problem.spaceComplexity) && (
            <Section title="Constraints">
              {!!problem.constraints && <Text style={styles.body}>{problem.constraints}</Text>}
              <View style={styles.stats}>
                {!!problem.timeComplexity && <Text style={styles.statText}>⏱ Expected: {problem.timeComplexity}</Text>}
                {!!problem.spaceComplexity && <Text style={styles.statText}>💾 Space: {problem.spaceComplexity}</Text>}
              </View>
            </Section>
          )}
        </ScrollView>
      )}

      {/* Output pane */}
      {pane === 'output' && (
        <View style={styles.flex}>
          <View style={styles.outHeader}>
            <TouchableOpacity onPress={() => setOutTab('output')} style={[styles.outTab, outTab === 'output' && styles.outTabOn]}>
              <Text style={[styles.outTabText, outTab === 'output' && styles.outTabTextOn]}>Output</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOutTab('results')} style={[styles.outTab, outTab === 'results' && styles.outTabOn]}>
              <Text style={[styles.outTabText, outTab === 'results' && styles.outTabTextOn]}>Test Results</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={clearOutput} style={styles.clearBtn}><Text style={styles.clearText}>Clear</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.flex} contentContainerStyle={styles.console}>
            {outTab === 'output' ? renderRun() : renderSubmit()}
          </ScrollView>
        </View>
      )}

      {/* History pane */}
      {pane === 'history' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.paneBody}>
          <Text style={styles.sectionTitle}>🕘 Submission History</Text>
          {history.length === 0 ? <Text style={styles.muted}>No submissions yet.</Text> : history.map((h, i) => {
            const ok = h.status === 'accepted';
            const label = h.status === 'submitted' ? '📤 Submitted' : ok ? '✅ Accepted' : '❌ Wrong Answer';
            return (
              <View key={i} style={styles.histItem}>
                <Text style={[styles.histStatus, { color: ok ? '#22c55e' : h.status === 'submitted' ? Colors.muted : '#ef4444' }]}>{label}</Text>
                <Text style={styles.histMeta}>
                  {h.language.toUpperCase()}{h.total > 0 ? `  ·  ${h.passed}/${h.total} passed` : ''}  ·  {new Date(h.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {!!toast && <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View>}

      {/* AI ▾ menu */}
      <Modal visible={aiMenu} transparent animationType="fade" onRequestClose={() => setAiMenu(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setAiMenu(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>✨ AI Coach{solution ? '' : '  (getting ready…)'}</Text>
            <MenuItem icon="💡" label="Hints" onPress={aiHints} />
            <MenuItem icon="🔬" label="Algorithm" onPress={aiAlgorithm} />
            <MenuItem icon="💻" label="Optimal Solution" onPress={aiOptimal} />
            <View style={styles.menuSep} />
            <MenuItem icon="➡️" label="Next Step" onPress={aiNextStep} />
            <MenuItem icon="🔍" label="Analyze" onPress={aiAnalyze} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* AI result panel */}
      <Modal visible={!!aiPanel} transparent animationType="slide" onRequestClose={() => setAiPanel(null)}>
        <View style={styles.panelWrap}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAiPanel(null)} />
          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>{aiPanel?.title}</Text>
              <TouchableOpacity onPress={() => setAiPanel(null)} hitSlop={10} accessibilityLabel="Close"><Text style={styles.close}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>{aiPanel?.body}</ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Small presentational pieces ──────────────────────────────────────────────
function MenuItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuIcon}>{icon}</Text><Text style={styles.menuLabel}>{label}</Text>
    </TouchableOpacity>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}
function Banner({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.banner, { backgroundColor: color + '1f', borderColor: color + '55' }]}>
      <Text style={[styles.bannerText, { color }]}>{text}</Text>
    </View>
  );
}
function Pre({ text, error }: { text: string; error?: boolean }) {
  return (
    <ScrollView horizontal style={styles.pre} contentContainerStyle={{ padding: 8 }}>
      <Text selectable style={[styles.preText, error && { color: '#f87171' }]}>{text}</Text>
    </ScrollView>
  );
}
function TcRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tcRow}><Text style={styles.tcLabel}>{label}</Text><Text selectable style={styles.tcCode}>{value}</Text></View>
  );
}
function BusyLine({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <ActivityIndicator size="small" color="#60a5fa" /><Text style={styles.info}>  {text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  hidden: { display: 'none' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  muted: { color: Colors.muted, fontSize: 13 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { color: Colors.primary, fontSize: 22, fontWeight: '700', paddingRight: 4 },
  title: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  diff: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  diffText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  iconBtn: { minWidth: 34, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6 },
  iconBtnText: { fontSize: 14 },
  fontBtn: { color: Colors.text, fontSize: 12, fontWeight: '800' },

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.03)' },
  langBtn: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  langText: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  toolBtn: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  aiBtn: { backgroundColor: 'rgba(108,71,255,0.15)', borderColor: 'rgba(108,71,255,0.35)' },
  toolText: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  langChip: { borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.04)' },
  langChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langChipText: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  runBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8 },
  runText: { color: '#22c55e', fontSize: 12, fontWeight: '800' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8 },
  submitText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  dim: { opacity: 0.55 },

  paneTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  paneTab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  paneTabOn: { borderBottomColor: Colors.primary },
  paneTabText: { color: Colors.muted, fontSize: 12, fontWeight: '700' },
  paneTabTextOn: { color: '#fff' },

  fileBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#0b0b12', gap: 8 },
  fileName: { flex: 1, color: Colors.muted, fontSize: 11, fontFamily: MONO },
  cursor: { color: Colors.muted, fontSize: 11, fontFamily: MONO },

  inputSection: { borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg2 },
  inputHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  inputTitle: { flex: 1, color: Colors.text, fontSize: 12, fontWeight: '700', fontFamily: MONO },
  toggle: { color: Colors.muted, fontSize: 11 },
  stdin: { minHeight: 70, maxHeight: 140, marginHorizontal: 12, marginBottom: 10, padding: 10, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: Colors.border, color: Colors.text, fontFamily: MONO, fontSize: 13, textAlignVertical: 'top' },

  paneBody: { padding: 14, paddingBottom: 40 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  catChip: { color: Colors.purple, fontSize: 11, fontWeight: '700', backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  section: { marginTop: 14 },
  sectionTitle: { color: Colors.purple, fontSize: 12, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  body: { color: Colors.text, fontSize: 14, lineHeight: 21 },
  hint: { backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', borderRadius: 10, padding: 10, marginTop: 14 },
  hintText: { color: '#fcd34d', fontSize: 13, lineHeight: 19 },
  sample: { marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: Colors.border },
  sampleTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  sampleLabel: { color: Colors.muted, fontSize: 11, fontWeight: '700', marginTop: 4, marginBottom: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  tag: { color: Colors.purple, fontSize: 12, backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },

  outHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  outTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  outTabOn: { backgroundColor: 'rgba(108,71,255,0.2)' },
  outTabText: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
  outTabTextOn: { color: '#fff' },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  clearText: { color: Colors.muted, fontSize: 12, fontWeight: '700' },
  console: { padding: 14, paddingBottom: 40 },
  placeholder: { color: Colors.muted, fontSize: 13, fontStyle: 'italic', fontFamily: MONO },
  info: { color: '#60a5fa', fontSize: 13, fontFamily: MONO },
  errText: { color: Colors.danger, fontSize: 13, fontFamily: MONO, lineHeight: 19 },
  noOutput: { color: Colors.muted, fontSize: 13, fontStyle: 'italic' },
  banner: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8 },
  bannerText: { fontSize: 13, fontWeight: '800' },
  pre: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 8, marginBottom: 6, maxHeight: 260 },
  preText: { color: '#22c55e', fontFamily: MONO, fontSize: 13, lineHeight: 19 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8, marginBottom: 8 },
  statText: { color: Colors.muted, fontSize: 12, fontFamily: MONO },

  tcItem: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8 },
  tcPass: { backgroundColor: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.15)' },
  tcFail: { backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.15)' },
  tcHeader: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tcTime: { color: Colors.muted, fontSize: 11, fontWeight: '400' },
  tcDetail: { marginTop: 6, gap: 4 },
  tcRow: { flexDirection: 'row', gap: 6 },
  tcLabel: { color: Colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  tcCode: { flex: 1, color: '#c4b5fd', fontFamily: MONO, fontSize: 12, marginTop: 4 },

  rankBox: { marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: 'rgba(108,71,255,0.1)', borderWidth: 1, borderColor: 'rgba(108,71,255,0.25)', flexDirection: 'row', justifyContent: 'space-between' },
  rankLabel: { color: '#a78bfa', fontSize: 14, fontWeight: '800' },
  rankCoins: { color: '#fbbf24', fontSize: 14, fontWeight: '800' },

  histItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  histStatus: { fontSize: 13, fontWeight: '800' },
  histMeta: { color: Colors.muted, fontSize: 11, marginTop: 3, fontFamily: MONO },

  toast: { position: 'absolute', left: 16, right: 16, bottom: 90, backgroundColor: '#1f2937', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)', paddingVertical: 12, paddingHorizontal: 14 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 130, paddingRight: 12 },
  menu: { width: 230, backgroundColor: '#1a1a2e', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(108,71,255,0.35)', paddingVertical: 8 },
  menuTitle: { color: '#a78bfa', fontSize: 12, fontWeight: '800', paddingHorizontal: 14, paddingVertical: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  menuIcon: { fontSize: 16 },
  menuLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  menuSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },

  panelWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: { maxHeight: '75%', backgroundColor: '#12101f', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)', padding: 16 },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  close: { color: '#fff', fontSize: 18, paddingHorizontal: 6 },
  aiSub: { color: '#94a3b8', fontSize: 12, marginBottom: 10 },
  aiWarn: { color: '#f59e0b', fontSize: 14, lineHeight: 20 },
  aiOk: { color: '#22c55e', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  hintRow: { flexDirection: 'row', gap: 8, marginBottom: 8, padding: 10, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.06)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.15)' },
  hintNum: { color: '#fbbf24', fontWeight: '800', fontSize: 13, minWidth: 20 },
  hintBody: { flex: 1, color: '#e2e8f0', fontSize: 13, lineHeight: 19 },
  targetBox: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.06)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  algoBadge: { alignSelf: 'flex-start', color: '#60a5fa', fontSize: 14, fontWeight: '800', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(96,165,250,0.12)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)', marginBottom: 12, overflow: 'hidden' },
  algoBox: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 10 },
  algoText: { color: '#e2e8f0', fontSize: 13, lineHeight: 20 },
  stepsHead: { color: '#a78bfa', fontSize: 11, fontWeight: '800', marginBottom: 6, letterSpacing: 0.5 },
  stepRow: { flexDirection: 'row', gap: 8, padding: 8, marginBottom: 6, borderRadius: 6, backgroundColor: 'rgba(108,71,255,0.05)' },
  stepArrow: { color: '#a78bfa', fontWeight: '800', fontSize: 12 },
  stepText: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 12.5, lineHeight: 18 },
  chipRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cxChip: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  summaryBox: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.05)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.12)', color: 'rgba(255,255,255,0.75)', fontSize: 12.5, lineHeight: 19, overflow: 'hidden' },
  coverage: { padding: 10, borderRadius: 8, backgroundColor: 'rgba(108,71,255,0.08)', borderWidth: 1, borderColor: 'rgba(108,71,255,0.2)', color: '#a78bfa', fontSize: 13, fontWeight: '700', marginBottom: 10, overflow: 'hidden' },
  missHead: { color: '#ef4444', fontSize: 11, fontWeight: '800', marginBottom: 6 },
  missLine: { padding: 6, marginBottom: 3, borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', color: '#fca5a5', fontFamily: MONO, fontSize: 12, overflow: 'hidden' },
  extraHead: { color: '#f59e0b', fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  extraLine: { padding: 6, marginBottom: 3, borderRadius: 6, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)', color: '#fde68a', fontFamily: MONO, fontSize: 12, overflow: 'hidden' },
  more: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
});
