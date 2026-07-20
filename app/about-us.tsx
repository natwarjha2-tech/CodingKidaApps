import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/theme';

export default function AboutUsScreen() {
  const appVersion = '1.0.0';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* App Info Card */}
        <View style={styles.appCard}>
          <Text style={styles.appLogo}>{'</>'}</Text>
          <Text style={styles.appName}>CodingKida</Text>
          <Text style={styles.appTagline}>Learn to Code, Build the Future</Text>
          <Text style={styles.appVersion}>Version {appVersion}</Text>
        </View>

        {/* About App */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📱 About App</Text>
          <Text style={styles.sectionText}>
            CodingKida is an educational platform designed to make coding accessible and fun for young learners. Our mission is to empower the next generation of developers with quality programming education.
          </Text>
          <Text style={styles.sectionText}>
            Features include interactive video lessons, hands-on coding exercises, quizzes, AI mentoring, achievement system, weekly streaks, and much more.
          </Text>
        </View>

        {/* Quick Links */}
        <Text style={styles.linksTitle}>Quick Links</Text>

        <TouchableOpacity style={styles.linkItem} onPress={() => Linking.openURL('https://www.codingkida.com').catch(() => {})}>
          <Text style={styles.linkEmoji}>🌐</Text>
          <Text style={styles.linkText}>Visit Website</Text>
          <Text style={styles.linkArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkItem} onPress={() => Linking.openURL('https://www.codingkida.com/privacy-policy').catch(() => {})}>
          <Text style={styles.linkEmoji}>🔒</Text>
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Text style={styles.linkArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkItem} onPress={() => Linking.openURL('https://www.codingkida.com/terms').catch(() => {})}>
          <Text style={styles.linkEmoji}>📄</Text>
          <Text style={styles.linkText}>Terms & Conditions</Text>
          <Text style={styles.linkArrow}>›</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with ❤️ in India</Text>
          <Text style={styles.footerCopyright}>© 2024-2026 CodingKida. All rights reserved.</Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { color: Colors.primary, fontSize: 20, fontWeight: '600', paddingRight: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { padding: 16 },
  appCard: {
    backgroundColor: Colors.card2, borderRadius: 20, padding: 28,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.2)',
  },
  appLogo: { fontSize: 36, fontWeight: '800', color: Colors.primary, marginBottom: 10 },
  appName: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 6 },
  appTagline: { fontSize: 13, color: Colors.muted, marginBottom: 12 },
  appVersion: { fontSize: 12, color: Colors.purple, fontWeight: '600', backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, overflow: 'hidden' },
  sectionCard: {
    backgroundColor: Colors.card2, borderRadius: 16, padding: 18,
    marginBottom: 20, borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  sectionText: { color: Colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  linksTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  linkItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card2, borderRadius: 14, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  linkEmoji: { fontSize: 18 },
  linkText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  linkArrow: { color: Colors.muted, fontSize: 20 },
  footer: { alignItems: 'center', marginTop: 24, padding: 16 },
  footerText: { color: Colors.muted, fontSize: 13, marginBottom: 4 },
  footerCopyright: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
});
