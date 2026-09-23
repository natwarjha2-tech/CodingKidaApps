import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { coinsApi } from '@/api';
import { useAuthStore } from '@/store';
import { formatCoinTx } from '@/utils/coinTx.util';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';

interface CoinsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CoinsModal({ visible, onClose }: CoinsModalProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data, isLoading } = useQuery({
    queryKey: ['coins'],
    queryFn: () => coinsApi.get(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
  });

  const totalCoins = data?.totalCoins ?? 0;
  const transactions = data?.transactions ?? [];

  // Show date + time (not just time) so users know WHEN a coin was credited.
  // e.g. "12 Sep, 12:30 PM"
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${date}, ${time}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🪙 My Coins</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Total Coins */}
          <View style={styles.totalSection}>
            <Text style={styles.totalCoins}>
              {isLoading ? '—' : totalCoins}
            </Text>
            <Text style={styles.totalLabel}>Total Coins Earned</Text>
          </View>

          {/* Recent Rewards */}
          <Text style={styles.sectionLabel}>Recent Rewards</Text>
          <ScrollView style={styles.transactions} showsVerticalScrollIndicator={false}>
            {transactions.length === 0 ? (
              <Text style={styles.emptyText}>No rewards yet. Complete quizzes to earn coins!</Text>
            ) : (
              transactions.map((tx, i) => {
                const disp = formatCoinTx(tx);
                return (
                  <View key={i} style={styles.txItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txReason} numberOfLines={2}>{disp.title}</Text>
                      {disp.subtitle ? (
                        <Text style={styles.txSub} numberOfLines={2}>{disp.subtitle}</Text>
                      ) : null}
                    </View>
                    <Text style={[
                      styles.txCoins,
                      { color: tx.type === 'EARNED' ? Colors.success : Colors.danger },
                    ]}>
                      {tx.type === 'EARNED' ? '+' : '-'}{tx.coins}
                    </Text>
                    <Text style={styles.txTime}>{formatDate(tx.createdAt)}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>100+ coins = ₹ discount on next course</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.bg2,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: FontWeight.bold,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: Colors.muted, fontSize: Typography.sm },
  totalSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
  totalCoins: {
    fontSize: 36,
    fontWeight: FontWeight.extrabold,
    color: Colors.coin,
  },
  totalLabel: {
    color: Colors.muted,
    fontSize: Typography.xs,
    marginTop: 4,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: Typography.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  transactions: {
    maxHeight: 200,
  },
  emptyText: {
    color: Colors.muted,
    fontSize: Typography.sm,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: Spacing.sm,
  },
  txReason: {
    color: Colors.text,
    fontSize: Typography.sm,
    fontWeight: FontWeight.semibold,
  },
  txSub: {
    color: Colors.muted,
    fontSize: Typography.xs,
    marginTop: 2,
    lineHeight: 15,
  },
  txCoins: {
    fontSize: Typography.sm,
    fontWeight: FontWeight.bold,
  },
  txTime: {
    color: Colors.muted,
    fontSize: Typography.xs,
    maxWidth: 92,
    textAlign: 'right',
  },
  footer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  footerText: {
    color: Colors.muted,
    fontSize: Typography.xs,
  },
});
