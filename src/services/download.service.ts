import * as FileSystem from 'expo-file-system/legacy';
import { mediaApi } from '@/api';
import { StorageService, userScopedKey, getCurrentUserId } from './storage.service';
import { presentLocalNotification } from './notification.service';

const DOWNLOADS_BASE = 'ck_downloads';
const DOWNLOAD_EXPIRY_NOTIFIED_BASE = 'ck_download_expiry_notified'; // de-dupe set
const EXPIRY_WARN_DAYS = 3; // notify when <= 3 days left

// Per-user storage keys (mirrors desktop `ck_downloads_<userId>`) so different
// users on the same device never see each other's downloads. A one-time
// migration moves any legacy global `ck_downloads` into the current user's key.
let _migratedForUser: string | null = null;
async function downloadsKey(): Promise<string> {
  const key = await userScopedKey(DOWNLOADS_BASE);
  // One-time: if the scoped key is empty but a legacy global key has data, move it.
  const userId = await getCurrentUserId();
  if (userId && _migratedForUser !== userId && key !== DOWNLOADS_BASE) {
    _migratedForUser = userId;
    const scoped = await StorageService.getObject<DownloadItem[]>(key);
    if (!scoped) {
      const legacy = await StorageService.getObject<DownloadItem[]>(DOWNLOADS_BASE);
      if (legacy && legacy.length > 0) {
        await StorageService.setObject(key, legacy);
        await StorageService.delete(DOWNLOADS_BASE);
      }
    }
  }
  return key;
}
async function notifiedKey(): Promise<string> {
  return userScopedKey(DOWNLOAD_EXPIRY_NOTIFIED_BASE);
}

export interface DownloadItem {
  id: string; // lessonId + type
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  type: 'video' | 'pdf';
  fileUri: string;
  originalUrl: string;
  downloadedAt: string;
  expiresAt: string; // 30 days from download
  fileSize?: number;
  quality?: string; // selected video quality (e.g. "720p", "480p", "Original")
  /** 'hls' = fileUri is a local index.m3u8 inside a per-lesson folder of
   *  segments (offline HLS). Undefined / 'mp4' = single file (legacy / PDF). */
  format?: 'mp4' | 'hls';
}

/** Delete a download's files: the whole segment folder for HLS, else the file. */
async function deleteItemFiles(item: DownloadItem): Promise<void> {
  try {
    if (item.format === 'hls') {
      const dir = item.fileUri.substring(0, item.fileUri.lastIndexOf('/') + 1);
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) await FileSystem.deleteAsync(dir, { idempotent: true });
    } else {
      const info = await FileSystem.getInfoAsync(item.fileUri);
      if (info.exists) await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
    }
  } catch {}
}

/** Fetch a small text file (playlist) with the CloudFront cookie header. */
async function fetchText(url: string, cookieHeader: string): Promise<string> {
  const res = await fetch(url, { headers: cookieHeader ? { Cookie: cookieHeader } : {} });
  if (!res.ok) throw new Error(`HTTP ${res.status} while fetching playlist`);
  return res.text();
}

async function getSignedUrl(url: string): Promise<string> {
  // If already signed, return as-is
  if (url.includes('X-Amz-Signature')) return url;
  // If not S3, return as-is
  if (!url.includes('amazonaws.com')) return url;
  // Get signed URL from backend
  const res = await mediaApi.getSignedUrl(url);
  if (res.success && res.signedUrl) return res.signedUrl;
  throw new Error('Failed to get signed URL');
}

export const DownloadService = {
  /**
   * Download a file (video or PDF) with proper signed URL handling
   */
  download: async (params: {
    lessonId: string;
    lessonTitle: string;
    moduleTitle: string;
    courseId: string;
    courseTitle: string;
    type: 'video' | 'pdf';
    url: string;
    quality?: string; // selected video quality (optional; defaults to Original)
  }): Promise<DownloadItem> => {
    const { lessonId, lessonTitle, moduleTitle, courseId, courseTitle, type, url, quality } = params;

    // 1. Get signed URL
    const signedUrl = await getSignedUrl(url);

    // 2. Create file path
    const ext = type === 'video' ? 'mp4' : 'pdf';
    const filename = `${courseId}_${lessonId}_${type}.${ext}`;
    const fileUri = FileSystem.documentDirectory + 'downloads/' + filename;

    // 3. Ensure downloads directory exists
    const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory + 'downloads/');
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'downloads/', { intermediates: true });
    }

    // 4. Download file
    const downloadResult = await FileSystem.downloadAsync(signedUrl, fileUri);

    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }

    // 5. Get file info
    const fileInfo = await FileSystem.getInfoAsync(fileUri);

    // 6. Create download record
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const item: DownloadItem = {
      id: `${lessonId}_${type}`,
      lessonId,
      lessonTitle,
      moduleTitle,
      courseId,
      courseTitle,
      type,
      fileUri,
      originalUrl: url,
      downloadedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      fileSize: fileInfo.exists ? (fileInfo as any).size : undefined,
      quality: type === 'video' ? (quality || 'Original') : undefined,
    };

    // 7. Save to storage (user-scoped)
    const existing = await DownloadService.getAll();
    const filtered = existing.filter((d) => d.id !== item.id); // Replace if exists
    await StorageService.setObject(await downloadsKey(), [...filtered, item]);

    return item;
  },

  /**
   * Download ONE quality of an HLS lesson for offline playback (no MP4 needed).
   *
   * Flow: master.m3u8 → pick variant (variants sorted by BANDWIDTH desc, so
   * qualityIndex 0 = 720p … last = 360p, independent of file order) → variant
   * playlist → download init + every segment (with the CloudFront cookie) into
   * downloads/hls_<courseId>_<lessonId>/ → write a local index.m3u8 that
   * references the segments by file name. ExoPlayer plays that file directly.
   */
  downloadHls: async (params: {
    lessonId: string;
    lessonTitle: string;
    moduleTitle: string;
    courseId: string;
    courseTitle: string;
    masterUrl: string;
    cookieHeader: string;
    qualityIndex: number; // position in the BANDWIDTH-desc list (0 = best)
    qualityLabel: string; // e.g. "720p"
    onProgress?: (done: number, total: number) => void;
  }): Promise<DownloadItem> => {
    const {
      lessonId, lessonTitle, moduleTitle, courseId, courseTitle,
      masterUrl, cookieHeader, qualityIndex, qualityLabel, onProgress,
    } = params;

    const baseDir = FileSystem.documentDirectory + 'downloads/';
    const dirUri = baseDir + `hls_${courseId}_${lessonId}/`;

    try {
      // Fresh folder (a previous partial/other-quality download is replaced).
      await FileSystem.deleteAsync(dirUri, { idempotent: true });
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });

      // 1. Master → variants with bandwidth, sorted best → lowest.
      const masterText = await fetchText(masterUrl, cookieHeader);
      const mLines = masterText.split('\n').map((l) => l.trim()).filter(Boolean);
      const variants: { url: string; bandwidth: number }[] = [];
      for (let i = 0; i < mLines.length; i++) {
        if (mLines[i].startsWith('#EXT-X-STREAM-INF')) {
          const next = mLines[i + 1];
          if (next && !next.startsWith('#')) {
            const bw = mLines[i].match(/BANDWIDTH=(\d+)/);
            variants.push({ url: next, bandwidth: bw ? parseInt(bw[1], 10) : 0 });
          }
        }
      }
      if (variants.length === 0) throw new Error('No video variants found.');
      variants.sort((a, b) => b.bandwidth - a.bandwidth);
      const chosen = variants[Math.min(Math.max(qualityIndex, 0), variants.length - 1)];

      const masterBase = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
      const variantAbs = chosen.url.startsWith('http') ? chosen.url : masterBase + chosen.url;
      const variantBase = variantAbs.substring(0, variantAbs.lastIndexOf('/') + 1);
      const resolve = (rel: string) => (rel.startsWith('http') ? rel : variantBase + rel);

      // 2. Variant playlist → list of files (init + segments).
      const variantText = await fetchText(variantAbs, cookieHeader);
      const vLines = variantText.split('\n').map((l) => l.trim());
      const files: { remote: string; local: string }[] = [];
      const localLines: string[] = [];
      for (const line of vLines) {
        if (line.startsWith('#EXT-X-MAP:')) {
          const m = line.match(/URI="([^"]+)"/);
          if (m) {
            const name = m[1].split('/').pop() as string;
            files.push({ remote: resolve(m[1]), local: name });
            localLines.push(line.replace(m[1], name));
            continue;
          }
        }
        if (line && !line.startsWith('#')) {
          const name = line.split('?')[0].split('/').pop() as string;
          files.push({ remote: resolve(line), local: name });
          localLines.push(name);
        } else {
          localLines.push(line);
        }
      }
      if (files.length === 0) throw new Error('No video segments found.');

      // 3. Download all segments (small parallel batches, with the cookie).
      let done = 0;
      let totalBytes = 0;
      const BATCH = 4;
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        await Promise.all(batch.map(async (f) => {
          const dest = dirUri + f.local;
          const r = await FileSystem.downloadAsync(f.remote, dest, {
            headers: cookieHeader ? { Cookie: cookieHeader } : {},
          });
          if (r.status !== 200) throw new Error(`Segment download failed (${r.status})`);
          const info = await FileSystem.getInfoAsync(dest);
          if (info.exists) totalBytes += (info as any).size ?? 0;
          done += 1;
          onProgress?.(done, files.length);
        }));
      }

      // 4. Local playlist the player opens offline.
      const fileUri = dirUri + 'index.m3u8';
      await FileSystem.writeAsStringAsync(fileUri, localLines.join('\n'));

      const now = new Date();
      const item: DownloadItem = {
        id: `${lessonId}_video`,
        lessonId, lessonTitle, moduleTitle, courseId, courseTitle,
        type: 'video',
        fileUri,
        originalUrl: masterUrl,
        downloadedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        fileSize: totalBytes,
        quality: qualityLabel,
        format: 'hls',
      };

      const existing = await DownloadService.getAll();
      const filtered = existing.filter((d) => d.id !== item.id);
      await StorageService.setObject(await downloadsKey(), [...filtered, item]);
      return item;
    } catch (err) {
      // Never leave a half-downloaded folder behind.
      await FileSystem.deleteAsync(dirUri, { idempotent: true }).catch(() => {});
      throw err;
    }
  },

  /**
   * Get all downloaded items (for the current user)
   */
  getAll: async (): Promise<DownloadItem[]> => {
    const items = await StorageService.getObject<DownloadItem[]>(await downloadsKey());
    return items ?? [];
  },

  /**
   * Get downloads organized by course hierarchy
   */
  getOrganized: async (): Promise<Record<string, { courseTitle: string; modules: Record<string, { moduleTitle: string; items: DownloadItem[] }> }>> => {
    const items = await DownloadService.getAll();
    const organized: Record<string, { courseTitle: string; modules: Record<string, { moduleTitle: string; items: DownloadItem[] }> }> = {};

    for (const item of items) {
      if (!organized[item.courseId]) {
        organized[item.courseId] = { courseTitle: item.courseTitle, modules: {} };
      }
      const moduleKey = item.moduleTitle || 'General';
      if (!organized[item.courseId].modules[moduleKey]) {
        organized[item.courseId].modules[moduleKey] = { moduleTitle: moduleKey, items: [] };
      }
      organized[item.courseId].modules[moduleKey].items.push(item);
    }

    return organized;
  },

  /**
   * Remove a downloaded item
   */
  remove: async (id: string): Promise<void> => {
    const items = await DownloadService.getAll();
    const item = items.find((d) => d.id === id);
    if (item) await deleteItemFiles(item); // whole folder for HLS, file otherwise
    const filtered = items.filter((d) => d.id !== id);
    await StorageService.setObject(await downloadsKey(), filtered);
  },

  /**
   * Check if item is downloaded
   */
  isDownloaded: async (lessonId: string, type: 'video' | 'pdf'): Promise<boolean> => {
    const items = await DownloadService.getAll();
    const item = items.find((d) => d.id === `${lessonId}_${type}`);
    if (!item) return false;
    // Check if file still exists and not expired
    const info = await FileSystem.getInfoAsync(item.fileUri);
    if (!info.exists) return false;
    if (new Date(item.expiresAt) < new Date()) return false;
    return true;
  },

  /**
   * Get remaining days for a download
   */
  getRemainingDays: (expiresAt: string): number => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  },

  /**
   * Notify about downloads expiring soon (<= EXPIRY_WARN_DAYS days).
   * Client-side local notification only (no server). Idempotent per download
   * id — each download triggers the warning at most once.
   */
  notifyExpiringSoon: async (): Promise<void> => {
    try {
      const items = await DownloadService.getAll();
      if (items.length === 0) return;

      // Load already-notified set (user-scoped)
      const notifKey = await notifiedKey();
      const notified =
        (await StorageService.getObject<string[]>(notifKey)) ?? [];
      const notifiedSet = new Set(notified);

      // Find downloads expiring soon and not yet warned
      const expiringSoon = items.filter((d) => {
        const days = DownloadService.getRemainingDays(d.expiresAt);
        return days > 0 && days <= EXPIRY_WARN_DAYS && !notifiedSet.has(d.id);
      });

      if (expiringSoon.length === 0) {
        // Housekeeping: drop notified ids that no longer exist
        const liveIds = new Set(items.map((d) => d.id));
        const cleaned = notified.filter((id) => liveIds.has(id));
        if (cleaned.length !== notified.length) {
          await StorageService.setObject(notifKey, cleaned);
        }
        return;
      }

      // Build a single, clear message
      const soonest = expiringSoon.reduce((min, d) =>
        DownloadService.getRemainingDays(d.expiresAt) < DownloadService.getRemainingDays(min.expiresAt) ? d : min
      );
      const soonestDays = DownloadService.getRemainingDays(soonest.expiresAt);

      const title = 'Downloads Expiring Soon ⏳';
      const body =
        expiringSoon.length === 1
          ? `Your download "${soonest.lessonTitle}" expires in ${soonestDays} day${soonestDays === 1 ? '' : 's'}. Re-download to keep watching offline.`
          : `${expiringSoon.length} of your downloads expire soon (earliest in ${soonestDays} day${soonestDays === 1 ? '' : 's'}). Re-download to keep them offline.`;

      await presentLocalNotification({
        title,
        body,
        data: { type: 'download_expiring', count: expiringSoon.length },
      });

      // Mark these as notified so we don't repeat
      const updated = Array.from(new Set([...notified, ...expiringSoon.map((d) => d.id)]));
      await StorageService.setObject(notifKey, updated);
    } catch {
      // Silent — never crash on notification logic
    }
  },

  /**
   * Clean expired downloads
   */
  cleanExpired: async (): Promise<void> => {
    const items = await DownloadService.getAll();
    const now = new Date();
    const valid: DownloadItem[] = [];

    for (const item of items) {
      if (new Date(item.expiresAt) > now) {
        valid.push(item);
      } else {
        await deleteItemFiles(item); // expired: remove file / HLS folder
      }
    }

    await StorageService.setObject(await downloadsKey(), valid);
  },
};
