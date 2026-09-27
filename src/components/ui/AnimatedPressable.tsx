// AnimatedPressable — the base interactive primitive for the whole app.
// Press → subtle scale-down + spring back, with optional light haptic. Every
// tappable card/button should build on this so press feedback is consistent
// (no duplicated press-animation logic across screens).
import { ReactNode } from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Spring, PressScale } from '@/theme';

const AView = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;      // custom press scale (default PressScale)
  haptic?: boolean;      // light haptic on press-in (default false)
}

export function AnimatedPressable({ children, style, scaleTo = PressScale, haptic = false, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AView
      {...rest}
      style={[style, animStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, Spring.standard);
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, Spring.standard);
        onPressOut?.(e);
      }}
    >
      {children}
    </AView>
  );
}
