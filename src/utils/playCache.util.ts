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
  /** Media id (used to scope HLS cookie auth). Null when the lesson has no media. */
  mediaId?: string | null;
  /** Stable CloudFront HLS master-playlist URL, present only when HLS is ready
   *  AND CloudFront is configured; null otherwise. The client still needs the
   *  signed cookies from getLessonHlsAuth before it can actually fetch it. */
  hlsMasterUrl?: string | null;
  /** 'none' | 'processing' | 'ready' | 'failed' — HLS pipeline state for the media. */
  hlsStatus?: string;
};

type Entry = { at: number; data: PlayData };

const TTL_MS = 45 * 60 * 1000; // 45 min (presigned URLs last 60; 15-min buffer)

const _playCache: Record<string, Entry> = {};

// ── HLS auth (CloudFront signed cookies) cache ──────────────────────────────
// The server issues cookies valid for 4h, so reusing them for 3h is safe. This
// is what lets "Next lesson" skip the extra /hls-auth round trip: the next
// lesson's cookies are fetched in the background while the current one plays.
export type HlsAuthData = {
  masterUrl: string;
  cookies: {
    'CloudFront-Policy': string;
    'CloudFront-Signature': string;
    'CloudFront-Key-Pair-Id': string;
  };
};
const HLS_AUTH_TTL_MS = 3 * 60 * 60 * 1000; // 3h (cookies last 4h)
const _hlsAuthCache: Record<string, { at: number; data: HlsAuthData }> = {};

export function getHlsAuthCache(lessonId: string): HlsAuthData | null {
  const hit = _hlsAuthCache[lessonId];
  if (hit && Date.now() - hit.at < HLS_AUTH_TTL_MS) return hit.data;
  return null;
}

export function setHlsAuthCache(lessonId: string, data: HlsAuthData): void {
  _hlsAuthCache[lessonId] = { at: Date.now(), data };
}

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
    delete _hlsAuthCache[lessonId];
    return;
  }
  for (const k of Object.keys(_playCache)) delete _playCache[k];
  for (const k of Object.keys(_hlsAuthCache)) delete _hlsAuthCache[k];
}
