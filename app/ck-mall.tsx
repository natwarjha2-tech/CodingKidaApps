import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api';
import { Colors } from '@/theme';

export default function CKMallScreen() {
  const queryClient = useQueryClient();
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [applying, setApplying] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  // Fetch mall data (balance + offers)
  const { data, isLoading } = useQuery({
    queryKey: ['mall'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; balance: number; offers: any[] }>('/api/mall');
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
  });

  const balance = data?.balance ?? 0;
  const offers = data?.offers ?? [];

  // Apply coupon code
  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) { setCouponMsg({ text: 'Please enter a coupon code', success: false }); return; }
    setApplying(true);
    setCouponMsg(null);
    try {
      const res = await apiClient.post<{ success: boolean; message: string; coupon?: { discount: number } }>('/api/mall/redeem', { couponCode: code });
      if (res.data?.success) {
        setCouponMsg({ text: `✅ ${res.data.message} — ${res.data.coupon?.discount || ''}% off!`, success: true });
        queryClient.invalidateQueries({ queryKey: ['mall'] });
      } else {
        setCouponMsg({ text: `❌ ${res.data?.message || 'Invalid code'}`, success: false });
      }
    } catch (err: any) {
      setCouponMsg({ text: `❌ ${err?.response?.data?.message || 'Failed to apply'}`, success: false });
    } finally {
      setApplying(false);
    }
  };

  // Redeem offer with coins
  const handleRedeemOffer = async (offer: any) => {
    Alert.alert('Redeem Offer', `Redeem ${offer.coinsRequired} coins for "${offer.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Redeem', onPress: async () => {
        setRedeemingId(offer.id);
        try {
          const res = await apiClient.post<{ success: boolean; message: string; newBalance: number }>('/api/mall/redeem', { offerId: offer.id });
          if (res.data?.success) {
            Alert.alert('🎉 Success', `${res.data.message}\nNew balance: ${res.data.newBalance} coins`);
            queryClient.invalidateQueries({ queryKey: ['mall'] });
            queryClient.invalidateQueries({ queryKey: ['coins'] });
          } else {
            Alert.alert('Error', res.data?.message || 'Could not redeem.');
          }
        } catch (err: any) {
          Alert.alert('Error', err?.response?.data?.message || 'Failed to redeem.');
        } finally {
          setRedeemingId(null);
        }
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CK Mall</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading mall...</Text>
          </View>
        ) : (
          <>
            {/* Coin Balance */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceValue}>🪙 {balance}</Text>
              <Text style={styles.balanceLabel}>Your Coin Balance</Text>
            </View>

            {/* Coupon Code Section */}
            <View style={styles.couponCard}>
              <Text style={styles.couponTitle}>🏷️ Apply Coupon Code</Text>
              <View style={styles.couponRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholder="ENTER COUPON CODE"
                  placeholderTextColor={Colors.muted}
                  value={couponCode}
                  onChangeText={setCouponCode}
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.couponBtn} onPress={handleApplyCoupon} disabled={applying}>
                  {applying ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.couponBtnText}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
              {couponMsg && (
                <Text style={[styles.couponMsg, { color: couponMsg.success ? Colors.success : Colors.danger }]}>
                  {couponMsg.text}
                </Text>
              )}
            </View>

            {/* Redeem with Coins */}
            <Text style={styles.sectionTitle}>🎁 Redeem with Coins</Text>
            {offers.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🏪</Text>
                <Text style={styles.emptyText}>No offers available yet. Check back soon!</Text>
              </View>
            ) : (
              <View style={styles.offersGrid}>
                {offers.map((offer: any) => (
                  <View key={offer.id} style={[styles.offerCard, !offer.available && { opacity: 0.5 }]}>
                    <Text style={styles.offerIcon}>{offer.icon || '🎁'}</Text>
                    <Text style={styles.offerTitle}>{offer.title}</Text>
                    <Text style={styles.offerDesc}>{offer.description}</Text>
                    <TouchableOpacity
                      style={[styles.redeemBtn, !offer.available && styles.redeemBtnDisabled]}
                      onPress={() => handleRedeemOffer(offer)}
                      disabled={!offer.available || redeemingId === offer.id}
                    >
                      {redeemingId === offer.id ? (
                        <ActivityIndicator color="#000" size="small" />
                      ) : (
                        <Text style={[styles.redeemBtnText, !offer.available && styles.redeemBtnTextDisabled]}>
                          🪙 {offer.coinsRequired} Coins
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
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
  loadingState: { alignItems: 'center', padding: 60, gap: 12 },
  loadingText: { color: Colors.muted, fontSize: 14 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: Colors.muted, fontSize: 13, textAlign: 'center' },

  // Balance
  balanceCard: {
    backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
  },
  balanceValue: { fontSize: 28, fontWeight: '800', color: Colors.coin, marginBottom: 4 },
  balanceLabel: { color: Colors.muted, fontSize: 13 },

  // Coupon
  couponCard: {
    backgroundColor: Colors.card2, borderRadius: 16, padding: 18,
    marginBottom: 20, borderWidth: 1, borderColor: Colors.border,
  },
  couponTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  couponRow: { flexDirection: 'row', gap: 10 },
  couponInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14,
    textTransform: 'uppercase',
  },
  couponBtn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center',
  },
  couponBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  couponMsg: { marginTop: 8, fontSize: 12, fontWeight: '600' },

  // Offers
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 14 },
  offersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  offerCard: {
    width: '47%', backgroundColor: Colors.card2, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  offerIcon: { fontSize: 28, marginBottom: 8 },
  offerTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  offerDesc: { color: Colors.muted, fontSize: 11, marginBottom: 12, lineHeight: 16 },
  redeemBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  redeemBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  redeemBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },
  redeemBtnTextDisabled: { color: Colors.muted },
});
