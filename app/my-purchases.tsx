import { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api';
import { Colors } from '@/theme';

const PER_PAGE = 6;

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Course logo emoji by title (mobile version of desktop _ordCourseLogo)
function courseLogo(title?: string): { emoji: string; bg: string } {
  const ct = (title || '').toLowerCase().trim();
  if (ct.includes('java') && !ct.includes('javascript')) return { emoji: '☕', bg: 'rgba(249,115,22,0.12)' };
  if (ct.includes('python')) return { emoji: '🐍', bg: 'rgba(16,185,129,0.12)' };
  if (ct === 'c' || ct.startsWith('c ') || ct.includes('c programming') || ct.includes('c lang')) return { emoji: '⚙️', bg: 'rgba(34,211,238,0.12)' };
  if (ct.includes('javascript') || ct.includes(' js')) return { emoji: '📜', bg: 'rgba(251,191,36,0.12)' };
  if (ct.includes('html') || ct.includes('web')) return { emoji: '🌐', bg: 'rgba(239,68,68,0.12)' };
  if (ct.includes('react')) return { emoji: '⚛️', bg: 'rgba(34,211,238,0.12)' };
  return { emoji: '📚', bg: 'rgba(139,92,246,0.1)' };
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
  const totalSpent = data?.totalSpent ?? 0;
  const successCount = orders.filter((o: any) => o.status === 'success').length;
  const pendingCount = orders.filter((o: any) => o.status !== 'success').length;

  // Controls state
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [sort, setSort] = useState<'latest' | 'oldest'>('latest');
  const [page, setPage] = useState(1);

  // Stable order-number map (oldest = #0001) — deterministic, mirrors desktop
  const orderNumMap = useMemo(() => {
    const byOldest = [...orders].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const map: Record<string, number> = {};
    byOldest.forEach((o: any, i: number) => { map[o.id] = i + 1; });
    return map;
  }, [orders]);

  const orderIdLabel = (o: any) => `#CKD-ORD-${String(orderNumMap[o.id] || 0).padStart(4, '0')}`;

  // Filter + search + sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = orders.filter((o: any) => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (q) {
        const title = (o.courseTitle || '').toLowerCase();
        const isIdQuery = /[0-9#]/.test(q) || q.includes('ord') || q.includes('ckd');
        const matchTitle = title.includes(q);
        const matchId = isIdQuery && orderIdLabel(o).toLowerCase().includes(q.replace(/\s+/g, ''));
        if (!matchTitle && !matchId) return false;
      }
      return true;
    });
    list = [...list].sort((a: any, b: any) =>
      sort === 'oldest'
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, search, filter, sort, orderNumMap]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageOrders = filtered.slice((safePage - 1) * PER_PAGE, (safePage - 1) * PER_PAGE + PER_PAGE);
  const showFrom = filtered.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
  const showTo = Math.min(safePage * PER_PAGE, filtered.length);

  const applyControls = (fn: () => void) => { fn(); setPage(1); };

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
            <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/(tabs)/courses')}>
              <Text style={styles.exploreBtnText}>Explore Courses</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* KPI cards (Purchased / Total Spent / Pending) */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: Colors.success }]}>{successCount}</Text>
                <Text style={styles.statLabel}>Purchased</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: '#ec4899' }]}>₹{totalSpent}</Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: Colors.warning }]}>{pendingCount}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by course or order ID"
                placeholderTextColor={Colors.muted}
                value={search}
                onChangeText={(t) => applyControls(() => setSearch(t))}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Status filter chips */}
            <View style={styles.filterRow}>
              {(['all', 'success', 'failed', 'pending'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, filter === f && styles.filterChipActive]}
                  onPress={() => applyControls(() => setFilter(f))}
                >
                  <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                    {f === 'all' ? 'All' : f === 'success' ? 'Success' : f === 'failed' ? 'Failed' : 'Pending'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Order history header + sort toggle */}
            <View style={styles.historyHead}>
              <Text style={styles.historyTitle}>Order History</Text>
              <TouchableOpacity
                style={styles.sortBtn}
                onPress={() => applyControls(() => setSort((s) => (s === 'latest' ? 'oldest' : 'latest')))}
              >
                <Text style={styles.sortText}>{sort === 'latest' ? 'Latest First' : 'Oldest First'} ⇅</Text>
              </TouchableOpacity>
            </View>

            {/* Order cards */}
            {pageOrders.length === 0 ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No orders found. Try a different search or filter.</Text>
              </View>
            ) : (
              pageOrders.map((order: any, idx: number) => {
                const isSuccess = order.status === 'success';
                const isFailed = order.status === 'failed';
                const statusColor = isSuccess ? Colors.success : isFailed ? Colors.danger : Colors.warning;
                const statusLabel = isSuccess ? '✓ Successful' : isFailed ? '✗ Failed' : '● Pending';
                const logo = courseLogo(order.courseTitle);
                return (
                  <View key={order.id || idx} style={[styles.orderCard, { borderLeftColor: statusColor }]}>
                    <View style={[styles.orderIcon, { backgroundColor: logo.bg }]}>
                      <Text style={{ fontSize: 20 }}>{logo.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.orderTitle} numberOfLines={1}>{order.courseTitle || 'Course Purchase'}</Text>
                      <Text style={styles.orderId}>Order ID: {orderIdLabel(order)}</Text>
                      <Text style={styles.orderDate}>📅 {formatDate(order.createdAt)} • {formatTime(order.createdAt)}</Text>
                      {order.courseId ? (
                        <TouchableOpacity onPress={() => router.push(`/course/${order.courseId}`)}>
                          <Text style={styles.viewDetails}>View Details ›</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.orderAmount}>₹{order.amount}</Text>
                      <Text style={[styles.orderStatus, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>
                );
              })
            )}

            {/* Footer: count + pagination */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Showing {showFrom} to {showTo} of {filtered.length} orders
              </Text>
              {totalPages > 1 && (
                <View style={styles.pagination}>
                  <TouchableOpacity
                    style={[styles.pageBtn, safePage <= 1 && styles.pageBtnDisabled]}
                    disabled={safePage <= 1}
                    onPress={() => setPage(safePage - 1)}
                  >
                    <Text style={styles.pageBtnText}>‹</Text>
                  </TouchableOpacity>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.pageBtn, p === safePage && styles.pageBtnActive]}
                      onPress={() => setPage(p)}
                    >
                      <Text style={[styles.pageBtnText, p === safePage && styles.pageBtnTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.pageBtn, safePage >= totalPages && styles.pageBtnDisabled]}
                    disabled={safePage >= totalPages}
                    onPress={() => setPage(safePage + 1)}
                  >
                    <Text style={styles.pageBtnText}>›</Text>
                  </TouchableOpacity>
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
  emptyState: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: Colors.muted, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  exploreBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  exploreBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: Colors.card2, borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: Colors.muted, fontSize: 11 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card2, borderRadius: 12,
    paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 11 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: 'rgba(108,71,255,0.15)', borderColor: Colors.primary },
  filterChipText: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: Colors.primary },

  historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  historyTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sortBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: Colors.border,
  },
  sortText: { color: Colors.muted, fontSize: 12, fontWeight: '600' },

  orderCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: Colors.card2, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3,
  },
  orderIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  orderTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  orderId: { color: Colors.muted, fontSize: 11, marginBottom: 2 },
  orderDate: { color: Colors.muted, fontSize: 11, marginBottom: 4 },
  viewDetails: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  orderAmount: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  orderStatus: { fontSize: 11, fontWeight: '700' },

  noResults: { alignItems: 'center', padding: 30 },
  noResultsText: { color: Colors.muted, fontSize: 13, textAlign: 'center' },

  footer: { marginTop: 8, alignItems: 'center', gap: 12 },
  footerText: { color: Colors.muted, fontSize: 12 },
  pagination: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  pageBtn: {
    minWidth: 34, height: 34, borderRadius: 8, paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  pageBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  pageBtnTextActive: { color: '#fff' },
});
