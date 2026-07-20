import { useCallback } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
        const { token, user } = await AuthService.login(payload, rememberMe);

        // Check if different user logged in — clear old cache
        const prevCacheRaw = await AsyncStorage.getItem('ck_qcache_last_user');
        if (prevCacheRaw && prevCacheRaw !== user.id) {
          // Different user — clear previous user's cache
          await AsyncStorage.removeItem('ck_qcache_' + prevCacheRaw);
          queryClient.clear();
        }
        await AsyncStorage.setItem('ck_qcache_last_user', user.id);

        // Fetch fresh avatar
        let finalUser = user;
        try {
          const avatarRes = await studentApi.getAvatar();
          if (avatarRes?.avatarUrl) {
            finalUser = { ...user, avatarUrl: avatarRes.avatarUrl };
            await StorageService.setObject(USER_KEY, finalUser);
          }
        } catch {}

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
        queryClient.clear(); // New user — always fresh
        const { token, user } = await AuthService.signup(payload);
        await AsyncStorage.setItem('ck_qcache_last_user', user.id);
        setAuth(token, user);
        router.replace('/(tabs)/dashboard');
      } finally {
        setLoading(false);
      }
    },
    [setAuth, setLoading, queryClient]
  );

  const logout = useCallback(async () => {
    // Keep query cache on disk — will be restored if same user logs back in
    // Only clear in-memory cache (components will re-render from disk on next login)
    await AuthService.logout();
    clearAuth();
    router.replace('/(auth)/login');
  }, [clearAuth]);

  return { token, user, isAuthenticated, isLoading, login, signup, logout };
};
