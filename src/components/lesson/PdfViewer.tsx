import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { mediaApi } from '@/api';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';

interface PdfViewerProps {
  visible: boolean;
  pdfUrl: string;
  onClose: () => void;
}

/**
 * In-app PDF Viewer — Secure
 * - Remote PDFs: Gets signed URL → renders via Google Docs in WebView
 * - Local/Offline PDFs: Reads file as base64 → renders in WebView using embedded PDF.js
 * - No save, download, copy, share options
 * - Works on Android + iOS
 */
export function PdfViewer({ visible, pdfUrl, onClose }: PdfViewerProps) {
  const [loading, setLoading] = useState(true);
  const [viewerContent, setViewerContent] = useState<{ type: 'url' | 'html'; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // For local PDFs the base64 is NOT inlined into the HTML (that breaks large
  // files). It is held here and pushed into the WebView after load, in chunks,
  // via injectJavaScript — keeps the initial HTML tiny so big PDFs render fine.
  const localB64Ref = useRef<string | null>(null);
  const webRef = useRef<WebView>(null);

  // Block screenshots / screen recording while a PDF is open; restore on close.
  // Loaded lazily + guarded so a dev/build where the ExpoScreenCapture native
  // module isn't linked yet won't crash the whole screen — the protection is
  // simply skipped until the app is rebuilt with the native module included.
  useEffect(() => {
    if (!visible) return;
    let ScreenCapture: typeof import('expo-screen-capture') | null = null;
    try {
      ScreenCapture = require('expo-screen-capture');
    } catch {
      ScreenCapture = null;
    }
    ScreenCapture?.preventScreenCaptureAsync?.().catch(() => {});
    return () => {
      ScreenCapture?.allowScreenCaptureAsync?.().catch(() => {});
    };
  }, [visible]);

  const handleOpen = async () => {
    if (!pdfUrl) return;
    setLoading(true);
    setError(null);
    setViewerContent(null);

    try {
      const isLocal = pdfUrl.startsWith(FileSystem.documentDirectory || '/') || 
                      pdfUrl.includes('/downloads/') ||
                      pdfUrl.startsWith('file://');

      if (isLocal) {
        // Read local file as base64 and render in WebView using pdf.js
        const filePath = pdfUrl.startsWith('file://') ? pdfUrl.substring(7) : pdfUrl;
        let base64Content = '';
        
        try {
          base64Content = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64 });
        } catch {
          // Try with original path
          try {
            base64Content = await FileSystem.readAsStringAsync(pdfUrl, { encoding: FileSystem.EncodingType.Base64 });
          } catch {
            setError('PDF file not found. It may have expired.');
            setLoading(false);
            return;
          }
        }

        // Hold the base64 out-of-band; it is streamed into the WebView after
        // load (see onLoadEnd → injectJavaScript). The HTML itself stays tiny so
        // large PDFs no longer blow the WebView's HTML/memory limit (white screen).
        localB64Ref.current = base64Content;

        // pdf.js renders to <canvas> (image, not selectable text) → no copy/paste
        // possible. user-select:none adds belt-and-braces. No save/share options.
        const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=3.0,user-scalable=yes">
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<style>
* { margin:0; padding:0; box-sizing:border-box; -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; }
body { background:#1a1a2e; overflow-x:hidden; }
canvas { display:block; margin:8px auto; max-width:100%; }
#loading { color:#94a3b8; text-align:center; padding:40px; font-family:sans-serif; font-size:14px; }
</style>
</head>
<body>
<div id="loading">Loading PDF...</div>
<div id="pages"></div>
<script>
// The base64 is delivered in chunks from React Native to avoid a single huge
// string. window.__pdfChunks collects them; window.__renderPdf() runs pdf.js.
window.__pdfChunks = [];
window.__pushPdfChunk = function(chunk) { window.__pdfChunks.push(chunk); };
window.__renderPdf = function() {
  try {
    var b64 = window.__pdfChunks.join('');
    window.__pdfChunks = [];
    var raw = atob(b64);
    var bytes = new Uint8Array(raw.length);
    for (var k = 0; k < raw.length; k++) { bytes[k] = raw.charCodeAt(k); }
    var loadingTask = pdfjsLib.getDocument({data: bytes});
    loadingTask.promise.then(function(pdf) {
      document.getElementById('loading').style.display = 'none';
      var container = document.getElementById('pages');
      var pixelRatio = Math.max(window.devicePixelRatio || 2, 3);
      for (var i = 1; i <= pdf.numPages; i++) {
        (function(pageNum) {
          pdf.getPage(pageNum).then(function(page) {
            var baseScale = (window.innerWidth) / page.getViewport({scale:1}).width;
            var scale = baseScale * pixelRatio;
            var viewport = page.getViewport({scale: scale});
            var canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.display = 'block';
            container.appendChild(canvas);
            page.render({canvasContext: canvas.getContext('2d'), viewport: viewport});
          });
        })(i);
      }
    }).catch(function(err) {
      document.getElementById('loading').textContent = 'Failed to render PDF: ' + err.message;
      document.getElementById('loading').style.color = '#ef4444';
    });
  } catch (e) {
    document.getElementById('loading').textContent = 'Failed to render PDF.';
    document.getElementById('loading').style.color = '#ef4444';
  }
};
</script>
</body>
</html>`;
        setViewerContent({ type: 'html', content: html });
      } else {
        // Remote URL — get signed URL and use Google Docs viewer
        let finalUrl = pdfUrl;
        if (pdfUrl.includes('amazonaws.com') && !pdfUrl.includes('X-Amz-Signature')) {
          const res = await mediaApi.getSignedUrl(pdfUrl);
          if (res.success && res.signedUrl) {
            finalUrl = res.signedUrl;
          } else {
            setError('Failed to load PDF.');
            setLoading(false);
            return;
          }
        }
        const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(finalUrl)}`;
        setViewerContent({ type: 'url', content: viewerUrl });
      }
    } catch {
      setError('Failed to load PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (visible && !viewerContent && !loading && !error) {
    handleOpen();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { onClose(); setViewerContent(null); setError(null); localB64Ref.current = null; }}>
            <Text style={styles.closeBtn}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📄 Document</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading PDF...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorState}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleOpen}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : viewerContent ? (
          <WebView
            ref={webRef}
            source={viewerContent.type === 'html' ? { html: viewerContent.content } : { uri: viewerContent.content }}
            style={styles.webview}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webviewLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={['*']}
            allowFileAccess={true}
            onLoadEnd={() => {
              // Stream a local PDF's base64 into the WebView in chunks after the
              // page (with pdf.js) has loaded, then trigger the render. Remote
              // (Google Docs) PDFs have no local base64, so this is skipped.
              const b64 = localB64Ref.current;
              if (viewerContent.type !== 'html' || !b64 || !webRef.current) return;
              const CHUNK = 64 * 1024; // 64KB per inject — safe for the JS bridge
              for (let i = 0; i < b64.length; i += CHUNK) {
                const part = b64.slice(i, i + CHUNK).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                webRef.current.injectJavaScript(`window.__pushPdfChunk('${part}');true;`);
              }
              webRef.current.injectJavaScript('window.__renderPdf && window.__renderPdf();true;');
              // Free the RN-side copy once handed off.
              localB64Ref.current = null;
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingTop: 48, // Safe area for status bar + gesture area
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bg2,
  },
  closeBtn: { color: Colors.danger, fontSize: Typography.sm, fontWeight: FontWeight.bold },
  headerTitle: { color: Colors.white, fontSize: Typography.base, fontWeight: FontWeight.bold },
  webview: { flex: 1 },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.muted, fontSize: Typography.sm },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorIcon: { fontSize: 48, marginBottom: Spacing.md },
  errorText: { color: Colors.danger, fontSize: Typography.sm, marginBottom: Spacing.lg },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm },
  retryText: { color: Colors.white, fontSize: Typography.sm, fontWeight: FontWeight.bold },
});
