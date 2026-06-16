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
