// AnimatedProgressBar — fills from 0 → the real percentage once on mount (and
// smoothly when the value genuinely changes). No layout jumps, UI-thread only.
import { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { L, Radius, Duration, EaseCurve } from '@/theme';

interface Props {
  /** 0–100 real progress percentage. */
  percent: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedProgressBar({
  percent,
  height = 6,
  trackColor = '#E6E9F2',
  fillColor = L.progress,
  style,
}: Props) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const w = useSharedValue(0);

  useEffect(() => {
    w.value = withTiming(clamped, { duration: Duration.slow, easing: EaseCurve.out });
  }, [clamped, w]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value}%` }));

  return (
    <View style={[styles.track, { height, borderRadius: Radius.pill, backgroundColor: trackColor }, style]}>
      <Animated.View style={[styles.fill, { height, borderRadius: Radius.pill, backgroundColor: fillColor }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: {},
});
