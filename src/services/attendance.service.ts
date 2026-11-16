import { StorageService, userScopedKey, getCurrentUserId, TOKEN_KEY } from './storage.service';

/**
 * Learning-time tracking.
 *
 * The SERVER (DailyActivity) is the only place time is read from, so the mobile
 * app, the desktop app and the weekly parent report always show the same numbers.
 * This service only measures ACTIVE LEARNING time and sends it to the server:
 *  - counts while a lesson video is playing, inside a live class, or on a
 *    learning screen (lesson, coding, code editor, final test, AI mentor,
 *    downloads player, Draw it) with a touch or the keyboard in the last 5 min.
 *    Menus, home, profile, shop, report and idle time do not count;
 *  - a tick every minute adds the time since the last tick (gaps over 3 minutes,
 *    e.g. a frozen app, are not counted);
 *  - every 5 minutes, and when the app goes to the background, whole minutes are
 *    sent to POST /api/attendance under the LOCAL calendar day;
 *  - sends that fail are queued on the device and retried on the next send.
 */

const TICK_MS = 60 * 1000;
const FLUSH_MS = 5 * 60 * 1000;
const MAX_GAP_MS = 3 * 60 * 1000;
const IDLE_MS = 5 * 60 * 1000; // no touch/typing for 5 minutes = idle
const VIDEO_FRESH_MS = 30 * 1000; // a video counts as playing if it reported progress in the last 30 s

// Screens where time counts as learning. Menus, home, profile, shop, report and
// similar screens don't count (the way Khan Academy counts "learning minutes").
const LEARNING_PREFIXES = ['/lesson', '/coding', '/code-editor', '/final-test', '/offline-player', '/ai-mentor', '/draw-it'];

let _screen = '';
let _lastInput = Date.now();
let _lastVideoAt = 0;
let _keyboardOpen = false;

function isActiveNow(now: number): boolean {
  if (now - _lastVideoAt < VIDEO_FRESH_MS) return true; // a lesson video is playing
  if (/^\/live\/(?!recordings|index)[^/]+/.test(_screen)) return true; // inside a live class: watching counts
  const onLearning = LEARNING_PREFIXES.some((p) => _screen === p || _screen.startsWith(`${p}/`));
  if (!onLearning) return false;
  if (_keyboardOpen) return true; // typing code/answers
  return now - _lastInput < IDLE_MS;
}
const QUEUE_BASE = 'ck_attendance_queue';

type QueueItem = { date: string; minutes: number; sessions: number };
type ServerHistory = { joinedAt: string | null; byDate: Record<string, number>; sessionsByDate: Record<string, number> };

let _timer: ReturnType<typeof setInterval> | null = null;
let _lastTick = 0;
let _pendingMs = 0;
let _pendingDay: string | null = null;
let _sessionSent = false;
let _historyCache: { at: number; value: ServerHistory } | null = null;

/** Local calendar day "YYYY-MM-DD" (the same day the student sees in the calendar). */
export function localDayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function readQueue(): Promise<QueueItem[]> {
  return (await StorageService.getObject<QueueItem[]>(await userScopedKey(QUEUE_BASE))) ?? [];
}
async function writeQueue(items: QueueItem[]): Promise<void> {
  await StorageService.setObject(await userScopedKey(QUEUE_BASE), items.slice(-200));
}

// Sends run one after another, never in parallel (no double sends, no races).
let _chain: Promise<void> = Promise.resolve();

/**
 * Add `item` to the device queue, then send the queue in order. An item leaves
 * the queue only after the server confirmed it, so nothing is lost if the app
 * is closed or offline; it is retried on the next send.
 */
async function persistAndSend(item: QueueItem | null): Promise<void> {
  const [userId, token] = await Promise.all([getCurrentUserId(), StorageService.get(TOKEN_KEY)]);
  if (!userId || !token) return; // signed out: time is not counted for anyone
  const queue = await readQueue();
  if (item) {
    queue.push(item);
    await writeQueue(queue);
  }
  if (!queue.length) return;
  const { attendanceApi } = await import('@/api');
  let sent = 0;
  for (const it of queue) {
    const res = await attendanceApi.record(it.date, it.minutes, it.sessions);
    if (!res?.success) break; // keep this one and the rest for the next try
    sent += 1;
    await writeQueue(queue.slice(sent));
  }
  if (sent > 0) _historyCache = null;
}

function tick(): void {
  const now = Date.now();
  const gap = _lastTick ? now - _lastTick : 0;
  _lastTick = now;
  if (gap <= 0 || gap > MAX_GAP_MS) return; // app was frozen/asleep: don't count the gap
  if (!isActiveNow(now)) return; // not learning right now (menus, idle, ...)
  const day = localDayKey(new Date(now));
  if (_pendingDay && _pendingDay !== day) void AttendanceService.flush(true); // midnight: close yesterday
  _pendingDay = day;
  _pendingMs += gap;
  if (_pendingMs >= FLUSH_MS) void AttendanceService.flush(false);
}

async function fetchHistory(): Promise<ServerHistory> {
  if (_historyCache && Date.now() - _historyCache.at < 5000) return _historyCache.value;
  const value: ServerHistory = { joinedAt: null, byDate: {}, sessionsByDate: {} };
  try {
    const { attendanceApi } = await import('@/api');
    const res = await attendanceApi.getHistory();
    if (res && res.success) {
      value.joinedAt = res.joinedAt ?? null;
      for (const d of res.days ?? []) {
        if (d && d.date) {
          value.byDate[d.date] = d.minutes || 0;
          value.sessionsByDate[d.date] = d.sessions || 0;
        }
      }
    }
  } catch { /* offline: empty */ }
  _historyCache = { at: Date.now(), value };
  return value;
}

export const AttendanceService = {
  /** The screen on view (expo-router path). Set by the root layout. */
  setScreen: (path: string) => {
    const now = Date.now();
    tick(); // close the time on the previous screen first
    _screen = path || '';
    _lastInput = now;
  },
  /** The student touched the screen. */
  markInput: () => { _lastInput = Date.now(); },
  /** The on-screen keyboard opened/closed (typing counts as activity). */
  setKeyboardOpen: (open: boolean) => { _keyboardOpen = open; _lastInput = Date.now(); },
  /** A lesson video reported playback progress. */
  markVideoPlaying: () => { _lastVideoAt = Date.now(); },

  /** App came to the foreground, or a student signed in: start a new session. */
  recordStart: () => {
    _lastTick = Date.now();
    _pendingMs = 0; // anything measured before (e.g. on the login screen) is not counted
    _pendingDay = null;
    _sessionSent = false;
    if (!_timer) _timer = setInterval(tick, TICK_MS);
  },

  /** App went to the background, or the student signs out: count up to now and send. */
  recordEnd: async () => {
    tick();
    if (_timer) { clearInterval(_timer); _timer = null; }
    _lastTick = 0;
    await AttendanceService.flush(true);
  },

  /**
   * Send the measured minutes to the server. `all` also sends a final part-minute
   * (30 s or more rounds up) and clears what is left.
   *
   * The minutes are taken out SYNCHRONOUSLY (so two calls can never take the same
   * minutes), then saved to the device queue and sent one call at a time.
   */
  flush: (all = false): Promise<void> => {
    let mins = Math.floor(_pendingMs / 60000);
    if (all && _pendingMs - mins * 60000 >= 30000) mins += 1;
    const day = _pendingDay ?? localDayKey();
    _pendingMs = all ? 0 : Math.max(0, _pendingMs - mins * 60000);
    if (all) _pendingDay = null;
    const item: QueueItem | null = mins > 0 ? { date: day, minutes: mins, sessions: _sessionSent ? 0 : 1 } : null;
    if (item) _sessionSent = true;
    _chain = _chain.then(() => persistAndSend(item)).catch(() => {});
    return _chain;
  },

  /** Server history: date → minutes (and sessions), plus the join date. */
  getServerHistory: fetchHistory,

  /** Kept for the report screen: the full history from the server only. */
  getFullHistory: async (): Promise<{ joinedAt: string | null; byDate: Record<string, number> }> => {
    const h = await fetchHistory();
    return { joinedAt: h.joinedAt, byDate: h.byDate };
  },

  getTodayMins: async (): Promise<number> => (await fetchHistory()).byDate[localDayKey()] ?? 0,

  /** Monday → today, from the server. */
  getWeekMins: async (): Promise<number> => {
    const h = await fetchHistory();
    const now = new Date();
    const back = now.getDay() === 0 ? 6 : now.getDay() - 1;
    let total = 0;
    for (let i = back; i >= 0; i--) {
      total += h.byDate[localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i))] ?? 0;
    }
    return total;
  },

  /** Last 30 days for the calendar, from the server. */
  getLast30Days: async (): Promise<{ date: string; day: number; mins: number; active: boolean; isToday: boolean }[]> => {
    const h = await fetchHistory();
    const now = new Date();
    const out = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = localDayKey(d);
      const mins = h.byDate[key] ?? 0;
      out.push({ date: key, day: d.getDate(), mins, active: mins > 0, isToday: i === 0 });
    }
    return out;
  },

  /** One day's minutes and times opened, from the server. */
  getDayDetail: async (dateKey: string): Promise<{ mins: number; opens: number }> => {
    const h = await fetchHistory();
    return { mins: h.byDate[dateKey] ?? 0, opens: h.sessionsByDate[dateKey] ?? 0 };
  },

  formatMins: (mins: number): string => {
    if (!mins || mins <= 0) return '0 min';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  },
};
