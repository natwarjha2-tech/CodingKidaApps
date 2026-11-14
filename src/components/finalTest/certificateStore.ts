/**
 * Certificates saved in the app's Downloads section (Downloads → Certificates).
 *
 * The PDF itself lives in the app's private documents folder (see
 * CertificateViewer.ensureCertificateFile); this list records which
 * certificates the student chose to download so the Downloads screen can show
 * them in one "Certificates" folder. Unlike lesson downloads they do not expire.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export interface DownloadedCertificate {
  code: string;
  courseTitle?: string;
  percent?: number;
  savedAt: string;
}

const listKey = (userId?: string) => `ck_cert_downloads_${userId || 'anon'}`;
export const certificateFilePath = (code: string) =>
  `${FileSystem.documentDirectory}certificates/${code.replace(/[^A-Z0-9-]/gi, '')}.pdf`;

export async function listDownloadedCertificates(userId?: string): Promise<DownloadedCertificate[]> {
  try {
    const list: DownloadedCertificate[] = JSON.parse((await AsyncStorage.getItem(listKey(userId))) || '[]');
    return list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch {
    return [];
  }
}

export async function addDownloadedCertificate(userId: string | undefined, item: Omit<DownloadedCertificate, 'savedAt'>) {
  const list = (await listDownloadedCertificates(userId)).filter((c) => c.code !== item.code);
  list.unshift({ ...item, savedAt: new Date().toISOString() });
  await AsyncStorage.setItem(listKey(userId), JSON.stringify(list));
}

export async function isCertificateDownloaded(userId: string | undefined, code: string): Promise<boolean> {
  return (await listDownloadedCertificates(userId)).some((c) => c.code === code);
}

/** Remove from Downloads and delete the local copy (it can be downloaded again any time). */
/** Fill in course title / score for saved certificates that are missing them. */
export async function fillMissingCertificateTitles(
  userId: string | undefined,
  lookup: { code: string; courseTitle?: string; percent?: number }[]
): Promise<boolean> {
  const list = await listDownloadedCertificates(userId);
  let changed = false;
  for (const c of list) {
    if (c.courseTitle) continue;
    const m = lookup.find((x) => x.code === c.code);
    if (m?.courseTitle) { c.courseTitle = m.courseTitle; if (c.percent === undefined) c.percent = m.percent; changed = true; }
  }
  if (changed) await AsyncStorage.setItem(listKey(userId), JSON.stringify(list));
  return changed;
}

export async function removeDownloadedCertificate(userId: string | undefined, code: string) {
  const list = (await listDownloadedCertificates(userId)).filter((c) => c.code !== code);
  await AsyncStorage.setItem(listKey(userId), JSON.stringify(list));
  await FileSystem.deleteAsync(certificateFilePath(code), { idempotent: true }).catch(() => {});
}

/** Readable name, e.g. "CodingKida Certificate - C". */
export function certificateDisplayName(code: string, courseTitle?: string): string {
  const course = (courseTitle || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return course ? `CodingKida Certificate - ${course}` : `CodingKida Certificate - ${code}`;
}
