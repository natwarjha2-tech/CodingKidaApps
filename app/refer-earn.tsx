import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Share, Alert, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { referralApi } from '@/api';
import { Colors } from '@/theme';

export default function ReferEarnScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  // Real referral code + stats from backend (mirrors desktop /api/referral).
  const { data: referral } = useQuery({
    queryKey: ['referral'],
    queryFn: () => referralApi.get(),
    staleTime: 1000 * 60 * 5,
  });

  const referralCode = referral?.code ?? '------';
  const canApply = referral?.canApply ?? false;

  // Apply a friend's code (only if eligible — before first purchase, not applied yet).
  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState<{ text: string; success: boolean } | null>(null);

  const handleApplyReferral = async () => {
    const code = applyCode.trim();
    if (!code) { setApplyMsg({ text: 'Please enter a referral code', success: false }); return; }
    setApplying(true);
    setApplyMsg(null);
    try {
      const res = await referralApi.apply(code);
      if (res.success) {
        setApplyMsg({ text: `✅ ${res.message}`, success: true });
        setApplyCode('');
        queryClient.invalidateQueries({ queryKey: ['referral'] });
        queryClient.invalidateQueries({ queryKey: ['coins'] });
      } else {
        setApplyMsg({ text: `❌ ${res.message || 'Invalid code'}`, success: false });
      }
    } catch (err: any) {
      setApplyMsg({ text: `❌ ${err?.response?.data?.message || 'Failed to apply'}`, success: false });
    } finally {
      setApplying(false);
    }
  };

  const copyCode = () => {
    if (!referral?.code) { Alert.alert('Please wait', 'Loading your code…'); return; }
    Alert.alert('Copied!', `Referral code: ${referral.code}`);
  };

  const shareCode = () => {
    if (!referral?.code) { Alert.alert('Please wait', 'Loading your code…'); return; }
    const name = user?.name || 'My friend';
    Share.share({
      message:
        `🎓 Hey! ${name} invited you to join CodingKida — India's best coding platform for kids!\n\n` +
        `✅ Learn Java, Python, Web Dev & more\n` +
        `🏆 Earn badges & certificates\n` +
        `🤖 24/7 AI mentor\n\n` +
        `👉 Use my referral code: ${referral.code}\n` +
        `Download: https://www.codingkida.com/download`,
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

        {/* Apply a friend's code — only shown while eligible (before first purchase) */}
        {canApply && (
          <View style={styles.applyCard}>
            <Text style={styles.applyTitle}>Have a friend's referral code?</Text>
            <Text style={styles.applySub}>Enter it to earn {referral?.rewardNewUser ?? 50} coins (one-time).</Text>
            <View style={styles.applyRow}>
              <TextInput
                style={styles.applyInput}
                placeholder="ENTER REFERRAL CODE"
                placeholderTextColor={Colors.muted}
                value={applyCode}
                onChangeText={setApplyCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.applyBtn} onPress={handleApplyReferral} disabled={applying}>
                {applying ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.applyBtnText}>Apply</Text>}
              </TouchableOpacity>
            </View>
            {applyMsg && (
              <Text style={[styles.applyMsg, { color: applyMsg.success ? Colors.success : Colors.danger }]}>{applyMsg.text}</Text>
            )}
          </View>
        )}

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
            <Text style={styles.statValue}>{referral?.referredCount ?? 0}</Text>
            <Text style={styles.statLabel}>Referrals</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{referral?.coinsEarned ?? 0}</Text>
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

  // Apply a friend's code
  applyCard: { backgroundColor: Colors.card2, borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  applyTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  applySub: { color: Colors.muted, fontSize: 11.5, marginBottom: 12, lineHeight: 16 },
  applyRow: { flexDirection: 'row', gap: 10 },
  applyInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14, textTransform: 'uppercase',
  },
  applyBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  applyMsg: { marginTop: 8, fontSize: 12, fontWeight: '600' },
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
