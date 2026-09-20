import * as SecureStore from 'expo-secure-store';

export const StorageService = {
  set: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key, value);
  },

  get: async (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(key);
  },

  delete: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key);
  },

  setObject: async (key: string, value: object): Promise<void> => {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  },

  getObject: async <T>(key: string): Promise<T | null> => {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
};

export const TOKEN_KEY = 'ck_token';
export const USER_KEY = 'ck_user';

/**
 * Current logged-in user id (from the stored user object). Used to scope
 * per-user local data (downloads, watchlist, last-lesson) so different users on
 * the same device never see each other's content. Returns null if unknown.
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.id ?? null;
  } catch {
    return null;
  }
};

/**
 * Build a user-scoped storage key: `<base>_<userId>` (mirrors desktop's
 * `ck_downloads_<userId>` pattern). Falls back to the plain base key when no
 * user is known (e.g. before login) — never crashes.
 */
export const userScopedKey = async (base: string): Promise<string> => {
  const id = await getCurrentUserId();
  return id ? `${base}_${id}` : base;
};
export const REMEMBER_ME_KEY = 'ck_remember_me_expiry';
export const SESSION_KEY = 'ck_session_expiry';

// Called on every login — sets 1h session expiry
export const setSession = async (): Promise<void> => {
  const expiry = Date.now() + 60 * 60 * 1000; // 1 hour
  await SecureStore.setItemAsync(SESSION_KEY, String(expiry));
};

// Extend session by 1h from now (called on any user action)
export const refreshSession = async (): Promise<void> => {
  const expiry = Date.now() + 60 * 60 * 1000;
  await SecureStore.setItemAsync(SESSION_KEY, String(expiry));
};

export const isSessionValid = async (): Promise<boolean> => {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return false;
  return Date.now() < Number(raw);
};

export const clearSession = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(SESSION_KEY);
};

export const setRememberMe = async (): Promise<void> => {
  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  await SecureStore.setItemAsync(REMEMBER_ME_KEY, String(expiry));
};

export const isRememberMeValid = async (): Promise<boolean> => {
  const raw = await SecureStore.getItemAsync(REMEMBER_ME_KEY);
  if (!raw) return false;
  return Date.now() < Number(raw);
};

export const clearRememberMe = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(REMEMBER_ME_KEY);
};
