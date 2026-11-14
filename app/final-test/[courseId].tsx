/**
 * Final Course Test (mobile) — 50 MCQs drawn from the course's lesson quizzes.
 *
 * Flow: intro → test (timer, question palette, prev/next, submit) → result
 * (score, pass/fail, review) → confirm certificate name → certificate (in-app).
 * Answers are graded on the SERVER; the app never receives the answer key
 * before submitting. Picked answers are saved locally per attempt so the test
 * can be resumed if the app closes (the server timer keeps running).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, BackHandler, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import {
  finalTestApi, type FinalTestStatus, type FinalTestStart, type FinalTestResult, type FinalTestAttemptReview,
} from '@/api';
import { CertificateViewer } from '@/components/finalTest/CertificateViewer';
import { Colors } from '@/theme';

type Phase = 'loading' | 'intro' | 'test' | 'submitting' | 'result' | 'claim' | 'review' | 'error';
type ReadyStatus = Extract<FinalTestStatus, { available: true }>;

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const answersKey = (attemptId: string) => `ck_final_answers_${attemptId}`;

function fmtClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function FinalTestScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const cid = String(courseId || '');
  const qc = useQueryClient();

  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<ReadyStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [test, setTest] = useState<FinalTestStart | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(0);
  const [showPalette, setShowPalette] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState<FinalTestResult | null>(null);
  const [claimAttemptId, setClaimAttemptId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [viewCode, setViewCode] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [reviewData, setReviewData] = useState<FinalTestAttemptReview | null>(null);
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null);
  const clockOffset = useRef(0); // serverNow - deviceNow
  const submittedRef = useRef(false);

  const loadStatus = useCallback(async () => {
    setPhase('loading');
    try {
      const s = await finalTestApi.status(cid);
      if (!s.available) { setErrorMsg('The final test is not available for this course yet.'); setPhase('error'); return; }
      setStatus(s);
      setPhase('intro');
    } catch (e) {
      setErrorMsg((e as Error)?.message || 'Could not load the final test.');
      setPhase('error');
    }
  }, [cid]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const refreshCourseCard = () => qc.invalidateQueries({ queryKey: ['final-test', cid] });

  // ── Start / resume ─────────────────────────────────────────────────────────
  const start = async () => {
    setStarting(true);
    try {
      const t = await finalTestApi.start(cid);
      clockOffset.current = new Date(t.serverNow).getTime() - Date.now();
      const saved = await AsyncStorage.getItem(answersKey(t.attemptId)).catch(() => null);
      setAnswers(saved ? JSON.parse(saved) : {});
      setTest(t);
      setIdx(0);
      submittedRef.current = false;
      setPhase('test');
    } catch (e) {
      Alert.alert('Final Test', (e as Error)?.message || 'Could not start the test.');
    } finally {
      setStarting(false);
    }
  };

  // ── Review a past attempt ──────────────────────────────────────────────────
  const openReview = async (attemptId: string) => {
    if (reviewLoadingId) return;
    setReviewLoadingId(attemptId);
    try {
      const r = await finalTestApi.review(attemptId);
      setReviewData(r);
      setPhase('review');
    } catch (e) {
      Alert.alert('Review', (e as Error)?.message || 'Could not load this attempt.');
    } finally {
      setReviewLoadingId(null);
    }
  };

  // ── Answers (saved locally for resume) ─────────────────────────────────────
  const pick = (quizId: string, option: number) => {
    setAnswers((prev) => {
      const next = { ...prev, [quizId]: option };
      if (test) AsyncStorage.setItem(answersKey(test.attemptId), JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const doSubmit = useCallback(async (auto = false) => {
    if (!test || submittedRef.current) return;
    submittedRef.current = true;
    setPhase('submitting');
    try {
      const r = await finalTestApi.submit(test.attemptId, answers);
      AsyncStorage.removeItem(answersKey(test.attemptId)).catch(() => {});
      setResult(r);
      if (r.needsCertificate) { setClaimAttemptId(test.attemptId); setName(r.suggestedName || ''); }
      refreshCourseCard();
      setPhase('result');
      if (auto) Alert.alert("Time's up", 'Your test was submitted automatically.');
    } catch (e) {
      submittedRef.current = false;
      setPhase('test');
      Alert.alert('Submit failed', `${(e as Error)?.message || 'Please check your internet.'}\nYour answers are saved — try again.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test, answers]);

  const confirmSubmit = () => {
    if (!test) return;
    const unanswered = test.questions.length - Object.keys(answers).length;
    Alert.alert(
      'Submit test?',
      unanswered > 0 ? `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?` : 'Submit your answers now?',
      [{ text: 'Keep going', style: 'cancel' }, { text: 'Submit', style: 'destructive', onPress: () => doSubmit(false) }]
    );
  };

  // ── Timer (server-synced) ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'test' || !test) return;
    const end = new Date(test.endsAt).getTime();
    const tick = () => {
      const left = (end - (Date.now() + clockOffset.current)) / 1000;
      setRemaining(left);
      if (left <= 0) doSubmit(true);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [phase, test, doSubmit]);

  // ── Back during the test ───────────────────────────────────────────────────
  const leaveTest = useCallback(() => {
    Alert.alert(
      'Leave the test?',
      'Your answers are saved and the timer keeps running. You can resume from the course page before time runs out.',
      [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => { refreshCourseCard(); router.back(); } }]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'test') { leaveTest(); return true; }
      if (phase === 'review') { setPhase(result ? 'result' : 'intro'); return true; }
      if (phase === 'submitting' || phase === 'claim') return true;
      return false;
    });
    return () => sub.remove();
  }, [phase, leaveTest]);

  // ── Claim certificate ──────────────────────────────────────────────────────
  const claim = async () => {
    if (!claimAttemptId) return;
    const n = name.replace(/\s+/g, ' ').trim();
    if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(n)) {
      Alert.alert('Check the name', "Use English letters only (spaces, . ' - allowed), 2–60 characters.");
      return;
    }
    Alert.alert('Confirm name', `Your certificate will show:\n\n${n}\n\nThis cannot be changed later.`, [
      { text: 'Edit', style: 'cancel' },
      {
        text: 'Confirm', onPress: async () => {
          setClaiming(true);
          try {
            const r = await finalTestApi.issueCertificate(claimAttemptId, n);
            refreshCourseCard();
            setClaimAttemptId(null);
            setStatus((s) => (s ? { ...s, certificate: r.certificate, pendingCertificate: null } : s));
            setResult((res) => (res ? { ...res, needsCertificate: false, certificate: { code: r.certificate.code, issuedAt: r.certificate.issuedAt } } : res));
            setPhase('result');
            setViewCode(r.certificate.code);
          } catch (e) {
            Alert.alert('Certificate', (e as Error)?.message || 'Could not issue the certificate.');
          } finally {
            setClaiming(false);
          }
        },
      },
    ]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  const q = test?.questions[idx];
  const answeredCount = Object.keys(answers).length;
  const lowTime = remaining > 0 && remaining < 300;

  const header = (title: string, onBack: () => void) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={10} accessibilityLabel="Back"><Text style={styles.back}>←</Text></TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
    </View>
  );

  if (phase === 'loading' || phase === 'submitting') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.muted}>{phase === 'submitting' ? 'Checking your answers…' : 'Loading…'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        {header('Final Test', () => router.back())}
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>📝</Text>
          <Text style={styles.muted}>{errorMsg}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={loadStatus}><Text style={styles.primaryText}>Try again</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Intro ──
  if (phase === 'intro' && status) {
    const s = status;
    const cooling = !!s.nextAttemptAt && !s.inProgress;
    return (
      <SafeAreaView style={styles.container}>
        {header('Final Test', () => router.back())}
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.bigEmoji}>🎓</Text>
          <Text style={styles.title}>{s.courseTitle}</Text>
          <Text style={styles.subtitle}>Final Course Test</Text>

          <View style={styles.rules}>
            <Rule icon="❓" text={`${s.totalQuestions} multiple-choice questions from every lesson`} />
            <Rule icon="⏱" text={`${s.timeLimitMin} minutes — submitted automatically when time ends`} />
            <Rule icon="🎯" text={`Score ${s.passPercent}% or more to pass and earn your certificate`} />
            <Rule icon="🔁" text="Failed? You can retake it after 24 hours" />
          </View>

          {s.bestPercent !== null && (
            <Text style={styles.muted}>Attempts: {s.attemptsCount} · Best score: {s.bestPercent}%</Text>
          )}

          {s.attempts?.length > 0 && (
            <View style={styles.attemptsBox}>
              <Text style={styles.reviewTitle}>My attempts · tap to review answers</Text>
              {s.attempts.map((a, i) => (
                <TouchableOpacity
                  key={a.attemptId}
                  style={styles.attemptRow}
                  onPress={() => openReview(a.attemptId)}
                  disabled={!!reviewLoadingId}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attemptTitle}>Attempt {s.attempts.length - i} · {a.percent}%</Text>
                    <Text style={styles.attemptMeta}>{a.score}/{a.total} correct · {fmtDate(a.submittedAt)}</Text>
                  </View>
                  <Text style={[styles.attemptBadge, { color: a.passed ? Colors.success : Colors.warning }]}>
                    {a.passed ? '✅ Passed' : 'Not passed'}
                  </Text>
                  {reviewLoadingId === a.attemptId ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.chev}>›</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {s.certificate ? (
            <View style={styles.certBox}>
              <Text style={styles.certTitle}>🏆 Certificate earned</Text>
              <Text style={styles.muted}>{s.certificate.studentName} · {s.certificate.percent}% · {s.certificate.code}</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setViewCode(s.certificate!.code)}>
                <Text style={styles.primaryText}>📜 View Certificate</Text>
              </TouchableOpacity>
            </View>
          ) : s.pendingCertificate ? (
            <View style={styles.certBox}>
              <Text style={styles.certTitle}>🎉 You passed! Claim your certificate</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => { setClaimAttemptId(s.pendingCertificate!.attemptId); setName(s.pendingCertificate!.suggestedName || ''); setPhase('claim'); }}
              >
                <Text style={styles.primaryText}>Get Certificate</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!s.enrolled ? (
            <Text style={styles.lockText}>🔒 Enroll in this course to take the final test.</Text>
          ) : !s.unlocked ? (
            <Text style={styles.lockText}>🔒 Complete all lessons to unlock ({s.completedLessons}/{s.totalLessons} done).</Text>
          ) : cooling ? (
            <Text style={styles.lockText}>⏳ You can retake the test after {fmtDate(s.nextAttemptAt!)}.</Text>
          ) : (
            <TouchableOpacity style={[styles.startBtn, starting && styles.dim]} onPress={start} disabled={starting}>
              {starting ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.startText}>
                  {s.inProgress ? '▶ Resume Test' : s.passed ? '🔁 Practice Again' : '▶ Start Final Test'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
        <CertificateViewer
          code={viewCode} visible={!!viewCode} onClose={() => setViewCode(null)}
          info={{ courseTitle: s.courseTitle, percent: s.certificate?.percent }}
        />
      </SafeAreaView>
    );
  }

  // ── Test ──
  if (phase === 'test' && test && q) {
    const sel = answers[q.id];
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.testBar}>
          <TouchableOpacity onPress={leaveTest} hitSlop={10}><Text style={styles.back}>←</Text></TouchableOpacity>
          <Text style={styles.counter}>Question {idx + 1}/{test.questions.length}</Text>
          <View style={[styles.timer, lowTime && styles.timerLow]}>
            <Text style={[styles.timerText, lowTime && { color: '#fff' }]}>⏱ {fmtClock(remaining)}</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(answeredCount / test.questions.length) * 100}%` }]} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.question}>{q.question}</Text>
          {q.options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.option, sel === i && styles.optionOn]}
              onPress={() => pick(q.id, i)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel === i }}
            >
              <Text style={[styles.optLetter, sel === i && styles.optLetterOn]}>{LETTERS[i] || i + 1}</Text>
              <Text style={styles.optText}>{opt}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={() => setShowPalette((v) => !v)} style={styles.paletteToggle}>
            <Text style={styles.paletteToggleText}>
              {showPalette ? '▲ Hide' : '▦ All questions'} · {answeredCount}/{test.questions.length} answered
            </Text>
          </TouchableOpacity>
          {showPalette && (
            <View style={styles.palette}>
              {test.questions.map((qq, i) => (
                <TouchableOpacity
                  key={qq.id}
                  style={[styles.dot, answers[qq.id] !== undefined && styles.dotDone, i === idx && styles.dotCurrent]}
                  onPress={() => { setIdx(i); setShowPalette(false); }}
                >
                  <Text style={styles.dotText}>{i + 1}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.navBar}>
          <TouchableOpacity style={[styles.navBtn, idx === 0 && styles.dim]} disabled={idx === 0} onPress={() => setIdx(idx - 1)}>
            <Text style={styles.navText}>‹ Prev</Text>
          </TouchableOpacity>
          {idx < test.questions.length - 1 ? (
            <TouchableOpacity style={[styles.navBtn, styles.navNext]} onPress={() => setIdx(idx + 1)}>
              <Text style={[styles.navText, { color: '#fff' }]}>Next ›</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.navBtn, styles.navSubmit]} onPress={confirmSubmit}>
              <Text style={[styles.navText, { color: '#fff' }]}>✓ Submit</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Claim (confirm certificate name) ──
  if (phase === 'claim') {
    return (
      <SafeAreaView style={styles.container}>
        {header('Your Certificate', () => setPhase(result ? 'result' : 'intro'))}
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.bigEmoji}>📜</Text>
          <Text style={styles.title}>Name on your certificate</Text>
          <Text style={styles.mutedCenter}>Check the spelling — the certificate can’t be edited after it is issued.</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={Colors.muted}
            autoCapitalize="words"
            maxLength={60}
          />
          <TouchableOpacity style={[styles.startBtn, claiming && styles.dim]} onPress={claim} disabled={claiming}>
            {claiming ? <ActivityIndicator color="#fff" /> : <Text style={styles.startText}>Get Certificate</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Result ──
  if (phase === 'result' && result) {
    const r = result;
    return (
      <SafeAreaView style={styles.container}>
        {header('Result', () => router.back())}
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.bigEmoji}>{r.passed ? '🎉' : '💪'}</Text>
          <Text style={[styles.score, { color: r.passed ? Colors.success : Colors.warning }]}>{r.percent}%</Text>
          <Text style={styles.title}>{r.passed ? 'You passed!' : 'Not passed yet'}</Text>
          <Text style={styles.mutedCenter}>
            {r.score}/{r.total} correct · pass mark {r.passPercent}%
            {r.late ? '\nSubmitted after the time limit — answers were not counted.' : ''}
          </Text>

          {r.passed ? (
            r.certificate ? (
              <TouchableOpacity style={styles.startBtn} onPress={() => setViewCode(r.certificate!.code)}>
                <Text style={styles.startText}>📜 View Certificate</Text>
              </TouchableOpacity>
            ) : r.needsCertificate ? (
              <TouchableOpacity style={styles.startBtn} onPress={() => setPhase('claim')}>
                <Text style={styles.startText}>🎓 Get Your Certificate</Text>
              </TouchableOpacity>
            ) : null
          ) : (
            <Text style={styles.lockText}>
              Revise the lessons you missed and try again{r.nextAttemptAt ? ` after ${fmtDate(r.nextAttemptAt)}` : ''}.
            </Text>
          )}

          <Text style={styles.reviewTitle}>Review</Text>
          <ReviewList items={r.review} />
          {!r.passed && <Text style={styles.mutedCenter}>Correct answers are shown once you pass.</Text>}
        </ScrollView>
        <CertificateViewer
          code={viewCode} visible={!!viewCode} onClose={() => setViewCode(null)}
          info={{ courseTitle: status?.courseTitle, percent: r.percent }}
        />
      </SafeAreaView>
    );
  }

  // ── Review of a past attempt ──
  if (phase === 'review' && reviewData) {
    const d = reviewData;
    return (
      <SafeAreaView style={styles.container}>
        {header('Attempt review', () => setPhase(result ? 'result' : 'intro'))}
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.score, { color: d.passed ? Colors.success : Colors.warning }]}>{d.percent}%</Text>
          <Text style={styles.title}>{d.passed ? 'Passed' : 'Not passed'}</Text>
          <Text style={styles.mutedCenter}>{d.score}/{d.total} correct · {fmtDate(d.submittedAt)}</Text>
          <ReviewList items={d.review} />
          {!d.answersRevealed && (
            <Text style={styles.mutedCenter}>Correct answers are shown once you pass the test.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return <SafeAreaView style={styles.container} />;
}

function ReviewList({ items }: { items: FinalTestResult['review'] }) {
  return (
    <>
      {items.map((it, i) => (
        <View key={it.quizId} style={[styles.reviewItem, it.correct ? styles.reviewOk : styles.reviewBad]}>
          <Text style={styles.reviewQ}>{it.correct ? '✅' : '❌'} {i + 1}. {it.question}</Text>
          <Text style={styles.reviewA}>
            Your answer: {it.selected !== null ? `${LETTERS[it.selected]}. ${it.options[it.selected] ?? ''}` : 'Not answered'}
          </Text>
          {it.answer !== null && !it.correct && (
            <Text style={[styles.reviewA, { color: Colors.success }]}>Correct: {LETTERS[it.answer]}. {it.options[it.answer]}</Text>
          )}
          {!!it.explanation && !it.correct && <Text style={styles.reviewExp}>{it.explanation}</Text>}
        </View>
      ))}
    </>
  );
}

function Rule({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleIcon}>{icon}</Text>
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { color: Colors.primary, fontSize: 22, fontWeight: '700' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  body: { padding: 18, paddingBottom: 40, alignItems: 'stretch' },
  bigEmoji: { fontSize: 48, textAlign: 'center', marginBottom: 6 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.purple, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  muted: { color: Colors.muted, fontSize: 13, textAlign: 'center', marginBottom: 10 },
  mutedCenter: { color: Colors.muted, fontSize: 13, textAlign: 'center', marginVertical: 8, lineHeight: 19 },
  rules: { backgroundColor: Colors.bg2, borderRadius: 14, padding: 14, gap: 10, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  rule: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  ruleIcon: { fontSize: 16, width: 22 },
  ruleText: { flex: 1, color: Colors.text, fontSize: 14, lineHeight: 20 },
  certBox: { backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.25)', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14, alignItems: 'center', gap: 6 },
  certTitle: { color: Colors.success, fontSize: 15, fontWeight: '800' },
  lockText: { color: Colors.warning, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  startBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  startText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, marginTop: 6 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dim: { opacity: 0.5 },

  testBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  counter: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  timer: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  timerLow: { backgroundColor: Colors.danger },
  timerText: { color: Colors.text, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)' },
  progressFill: { height: 4, backgroundColor: Colors.primary },
  question: { color: '#fff', fontSize: 17, fontWeight: '700', lineHeight: 25, marginBottom: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  optionOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  optLetter: { width: 28, height: 28, borderRadius: 14, textAlign: 'center', lineHeight: 28, backgroundColor: 'rgba(255,255,255,0.08)', color: Colors.text, fontWeight: '800', overflow: 'hidden' },
  optLetterOn: { backgroundColor: Colors.primary, color: '#fff' },
  optText: { flex: 1, color: Colors.text, fontSize: 15, lineHeight: 21 },
  paletteToggle: { alignSelf: 'center', paddingVertical: 10 },
  paletteToggleText: { color: Colors.purple, fontSize: 13, fontWeight: '700' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  dot: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Colors.border },
  dotDone: { backgroundColor: 'rgba(108,71,255,0.35)', borderColor: Colors.primary },
  dotCurrent: { borderColor: '#fff', borderWidth: 2 },
  dotText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  navBar: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  navBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  navNext: { backgroundColor: Colors.primary },
  navSubmit: { backgroundColor: Colors.success },
  navText: { color: Colors.text, fontSize: 15, fontWeight: '800' },

  score: { fontSize: 52, fontWeight: '900', textAlign: 'center' },
  reviewTitle: { color: Colors.purple, fontSize: 13, fontWeight: '800', marginTop: 22, marginBottom: 8, textTransform: 'uppercase' },
  reviewItem: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  reviewOk: { backgroundColor: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' },
  reviewBad: { backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' },
  reviewQ: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20, marginBottom: 4 },
  reviewA: { color: Colors.text, fontSize: 13, lineHeight: 19 },
  reviewExp: { color: Colors.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  attemptsBox: { marginBottom: 14 },
  attemptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bg2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8 },
  attemptTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  attemptMeta: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  attemptBadge: { fontSize: 12, fontWeight: '800' },
  chev: { color: Colors.muted, fontSize: 20 },
  nameInput: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, color: '#fff', fontSize: 17, marginTop: 14, textAlign: 'center' },
});
