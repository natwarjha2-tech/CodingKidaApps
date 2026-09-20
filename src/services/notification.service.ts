/**
 * CodingKida Mobile — Notification Service
 * 
 * Handles:
 * 1. Push token registration (Expo Push Token → backend /api/devices/register)
 * 2. In-app notification sync from server (/api/notifications)
 * 3. Notification permission requests
 * 4. Foreground/background notification handling
 * 
 * Architecture:
 * - Push = lightweight alert only (not data source)
 * - On push received → sync from server for authoritative data
 * - DB on server is source of truth
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/api';

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const DEVICE_ID_KEY = 'ck_device_id';
const NOTIF_CURSOR_KEY = 'ck_notif_cursor';
const NOTIF_CACHE_KEY = 'ck_notif_cache';

// ═══════════════════════════════════════════════════════
// FOREGROUND NOTIFICATION BEHAVIOR
// Sets how notifications appear when app is in foreground
// ═══════════════════════════════════════════════════════

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ═══════════════════════════════════════════════════════
// DEVICE ID (stable identifier per app install)
// ═══════════════════════════════════════════════════════

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;

    // Generate a stable device ID using device info
    const generated =
      (Constants.deviceId ||
        Device.modelId ||
        `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await AsyncStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `${Platform.OS}-${Date.now()}`;
  }
}

// ═══════════════════════════════════════════════════════
// PUSH TOKEN REGISTRATION
// ═══════════════════════════════════════════════════════

/**
 * Request notification permissions and register push token with backend.
 * Safe to call multiple times — upserts on backend.
 * Must be called after user is authenticated.
 */
export async function registerPushToken(): Promise<void> {
  try {
    // Only physical devices can receive push notifications
    if (!Device.isDevice) return;

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      // User denied — no push, but in-app sync still works
      return;
    }

    // Android: create notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'CodingKida',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7c3aed',
        sound: 'default',
      });
    }

    // Get Expo Push Token
    let pushToken: string | undefined;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId,
      });
      pushToken = tokenData.data;
    } catch {
      // Token fetch failed (e.g., no EAS project ID in dev) — register device without push token
      // In-app sync still works
    }

    const deviceId = await getOrCreateDeviceId();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    // Register with backend
    await apiClient.post('/api/devices/register', {
      platform,
      pushToken: pushToken || null,
      deviceId,
    });
  } catch {
    // Silent fail — notification registration should not block app
  }
}

/**
 * Deactivate device token on logout.
 */
export async function deregisterDevice(): Promise<void> {
  try {
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) return;
    await apiClient.delete('/api/devices/register', { data: { deviceId } });
  } catch {}
}

// ═══════════════════════════════════════════════════════
// NOTIFICATION SYNC (Cursor-based)
// ═══════════════════════════════════════════════════════

export interface NotifItem {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  action: { type: string; target: string } | null;
  read: boolean;
  createdAt: string;
}

export interface NotifSyncResult {
  items: NotifItem[];
  nextCursor: string | null;
  unreadCount: number;
}

/**
 * Sync notifications from server.
 *
 * IMPORTANT: This always fetches the FULL latest list (top `limit`), never an
 * incremental "after cursor" slice. The previous cursor-based approach advanced
 * the cursor to `now()` on every open and then overwrote the cache with the
 * server's (empty) "items newer than cursor" response — which made all
 * notifications disappear on the second open. The notification list is small,
 * so a full refresh each time is correct, simple, and bug-free. The cache is
 * replaced with the authoritative full list for instant/offline render.
 */
export async function syncNotifications(): Promise<NotifSyncResult> {
  try {
    const res = await apiClient.post('/api/notifications', { action: 'sync', limit: 30 });
    const data = res.data;

    if (data.success) {
      const items: NotifItem[] = data.items || [];
      // Replace the cache with the full authoritative list.
      await AsyncStorage.setItem(NOTIF_CACHE_KEY, JSON.stringify(items));
      return {
        items,
        nextCursor: data.nextCursor || null,
        unreadCount: data.unreadCount || 0,
      };
    }
  } catch {}

  // Fallback: return cached data (offline / request failed).
  try {
    const cached = await AsyncStorage.getItem(NOTIF_CACHE_KEY);
    const items: NotifItem[] = cached ? JSON.parse(cached) : [];
    const unreadCount = items.filter(n => !n.read).length;
    return { items, nextCursor: null, unreadCount };
  } catch {
    return { items: [], nextCursor: null, unreadCount: 0 };
  }
}

/**
 * Read the locally cached notifications synchronously-ish (for React Query
 * initialData → instant first render, no spinner). Never throws.
 */
export async function getCachedNotifications(): Promise<NotifItem[]> {
  try {
    const cached = await AsyncStorage.getItem(NOTIF_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

/**
 * Get unread count (lightweight).
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const res = await apiClient.post('/api/notifications', { action: 'unread-count' });
    return res.data?.unreadCount || 0;
  } catch {
    // Fallback: count from cache
    try {
      const cached = await AsyncStorage.getItem(NOTIF_CACHE_KEY);
      const items: NotifItem[] = cached ? JSON.parse(cached) : [];
      return items.filter(n => !n.read).length;
    } catch { return 0; }
  }
}

// ═══════════════════════════════════════════════════════
// CRUD OPERATIONS
// ═══════════════════════════════════════════════════════

export async function markNotifAsRead(notifId: string): Promise<void> {
  try {
    await apiClient.post('/api/notifications', { action: 'mark-read', id: notifId });
  } catch {}
}

export async function markAllNotifsAsRead(): Promise<void> {
  try {
    await apiClient.post('/api/notifications', { action: 'mark-all-read' });
  } catch {}
}

export async function deleteNotif(notifId: string): Promise<void> {
  try {
    await apiClient.post('/api/notifications', { action: 'delete', id: notifId });
  } catch {}
}

export async function clearAllNotifs(): Promise<void> {
  try {
    await apiClient.post('/api/notifications', { action: 'clear-all' });
    await AsyncStorage.removeItem(NOTIF_CACHE_KEY);
  } catch {}
}

// ═══════════════════════════════════════════════════════
// DEEP LINK / ACTION HANDLER
// ═══════════════════════════════════════════════════════

/**
 * Navigate to the correct screen based on notification action.
 * Returns an expo-router compatible path string.
 * Returns null if no valid route found.
 */
export function resolveNotifRoute(
  action: { type: string; target: string } | null,
  type?: string
): string | null {
  if (!action || !action.target) {
    // Fallback by notification type when action is missing
    if (type === 'achievement' || type === 'weekly_streak') return '/achievements';
    if (type === 'course_enrolled' || type === 'new_course') return '/enrolled-courses';
    if (type === 'payment_failed') return '/my-purchases';
    if (type === 'leaderboard_winner') return '/leaderboard';
    return null;
  }

  const target = action.target;

  // Course detail: /courses/<courseId>
  if (target.startsWith('/courses/') && target.length > 9) {
    const courseId = target.replace('/courses/', '').split('/')[0];
    if (courseId) return `/course/${courseId}`;
  }

  // Achievements page
  if (target === '/achievements') return '/achievements';

  // Leaderboard
  if (target === '/leaderboard' || target === '/coding') return '/leaderboard';

  // Purchases / Orders
  if (target === '/orders' || target === '/my-purchases') return '/my-purchases';

  // Courses list
  if (target === '/courses') return '/enrolled-courses';

  // Student progress
  if (target === '/student-progress') return '/student-progress';

  // Direct path passthrough (already valid expo-router path)
  if (target.startsWith('/')) return target;

  return null;
}

/**
 * Clear notification sync cursor (on logout — next login does full sync).
 */
export async function clearNotifState(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([NOTIF_CURSOR_KEY, NOTIF_CACHE_KEY]);
  } catch {}
}

// ═══════════════════════════════════════════════════════
// LOCAL (CLIENT-SIDE) NOTIFICATIONS
// For device-local events that never touch the server
// (e.g., "download expiring soon"). Uses expo-notifications
// to show a local alert immediately.
// ═══════════════════════════════════════════════════════

/**
 * Present a local (client-side) notification immediately.
 * Safe: silently no-ops if permissions are missing.
 */
export async function presentLocalNotification(opts: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.title,
        body: opts.body,
        data: opts.data || {},
        sound: 'default',
      },
      trigger: null, // present immediately
    });
  } catch {
    // Silent — local notification failure must never crash the app
  }
}
