/**
 * Weekly Coding Challenge — one logic program per week for every student
 * (backend: /api/weekly-coding). Passing all tests gives 10 coins, once a week.
 */
import { apiClient } from './client';
import type { CodeSubmitResult } from './code.api';

export interface WeeklyCodingExercise {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  language: string | null;
  starterCode: string | null;
  inputFormat: string | null;
  outputFormat: string | null;
  constraints: string | null;
  hints: unknown;
  lessonId: string;
  courseId: string | null;
  courseTitle: string | null;
  samples: { input: string; expectedOutput: string }[];
}

export interface WeeklyCodingInfo {
  success: boolean;
  week: { key: string; start: string; end: string };
  /** Coins for the first solver ("up to"). */
  reward: number;
  rewards?: { champion: number; finalist: number; solver: number };
  xp?: number;
  completed: boolean;
  completedAt: string | null;
  coinsEarned?: number;
  medal?: { key: string; label: string; icon: string } | null;
  exercise: WeeklyCodingExercise | null;
}

export type WeeklyCodingSubmitResult = CodeSubmitResult;

export interface WeeklyCodingBoardEntry {
  rank: number;
  name: string;
  solvedAt: string;
  weeksSolved: number;
  isCurrentUser: boolean;
}

export interface WeeklyCodingBoard {
  success: boolean;
  week: { key: string; start: string; end: string };
  leaderboard: WeeklyCodingBoardEntry[];
  totalSolvers: number;
  currentUserRank: { rank: number; totalSolvers: number } | null;
}

export const weeklyCodingApi = {
  get: () => apiClient.get<WeeklyCodingInfo>('/api/weekly-coding').then((r) => r.data),
  submit: (body: { exerciseId: string; source_code: string; language_id: number }) =>
    apiClient.post<WeeklyCodingSubmitResult>('/api/weekly-coding/submit', body, { timeout: 60000 }).then((r) => r.data),
  leaderboard: () => apiClient.get<WeeklyCodingBoard>('/api/weekly-coding/leaderboard').then((r) => r.data),
};
