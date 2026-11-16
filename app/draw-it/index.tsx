/**
 * Draw it — kids change values in ready-made code and watch a picture draw
 * itself (square, star, flower, house, rainbow), then share it on WhatsApp.
 *
 * Everything runs on the phone inside one WebView (see drawItHtml.ts): no
 * internet, no server, nothing saved remotely. This screen only handles the
 * share sheet (PNG → system share sheet, which includes WhatsApp).
 */
import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { buildDrawItHtml } from '@/components/drawIt/drawItHtml';
import { Colors } from '@/theme';

// expo-sharing is loaded lazily so a build without the native module doesn't crash.
function loadSharing(): typeof import('expo-sharing') | null {
  try { return require('expo-sharing'); } catch { return null; }
}

export default function DrawItScreen() {
  const html = useMemo(() => buildDrawItHtml(), []);

  const onMessage = async (e: WebViewMessageEvent) => {
    let m: { t: string; png?: string; name?: string };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.t !== 'share' || !m.png) return;
    try {
      const path = `${FileSystem.cacheDirectory}My CodingKida Drawing.png`;
      await FileSystem.writeAsStringAsync(path, m.png, { encoding: FileSystem.EncodingType.Base64 });
      const Sharing = loadSharing();
      if (!Sharing || !(await Sharing.isAvailableAsync().catch(() => false))) {
        Alert.alert('Share', 'Sharing is not available in this version of the app. Please update the app.');
        return;
      }
      await Sharing.shareAsync(path, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your drawing' });
    } catch (err) {
      Alert.alert('Share', (err as Error)?.message || 'Could not share your drawing. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>🎨 Draw it</Text>
        <Text style={styles.sub} numberOfLines={1}>Change a number, see a picture</Text>
      </View>
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={onMessage}
        textZoom={100}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        style={styles.web}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  web: { flex: 1, backgroundColor: '#0f0f1a' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { color: Colors.primary, fontSize: 22, fontWeight: '700' },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  sub: { flex: 1, color: Colors.purple, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});
