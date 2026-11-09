/**
 * Live Classes list (STUDENT view) — mobile port of desktop src/renderer/app/live.js.
 *
 * Mobile is student-only: this lists the scheduled + live classes across the
 * courses the student is enrolled in. A LIVE class shows "Join Now"; a scheduled
 * one shows a disabled "Scheduled" pill. Joining navigates to the Live Room
 * (app/live/[id].tsx), which fetches its own join payload and connects to Chime.
 * Hosting/start/end are TEACHER-only (desktop) and intentionally absent here.
 *
 * A 503 from the backend means the feature is disabled → a friendly state.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { liveApi, type LiveClass } from '@/api/live.api';
import { hasJoinedLive } from '@/utils/liveJoined';
import { Colors } from '@/theme';

// "Starts in 2d 5h" / "Starts in 3h 12m" / "Starts in 12m 08s" / "Starting now"
// (mirrors desktop live.js _liveCountdownText).
function countdownText(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  const diff = Math.floor((t - now) / 1000);
  if (diff <= 0) return 'Starting now';
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  if (d > 0) return `Starts in ${d}d ${h}h`;
  if (h > 0) return `Starts in ${h}h ${m}m`;
  return `Starts in ${m}m ${pad(s)}s`;
}

// Is the live feature disabled on the backend? The api throws Error(message)
// via the interceptor; a 503 surfaces as a message we can detect loosely.
function isFeatureOff(err: unknown): boolean {
  const m = (err as Error)?.message?.toLowerCase() || '';
  return m.includes('unavailable') || m.includes('not enabled') || m.includes('503');
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'Not scheduled';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Not scheduled';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function LiveClassesScreen() {
  const focusedRef = useRef(true);
  // Student-only: just the enrolled/joinable classes (no hosting).
  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['live-classes'],
    queryFn: async () => {
      const res = await liveApi.getEnrolled();
      return res?.success ? res.classes ?? [] : [];
    },
    staleTime: 1000 * 20,
    // Auto-refresh ONLY while this screen is focused AND a class is scheduled
    // (waiting for the teacher to go live). No classes / only live classes /
    // screen in the background => no polling at all.
    refetchInterval: (query) => {
      if (!focusedRef.current) return false;
      const list = (query.state.data as LiveClass[] | undefined) ?? [];
      return list.some((c) => c.status === 'scheduled') ? 30000 : false;
    },
  });

  // Refresh whenever the screen regains focus (e.g. back from the room: the
  // class may have just ended), and track focus to pause polling when hidden.
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      refetch();
      return () => { focusedRef.current = false; };
    }, [refetch])
  );

  const featureOff = !!error && isFeatureOff(error);
  const classes = data ?? [];

  // 1s ticker for the "Starts in…" countdown (only while a scheduled class exists).
  const [now, setNow] = useState(Date.now());
  const refreshedAtStart = useRef<Set<string>>(new Set());
  const hasScheduled = classes.some((c) => c.status === 'scheduled' && c.scheduledAt);
  useEffect(() => {
    if (!hasScheduled) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [hasScheduled]);

  // When a countdown reaches zero, refetch once shortly after so the card flips
  // to "Join Now" as soon as the teacher starts.
  useEffect(() => {
    classes.forEach((c) => {
      if (c.status !== 'scheduled' || !c.scheduledAt) return;
      if (Date.parse(c.scheduledAt) <= now && !refreshedAtStart.current.has(c.id)) {
        refreshedAtStart.current.add(c.id);
        setTimeout(() => { refetch(); }, 1200);
      }
    });
  }, [now, classes, refetch]);

  // Open the live room. The room screen handles the actual join + Chime connect.
  const openRoom = useCallback((classId: string) => {
    router.push(`/live/${classId}` as never);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Classes</Text>
        <TouchableOpacity onPress={() => router.push('/live/recordings' as never)} hitSlop={8}>
          <Text style={styles.recLink}>🎬</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading live classes…</Text>
        </View>
      ) : featureOff ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📡</Text>
          <Text style={styles.emptyTitle}>Live classes aren’t enabled yet</Text>
          <Text style={styles.emptyText}>Check back soon — your teacher will go live here.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
        >
          {classes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎥</Text>
              <Text style={styles.emptyTitle}>No live classes right now</Text>
              <Text style={styles.emptyText}>Scheduled and live classes show up here. Pull to refresh.</Text>
            </View>
          ) : (
            classes.map((c) => (
              <LiveCard key={c.id} liveClass={c} now={now} onJoin={() => openRoom(c.id)} />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── One class card (student): Join Now when live, else disabled "Scheduled" ──
function LiveCard({ liveClass: c, now, onJoin }: { liveClass: LiveClass; now: number; onJoin: () => void }) {
  const isLive = c.status === 'live';
  const rejoin = isLive && hasJoinedLive(c.id);
  const countdown = !isLive ? countdownText(c.scheduledAt, now) : null;
  const instructor = c.instructorName || 'Instructor';
  const course = c.courseTitle ? ` · ${c.courseTitle}` : '';
  const dur = c.durationMinutes ? ` · ${c.durationMinutes} min` : '';
  const meta = isLive
    ? `${instructor}${course}`
    : `${instructor}${course} · ${formatWhen(c.scheduledAt)}${dur}`;

  return (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <View style={styles.titleRow}>
          {isLive && <View style={styles.liveDot} />}
          <Text style={styles.cardTitle} numberOfLines={2}>{c.title || 'Live Class'}</Text>
        </View>
        <Text style={styles.cardMeta} numberOfLines={2}>{meta}</Text>
        {!!c.agenda && <Text style={styles.cardAgenda} numberOfLines={2}>{c.agenda}</Text>}
      </View>

      <View style={styles.cardActions}>
        {isLive ? (
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={onJoin} activeOpacity={0.8}>
            <Text style={styles.btnDangerText}>{rejoin ? 'Rejoin →' : 'Join Now →'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.btn, styles.btnDisabled]}>
            <Text style={styles.btnDisabledText}>🕒 {countdown || 'Scheduled'}</Text>
          </View>
        )}
      </View>
    </View>
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
  recLink: { fontSize: 20, width: 28, textAlign: 'right' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { padding: 16, gap: 12 },

  card: {
    backgroundColor: Colors.card2, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, gap: 12,
  },
  cardInfo: { gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.danger },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  cardMeta: { color: Colors.muted, fontSize: 13 },
  cardAgenda: { color: Colors.muted, fontSize: 12, opacity: 0.8, fontStyle: 'italic' },

  cardActions: { alignItems: 'flex-start' },
  btn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnDanger: { backgroundColor: Colors.danger },
  btnDangerText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnDisabled: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.border },
  btnDisabledText: { color: Colors.muted, fontSize: 14, fontWeight: '600' },

  loadingState: { alignItems: 'center', padding: 60, gap: 12 },
  loadingText: { color: Colors.muted, fontSize: 14 },
  emptyState: { alignItems: 'center', padding: 48, gap: 10 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: Colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
