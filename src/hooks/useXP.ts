import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store';
import { XPService, type LevelInfo, type Badge } from '@/services';

export interface XPSnapshot {
  ready: boolean;
  level: LevelInfo;
  badges: Badge[];
  unlockedCount: number;
  nextBadge: Badge | null;
  streak: number;
}

/**
 * Reactive hook over the frontend XP service. Loads state for the current
 * user and re-renders whenever XP changes (awardXP / markDailyLearning).
 */
export function useXP(): XPSnapshot {
  const user = useAuthStore((s) => s.user);
  const [, force] = useState(0);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => force((n) => n + 1), []);

  useEffect(() => {
    let mounted = true;
    if (user?.id) {
      XPService.init(user.id).then(() => {
        if (mounted) setReady(true);
      });
    }
    const unsub = XPService.subscribe(refresh);
    return () => { mounted = false; unsub(); };
  }, [user?.id, refresh]);

  const badges = XPService.getBadges();
  return {
    ready,
    level: XPService.getLevelInfo(),
    badges,
    unlockedCount: badges.filter((b) => b.unlocked).length,
    nextBadge: badges.find((b) => !b.unlocked) ?? null,
    streak: XPService.getCurrentStreak(),
  };
}
