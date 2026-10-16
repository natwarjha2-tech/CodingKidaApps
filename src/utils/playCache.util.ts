/**
 * In-memory cache of the signed "play" data per lesson.
 *
 * Presigned S3 URLs are valid ~60 min, so a lesson's signed video + quality
 * URLs are reused within a 45-min window to avoid a re-sign network call and
 * replay instantly. The cache is a module-level singleton (survives lesson
 * screen re-mounts within a session), keyed by lessonId.
 *
 * It lives in its OWN module (not inside the lesson screen) so the global
 * Refresh action (useRefreshAll) can clear it — React Query's invalidateQueries
 * does NOT touch this plain object, so without an explicit clear a stale entry
 * (e.g. a lesson opened while its video was still processing → empty
 * qualityUrls) would persist for the full TTL even after tapping Refresh.
 */
export type PlayData = {
  videoUrl: string;
  qualityUrls: Record<string, string>;
  hlsQualities: string[];
  notes?: string;
};

type Entry = { at: number; data: PlayData };

const TTL_MS = 45 * 60 * 1000; // 45 min (presigned URLs last 60; 15-min buffer)

const _playCache: Record<string, Entry> = {};

/** Return cached play data for a lesson if present AND still within the TTL. */
export function getPlayCache(lessonId: string): PlayData | null {
  const hit = _playCache[lessonId];
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  return null;
}

/** Store play data for a lesson (stamped with the current time). */
export function setPlayCache(lessonId: string, data: PlayData): void {
  _playCache[lessonId] = { at: Date.now(), data };
}

/**
 * Clear the play cache. With no argument, wipes EVERY lesson's cached play data
 * (used by the global Refresh so stale video/quality URLs are re-fetched). With
 * a lessonId, clears just that one entry.
 */
export function clearPlayCache(lessonId?: string): void {
  if (lessonId) {
    delete _playCache[lessonId];
    return;
  }
  for (const k of Object.keys(_playCache)) delete _playCache[k];
}
