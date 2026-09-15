import { StorageService } from './storage.service';

const ATTENDANCE_KEY = 'ck_attendance';

// Maximum single session duration: 4 hours (anything above = device left open accidentally)
const MAX_SESSION_MINS = 240;
// Maximum daily total: 16 hours (reasonable cap — user can't actively learn more than this)
const MAX_DAILY_MINS = 960;

interface DayData {
  totalMins: number;
  sessions: { start: number; end: number }[];
}

type AttendanceData = Record<string, DayData>;

let _sessionStart: number | null = null;

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export const AttendanceService = {
  /**
   * Called when app becomes active (foreground)
   */
  recordStart: () => {
    _sessionStart = Date.now();
  },

  /**
   * Called when app goes to background/inactive
   */
  recordEnd: async () => {
    if (!_sessionStart) return;
    const end = Date.now();
    let mins = Math.round((end - _sessionStart) / 60000);
    _sessionStart = null;

    // Ignore sessions less than 1 minute
    if (mins < 1) return;

    // Cap single session to MAX_SESSION_MINS (prevents overnight/stuck sessions)
    if (mins > MAX_SESSION_MINS) mins = MAX_SESSION_MINS;

    // Validate that session belongs to today (prevents cross-midnight issues)
    const sessionDate = new Date(end).toISOString().split('T')[0];
    const today = getTodayKey();

    const data = await AttendanceService.getData();

    if (!data[today]) {
      data[today] = { totalMins: 0, sessions: [] };
    }

    // Cap daily total to MAX_DAILY_MINS
    const currentTotal = data[today].totalMins;
    if (currentTotal >= MAX_DAILY_MINS) return; // Already at max

    const allowedMins = Math.min(mins, MAX_DAILY_MINS - currentTotal);
    data[today].sessions.push({ start: _sessionStart ?? (end - allowedMins * 60000), end });
    data[today].totalMins += allowedMins;

    // Cleanup: remove data older than 35 days (saves storage)
    const cutoff = Date.now() - 35 * 24 * 60 * 60 * 1000;
    for (const dateKey of Object.keys(data)) {
      if (new Date(dateKey).getTime() < cutoff) {
        delete data[dateKey];
      }
    }

    await StorageService.setObject(ATTENDANCE_KEY, data);
  },

  /**
   * Get all attendance data
   */
  getData: async (): Promise<AttendanceData> => {
    const data = await StorageService.getObject<AttendanceData>(ATTENDANCE_KEY);
    return data ?? {};
  },

  /**
   * Get today's total minutes (capped + auto-fix corrupted data)
   */
  getTodayMins: async (): Promise<number> => {
    const data = await AttendanceService.getData();
    const today = getTodayKey();
    const mins = data[today]?.totalMins ?? 0;

    // Auto-fix: if corrupted data exceeds cap, reset today
    if (mins > MAX_DAILY_MINS) {
      data[today] = { totalMins: 0, sessions: [] };
      await StorageService.setObject(ATTENDANCE_KEY, data);
      return 0;
    }

    return mins;
  },

  /**
   * Get this week's total minutes
   */
  getWeekMins: async (): Promise<number> => {
    const data = await AttendanceService.getData();
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    let total = 0;
    for (const [date, dayData] of Object.entries(data)) {
      if (new Date(date).getTime() >= weekAgo) {
        total += Math.min(dayData.totalMins, MAX_DAILY_MINS);
      }
    }
    return total;
  },

  /**
   * Get last 30 days activity for calendar
   */
  getLast30Days: async (): Promise<{ date: string; day: number; mins: number; active: boolean; isToday: boolean }[]> => {
    const data = await AttendanceService.getData();
    const today = new Date();
    const calendar = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      const mins = Math.min(data[key]?.totalMins ?? 0, MAX_DAILY_MINS);
      calendar.push({
        date: key,
        day: date.getDate(),
        mins,
        active: mins > 0,
        isToday: i === 0,
      });
    }

    return calendar;
  },

  /**
   * Per-day detail for the calendar day-popup (mirrors desktop _attendanceGetDayDetail):
   * learning minutes + number of times the app was opened (sessions) that day.
   */
  getDayDetail: async (dateKey: string): Promise<{ mins: number; opens: number }> => {
    const data = await AttendanceService.getData();
    const day = data[dateKey];
    if (!day) return { mins: 0, opens: 0 };
    return {
      mins: Math.min(day.totalMins ?? 0, MAX_DAILY_MINS),
      opens: Array.isArray(day.sessions) ? day.sessions.length : 0,
    };
  },

  /**
   * Format minutes to readable string
   */
  formatMins: (mins: number): string => {
    if (!mins || mins <= 0) return '0 min';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  },

  /**
   * Reset today's data (for debugging/testing)
   */
  resetToday: async () => {
    const data = await AttendanceService.getData();
    const today = getTodayKey();
    delete data[today];
    await StorageService.setObject(ATTENDANCE_KEY, data);
  },
};
