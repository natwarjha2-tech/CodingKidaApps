import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { coinsApi } from '@/api';
import { useAuthStore } from '@/store';
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
    enabled: isAuthenticated && visible,
    staleTime: 1000 * 60 * 2,
  });

  const totalCoins = data?.totalCoins ?? 0;
  const transactions = data?.transactions ?? [];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
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
              transactions.map((tx, i) => (
                <View key={i} style={styles.txItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txReason}>{tx.reason}</Text>
                  </View>
                  <Text style={[
                    styles.txCoins,
                    { color: tx.type === 'EARNED' ? Colors.success : Colors.danger },
                  ]}>
                    {tx.type === 'EARNED' ? '+' : '-'}{tx.coins}
                  </Text>
                  <Text style={styles.txTime}>{formatDate(tx.createdAt)}</Text>
                </View>
              ))
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
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: Spacing.sm,
  },
  txReason: {
    color: Colors.text,
    fontSize: Typography.sm,
  },
  txCoins: {
    fontSize: Typography.sm,
    fontWeight: FontWeight.bold,
  },
  txTime: {
    color: Colors.muted,
    fontSize: Typography.xs,
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
