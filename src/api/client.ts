import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://www.codingkida.com';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/** Error thrown by the API client. `code` is set for device-limit errors etc. */
export interface ApiError extends Error {
  status?: number;
  code?: string;
  data?: Record<string, unknown>;
}

// Called when the server says this device was signed out (device limit) or the
// app must be updated. Registered by the root layout.
type SignedOutHandler = (code: string, message: string) => void;
let _signedOutHandler: SignedOutHandler | null = null;
export function setSignedOutHandler(fn: SignedOutHandler | null): void {
  _signedOutHandler = fn;
}

// Request interceptor — auto attach JWT token
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('ck_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 globally
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status: number | undefined = error.response?.status;
    const data = (error.response?.data ?? {}) as Record<string, unknown>;
    const code = typeof data.code === 'string' ? data.code : undefined;
    if (status === 401) {
      await SecureStore.deleteItemAsync('ck_token');
      await SecureStore.deleteItemAsync('ck_user');
    }
    const message =
      (data.message as string) ||
      (data.error as string) ||
      error.message ||
      'Something went wrong';
    if (status === 401 && (code === 'DEVICE_REVOKED' || code === 'APP_UPDATE_REQUIRED' || code === 'ACCOUNT_DELETED')) {
      try { _signedOutHandler?.(code, message); } catch { /* ignore */ }
    }
    const err: ApiError = Object.assign(new Error(message), { status, code, data });
    return Promise.reject(err);
  }
);
