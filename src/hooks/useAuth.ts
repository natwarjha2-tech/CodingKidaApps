import { useCallback } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { AuthService } from '@/services';
import { StorageService, USER_KEY } from '@/services/storage.service';
import { studentApi } from '@/api';
import type { LoginPayload, SignupPayload } from '@/types';

export const useAuth = () => {
  const { token, user, isAuthenticated, isLoading, setAuth, clearAuth, setLoading } =
    useAuthStore();
  const queryClient = useQueryClient();

  const login = useCallback(
    async (payload: LoginPayload, rememberMe = false) => {
      setLoading(true);
      try {
        queryClient.clear();
        const { token, user } = await AuthService.login(payload, rememberMe);
        // Login response already has presigned avatarUrl from backend
        // But fetch fresh one to guarantee it's valid
        let finalUser = user;
        try {
          const avatarRes = await studentApi.getAvatar();
          if (avatarRes?.avatarUrl) {
            finalUser = { ...user, avatarUrl: avatarRes.avatarUrl };
            // Save updated user with fresh presigned URL to SecureStore
            await StorageService.setObject(USER_KEY, finalUser);
          }
        } catch {
          // Avatar fetch fail — login still works with URL from login response
        }
        setAuth(token, finalUser);
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
    queryClient.clear();
    await AuthService.logout();
    clearAuth();
    router.replace('/(auth)/login');
  }, [clearAuth, queryClient]);

  return { token, user, isAuthenticated, isLoading, login, signup, logout };
};
