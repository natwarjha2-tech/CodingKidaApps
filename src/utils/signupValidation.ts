/**
 * Sign-up checks, the same rules the server applies (so students see the
 * problem before they submit). The server is still the one that decides.
 */

export const NAME_MESSAGE = 'Enter your real name: letters only, 2 to 50 characters (no email address or numbers).';

const PLACEHOLDERS = new Set([
  'test', 'testing', 'abc', 'abcd', 'abcde', 'xyz', 'user', 'username', 'student', 'name', 'your name', 'full name',
  'admin', 'demo', 'asdf', 'asd', 'qwerty', 'na', 'none', 'null', 'undefined', 'unknown', 'nothing', 'hello', 'hi',
]);

export function cleanName(raw: string): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

export function validateName(raw: string): string | null {
  const name = cleanName(raw);
  if (name.length < 2 || name.length > 50) return NAME_MESSAGE;
  // No digits, @ or other symbols. (Written without Unicode property escapes so it runs on every phone.)
  if (/[0-9@#$%^&*()_+=[\]{}<>\\|/~`!?,;:"]/.test(name)) return NAME_MESSAGE;
  if (!isLetter(name.charAt(0))) return NAME_MESSAGE;
  let letters = 0;
  for (const ch of name) if (isLetter(ch)) letters += 1;
  if (letters < 2) return NAME_MESSAGE;
  if (PLACEHOLDERS.has(name.toLowerCase())) return NAME_MESSAGE;
  if (/(.)\1{3,}/.test(name)) return NAME_MESSAGE;
  return null;
}

/** A letter in any script: Latin letters change with case; Indian and other scripts sit above U+0900. */
function isLetter(ch: string): boolean {
  return ch.toLowerCase() !== ch.toUpperCase() || ch.charCodeAt(0) >= 0x0900;
}

export const PASSWORD_HINT = 'At least 8 characters, with an uppercase letter, a lowercase letter and a number.';

const COMMON = new Set([
  'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword1', 'qwerty123', 'qwertyuiop', 'abcd1234',
  'abc12345', 'abcdefgh', '12345678', '123456789', '1234567890', 'iloveyou', 'welcome1', 'welcome123', 'admin123',
  'letmein1', 'india123', 'india@123', 'codingkida', 'codingkida1', 'codingkida123', 'student123', 'student1',
  'test1234', 'test@123', 'master123', 'login123', 'changeme', 'sunshine1', 'princess1', 'football1', 'monkey123',
]);
const COMMON_BASE = new Set([
  'password', 'passw0rd', 'qwerty', 'welcome', 'iloveyou', 'letmein', 'admin', 'student', 'india', 'codingkida',
  'abcd', 'abcdefgh', 'test', 'login', 'master', 'changeme',
]);

export function validatePassword(password: string, email = ''): string | null {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password must not exceed 128 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  const p = password.toLowerCase();
  const base = p.replace(/[0-9!@#$%^&*._-]+$/, '');
  if (COMMON.has(p) || (base.length > 0 && COMMON_BASE.has(base))) {
    return 'That password is too common. Choose something harder to guess.';
  }
  const local = email.split('@')[0].toLowerCase();
  if (local.length >= 4 && p.includes(local)) return 'Password must not contain your email name.';
  return null;
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v ?? '').trim());
}

/** "dd-mm-yyyy" → { y, m, d } or null when it isn't a real date. */
export function parseDob(raw: string): { y: number; m: number; d: number } | null {
  const hit = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec((raw ?? '').trim()) ?? null;
  let d: number, m: number, y: number;
  if (hit) {
    d = Number(hit[1]); m = Number(hit[2]); y = Number(hit[3]);
  } else {
    const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec((raw ?? '').trim());
    if (!iso) return null;
    y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]);
  }
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function ageOf(raw: string, now: Date = new Date()): number | null {
  const dob = parseDob(raw);
  if (!dob) return null;
  let age = now.getFullYear() - dob.y;
  if (now.getMonth() + 1 < dob.m || (now.getMonth() + 1 === dob.m && now.getDate() < dob.d)) age -= 1;
  return age;
}

export function dobError(raw: string): string | null {
  const age = ageOf(raw);
  if (age === null) return 'Enter your date of birth as DD-MM-YYYY.';
  if (age < 0) return "The date of birth can't be in the future.";
  if (age < 3 || age > 100) return 'Please check the date of birth.';
  return null;
}

/** true = under 18, false = 18 or older, null = not a valid date yet. */
export function isMinor(raw: string): boolean | null {
  const age = ageOf(raw);
  if (age === null || age < 0 || age > 120) return null;
  return age < 18;
}

/** Adds the dashes while typing: 12041999 → 12-04-1999. */
export function formatDobInput(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
}
