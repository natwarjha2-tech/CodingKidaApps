/**
 * Shows a CodingKida certificate in the app, with Download, Share and
 * WhatsApp actions.
 *
 * The PDF is fetched from the owner-only endpoint and cached in the app's
 * documents folder so it opens again offline. It is rendered by the in-app
 * PdfViewer (pdf.js canvas). Screenshots are allowed here (it is the student's
 * own certificate, unlike protected lesson PDFs).
 *
 *  - ⬇ Download: saves it in the app's Downloads section (Downloads →
 *    Certificates), next to downloaded lessons. No folder picker, no expiry.
 *  - 📤 Share PDF: system share sheet with the PDF attached (WhatsApp, Gmail…),
 *    named after the course.
 *  - 💬 WhatsApp: opens WhatsApp straight away with a ready message.
 */
import { useEffect, useState } from 'react';
import {
  Modal, View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { finalTestApi } from '@/api';
import { useAuthStore } from '@/store';
import { PdfViewer } from '@/components/lesson/PdfViewer';
import {
  addDownloadedCertificate, isCertificateDownloaded, certificateDisplayName, certificateFilePath,
} from '@/components/finalTest/certificateStore';
import { Colors } from '@/theme';

const DIR = `${FileSystem.documentDirectory}certificates/`;

/** Path of the saved certificate, downloading it first if needed. */
export async function ensureCertificateFile(code: string, forceRefresh = false): Promise<string> {
  const path = certificateFilePath(code);
  if (!forceRefresh) {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists && (info as { size?: number }).size) return path;
  }
  const res = await finalTestApi.certificatePdf(code);
  if (!res?.success || !res.base64) throw new Error('Could not load the certificate.');
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  await FileSystem.writeAsStringAsync(path, res.base64, { encoding: FileSystem.EncodingType.Base64 });
  return path;
}

export interface CertificateInfo { courseTitle?: string; percent?: number }

// expo-sharing is loaded lazily so a build without the native module doesn't crash.
function loadSharing(): typeof import('expo-sharing') | null {
  try { return require('expo-sharing'); } catch { return null; }
}

/** Copy of the PDF with the readable name (so the recipient sees the course). */
async function namedCopy(path: string, code: string, info?: CertificateInfo): Promise<string> {
  const target = `${FileSystem.cacheDirectory}${certificateDisplayName(code, info?.courseTitle)}.pdf`;
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
    await FileSystem.copyAsync({ from: path, to: target });
    return target;
  } catch {
    return path;
  }
}

async function sharePdf(path: string, code: string, info?: CertificateInfo) {
  const Sharing = loadSharing();
  if (!Sharing || !(await Sharing.isAvailableAsync().catch(() => false))) {
    Alert.alert('Share', 'Sharing is not available in this version of the app. Please update the app.');
    return;
  }
  const file = await namedCopy(path, code, info);
  await Sharing.shareAsync(file, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share your certificate' });
}

async function openWhatsApp(code: string, info?: CertificateInfo) {
  const what = info?.courseTitle ? ` the ${info.courseTitle} course` : ' a course';
  const score = typeof info?.percent === 'number' ? ` with ${info.percent}%` : '';
  const text =
    `🎓 I just completed${what} on CodingKida${score}!\n` +
    `Certificate ID: ${code}\n` +
    `Learn coding with me: https://www.codingkida.com`;
  const enc = encodeURIComponent(text);
  try {
    await Linking.openURL(`whatsapp://send?text=${enc}`);
  } catch {
    try { await Linking.openURL(`https://wa.me/?text=${enc}`); }
    catch { Alert.alert('WhatsApp', 'Could not open WhatsApp. Is it installed?'); }
  }
}

export function CertificateViewer({ code, visible, onClose, info }: {
  code: string | null; visible: boolean; onClose: () => void; info?: CertificateInfo;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'dl' | 'share' | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [looked, setLooked] = useState<CertificateInfo>({});
  const insets = useSafeAreaInsets();
  // Course name / score: from the caller, else looked up from the student's certificates.
  const eff: CertificateInfo = { courseTitle: info?.courseTitle || looked.courseTitle, percent: info?.percent ?? looked.percent };

  useEffect(() => {
    if (!visible || !code || info?.courseTitle) { setLooked({}); return; }
    let cancelled = false;
    finalTestApi.myCertificates()
      .then((r) => {
        const m = r.certificates?.find((c) => c.code === code);
        if (!cancelled && m) setLooked({ courseTitle: m.courseTitle, percent: m.percent });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visible, code, info?.courseTitle]);

  useEffect(() => {
    if (!visible || !code) { setPath(null); setError(null); setDownloaded(false); return; }
    let cancelled = false;
    ensureCertificateFile(code)
      .then((p) => { if (!cancelled) setPath(p); })
      .catch((e) => { if (!cancelled) setError((e as Error)?.message || 'Could not load the certificate.'); });
    isCertificateDownloaded(userId, code).then((d) => { if (!cancelled) setDownloaded(d); });
    return () => { cancelled = true; };
  }, [visible, code, userId]);

  if (!visible) return null;

  if (path && code) {
    const download = async () => {
      if (busy || downloaded) return;
      setBusy('dl');
      try {
        let c = eff;
        if (!c.courseTitle) { // lookup not back yet — fetch now so the name is saved
          try {
            const r = await finalTestApi.myCertificates();
            const m = r.certificates?.find((x) => x.code === code);
            if (m) c = { courseTitle: m.courseTitle, percent: c.percent ?? m.percent };
          } catch { /* saved without a name; the Downloads screen fills it in later */ }
        }
        await addDownloadedCertificate(userId, { code, courseTitle: c.courseTitle, percent: c.percent });
        setDownloaded(true);
        Alert.alert('Downloaded ✅', 'Saved in Downloads → Certificates. You can open it there any time, even offline.');
      } catch (e) {
        Alert.alert('Certificate', (e as Error)?.message || 'Could not save the certificate. Please try again.');
      } finally {
        setBusy(null);
      }
    };
    const share = async () => {
      if (busy) return;
      setBusy('share');
      try { await sharePdf(path, code, eff); }
      catch (e) { Alert.alert('Certificate', (e as Error)?.message || 'Something went wrong. Please try again.'); }
      finally { setBusy(null); }
    };
    return (
      <PdfViewer
        visible
        pdfUrl={path}
        onClose={onClose}
        title="🎓 My Certificate"
        allowCapture
        footer={
          <View style={[styles.actions, { paddingBottom: 12 + insets.bottom }]}>
            <TouchableOpacity style={[styles.act, downloaded ? styles.actDone : styles.actDl, busy === 'dl' && styles.dim]} onPress={download} disabled={!!busy || downloaded}>
              <Text style={styles.actText}>{downloaded ? '✅ In Downloads' : '⬇ Download'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.act, styles.actShare, busy === 'share' && styles.dim]} onPress={share} disabled={!!busy}>
              <Text style={styles.actText}>📤 Share PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.act, styles.actWa]} onPress={() => openWhatsApp(code, eff)}>
              <Text style={styles.actText}>💬 WhatsApp</Text>
            </TouchableOpacity>
          </View>
        }
      />
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          {error ? (
            <>
              <Text style={styles.err}>⚠️ {error}</Text>
              <TouchableOpacity style={styles.btn} onPress={onClose}><Text style={styles.btnText}>Close</Text></TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.muted}>Preparing your certificate…</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  box: { backgroundColor: Colors.bg2, borderRadius: 16, padding: 24, alignItems: 'center', gap: 12, minWidth: 240 },
  muted: { color: Colors.muted, fontSize: 13 },
  err: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
  btn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  btnText: { color: '#fff', fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12, backgroundColor: Colors.bg2, borderTopWidth: 1, borderTopColor: Colors.border },
  act: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  actDl: { backgroundColor: Colors.primary },
  actDone: { backgroundColor: 'rgba(34,197,94,0.25)' },
  actShare: { backgroundColor: '#3b82f6' },
  actWa: { backgroundColor: '#25D366' },
  actText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  dim: { opacity: 0.5 },
});
