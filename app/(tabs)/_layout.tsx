import { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store';
import { L, Spring, Duration } from '@/theme';

// Premium animated tab icon: active → icon scales up + soft brand pill fades in,
// label turns brand-coloured. One reusable animation (no per-tab duplication).
function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  const scale = useSharedValue(focused ? 1 : 0.95);
  const pill = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.95, Spring.standard);
    pill.value = withTiming(focused ? 1 : 0, { duration: Duration.fast });
  }, [focused, scale, pill]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: pill.value }));

  return (
    <View style={styles.tabIcon}>
      <View style={styles.iconRow}>
        <Animated.View style={[styles.activePill, pillStyle]} />
        <Animated.Text style={[styles.emoji, iconStyle]}>{emoji}</Animated.Text>
      </View>
      <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const insets = useSafeAreaInsets();

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Dynamic bottom padding based on device safe area (gesture bar)
  const bottomPadding = Math.max(insets.bottom, 8) + 4;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: L.surface,
          borderTopColor: L.borderSoft,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
        tabBarActiveTintColor: L.primary,
        tabBarInactiveTintColor: L.textMuted,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} />,
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📚" label="Courses" focused={focused} />,
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="ai-mentor"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🤖" label="AI" focused={focused} />,
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} />,
          tabBarLabel: () => null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: { alignItems: 'center', justifyContent: 'center', paddingTop: 2, width: 64 },
  iconRow: { alignItems: 'center', justifyContent: 'center', height: 30, width: 44 },
  activePill: {
    position: 'absolute', width: 44, height: 28, borderRadius: 14,
    backgroundColor: L.primaryLight,
  },
  emoji: { fontSize: 20 },
  label: { fontSize: 10, marginTop: 2, color: L.textMuted, textAlign: 'center' },
  labelActive: { color: L.primary, fontWeight: '700' },
});
