import { apiClient } from './client';
import type { AuthResponse, LoginPayload, SignupPayload } from '@/types';

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<AuthResponse>('/api/auth/login', payload).then((r) => r.data),

  signup: (payload: SignupPayload) =>
    apiClient.post<AuthResponse>('/api/auth/signup', payload).then((r) => r.data),

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

  verifyOtp: (email: string, otp: string) =>
    apiClient
      .post<AuthResponse>('/api/auth/verify-otp', { email, otp })
      .then((r) => r.data),
};
