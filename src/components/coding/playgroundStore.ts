/**
 * On-device storage for the Code Editor page — same keys and shapes as the
 * desktop playground (ck_coding_score_<uid>, ck_my_problems_<uid>, ck_pg_…),
 * kept in AsyncStorage (SecureStore is limited to ~2 KB per value).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playgroundApi, type PlaygroundProblem } from '@/api';

const uid = (u?: string) => u || 'anon';

// ── Saved code per problem + language ────────────────────────────────────────
const pgCodeKey = (u: string | undefined, pid: string, lang: string) => `ck_pg_${uid(u)}_${pid}_${lang}`;
export const loadPgCode = (u: string | undefined, pid: string, lang: string) =>
  AsyncStorage.getItem(pgCodeKey(u, pid, lang)).catch(() => null);
export const savePgCode = (u: string | undefined, pid: string, lang: string, code: string) =>
  AsyncStorage.setItem(pgCodeKey(u, pid, lang), code).catch(() => {});

// ── My Problems ──────────────────────────────────────────────────────────────
const myKey = (u?: string) => `ck_my_problems_${uid(u)}`;

export async function loadMyProblems(u?: string): Promise<PlaygroundProblem[]> {
  try { return JSON.parse((await AsyncStorage.getItem(myKey(u))) || '[]'); } catch { return []; }
}
export async function saveMyProblems(u: string | undefined, list: PlaygroundProblem[]) {
  try { await AsyncStorage.setItem(myKey(u), JSON.stringify(list)); } catch { /* ignore */ }
}

// ── Submission history (per problem, local — same as desktop) ────────────────
export interface PgSubmission {
  at: string;
  language: string;
  status: 'accepted' | 'failed' | 'submitted';
  passed: number;
  total: number;
}
const histKey = (u: string | undefined, pid: string) => `ck_pg_hist_${uid(u)}_${pid}`;

export async function loadHistory(u: string | undefined, pid: string): Promise<PgSubmission[]> {
  try { return JSON.parse((await AsyncStorage.getItem(histKey(u, pid))) || '[]'); } catch { return []; }
}
export async function addHistory(u: string | undefined, pid: string, s: PgSubmission): Promise<PgSubmission[]> {
  const list = [s, ...(await loadHistory(u, pid))].slice(0, 20);
  try { await AsyncStorage.setItem(histKey(u, pid), JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}

// ── Coding score / streak ────────────────────────────────────────────────────
export interface SolvedItem {
  problemId: string; title: string; difficulty: string;
  points: number; coins: number; solvedAt: string; language: string;
}
export interface ScoreData {
  solvedProblems: SolvedItem[];
  totalPoints: number;
  totalCoins: number;
  submissionCalendar: Record<string, number>;
  streakRewards: string[];
}
export const CODING_POINTS: Record<string, number> = { easy: 2, medium: 4, hard: 8 };

const scoreKey = (u?: string) => `ck_coding_score_${uid(u)}`;
const dayKey = (d: Date) => d.toISOString().split('T')[0]; // UTC, like desktop

export async function scoreGet(u?: string): Promise<ScoreData> {
  let d: Partial<ScoreData> = {};
  try { d = JSON.parse((await AsyncStorage.getItem(scoreKey(u))) || '{}'); } catch { /* fresh */ }
  return {
    solvedProblems: d.solvedProblems || [],
    totalPoints: d.totalPoints || 0,
    totalCoins: d.totalCoins || 0,
    submissionCalendar: d.submissionCalendar || {},
    streakRewards: d.streakRewards || [],
  };
}

export function currentStreak(cal: Record<string, number>): number {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if ((cal[dayKey(d)] || 0) > 0) streak++; else break;
  }
  return streak;
}

function checkStreakBonus(data: ScoreData): boolean {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if ((data.submissionCalendar[dayKey(d)] || 0) > 0) streak++; else break;
  }
  if (streak >= 7 && streak % 7 === 0) {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const key = `${dayKey(start)}_to_${dayKey(today)}`;
    if (!data.streakRewards.includes(key)) {
      data.streakRewards.push(key);
      data.totalCoins += 10;
      return true;
    }
  }
  return false;
}

/** First accepted solve only → points + coins (+ 7-day streak bonus). */
export async function scoreAward(
  u: string | undefined, problemId: string, title: string, difficulty: string, language: string
): Promise<{ awarded: boolean; points?: number; coins?: number; streakBonus?: boolean }> {
  const data = await scoreGet(u);
  if (data.solvedProblems.some((p) => p.problemId === problemId)) return { awarded: false };

  const points = CODING_POINTS[difficulty] || 2;
  const coins = points * 2;
  data.solvedProblems.push({ problemId, title, difficulty, points, coins, solvedAt: new Date().toISOString(), language });
  data.totalPoints += points;
  data.totalCoins += coins;
  const today = dayKey(new Date());
  data.submissionCalendar[today] = (data.submissionCalendar[today] || 0) + 1;
  const streakBonus = checkStreakBonus(data);
  try { await AsyncStorage.setItem(scoreKey(u), JSON.stringify(data)); } catch { /* ignore */ }

  // Server coins — non-blocking, like desktop.
  playgroundApi.scoreEarn({ problemId, problemTitle: title, difficulty, points, coins }).catch(() => {});
  if (streakBonus) {
    playgroundApi.scoreEarn({
      problemId: `streak_bonus_${today}`, problemTitle: '7-Day Streak Bonus', difficulty: 'streak', points: 0, coins: 10,
    }).catch(() => {});
  }
  return { awarded: true, points, coins, streakBonus };
}

export { dayKey };
