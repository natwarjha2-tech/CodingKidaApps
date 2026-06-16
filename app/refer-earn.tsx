import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store';
import { Colors } from '@/theme';

export default function ReferEarnScreen() {
  const user = useAuthStore((s) => s.user);

  const referralCode = (user?.id ?? 'CODEKIDA').slice(0, 8).toUpperCase();

  const copyCode = () => {
    Alert.alert('Copied!', `Referral code: ${referralCode}`);
  };

  const shareCode = () => {
    Share.share({
      message: `Join CodingKida and start learning to code! Use my referral code: ${referralCode}\nDownload: https://www.codingkida.com/download`,
    });
  };

  const steps = [
    { emoji: '📤', title: 'Share your code', description: 'Send your unique referral code to friends' },
    { emoji: '👤', title: 'Friend signs up & enrolls', description: 'They create an account and enroll in a course' },
    { emoji: '🪙', title: 'You earn 50 coins', description: 'Coins are credited once they complete enrollment' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Info Banner */}
        <View style={styles.bannerCard}>
          <Text style={styles.bannerEmoji}>🎁</Text>
          <Text style={styles.bannerTitle}>Invite Friends & Earn Coins!</Text>
          <Text style={styles.bannerText}>
            Earn 50 coins for every successful referral. Share your code and grow together!
          </Text>
        </View>

        {/* Referral Code Card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{referralCode}</Text>
          </View>
          <View style={styles.codeActions}>
            <TouchableOpacity style={styles.copyBtn} onPress={copyCode}>
              <Text style={styles.copyBtnText}>📋 Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={shareCode}>
              <Text style={styles.shareBtnText}>📤 Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* How It Works */}
        <Text style={styles.sectionTitle}>How It Works</Text>
        {steps.map((step, index) => (
          <View key={index} style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.stepContent}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepEmoji}>{step.emoji}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
              </View>
              <Text style={styles.stepDesc}>{step.description}</Text>
            </View>
          </View>
        ))}

        {/* Stats */}
        <Text style={styles.sectionTitle}>Your Referral Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Referrals</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Coins Earned</Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { color: Colors.primary, fontSize: 20, fontWeight: '600', paddingRight: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { padding: 16 },

  // Banner
  bannerCard: {
    backgroundColor: Colors.successLight,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  bannerEmoji: { fontSize: 40, marginBottom: 12 },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  bannerText: { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Code Card
  codeCard: {
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  codeLabel: { color: Colors.muted, fontSize: 13, marginBottom: 12 },
  codeBox: {
    backgroundColor: 'rgba(108,71,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(108,71,255,0.3)',
    marginBottom: 16,
  },
  codeText: { color: Colors.primary, fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  codeActions: { flexDirection: 'row', gap: 12 },
  copyBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  copyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  shareBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  shareBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Steps
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card2,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
    alignItems: 'center',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: Colors.primary, fontSize: 14, fontWeight: '800' },
  stepContent: { flex: 1 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  stepEmoji: { fontSize: 16 },
  stepTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  stepDesc: { color: Colors.muted, fontSize: 12, lineHeight: 18 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card2,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: Colors.muted, fontSize: 12 },
});
