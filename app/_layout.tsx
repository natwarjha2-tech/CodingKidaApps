import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store';
import { AuthService } from '@/services';
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
        if (token && user) {
          setAuth(token, user);
        } else {
          clearAuth();
        }
      } catch {
        clearAuth();
      }
    };
    init();
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
            <Stack.Screen name="leaderboard" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="watchlist" options={{ animation: 'slide_from_right' }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
