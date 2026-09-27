// CourseSkeletonCard — premium loading placeholder that resembles CourseCard.
// Subtle looping shimmer (UI-thread, Reanimated). Stops when real data renders
// (parent simply unmounts it).
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { L, Radius, Shadow } from '@/theme';

function Shimmer({ style }: { style: any }) {
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[style, { backgroundColor: '#E8ECF5' }, anim]} />;
}

export function CourseSkeletonCard() {
  return (
    <View style={styles.card}>
      <Shimmer style={styles.thumb} />
      <View style={styles.body}>
        <Shimmer style={styles.lineWide} />
        <Shimmer style={styles.lineNarrow} />
        <View style={styles.metaRow}>
          <Shimmer style={styles.chip} />
          <Shimmer style={styles.chip} />
        </View>
        <View style={styles.footer}>
          <Shimmer style={styles.rating} />
          <Shimmer style={styles.badge} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: L.surface,
    borderRadius: Radius.card, overflow: 'hidden',
    borderWidth: 1, borderColor: L.border, ...Shadow.sm,
  },
  thumb: { height: 118, width: '100%' },
  body: { padding: 12, gap: 8 },
  lineWide: { height: 12, width: '75%', borderRadius: 6 },
  lineNarrow: { height: 10, width: '50%', borderRadius: 6 },
  metaRow: { flexDirection: 'row', gap: 6 },
  chip: { height: 14, width: 52, borderRadius: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  rating: { height: 14, width: 40, borderRadius: 6 },
  badge: { height: 18, width: 40, borderRadius: Radius.pill },
});
