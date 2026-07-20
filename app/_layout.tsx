import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useAuthStore } from '@/store';
import { AuthService, AttendanceService } from '@/services';
import { isRememberMeValid, isSessionValid, refreshSession, StorageService, USER_KEY } from '@/services/storage.service';
import { studentApi, apiClient } from '@/api';
import { Colors } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      refetchOnWindowFocus: false,
      refetchOnMount: 'always',
      placeholderData: (prev: any) => prev,
    },
  },
});

const CACHE_KEY_PREFIX = 'ck_qcache_';
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Save entire React Query cache to AsyncStorage (user-specific)
 */
async function persistCache(userId: string) {
  try {
    const cache = queryClient.getQueryCache().getAll();
    const data: Record<string, any> = {};
    for (const query of cache) {
      if (query.state.data && query.state.status === 'success') {
        data[JSON.stringify(query.queryKey)] = query.state.data;
      }
    }
    await AsyncStorage.setItem(CACHE_KEY_PREFIX + userId, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

/**
 * Restore cached data from AsyncStorage (user-specific) → instant UI
 */
async function restoreCache(userId: string) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY_PREFIX + userId);
    if (!raw) return;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_MAX_AGE) {
      await AsyncStorage.removeItem(CACHE_KEY_PREFIX + userId);
      return;
    }
    for (const [keyStr, value] of Object.entries(data)) {
      const queryKey = JSON.parse(keyStr);
      queryClient.setQueryData(queryKey, value);
    }
  } catch {}
}

/**
 * Clear cache for a specific user (on logout)
 */
async function clearUserCache(userId: string) {
  try {
    await AsyncStorage.removeItem(CACHE_KEY_PREFIX + userId);
  } catch {}
  queryClient.clear();
}

/**
 * Pre-fetch all major data silently after login.
 */
function _prefetchAllData() {
  queryClient.prefetchQuery({ queryKey: ['dashboard'], queryFn: () => apiClient.get('/api/student/dashboard?signed=true').then(r => r.data) });
  queryClient.prefetchQuery({ queryKey: ['courses'], queryFn: () => apiClient.get('/api/courses').then(r => r.data) });
  queryClient.prefetchQuery({ queryKey: ['coins'], queryFn: () => apiClient.get('/api/coins').then(r => r.data) });
  queryClient.prefetchQuery({ queryKey: ['achievements'], queryFn: () => apiClient.get('/api/achievements').then(r => r.data) });
  queryClient.prefetchQuery({ queryKey: ['student-progress'], queryFn: () => apiClient.get('/api/student/progress').then(r => r.data) });
  queryClient.prefetchQuery({ queryKey: ['my-orders'], queryFn: () => apiClient.get('/api/student/orders').then(r => r.data) });
  queryClient.prefetchQuery({ queryKey: ['mall'], queryFn: () => apiClient.get('/api/mall').then(r => r.data) });
  queryClient.prefetchQuery({ queryKey: ['app-ratings'], queryFn: () => apiClient.get('/api/feedback/lesson?lessonId=app_rating').then(r => r.data) });
}

function AuthInitializer() {
  const { setAuth, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    const init = async () => {
      try {
        const token = await AuthService.getStoredToken();
        const user = await AuthService.getStoredUser();

        // Check: remember me (30 days) OR active session (1 hour)
        const rememberValid = await isRememberMeValid();
        const sessionValid = await isSessionValid();
        const canAutoLogin = rememberValid || sessionValid;

        if (token && user && canAutoLogin) {
          // Extend session by 1h since user is active
          await refreshSession();

          // Restore user-specific cache from disk FIRST → instant UI (no loading)
          if (user.id) await restoreCache(user.id);

          // Set auth — triggers app render with cached data already in React Query
          setAuth(token, user);

          // Fresh avatar (non-blocking)
          try {
            const avatarRes = await studentApi.getAvatar();
            if (avatarRes?.avatarUrl) {
              const updatedUser = { ...user, avatarUrl: avatarRes.avatarUrl };
              await StorageService.setObject(USER_KEY, updatedUser);
              setAuth(token, updatedUser);
            }
          } catch {}

          // Pre-fetch fresh data silently in background (updates cache)
          _prefetchAllData();
        } else {
          clearAuth();
        }
      } catch {
        clearAuth();
      }
    };
    init();
  }, []);

  // App usage time tracking + session refresh on foreground
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    AttendanceService.recordStart();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current === 'active' && nextState.match(/inactive|background/)) {
        AttendanceService.recordEnd();
        // Persist query cache to disk when app goes to background
        const user = useAuthStore.getState().user;
        if (user?.id) persistCache(user.id);
      }
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        AttendanceService.recordStart();
        // Extend session by 1h when user brings app to foreground
        refreshSession();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  // Lock entire app to portrait — video player will unlock to landscape when fullscreen
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthInitializer />
          <StatusBar style="light" backgroundColor={Colors.bg} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="course/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="lesson/[id]" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="enrolled-courses" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="completed-videos" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="achievements" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="streak-history" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="my-report" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="student-progress" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="refer-earn" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="help-support" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="my-purchases" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="ck-mall" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="about-us" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="rate-us" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="downloads" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="offline-player" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="change-password" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="leaderboard" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="watchlist" options={{ animation: 'slide_from_right' }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
