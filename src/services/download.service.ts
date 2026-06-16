import * as FileSystem from 'expo-file-system/legacy';
import { mediaApi } from '@/api';
import { StorageService } from './storage.service';

const DOWNLOADS_KEY = 'ck_downloads';

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
  }): Promise<DownloadItem> => {
    const { lessonId, lessonTitle, moduleTitle, courseId, courseTitle, type, url } = params;

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
    };

    // 7. Save to storage
    const existing = await DownloadService.getAll();
    const filtered = existing.filter((d) => d.id !== item.id); // Replace if exists
    await StorageService.setObject(DOWNLOADS_KEY, [...filtered, item]);

    return item;
  },

  /**
   * Get all downloaded items
   */
  getAll: async (): Promise<DownloadItem[]> => {
    const items = await StorageService.getObject<DownloadItem[]>(DOWNLOADS_KEY);
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
    if (item) {
      // Delete file
      try {
        const info = await FileSystem.getInfoAsync(item.fileUri);
        if (info.exists) await FileSystem.deleteAsync(item.fileUri);
      } catch {}
    }
    const filtered = items.filter((d) => d.id !== id);
    await StorageService.setObject(DOWNLOADS_KEY, filtered);
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
        // Delete expired file
        try {
          const info = await FileSystem.getInfoAsync(item.fileUri);
          if (info.exists) await FileSystem.deleteAsync(item.fileUri);
        } catch {}
      }
    }

    await StorageService.setObject(DOWNLOADS_KEY, valid);
  },
};
