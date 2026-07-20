import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api';
import { Colors } from '@/theme';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyPurchasesScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; orders: any[]; totalOrders: number; totalSpent: number }>('/api/student/orders');
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const orders = data?.orders ?? [];
  const totalOrders = data?.totalOrders ?? orders.length;
  const totalSpent = data?.totalSpent ?? 0;
  const successfulCount = orders.filter((o: any) => o.status === 'success').length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Purchases</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading purchases...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyTitle}>No purchases yet</Text>
            <Text style={styles.emptyText}>Enroll in a course to get started!</Text>
          </View>
        ) : (
          <>
            {/* Stats Summary — 3 cards */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: Colors.primary }]}>{totalOrders}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: Colors.success }]}>₹{totalSpent}</Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: Colors.warning }]}>{successfulCount}</Text>
                <Text style={styles.statLabel}>Successful</Text>
              </View>
            </View>

            {/* Order List */}
            {orders.map((order: any, idx: number) => {
              const statusColor = order.status === 'success' ? Colors.success : order.status === 'failed' ? Colors.danger : Colors.warning;
              return (
                <View key={order.id || idx} style={styles.orderCard}>
                  <View style={styles.orderIcon}>
                    <Text style={{ fontSize: 20 }}>📚</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderTitle}>{order.courseTitle || 'Course Purchase'}</Text>
                    <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.orderAmount}>₹{order.amount}</Text>
                    <Text style={[styles.orderStatus, { color: statusColor }]}>
                      {order.status === 'success' ? 'Success' : order.status === 'failed' ? 'Failed' : 'Pending'}
                    </Text>
                  </View>
                </View>
              );
            })}
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
  emptyState: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: Colors.muted, fontSize: 13, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: Colors.card2, borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: Colors.muted, fontSize: 11 },
  orderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card2, borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  orderIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  orderTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  orderDate: { color: Colors.muted, fontSize: 12 },
  orderAmount: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  orderStatus: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});
