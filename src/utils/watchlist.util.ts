// Shared, user-scoped watchlist storage helper — used by the lesson screen
// (save/check) and the Watchlist screen (load/remove) so the key logic lives in
// ONE place (no duplication). Mirrors the desktop per-user watchlist.
import { StorageService, userScopedKey } from '@/services/storage.service';

export const WATCHLIST_BASE = 'ck_watchlist';

export interface WatchlistItem {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  savedAt: string;
}

let _migrated = false;

/**
 * Resolve the current user's watchlist key (`ck_watchlist_<userId>`). One-time,
 * migrates any legacy global `ck_watchlist` into the current user's key so the
 * logged-in user keeps their existing saved lessons.
 */
export async function getWatchlistKey(): Promise<string> {
  const key = await userScopedKey(WATCHLIST_BASE);
  if (!_migrated && key !== WATCHLIST_BASE) {
    _migrated = true;
    const scoped = await StorageService.getObject<WatchlistItem[]>(key);
    if (!scoped) {
      const legacy = await StorageService.getObject<WatchlistItem[]>(WATCHLIST_BASE);
      if (legacy && legacy.length > 0) {
        await StorageService.setObject(key, legacy);
        await StorageService.delete(WATCHLIST_BASE);
      }
    }
  }
  return key;
}

/** Read the current user's watchlist. */
export async function getWatchlist(): Promise<WatchlistItem[]> {
  const key = await getWatchlistKey();
  return (await StorageService.getObject<WatchlistItem[]>(key)) ?? [];
}

/** Write the current user's watchlist. */
export async function setWatchlist(items: WatchlistItem[]): Promise<void> {
  const key = await getWatchlistKey();
  await StorageService.setObject(key, items);
}
