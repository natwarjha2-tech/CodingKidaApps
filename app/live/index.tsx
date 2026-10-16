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
import { useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { liveApi, type LiveClass } from '@/api/live.api';
import { Colors } from '@/theme';

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
  // Student-only: just the enrolled/joinable classes (no hosting).
  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['live-classes'],
    queryFn: async () => {
      const res = await liveApi.getEnrolled();
      return res?.success ? res.classes ?? [] : [];
    },
    staleTime: 1000 * 20,
  });

  const featureOff = !!error && isFeatureOff(error);
  const classes = data ?? [];

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
        <View style={{ width: 28 }} />
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
            classes.map((c) => <LiveCard key={c.id} liveClass={c} onJoin={() => openRoom(c.id)} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── One class card (student): Join Now when live, else disabled "Scheduled" ──
function LiveCard({ liveClass: c, onJoin }: { liveClass: LiveClass; onJoin: () => void }) {
  const isLive = c.status === 'live';
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
            <Text style={styles.btnDangerText}>Join Now →</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.btn, styles.btnDisabled]}>
            <Text style={styles.btnDisabledText}>🕒 Scheduled</Text>
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
