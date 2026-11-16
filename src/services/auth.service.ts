import { authApi } from '@/api';
import { StorageService, TOKEN_KEY, USER_KEY, setRememberMe, clearRememberMe, setSession, clearSession } from './storage.service';
import type { LoginPayload, SignupPayload, User } from '@/types';

/** Begin measuring learning time for the student who just signed in. */
function startAttendance(): void {
  import('./attendance.service').then((m) => m.AttendanceService.recordStart()).catch(() => {});
}

export const AuthService = {
  login: async (payload: LoginPayload, rememberMe = false, replaceDevice = false): Promise<{ token: string; user: User }> => {
    const data = await authApi.login(payload, replaceDevice);
    if (!data.success || !data.token) throw new Error(data.message ?? 'Login failed');
    await StorageService.set(TOKEN_KEY, data.token);
    await StorageService.setObject(USER_KEY, data.user);
    await setSession(); // always set 1h session on login
    startAttendance();
    if (rememberMe) await setRememberMe();
    else await clearRememberMe();
    return { token: data.token, user: data.user };
  },

  // Establish a session from an already-obtained token+user (e.g. OTP login).
  loginWithToken: async (token: string, user: User, rememberMe = false): Promise<void> => {
    await StorageService.set(TOKEN_KEY, token);
    await StorageService.setObject(USER_KEY, user);
    await setSession();
    startAttendance();
    if (rememberMe) await setRememberMe();
    else await clearRememberMe();
  },

  signup: async (payload: SignupPayload): Promise<{ token: string; user: User }> => {
    const data = await authApi.signup(payload);
    if (!data.success || !data.token) throw new Error(data.message ?? 'Signup failed');
    await StorageService.set(TOKEN_KEY, data.token);
    await StorageService.setObject(USER_KEY, data.user);
    await setSession();
    startAttendance();
    return { token: data.token, user: data.user };
  },

  logout: async (): Promise<void> => {
    // Send this student's learning time while the token is still valid.
    try {
      const { AttendanceService } = await import('./attendance.service');
      await AttendanceService.recordEnd();
    } catch { /* never block logout */ }
    await StorageService.delete(TOKEN_KEY);
    await clearSession();
    await clearRememberMe();
  },

  getStoredToken: (): Promise<string | null> => StorageService.get(TOKEN_KEY),

  getStoredUser: (): Promise<User | null> => StorageService.getObject<User>(USER_KEY),
};
