import { useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api';
import { Colors } from '@/theme';

interface CoinTx { id: string; type: 'EARNED' | 'SPENT'; coins: number; reason?: string; createdAt: string }
interface Discount { id?: string; label?: string; percent: number }

export default function CKMallScreen() {
  const queryClient = useQueryClient();
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [applying, setApplying] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [historyY, setHistoryY] = useState(0);

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

  // Redemption history — coin transactions (earned/spent). Mirrors desktop.
  const { data: coinsData } = useQuery({
    queryKey: ['coins'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; transactions: CoinTx[] }>('/api/coins');
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
  });
  // Redemption history = only coins SPENT (redeemed on offers/discounts).
  // Earned coins (quiz rewards etc.) belong in "My Coins", not here.
  const transactions: CoinTx[] = (coinsData?.transactions ?? []).filter((t) => t.type === 'SPENT');

  // Usable discounts (ready to use at checkout). Endpoint may not exist yet —
  // fails silently to an empty list (same graceful behaviour as desktop).
  const { data: discData } = useQuery({
    queryKey: ['discount'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; discounts: Discount[] }>('/api/discount');
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
    retry: false,
  });
  const discounts: Discount[] = discData?.discounts ?? [];

  // Apply a coupon OR a friend's referral code (mirrors desktop applyCoupon).
  // Backend /api/mall/redeem accepts both: a known coupon → discount; otherwise
  // it's treated as a referral code → the user earns coins.
  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) { setCouponMsg({ text: 'Please enter a coupon or referral code', success: false }); return; }
    setApplying(true);
    setCouponMsg(null);
    try {
      const res = await apiClient.post<{
        success: boolean; message: string;
        coupon?: { discount: number };
        referral?: { coinsAwarded: number };
      }>('/api/mall/redeem', { couponCode: code });

      if (res.data?.success) {
        if (res.data.coupon) {
          // Discount coupon applied → usable at checkout.
          setCouponMsg({ text: `✅ ${res.data.message} — ${res.data.coupon.discount}% off!`, success: true });
          queryClient.invalidateQueries({ queryKey: ['discount'] });
        } else {
          // Referral code applied → coins awarded to this user.
          setCouponMsg({ text: `✅ ${res.data.message}`, success: true });
          queryClient.invalidateQueries({ queryKey: ['coins'] });
          queryClient.invalidateQueries({ queryKey: ['referral'] });
        }
        queryClient.invalidateQueries({ queryKey: ['mall'] });
        setCouponCode('');
      } else {
        setCouponMsg({ text: `❌ ${res.data?.message || 'Invalid coupon or referral code'}`, success: false });
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
            queryClient.invalidateQueries({ queryKey: ['discount'] });
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

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
              <TouchableOpacity
                style={styles.historyBtn}
                onPress={() => scrollRef.current?.scrollTo({ y: historyY, animated: true })}
                activeOpacity={0.8}
                accessibilityLabel="View redemption history"
              >
                <Text style={styles.historyBtnText}>🕘 View History</Text>
              </TouchableOpacity>
            </View>

            {/* Coupon / Referral Code Section (mirrors desktop) */}
            <View style={styles.couponCard}>
              <Text style={styles.couponTitle}>🏷️ Have a coupon or referral code?</Text>
              <Text style={styles.couponSub}>Enter a coupon for a discount, or a friend's referral code to earn 50 coins.</Text>
              <View style={styles.couponRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholder="Coupon or referral code"
                  placeholderTextColor={Colors.muted}
                  value={couponCode}
                  onChangeText={setCouponCode}
                  autoCapitalize="characters"
                  numberOfLines={1}
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

            {/* Redemption / Discount history (mirrors desktop CK Mall) */}
            <View onLayout={(e) => setHistoryY(e.nativeEvent.layout.y)}>
              <Text style={styles.sectionTitle}>📜 Redemption History</Text>
              <Text style={styles.historySub}>Your redeemed rewards, discounts and coin activity.</Text>

              {discounts.length === 0 && transactions.length === 0 ? (
                <View style={styles.historyEmpty}>
                  <Text style={styles.historyEmptyText}>No redemptions yet. Redeem a reward above to see it here.</Text>
                </View>
              ) : (
                <View style={styles.historyList}>
                  {/* Usable discounts first — highlighted as ready to use */}
                  {discounts.map((d, i) => (
                    <View key={`disc-${d.id ?? i}`} style={[styles.historyItem, styles.historyItemActive]}>
                      <View style={[styles.historyIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                        <Text style={{ fontSize: 16 }}>🎟️</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.historyTitle} numberOfLines={1}>{d.label || `${d.percent}% Discount`}</Text>
                        <Text style={styles.historyMeta}>Ready to use at checkout</Text>
                      </View>
                      <View style={styles.historyBadge}><Text style={styles.historyBadgeText}>{d.percent}% OFF</Text></View>
                    </View>
                  ))}

                  {/* Coin transactions — most recent first */}
                  {transactions.map((tx) => {
                    const earned = tx.type === 'EARNED';
                    // Show WHEN it happened — date + time (redeemed/earned at).
                    let when = '';
                    try {
                      const d = new Date(tx.createdAt);
                      const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                      const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
                      when = `${date}, ${time}`;
                    } catch {}
                    return (
                      <View key={tx.id} style={styles.historyItem}>
                        <View style={[styles.historyIcon, { backgroundColor: earned ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                          <Text style={{ fontSize: 16 }}>{earned ? '🪙' : '🎁'}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.historyTitle} numberOfLines={1}>{tx.reason || (earned ? 'Coins earned' : 'Coins spent')}</Text>
                          <Text style={styles.historyMeta}>{when}</Text>
                        </View>
                        <Text style={[styles.historyAmt, { color: earned ? Colors.success : Colors.danger }]}>
                          {earned ? '+' : '-'}{tx.coins}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
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
  historyBtn: {
    marginTop: 14, backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8,
  },
  historyBtnText: { color: Colors.coin, fontSize: 13, fontWeight: '700' },

  // Redemption history
  historySub: { color: Colors.muted, fontSize: 12, marginTop: 4, marginBottom: 14 },
  historyEmpty: {
    backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed', borderRadius: 14, padding: 22, alignItems: 'center',
  },
  historyEmptyText: { color: Colors.muted, fontSize: 13, textAlign: 'center' },
  historyList: { gap: 10 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  historyItemActive: { borderColor: 'rgba(34,197,94,0.35)' },
  historyIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  historyMeta: { color: Colors.muted, fontSize: 11, marginTop: 2 },
  historyAmt: { fontSize: 15, fontWeight: '800' },
  historyBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  historyBadgeText: { color: Colors.success, fontSize: 12, fontWeight: '800' },

  // Coupon
  couponCard: {
    backgroundColor: Colors.card2, borderRadius: 16, padding: 18,
    marginBottom: 20, borderWidth: 1, borderColor: Colors.border,
  },
  couponTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  couponSub: { color: Colors.muted, fontSize: 11.5, marginBottom: 12, lineHeight: 16 },
  couponRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  couponInput: {
    flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, color: '#fff', fontSize: 13,
    textTransform: 'uppercase',
  },
  couponBtn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center',
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
