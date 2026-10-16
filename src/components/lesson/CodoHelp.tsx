/**
 * Codo AI help UI — mobile port of the desktop lesson-tabs.js / ai-chat.js
 * Codo experience. Three exported pieces:
 *
 *   • CodoText        — renders Codo's answer text with light markdown
 *                       (**bold**, `code`, ```fences```), matching desktop
 *                       _formatHelpText.
 *   • CodoSources     — "📘 From your course material" attribution block
 *                       (tap a source to open its signed PDF). Matches desktop.
 *   • CodoListenButton— a "Listen"/"Stop" pill that plays Codo's premium voice
 *                       via the shared TTS service (expo-audio).
 *   • CodoAnswerCard  — a full answer bubble (text + sources + Listen), reused
 *                       by the AI mentor screen and the AskNow chat.
 *   • CodoHelpButton  — the two-stage "Stuck? Can I help?" button for a quiz or
 *                       exercise: 1st tap = hint, 2nd tap = answer. Mirrors
 *                       desktop requestLessonHelp.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Linking,
} from 'react-native';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';
import { lessonHelpApi, mediaApi, type AiSource, type LessonHelpData } from '@/api';
import {
  toggleCodoVoice, speakCodo, seedVoiceCache, getHelpCache, stopCodoVoice, isVoiceAvailable,
  loadCodoScripts, codoScriptText, speakCodoSolution,
} from '@/services';

const CODO_IMG = require('../../../assets/codo.jpg');

// ─────────────────────────────────────────────────────────────────────────
// Light markdown → RN <Text> segments (bold / inline code / code fences).
// Mirrors desktop _formatHelpText, adapted to React Native Text nodes.
// ─────────────────────────────────────────────────────────────────────────
export function CodoText({ text, color }: { text: string; color?: string }) {
  const baseColor = color || Colors.text;
  const blocks: React.ReactNode[] = [];
  const src = String(text || '');
  // Split out ```code fences``` first.
  const fenceRe = /```(?:\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  const pushInline = (chunk: string) => {
    blocks.push(
      <Text key={`t${key++}`} style={[styles.answerText, { color: baseColor }]}>
        {renderInline(chunk, key)}
      </Text>
    );
  };
  while ((m = fenceRe.exec(src)) !== null) {
    if (m.index > last) pushInline(src.slice(last, m.index));
    blocks.push(
      <View key={`c${key++}`} style={styles.codeBlock}>
        <Text style={styles.codeText}>{m[1].replace(/\n$/, '')}</Text>
      </View>
    );
    last = fenceRe.lastIndex;
  }
  if (last < src.length) pushInline(src.slice(last));
  return <View>{blocks}</View>;
}

// Render **bold** and `inline code` within a text chunk as nested <Text>.
function renderInline(chunk: string, keyBase: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(chunk)) !== null) {
    if (m.index > last) parts.push(chunk.slice(last, m.index));
    if (m[2] !== undefined) {
      parts.push(<Text key={`b${keyBase}-${k++}`} style={styles.boldText}>{m[2]}</Text>);
    } else if (m[3] !== undefined) {
      parts.push(<Text key={`i${keyBase}-${k++}`} style={styles.inlineCode}>{m[3]}</Text>);
    }
    last = re.lastIndex;
  }
  if (last < chunk.length) parts.push(chunk.slice(last));
  return parts;
}

// ─────────────────────────────────────────────────────────────────────────
// Source attribution block (answer stage only). Mirrors desktop _renderHelpSources.
// ─────────────────────────────────────────────────────────────────────────
export function CodoSources({
  source,
  sources,
  onOpenPdf,
}: {
  source?: string;
  sources?: AiSource[];
  // When provided, source PDFs open INSIDE the app via this callback (the
  // lesson screen passes its in-app PdfViewer opener). Without it, we fall back
  // to opening in the external browser.
  onOpenPdf?: (fileUrl: string) => void;
}) {
  const list = Array.isArray(sources) ? sources : [];

  const openSource = useCallback(async (fileUrl: string) => {
    // Prefer the in-app PDF viewer (same one course content uses). The viewer
    // signs the S3 URL itself, so we hand it the raw fileUrl.
    if (onOpenPdf) {
      onOpenPdf(fileUrl);
      return;
    }
    // Fallback (e.g. screens without an in-app viewer): external browser.
    try {
      const data = await mediaApi.getSignedUrl(fileUrl);
      const url = data?.success && data.signedUrl ? data.signedUrl : fileUrl;
      Linking.openURL(url).catch(() => {});
    } catch {
      Linking.openURL(fileUrl).catch(() => {});
    }
  }, [onOpenPdf]);

  if (source === 'study_material' && list.length > 0) {
    return (
      <View style={styles.sourcesWrap}>
        <Text style={styles.sourcesTitle}>📘 From your course material:</Text>
        {list.map((s, i) => (
          <View key={i} style={styles.sourceRow}>
            {s.fileUrl ? (
              <TouchableOpacity onPress={() => openSource(s.fileUrl as string)} activeOpacity={0.7}>
                <Text style={styles.sourceLink}>📄 {s.name || 'Document'}  ↗</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.sourceName}>📄 {s.name || 'Document'}</Text>
            )}
            {!!s.snippet && (
              <Text style={styles.sourceSnippet}>
                <Text style={{ color: Colors.coin }}>🔍 Find this in the doc: </Text>
                “{s.snippet}”
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  }
  if (source === 'teacher_note') {
    return <Text style={styles.sourceNote}>📝 Based on the lesson’s teacher note.</Text>;
  }
  if (source === 'ai') {
    return (
      <Text style={styles.sourceNote}>
        🤖 General explanation (not found in your course material).
      </Text>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Listen / Stop pill — plays Codo's premium voice. Mirrors desktop toggleCodoSpeak.
// ─────────────────────────────────────────────────────────────────────────
export function CodoListenButton({
  text,
  audio,
  color,
  autoPlay,
  wrapSolution,
}: {
  text: string;
  audio?: string | null; // pre-computed base64 mp3, if the server shipped it
  color?: string;
  autoPlay?: boolean;
  // When true, Listen plays the fixed PREFIX → text → POSTFIX sequence
  // (used in the Codo solution panel). Otherwise plays just `text`.
  wrapSolution?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const accent = color || Colors.purple;

  React.useEffect(() => {
    if (!text) return;
    if (audio) seedVoiceCache(text, audio);
    if (autoPlay && isVoiceAvailable()) {
      if (wrapSolution) speakCodoSolution(text, setPlaying);
      else speakCodo(text, setPlaying);
    }
    return () => { stopCodoVoice(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Voice unavailable on this build (expo-audio not installed yet) → hide.
  if (!isVoiceAvailable()) return null;

  const onPress = () => {
    if (playing) { stopCodoVoice(); setPlaying(false); return; }
    if (wrapSolution) speakCodoSolution(text, setPlaying);
    else toggleCodoVoice(text, setPlaying);
  };

  return (
    <TouchableOpacity
      style={[styles.listenBtn, { borderColor: accent }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.listenText, { color: accent }]}>
        {playing ? '■ Stop' : '🔊 Listen'}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Full Codo answer bubble (avatar + label + text + sources + Listen).
// Reused by the AI mentor screen and the AskNow chat for 'ai' messages.
// ─────────────────────────────────────────────────────────────────────────
export function CodoAnswerCard({
  text,
  source,
  sources,
  audio,
  autoPlay,
  onOpenPdf,
}: {
  text: string;
  source?: string;
  sources?: AiSource[];
  audio?: string | null;
  autoPlay?: boolean;
  onOpenPdf?: (fileUrl: string) => void;
}) {
  return (
    <View style={styles.answerCard}>
      <View style={styles.answerHeader}>
        <Image source={CODO_IMG} style={styles.avatar} />
        <Text style={styles.codoLabel}>Codo</Text>
        <View style={{ flex: 1 }} />
        <CodoListenButton text={text} audio={audio} autoPlay={autoPlay} />
      </View>
      <CodoText text={text} />
      <CodoSources source={source} sources={sources} onOpenPdf={onOpenPdf} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// "Stuck? Can I help?" button for a quiz or exercise.
// Hint stage removed — a single tap shows the full solution directly, wrapped
// with Codo's fixed spoken prefix + postfix (voiced in Codo's cloned voice).
// ─────────────────────────────────────────────────────────────────────────
export function CodoHelpButton({
  kind,
  quizId,
  exerciseId,
  onOpenPdf,
}: {
  kind: 'quiz' | 'exercise';
  quizId?: string;
  exerciseId?: string;
  onOpenPdf?: (fileUrl: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [result, setResult] = useState<LessonHelpData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ensure the fixed prefix/postfix scripts (text + audio) are loaded.
  React.useEffect(() => { loadCodoScripts(); }, []);

  const request = useCallback(async () => {
    setError(null);
    // Always the full solution (stage "answer"). Memory-first via prefetch cache.
    const itemId = kind === 'quiz' ? (quizId || '') : (exerciseId || '');
    const cached = getHelpCache(kind, itemId, 'answer');
    if (cached?.help) {
      setResult({
        success: true,
        stage: 'answer',
        help: cached.help,
        source: cached.source,
        sources: cached.sources,
        audio: cached.audio ?? null,
      });
      setHidden(true);
      // Audio plays via the CodoListenButton below (autoPlay + wrapSolution).
      if (cached.audio) seedVoiceCache(cached.help, cached.audio);
      return;
    }

    setLoading(true);
    try {
      const data = await lessonHelpApi.getHelp({ kind, quizId, exerciseId, stage: 'answer' });
      if (data?.success && data.help) {
        setResult(data);
        setHidden(true); // solution shown — hide the button
        if (data.audio) seedVoiceCache(data.help, data.audio);
        // Audio plays via the CodoListenButton below (autoPlay + wrapSolution).
      } else {
        setError((data && data.message) || 'Codo is a little busy. Please try again in a moment.');
      }
    } catch (e) {
      setError((e as Error)?.message || 'Codo is a little busy. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [kind, quizId, exerciseId]);

  const accent = Colors.success;
  const bg = 'rgba(34,197,94,0.08)';
  const border = 'rgba(34,197,94,0.25)';

  // Prefix/postfix text to show around the solution.
  const prefixText = codoScriptText('codo_solution_prefix', '');
  const postfixText = codoScriptText('codo_solution_postfix', '');

  return (
    <View style={{ marginTop: Spacing.md }}>
      {!hidden && (
        <TouchableOpacity style={styles.codoHelpBtn} onPress={request} disabled={loading} activeOpacity={0.8}>
          <Image source={CODO_IMG} style={styles.codoHelpImg} />
          {loading ? (
            <View style={styles.codoHelpRow}>
              <ActivityIndicator size="small" color={Colors.purple} />
              <Text style={styles.codoHelpText}>  Codo is thinking…</Text>
            </View>
          ) : (
            <Text style={styles.codoHelpText}>Stuck? Can I help? 👋</Text>
          )}
        </TouchableOpacity>
      )}

      {result?.help && (
        <View style={[styles.helpPanel, { backgroundColor: bg, borderColor: border }]}>
          <View style={styles.helpHeader}>
            <Text style={[styles.helpTitle, { color: accent }]}>🦜 Codo’s solution</Text>
            <View style={{ flex: 1 }} />
            <CodoListenButton text={result.help} audio={result.audio} color={accent} autoPlay wrapSolution />
          </View>
          {!!prefixText && (
            <Text style={[styles.answerText, { color: accent, marginBottom: Spacing.sm, fontStyle: 'italic' }]}>
              {prefixText}
            </Text>
          )}
          <CodoText text={result.help} />
          {!!postfixText && (
            <Text style={[styles.answerText, { color: accent, marginTop: Spacing.sm, fontStyle: 'italic' }]}>
              {postfixText}
            </Text>
          )}
          <CodoSources source={result.source} sources={result.sources} onOpenPdf={onOpenPdf} />
        </View>
      )}

      {error && (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>⏳ {error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  answerText: { fontSize: Typography.base, lineHeight: 21, color: Colors.text },
  boldText: { fontWeight: FontWeight.bold, color: Colors.white },
  inlineCode: {
    fontFamily: 'monospace', color: '#c4b5fd',
    backgroundColor: 'rgba(108,71,255,0.15)',
  },
  codeBlock: {
    backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, padding: Spacing.md, marginVertical: Spacing.sm,
  },
  codeText: { fontFamily: 'monospace', color: Colors.purple, fontSize: Typography.sm },

  // Sources
  sourcesWrap: {
    marginTop: Spacing.md, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  sourcesTitle: { fontSize: Typography.xs, fontWeight: FontWeight.bold, color: '#86efac', marginBottom: 6 },
  sourceRow: {
    marginVertical: 6, padding: Spacing.sm, borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  sourceLink: { color: '#60a5fa', fontSize: Typography.sm, fontWeight: FontWeight.semibold },
  sourceName: { color: '#cbd5e1', fontSize: Typography.sm, fontWeight: FontWeight.semibold },
  sourceSnippet: { marginTop: 6, fontSize: Typography.xs, color: '#94a3b8', lineHeight: 17 },
  sourceNote: {
    marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)', fontSize: Typography.xs, color: '#cbd5e1',
  },

  // Listen button
  listenBtn: {
    borderWidth: 1, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  listenText: { fontSize: Typography.xs, fontWeight: FontWeight.bold },

  // Codo answer card (mentor / chat)
  answerCard: {
    backgroundColor: 'rgba(96,165,250,0.08)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)',
    borderRadius: Radius.md, padding: Spacing.md,
  },
  answerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: { width: 26, height: 26, borderRadius: 13 },
  codoLabel: { fontSize: Typography.xs, fontWeight: FontWeight.extrabold, color: '#93c5fd' },

  // Codo help button (quiz/exercise)
  codoHelpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: 'rgba(96,165,250,0.12)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.35)',
    borderRadius: Radius.md, paddingVertical: 6, paddingHorizontal: 14,
  },
  codoHelpImg: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0b0e14' },
  codoHelpRow: { flexDirection: 'row', alignItems: 'center' },
  codoHelpText: { fontSize: Typography.sm, fontWeight: FontWeight.bold, color: '#93c5fd' },

  helpPanel: {
    marginTop: Spacing.md, padding: Spacing.md, borderWidth: 1, borderRadius: Radius.md,
  },
  helpHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  helpTitle: { fontSize: Typography.sm, fontWeight: FontWeight.extrabold },

  errorPanel: {
    marginTop: Spacing.md, padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  errorText: { color: Colors.warning, fontSize: Typography.sm },
});
