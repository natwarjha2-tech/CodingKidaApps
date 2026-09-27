import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useCourses, useSupportContact } from '@/hooks';
import { apiClient } from '@/api';
import { Colors } from '@/theme';

// Parse a course "students" value (number or "1.2k") into a plain number (mirrors desktop)
function parseStudents(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s.endsWith('k')) return Math.round(parseFloat(s) * 1000) || 0;
    return parseInt(s.replace(/[^0-9]/g, ''), 10) || 0;
  }
  return 0;
}

// Format a large count for display (e.g. 12345 → "12.3K+") — mirrors desktop _aboutFmtCount
function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K+';
  return String(n) + '+';
}

export default function AboutUsScreen() {
  const appVersion = '1.0.0';
  const support = useSupportContact(); // live support email (backend-configurable)

  const contactSupport = () => {
    const subject = 'Help Request';
    const body = 'Hi CodingKida Support,\n\nI need help with:\n\n[Describe your issue here]\n\nThank you';
    Linking.openURL(`mailto:${support.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`).catch(() => {});
  };

  // Dynamic stats (never fabricated — fall back to "—")
  const { data: coursesData } = useCourses('All', '');
  const courses = coursesData?.courses ?? [];

  const { data: ratingData } = useQuery({
    queryKey: ['app-ratings'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; avgRating: number; totalReviews: number }>(
          '/api/feedback/lesson?lessonId=app_rating'
        )
        .then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

  const coursesStat = courses.length > 0 ? `${courses.length}+` : '—';
  const totalStudents = courses.reduce((sum, c: any) => sum + parseStudents(c.students), 0);
  const studentsStat = courses.length > 0 ? formatCount(totalStudents) : '—';
  const avgRating = ratingData?.avgRating ?? 0;
  const totalReviews = ratingData?.totalReviews ?? 0;
  const ratingStat = avgRating > 0 ? Number(avgRating).toFixed(1) : '—';
  const ratingSub = avgRating > 0
    ? `Based on ${totalReviews} review${totalReviews === 1 ? '' : 's'}`
    : 'No ratings yet';

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

        {/* Dynamic Stats (courses / students / rating) — mirrors desktop */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{coursesStat}</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{studentsStat}</Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{ratingStat}</Text>
            <Text style={styles.statLabel}>Rating</Text>
            <Text style={styles.statSub}>{ratingSub}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.statValueSupport]}>🎧 24/7</Text>
            <Text style={styles.statLabel}>Support</Text>
            <Text style={styles.statSub}>We're here to help you anytime</Text>
          </View>
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

        {/* Contact support — live email (backend-configurable), mirrors desktop */}
        <TouchableOpacity style={styles.linkItem} onPress={contactSupport}>
          <Text style={styles.linkEmoji}>📧</Text>
          <Text style={styles.linkText} numberOfLines={1}>Contact: {support.email}</Text>
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
  headerTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  content: { padding: 16 },
  appCard: {
    backgroundColor: Colors.card2, borderRadius: 20, padding: 28,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: Colors.primaryLight,
  },
  appLogo: { fontSize: 36, fontWeight: '800', color: Colors.primary, marginBottom: 10 },
  appName: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  appTagline: { fontSize: 13, color: Colors.muted, marginBottom: 12 },
  appVersion: { fontSize: 12, color: Colors.purple, fontWeight: '600', backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, overflow: 'hidden' },

  // Dynamic stats row (2×2 grid — wraps cleanly on all screen sizes)
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '47%', flexGrow: 1, backgroundColor: Colors.card2, borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { color: Colors.primary, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  statValueSupport: { color: Colors.secondary },
  statLabel: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  statSub: { color: Colors.muted, fontSize: 9, marginTop: 3, textAlign: 'center' },
  sectionCard: {
    backgroundColor: Colors.card2, borderRadius: 16, padding: 18,
    marginBottom: 20, borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  sectionText: { color: Colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  linksTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  linkItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card2, borderRadius: 14, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  linkEmoji: { fontSize: 18 },
  linkText: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: '600' },
  linkArrow: { color: Colors.muted, fontSize: 20 },
  footer: { alignItems: 'center', marginTop: 24, padding: 16 },
  footerText: { color: Colors.muted, fontSize: 13, marginBottom: 4 },
  footerCopyright: { color: Colors.muted, fontSize: 11 },
});
