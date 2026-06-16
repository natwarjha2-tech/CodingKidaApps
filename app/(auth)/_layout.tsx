import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '@/store';
import { Colors } from '@/theme';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
