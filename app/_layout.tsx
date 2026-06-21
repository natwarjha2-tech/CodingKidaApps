import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store';
import { AuthService, AttendanceService } from '@/services';
import { isRememberMeValid, isSessionValid, refreshSession, StorageService, USER_KEY } from '@/services/storage.service';
import { studentApi } from '@/api';
import { Colors } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 * 2 },
  },
});

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
          // Set auth immediately so app loads fast
          setAuth(token, user);
          // Always fetch fresh presigned avatar URL
          try {
            const avatarRes = await studentApi.getAvatar();
            if (avatarRes?.avatarUrl) {
              const updatedUser = { ...user, avatarUrl: avatarRes.avatarUrl };
              await StorageService.setObject(USER_KEY, updatedUser);
              setAuth(token, updatedUser);
            }
          } catch {
            // Avatar fetch fail — still logged in with cached avatar
          }
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
            <Stack.Screen name="refer-earn" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="help-support" options={{ animation: 'slide_from_right' }} />
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
