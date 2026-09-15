import { useCallback, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getUnreadCount } from '@/services/notification.service';

/**
 * Unified "refresh the ENTIRE app" action — one behaviour everywhere.
 *
 * Wherever the 🔄 button is tapped (dashboard, courses, profile, …) it does the
 * SAME thing: invalidate ALL React Query caches so every screen refetches the
 * latest data from the backend on next access — regardless of staleTime. This
 * mirrors the desktop refresh (fetch fresh + update cache even if not expired).
 *
 * Also exposes a spin animation (`spin`) + `refreshing` flag so any refresh icon
 * can show a spinning state. Shared → no duplication.
 */
export function useRefreshAll(onDone?: (unread: number) => void) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;

  const refreshAll = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);

    // Spin the icon while refreshing
    spinValue.setValue(0);
    Animated.loop(
      Animated.timing(spinValue, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })
    ).start();

    try {
      // Invalidate EVERY query (no key filter) → whole app refetches fresh data,
      // bypassing staleTime, and the cache is updated with the latest values.
      await queryClient.invalidateQueries();

      // Refresh unread notification badge too (not a React Query source).
      try {
        const unread = await getUnreadCount();
        onDone?.(unread);
      } catch {
        // ignore — badge stays as-is
      }
    } finally {
      spinValue.stopAnimation();
      setRefreshing(false);
    }
  }, [refreshing, queryClient, spinValue, onDone]);

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return { refreshAll, refreshing, spin };
}
