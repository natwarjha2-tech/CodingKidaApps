import { useState } from 'react';
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

        // Use pdf.js CDN to render PDF in WebView (works like desktop app's canvas rendering)
        const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=3.0,user-scalable=yes">
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#1a1a2e; overflow-x:hidden; }
canvas { display:block; margin:8px auto; max-width:100%; }
#loading { color:#94a3b8; text-align:center; padding:40px; font-family:sans-serif; font-size:14px; }
</style>
</head>
<body>
<div id="loading">Loading PDF...</div>
<div id="pages"></div>
<script>
var pdfData = atob("${base64Content}");
var loadingTask = pdfjsLib.getDocument({data: pdfData});
loadingTask.promise.then(function(pdf) {
  document.getElementById('loading').style.display = 'none';
  var container = document.getElementById('pages');
  for (var i = 1; i <= pdf.numPages; i++) {
    (function(pageNum) {
      pdf.getPage(pageNum).then(function(page) {
        var scale = (window.innerWidth - 16) / page.getViewport({scale:1}).width;
        var viewport = page.getViewport({scale: Math.min(scale, 2)});
        var canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        container.appendChild(canvas);
        page.render({canvasContext: canvas.getContext('2d'), viewport: viewport});
      });
    })(i);
  }
}).catch(function(err) {
  document.getElementById('loading').textContent = 'Failed to render PDF: ' + err.message;
  document.getElementById('loading').style.color = '#ef4444';
});
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
          <TouchableOpacity onPress={() => { onClose(); setViewerContent(null); setError(null); }}>
            <Text style={styles.closeBtn}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📄 PDF Notes</Text>
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
