import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/theme';
import { useNotifications, patchNotificationsCache, NOTIFICATIONS_QUERY_KEY } from '@/hooks';
import {
  markNotifAsRead,
  markAllNotifsAsRead,
  deleteNotif,
  clearAllNotifs,
  type NotifItem,
} from '@/services/notification.service';

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function getIcon(type: string): string {
  switch (type) {
    case 'course_enrolled':    return '✅';
    case 'payment_failed':     return '❌';
    case 'new_course':         return '🚀';
    case 'achievement':        return '🏆';
    case 'weekly_streak':      return '🔥';
    case 'leaderboard_winner': return '🥇';
    case 'app_update':         return '🔄';
    case 'coins_earned':       return '🪙';
    case 'coins_spent':        return '🪙';
    case 'badge_lost':         return '📊';
    case 'password_changed':   return '🔒';
    case 'new_homework':       return '📝';
    case 'coupon_redeemed':    return '🎁';
    case 'welcome':            return '🚀';
    case 'download_expiring':  return '⏳';
    case 'custom':             return '📣';
    default:                   return '🔔';
  }
}

// Soft light tints for the notification icon container (light theme).
function getIconBg(type: string): string {
  switch (type) {
    case 'course_enrolled':    return '#E4F8EC'; // green
    case 'payment_failed':     return '#FCE4EE'; // red
    case 'new_course':         return '#EEE9FF'; // purple
    case 'achievement':        return '#FFF3DC'; // amber
    case 'weekly_streak':      return '#FFE9DC'; // orange
    case 'leaderboard_winner': return '#FFF3DC'; // amber
    case 'app_update':         return '#E6EEFF'; // blue
    case 'coins_earned':       return '#FFF3DC'; // amber
    case 'coins_spent':        return '#EEE9FF'; // purple
    case 'badge_lost':         return '#E6EEFF'; // blue
    case 'password_changed':   return '#FCE4EE'; // red
    case 'new_homework':       return '#E4F8EC'; // green
    case 'coupon_redeemed':    return '#EEE9FF'; // purple
    case 'welcome':            return '#EEE9FF'; // purple
    case 'download_expiring':  return '#FFE9DC'; // orange
    default:                   return '#EEF0F5'; // neutral
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 172800000) return 'Yesterday';
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ═══════════════════════════════════════════════════════
// NOTIFICATION ITEM COMPONENT
// ═══════════════════════════════════════════════════════

function NotifCard({
  item,
  onPress,
  onDelete,
}: {
  item: NotifItem;
  onPress: (item: NotifItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, !item.read && styles.cardUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {/* Unread dot */}
      {!item.read && <View style={styles.unreadDot} />}

      <View style={[styles.iconBox, { backgroundColor: getIconBg(item.type) }]}>
        <Text style={styles.iconText}>{getIcon(item.type)}</Text>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => onDelete(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.deleteBtnText}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════
// NOTIFICATIONS SCREEN
// ═══════════════════════════════════════════════════════

export default function NotificationsScreen() {
  const params = useLocalSearchParams<{ open?: string }>();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<NotifItem | null>(null); // popup detail
  const [refreshing, setRefreshing] = useState(false);

  // React Query → instant render from cache, fresh sync in background.
  const { data, isLoading, refetch } = useNotifications();
  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  // Only show the full-screen spinner when there is genuinely nothing to show
  // yet (first ever load with an empty cache). Otherwise render instantly.
  const loading = isLoading && items.length === 0;

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // ── Handlers ── (optimistic cache patches → instant UI + consistent badge)

  const handlePress = useCallback((item: NotifItem) => {
    if (!item.read) {
      patchNotificationsCache(queryClient, (list) => list.map(n => n.id === item.id ? { ...n, read: true } : n));
      markNotifAsRead(item.id); // fire & forget
    }
    // Open detail popup (NO navigation / page redirect)
    setSelected({ ...item, read: true });
  }, [queryClient]);

  // Auto-open a specific notification popup when arriving via push tap (?open=<id>)
  useEffect(() => {
    if (!params.open || items.length === 0) return;
    const match = items.find(n => n.id === params.open);
    if (match) handlePress(match);
  }, [params.open, items, handlePress]);

  const handleDelete = useCallback(async (id: string) => {
    patchNotificationsCache(queryClient, (list) => list.filter(n => n.id !== id));
    deleteNotif(id); // fire & forget
  }, [queryClient]);

  const handleMarkAllRead = useCallback(async () => {
    patchNotificationsCache(queryClient, (list) => list.map(n => ({ ...n, read: true })));
    markAllNotifsAsRead(); // fire & forget
  }, [queryClient]);

  const handleClearAll = useCallback(() => {
    Alert.alert('Clear All', 'Are you sure you want to delete all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: () => {
          queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, { items: [], nextCursor: null, unreadCount: 0 });
          clearAllNotifs(); // fire & forget (also clears the AsyncStorage cache)
        },
      },
    ]);
  }, [queryClient]);

  // ── Render ──

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
        </Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>Read all</Text>
            </TouchableOpacity>
          )}
          {items.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={[styles.headerBtn, styles.headerBtnDanger]}>
              <Text style={[styles.headerBtnText, styles.headerBtnTextDanger]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.purple} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>You'll see course updates, achievements, and more here.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <NotifCard item={item} onPress={handlePress} onDelete={handleDelete} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadNotifications(true)}
              tintColor={Colors.purple}
            />
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Detail Popup Modal — full notification detail + close button */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelected(null)}
        >
          <TouchableOpacity style={styles.modalCard} activeOpacity={1}>
            {selected && (
              <>
                {/* Header: icon + close */}
                <View style={styles.modalHeader}>
                  <View style={[styles.modalIconBox, { backgroundColor: getIconBg(selected.type) }]}>
                    <Text style={styles.modalIconText}>{getIcon(selected.type)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelected(null)}
                    style={styles.modalCloseBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Body: title + full message + time */}
                <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
                  <Text style={styles.modalTitle}>{selected.title}</Text>
                  <Text style={styles.modalMessage}>{selected.body}</Text>
                  <Text style={styles.modalTime}>{timeAgo(selected.createdAt)}</Text>
                </ScrollView>

                {/* Footer: close button */}
                <View style={styles.modalFooter}>
                  <TouchableOpacity style={styles.modalFooterBtn} onPress={() => setSelected(null)}>
                    <Text style={styles.modalFooterBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { paddingRight: 12 },
  backBtnText: { color: Colors.purple, fontSize: 14, fontWeight: '600' },
  headerTitle: { flex: 1, color: Colors.text, fontSize: 17, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
  headerBtnDanger: { backgroundColor: 'rgba(239,68,68,0.1)' },
  headerBtnText: { color: Colors.purple, fontSize: 12, fontWeight: '600' },
  headerBtnTextDanger: { color: '#ef4444' },

  list: { padding: 12 },
  separator: { height: 8 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.bg2,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  cardUnread: {
    borderColor: 'rgba(124,58,237,0.35)',
    backgroundColor: 'rgba(124,58,237,0.06)',
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.purple,
  },

  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  iconText: { fontSize: 16 },

  cardContent: { flex: 1, paddingRight: 24 },
  cardTitle: { color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  cardBody: { color: Colors.muted, fontSize: 12, lineHeight: 17, marginBottom: 4 },
  cardTime: { color: Colors.muted, fontSize: 11 },

  deleteBtn: { padding: 4, alignSelf: 'flex-start' },
  deleteBtnText: { color: Colors.muted, fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // ── Detail popup modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '75%',
    backgroundColor: Colors.bg2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconText: { fontSize: 20 },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: { color: Colors.muted, fontSize: 14, fontWeight: '600' },

  modalBody: { paddingHorizontal: 18 },
  modalBodyContent: { paddingVertical: 18 },
  modalTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 10, lineHeight: 23 },
  modalMessage: { color: Colors.text, fontSize: 14, lineHeight: 22 },
  modalTime: { color: Colors.muted, fontSize: 12, marginTop: 14 },

  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalFooterBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.cardAlt,
  },
  modalFooterBtnText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
});
