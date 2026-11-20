import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { XPService, type LevelInfo, type Badge } from '@/services';
import { xpApi, type ServerXp } from '@/api/xp.api';

export interface XPSnapshot {
  ready: boolean;
  level: LevelInfo;
  badges: Badge[];
  unlockedCount: number;
  nextBadge: Badge | null;
  streak: number;
  /** Server XP details (how XP was earned + how much each action gives). Null until loaded. */
  server: ServerXp | null;
}

/**
 * XP and level. The level and XP come from the SERVER (GET /api/xp), so they
 * are the same on every device. Refreshed whenever a screen using it comes
 * into view (e.g. back on the dashboard after a lesson or quiz).
 * Local XPService is only kept for the small extra badges and the day streak.
 */
export function useXP(): XPSnapshot {
  const user = useAuthStore((s) => s.user);
  const [, force] = useState(0);
  const [localReady, setLocalReady] = useState(false);
  const refresh = useCallback(() => force((n) => n + 1), []);

  const q = useQuery({
    queryKey: ['xp', user?.id],
    queryFn: () => xpApi.get(),
    enabled: !!user?.id,
    staleTime: 15_000,
  });

  useFocusEffect(useCallback(() => { if (user?.id) q.refetch(); }, [user?.id])); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let mounted = true;
    if (user?.id) {
      XPService.init(user.id).then(() => { if (mounted) setLocalReady(true); });
    }
    const unsub = XPService.subscribe(refresh);
    return () => { mounted = false; unsub(); };
  }, [user?.id, refresh]);

  const s = q.data ?? null;
  const level: LevelInfo = s
    ? { level: s.level, title: s.title, xp: s.xp, floor: s.floor, next: s.next, ceil: s.ceil, toNext: s.toNext, progressPct: s.progressPct }
    : { level: 1, title: 'Starter', xp: 0, floor: 0, next: { level: 2, title: 'Explorer', min: 100 }, ceil: 100, toNext: 100, progressPct: 0 };

  const badges = XPService.getBadges();
  return {
    ready: !!s || localReady,
    level,
    badges,
    unlockedCount: badges.filter((b) => b.unlocked).length,
    nextBadge: badges.find((b) => !b.unlocked) ?? null,
    streak: XPService.getCurrentStreak(),
    server: s,
  };
}
