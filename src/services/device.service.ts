import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { StorageService } from './storage.service';

/**
 * This phone's identity for the device limit (1 phone + 1 computer per student).
 *
 * - Android: the id comes from the Android ID. It stays the same when the app is
 *   reinstalled or its data is cleared, so a student is not locked out of their
 *   own phone. It changes only on a factory reset (or a new phone), which needs
 *   support to unlink the old phone.
 * - iPhone: a random id is created once and kept in the Keychain (secure
 *   storage), which survives a reinstall.
 * - Fallback (no Android ID available): the same stored random id.
 */
const INSTALL_ID_KEY = 'ck_install_id';

export interface DeviceInfo {
  id: string;
  kind: 'mobile';
  name: string;
  platform: string;
  appVersion: string;
}

let _cached: DeviceInfo | null = null;

function randomId(): string {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i++) s += hex[Math.floor(Math.random() * 16)];
  return `m-${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  if (_cached) return _cached;
  let id: string | null = null;
  if (Platform.OS === 'android') {
    try {
      const androidId = Application.getAndroidId();
      if (androidId && /^[A-Za-z0-9]{8,64}$/.test(androidId)) id = `a-${androidId}`;
    } catch { /* fall back to the stored id */ }
  }
  if (!id) {
    id = await StorageService.get(INSTALL_ID_KEY).catch(() => null);
    if (!id || id.length < 8) {
      id = randomId();
      await StorageService.set(INSTALL_ID_KEY, id).catch(() => {});
    }
  }
  const model = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ').trim() || 'Phone';
  const os = [Device.osName, Device.osVersion].filter(Boolean).join(' ');
  _cached = {
    id,
    kind: 'mobile',
    name: (os ? `${model} (${os})` : model).slice(0, 80),
    platform: Platform.OS,
    appVersion: String(Constants.expoConfig?.version ?? ''),
  };
  return _cached;
}
