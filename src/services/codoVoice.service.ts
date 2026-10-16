/**
 * Codo Voice (TTS) — mobile port of the desktop `_codoSpeak` behaviour.
 *
 * Mirrors codingkidadesktop/src/renderer/app/lesson-tabs.js:
 *   - POST /api/tts { text } -> { success, audio: <base64 mp3> }
 *   - Plays the mp3 and caches the base64 per-text so replays are instant/free.
 *   - A single active player at a time (new speech / stop cancels the previous).
 *
 * React Native can't play a `data:` URL directly like the browser, so we write
 * the base64 mp3 to a temp file (expo-file-system) and play that file with
 * expo-audio. If expo-audio isn't installed yet (native module), we fail
 * gracefully — the text answer still shows; only the voice is unavailable.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { ttsApi } from '@/api';

// expo-audio is a NATIVE module. We require it lazily so the JS bundle still
// loads (and all text features work) even before the native rebuild that
// includes expo-audio. Once the dependency is installed + the app rebuilt,
// voice activates automatically with no further code change.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _audioMod: any = null;
let _audioTried = false;
function getAudioModule(): any {
  if (_audioTried) return _audioMod;
  _audioTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    _audioMod = require('expo-audio');
  } catch {
    _audioMod = null;
  }
  return _audioMod;
}

/** Is premium voice available on this build? (expo-audio present) */
export function isVoiceAvailable(): boolean {
  return !!getAudioModule();
}

// Per-text base64 cache (mirrors desktop _codoTtsCache) so replaying is free.
const _ttsCache: Record<string, string> = {};

// Full help-response cache in memory, keyed by kind|itemId|stage. Seeded by the
// background prefetch (on a wrong answer) so tapping Codo renders text + plays
// voice straight from memory with NO backend call. Mirrors desktop _lessonHelpCache.
export interface CachedHelp {
  help: string;
  source?: 'study_material' | 'teacher_note' | 'ai' | 'stored';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sources?: any[];
  audio?: string | null;
}
const _helpCache: Record<string, CachedHelp> = {};
function helpKey(kind: string, itemId: string, stage: string): string {
  return `${kind || ''}|${itemId || ''}|${stage || ''}`;
}
/** Store a full help response in memory (called by the prefetch). */
export function seedHelpCache(kind: string, itemId: string, stage: string, data: CachedHelp): void {
  if (!itemId || !data?.help) return;
  _helpCache[helpKey(kind, itemId, stage)] = data;
  if (data.audio) seedVoiceCache(data.help, data.audio);
}
/** Read a cached full help response (undefined if not prefetched). */
export function getHelpCache(kind: string, itemId: string, stage: string): CachedHelp | undefined {
  return _helpCache[helpKey(kind, itemId, stage)];
}
// The currently playing expo-audio player (so stop / new speech can cancel it).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _activePlayer: any = null;
let _playToken = 0; // bumps on every stop/new play to invalidate stale callbacks

/**
 * Convert help/answer text (which may contain markdown/code) into clean, natural
 * text for speech. Mirrors desktop `_plainForSpeech`.
 */
export function plainForSpeech(text: string): string {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' . Here is a code example on screen. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Emoticons (:) :-( ;)) — remove before symbol handling.
    .replace(/[:;]-?[)(DP]/g, ' ')
    .replace(/[_#>`]/g, '')
    // Strip emoji & pictographs so TTS never reads "star"/"rocket"/"चमकता सितारा".
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u2600-\u27BF\u2B00-\u2BFF\u2190-\u21FF\uFE0F\u200D\u20E3]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, '')
    // Function calls like printf(), main() → "printf function" and drop the ().
    .replace(/([A-Za-z_]\w*)\s*\(\s*\)/g, '$1 function')
    // MATH operators → words, but ONLY between numbers so "ready-made" and
    // "built-in" are NOT read as "ready minus made".
    .replace(/(\d)\s*-\s*(\d)/g, '$1 minus $2')
    .replace(/(\w)-(\w)/g, '$1 $2')          // compound-word hyphen → space
    .replace(/(\d)\s*\+\s*(\d)/g, '$1 plus $2')
    .replace(/\+/g, ' plus ')
    .replace(/(\d)\s*\*\s*(\d)/g, '$1 times $2')
    .replace(/÷/g, ' divided by ')
    .replace(/=/g, ' equals ')
    .replace(/%/g, ' percent ')
    .replace(/&&/g, ' and ')
    .replace(/\|\|/g, ' or ')
    .replace(/&/g, ' and ')
    .replace(/</g, ' less than ')
    .replace(/>/g, ' greater than ')
    // Remove only the noisy brackets/slashes TTS would read as "open bracket"
    // etc. (operators above are already converted to words). Keep . , ? !
    .replace(/[()[\]{}|/\\~^*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stop any currently playing Codo audio. */
export function stopCodoVoice(): void {
  _playToken++;
  const p = _activePlayer;
  _activePlayer = null;
  if (p) {
    try { p.pause?.(); } catch {}
    try { p.remove?.(); } catch {}
  }
}

/** Seed the per-text cache (e.g. when the server pre-computed the audio). */
export function seedVoiceCache(text: string, base64Audio: string): void {
  const key = plainForSpeech(text);
  if (key && base64Audio) _ttsCache[key] = base64Audio;
}

// ── Fixed Codo scripts (prefix / postfix) ────────────────────────────────────
// Fetched once per session. Shape: { key: { text, audio } }.
interface CodoScript { text: string; audio?: string | null }
let _codoScripts: Record<string, CodoScript> = {};
let _codoScriptsFetched = false;

/**
 * Load fixed Codo scripts (prefix/postfix/etc.) once. The server lazily
 * synthesizes audio on first access + stores it, so this returns pre-computed
 * audio which we seed into the TTS cache for instant playback.
 */
export async function loadCodoScripts(): Promise<void> {
  if (_codoScriptsFetched) return;
  _codoScriptsFetched = true;
  try {
    const { codoScriptsApi } = await import('@/api');
    const data = await codoScriptsApi.get();
    if (data?.success && data.scripts) {
      // Backward-compatible shape: scripts = { key: text }, scriptsAudio = { key: audio }.
      const textMap = data.scripts as Record<string, string>;
      const audioMap = (data.scriptsAudio || {}) as Record<string, string | null>;
      _codoScripts = {};
      for (const k of Object.keys(textMap)) {
        const text = textMap[k];
        const audio = audioMap[k] ?? null;
        _codoScripts[k] = { text, audio };
        if (text && audio) seedVoiceCache(text, audio);
      }
    }
  } catch {
    // best-effort
  }
}

/** Get a fixed Codo script's text by key (supports string or {text} shape). */
export function codoScriptText(key: string, fallback = ''): string {
  const s = _codoScripts[key];
  if (!s) return fallback;
  if (typeof s === 'string') return s;
  return s.text || fallback;
}

/**
 * Speak the fixed solution PREFIX, then the solution text, then the POSTFIX —
 * in sequence. Prefix/postfix come from loadCodoScripts (audio cached). Used by
 * the Codo help flow so every solution is wrapped with the same intro/outro.
 */
export async function speakCodoSolution(
  solutionText: string,
  onStateChange?: (playing: boolean) => void
): Promise<void> {
  const prefix = codoScriptText('codo_solution_prefix', '');
  const postfix = codoScriptText('codo_solution_postfix', '');
  // Capture the current token; if stopCodoVoice() is called (e.g. question
  // change), _playToken bumps and we abort the remaining parts of the chain.
  const myToken = _playToken;
  onStateChange?.(true);
  try {
    if (prefix) await speakCodoAwait(prefix);
    if (myToken !== _playToken) return;
    await speakCodoAwait(solutionText);
    if (myToken !== _playToken) return;
    if (postfix) await speakCodoAwait(postfix);
  } finally {
    onStateChange?.(false);
  }
}

/** Promise that resolves when a single speakCodo playback finishes. */
function speakCodoAwait(text: string): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    speakCodo(text, (playing) => { if (!playing) done(); }).then((started) => {
      if (!started) done(); // nothing played — move on
    });
    // Safety timeout so the chain never hangs.
    setTimeout(done, 30000);
  });
}

/** True while Codo audio is actively playing. */
export function isSpeaking(): boolean {
  return !!_activePlayer;
}

/**
 * Speak `text` with Codo's premium voice. Fetches/caches the mp3, writes it to a
 * temp file, and plays it. Returns true if playback started, false otherwise
 * (no voice module, TTS unavailable, or error) — callers can ignore the result;
 * the text answer is always shown regardless.
 *
 * onStateChange(playing) lets a Listen button toggle its label.
 */
export async function speakCodo(
  rawText: string,
  onStateChange?: (playing: boolean) => void
): Promise<boolean> {
  const text = plainForSpeech(rawText);
  if (!text) return false;

  const Audio = getAudioModule();
  if (!Audio) return false; // expo-audio not in this build yet

  // Never overlap: stop whatever is playing first.
  stopCodoVoice();
  const myToken = _playToken;

  try {
    // 1) Get base64 mp3 (cache first, else POST /api/tts).
    let b64 = _ttsCache[text];
    if (!b64) {
      const res = await ttsApi.synthesize(text);
      if (res?.success && res.audio) {
        b64 = res.audio;
        _ttsCache[text] = b64;
      }
    }
    if (!b64) return false; // TTS unavailable — silent, text still shown
    if (myToken !== _playToken) return false; // superseded while awaiting

    // 2) Write the base64 to a temp mp3 file (RN can't play a data: URL).
    const path = `${FileSystem.cacheDirectory}codo-tts-${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(path, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (myToken !== _playToken) return false;

    // 3) Play with expo-audio. API: createAudioPlayer(source) -> player.
    const player = Audio.createAudioPlayer({ uri: path });
    _activePlayer = player;
    onStateChange?.(true);

    // When playback finishes, reset state + button.
    const sub = player.addListener?.('playbackStatusUpdate', (status: { didJustFinish?: boolean }) => {
      if (status?.didJustFinish) {
        if (_activePlayer === player) _activePlayer = null;
        try { sub?.remove?.(); } catch {}
        try { player.remove?.(); } catch {}
        onStateChange?.(false);
      }
    });

    player.play?.();
    return true;
  } catch {
    if (_activePlayer) { try { _activePlayer.remove?.(); } catch {} }
    _activePlayer = null;
    onStateChange?.(false);
    return false;
  }
}

/**
 * Toggle: if Codo is speaking, stop; otherwise speak `text`.
 * Mirrors desktop `toggleCodoSpeak`.
 */
export async function toggleCodoVoice(
  rawText: string,
  onStateChange?: (playing: boolean) => void
): Promise<void> {
  if (isSpeaking()) {
    stopCodoVoice();
    onStateChange?.(false);
    return;
  }
  await speakCodo(rawText, onStateChange);
}
