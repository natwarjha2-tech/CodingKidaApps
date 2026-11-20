/**
 * XP (learning points) from the server — same on phone, desktop and website.
 * GET /api/xp → level, XP, what it came from, and how much each action gives.
 */
import { apiClient } from './client';

export interface ServerXp {
  level: number;
  title: string;
  xp: number;
  floor: number;
  ceil: number;
  next: { level: number; title: string; min: number } | null;
  toNext: number;
  progressPct: number;
  xpPerLevel: number;
  rewards: { video: number; quizCorrect: number; quizFinished: number; exercise: number; weekly: number };
  breakdown: Record<'videos' | 'quizCorrect' | 'quizzesFinished' | 'exercises' | 'weekly', { count: number; xp: number }>;
}

export const xpApi = {
  get: () => apiClient.get<{ success: boolean; xp: ServerXp }>('/api/xp').then((r) => r.data.xp),
};

/** Coding medals + coins earned from coding only (exercises, weekly challenge, Code Arena). */
export interface CodingBadge { key: string; label: string; icon: string; title: string; coins: number; earnedAt: string }
export interface CodingCoinRow { source: 'exercise' | 'weekly' | 'arena'; text: string; coins: number; at: string }
export interface CodingSubmissionRow {
  id: string; title: string; difficulty: string; language: string; passed: boolean; status: string; at: string;
}
export const codingBadgesApi = {
  get: () =>
    apiClient
      .get<{
        success: boolean; badges: CodingBadge[]; codingCoins: number; counts: Record<string, number>;
        history?: CodingCoinRow[]; submissions?: CodingSubmissionRow[];
      }>('/api/coding-badges')
      .then((r) => r.data),
};
