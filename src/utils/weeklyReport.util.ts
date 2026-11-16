/**
 * Weekly parent report → WhatsApp (free: the student/parent taps Send in their
 * own WhatsApp, so there is no WhatsApp Business API, no per-message cost and
 * no server involved).
 */
import { Alert, Linking } from 'react-native';

export interface WeeklyReportInput {
  studentName: string;
  parentName?: string | null;
  /** e.g. "29 Sep – 5 Oct" */
  weekLabel: string;
  weekTime: string;          // "1h 20m" or "—"
  activeDays: number;        // 0–7 (this week)
  weeklyStreak: number;
  lessonsCompleted: number;  // all time
  coins: number;
  achievements: number;
  courses: { title: string; percent: number; done: number; total: number }[];
  codeArena?: { points: number; solved: number; streak: number } | null;
  /** One friendly line, e.g. "You're on a roll!" */
  motivation?: string;
}

/**
 * Turn what the student typed ("+91 98765 43210", "09876543210", "9876543210")
 * into the digits WhatsApp expects ("919876543210"). Returns null if it doesn't
 * look like a phone number.
 */
export function normalizeWhatsAppNumber(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10) return '91' + d;                       // Indian mobile without country code
  if (d.length === 11 && d.startsWith('0')) return '91' + d.slice(1);
  if (d.length >= 11 && d.length <= 15) return d;             // already has a country code
  return null;
}

/** "+91 98••• ••210" — shown on screen so the full number isn't on display. */
export function maskNumber(num: string): string {
  if (num.length < 7) return num;
  return `+${num.slice(0, num.length - 10)} ${num.slice(-10, -8)}••• •••${num.slice(-3)}`;
}

export function buildWeeklyReportMessage(r: WeeklyReportInput): string {
  const hello = r.parentName?.trim() ? `Hello ${r.parentName.trim()} 🙏` : 'Hello 🙏';
  const lines: string[] = [
    '📊 *Weekly Learning Report*',
    `👤 *${r.studentName}* · ${r.weekLabel}`,
    '',
    `${hello}, here is how ${r.studentName} did on CodingKida this week:`,
    '',
    `⏱ Learning time: *${r.weekTime}*`,
    `📅 Active days: *${r.activeDays} / 7*`,
    `🔥 Weekly streak: *${r.weeklyStreak}*`,
    `✅ Lessons completed: *${r.lessonsCompleted}*`,
    `🪙 Coins: *${r.coins}*`,
    `🏆 Achievements: *${r.achievements}*`,
  ];
  if (r.codeArena && (r.codeArena.solved > 0 || r.codeArena.points > 0)) {
    lines.push(`💻 Code Arena: *${r.codeArena.points} points* · ${r.codeArena.solved} problem${r.codeArena.solved === 1 ? '' : 's'} solved`);
  }
  if (r.courses.length > 0) {
    lines.push('', '📚 *Course progress*');
    r.courses.slice(0, 6).forEach((c) => {
      lines.push(`• ${c.title}: *${c.percent}%* (${c.done}/${c.total} lessons)`);
    });
  }
  if (r.motivation) lines.push('', `💬 ${r.motivation}`);
  lines.push(
    '',
    `Please encourage ${r.studentName} to code a little every day — small steps add up! 🚀`,
    '— Team CodingKida · www.codingkida.com',
  );
  return lines.join('\n');
}

async function open(url: string): Promise<boolean> {
  try { await Linking.openURL(url); return true; } catch { return false; }
}

/**
 * Open WhatsApp with the report. With a parent number → straight into that
 * chat; without one → WhatsApp's contact picker, so the student can still send.
 */
export async function sendReportOnWhatsApp(number: string | null, text: string): Promise<void> {
  const enc = encodeURIComponent(text);
  const urls = number
    ? [`whatsapp://send?phone=${number}&text=${enc}`, `https://wa.me/${number}?text=${enc}`]
    : [`whatsapp://send?text=${enc}`, `https://wa.me/?text=${enc}`];
  for (const u of urls) {
    if (await open(u)) return;
  }
  Alert.alert('WhatsApp', 'Could not open WhatsApp. Is it installed on this phone?');
}

/** "29 Sep – 5 Oct" for the current Monday-to-today week. */
export function currentWeekLabel(now = new Date()): string {
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const f = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${f(monday)} – ${f(sunday)}`;
}
