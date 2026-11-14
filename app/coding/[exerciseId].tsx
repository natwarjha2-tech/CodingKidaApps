/**
 * Code Editor — mobile port of the desktop coding exercise editor
 * (codingkidadesktop/src/renderer/coding-editor.js + the "Practice in Code
 * Editor" page). Opened from a coding exercise in the lesson's Exercise tab.
 *
 * Same behaviour as desktop:
 *  - Language: locked to the exercise's language, else Java / C / Python / JS
 *  - Starter code: exercise starter → else the same default per language
 *  - Auto-save per user + exercise + language (1.5 s debounce), restored on open
 *  - Run (custom stdin, "Use Sample") → /api/code/run, same status messages
 *  - Submit → /api/code/submit against all test cases (hidden ones masked),
 *    Test Results tab, totals, exercise rank, history refresh
 *  - Sample test cases, submission history (last 10), Clear
 *  - Problem details (formats, constraints, hints, explanation, tags,
 *    complexity) + Codo help
 * Mobile additions: coding key bar, dark/light theme, font size.
 *
 * Code runs on the SERVER (Judge0) — the phone only edits text.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Keyboard, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useExercise } from '@/hooks';
import { useAuthStore } from '@/store';
import {
  codeApi, exerciseApi, leaderboardApi,
  type CodeRunResult, type CodeSubmitResult, type SampleTestCase, type CodeSubmission,
} from '@/api';
import { XPService, XP_REWARDS } from '@/services';
import { CodoHelpButton } from '@/components/lesson/CodoHelp';
import { AiCoach } from '@/components/coding/AiCoach';
import { PdfViewer } from '@/components/lesson/PdfViewer';
import { CodeEditorWebView, type CodeEditorHandle, type EditorTheme } from '@/components/coding/CodeEditorWebView';
import {
  CODING_LANGUAGES, getLanguage, getDefaultStarter, isDefaultOrEmpty, loadSavedCode, saveCode,
  THEME_KEY, FONT_KEY, type CodingLangId,
} from '@/components/coding/codingLanguages';
import { Colors } from '@/theme';

type Pane = 'problem' | 'code' | 'output' | 'history';
type OutTab = 'output' | 'results';

// What the Output / Test Results consoles show.
type RunView =
  | { kind: 'idle' }
  | { kind: 'busy'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'run'; data: CodeRunResult };
type SubmitView =
  | { kind: 'idle' }
  | { kind: 'busy'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'legacy'; ok: boolean; text: string }
  | { kind: 'result'; data: CodeSubmitResult };

const DIFF_COLORS: Record<string, string> = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
const SAVE_DEBOUNCE_MS = 1500;

const isConnErr = (msg: string) => /network error|timeout|ECONN|Failed to fetch/i.test(msg);

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (isNaN(s)) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) { const h = Math.floor(s / 3600); return `${h} hour${h > 1 ? 's' : ''} ago`; }
  if (s < 604800) { const dd = Math.floor(s / 86400); return `${dd} day${dd > 1 ? 's' : ''} ago`; }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function historyLabel(sub: CodeSubmission): { text: string; color: string } {
  if (sub.passed || sub.status === 'accepted') return { text: '✅ Accepted', color: '#22c55e' };
  switch (sub.status) {
    case 'wrong_answer': return { text: '❌ Wrong Answer', color: '#ef4444' };
    case 'time_limit': return { text: '⏱ Time Limit', color: '#f59e0b' };
    case 'runtime_error': return { text: '💥 Runtime Error', color: '#ef4444' };
    case 'compilation_error': return { text: '🔴 Compilation Error', color: '#ef4444' };
    case 'memory_limit': return { text: '💾 Memory Limit', color: '#f59e0b' };
    default: return { text: `⏳ ${sub.status || 'submitted'}`, color: Colors.muted };
  }
}

export default function CodingEditorScreen() {
  const { exerciseId, lessonId, courseId } = useLocalSearchParams<{
    exerciseId: string; lessonId?: string; courseId?: string;
  }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: exData, isLoading: exLoading } = useExercise(String(lessonId || ''));
  const exercise = useMemo(
    () => (exData?.exercises ?? []).find((e) => e.id === exerciseId) ?? null,
    [exData, exerciseId]
  );

  // ── Language (locked to the exercise's language, like desktop) ─────────────
  const lockedLang = exercise?.language && CODING_LANGUAGES.some((l) => l.id === exercise.language)
    ? (exercise.language as CodingLangId) : null;
  const [lang, setLang] = useState<CodingLangId>('java');
  const langObj = getLanguage(lang);
  const [showLangPicker, setShowLangPicker] = useState(false);

  // ── Editor state ───────────────────────────────────────────────────────────
  const editorRef = useRef<CodeEditorHandle>(null);
  const codeRef = useRef('');
  const [initialCode, setInitialCode] = useState<string | null>(null); // null = still restoring
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [editorFallback, setEditorFallback] = useState(false);
  const [theme, setTheme] = useState<EditorTheme>('dark');
  const [fontSize, setFontSize] = useState(14);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef<CodingLangId>('java');
  langRef.current = lang;

  // ── Panels ─────────────────────────────────────────────────────────────────
  const [pane, setPane] = useState<Pane>('code');
  const [outTab, setOutTab] = useState<OutTab>('output');
  const [stdin, setStdin] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [runView, setRunView] = useState<RunView>({ kind: 'idle' });
  const [submitView, setSubmitView] = useState<SubmitView>({ kind: 'idle' });
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [samples, setSamples] = useState<SampleTestCase[] | null>(null);
  const [samplesState, setSamplesState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [history, setHistory] = useState<CodeSubmission[] | null>(null);
  const [historyState, setHistoryState] = useState<'loading' | 'ok' | 'error' | 'login'>('loading');
  const [rank, setRank] = useState<{ rank: number; totalStudents: number; score: number } | null | 'none'>(null);
  const [kbOpen, setKbOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbOpen(true));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbOpen(false));
    return () => { a.remove(); b.remove(); };
  }, []);

  useEffect(() => { if (userId) XPService.init(userId); }, [userId]);

  // Theme + font preferences.
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(THEME_KEY), AsyncStorage.getItem(FONT_KEY)]).then(([t, fRaw]) => {
      const f = Number(fRaw);
      if (t === 'light' || t === 'dark') { setTheme(t); editorRef.current?.setTheme(t); }
      if (f >= 11 && f <= 24) { setFontSize(f); editorRef.current?.setFontSize(f); }
    }).catch(() => {});
  }, []);

  // ── Initial code: saved → exercise starter → default starter ───────────────
  const initedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!exercise || initedFor.current === exercise.id) return;
    initedFor.current = exercise.id;
    const startLang: CodingLangId = lockedLang || 'java';
    setLang(startLang);
    loadSavedCode(userId, exercise.id, startLang).then((saved) => {
      const code = saved ?? (exercise.starterCode || getDefaultStarter(startLang));
      codeRef.current = code;
      setInitialCode(code);
    });
  }, [exercise, lockedLang, userId]);

  const flushSave = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (exercise) saveCode(userId, exercise.id, langRef.current, codeRef.current);
  }, [exercise, userId]);

  const onCodeChange = useCallback((code: string) => {
    codeRef.current = code;
    if (!exercise) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const forLang = langRef.current; // save under the language being edited
    saveTimer.current = setTimeout(() => saveCode(userId, exercise.id, forLang, code), SAVE_DEBOUNCE_MS);
  }, [exercise, userId]);

  // Save on leave.
  const flushRef = useRef(flushSave);
  flushRef.current = flushSave;
  useEffect(() => () => flushRef.current(), []);

  // ── Samples + history ──────────────────────────────────────────────────────
  const loadSamples = useCallback(async () => {
    if (!exerciseId) return;
    setSamplesState('loading');
    try {
      const r = await codeApi.testCases(String(exerciseId));
      setSamples(r?.success ? r.testCases ?? [] : []);
      setSamplesState('ok');
    } catch {
      setSamplesState('error');
    }
  }, [exerciseId]);

  const loadHistory = useCallback(async () => {
    if (!exerciseId) return;
    if (!userId) { setHistoryState('login'); return; }
    setHistoryState('loading');
    try {
      const r = await codeApi.submissions(String(exerciseId));
      setHistory(r?.success ? r.submissions ?? [] : []);
      setHistoryState('ok');
    } catch {
      setHistoryState('error');
    }
  }, [exerciseId, userId]);

  useEffect(() => { loadSamples(); loadHistory(); }, [loadSamples, loadHistory]);

  // ── Language change (desktop codingChangeLanguage, without its save bug) ───
  const changeLanguage = useCallback(async (next: CodingLangId) => {
    setShowLangPicker(false);
    if (!exercise || next === lang) return;
    flushSave(); // keep the current language's code
    const saved = await loadSavedCode(userId, exercise.id, next);
    let code = codeRef.current;
    if (saved !== null) code = saved;
    else if (isDefaultOrEmpty(code)) code = getDefaultStarter(next);
    setLang(next);
    editorRef.current?.setMode(getLanguage(next).cmMode);
    if (code !== codeRef.current) {
      codeRef.current = code;
      editorRef.current?.setCode(code);
    }
  }, [exercise, lang, userId, flushSave]);

  // ── Rank (desktop fetchAndShowExerciseRank) ────────────────────────────────
  const fetchRank = useCallback(async () => {
    if (!courseId) return;
    try {
      const data = await leaderboardApi.get(String(courseId));
      if (data?.success && data.currentUserRank) {
        const r = data.currentUserRank;
        setRank({ rank: r.rank, totalStudents: r.totalStudents, score: r.score });
      } else setRank('none');
    } catch { /* non-critical */ }
  }, [courseId]);

  // ── Run ────────────────────────────────────────────────────────────────────
  const run = useCallback(async () => {
    Keyboard.dismiss();
    setPane('output');
    setOutTab('output');
    const code = codeRef.current;
    if (!code.trim()) { setRunView({ kind: 'error', text: 'Please write some code before running.' }); return; }
    setRunning(true);
    setRunView({ kind: 'busy', text: 'Running...' });
    try {
      const data = await codeApi.run({ source_code: code, language_id: langObj.judge0Id, stdin });
      if (data?.success) setRunView({ kind: 'run', data });
      else setRunView({ kind: 'error', text: data?.message || 'Execution failed.' });
    } catch (e) {
      const msg = (e as Error)?.message || '';
      setRunView({
        kind: 'error',
        text: isConnErr(msg) || !msg ? 'Failed to connect to execution service. Make sure the server is running.' : msg,
      });
    } finally {
      setRunning(false);
    }
  }, [langObj.judge0Id, stdin]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    Keyboard.dismiss();
    if (!exercise) return;
    const code = codeRef.current;
    if (!code.trim()) {
      setPane('output'); setOutTab('output');
      setRunView({ kind: 'error', text: 'Please write your solution before submitting.' });
      return;
    }
    flushSave();
    setPane('output');
    setOutTab('results');
    setSubmitting(true);

    // No course context → legacy exercise check (desktop fallback path).
    if (!courseId) {
      setSubmitView({ kind: 'busy', text: 'Checking...' });
      try {
        const res = await exerciseApi.submitAttempt({ exerciseId: exercise.id, code, courseId: '', language: lang });
        if (res?.success) {
          setSubmitView({ kind: 'legacy', ok: !!res.passed, text: res.passed ? (res.message || 'Correct! Well done! 🎉') : (res.message || 'Not quite right. Keep trying!') });
        } else setSubmitView({ kind: 'legacy', ok: true, text: 'Solution submitted!' });
      } catch {
        setSubmitView({ kind: 'legacy', ok: true, text: 'Solution submitted!' });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitView({ kind: 'busy', text: 'Running against test cases...' });
    try {
      const data = await codeApi.submit({
        exerciseId: exercise.id, source_code: code, language_id: langObj.judge0Id, courseId: String(courseId),
      });
      if (data?.success) {
        setSubmitView({ kind: 'result', data });
        if (data.passed) XPService.awardXP(`exercise-complete:${exercise.id}`, XP_REWARDS.exerciseComplete);
        fetchRank();
        loadHistory();
      } else {
        setSubmitView({ kind: 'error', text: data?.message || 'Submission failed.' });
      }
    } catch (e) {
      const msg = (e as Error)?.message || '';
      setSubmitView({
        kind: 'error',
        text: isConnErr(msg) || !msg ? 'Failed to connect. Check your internet and try again.' : msg,
      });
    } finally {
      setSubmitting(false);
    }
  }, [exercise, courseId, lang, langObj.judge0Id, flushSave, fetchRank, loadHistory]);

  const clearOutput = () => { setRunView({ kind: 'idle' }); setSubmitView({ kind: 'idle' }); };

  const useSample = () => {
    if (!samples || samples.length === 0) return;
    setStdin(samples[0].input);
    setShowInput(true);
    setPane('code');
  };

  const toggleTheme = () => {
    const t: EditorTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(t);
    editorRef.current?.setTheme(t);
    AsyncStorage.setItem(THEME_KEY, t).catch(() => {});
  };
  const changeFont = (d: number) => {
    const n = Math.max(11, Math.min(24, fontSize + d));
    setFontSize(n);
    editorRef.current?.setFontSize(n);
    AsyncStorage.setItem(FONT_KEY, String(n)).catch(() => {});
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderRun = () => {
    if (runView.kind === 'idle') return <Text style={styles.placeholder}>Run your code to see output here...</Text>;
    if (runView.kind === 'busy') return <BusyLine text={runView.text} />;
    if (runView.kind === 'error') return <Text style={styles.errText}>⚠ {runView.text}</Text>;
    const d = runView.data;
    const stats = (d.time || d.memory) ? (
      <View style={styles.stats}>
        {!!d.time && <Text style={styles.statText}>⏱ {d.time}s</Text>}
        {!!d.memory && <Text style={styles.statText}>💾 {(d.memory / 1024).toFixed(2)} MB</Text>}
      </View>
    ) : null;
    if (d.status === 'compilation_error' && d.compile_output) {
      return (<><Banner text="Compilation Error" color={Colors.danger} /><Pre text={d.compile_output} error />{stats}</>);
    }
    if (d.status === 'runtime_error' && d.stderr) {
      return (<><Banner text="Runtime Error" color={Colors.danger} /><Pre text={d.stderr} error />{stats}</>);
    }
    if (d.status === 'time_limit') {
      return (<><Banner text="Time Limit Exceeded" color={Colors.warning} /><Text style={styles.errText}>Your code took too long to execute (limit: 2 seconds).</Text>{stats}</>);
    }
    return (
      <>
        <Banner text="Executed Successfully" color={Colors.success} />
        {d.stdout ? <Pre text={d.stdout} /> : <Text style={styles.noOutput}>No output produced.</Text>}
        {!!d.stderr && !!d.stdout && (
          <View style={styles.warnBlock}>
            <Text style={styles.warnLabel}>Warnings:</Text>
            <Pre text={d.stderr} error />
          </View>
        )}
        {stats}
      </>
    );
  };

  const renderSubmit = () => {
    if (submitView.kind === 'idle') return <Text style={styles.placeholder}>Submit your code to see test results here...</Text>;
    if (submitView.kind === 'busy') return <BusyLine text={submitView.text} />;
    if (submitView.kind === 'error') return <Text style={styles.errText}>⚠ {submitView.text}</Text>;
    if (submitView.kind === 'legacy') {
      return <Banner text={(submitView.ok ? '✅ ' : '⚠ ') + submitView.text} color={submitView.ok ? Colors.success : Colors.warning} />;
    }
    const d = submitView.data;
    return (
      <>
        {d.passed
          ? <Banner text="✅ Accepted — All Test Cases Passed!" color={Colors.success} />
          : <Banner text={`❌ ${d.message || 'Some test cases failed.'}`} color={Colors.danger} />}
        {(d.results ?? []).map((tc) => (
          <View key={tc.test_case} style={[styles.tcItem, tc.passed ? styles.tcPass : styles.tcFail]}>
            <Text style={styles.tcHeader}>
              {tc.passed ? '✅' : '❌'} Test Case {tc.test_case}
              {tc.time ? <Text style={styles.tcTime}>  ({tc.time}s)</Text> : null}
            </Text>
            {!tc.passed && !tc.is_hidden && (
              <View style={styles.tcDetail}>
                <TcRow label="Input:" value={tc.input} />
                <TcRow label="Expected:" value={tc.expected} />
                <TcRow label="Got:" value={tc.actual} />
              </View>
            )}
            {!tc.passed && tc.is_hidden && <Text style={styles.tcLabel}>Hidden test case</Text>}
          </View>
        ))}
        {(d.time || d.memory) && (
          <View style={styles.stats}>
            {!!d.time && <Text style={styles.statText}>⏱ Total: {d.time}</Text>}
            {!!d.memory && <Text style={styles.statText}>💾 Peak: {d.memory}</Text>}
          </View>
        )}
        {rank && (
          <View style={styles.rankBox}>
            {rank === 'none' ? (
              <Text style={styles.rankEmpty}>Complete more exercises to see your rank!</Text>
            ) : (
              <>
                <Text style={styles.rankBolt}>⚡</Text>
                <Text style={styles.rankLabel}>Your Exercise Rank</Text>
                <Text style={styles.rankValue}>#{rank.rank}</Text>
                <Text style={styles.rankMeta}>out of {rank.totalStudents} students · Score: {rank.score}%</Text>
              </>
            )}
          </View>
        )}
      </>
    );
  };

  // ── Loading / not found ────────────────────────────────────────────────────
  if (!exercise) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Code Editor" onBack={() => router.back()} />
        <View style={styles.center}>
          {exLoading || !lessonId ? (
            lessonId ? <ActivityIndicator color={Colors.primary} size="large" /> : <Text style={styles.muted}>Exercise not found.</Text>
          ) : (
            <Text style={styles.muted}>Exercise not found.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const diff = (exercise.difficulty || 'medium').toLowerCase();
  const diffColor = DIFF_COLORS[diff] || '#f59e0b';
  const hintText = Array.isArray(exercise.hints) ? exercise.hints.filter(Boolean).join(' | ') : '';
  const busy = running || submitting;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header: back · title · difficulty · theme · font */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{exercise.title || 'Coding Exercise'}</Text>
        <View style={[styles.diff, { backgroundColor: diffColor + '20', borderColor: diffColor + '40' }]}>
          <Text style={[styles.diffText, { color: diffColor }]}>{diff}</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn} accessibilityLabel={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
          <Text style={styles.iconBtnText}>{theme === 'dark' ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => changeFont(-1)} style={styles.iconBtn} accessibilityLabel="Smaller text">
          <Text style={styles.fontBtn}>A−</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => changeFont(1)} style={styles.iconBtn} accessibilityLabel="Larger text">
          <Text style={styles.fontBtn}>A+</Text>
        </TouchableOpacity>
      </View>

      {/* Toolbar: language · Run · Submit */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.langBtn}
          onPress={() => !lockedLang && setShowLangPicker((v) => !v)}
          disabled={!!lockedLang}
          accessibilityLabel={`Language: ${langObj.label}`}
        >
          <Text style={styles.langText}>{langObj.icon} {langObj.label}{lockedLang ? '' : '  ▾'}</Text>
        </TouchableOpacity>
        <AiCoach
          problemId={exercise.id}
          lang={lang}
          getCode={() => codeRef.current}
          onReplaceCode={(c) => {
            codeRef.current = c;
            editorRef.current?.setCode(c);
            saveCode(userId, exercise.id, langRef.current, c);
          }}
          onAppendLine={(l) => {
            editorRef.current?.appendLine(l);
            codeRef.current = codeRef.current.replace(/\s+$/, '') + '\n' + l;
          }}
          onShowCode={() => setPane('code')}
        />
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

      {/* Pane tabs (hidden while typing → more room for code) */}
      {!kbOpen && (
        <View style={styles.paneTabs}>
          {([['problem', '📄 Problem'], ['code', '💻 Code'], ['output', '▶ Output'], ['history', '🕘 History']] as [Pane, string][]).map(([k, label]) => (
            <TouchableOpacity key={k} style={[styles.paneTab, pane === k && styles.paneTabOn]} onPress={() => setPane(k)}>
              <Text style={[styles.paneTabText, pane === k && styles.paneTabTextOn]} numberOfLines={1}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Code pane (kept mounted so the editor never reloads) ── */}
      <View style={[styles.flex, pane !== 'code' && styles.hidden]}>
        <View style={styles.fileBar}>
          <Text style={styles.fileName}>{'</>'} solution{langObj.extension}{editorFallback ? '  · basic editor' : ''}</Text>
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
              <Text style={styles.inputTitle}>{'>_'} Custom Input (stdin)</Text>
              <TouchableOpacity onPress={useSample} style={styles.sampleBtn} disabled={!samples?.length} accessibilityLabel="Use first sample test case input">
                <Text style={[styles.sampleBtnText, !samples?.length && { opacity: 0.4 }]}>Use Sample</Text>
              </TouchableOpacity>
              <Text style={styles.toggle}>{showInput ? '▼' : '▶'}</Text>
            </TouchableOpacity>
            {showInput && (
              <TextInput
                style={styles.stdin}
                value={stdin}
                onChangeText={setStdin}
                placeholder="Enter input here (one value per line)..."
                placeholderTextColor={Colors.muted}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
            )}
          </View>
        )}
      </View>

      {/* ── Problem pane ── */}
      {pane === 'problem' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.paneBody} keyboardShouldPersistTaps="handled">
          <Section title="📄 Problem Description"><Text style={styles.body}>{exercise.description}</Text></Section>
          {!!exercise.inputFormat && <Section title="Input Format"><Text style={styles.body}>{exercise.inputFormat}</Text></Section>}
          {!!exercise.outputFormat && <Section title="Output Format"><Text style={styles.body}>{exercise.outputFormat}</Text></Section>}
          {!!exercise.constraints && <Section title="Constraints"><Text style={styles.body}>{exercise.constraints}</Text></Section>}
          {!!hintText && (
            <View style={styles.hint}><Text style={styles.hintText}>💡 {hintText}</Text></View>
          )}
          <Section title="🧪 Sample Test Cases">
            {samplesState === 'loading' ? <Text style={styles.muted}>Loading...</Text>
              : samplesState === 'error' ? <Text style={styles.noOutput}>Could not load test cases.</Text>
              : !samples || samples.length === 0 ? <Text style={styles.noOutput}>No sample test cases available.</Text>
              : samples.map((s, i) => (
                <View key={s.id || i} style={styles.sample}>
                  <Text style={styles.sampleTitle}>Sample {i + 1}</Text>
                  <Text style={styles.sampleLabel}>Input</Text>
                  <Pre text={s.input} />
                  <Text style={styles.sampleLabel}>Expected Output</Text>
                  <Pre text={s.expectedOutput} />
                </View>
              ))}
          </Section>
          {!!exercise.explanation && <Section title="Explanation"><Text style={styles.body}>{exercise.explanation}</Text></Section>}
          {(!!exercise.timeComplexity || !!exercise.spaceComplexity) && (
            <View style={styles.stats}>
              {!!exercise.timeComplexity && <Text style={styles.statText}>⏱ Expected: {exercise.timeComplexity}</Text>}
              {!!exercise.spaceComplexity && <Text style={styles.statText}>💾 Space: {exercise.spaceComplexity}</Text>}
            </View>
          )}
          {!!exercise.tags?.length && (
            <View style={styles.tags}>{exercise.tags.map((t) => <Text key={t} style={styles.tag}>#{t}</Text>)}</View>
          )}
          <CodoHelpButton kind="exercise" exerciseId={exercise.id} onOpenPdf={setPdfUrl} />
        </ScrollView>
      )}

      {/* ── Output pane: Output | Test Results ── */}
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

      {/* ── History pane ── */}
      {pane === 'history' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.paneBody}>
          <View style={styles.historyHead}>
            <Text style={styles.sectionTitle}>🕘 Submission History</Text>
            <TouchableOpacity onPress={loadHistory}><Text style={styles.refresh}>↻ Refresh</Text></TouchableOpacity>
          </View>
          {historyState === 'login' ? <Text style={styles.muted}>Login to see submission history.</Text>
            : historyState === 'loading' ? <Text style={styles.muted}>Loading...</Text>
            : historyState === 'error' ? <Text style={styles.muted}>Could not load history.</Text>
            : !history || history.length === 0 ? <Text style={styles.muted}>No submissions yet for this exercise.</Text>
            : history.map((s) => {
              const l = historyLabel(s);
              return (
                <View key={s.id} style={styles.histItem}>
                  <Text style={[styles.histStatus, { color: l.color }]}>{l.text}</Text>
                  <Text style={styles.histMeta}>
                    {(s.language || 'unknown').toUpperCase()}
                    {s.executionTime ? `  ·  ⏱ ${s.executionTime}ms` : ''}
                    {s.memoryUsed ? `  ·  💾 ${Math.round(s.memoryUsed / 1024)} MB` : ''}
                    {`  ·  ${timeAgo(s.createdAt)}`}
                  </Text>
                </View>
              );
            })}
        </ScrollView>
      )}

      <PdfViewer visible={!!pdfUrl} pdfUrl={pdfUrl ?? ''} onClose={() => setPdfUrl(null)} />
    </SafeAreaView>
  );
}

// ── Small presentational pieces ──────────────────────────────────────────────
function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={10}><Text style={styles.back}>←</Text></TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
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
    <View style={styles.tcRow}>
      <Text style={styles.tcLabel}>{label}</Text>
      <Text selectable style={styles.tcCode}>{value}</Text>
    </View>
  );
}
function BusyLine({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <ActivityIndicator size="small" color="#60a5fa" />
      <Text style={styles.info}>  {text}</Text>
    </View>
  );
}

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

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

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.03)' },
  langBtn: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  langText: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  langChip: { borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.04)' },
  langChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langChipText: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  runBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  runText: { color: '#22c55e', fontSize: 13, fontWeight: '800' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  submitText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  dim: { opacity: 0.55 },

  paneTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  paneTab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  paneTabOn: { borderBottomColor: Colors.primary },
  paneTabText: { color: Colors.muted, fontSize: 12, fontWeight: '700' },
  paneTabTextOn: { color: '#fff' },

  fileBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#0b0b12' },
  fileName: { color: Colors.muted, fontSize: 11, fontFamily: MONO },
  cursor: { color: Colors.muted, fontSize: 11, fontFamily: MONO },

  inputSection: { borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg2 },
  inputHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  inputTitle: { flex: 1, color: Colors.text, fontSize: 12, fontWeight: '700', fontFamily: MONO },
  sampleBtn: { backgroundColor: 'rgba(108,71,255,0.15)', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
  sampleBtnText: { color: Colors.purple, fontSize: 11, fontWeight: '700' },
  toggle: { color: Colors.muted, fontSize: 11 },
  stdin: { minHeight: 70, maxHeight: 140, marginHorizontal: 12, marginBottom: 10, padding: 10, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: Colors.border, color: Colors.text, fontFamily: MONO, fontSize: 13, textAlignVertical: 'top' },

  paneBody: { padding: 14, paddingBottom: 40 },
  section: { marginBottom: 14 },
  sectionTitle: { color: Colors.purple, fontSize: 12, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  body: { color: Colors.text, fontSize: 14, lineHeight: 21 },
  hint: { backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', borderRadius: 10, padding: 10, marginBottom: 14 },
  hintText: { color: '#fcd34d', fontSize: 13, lineHeight: 19 },
  sample: { marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: Colors.border },
  sampleTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  sampleLabel: { color: Colors.muted, fontSize: 11, fontWeight: '700', marginTop: 4, marginBottom: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  tag: { color: Colors.purple, fontSize: 12, backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },

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
  warnBlock: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  warnLabel: { color: Colors.warning, fontSize: 11, fontWeight: '700', marginBottom: 4 },
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

  rankBox: { marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', alignItems: 'center' },
  rankBolt: { fontSize: 22 },
  rankLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rankValue: { color: '#22c55e', fontSize: 26, fontWeight: '800', marginVertical: 4 },
  rankMeta: { color: Colors.muted, fontSize: 12 },
  rankEmpty: { color: Colors.muted, fontSize: 13 },

  historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  refresh: { color: Colors.purple, fontSize: 12, fontWeight: '700' },
  histItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  histStatus: { fontSize: 13, fontWeight: '800' },
  histMeta: { color: Colors.muted, fontSize: 11, marginTop: 3, fontFamily: MONO },
});
