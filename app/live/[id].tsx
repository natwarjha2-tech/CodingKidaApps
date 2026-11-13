/**
 * Live Room (STUDENT) — mobile port of desktop live-room.js + live-room-chat.js
 * + live-room-participants.js, built on the vendored AWS Chime native module
 * (modules/expo-aws-chime). Students join, see/hear the teacher + peers, toggle
 * their OWN mic + camera, chat, react, and are subject to host moderation.
 *
 * REAL-TIME model (same as desktop):
 *  - A/V, presence (join/leave), mute state and video tiles come from native
 *    Chime events.
 *  - Chat, class reactions, per-message reactions, host moderation, removal and
 *    the recording indicator ride on Chime DATA MESSAGES using the SAME topics
 *    and JSON payloads as desktop, so desktop <-> mobile interoperate live.
 *  - REST stays the source of truth / backfill: chat is persisted via REST and
 *    polled slowly as a safety net; moderation flags + removal are also checked
 *    against GET /participants; class end is also confirmed via GET /classes/:id.
 *
 * Host-only features (start/end, recording control, screen-share, moderation
 * CONTROLS) are intentionally absent — mobile is student-only.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, BackHandler,
  ScrollView, TextInput, Platform, Image, Linking, AppState, Animated,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KeyboardAvoidingView as KCKeyboardAvoidingView,
  useKeyboardController,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import {
  startMeeting, stopMeeting, mute, unmute, startLocalVideo, stopLocalVideo,
  setVideoBackground, listAudioDevices, chooseAudioDevice,
  sendDataMessage, addListener, ExpoAWSChimeView,
  type VideoTileEvent, type AudioDevice,
} from '../../modules/expo-aws-chime';
import {
  liveApi, type LiveJoinData, type LiveParticipant, type LiveRoomChatMessage,
} from '@/api';
import { useAuthStore } from '@/store';
import { Colors } from '@/theme';
import { markLiveJoined, markLiveLeft } from '@/utils/liveJoined';
import { LiveIcon, type LiveIconName } from '@/components/live/LiveIcons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';

// ── Protocol (must match desktop) ────────────────────────────────────────────
const TOPIC_CHAT = 'ck-live-chat';
const TOPIC_REACT = 'ck-live-react';
const TOPIC_MSG_REACT = 'ck-live-msg-react';
const TOPIC_MOD = 'ck-live-mod';
const TOPIC_REC = 'ck-live-rec';

// Classroom reaction set (mirrors desktop LRC_REACTIONS).
const REACTIONS = ['👍', '👎', '✋', '👏', '🎉', '❤️'];

// Chime MeetingSessionStatusCode values that mean "the meeting is over for everyone".
const STATUS_CALL_ENDED = 6;
const STATUS_SERVER_HUNGUP = 16;

// After a connection drop, give Chime's auto-reconnect this long before we show
// the "Connection lost" screen (mirrors desktop _LR_FAIL_GRACE_MS).
const FAIL_GRACE_MS = 20000;

type RoomState =
  | 'joining' | 'connecting' | 'connected'
  | 'error' | 'left' | 'ended' | 'failed' | 'removed';
type ConnBanner = 'connected' | 'reconnecting' | 'poor' | 'dropped';
type ReactionAgg = Record<string, { counts: Record<string, number>; mine: Record<string, boolean> }>;

// Request mic + camera at runtime (Android). Audio is required to join; camera is
// requested lazily when the student turns it on, but asked up front so the first
// toggle is instant. iOS prompts natively on first use.
async function requestMediaPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const perms = [
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.CAMERA,
    ];
    // Android 12+: needed to route class audio to a Bluetooth headset (optional).
    if (Number(Platform.Version) >= 31 && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
      perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    }
    // Android 13+: lets the "Live class in progress" notification show while the
    // app is in the background (optional — the class keeps running either way).
    if (Number(Platform.Version) >= 33 && PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
      perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    const res = await PermissionsAndroid.requestMultiple(perms);
    return res[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const p = PermissionsAndroid.PERMISSIONS.CAMERA;
    if (await PermissionsAndroid.check(p)) return true;
    return (await PermissionsAndroid.request(p)) === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// Strip Chime's screen-share "#content" suffix so a share pseudo-attendee is
// never counted as a person (mirrors desktop _lrBaseUser).
function baseUserId(externalUserId: string | undefined): string {
  if (!externalUserId) return '';
  const i = externalUserId.indexOf('#content');
  return i === -1 ? externalUserId : externalUserId.slice(0, i);
}
function isContent(id: string | undefined): boolean {
  return !!id && id.indexOf('#content') !== -1;
}

// Real people from a Chime join/leave batch. A screen-share pseudo-attendee is
// marked with "#content" on its ATTENDEE id (its external user id can be the
// presenter's own id), so check both — otherwise "host stopped sharing" looks
// like "host left" and the participant count drops.
function personUserIds(attendeeIds: string[], externalUserIds: string[]): string[] {
  const out: string[] = [];
  externalUserIds.forEach((eid, i) => {
    if (isContent(eid) || isContent(attendeeIds[i])) return;
    const u = baseUserId(eid);
    if (u) out.push(u);
  });
  return out;
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Apply one reaction toggle to the aggregate (pure).
function applyReactionDelta(
  prev: ReactionAgg, messageId: string, emoji: string, reacted: boolean, byMe: boolean
): ReactionAgg {
  const cur = prev[messageId] || { counts: {}, mine: {} };
  const counts = { ...cur.counts };
  const mine = { ...cur.mine };
  if (reacted) {
    counts[emoji] = (counts[emoji] || 0) + 1;
    if (byMe) mine[emoji] = true;
  } else {
    counts[emoji] = Math.max(0, (counts[emoji] || 0) - 1);
    if (counts[emoji] === 0) delete counts[emoji];
    if (byMe) delete mine[emoji];
  }
  return { ...prev, [messageId]: { counts, mine } };
}

function seedReactions(m: LiveRoomChatMessage): ReactionAgg[string] | null {
  if (!m.reactions) return null;
  const counts: Record<string, number> = {};
  Object.keys(m.reactions.counts || {}).forEach((e) => {
    const n = m.reactions!.counts[e] | 0;
    if (n > 0) counts[e] = n;
  });
  const mine: Record<string, boolean> = {};
  (m.reactions.mine || []).forEach((e) => { mine[e] = true; });
  return { counts, mine };
}

// Virtual backgrounds (same 7 images as the desktop app). Thumbnails live in
// app assets; the full images are bundled natively in the Chime module.
const BACKGROUNDS: { sel: string; thumb: number | null; label: string }[] = [
  { sel: '', thumb: null, label: 'None' },
  { sel: '1', thumb: require('../../assets/live-bg/bg-1.jpg'), label: '1' },
  { sel: '2', thumb: require('../../assets/live-bg/bg-2.jpg'), label: '2' },
  { sel: '3', thumb: require('../../assets/live-bg/bg-3.jpg'), label: '3' },
  { sel: '4', thumb: require('../../assets/live-bg/bg-4.jpg'), label: '4' },
  { sel: '5', thumb: require('../../assets/live-bg/bg-5.jpg'), label: '5' },
  { sel: '6', thumb: require('../../assets/live-bg/bg-6.jpg'), label: '6' },
  { sel: '7', thumb: require('../../assets/live-bg/bg-7.jpg'), label: '7' },
];
const BG_PREF_KEY = 'ck_live_bg'; // same key name as desktop

// WhatsApp-style emoji bar that pops in above a long-pressed message.
function ReactionPicker({
  mine, alignRight, onPick,
}: { mine: Record<string, boolean>; alignRight: boolean; onPick: (emoji: string) => void }) {
  const s = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(s, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }).start();
  }, [s]);
  return (
    <Animated.View
      style={[
        styles.picker,
        { alignSelf: alignRight ? 'flex-end' : 'flex-start' },
        { opacity: s, transform: [{ scale: s.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
      ]}
    >
      {REACTIONS.map((e) => (
        <TouchableOpacity
          key={e}
          onPress={() => onPick(e)}
          style={[styles.pickerBtn, mine[e] && styles.pickerBtnMine]}
          activeOpacity={0.6}
        >
          <Text style={styles.pickerEmoji}>{e}</Text>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}

function formatClock(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function audioDeviceIcon(t: AudioDevice['type']): string {
  switch (t) {
    case 'bluetooth': return '🎧';
    case 'wired': case 'usb': return '🎧';
    case 'speaker': return '🔊';
    case 'earpiece': return '📱';
    default: return '🔈';
  }
}
function audioDeviceName(d: AudioDevice): string {
  switch (d.type) {
    case 'bluetooth': return `Bluetooth${d.label ? ` (${d.label})` : ''}`;
    case 'wired': return 'Wired headset';
    case 'usb': return 'USB headset';
    case 'speaker': return 'Speaker';
    case 'earpiece': return 'Phone (earpiece)';
    default: return d.label || 'Audio device';
  }
}

export default function LiveRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classId = String(id || '');
  const myUserId = useAuthStore((s) => s.user?.id) || '';

  const insets = useSafeAreaInsets();

  // Enable precise keyboard tracking only while the live room is open (the rest
  // of the app keeps its existing keyboard behaviour).
  const { setEnabled: setKeyboardControllerEnabled } = useKeyboardController();
  useEffect(() => {
    setKeyboardControllerEnabled(true);
    return () => setKeyboardControllerEnabled(false);
  }, [setKeyboardControllerEnabled]);
  const kbOpen = useKeyboardState((s) => s.isVisible);

  const [state, setState] = useState<RoomState>('joining');
  const [joinData, setJoinData] = useState<LiveJoinData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [needsSettings, setNeedsSettings] = useState(false);
  const [conn, setConn] = useState<ConnBanner>('connected');
  const [rejoinSent, setRejoinSent] = useState(false);
  const [rejoinBusy, setRejoinBusy] = useState(false);

  // A/V state — students JOIN MUTED (desktop parity).
  const [micMuted, setMicMuted] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [videoTiles, setVideoTiles] = useState<VideoTileEvent[]>([]);
  const [attMap, setAttMap] = useState<Record<string, string>>({}); // attendeeId -> externalUserId
  const [mutedUsers, setMutedUsers] = useState<Record<string, boolean>>({});

  // Audio output (speaker / headset / Bluetooth) + virtual background.
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [showAudio, setShowAudio] = useState(false);
  const [bgSel, setBgSel] = useState('');
  const [showBg, setShowBg] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);
  // Camera was on when the app went to the background (Android blocks camera
  // capture for background apps) → turn it back on when the student returns.
  const camWasOnRef = useRef(false);

  // Host-moderation (enforced on THIS student).
  const [micLocked, setMicLocked] = useState(false);
  const [camLocked, setCamLocked] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);

  // Roster / presence
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const [roster, setRoster] = useState<Record<string, LiveParticipant>>({});
  const [toasts, setToasts] = useState<{ key: string; text: string }[]>([]);
  const [showPeople, setShowPeople] = useState(false);
  const [recording, setRecording] = useState(false);

  // Screen-share layout: the shared screen gets the whole stage; people appear
  // as a small scrollable strip floating at the bottom (toggleable), and the
  // reaction bar + dock can be hidden too ("focus"). Only applies while a
  // screen is being shared.
  const [showStrip, setShowStrip] = useState(true);
  // Shared-screen stream size per tile + the space available for it. The Chime
  // renderer crops video to its view's shape, so the view is sized to the
  // stream's aspect ratio and centered (letterboxed) to show the WHOLE screen.
  const [tileSizes, setTileSizes] = useState<Record<number, { w: number; h: number }>>({});
  const [shareArea, setShareArea] = useState<{ w: number; h: number } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showReactBar, setShowReactBar] = useState(false);
  const [fullShare, setFullShare] = useState(false);
  const fullShareRef = useRef(false);
  const exitFullShareRef = useRef<() => void>(() => {});

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<LiveRoomChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [reactions, setReactions] = useState<ReactionAgg>({});
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [floatReactions, setFloatReactions] = useState<{ key: string; emoji: string; dx: number }[]>([]);

  // Timer
  const [elapsed, setElapsed] = useState('00:00');

  // ── Refs (read inside long-lived listeners without re-subscribing) ─────────
  const stateRef = useRef<RoomState>('joining');
  const leavingRef = useRef(false);
  const cleanedRef = useRef(false);
  const unmountedRef = useRef(false);
  const connectIdRef = useRef(0);
  const chatCursorRef = useRef<string | undefined>(undefined);
  const chatSeenRef = useRef<Set<string>>(new Set());
  const chatScrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number>(0);
  const attMapRef = useRef<Record<string, string>>({});
  const rosterRef = useRef<Record<string, LiveParticipant>>({});
  const leftSetRef = useRef<Set<string>>(new Set());
  const reactionsRef = useRef<ReactionAgg>({});
  const camOnRef = useRef(false);
  const micLockedRef = useRef(false);
  const camLockedRef = useRef(false);
  const chatLockedRef = useRef(false);
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenMeRef = useRef(false);
  const missRef = useRef(0);
  const hostUserIdRef = useRef('');
  const dmSeenRef = useRef(false); // has a native data message ever arrived?

  const hostUserId = joinData?.liveClass?.hostUserId || '';
  hostUserIdRef.current = hostUserId;
  reactionsRef.current = reactions;
  rosterRef.current = roster;
  camOnRef.current = camOn;

  const setRoomState = useCallback((s: RoomState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const addToast = useCallback((text: string) => {
    const key = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { key, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.key !== key)), 3200);
  }, []);

  const updateAttMap = useCallback((attendeeIds: string[], externalUserIds: string[]) => {
    const next = { ...attMapRef.current };
    attendeeIds.forEach((a, i) => { if (a && externalUserIds[i]) next[a] = externalUserIds[i]; });
    attMapRef.current = next;
    setAttMap(next);
  }, []);

  const userIdForAttendee = useCallback((attendeeId: string): string => {
    return baseUserId(attMapRef.current[attendeeId]);
  }, []);

  // ── Teardown: stop Chime + tell backend (exactly once per session) ─────────
  const teardown = useCallback(async () => {
    if (cleanedRef.current) return;
    cleanedRef.current = true;
    if (failTimerRef.current) { clearTimeout(failTimerRef.current); failTimerRef.current = null; }
    try { await stopMeeting(); } catch { /* ignore */ }
    try { if (classId) await liveApi.leave(classId); } catch { /* best-effort */ }
    markLiveLeft(classId);
  }, [classId]);

  const leave = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setRoomState('left');
    await teardown();
    router.back();
  }, [teardown, setRoomState]);

  // ── Terminal states ────────────────────────────────────────────────────────
  const goEnded = useCallback(() => {
    if (leavingRef.current || ['ended', 'removed', 'left'].includes(stateRef.current)) return;
    setRoomState('ended');
    teardown();
  }, [teardown, setRoomState]);

  const goFailed = useCallback(() => {
    if (leavingRef.current || ['ended', 'removed', 'left', 'failed'].includes(stateRef.current)) return;
    setRoomState('failed');
    teardown();
  }, [teardown, setRoomState]);

  const goRemoved = useCallback(() => {
    if (leavingRef.current || ['ended', 'removed', 'left'].includes(stateRef.current)) return;
    setRoomState('removed');
    teardown();
  }, [teardown, setRoomState]);

  // Is the class over on the server? (confirms an ambiguous drop / removal.)
  const classIsOver = useCallback(async (): Promise<boolean> => {
    try {
      const res = await liveApi.getById(classId);
      const lc = res?.liveClass ?? res;
      return lc?.status === 'ended' || lc?.status === 'cancelled';
    } catch {
      return false;
    }
  }, [classId]);

  // ── Moderation (instant via data message; also reconciled from the poll) ───
  const applyModerationToSelf = useCallback((type: string, blocked: boolean) => {
    if (type === 'audio') {
      micLockedRef.current = blocked;
      setMicLocked(blocked);
      if (blocked) { mute().catch(() => {}); setMicMuted(true); }
      addToast(blocked ? 'Host muted your mic' : 'Host unmuted your mic');
    } else if (type === 'video') {
      camLockedRef.current = blocked;
      setCamLocked(blocked);
      if (blocked && camOnRef.current) {
        stopLocalVideo().catch(() => {});
        camOnRef.current = false;
        setCamOn(false);
      }
      addToast(blocked ? 'Host turned off your camera' : 'Host allowed your camera');
    } else if (type === 'chat') {
      chatLockedRef.current = blocked;
      setChatLocked(blocked);
      addToast(blocked ? 'Host turned off your chat' : 'Host turned on your chat');
    }
  }, [addToast]);

  // ── Chat helpers ───────────────────────────────────────────────────────────
  const appendMessages = useCallback((incoming: LiveRoomChatMessage[], fromPoll = false) => {
    if (fromPoll && incoming.length > 0) {
      const last = incoming[incoming.length - 1];
      if (last?.createdAt) chatCursorRef.current = last.createdAt;
    }
    const fresh = incoming.filter((m) => m?.id && !chatSeenRef.current.has(m.id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => chatSeenRef.current.add(m.id));
    setMessages((prev) => [...prev, ...fresh]);
    const seeds: ReactionAgg = {};
    fresh.forEach((m) => { const s = seedReactions(m); if (s) seeds[m.id] = s; });
    if (Object.keys(seeds).length) setReactions((prev) => ({ ...seeds, ...prev }));
  }, []);

  const floatReaction = useCallback((emoji: string) => {
    const key = `${Date.now()}-${Math.random()}`;
    const dx = Math.floor(Math.random() * 120) - 60;
    setFloatReactions((prev) => [...prev, { key, emoji, dx }]);
    setTimeout(() => setFloatReactions((prev) => prev.filter((r) => r.key !== key)), 2100);
  }, []);

  // ── Join + connect (also used by "Rejoin") ─────────────────────────────────
  const connect = useCallback(async () => {
    if (!classId) { setRoomState('error'); setErrorMsg('Missing class id.'); return; }
    const myConnectId = ++connectIdRef.current;
    const stale = () => unmountedRef.current || connectIdRef.current !== myConnectId;

    // Fresh session state.
    cleanedRef.current = false;
    leavingRef.current = false;
    seenMeRef.current = false;
    missRef.current = 0;
    leftSetRef.current = new Set();
    attMapRef.current = {};
    chatSeenRef.current = new Set();
    chatCursorRef.current = undefined;
    micLockedRef.current = false; camLockedRef.current = false; chatLockedRef.current = false;
    camWasOnRef.current = false;
    camOnRef.current = false;
    setAttMap({}); setVideoTiles([]); setMessages([]); setReactions({}); setMutedUsers({});
    setMicMuted(true); setCamOn(false);
    setMicLocked(false); setCamLocked(false); setChatLocked(false);
    setPresentIds([]); setRecording(false); setConn('connected');
    setErrorMsg(''); setNeedsSettings(false); setRejoinSent(false);
    setRoomState('joining');

    try {
      const data = await liveApi.join(classId, 'STUDENT_MOBILE');
      if (stale()) {
        // Navigated away mid-join: undo the attendance row we just created.
        if (data?.success) liveApi.leave(classId).catch(() => {});
        return;
      }
      if (!data?.success || !data.meeting || !data.attendee) {
        setRoomState('error');
        setErrorMsg(data?.message || 'Could not join the class.');
        return;
      }
      setJoinData(data);
      const startedMs = data.liveClass?.startedAt ? Date.parse(data.liveClass.startedAt) : NaN;
      startedAtRef.current = isNaN(startedMs) ? Date.now() : startedMs;
      markLiveJoined(classId);
      setRoomState('connecting');

      const granted = await requestMediaPermissions();
      if (stale()) { liveApi.leave(classId).catch(() => {}); return; }
      if (!granted) {
        liveApi.leave(classId).catch(() => {});
        setRoomState('error');
        setNeedsSettings(true);
        setErrorMsg('Microphone permission is required to join a live class. Please allow it in Settings.');
        return;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await startMeeting(data.meeting as any, data.attendee as any, data.liveClass?.title || 'Live class');
      } catch (e) {
        if (stale()) return;
        liveApi.leave(classId).catch(() => {});
        setRoomState('error');
        const raw = (e as Error)?.message || '';
        // The Chime SDK ships only non-functional x86 stubs: x86/x86_64 emulators
        // (and rare x86 devices) can't run live classes. Show a clear message.
        if (/UnsatisfiedLinkError|initNative|No implementation found/i.test(raw)) {
          setErrorMsg(
            'Live classes are not supported on this device. Please use a real Android phone ' +
            '(Android emulators on PC are not supported for live audio/video).'
          );
        } else {
          setErrorMsg(raw || 'Could not connect to the class.');
        }
      }
    } catch (e) {
      if (stale()) return;
      const msg = (e as Error)?.message || 'Could not join the class.';
      // Host previously removed this student: offer "ask to rejoin" (desktop parity).
      if (/removed you/i.test(msg)) { setRoomState('removed'); return; }
      setRoomState('error');
      setErrorMsg(msg);
    }
  }, [classId, setRoomState]);

  // ── Native Chime event listeners (subscribed once; handlers read refs) ─────
  useEffect(() => {
    const clearFailTimer = () => {
      if (failTimerRef.current) { clearTimeout(failTimerRef.current); failTimerRef.current = null; }
    };
    const armFailTimer = () => {
      if (failTimerRef.current) return;
      failTimerRef.current = setTimeout(() => {
        failTimerRef.current = null;
        goFailed();
      }, FAIL_GRACE_MS);
    };

    const subs = [
      addListener('onMeetingStart', () => {
        if (stateRef.current !== 'connecting') return;
        clearFailTimer();
        setConn('connected');
        setRoomState('connected');
        // Join MUTED by default (desktop parity): actually mute the mic, not just the icon.
        mute().catch(() => {});
        setMicMuted(true);
      }),
      addListener('onConnectionState', (p) => {
        if (['ended', 'removed', 'left', 'failed'].includes(stateRef.current)) return;
        setConn(p.state);
        if (p.state === 'connected') clearFailTimer();
        else if (p.state === 'reconnecting' || p.state === 'dropped') armFailTimer();
      }),
      addListener('onMeetingEnd', async (p) => {
        if (leavingRef.current || ['ended', 'removed', 'left', 'failed'].includes(stateRef.current)) return;
        const code = p.sessionStatus;
        if (code === STATUS_CALL_ENDED || code === STATUS_SERVER_HUNGUP) { goEnded(); return; }
        // Ambiguous stop: ask the server whether the class is over.
        if (await classIsOver()) goEnded(); else goFailed();
      }),
      addListener('onAttendeesJoin', (p) => {
        updateAttMap(p.attendeeIds || [], p.externalUserIds || []);
        const ids = personUserIds(p.attendeeIds || [], p.externalUserIds || []);
        if (ids.length === 0) return;
        ids.forEach((u) => leftSetRef.current.delete(u));
        setPresentIds((prev) => [...new Set([...prev, ...ids])]);
        ids.forEach((uid) => {
          if (uid !== myUserId) addToast(`${rosterRef.current[uid]?.name || 'A participant'} joined`);
        });
      }),
      addListener('onAttendeesLeave', (p) => {
        // A screen share ending = the "#content" attendee leaving. That is NOT
        // the host leaving the class, so it must not change presence/count.
        const ids = personUserIds(p.attendeeIds || [], p.externalUserIds || []);
        if (ids.length === 0) return;
        ids.forEach((u) => leftSetRef.current.add(u));
        setPresentIds((prev) => prev.filter((x) => !ids.includes(x)));
        ids.forEach((uid) => {
          if (uid !== myUserId) addToast(`${rosterRef.current[uid]?.name || 'A participant'} left`);
        });
      }),
      addListener('onAttendeesMute', (p) => {
        setMutedUsers((prev) => {
          const next = { ...prev };
          (p.attendeeIds || []).forEach((a) => { const u = userIdForAttendee(a); if (u) next[u] = true; });
          return next;
        });
      }),
      addListener('onAttendeesUnmute', (p) => {
        setMutedUsers((prev) => {
          const next = { ...prev };
          (p.attendeeIds || []).forEach((a) => { const u = userIdForAttendee(a); if (u) next[u] = false; });
          return next;
        });
      }),
      addListener('onAddVideoTile', (tile) => {
        setVideoTiles((prev) => (prev.some((t) => t.tileId === tile.tileId) ? prev : [...prev, tile]));
        const w = tile.videoStreamContentWidth || 0;
        const h = tile.videoStreamContentHeight || 0;
        if (w > 0 && h > 0) setTileSizes((prev) => ({ ...prev, [tile.tileId]: { w, h } }));
      }),
      addListener('onVideoTileSizeChanged', (s) => {
        const w = s.videoStreamContentWidth || 0;
        const h = s.videoStreamContentHeight || 0;
        if (w > 0 && h > 0) setTileSizes((prev) => ({ ...prev, [s.tileId]: { w, h } }));
      }),
      addListener('onRemoveVideoTile', (tile) => {
        setVideoTiles((prev) => prev.filter((t) => t.tileId !== tile.tileId));
      }),
      addListener('onDataMessage', (m) => {
        let p: any; // eslint-disable-line @typescript-eslint/no-explicit-any
        dmSeenRef.current = true;
        try { p = JSON.parse(m.text); } catch { return; }
        if (!p) return;
        switch (m.topic) {
          case TOPIC_CHAT:
            if (p.id) appendMessages([p as LiveRoomChatMessage]);
            break;
          case TOPIC_REACT:
            if (p.reaction) floatReaction(String(p.reaction));
            break;
          case TOPIC_MSG_REACT:
            if (p.messageId && p.reaction && p.userId && p.userId !== myUserId) {
              setReactions((prev) => applyReactionDelta(prev, p.messageId, p.reaction, !!p.reacted, false));
            }
            break;
          case TOPIC_REC:
            setRecording(!!p.recording);
            break;
          case TOPIC_MOD: {
            if (p.action === 'removed' && p.targetUserId) {
              leftSetRef.current.add(p.targetUserId);
              setPresentIds((prev) => prev.filter((x) => x !== p.targetUserId));
              if (p.targetUserId === myUserId) goRemoved();
              break;
            }
            if (!p.type) break;
            // The host never blocks themselves; only non-hosts enforce.
            if (hostUserIdRef.current && hostUserIdRef.current === myUserId) break;
            if (p.scope === 'all') applyModerationToSelf(p.type, !!p.blocked);
            else if (p.targetUserId === myUserId) applyModerationToSelf(p.type, !!p.blocked);
            break;
          }
        }
      }),
      // Headset / Bluetooth plugged in or removed (native auto-routes; we mirror it).
      addListener('onAudioDevicesChanged', (s) => {
        setAudioDevices(s.devices || []);
        setActiveAudioId(s.activeId ?? null);
      }),
      addListener('onError', (e) => {
        if (leavingRef.current || stateRef.current === 'left') return;
        setRoomState('error');
        setErrorMsg(e?.error || 'A live-class error occurred.');
      }),
    ];

    return () => {
      subs.forEach((s) => { try { s.remove(); } catch { /* ignore */ } });
      if (failTimerRef.current) { clearTimeout(failTimerRef.current); failTimerRef.current = null; }
    };
  }, [
    myUserId, addToast, appendMessages, applyModerationToSelf, classIsOver, floatReaction,
    goEnded, goFailed, goRemoved, setRoomState, updateAttMap, userIdForAttendee,
  ]);

  // ── Start joining on mount; always leave cleanly on unmount ────────────────
  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (!cleanedRef.current) {
        cleanedRef.current = true;
        stopMeeting().catch(() => {});
        if (classId) liveApi.leave(classId).catch(() => {});
        markLiveLeft(classId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // ── Elapsed timer (from class startedAt) ──────────────────────────────────
  useEffect(() => {
    if (state !== 'connected') return;
    const tick = () => setElapsed(formatElapsed(Date.now() - startedAtRef.current));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [state]);

  // ── Roster + moderation/removal reconcile (poll; data messages are the fast path)
  useEffect(() => {
    if (state !== 'connected' || !classId) return;
    let stop = false;

    const poll = async () => {
      const res = await liveApi.getParticipants(classId);
      if (stop || !res?.success) return;
      const map: Record<string, LiveParticipant> = {};
      for (const p of res.participants || []) if (p?.userId) map[p.userId] = p;
      setRoster(map);

      // Presence: server roster minus anyone Chime told us already left.
      const ids = Object.keys(map).filter((u) => !leftSetRef.current.has(u));
      if (myUserId && !ids.includes(myUserId)) ids.push(myUserId);
      setPresentIds((prev) => {
        const next = [...new Set([...ids, ...prev.filter((u) => !leftSetRef.current.has(u) && map[u])])];
        return next;
      });

      const me = map[myUserId];
      if (me) {
        seenMeRef.current = true;
        missRef.current = 0;
        if (!!me.audioBlocked !== micLockedRef.current) applyModerationToSelf('audio', !!me.audioBlocked);
        if (!!me.videoBlocked !== camLockedRef.current) applyModerationToSelf('video', !!me.videoBlocked);
        if (!!me.chatBlocked !== chatLockedRef.current) applyModerationToSelf('chat', !!me.chatBlocked);
      } else if (seenMeRef.current) {
        // Server no longer lists me: removed by host (or class ended). Require 2 misses.
        missRef.current += 1;
        if (missRef.current >= 2) {
          if (await classIsOver()) goEnded(); else goRemoved();
        }
      }
    };

    poll();
    const iv = setInterval(poll, 5000);
    return () => { stop = true; clearInterval(iv); };
  }, [state, classId, myUserId, applyModerationToSelf, classIsOver, goEnded, goRemoved]);

  // ── Class-ended watcher (fallback if Chime doesn't signal the end) ─────────
  useEffect(() => {
    if (state !== 'connected' || !classId) return;
    const iv = setInterval(async () => {
      if (await classIsOver()) goEnded();
    }, 15000);
    return () => clearInterval(iv);
  }, [state, classId, classIsOver, goEnded]);

  // ── Chat backfill poll (data messages are the real-time path) ──────────────
  useEffect(() => {
    if (state !== 'connected' || !classId) return;
    let stop = false;
    const poll = async () => {
      try {
        const res = await liveApi.getChat(classId, chatCursorRef.current);
        if (stop || !res?.success) return;
        appendMessages(res.messages || [], true);
      } catch { /* ignore */ }
    };
    poll(); // initial history
    // Poll every 3s until the native data-message channel proves it works (it
    // needs the rebuilt dev client); once data messages flow, back off to ~9s.
    let tick = 0;
    const iv = setInterval(() => {
      tick += 1;
      if (dmSeenRef.current && tick % 3 !== 0) return;
      poll();
    }, 3000);
    return () => { stop = true; clearInterval(iv); };
  }, [state, classId, appendMessages]);

  const sendChat = useCallback(async () => {
    const text = chatText.trim();
    if (!text || !classId) return;
    if (chatLocked) { addToast('Chat is turned off by the host'); return; }
    setChatText('');
    try {
      // 1) Persist via REST (authoritative: gives the stored message + id).
      const res = await liveApi.sendChat(classId, text);
      if (!res?.success || !res.message) throw new Error('Message not sent.');
      // 2) Show locally, 3) broadcast so everyone (desktop + mobile) sees it live.
      appendMessages([res.message]);
      sendDataMessage(TOPIC_CHAT, JSON.stringify(res.message));
    } catch (e) {
      setChatText(text); // restore so nothing is lost
      addToast((e as Error)?.message || 'Message not sent. Check your connection.');
    }
  }, [chatText, classId, chatLocked, appendMessages, addToast]);

  // ── Reactions ─────────────────────────────────────────────────────────────
  // Free-floating class reaction: local float + real-time broadcast (no REST,
  // the backend reaction endpoint is per-message only — same as desktop).
  const sendReaction = useCallback((emoji: string) => {
    floatReaction(emoji);
    sendDataMessage(TOPIC_REACT, JSON.stringify({ reaction: emoji }));
  }, [floatReaction]);

  // Per-message reaction toggle: optimistic -> broadcast -> persist -> reconcile/rollback.
  const toggleMsgReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!messageId || !emoji || !classId) return;
    setPickerFor(null);
    const currentlyMine = !!reactionsRef.current[messageId]?.mine?.[emoji];
    const next = !currentlyMine;
    const broadcast = (reacted: boolean) =>
      sendDataMessage(TOPIC_MSG_REACT, JSON.stringify({ messageId, reaction: emoji, reacted, userId: myUserId }));

    setReactions((prev) => applyReactionDelta(prev, messageId, emoji, next, true));
    broadcast(next);
    const res = await liveApi.react(classId, messageId, emoji);
    if (!res?.success) {
      setReactions((prev) => applyReactionDelta(prev, messageId, emoji, currentlyMine, true));
      broadcast(currentlyMine);
      return;
    }
    const serverReacted = (res as { reacted?: boolean }).reacted;
    if (typeof serverReacted === 'boolean' && serverReacted !== next) {
      setReactions((prev) => applyReactionDelta(prev, messageId, emoji, serverReacted, true));
      broadcast(serverReacted);
    }
  }, [classId, myUserId]);

  // ── Mic / camera toggles ──────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    if (micLocked && micMuted) {
      Alert.alert('Muted by host', 'You can speak once the host unmutes you.');
      return;
    }
    try {
      if (micMuted) { await unmute(); setMicMuted(false); }
      else { await mute(); setMicMuted(true); }
    } catch { /* ignore */ }
  }, [micLocked, micMuted]);

  const toggleCam = useCallback(async () => {
    if (camLocked && !camOn) {
      Alert.alert('Camera disabled', 'The host has turned off your camera for this class.');
      return;
    }
    try {
      if (camOn) { await stopLocalVideo(); setCamOn(false); return; }
      if (!(await ensureCameraPermission())) {
        Alert.alert('Camera permission needed', 'Allow camera access in Settings to turn your camera on.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const mode = await startLocalVideo();
      setCamOn(true);
      if (bgSel && mode === 'plain') {
        addToast('Background not supported on this device — using normal camera');
      }
    } catch {
      Alert.alert('Camera error', 'Could not toggle the camera.');
    }
  }, [camLocked, camOn, bgSel, addToast]);

  // ── Bottom panels: only one open at a time ────────────────────────────────
  const openPanel = useCallback((p: 'chat' | 'people' | 'audio' | 'bg' | null) => {
    setShowChat(p === 'chat');
    setShowPeople(p === 'people');
    setShowAudio(p === 'audio');
    setShowBg(p === 'bg');
  }, []);

  // ── Audio output (speaker / headset / Bluetooth) ──────────────────────────
  const refreshAudioDevices = useCallback(async () => {
    const s = await listAudioDevices();
    setAudioDevices(s.devices || []);
    setActiveAudioId(s.activeId ?? null);
  }, []);

  const pickAudioDevice = useCallback(async (d: AudioDevice) => {
    if (!d.id) return;
    setActiveAudioId(d.id); // optimistic
    await chooseAudioDevice(d.id);
    setShowAudio(false);
  }, []);

  const activeAudio = useMemo(
    () => audioDevices.find((d) => d.id != null && d.id === activeAudioId) || null,
    [audioDevices, activeAudioId]
  );

  // ── Virtual background ────────────────────────────────────────────────────
  // Restore the saved choice (same preference as desktop) once per room.
  useEffect(() => {
    AsyncStorage.getItem(BG_PREF_KEY)
      .then((v) => {
        const sel = v && BACKGROUNDS.some((b) => b.sel === v) ? v : '';
        setBgSel(sel);
        setVideoBackground(sel).catch(() => {});
      })
      .catch(() => {});
  }, []);

  const pickBackground = useCallback(async (sel: string) => {
    if (bgBusy) return;
    setBgBusy(true);
    setBgSel(sel);
    AsyncStorage.setItem(BG_PREF_KEY, sel).catch(() => {});
    try {
      const mode = await setVideoBackground(sel);
      if (sel && mode === 'plain') {
        addToast('Background not supported on this device — using normal camera');
      }
    } catch {
      addToast('Could not apply the background');
    } finally {
      setBgBusy(false);
    }
  }, [bgBusy, addToast]);

  // ── App to background / foreground ────────────────────────────────────────
  // The class keeps running in the background (native foreground service keeps
  // audio + connection alive). Android does not allow camera capture from the
  // background, so pause the camera and turn it back on when the student returns.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (stateRef.current !== 'connected') return;
      if (next === 'background') {
        if (camOnRef.current) {
          camWasOnRef.current = true;
          stopLocalVideo().catch(() => {});
          camOnRef.current = false;
          setCamOn(false);
        }
      } else if (next === 'active') {
        if (camWasOnRef.current) {
          camWasOnRef.current = false;
          if (!camLockedRef.current) {
            startLocalVideo()
              .then(() => { camOnRef.current = true; setCamOn(true); })
              .catch(() => {});
          }
        }
        refreshAudioDevices();
      }
    });
    return () => sub.remove();
  }, [refreshAudioDevices]);

  const askRejoin = useCallback(async () => {
    if (rejoinBusy || rejoinSent) return;
    setRejoinBusy(true);
    try {
      const res = await liveApi.rejoinRequest(classId);
      if (res?.success) setRejoinSent(true);
      else addToast(res?.message || 'Could not send the request.');
    } catch (e) {
      addToast((e as Error)?.message || 'Could not send the request.');
    } finally {
      setRejoinBusy(false);
    }
  }, [classId, rejoinBusy, rejoinSent, addToast]);

  // Hardware back = leave cleanly (or just go back from a terminal screen).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Back in full-screen share = just exit full screen (stay in class).
      if (fullShareRef.current) { exitFullShareRef.current(); return true; }
      if (['ended', 'failed', 'removed', 'error'].includes(stateRef.current)) {
        teardown().finally(() => router.back());
      } else {
        leave();
      }
      return true;
    });
    return () => sub.remove();
  }, [leave, teardown]);

  const title = joinData?.liveClass?.title || 'Live Class';
  const participantCount = presentIds.length;

  // Bottom-sheet placement that respects the device's safe area + keyboard.
  // (Absolute children ignore the SafeAreaView padding, so apply insets here.)
  //  - keyboard closed: sit on the bottom, padded above the system nav bar /
  //    gesture bar / iPhone home indicator.
  //  - keyboard open: sit directly above the keyboard and use the space up to
  //    the status bar, so the input is always visible on any screen size.
  //  The exact keyboard overlap is handled by react-native-keyboard-controller's
  //  KeyboardAvoidingView (measured per frame from the real keyboard position, so
  //  Samsung's nav bar / suggestion strip / floating keyboards are all covered).
  //  Here we only decide the panel's size: when the keyboard is open the panel
  //  spans from under the status bar to the screen bottom, and the avoiding view
  //  pads its bottom by exactly the keyboard's height.
  const panelPos = kbOpen
    ? { top: insets.top + 8, bottom: 0, height: undefined }
    : { bottom: 0 };
  // Inner bottom padding for the nav bar / home indicator (keyboard closed only —
  // when it is open the keyboard already covers that area).
  const panelInnerPad = { paddingBottom: kbOpen ? 6 : Math.max(insets.bottom, 8) };

  // Tiles: screen-share first, then remote (teacher first), local last.
  const sortedTiles = useMemo(() => {
    const copy = [...videoTiles];
    copy.sort((a, b) => {
      if (a.isScreenShare !== b.isScreenShare) return a.isScreenShare ? -1 : 1;
      if (a.isLocal !== b.isLocal) return a.isLocal ? 1 : -1;
      const ah = !a.isLocal && baseUserId(attMap[a.attendeeId]) === hostUserId ? 0 : 1;
      const bh = !b.isLocal && baseUserId(attMap[b.attendeeId]) === hostUserId ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return a.tileId - b.tileId;
    });
    return copy;
  }, [videoTiles, attMap, hostUserId]);

  const tileUserId = useCallback((t: VideoTileEvent): string => {
    if (t.isLocal) return myUserId;
    return baseUserId(attMap[t.attendeeId]);
  }, [attMap, myUserId]);

  const nameFor = useCallback((uid: string): string => {
    const base = roster[uid]?.name || '';
    if (uid === myUserId) return `${base || 'You'}${base ? ' (You)' : ''}`;
    if (uid === hostUserId) return `${base || 'Teacher'}${base ? ' · Teacher' : ''}`;
    return base || 'Participant';
  }, [roster, myUserId, hostUserId]);

  function tileLabel(t: VideoTileEvent): string {
    const uid = tileUserId(t);
    if (t.isScreenShare) return uid && roster[uid]?.name ? `${roster[uid].name}'s screen` : 'Screen share';
    return uid ? nameFor(uid) : (t.isLocal ? 'You' : 'Participant');
  }

  // Everyone present who has no camera tile gets an avatar tile (desktop parity).
  const avatarUsers = useMemo(() => {
    const withCam = new Set(
      sortedTiles.filter((t) => !t.isScreenShare).map((t) => tileUserId(t)).filter(Boolean)
    );
    return presentIds.filter((u) => !withCam.has(u));
  }, [presentIds, sortedTiles, tileUserId]);

  const isMutedUser = (uid: string) => (uid === myUserId ? micMuted : mutedUsers[uid] === true);

  // Screen share present? -> shared screen is the main view, people go in a strip.
  const shareTile = sortedTiles.find((t) => t.isScreenShare) || null;
  const camTiles = sortedTiles.filter((t) => !t.isScreenShare);
  // While a screen is shared the bottom dock + reaction bar are replaced by the
  // floating buttons so the shared screen gets the whole phone.
  const controlsHidden = !!shareTile;

  // Layout switch (share <-> grid) re-creates every camera view. Mount the new
  // ones only after the old ones are gone, otherwise the old view's unbind can
  // blank the new one (black tiles after the host stops presenting). Avatars
  // fill the ~0.4 s gap.
  const isShareMode = !!shareTile;
  const [readyMode, setReadyMode] = useState<boolean>(false);
  useEffect(() => {
    if (readyMode === isShareMode) return;
    const t = setTimeout(() => setReadyMode(isShareMode), 400);
    return () => clearTimeout(t);
  }, [isShareMode, readyMode]);
  const videosReady = readyMode === isShareMode;

  // Full-screen landscape view of the shared screen (Meet/Zoom style).
  const enterFullShare = useCallback(() => {
    setShowMenu(false); setShowReactBar(false); openPanel(null);
    setFullShare(true);
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  }, [openPanel]);
  const exitFullShare = useCallback(() => {
    setFullShare(false);
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);
  fullShareRef.current = fullShare;
  exitFullShareRef.current = exitFullShare;
  // Sharing stopped while full screen -> back to normal portrait room.
  useEffect(() => {
    if (fullShare && !shareTile) exitFullShare();
  }, [fullShare, shareTile, exitFullShare]);
  // Always restore portrait when leaving the room.
  useEffect(() => () => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  const renderTileHold = (t: VideoTileEvent, mini: boolean) => {
    const uid = tileUserId(t);
    const info = uid ? roster[uid] : undefined;
    const name = uid ? nameFor(uid) : '?';
    const st = mini ? styles.avatarMini : styles.avatarBig;
    return (
      <View style={[styles.tileVideo, styles.avatarTile]}>
        {info?.avatarUrl ? (
          <Image source={{ uri: info.avatarUrl }} style={st} />
        ) : (
          <View style={st}>
            <Text style={mini ? styles.avatarMiniTxt : styles.avatarBigTxt}>{(name[0] || '?').toUpperCase()}</Text>
          </View>
        )}
      </View>
    );
  };

  // Box for the shared screen: largest rectangle with the stream's aspect ratio
  // that fits the available area (16:9 until the real size is known — almost
  // every desktop screen share is 16:9 or close to it).
  const shareBox = useMemo(() => {
    if (!shareTile || !shareArea || shareArea.w <= 0 || shareArea.h <= 0) return null;
    const sz = tileSizes[shareTile.tileId];
    const ratio = sz ? sz.w / sz.h : 16 / 9;
    let w = shareArea.w;
    let h = w / ratio;
    if (h > shareArea.h) { h = shareArea.h; w = h * ratio; }
    return { width: Math.floor(w), height: Math.floor(h) };
  }, [shareTile, shareArea, tileSizes]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.stageEmoji}>⚠️</Text>
          <Text style={styles.statusText}>Couldn’t join</Text>
          <Text style={styles.subText}>{errorMsg}</Text>
          {needsSettings && (
            <TouchableOpacity style={styles.retryBtn} onPress={() => Linking.openSettings()} activeOpacity={0.8}>
              <Text style={styles.retryText}>Open Settings</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.retryBtn, styles.secondaryBtn]} onPress={connect} activeOpacity={0.8}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.retryBtn, styles.secondaryBtn]} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'joining' || state === 'connecting' || state === 'left') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.statusText}>
            {state === 'joining' ? 'Joining…' : state === 'connecting' ? 'Connecting…' : 'Leaving…'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Terminal result card (class ended / connection lost / removed).
  const overlay =
    state === 'ended' ? {
      icon: '✅', title: 'Class ended', msg: 'The teacher has ended this class.',
    } : state === 'failed' ? {
      icon: '📡', title: 'Connection lost', msg: "We couldn't stay connected to the class. You can try to rejoin.",
    } : state === 'removed' ? {
      icon: '🚫', title: 'Removed from class',
      msg: rejoinSent ? 'Request sent. The host can let you back in.' : 'The host has removed you from this class.',
    } : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={fullShare} style="light" />
      {/* Top bar: live dot + title + rec + timer + people + leave */}
      {!fullShare && (
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
          {recording && <View style={styles.recBadge}><Text style={styles.recText}>● REC</Text></View>}
        </View>
        <View style={styles.topRight}>
          <Text style={styles.timer}>{elapsed}</Text>
          <TouchableOpacity style={styles.peopleBtn} onPress={() => openPanel(showPeople ? null : 'people')} activeOpacity={0.8}>
            <Text style={styles.peopleText}>👥 {participantCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.leaveBtn} onPress={leave} activeOpacity={0.8}>
            <Text style={styles.leaveText}>Leave</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}

      {/* Connection banner */}
      {conn !== 'connected' && !overlay && (
        <View style={[styles.banner, conn === 'poor' ? styles.bannerWarn : styles.bannerErr]}>
          <Text style={styles.bannerText}>
            {conn === 'poor' ? 'Weak connection — video may lag' : 'Connection lost. Trying to reconnect…'}
          </Text>
        </View>
      )}

      {/* Video stage */}
      <View style={styles.stage}>
        {shareTile ? (
          <View style={styles.shareStage}>
            {/* Call toolbar: one horizontal row in its own band above the shared
                screen (never over it). Standard call icons, like Meet / Zoom. */}
            {!fullShare && (
            <View style={styles.shareBar}>
              {([
                {
                  key: 'mic', label: micLocked ? 'Locked' : micMuted ? 'Unmute' : 'Mute',
                  icon: (micMuted ? 'micOff' : 'mic') as LiveIconName, off: micMuted, on: false,
                  onPress: () => { setShowMenu(false); setShowReactBar(false); toggleMic(); },
                },
                {
                  key: 'cam', label: camLocked ? 'Locked' : camOn ? 'Stop cam' : 'Camera',
                  icon: (camOn ? 'cam' : 'camOff') as LiveIconName, off: !camOn, on: false,
                  onPress: () => { setShowMenu(false); setShowReactBar(false); toggleCam(); },
                },
                {
                  key: 'react', label: 'React', icon: 'reaction' as LiveIconName, off: false, on: showReactBar,
                  onPress: () => { setShowReactBar((v) => !v); setShowMenu(false); },
                },
                {
                  key: 'chat', label: 'Chat', icon: 'chat' as LiveIconName, off: false, on: showChat,
                  onPress: () => { openPanel(showChat ? null : 'chat'); setShowMenu(false); setShowReactBar(false); },
                },
                {
                  key: 'people', label: 'People', icon: 'people' as LiveIconName, off: false, on: showStrip,
                  onPress: () => setShowStrip((v) => !v),
                },
                {
                  key: 'more', label: 'More', icon: 'more' as LiveIconName, off: false, on: showMenu,
                  onPress: () => { setShowMenu((v) => !v); setShowReactBar(false); },
                },
              ]).map((b) => (
                <TouchableOpacity
                  key={b.key}
                  style={styles.shareBarItem}
                  onPress={b.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={b.label}
                  activeOpacity={0.75}
                >
                  <View style={[styles.shareBarCircle, b.off && styles.shareBarCircleOff, b.on && styles.shareBarCircleOn]}>
                    <LiveIcon name={b.icon} size={19} />
                  </View>
                  <Text style={styles.shareBarLabel} numberOfLines={1}>{b.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            )}

            {/* 1st priority: the shared screen takes all the space between the
                toolbar and the people strip (nothing is drawn on top of it). */}
            <View
              style={styles.shareVideoWrap}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setShareArea((cur) => (cur && cur.w === width && cur.h === height ? cur : { w: width, h: height }));
              }}
            >
              {shareBox && (
                <ExpoAWSChimeView
                  key={`share-${shareTile.tileId}`}
                  tileId={shareTile.tileId}
                  isLocal={shareTile.isLocal}
                  fit
                  style={shareBox}
                />
              )}
              {/* Full screen: rotate to landscape and give the shared screen the
                  whole display (portrait leaves big empty bands above/below). */}
              <TouchableOpacity
                style={styles.fullBtn}
                onPress={fullShare ? exitFullShare : enterFullShare}
                accessibilityRole="button"
                accessibilityLabel={fullShare ? 'Exit full screen' : 'Full screen'}
                hitSlop={8}
                activeOpacity={0.8}
              >
                <LiveIcon name={fullShare ? 'fullscreenExit' : 'fullscreen'} size={22} />
              </TouchableOpacity>
            </View>

            {/* People: small strip under the screen, scrolls sideways for any class size. */}
            {showStrip && !fullShare && (
              <View style={styles.strip}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripContent}>
                  {camTiles.map((t) => (
                    <View key={t.tileId} style={styles.miniTile}>
                      {videosReady
                        ? <ExpoAWSChimeView tileId={t.tileId} isLocal={t.isLocal} style={styles.tileVideo} />
                        : renderTileHold(t, true)}
                      <View style={styles.miniLabel}>
                        <Text style={styles.miniLabelText} numberOfLines={1}>
                          {isMutedUser(tileUserId(t)) ? '🔇 ' : ''}{tileLabel(t)}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {avatarUsers.map((uid) => {
                    const info = roster[uid];
                    const name = nameFor(uid);
                    return (
                      <View key={`av-${uid}`} style={[styles.miniTile, styles.avatarTile]}>
                        {info?.avatarUrl ? (
                          <Image source={{ uri: info.avatarUrl }} style={styles.avatarMini} />
                        ) : (
                          <View style={styles.avatarMini}>
                            <Text style={styles.avatarMiniTxt}>{(name[0] || '?').toUpperCase()}</Text>
                          </View>
                        )}
                        <View style={styles.miniLabel}>
                          <Text style={styles.miniLabelText} numberOfLines={1}>
                            {isMutedUser(uid) ? '🔇 ' : ''}{name}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Popups open just below the toolbar and stay inside the screen. */}
            {showReactBar && (
              <View style={styles.reactPop}>
                {REACTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => { sendReaction(emoji); setShowReactBar(false); }}
                    style={styles.reactionBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {showMenu && (
              <View style={styles.menuPop}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setShowMenu(false); openPanel('audio'); refreshAudioDevices(); }}
                  activeOpacity={0.7}
                >
                  <LiveIcon name="headset" size={20} color={Colors.text} />
                  <Text style={styles.menuText}>Audio output</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); openPanel('bg'); }} activeOpacity={0.7}>
                  <LiveIcon name="background" size={20} color={Colors.text} />
                  <Text style={styles.menuText}>Background effects</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
        <ScrollView contentContainerStyle={styles.tileGrid}>
          {sortedTiles.map((t) => (
            <View key={t.tileId} style={styles.tile}>
              {videosReady
                ? <ExpoAWSChimeView tileId={t.tileId} isLocal={t.isLocal} style={styles.tileVideo} />
                : renderTileHold(t, false)}
              <View style={styles.tileLabelWrap}>
                <Text style={styles.tileLabelText} numberOfLines={1}>
                  {isMutedUser(tileUserId(t)) ? '🔇 ' : ''}{tileLabel(t)}
                </Text>
              </View>
            </View>
          ))}
          {avatarUsers.map((uid) => {
            const info = roster[uid];
            const name = nameFor(uid);
            return (
              <View key={`av-${uid}`} style={[styles.tile, styles.avatarTile]}>
                {info?.avatarUrl ? (
                  <Image source={{ uri: info.avatarUrl }} style={styles.avatarBig} />
                ) : (
                  <View style={styles.avatarBig}>
                    <Text style={styles.avatarBigTxt}>{(name[0] || '?').toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.tileLabelWrap}>
                  <Text style={styles.tileLabelText} numberOfLines={1}>
                    {isMutedUser(uid) ? '🔇 ' : ''}{name}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
        )}

        {/* Floating reactions */}
        <View pointerEvents="none" style={styles.reactionFloatLayer}>
          {floatReactions.map((r) => (
            <Text key={r.key} style={[styles.reactionFloat, { marginLeft: r.dx }]}>{r.emoji}</Text>
          ))}
        </View>

        {/* Join/leave/moderation toasts */}
        <View pointerEvents="none" style={styles.toastLayer}>
          {toasts.map((t) => (
            <View key={t.key} style={styles.toast}><Text style={styles.toastText}>{t.text}</Text></View>
          ))}
        </View>
      </View>

      {/* Reaction bar */}
      {!controlsHidden && (
      <View style={styles.reactionBar}>
        {REACTIONS.map((emoji) => (
          <TouchableOpacity key={emoji} onPress={() => sendReaction(emoji)} style={styles.reactionBtn} activeOpacity={0.7}>
            <Text style={styles.reactionEmoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
      )}

      {/* Control dock: mic, camera, chat */}
      {!controlsHidden && (
      <View style={styles.dock}>
        <TouchableOpacity
          style={[styles.dockBtn, micMuted && styles.dockBtnOff, micLocked && styles.dockBtnLocked]}
          onPress={toggleMic}
          activeOpacity={0.8}
        >
          <Text style={styles.dockIcon}>{micMuted ? '🔇' : '🎙'}</Text>
          <Text style={styles.dockLabel}>{micLocked ? 'Locked' : micMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dockBtn, !camOn && styles.dockBtnOff, camLocked && styles.dockBtnLocked]}
          onPress={toggleCam}
          activeOpacity={0.8}
        >
          <Text style={styles.dockIcon}>{camOn ? '📹' : '📵'}</Text>
          <Text style={styles.dockLabel}>{camLocked ? 'Locked' : camOn ? 'Stop Cam' : 'Camera'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dockBtn}
          onPress={() => openPanel(showChat ? null : 'chat')}
          activeOpacity={0.8}
        >
          <Text style={styles.dockIcon}>💬</Text>
          <Text style={styles.dockLabel}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dockBtn}
          onPress={() => { openPanel(showAudio ? null : 'audio'); refreshAudioDevices(); }}
          activeOpacity={0.8}
        >
          <Text style={styles.dockIcon}>{audioDeviceIcon(activeAudio?.type || 'speaker')}</Text>
          <Text style={styles.dockLabel}>Audio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dockBtn, !!bgSel && styles.dockBtnOn]}
          onPress={() => openPanel(showBg ? null : 'bg')}
          activeOpacity={0.8}
        >
          <Text style={styles.dockIcon}>🖼</Text>
          <Text style={styles.dockLabel}>Background</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* People panel */}
      {showPeople && (
        <View style={[styles.panel, { bottom: 0 }]}>
          <View style={[styles.panelInner, panelInnerPad]}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Participants ({participantCount})</Text>
            <TouchableOpacity onPress={() => setShowPeople(false)}><Text style={styles.panelClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.panelBody}>
            {presentIds
              .slice()
              .sort((a, b) => {
                const ha = a === hostUserId ? 0 : 1, hb = b === hostUserId ? 0 : 1;
                if (ha !== hb) return ha - hb;
                const ya = a === myUserId ? 0 : 1, yb = b === myUserId ? 0 : 1;
                if (ya !== yb) return ya - yb;
                return (roster[a]?.name || '').localeCompare(roster[b]?.name || '');
              })
              .map((uid) => {
                const info = roster[uid];
                const name = nameFor(uid);
                const hasCam = sortedTiles.some((t) => !t.isScreenShare && tileUserId(t) === uid);
                return (
                  <View key={uid} style={styles.personRow}>
                    {info?.avatarUrl ? (
                      <Image source={{ uri: info.avatarUrl }} style={styles.personAvatar} />
                    ) : (
                      <View style={styles.personAvatar}><Text style={styles.personAvatarTxt}>{(name[0] || '?').toUpperCase()}</Text></View>
                    )}
                    <Text style={styles.personName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.personMedia}>{isMutedUser(uid) ? '🔇' : '🎙'} {hasCam ? '📹' : '📵'}</Text>
                  </View>
                );
              })}
            {presentIds.length === 0 && <Text style={styles.panelEmpty}>No one here yet.</Text>}
          </ScrollView>
          </View>
        </View>
      )}

      {/* Audio output panel (speaker / headset / Bluetooth) */}
      {showAudio && (
        <View style={[styles.panel, styles.panelShort, { bottom: 0 }]}>
          <View style={[styles.panelInner, panelInnerPad]}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Audio output</Text>
              <TouchableOpacity onPress={() => setShowAudio(false)}><Text style={styles.panelClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.panelBody}>
              {audioDevices.length === 0 ? (
                <Text style={styles.panelEmpty}>No audio devices found.</Text>
              ) : (
                audioDevices.map((d) => {
                  const active = d.id != null && d.id === activeAudioId;
                  return (
                    <TouchableOpacity
                      key={`${d.type}-${d.id}`}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                      onPress={() => pickAudioDevice(d)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.optionIcon}>{audioDeviceIcon(d.type)}</Text>
                      <Text style={styles.optionText} numberOfLines={1}>{audioDeviceName(d)}</Text>
                      {active && <Text style={styles.optionCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })
              )}
              <Text style={styles.optionHint}>
                Headsets and Bluetooth are picked automatically when connected.
              </Text>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Virtual background picker (same backgrounds as desktop) */}
      {showBg && (
        <View style={[styles.panel, styles.panelShort, { bottom: 0 }]}>
          <View style={[styles.panelInner, panelInnerPad]}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Background</Text>
              <TouchableOpacity onPress={() => setShowBg(false)}><Text style={styles.panelClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.bgGrid}>
              {BACKGROUNDS.map((b) => {
                const active = b.sel === bgSel;
                return (
                  <TouchableOpacity
                    key={b.sel || 'none'}
                    style={[styles.bgCell, active && styles.bgCellActive]}
                    onPress={() => pickBackground(b.sel)}
                    disabled={bgBusy}
                    activeOpacity={0.8}
                  >
                    {b.thumb ? (
                      <Image source={b.thumb} style={styles.bgThumb} />
                    ) : (
                      <View style={[styles.bgThumb, styles.bgNone]}><Text style={styles.bgNoneText}>🚫 None</Text></View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={styles.optionHint}>
              {bgBusy ? 'Applying…' : camOn ? 'Applied to your camera for everyone.' : 'Applied when you turn your camera on.'}
            </Text>
          </View>
        </View>
      )}

      {/* Chat panel */}
      {showChat && (
        <KCKeyboardAvoidingView behavior="padding" style={[styles.panel, panelPos]}>
          <View style={[styles.panelInner, panelInnerPad]}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Chat</Text>
            <TouchableOpacity onPress={() => setShowChat(false)}><Text style={styles.panelClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView
            ref={chatScrollRef}
            style={styles.panelBody}
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
            onScrollBeginDrag={() => setPickerFor(null)}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              <Text style={styles.panelEmpty}>No messages yet. Say hello! 👋</Text>
            ) : (
              messages.map((m, idx) => {
                const mine = m.senderId === myUserId;
                const isTeacher = m.senderRole === 'teacher';
                const agg = reactions[m.id];
                const emojis = agg ? Object.keys(agg.counts).filter((e) => agg.counts[e] > 0) : [];
                // Group consecutive messages from one sender (name shown once, tighter gap).
                const prev = idx > 0 ? messages[idx - 1] : null;
                const grouped = !!prev && prev.senderId === m.senderId;
                const time = formatClock(m.createdAt);
                return (
                  <View
                    key={m.id}
                    style={[styles.msgWrap, mine && styles.msgWrapMine, grouped && styles.msgWrapGrouped]}
                  >
                    {/* Long-press a message -> emoji bar pops up above it (WhatsApp-style). */}
                    {pickerFor === m.id && (
                      <ReactionPicker
                        mine={agg?.mine || {}}
                        alignRight={mine}
                        onPick={(e) => toggleMsgReaction(m.id, e)}
                      />
                    )}
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onLongPress={() => setPickerFor((cur) => (cur === m.id ? null : m.id))}
                      onPress={() => { if (pickerFor) setPickerFor(null); }}
                      delayLongPress={220}
                      style={[styles.msg, mine && styles.msgMine, pickerFor === m.id && styles.msgSelected]}
                    >
                      {!mine && !grouped && (
                        <Text style={[styles.msgWho, isTeacher && styles.msgWhoTeacher]}>
                          {m.senderName || 'User'}{isTeacher ? ' · Teacher' : ''}
                        </Text>
                      )}
                      <Text style={styles.msgText}>{m.message}</Text>
                      {!!time && <Text style={styles.msgTime}>{time}</Text>}
                    </TouchableOpacity>
                    {emojis.length > 0 && (
                      <View style={[styles.badgeRow, mine && styles.badgeRowMine]}>
                        {emojis.map((e) => (
                          <TouchableOpacity
                            key={e}
                            onPress={() => toggleMsgReaction(m.id, e)}
                            style={[styles.badge, agg!.mine[e] && styles.badgeMine]}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.badgeText}>{e} {agg!.counts[e]}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={styles.chatInputRow}>
            <TextInput
              style={[styles.chatInput, chatLocked && styles.chatInputLocked]}
              value={chatText}
              onChangeText={setChatText}
              editable={!chatLocked}
              placeholder={chatLocked ? 'Chat disabled by host' : 'Type a message…'}
              placeholderTextColor={Colors.muted}
              onSubmitEditing={sendChat}
              returnKeyType="send"
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.chatSend, chatLocked && styles.dockBtnLocked]}
              onPress={sendChat}
              disabled={chatLocked}
              activeOpacity={0.8}
            >
              <Text style={styles.chatSendText}>Send</Text>
            </TouchableOpacity>
          </View>
          </View>
        </KCKeyboardAvoidingView>
      )}

      {/* Terminal overlay: class ended / connection lost / removed */}
      {overlay && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayIcon}>{overlay.icon}</Text>
            <Text style={styles.overlayTitle}>{overlay.title}</Text>
            <Text style={styles.overlayMsg}>{overlay.msg}</Text>

            {state === 'failed' && (
              <TouchableOpacity style={styles.retryBtn} onPress={connect} activeOpacity={0.8}>
                <Text style={styles.retryText}>Rejoin</Text>
              </TouchableOpacity>
            )}
            {state === 'removed' && !rejoinSent && (
              <TouchableOpacity style={styles.retryBtn} onPress={askRejoin} disabled={rejoinBusy} activeOpacity={0.8}>
                <Text style={styles.retryText}>{rejoinBusy ? 'Sending…' : 'Request to rejoin'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.retryBtn, state !== 'ended' && styles.secondaryBtn]}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.retryText}>{state === 'failed' ? 'Leave' : 'Back to Live Classes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  stageEmoji: { fontSize: 48 },
  statusText: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  subText: { color: Colors.muted, fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 10, backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 10, alignItems: 'center' },
  secondaryBtn: { backgroundColor: 'rgba(255,255,255,0.12)' },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 10 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.danger },
  topTitle: { color: '#fff', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  recBadge: { backgroundColor: 'rgba(239,68,68,0.2)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  recText: { color: '#F87171', fontSize: 10, fontWeight: '800' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timer: { color: Colors.muted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  peopleBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  peopleText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  leaveBtn: { backgroundColor: Colors.danger, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  leaveText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  banner: { paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center' },
  bannerWarn: { backgroundColor: 'rgba(234,179,8,0.9)' },
  bannerErr: { backgroundColor: 'rgba(239,68,68,0.9)' },
  bannerText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  stage: { flex: 1, position: 'relative' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 6, gap: 6 },
  tile: { width: '48.5%', aspectRatio: 3 / 4, backgroundColor: '#111', borderRadius: 12, overflow: 'hidden' },
  // Screen-share layout: shared screen fills the stage, people float below it.
  shareStage: { flex: 1, backgroundColor: '#000' },
  shareVideoWrap: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  fullBtn: {
    position: 'absolute', right: 10, bottom: 10, width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  strip: { paddingVertical: 6, backgroundColor: '#000' },
  stripContent: { paddingHorizontal: 8, gap: 6 },
  // Horizontal call toolbar (screen-share layout): 6 equal slots, always fits.
  shareBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, paddingVertical: 5,
    backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  shareBarItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  shareBarCircle: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  shareBarCircleOff: { backgroundColor: '#DC2626' },
  shareBarCircleOn: { backgroundColor: Colors.primary },
  shareBarLabel: { color: Colors.text, fontSize: 9, fontWeight: '600' },
  reactPop: {
    position: 'absolute', top: 62, left: 8, right: 8, zIndex: 5,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
    backgroundColor: 'rgba(20,18,31,0.97)', borderRadius: 28, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', elevation: 6,
  },
  menuPop: {
    position: 'absolute', top: 62, right: 8, minWidth: 200, paddingVertical: 4, zIndex: 5,
    backgroundColor: 'rgba(20,18,31,0.98)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)', elevation: 6,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  menuText: { color: Colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  miniTile: {
    width: 64, height: 86, borderRadius: 10, overflow: 'hidden',
    backgroundColor: 'rgba(17,17,17,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  miniLabel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 1, paddingHorizontal: 4 },
  miniLabelText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  avatarMini: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.card2, alignItems: 'center', justifyContent: 'center' },
  avatarMiniTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  layoutBtns: { position: 'absolute', top: 8, right: 8, gap: 8 },
  layoutBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  layoutBtnOn: { backgroundColor: 'rgba(124,58,237,0.75)' },
  layoutBtnText: { fontSize: 16, color: '#fff' },
  avatarTile: { alignItems: 'center', justifyContent: 'center' },
  avatarBig: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.card2, alignItems: 'center', justifyContent: 'center' },
  avatarBigTxt: { color: '#fff', fontSize: 28, fontWeight: '700' },
  tileVideo: { flex: 1, width: '100%', height: '100%' },
  tileLabelWrap: { position: 'absolute', left: 6, bottom: 6, maxWidth: '90%', backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 },
  tileLabelText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  reactionFloatLayer: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' },
  reactionFloat: { fontSize: 32 },
  toastLayer: { position: 'absolute', top: 10, alignSelf: 'center', gap: 6 },
  toast: { backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999 },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  reactionBar: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    paddingVertical: 8, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  reactionBtn: { padding: 5 },
  reactionEmoji: { fontSize: 24 },

  dock: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 10, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  // 5 buttons: equal width so they fit on narrow phones too.
  dockBtn: { flex: 1, minWidth: 0, marginHorizontal: 2, alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 2, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  dockBtnOff: { backgroundColor: 'rgba(239,68,68,0.15)' },
  dockBtnOn: { backgroundColor: 'rgba(124,58,237,0.25)' },
  dockBtnLocked: { opacity: 0.5 },
  dockIcon: { fontSize: 20 },
  dockLabel: { color: Colors.text, fontSize: 9, fontWeight: '600' },

  // Slide-up panels (people / chat / audio / background)
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%',
    backgroundColor: '#14121f', borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
    overflow: 'hidden',
  },
  panelShort: { height: '46%' },
  panelInner: { flexShrink: 1, flexGrow: 1 },

  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.04)' },
  optionRowActive: { backgroundColor: 'rgba(124,58,237,0.25)' },
  optionIcon: { fontSize: 20 },
  optionText: { color: Colors.text, fontSize: 15, flex: 1 },
  optionCheck: { color: '#C4B5FD', fontSize: 16, fontWeight: '800' },
  optionHint: { color: Colors.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 12, paddingVertical: 8 },

  bgGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, gap: 10, justifyContent: 'center' },
  bgCell: { width: '30%', aspectRatio: 16 / 9, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  bgCellActive: { borderColor: '#A78BFA' },
  bgThumb: { width: '100%', height: '100%' },
  bgNone: { backgroundColor: Colors.card2, alignItems: 'center', justifyContent: 'center' },
  bgNoneText: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  panelTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  panelClose: { color: Colors.muted, fontSize: 18, fontWeight: '700' },
  panelBody: { flex: 1, padding: 12 },
  panelEmpty: { color: Colors.muted, fontSize: 13, textAlign: 'center', marginTop: 20 },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  personAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.card2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  personAvatarTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  personName: { color: Colors.text, fontSize: 14, flex: 1 },
  personMedia: { color: Colors.muted, fontSize: 13 },

  // Chat bubbles: explicit line heights + roomy padding so text (and emoji,
  // which are taller than letters) never touch the bubble's top/bottom edge.
  chatContent: { paddingTop: 6, paddingBottom: 14 },
  msgWrap: { marginBottom: 10, alignSelf: 'flex-start', maxWidth: '82%' },
  msgWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgWrapGrouped: { marginTop: -6 },
  msg: {
    backgroundColor: Colors.card2, borderRadius: 14, borderTopLeftRadius: 4,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, flexShrink: 1,
  },
  msgMine: { backgroundColor: 'rgba(124,58,237,0.35)', borderTopLeftRadius: 14, borderTopRightRadius: 4 },
  msgSelected: { borderWidth: 1, borderColor: 'rgba(196,181,253,0.7)' },
  msgWho: { color: Colors.muted, fontSize: 12, lineHeight: 16, fontWeight: '700', marginBottom: 3 },
  msgWhoTeacher: { color: '#FBBF24' },
  msgText: { color: Colors.text, fontSize: 15, lineHeight: 21 },
  msgTime: { color: 'rgba(255,255,255,0.45)', fontSize: 10, lineHeight: 14, alignSelf: 'flex-end', marginTop: 3 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -4 },
  badgeRowMine: { justifyContent: 'flex-end' },
  badge: {
    backgroundColor: '#2a2540', borderRadius: 12, paddingVertical: 3, paddingHorizontal: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  badgeMine: { backgroundColor: 'rgba(124,58,237,0.5)', borderColor: 'rgba(196,181,253,0.6)' },
  badgeText: { color: Colors.text, fontSize: 12, lineHeight: 16 },
  picker: {
    flexDirection: 'row', gap: 2, marginBottom: 6, backgroundColor: '#241f38', borderRadius: 26,
    paddingHorizontal: 6, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  pickerBtn: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 20 },
  pickerBtnMine: { backgroundColor: 'rgba(124,58,237,0.45)' },
  pickerEmoji: { fontSize: 26, lineHeight: 34 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: '#14121f' },
  chatInput: { flex: 1, minHeight: 44, backgroundColor: Colors.card2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: Colors.text, fontSize: 15 },
  chatInputLocked: { opacity: 0.5 },
  chatSend: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  chatSendText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  overlayCard: {
    width: '100%', maxWidth: 360, backgroundColor: '#14121f', borderRadius: 18, padding: 22,
    alignItems: 'stretch', gap: 8, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
  },
  overlayIcon: { fontSize: 40, textAlign: 'center' },
  overlayTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  overlayMsg: { color: Colors.muted, fontSize: 14, textAlign: 'center', marginBottom: 6 },
});
