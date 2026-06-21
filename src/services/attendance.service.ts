import { StorageService } from './storage.service';

const ATTENDANCE_KEY = 'ck_attendance';

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
    const mins = Math.round((end - _sessionStart) / 60000);
    if (mins < 1) { _sessionStart = null; return; } // Ignore < 1 min sessions

    const data = await AttendanceService.getData();
    const today = getTodayKey();

    if (!data[today]) {
      data[today] = { totalMins: 0, sessions: [] };
    }
    data[today].sessions.push({ start: _sessionStart, end });
    data[today].totalMins += mins;

    await StorageService.setObject(ATTENDANCE_KEY, data);
    _sessionStart = null;
  },

  /**
   * Get all attendance data
   */
  getData: async (): Promise<AttendanceData> => {
    const data = await StorageService.getObject<AttendanceData>(ATTENDANCE_KEY);
    return data ?? {};
  },

  /**
   * Get today's total minutes
   */
  getTodayMins: async (): Promise<number> => {
    const data = await AttendanceService.getData();
    const today = getTodayKey();
    return data[today]?.totalMins ?? 0;
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
        total += dayData.totalMins;
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
      const mins = data[key]?.totalMins ?? 0;
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
   * Format minutes to readable string
   */
  formatMins: (mins: number): string => {
    if (!mins || mins <= 0) return '0 min';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  },
};
