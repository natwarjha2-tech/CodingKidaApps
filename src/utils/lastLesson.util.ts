// Persisted "last opened lesson" for the dashboard Continue-Learning card.
//
// Why: the in-memory zustand lessonContext is lost when the app is killed, so
// Continue-Learning stopped working after the app was closed for a while. We
// persist it (user-scoped, `ck_last_lesson_<userId>`) with a timestamp and keep
// it valid for 15 days — mirroring the desktop `ck_last_lesson` behaviour.
import { StorageService, userScopedKey } from '@/services/storage.service';

const LAST_LESSON_BASE = 'ck_last_lesson';
const MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

export interface LastLesson {
  courseId: string;
  moduleId: string;
  lessonId: string;
  courseTitle: string;
  moduleTitle: string;
  lessonTitle: string;
  savedAt: string; // ISO — used for the 15-day validity window
}

/** Persist the most-recently opened lesson (user-scoped). Fire-and-forget safe. */
export async function saveLastLesson(ctx: Omit<LastLesson, 'savedAt'>): Promise<void> {
  try {
    const key = await userScopedKey(LAST_LESSON_BASE);
    await StorageService.setObject(key, { ...ctx, savedAt: new Date().toISOString() });
  } catch {
    // never crash on persistence
  }
}

/**
 * Read the persisted last lesson if it's still within the 15-day window.
 * Returns null when missing, expired, or unreadable.
 */
export async function getLastLesson(): Promise<LastLesson | null> {
  try {
    const key = await userScopedKey(LAST_LESSON_BASE);
    const saved = await StorageService.getObject<LastLesson>(key);
    if (!saved || !saved.lessonId || !saved.savedAt) return null;
    const age = Date.now() - new Date(saved.savedAt).getTime();
    if (isNaN(age) || age > MAX_AGE_MS) return null; // older than 15 days → ignore
    return saved;
  } catch {
    return null;
  }
}
