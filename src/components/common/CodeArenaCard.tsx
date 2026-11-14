/**
 * Dashboard hero card for the Code Arena (practice problems, AI help, score).
 * Bright, game-like look for kids: violet card, floating 💻 tile, feature
 * chips, the student's own points / streak and a big "Play now" button.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/store';
import { scoreGet, currentStreak } from '@/components/coding/playgroundStore';

const VIOLET = '#5B2EF0';

export function CodeArenaCard() {
  const userId = useAuthStore((s) => s.user?.id);
  const [stats, setStats] = useState<{ points: number; coins: number; streak: number; solved: number } | null>(null);
  const float = useRef(new Animated.Value(0)).current;

  // Gentle floating animation on the 💻 tile.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  useFocusEffect(useCallback(() => {
    scoreGet(userId)
      .then((d) => setStats({
        points: d.totalPoints, coins: d.totalCoins, streak: currentStreak(d.submissionCalendar), solved: d.solvedProblems.length,
      }))
      .catch(() => {});
  }, [userId]));

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const hasProgress = !!stats && (stats.solved > 0 || stats.streak > 0);

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => router.push('/code-editor' as never)}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel="Open Code Arena"
    >
      {/* decorative shapes */}
      <View style={[s.blob, s.blobA]} />
      <View style={[s.blob, s.blobB]} />
      <View style={[s.blob, s.blobC]} />

      <View style={s.topRow}>
        <View style={s.textCol}>
          <View style={s.newPill}><Text style={s.newText}>⚡ PRACTICE ZONE</Text></View>
          <Text style={s.title}>Code Arena</Text>
          <Text style={s.sub}>Solve challenges, get AI hints & earn coins!</Text>
        </View>
        <Animated.View style={[s.tile, { transform: [{ translateY }, { rotate: '-8deg' }] }]}>
          <Text style={s.tileEmoji}>💻</Text>
          <View style={s.braces}><Text style={s.bracesText}>{'{ }'}</Text></View>
        </Animated.View>
      </View>

      <View style={s.chips}>
        <Text style={s.chip}>🎯 Challenges</Text>
        <Text style={s.chip}>✨ AI Help</Text>
        <Text style={s.chip}>🏆 Scoreboard</Text>
      </View>

      <View style={s.bottomRow}>
        <View style={s.statsCol}>
          {hasProgress ? (
            <Text style={s.stats} numberOfLines={1}>
              ⭐ {stats!.points} pts   🔥 {stats!.streak}-day streak
            </Text>
          ) : (
            <Text style={s.stats} numberOfLines={2}>Solve your first challenge and earn 🪙 coins!</Text>
          )}
        </View>
        <View style={s.play}>
          <Text style={s.playText}>Play now ▶</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 14, borderRadius: 24, padding: 16, overflow: 'hidden',
    backgroundColor: VIOLET,
    shadowColor: VIOLET, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  blob: { position: 'absolute', borderRadius: 999 },
  blobA: { width: 190, height: 190, right: -50, top: -70, backgroundColor: 'rgba(255,255,255,0.10)' },
  blobB: { width: 120, height: 120, left: -40, bottom: -50, backgroundColor: 'rgba(255,255,255,0.08)' },
  blobC: { width: 70, height: 70, right: 70, bottom: 6, backgroundColor: 'rgba(255,196,0,0.18)' },

  topRow: { flexDirection: 'row', alignItems: 'center' },
  textCol: { flex: 1, paddingRight: 8 },
  newPill: { alignSelf: 'flex-start', backgroundColor: '#FFC400', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 8 },
  newText: { color: '#3B2A00', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 0.2 },
  sub: { color: 'rgba(255,255,255,0.88)', fontSize: 12.5, fontWeight: '600', lineHeight: 17, marginTop: 3 },

  tile: {
    width: 78, height: 78, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.20)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  tileEmoji: { fontSize: 40 },
  braces: { position: 'absolute', right: -8, bottom: -8, backgroundColor: '#22C55E', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  bracesText: { color: '#fff', fontSize: 11, fontWeight: '900' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  chip: {
    color: '#fff', fontSize: 11.5, fontWeight: '800', backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden',
  },

  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  statsCol: { flex: 1 },
  stats: { color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  play: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 10 },
  playText: { color: VIOLET, fontSize: 14, fontWeight: '900' },
});
