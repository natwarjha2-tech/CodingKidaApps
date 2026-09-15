/**
 * CodingKida Mobile — Frontend-only XP / Gamification service
 * ────────────────────────────────────────────────────────────
 * Direct port of the desktop `xp.js`. Pure client-side, no backend calls.
 * Persists per-user under AsyncStorage key `ck_xp_<userId>`. XP is awarded by
 * hooking existing learning-action signals (lesson 80%/complete, quiz, exercise,
 * course complete, daily learning). Every award uses a unique action key so the
 * same action can never grant XP twice (anti-farming).
 *
 * NOTE: AsyncStorage is async, so this service caches state in-memory after
 * init() and writes through on every change. Call XPService.init(userId) once
 * (e.g. on the profile/lesson screen mount) before awarding/reading.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Centralized configuration (matches desktop exactly) ─────────────────────

export const XP_REWARDS = {
  lessonWatch80: 10,
  lessonComplete: 25,
  quizCorrect: 5,
  quizComplete: 20,
  exerciseComplete: 30,
  homeworkComplete: 40,
  courseComplete: 100,
  dailyLearning: 10,
} as const;

// Level thresholds — cumulative XP required to REACH each level.
export const XP_LEVELS = [
  { level: 1, title: 'Beginner', min: 0 },
  { level: 2, title: 'Learner', min: 200 },
  { level: 3, title: 'Explorer', min: 450 },
  { level: 4, title: 'Builder', min: 750 },
  { level: 5, title: 'Creator', min: 1100 },
  { level: 6, title: 'Pro', min: 1500 },
  { level: 7, title: 'Expert', min: 2000 },
  { level: 8, title: 'Master', min: 2600 },
];

export interface XPDerivedStats {
  xp: number;
  level: number;
  lessonsCompleted: number;
  quizzesCompleted: number;
  exercisesCompleted: number;
  coursesCompleted: number;
  daysLearned: number;
}

// Badge definitions — unlocked purely from frontend XP state (matches desktop).
export const XP_BADGES: {
  id: string; title: string; desc: string; icon: string;
  check: (s: XPDerivedStats) => boolean;
}[] = [
  { id: 'first-step', title: 'First Step', desc: 'Complete your first lesson', icon: '👟',
    check: (s) => s.lessonsCompleted >= 1 },
  { id: 'quick-learner', title: 'Quick Learner', desc: 'Complete 5 lessons', icon: '⚡',
    check: (s) => s.lessonsCompleted >= 5 },
  { id: 'quiz-master', title: 'Quiz Master', desc: 'Complete 5 quizzes', icon: '🧠',
    check: (s) => s.quizzesCompleted >= 5 },
  { id: 'course-finisher', title: 'Course Finisher', desc: 'Complete your first course', icon: '🎓',
    check: (s) => s.coursesCompleted >= 1 },
  { id: 'consistent-learner', title: 'Consistent Learner', desc: 'Learn on 5 different days', icon: '📅',
    check: (s) => s.daysLearned >= 5 },
  { id: 'xp-hunter', title: 'XP Hunter', desc: 'Reach 500 XP', icon: '🎯',
    check: (s) => s.xp >= 500 },
  { id: 'master', title: 'Master', desc: 'Reach the final level', icon: '👑',
    check: (s) => s.level >= XP_LEVELS[XP_LEVELS.length - 1].level },
];

export interface XPState {
  xp: number;
  awarded: Record<string, boolean>;
  days: string[];
}

export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  floor: number;
  next: { level: number; title: string; min: number } | null;
  ceil: number;
  toNext: number;
  progressPct: number;
}

export interface Badge {
  id: string; title: string; desc: string; icon: string; unlocked: boolean;
}

// ─── In-memory state + persistence ───────────────────────────────────────────

let _userId = '';
let _state: XPState = { xp: 0, awarded: {}, days: [] };
let _loaded = false;
const _listeners = new Set<() => void>();

function _storageKey(): string {
  return _userId ? `ck_xp_${_userId}` : 'ck_xp';
}

async function _persist() {
  try {
    await AsyncStorage.setItem(_storageKey(), JSON.stringify(_state));
  } catch {}
  _emit();
}

function _emit() {
  _listeners.forEach((fn) => { try { fn(); } catch {} });
}

function _todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _countAwarded(prefix: string): number {
  let n = 0;
  for (const k in _state.awarded) {
    if (Object.prototype.hasOwnProperty.call(_state.awarded, k) && k.indexOf(prefix) === 0) n++;
  }
  return n;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const XPService = {
  /** Load state for a user into memory. Safe to call multiple times. */
  init: async (userId: string) => {
    if (_loaded && _userId === userId) return;
    _userId = userId || '';
    try {
      const raw = await AsyncStorage.getItem(_storageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      _state = {
        xp: parsed?.xp || 0,
        awarded: parsed?.awarded || {},
        days: parsed?.days || [],
      };
    } catch {
      _state = { xp: 0, awarded: {}, days: [] };
    }
    _loaded = true;
    _emit();
  },

  subscribe: (fn: () => void) => {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },

  getState: (): XPState => _state,

  hasActionBeenAwarded: (actionKey: string): boolean => !!actionKey && !!_state.awarded[actionKey],

  /** Award XP for a unique action. Returns true only if first time. */
  awardXP: (actionKey: string, amount: number): boolean => {
    if (!actionKey || !amount) return false;
    if (_state.awarded[actionKey]) return false;
    _state.awarded[actionKey] = true;
    _state.xp += amount;
    // First meaningful action of the day also earns the daily bonus
    const today = _todayKey();
    const dailyKey = `daily:${today}`;
    if (!_state.awarded[dailyKey]) {
      _state.awarded[dailyKey] = true;
      if (_state.days.indexOf(today) === -1) _state.days.push(today);
      _state.xp += XP_REWARDS.dailyLearning;
    }
    _persist();
    return true;
  },

  /** Records today as a learning day + awards daily bonus once/day. */
  markDailyLearning: (): boolean => {
    const today = _todayKey();
    const dailyKey = `daily:${today}`;
    if (_state.awarded[dailyKey]) return false;
    _state.awarded[dailyKey] = true;
    if (_state.days.indexOf(today) === -1) _state.days.push(today);
    _state.xp += XP_REWARDS.dailyLearning;
    _persist();
    return true;
  },

  getCurrentStreak: (): number => {
    if (!_state.days.length) return 0;
    const set: Record<string, boolean> = {};
    _state.days.forEach((d) => { set[d] = true; });
    const keyFor = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const cursor = new Date();
    if (!set[keyFor(cursor)]) {
      cursor.setDate(cursor.getDate() - 1);
      if (!set[keyFor(cursor)]) return 0;
    }
    let streak = 0;
    while (set[keyFor(cursor)]) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  },

  getLevelInfo: (): LevelInfo => {
    const xp = _state.xp;
    let current = XP_LEVELS[0];
    let next: (typeof XP_LEVELS)[number] | null = null;
    for (let i = 0; i < XP_LEVELS.length; i++) {
      if (xp >= XP_LEVELS[i].min) {
        current = XP_LEVELS[i];
        next = XP_LEVELS[i + 1] || null;
      } else {
        break;
      }
    }
    const floor = current.min;
    const ceil = next ? next.min : current.min;
    const span = ceil - floor;
    const into = xp - floor;
    const progressPct = next && span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 100;
    return {
      level: current.level,
      title: current.title,
      xp,
      floor,
      next,
      ceil,
      toNext: next ? Math.max(0, ceil - xp) : 0,
      progressPct,
    };
  },

  getDerivedStats: (): XPDerivedStats => {
    const info = XPService.getLevelInfo();
    return {
      xp: info.xp,
      level: info.level,
      lessonsCompleted: _countAwarded('lesson-complete:'),
      quizzesCompleted: _countAwarded('quiz-complete:'),
      exercisesCompleted: _countAwarded('exercise-complete:'),
      coursesCompleted: _countAwarded('course-complete:'),
      daysLearned: _state.days.length,
    };
  },

  getBadges: (): Badge[] => {
    const stats = XPService.getDerivedStats();
    return XP_BADGES.map((b) => ({
      id: b.id, title: b.title, desc: b.desc, icon: b.icon, unlocked: !!b.check(stats),
    }));
  },
};
