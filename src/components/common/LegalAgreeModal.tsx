/**
 * "Read the Terms" window for sign-up: Terms and Privacy Policy in two tabs,
 * shown inside the app (the sign-up form and what the student typed stay as
 * they are). "Back to sign up" closes it; "I agree to both" ticks the box.
 */
import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export type LegalDoc = 'terms' | 'privacy';
const SITE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://www.codingkida.com';
const URLS: Record<LegalDoc, string> = {
  terms: `${SITE}/terms?embed=1`,
  privacy: `${SITE}/privacy?embed=1`,
};

export function LegalAgreeModal({
  visible, initial = 'terms', onClose, onAgree,
}: {
  visible: boolean;
  initial?: LegalDoc;
  onClose: () => void;
  onAgree: () => void;
}) {
  const [tab, setTab] = useState<LegalDoc>(initial);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (visible) { setTab(initial); setFailed(false); } }, [visible, initial]);

  const Tab = ({ id, label }: { id: LegalDoc; label: string }) => (
    <TouchableOpacity style={[s.tab, tab === id && s.tabOn]} onPress={() => { setTab(id); setFailed(false); }}>
      <Text style={[s.tabText, tab === id && s.tabTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.head}>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Back to sign up">
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>Please read before you sign up</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.tabs}>
          <Tab id="terms" label="Terms & Conditions" />
          <Tab id="privacy" label="Privacy Policy" />
        </View>
        <View style={{ flex: 1 }}>
          {failed ? (
            <View style={s.center}>
              <Text style={s.err}>Couldn't open this page. Check your internet and try again.</Text>
              <TouchableOpacity onPress={() => setFailed(false)}><Text style={s.retry}>Try again</Text></TouchableOpacity>
            </View>
          ) : (
            <WebView
              key={tab}
              source={{ uri: URLS[tab] }}
              startInLoadingState
              renderLoading={() => <View style={s.center}><ActivityIndicator color="#6d28d9" size="large" /></View>}
              onError={() => setFailed(true)}
              // Keep the reader inside these two pages.
              onShouldStartLoadWithRequest={(r) => r.url.startsWith(SITE)}
              setSupportMultipleWindows={false}
            />
          )}
        </View>
        <View style={s.foot}>
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={onClose}>
            <Text style={s.btnGhostText}>← Back to sign up</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.btnMain]} onPress={() => { onAgree(); onClose(); }}>
            <Text style={s.btnMainText}>I agree to both</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  back: { fontSize: 22, color: '#6d28d9', fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: '#6d28d9' },
  tabText: { fontSize: 13.5, fontWeight: '700', color: '#64748b' },
  tabTextOn: { color: '#6d28d9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  err: { color: '#475569', fontSize: 14, textAlign: 'center' },
  retry: { color: '#6d28d9', fontSize: 14, fontWeight: '800' },
  foot: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1' },
  btnGhostText: { color: '#334155', fontSize: 14, fontWeight: '700' },
  btnMain: { backgroundColor: '#6d28d9' },
  btnMainText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
