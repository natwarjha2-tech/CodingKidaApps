import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  syncNotifications,
  getCachedNotifications,
  type NotifItem,
  type NotifSyncResult,
} from '@/services/notification.service';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const;

/**
 * Notifications via React Query — same instant behaviour as the rest of the app.
 *
 * - `initialData` is seeded from the AsyncStorage cache so the list renders
 *   INSTANTLY (no spinner) while a fresh sync runs in the background.
 * - `queryFn` always fetches the full latest list (fixes the disappearing bug)
 *   and replaces the cache.
 * - The unified 🔄 refresh (`invalidateQueries()`) refetches this too, so the
 *   badge + list stay consistent everywhere. No duplication.
 */
export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery<NotifSyncResult>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: syncNotifications,
    staleTime: 1000 * 30, // 30s — fresh enough, avoids refetch storms
    // Seed from cache the first time so there is no loading spinner if we have
    // anything stored. React Query treats seeded data as already-available.
    placeholderData: (prev) => prev,
  });

  // Warm the query with the on-disk cache on mount (one-shot). This gives an
  // instant first paint even before the network sync resolves.
  useEffect(() => {
    let cancelled = false;
    if (!query.data) {
      getCachedNotifications().then((items) => {
        if (cancelled || items.length === 0) return;
        const existing = queryClient.getQueryData<NotifSyncResult>(NOTIFICATIONS_QUERY_KEY);
        if (!existing) {
          queryClient.setQueryData<NotifSyncResult>(NOTIFICATIONS_QUERY_KEY, {
            items,
            nextCursor: null,
            unreadCount: items.filter((n) => !n.read).length,
          });
        }
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return query;
}

/**
 * Prefetch notifications so the page opens instantly (used on Dashboard mount,
 * mirroring usePrefetchDashboard). Safe to call repeatedly.
 */
export function usePrefetchNotifications() {
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: NOTIFICATIONS_QUERY_KEY,
      queryFn: syncNotifications,
      staleTime: 1000 * 30,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Optimistically patch the notifications query cache (used by mark-read /
 * delete / clear so the UI + badge update instantly without a refetch).
 */
export function patchNotificationsCache(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (items: NotifItem[]) => NotifItem[]
) {
  const existing = queryClient.getQueryData<NotifSyncResult>(NOTIFICATIONS_QUERY_KEY);
  const items = updater(existing?.items ?? []);
  queryClient.setQueryData<NotifSyncResult>(NOTIFICATIONS_QUERY_KEY, {
    items,
    nextCursor: existing?.nextCursor ?? null,
    unreadCount: items.filter((n) => !n.read).length,
  });
}
