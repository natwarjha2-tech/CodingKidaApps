// Shared formatter for a coin transaction's "where it came from" hierarchy.
// Quiz-reward transactions carry Course → Module → Lesson (from the backend);
// referral / coupon / coding transactions don't, so we just show the reason.
// Used by the Coins modal and the My Report coins list (no duplication).
//
// Layout mirrors the desktop app exactly (coins.js `_coinTxContext` + row render):
//   Line 1 (primary):   the reason (e.g. "Quiz Rank 1 Reward")
//   Line 2 (secondary): "Course · Module · Lesson" (all present parts, joined),
//                        or '' when the transaction isn't lesson-based.
import type { CoinTransaction } from '@/types';

export interface CoinTxDisplay {
  title: string;        // primary line — the reason
  subtitle: string;     // secondary line — Course · Module · Lesson, '' when none
  hasHierarchy: boolean;
}

export function formatCoinTx(tx: CoinTransaction): CoinTxDisplay {
  const context = [tx.courseTitle, tx.moduleTitle, tx.lessonTitle]
    .filter((x) => x && String(x).trim())
    .join(' · ');
  return {
    title: tx.reason,
    subtitle: context,
    hasHierarchy: context.length > 0,
  };
}
