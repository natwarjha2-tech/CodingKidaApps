/**
 * Live Class Recordings (STUDENT) — mobile port of desktop live-recordings.js.
 *
 * GET /api/live/classes/recordings/mine returns Course -> Class -> Recording.
 * Tapping a recording streams it exactly like a lesson video: HLS from
 * CloudFront with signed cookies (adaptive 720/480/360, segment-by-segment).
 * Recordings still being prepared on the server show "Processing…".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Animated, Easing,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import Video from 'react-native-video';
import { liveApi, type MyRecordingClass, type MyRecordingCourse, type RecordingReplay } from '@/api/live.api';
import { cloudFrontCookieHeader } from '@/api/courses.api';
import { Colors } from '@/theme';

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

type RecItem = MyRecordingClass['recordings'][number];

/** One emoji that floats up the video when its recorded moment is reached. */
function FloatingEmoji({ emoji, left, onDone }: { emoji: string; left: number; onDone: () => void }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(y, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true })
      .start(onDone);
  }, [y, onDone]);
  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: 'absolute', bottom: 8, left: `${left}%`, fontSize: 26,
        opacity: y.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
        transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, -150] }) }],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

export default function LiveRecordingsScreen() {
  // `cookie` set = HLS stream (CloudFront signed cookies), else a plain MP4 URL.
  const [playing, setPlaying] = useState<{
    url: string; title: string; cookie?: string; classId?: string; recId?: string;
  } | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  // Chat + reactions recorded during the class, replayed in sync with the video.
  const [replay, setReplay] = useState<RecordingReplay | null>(null);
  const [curTime, setCurTime] = useState(0);
  const [floaters, setFloaters] = useState<{ key: number; emoji: string; left: number }[]>([]);
  const lastT = useRef(0);
  const floatKey = useRef(0);
  const chatRef = useRef<ScrollView>(null);

  useEffect(() => {
    setReplay(null); setCurTime(0); setFloaters([]); lastT.current = 0;
    if (!playing?.classId || !playing.recId) return;
    let cancelled = false;
    liveApi.getRecordingReplay(playing.classId, playing.recId).then((r) => {
      if (!cancelled && r?.success) setReplay(r);
    });
    return () => { cancelled = true; };
  }, [playing?.classId, playing?.recId]);

  const visibleChat = useMemo(
    () => (replay?.chat ?? []).filter((m) => m.offsetSec <= curTime),
    [replay, curTime],
  );

  const onProgress = useCallback((e: { currentTime: number }) => {
    const t = e.currentTime;
    const prev = lastT.current;
    lastT.current = t;
    setCurTime(t);
    // Float reactions crossed during normal playback (not on big seeks).
    if (replay && t > prev && t - prev < 3) {
      const hit = replay.reactions.filter((r) => r.offsetSec > prev && r.offsetSec <= t).slice(0, 4);
      if (hit.length) {
        setFloaters((f) => [
          ...f,
          ...hit.map((r) => ({ key: ++floatKey.current, emoji: r.emoji, left: 8 + Math.random() * 78 })),
        ].slice(-12));
      }
    }
  }, [replay]);

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['live-recordings-mine'],
    queryFn: async () => {
      const res = await liveApi.getMyRecordings();
      return res?.success ? res.courses ?? [] : [];
    },
    // Signed URLs expire; don't serve a stale list for long.
    staleTime: 1000 * 60 * 5,
    // While any recording is still being prepared, re-check every minute so it
    // becomes playable by itself.
    refetchInterval: (query) => {
      const list = (query.state.data as MyRecordingCourse[] | undefined) ?? [];
      const preparing = list.some((c) => c.classes.some((k) =>
        k.recordings.some((r) => r.hlsStatus !== 'ready' && !r.url)));
      return preparing ? 60 * 1000 : false;
    },
  });

  const courses = data ?? [];

  // Stream like a lesson: ask for HLS auth (CloudFront cookies) → play the
  // master playlist segment by segment. Falls back to a full MP4 if only that exists.
  const openRecording = useCallback(async (classId: string | undefined, rec: RecItem, title: string) => {
    if (rec.id && classId) {
      setOpeningId(rec.id);
      try {
        const auth = await liveApi.getRecordingHlsAuth(classId, rec.id);
        const cookie = cloudFrontCookieHeader(auth?.cookies ?? null);
        if (auth?.success && auth.hlsReady && auth.masterUrl && cookie) {
          setPlaying({ url: auth.masterUrl, title, cookie, classId, recId: rec.id });
          return;
        }
      } catch { /* fall through to MP4 / processing message */ }
      finally { setOpeningId(null); }
    }
    if (rec.url) {
      setPlaying({ url: rec.url, title });
      return;
    }
    Alert.alert('Still preparing', 'This recording is being prepared. Please check back in a few minutes.');
  }, []);
  const featureOff = !!error && /unavailable|not enabled|503/i.test((error as Error)?.message || '');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Class Recordings</Text>
        <View style={{ width: 28 }} />
      </View>

      {playing && (
        <View style={styles.playerWrap}>
          <View>
            <Video
              key={playing.url}
              source={
                playing.cookie
                  ? { uri: playing.url, type: 'm3u8', headers: { Cookie: playing.cookie } }
                  : { uri: playing.url }
              }
              style={styles.video}
              controls
              resizeMode="contain"
              progressUpdateInterval={500}
              onProgress={onProgress}
            />
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {floaters.map((f) => (
                <FloatingEmoji
                  key={f.key}
                  emoji={f.emoji}
                  left={f.left}
                  onDone={() => setFloaters((cur) => cur.filter((x) => x.key !== f.key))}
                />
              ))}
            </View>
          </View>
          {!!replay && replay.chat.length > 0 && (
            <View style={styles.chatPanel}>
              <Text style={styles.chatHead}>💬 Class chat</Text>
              <ScrollView
                ref={chatRef}
                style={styles.chatList}
                nestedScrollEnabled
                onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: true })}
              >
                {visibleChat.length === 0 ? (
                  <Text style={styles.chatEmpty}>Chat appears here as the class plays.</Text>
                ) : (
                  visibleChat.map((m) => (
                    <View key={m.id} style={styles.chatMsg}>
                      <Text style={[styles.chatName, m.senderRole === 'teacher' && styles.chatTeacher]}>
                        {m.senderName}
                      </Text>
                      <Text style={styles.chatText}>{m.message}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          )}
          <View style={styles.playerBar}>
            <Text style={styles.playerTitle} numberOfLines={1}>{playing.title}</Text>
            <TouchableOpacity onPress={() => setPlaying(null)}>
              <Text style={styles.playerClose}>Close ✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.stateText}>Loading recordings…</Text>
        </View>
      ) : featureOff ? (
        <View style={styles.state}>
          <Text style={styles.emoji}>📡</Text>
          <Text style={styles.stateTitle}>Live classes aren’t enabled yet</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
        >
          {courses.length === 0 ? (
            <View style={styles.state}>
              <Text style={styles.emoji}>🎬</Text>
              <Text style={styles.stateTitle}>No recordings yet</Text>
              <Text style={styles.stateText}>Recordings of your live classes appear here after they end.</Text>
            </View>
          ) : (
            courses.map((course) => (
              <View key={course.courseId || course.courseTitle} style={styles.courseBlock}>
                <Text style={styles.courseTitle}>{course.courseTitle}</Text>
                {course.classes.map((cls, ci) => (
                  <View key={cls.classId || `${ci}`} style={styles.classCard}>
                    <Text style={styles.classTitle} numberOfLines={2}>{cls.title}</Text>
                    {!!cls.endedAt && <Text style={styles.classMeta}>{formatDate(cls.endedAt)}</Text>}
                    {cls.recordings.map((rec, ri) => {
                      const label =
                        cls.recordings.length > 1 ? `Recording ${ri + 1}` : 'Watch recording';
                      const dur = formatDuration(rec.duration);
                      const playable = rec.hlsStatus === 'ready' || !!rec.url;
                      const busy = openingId === rec.id;
                      return (
                        <TouchableOpacity
                          key={rec.id || ri}
                          style={[styles.playBtn, !playable && styles.playBtnPending]}
                          activeOpacity={0.8}
                          disabled={busy}
                          onPress={() => openRecording(cls.classId || rec.liveClassId, rec, cls.title)}
                        >
                          <Text style={styles.playBtnText}>
                            {busy ? '⏳ Opening…' : playable ? `▶ ${label}${dur ? ` · ${dur}` : ''}` : `⏳ ${label} · Processing…`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { color: Colors.primary, fontSize: 20, fontWeight: '600', paddingRight: 8, width: 28 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { padding: 16, gap: 16 },

  playerWrap: { backgroundColor: '#000' },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  playerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.card2,
  },
  playerTitle: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 10 },
  playerClose: { color: Colors.primary, fontSize: 13, fontWeight: '700' },

  chatPanel: { backgroundColor: Colors.card2, paddingHorizontal: 14, paddingTop: 8 },
  chatHead: { color: Colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  chatList: { maxHeight: 130 },
  chatEmpty: { color: Colors.muted, fontSize: 12, paddingVertical: 6 },
  chatMsg: { paddingVertical: 3, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chatName: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  chatTeacher: { color: '#f59e0b' },
  chatText: { color: '#fff', fontSize: 13, flexShrink: 1 },

  courseBlock: { gap: 10 },
  courseTitle: { color: Colors.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  classCard: {
    backgroundColor: Colors.card2, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  classTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  classMeta: { color: Colors.muted, fontSize: 12 },
  playBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
  playBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  playBtnPending: { backgroundColor: 'rgba(255,255,255,0.1)' },

  state: { alignItems: 'center', padding: 48, gap: 10 },
  emoji: { fontSize: 44 },
  stateTitle: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  stateText: { color: Colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
