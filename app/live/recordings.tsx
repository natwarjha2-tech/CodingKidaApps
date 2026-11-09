/**
 * Live Class Recordings (STUDENT) — mobile port of desktop live-recordings.js.
 *
 * GET /api/live/classes/recordings/mine returns Course -> Class -> Recording with
 * short-lived signed play-only URLs. Tap a recording to play it inline.
 */
import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import Video from 'react-native-video';
import { liveApi } from '@/api/live.api';
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

export default function LiveRecordingsScreen() {
  const [playing, setPlaying] = useState<{ url: string; title: string } | null>(null);

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['live-recordings-mine'],
    queryFn: async () => {
      const res = await liveApi.getMyRecordings();
      return res?.success ? res.courses ?? [] : [];
    },
    // Signed URLs expire; don't serve a stale list for long.
    staleTime: 1000 * 60 * 5,
  });

  const courses = data ?? [];
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
          <Video
            source={{ uri: playing.url }}
            style={styles.video}
            controls
            resizeMode="contain"
          />
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
                      if (!rec.url) return null;
                      const label =
                        cls.recordings.length > 1 ? `Recording ${ri + 1}` : 'Watch recording';
                      const dur = formatDuration(rec.duration);
                      return (
                        <TouchableOpacity
                          key={ri}
                          style={styles.playBtn}
                          activeOpacity={0.8}
                          onPress={() => setPlaying({ url: rec.url as string, title: cls.title })}
                        >
                          <Text style={styles.playBtnText}>▶ {label}{dur ? ` · ${dur}` : ''}</Text>
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

  state: { alignItems: 'center', padding: 48, gap: 10 },
  emoji: { fontSize: 44 },
  stateTitle: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  stateText: { color: Colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
