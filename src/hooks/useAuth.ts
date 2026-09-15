import { useCallback } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store';
import { AuthService } from '@/services';
import { StorageService, USER_KEY } from '@/services/storage.service';
import { studentApi, authApi } from '@/api';
import { deregisterDevice, clearNotifState } from '@/services/notification.service';
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

  // Passwordless OTP login: verify OTP → establish session → go to dashboard.
  // Reuses the same post-login flow as password login (cache isolation + avatar).
  const loginWithOtp = useCallback(
    async (email: string, otp: string, rememberMe = true) => {
      setLoading(true);
      try {
        const data = await authApi.verifyOtp(email, otp);
        if (!data.success || !data.token) throw new Error(data.message ?? 'Invalid OTP.');
        const user = data.user;

        await AuthService.loginWithToken(data.token, user, rememberMe);

        // Different-user cache isolation (same as password login)
        const prevCacheRaw = await AsyncStorage.getItem('ck_qcache_last_user');
        if (prevCacheRaw && prevCacheRaw !== user.id) {
          await AsyncStorage.removeItem('ck_qcache_' + prevCacheRaw);
          queryClient.clear();
        }
        await AsyncStorage.setItem('ck_qcache_last_user', user.id);

        // Fresh avatar (non-blocking)
        let finalUser = user;
        try {
          const avatarRes = await studentApi.getAvatar();
          if (avatarRes?.avatarUrl) {
            finalUser = { ...user, avatarUrl: avatarRes.avatarUrl };
            await StorageService.setObject(USER_KEY, finalUser);
          }
        } catch {}

        setAuth(data.token, finalUser);
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
    // Deactivate device push token + clear notification sync state (non-blocking)
    deregisterDevice().catch(() => {});
    clearNotifState().catch(() => {});
    // Keep query cache on disk — will be restored if same user logs back in
    // Only clear in-memory cache (components will re-render from disk on next login)
    await AuthService.logout();
    clearAuth();
    router.replace('/(auth)/login');
  }, [clearAuth]);

  return { token, user, isAuthenticated, isLoading, login, loginWithOtp, signup, logout };
};
