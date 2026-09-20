// Shared formatter for a coin transaction's "where it came from" hierarchy.
// Quiz-reward transactions carry Course → Module → Lesson (from the backend);
// referral / coupon / coding transactions don't, so we fall back to the reason
// string. Used by the Coins modal and the My Report coins list (no duplication).
import type { CoinTransaction } from '@/types';

export interface CoinTxDisplay {
  title: string;        // primary line (course / module, or the reason)
  subtitle: string;     // secondary line (lesson + reward), '' when none
  hasHierarchy: boolean;
}

export function formatCoinTx(tx: CoinTransaction): CoinTxDisplay {
  const course = tx.courseTitle || '';
  const mod = tx.moduleTitle || '';
  const lesson = tx.lessonTitle || '';

  if (course || lesson) {
    // Primary: Course · Module (whichever present). Secondary: Lesson + reason.
    const top = [course, mod].filter(Boolean).join(' · ');
    const bottom = [lesson, tx.reason].filter(Boolean).join(' · ');
    return { title: top || tx.reason, subtitle: top ? bottom : '', hasHierarchy: true };
  }
  // No hierarchy (referral / coupon / coding) — just the reason.
  return { title: tx.reason, subtitle: '', hasHierarchy: false };
}
