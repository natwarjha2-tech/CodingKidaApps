import { authApi } from '@/api';
import { StorageService, TOKEN_KEY, USER_KEY, setRememberMe, clearRememberMe, setSession, clearSession } from './storage.service';
import type { LoginPayload, SignupPayload, User } from '@/types';

export const AuthService = {
  login: async (payload: LoginPayload, rememberMe = false): Promise<{ token: string; user: User }> => {
    const data = await authApi.login(payload);
    if (!data.success || !data.token) throw new Error(data.message ?? 'Login failed');
    await StorageService.set(TOKEN_KEY, data.token);
    await StorageService.setObject(USER_KEY, data.user);
    await setSession(); // always set 1h session on login
    if (rememberMe) await setRememberMe();
    else await clearRememberMe();
    return { token: data.token, user: data.user };
  },

  signup: async (payload: SignupPayload): Promise<{ token: string; user: User }> => {
    const data = await authApi.signup(payload);
    if (!data.success || !data.token) throw new Error(data.message ?? 'Signup failed');
    await StorageService.set(TOKEN_KEY, data.token);
    await StorageService.setObject(USER_KEY, data.user);
    await setSession();
    return { token: data.token, user: data.user };
  },

  logout: async (): Promise<void> => {
    await StorageService.delete(TOKEN_KEY);
    await clearSession();
    await clearRememberMe();
  },

  getStoredToken: (): Promise<string | null> => StorageService.get(TOKEN_KEY),

  getStoredUser: (): Promise<User | null> => StorageService.getObject<User>(USER_KEY),
};
