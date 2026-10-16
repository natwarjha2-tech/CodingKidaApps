/**
 * Live Room (STUDENT) — mobile port of desktop live-room.js + live-room-chat.js
 * + live-room-participants.js, built on the vendored AWS Chime native module
 * (modules/expo-aws-chime). Students join, see/hear the teacher + peers, toggle
 * their OWN mic + camera, chat, react, and are subject to host moderation.
 *
 * REAL-TIME model (differs from desktop by necessity):
 *  - A/V + presence (join/leave) + video tiles come from the native Chime SDK
 *    events — true real-time.
 *  - Chat, reactions, and host-moderation ENFORCEMENT ride on REST polling
 *    (the native module has no Chime data-message bridge). Chat polls
 *    GET /chat?after=; moderation polls GET /participants for THIS user's
 *    audioBlocked/videoBlocked/chatBlocked flags and enforces them locally.
 *
 * Host-only features (start/end, recording, screen-share, moderation CONTROLS)
 * are intentionally absent — mobile is student-only.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, BackHandler,
  ScrollView, TextInput, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PermissionsAndroid } from 'react-native';
import {
  startMeeting, stopMeeting, mute, unmute, startLocalVideo, stopLocalVideo,
  addListener, ExpoAWSChimeView, type VideoTileEvent,
} from '../../modules/expo-aws-chime';
import {
  liveApi, type LiveJoinData, type LiveParticipant, type LiveRoomChatMessage,
} from '@/api';
import { useAuthStore } from '@/store';
import { Colors } from '@/theme';

// Request mic + camera at runtime (Android). Chime needs RECORD_AUDIO to connect
// audio at all; CAMERA only when the student turns their camera on, but we ask
// for both up front so the first toggle is instant. Uses the built-in
// PermissionsAndroid API (no extra dependency). iOS prompts natively on first use.
async function requestMediaPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.CAMERA,
    ]);
    // Audio is required to join; camera can be granted later, so only block on audio.
    return res[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

type RoomState = 'joining' | 'connecting' | 'connected' | 'error' | 'left';

// Classroom reaction set (mirrors desktop LRC_REACTIONS).
const REACTIONS = ['👍', '👎', '✋', '👏', '🎉'];

// Strip Chime's screen-share "#content" suffix so a share pseudo-attendee is
// never counted as a person (mirrors desktop _lrpBaseUserId / skip).
function baseUserId(externalUserId: string | undefined): string {
  if (!externalUserId) return '';
  const i = externalUserId.indexOf('#content');
  return i === -1 ? externalUserId : externalUserId.slice(0, i);
}
function isContent(id: string | undefined): boolean {
  return !!id && id.indexOf('#content') !== -1;
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function LiveRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classId = String(id || '');
  const myUserId = useAuthStore((s) => s.user?.id) || '';

  const [state, setState] = useState<RoomState>('joining');
  const [joinData, setJoinData] = useState<LiveJoinData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // A/V state
  const [micMuted, setMicMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [videoTiles, setVideoTiles] = useState<VideoTileEvent[]>([]);

  // Host-moderation (enforced on THIS student via participants poll).
  const [micLocked, setMicLocked] = useState(false);
  const [camLocked, setCamLocked] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);

  // Roster / presence
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const [roster, setRoster] = useState<Record<string, LiveParticipant>>({});
  const [toasts, setToasts] = useState<{ key: string; text: string }[]>([]);
  const [showPeople, setShowPeople] = useState(false);

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<LiveRoomChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [floatReactions, setFloatReactions] = useState<{ key: string; emoji: string }[]>([]);

  // Timer
  const [elapsed, setElapsed] = useState('00:00');

  const leavingRef = useRef(false);
  const chatCursorRef = useRef<string | undefined>(undefined);
  const chatSeenRef = useRef<Set<string>>(new Set());
  const startedAtRef = useRef<number>(0);

  const hostUserId = joinData?.liveClass?.hostUserId || '';

  // ── Leave: stop Chime + tell backend + navigate back ──────────────────────
  const leave = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setState('left');
    try { await stopMeeting(); } catch { /* ignore */ }
    try { if (classId) await liveApi.leave(classId); } catch { /* best-effort */ }
    router.back();
  }, [classId]);

  // ── Join + connect to Chime on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!classId) { setState('error'); setErrorMsg('Missing class id.'); return; }

    (async () => {
      try {
        const data = await liveApi.join(classId, 'STUDENT_MOBILE');
        if (cancelled) return;
        if (!data?.success || !data.meeting || !data.attendee) {
          setState('error');
          setErrorMsg(data?.message || 'Could not join the class.');
          return;
        }
        setJoinData(data);
        const startedIso = data.liveClass?.startedAt;
        const startedMs = startedIso ? Date.parse(startedIso) : NaN;
        startedAtRef.current = isNaN(startedMs) ? Date.now() : startedMs;
        setState('connecting');

        // Ask for mic (required) + camera before connecting. If mic is denied we
        // can't join at all.
        const granted = await requestMediaPermissions();
        if (cancelled) return;
        if (!granted) {
          setState('error');
          setErrorMsg('Microphone permission is required to join a live class.');
          return;
        }

        // Hand the backend's Chime Meeting + Attendee to the native SDK. The
        // module's field names match our ChimeMeeting/ChimeAttendee exactly.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await startMeeting(data.meeting as any, data.attendee as any);
        } catch (e) {
          if (cancelled) return;
          setState('error');
          setErrorMsg((e as Error)?.message || 'Could not connect to the class.');
        }
      } catch (e) {
        if (cancelled) return;
        setState('error');
        setErrorMsg((e as Error)?.message || 'Could not join the class.');
      }
    })();

    return () => { cancelled = true; };
  }, [classId]);

  // ── Native Chime event listeners ──────────────────────────────────────────
  useEffect(() => {
    const addToast = (text: string) => {
      const key = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { key, text }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.key !== key)), 3200);
    };

    const subs = [
      addListener('onMeetingStart', () => {
        setState('connected');
      }),
      addListener('onMeetingEnd', () => {
        // Session ended (class ended / dropped). If we didn't initiate leave,
        // treat as the class closing.
        if (!leavingRef.current) {
          setState('left');
          router.back();
        }
      }),
      addListener('onAttendeesJoin', (p) => {
        const ids = (p.externalUserIds || [])
          .filter((eid) => !isContent(eid))
          .map(baseUserId)
          .filter(Boolean);
        if (ids.length === 0) return;
        setPresentIds((prev) => [...new Set([...prev, ...ids])]);
        // Toast for peers (not ourselves).
        ids.forEach((uid) => {
          if (uid !== myUserId) addToast(`${roster[uid]?.name || 'A participant'} joined`);
        });
      }),
      addListener('onAttendeesLeave', (p) => {
        const ids = (p.externalUserIds || [])
          .filter((eid) => !isContent(eid))
          .map(baseUserId)
          .filter(Boolean);
        if (ids.length === 0) return;
        setPresentIds((prev) => prev.filter((x) => !ids.includes(x)));
        ids.forEach((uid) => {
          if (uid !== myUserId) addToast(`${roster[uid]?.name || 'A participant'} left`);
        });
      }),
      addListener('onAddVideoTile', (tile) => {
        setVideoTiles((prev) => {
          if (prev.some((t) => t.tileId === tile.tileId)) return prev;
          return [...prev, tile];
        });
      }),
      addListener('onRemoveVideoTile', (tile) => {
        setVideoTiles((prev) => prev.filter((t) => t.tileId !== tile.tileId));
      }),
      addListener('onError', (e) => {
        if (!leavingRef.current) {
          setState('error');
          setErrorMsg(e?.error || 'A live-class error occurred.');
        }
      }),
    ];

    return () => { subs.forEach((s) => { try { s.remove(); } catch { /* ignore */ } }); };
    // roster/myUserId read inside closures; re-subscribe when roster identity map changes
    // so toasts can use fresh names. Safe because listeners are idempotent.
  }, [myUserId, roster]);

  // ── Elapsed timer (from class startedAt) ──────────────────────────────────
  useEffect(() => {
    if (state !== 'connected') return;
    const tick = () => setElapsed(formatElapsed(Date.now() - startedAtRef.current));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [state]);

  // ── Roster identity + host-moderation self-enforcement (poll) ─────────────
  useEffect(() => {
    if (state !== 'connected' || !classId) return;
    let stop = false;

    const applyModeration = (me: LiveParticipant | undefined) => {
      if (!me) return;
      // Audio: if host blocked me, force mute + lock the mic button.
      if (me.audioBlocked && !micLocked) {
        setMicLocked(true);
        mute().catch(() => {});
        setMicMuted(true);
      } else if (!me.audioBlocked && micLocked) {
        setMicLocked(false);
      }
      // Video: if host blocked me, force camera off + lock.
      if (me.videoBlocked && !camLocked) {
        setCamLocked(true);
        if (camOn) { stopLocalVideo().catch(() => {}); setCamOn(false); }
      } else if (!me.videoBlocked && camLocked) {
        setCamLocked(false);
      }
      // Chat: lock/unlock the input.
      setChatLocked(!!me.chatBlocked);
    };

    const poll = async () => {
      try {
        const res = await liveApi.getParticipants(classId);
        if (stop || !res?.success) return;
        const map: Record<string, LiveParticipant> = {};
        for (const p of res.participants || []) {
          if (p?.userId) map[p.userId] = p;
        }
        setRoster(map);
        // Seed presence from the server for anyone the native events missed.
        setPresentIds((prev) => [...new Set([...prev, ...Object.keys(map)])]);
        applyModeration(map[myUserId]);
      } catch { /* ignore */ }
    };

    poll();
    const iv = setInterval(poll, 4000);
    return () => { stop = true; clearInterval(iv); };
  }, [state, classId, myUserId, micLocked, camLocked, camOn]);

  // ── Chat (REST poll) ──────────────────────────────────────────────────────
  const appendMessages = useCallback((incoming: LiveRoomChatMessage[]) => {
    const fresh = incoming.filter((m) => m?.id && !chatSeenRef.current.has(m.id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => chatSeenRef.current.add(m.id));
    const last = fresh[fresh.length - 1];
    if (last?.createdAt) chatCursorRef.current = last.createdAt;
    setMessages((prev) => [...prev, ...fresh]);
  }, []);

  useEffect(() => {
    if (state !== 'connected' || !classId) return;
    let stop = false;

    const poll = async () => {
      try {
        const res = await liveApi.getChat(classId, chatCursorRef.current);
        if (stop || !res?.success) return;
        appendMessages(res.messages || []);
      } catch { /* ignore */ }
    };

    poll(); // initial history
    const iv = setInterval(poll, 2500);
    return () => { stop = true; clearInterval(iv); };
  }, [state, classId, appendMessages]);

  const sendChat = useCallback(async () => {
    const text = chatText.trim();
    if (!text || !classId || chatLocked) return;
    setChatText('');
    try {
      const res = await liveApi.sendChat(classId, text);
      if (res?.success && res.message) appendMessages([res.message]);
    } catch {
      setChatText(text); // restore on failure
    }
  }, [chatText, classId, chatLocked, appendMessages]);

  // ── Reactions ─────────────────────────────────────────────────────────────
  const sendReaction = useCallback((emoji: string) => {
    if (!classId) return;
    // Local float immediately (snappy), then persist best-effort.
    const key = `${Date.now()}-${Math.random()}`;
    setFloatReactions((prev) => [...prev, { key, emoji }]);
    setTimeout(() => setFloatReactions((prev) => prev.filter((r) => r.key !== key)), 2100);
    liveApi.react(classId, '', emoji).catch(() => {});
  }, [classId]);

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
      if (camOn) { await stopLocalVideo(); setCamOn(false); }
      else { await startLocalVideo(); setCamOn(true); }
    } catch {
      Alert.alert('Camera error', 'Could not toggle the camera. Check permissions.');
    }
  }, [camLocked, camOn]);

  // Hardware back = leave cleanly.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { leave(); return true; });
    return () => sub.remove();
  }, [leave]);

  const title = joinData?.liveClass?.title || 'Live Class';
  const participantCount = presentIds.length;

  // Sort tiles: screen-share first, then teacher, then others, local last-ish.
  const sortedTiles = useMemo(() => {
    const copy = [...videoTiles];
    copy.sort((a, b) => {
      if (a.isScreenShare !== b.isScreenShare) return a.isScreenShare ? -1 : 1;
      if (a.isLocal !== b.isLocal) return a.isLocal ? 1 : -1; // local last
      return a.tileId - b.tileId;
    });
    return copy;
  }, [videoTiles]);

  function tileLabel(t: VideoTileEvent): string {
    if (t.isScreenShare) return 'Screen';
    if (t.isLocal) return 'You';
    const uid = baseUserId(t.attendeeId);
    if (hostUserId && (t.attendeeId.indexOf(hostUserId) === 0)) return 'Teacher';
    return roster[uid]?.name || 'Participant';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.stageEmoji}>⚠️</Text>
          <Text style={styles.statusText}>Couldn’t join</Text>
          <Text style={styles.subText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()} activeOpacity={0.8}>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar: live dot + title + timer + people + leave */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.topRight}>
          <Text style={styles.timer}>{elapsed}</Text>
          <TouchableOpacity style={styles.peopleBtn} onPress={() => setShowPeople((v) => !v)} activeOpacity={0.8}>
            <Text style={styles.peopleText}>👥 {participantCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.leaveBtn} onPress={leave} activeOpacity={0.8}>
            <Text style={styles.leaveText}>Leave</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Video stage */}
      <View style={styles.stage}>
        {sortedTiles.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.stageEmoji}>🎧</Text>
            <Text style={styles.subText}>Connected — audio only right now.</Text>
            <Text style={styles.subText}>Video appears when someone turns on their camera.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.tileGrid}>
            {sortedTiles.map((t) => (
              <View
                key={t.tileId}
                style={[styles.tile, t.isScreenShare && styles.tileWide]}
              >
                <ExpoAWSChimeView tileId={t.tileId} isLocal={t.isLocal} style={styles.tileVideo} />
                <View style={styles.tileLabelWrap}>
                  <Text style={styles.tileLabelText} numberOfLines={1}>{tileLabel(t)}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Floating reactions */}
        <View pointerEvents="none" style={styles.reactionFloatLayer}>
          {floatReactions.map((r) => (
            <Text key={r.key} style={styles.reactionFloat}>{r.emoji}</Text>
          ))}
        </View>

        {/* Join/leave toasts */}
        <View pointerEvents="none" style={styles.toastLayer}>
          {toasts.map((t) => (
            <View key={t.key} style={styles.toast}><Text style={styles.toastText}>{t.text}</Text></View>
          ))}
        </View>
      </View>

      {/* Reaction bar */}
      <View style={styles.reactionBar}>
        {REACTIONS.map((emoji) => (
          <TouchableOpacity key={emoji} onPress={() => sendReaction(emoji)} style={styles.reactionBtn} activeOpacity={0.7}>
            <Text style={styles.reactionEmoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Control dock: mic, camera, chat */}
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

        <TouchableOpacity style={styles.dockBtn} onPress={() => setShowChat((v) => !v)} activeOpacity={0.8}>
          <Text style={styles.dockIcon}>💬</Text>
          <Text style={styles.dockLabel}>Chat</Text>
        </TouchableOpacity>
      </View>

      {/* People panel */}
      {showPeople && (
        <View style={styles.panel}>
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
                const name = uid === myUserId ? `${info?.name || 'You'} (You)` : (info?.name || 'Participant');
                const isHost = uid === hostUserId;
                return (
                  <View key={uid} style={styles.personRow}>
                    {info?.avatarUrl ? (
                      <Image source={{ uri: info.avatarUrl }} style={styles.personAvatar} />
                    ) : (
                      <View style={styles.personAvatar}><Text style={styles.personAvatarTxt}>{(name[0] || '?').toUpperCase()}</Text></View>
                    )}
                    <Text style={styles.personName} numberOfLines={1}>{name}</Text>
                    {isHost && <View style={styles.hostBadge}><Text style={styles.hostBadgeTxt}>Host</Text></View>}
                  </View>
                );
              })}
            {presentIds.length === 0 && <Text style={styles.panelEmpty}>No one here yet.</Text>}
          </ScrollView>
        </View>
      )}

      {/* Chat panel */}
      {showChat && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.panel}
        >
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Chat</Text>
            <TouchableOpacity onPress={() => setShowChat(false)}><Text style={styles.panelClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.panelBody}>
            {messages.length === 0 ? (
              <Text style={styles.panelEmpty}>No messages yet. Say hello! 👋</Text>
            ) : (
              messages.map((m) => {
                const mine = m.isMine || m.senderId === myUserId;
                const isTeacher = m.senderRole === 'teacher';
                return (
                  <View key={m.id} style={[styles.msg, mine && styles.msgMine]}>
                    <Text style={styles.msgWho}>
                      {m.senderName || 'User'}{isTeacher ? ' · Teacher' : ''}
                    </Text>
                    <Text style={styles.msgText}>{m.message}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={chatText}
              onChangeText={setChatText}
              editable={!chatLocked}
              placeholder={chatLocked ? 'Chat disabled by host' : 'Type a message…'}
              placeholderTextColor={Colors.muted}
              onSubmitEditing={sendChat}
              returnKeyType="send"
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
        </KeyboardAvoidingView>
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
  retryBtn: { marginTop: 14, backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 10 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 10 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.danger },
  topTitle: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timer: { color: Colors.muted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  peopleBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  peopleText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  leaveBtn: { backgroundColor: Colors.danger, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  leaveText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  stage: { flex: 1, position: 'relative' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 6, gap: 6 },
  tile: { width: '48.5%', aspectRatio: 3 / 4, backgroundColor: '#111', borderRadius: 12, overflow: 'hidden' },
  tileWide: { width: '100%', aspectRatio: 16 / 9 },
  tileVideo: { flex: 1, width: '100%', height: '100%' },
  tileLabelWrap: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 },
  tileLabelText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  reactionFloatLayer: { position: 'absolute', right: 20, bottom: 10, alignItems: 'center' },
  reactionFloat: { fontSize: 32 },
  toastLayer: { position: 'absolute', top: 10, alignSelf: 'center', gap: 6 },
  toast: { backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999 },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  reactionBar: {
    flexDirection: 'row', justifyContent: 'center', gap: 10,
    paddingVertical: 8, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  reactionBtn: { padding: 6 },
  reactionEmoji: { fontSize: 26 },

  dock: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 10, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  dockBtn: { alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 18, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  dockBtnOff: { backgroundColor: 'rgba(239,68,68,0.15)' },
  dockBtnLocked: { opacity: 0.5 },
  dockIcon: { fontSize: 20 },
  dockLabel: { color: Colors.text, fontSize: 11, fontWeight: '600' },

  // Slide-up panels (people / chat)
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%',
    backgroundColor: '#14121f', borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  panelTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  panelClose: { color: Colors.muted, fontSize: 18, fontWeight: '700' },
  panelBody: { flex: 1, padding: 12 },
  panelEmpty: { color: Colors.muted, fontSize: 13, textAlign: 'center', marginTop: 20 },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  personAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.card2, alignItems: 'center', justifyContent: 'center' },
  personAvatarTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  personName: { color: Colors.text, fontSize: 14, flex: 1 },
  hostBadge: { backgroundColor: 'rgba(124,58,237,0.2)', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 },
  hostBadgeTxt: { color: '#C4B5FD', fontSize: 11, fontWeight: '700' },

  msg: { marginBottom: 10, alignSelf: 'flex-start', maxWidth: '85%', backgroundColor: Colors.card2, borderRadius: 10, padding: 8 },
  msgMine: { alignSelf: 'flex-end', backgroundColor: 'rgba(124,58,237,0.25)' },
  msgWho: { color: Colors.muted, fontSize: 11, fontWeight: '600', marginBottom: 2 },
  msgText: { color: Colors.text, fontSize: 14 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  chatInput: { flex: 1, backgroundColor: Colors.card2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: Colors.text, fontSize: 14 },
  chatSend: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  chatSendText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
