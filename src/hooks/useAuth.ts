import { useCallback } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { AuthService } from '@/services';
import type { LoginPayload, SignupPayload } from '@/types';

export const useAuth = () => {
  const { token, user, isAuthenticated, isLoading, setAuth, clearAuth, setLoading } =
    useAuthStore();
  const queryClient = useQueryClient();

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true);
      try {
        // Clear previous user's cached data before login
        queryClient.clear();
        const { token, user } = await AuthService.login(payload);
        setAuth(token, user);
        router.replace('/(tabs)/dashboard');
      } finally {
        setLoading(false);
      }
    },
    [setAuth, setLoading, queryClient]
  );

  const signup = useCallback(
    async (payload: SignupPayload) => {
      setLoading(true);
      try {
        queryClient.clear();
        const { token, user } = await AuthService.signup(payload);
        setAuth(token, user);
        router.replace('/(tabs)/dashboard');
      } finally {
        setLoading(false);
      }
    },
    [setAuth, setLoading]
  );

  const logout = useCallback(async () => {
    queryClient.clear(); // Remove all cached data from previous session
    await AuthService.logout();
    clearAuth();
    router.replace('/(auth)/login');
  }, [clearAuth, queryClient]);

  return { token, user, isAuthenticated, isLoading, login, signup, logout };
};
