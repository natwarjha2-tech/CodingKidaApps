import { apiClient } from './client';
import type { AuthResponse, LoginPayload, SignupPayload } from '@/types';
import { getDeviceInfo } from '@/services/device.service';

export const authApi = {
  /** `replaceDevice` = the student confirmed "use this phone instead" (device limit). */
  login: async (payload: LoginPayload, replaceDevice = false) => {
    const device = await getDeviceInfo();
    return apiClient
      .post<AuthResponse>('/api/auth/login', { ...payload, device, replaceDevice })
      .then((r) => r.data);
  },

  signup: async (payload: SignupPayload) => {
    const device = await getDeviceInfo();
    return apiClient.post<AuthResponse>('/api/auth/signup', { ...payload, device }).then((r) => r.data);
  },

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient
      .post('/api/auth/change-password', { currentPassword, newPassword })
      .then((r) => r.data),

  forgotPassword: (email: string) =>
    apiClient.post('/api/auth/forgot-password', { email }).then((r) => r.data),

  // Passwordless email OTP login (mirrors desktop)
  sendOtp: (email: string) =>
    apiClient
      .post<{ success: boolean; message?: string }>('/api/auth/send-otp', { email })
      .then((r) => r.data),

  verifyOtp: async (email: string, otp: string, replaceDevice = false) => {
    const device = await getDeviceInfo();
    return apiClient
      .post<AuthResponse>('/api/auth/verify-otp', { email, otp, device, replaceDevice })
      .then((r) => r.data);
  },

  /**
   * App start with a saved sign-in: confirms this phone is still the student's
   * phone. May return a new token (older sign-ins get tied to this phone).
   */
  checkDevice: async () => {
    const device = await getDeviceInfo();
    return apiClient
      .post<{ success: boolean; token?: string }>('/api/auth/device', { device })
      .then((r) => r.data);
  },
};
