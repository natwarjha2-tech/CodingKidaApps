import { authApi } from '@/api';
import { StorageService, TOKEN_KEY, USER_KEY } from './storage.service';
import type { LoginPayload, SignupPayload, User } from '@/types';

export const AuthService = {
  login: async (payload: LoginPayload): Promise<{ token: string; user: User }> => {
    const data = await authApi.login(payload);
    if (!data.success || !data.token) throw new Error(data.message ?? 'Login failed');
    await StorageService.set(TOKEN_KEY, data.token);
    await StorageService.setObject(USER_KEY, data.user);
    return { token: data.token, user: data.user };
  },

  signup: async (payload: SignupPayload): Promise<{ token: string; user: User }> => {
    const data = await authApi.signup(payload);
    if (!data.success || !data.token) throw new Error(data.message ?? 'Signup failed');
    await StorageService.set(TOKEN_KEY, data.token);
    await StorageService.setObject(USER_KEY, data.user);
    return { token: data.token, user: data.user };
  },

  logout: async (): Promise<void> => {
    await StorageService.delete(TOKEN_KEY);
    await StorageService.delete(USER_KEY);
  },

  getStoredToken: (): Promise<string | null> => StorageService.get(TOKEN_KEY),

  getStoredUser: (): Promise<User | null> => StorageService.getObject<User>(USER_KEY),
};
