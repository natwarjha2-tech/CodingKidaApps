/**
 * Turns any sign-up problem (form check or server answer) into a message a
 * student understands, plus the field it belongs to, so the form can mark that
 * field and scroll to it. Same wording as the website (app/lib/signup-errors.ts).
 */

export type SignupField =
  | 'name' | 'email' | 'password' | 'dob' | 'studentClass' | 'school' | 'terms'
  | 'parentName' | 'parentEmail' | 'parentPhone' | null;

export interface SignupProblem {
  message: string;
  field: SignupField;
  /** 409: the email already has an account — offer "Log in with this email". */
  emailTaken?: boolean;
}

/** Work out which field a message is about (form checks and server messages use the same words). */
export function fieldFromMessage(message: string): SignupField {
  const m = message.toLowerCase();
  if (m.includes('parent') && m.includes('email')) return 'parentEmail';
  if (m.includes('parent') && (m.includes('phone') || m.includes('number'))) return 'parentPhone';
  if (m.includes('parent') && m.includes('name')) return 'parentName';
  if (m.includes('date of birth')) return 'dob';
  if (m.includes('terms')) return 'terms';
  if (m.includes('school')) return 'school';
  if (m.includes('class')) return 'studentClass';
  if (m.includes('password')) return 'password';
  if (m.includes('real name') || m.startsWith('name:')) return 'name';
  if (m.includes('email')) return 'email';
  return null;
}

export const NETWORK_PROBLEM: SignupProblem = {
  message: 'Could not reach CodingKida. Check your internet connection and try again.',
  field: null,
};

/** An error from the sign-up call (ApiError from src/api/client.ts) → a clear message and field. */
export function explainSignupError(err: unknown): SignupProblem {
  const e = (err ?? {}) as { status?: number; message?: string; data?: { message?: string } };
  const status = e.status;
  if (!status) return NETWORK_PROBLEM; // no answer from the server
  const raw = String(e.data?.message ?? e.message ?? '').trim();
  if (status === 409) {
    return {
      message: 'This email is already registered. Log in instead, or sign up with a different email.',
      field: 'email',
      emailTaken: true,
    };
  }
  if (status === 429) {
    return {
      message: 'Too many sign-up attempts from this network. Please wait about an hour and try again, or use a different internet connection.',
      field: null,
    };
  }
  if (status >= 500 || !raw) {
    return { message: 'Something went wrong on our side. Please try again in a minute.', field: null };
  }
  // Server checks answer like "email: Invalid email format." — keep the readable part.
  const text = raw.replace(/^[a-zA-Z]+:\s*/, '');
  const nice = /invalid email/i.test(text) ? 'Please enter a valid email address, for example name@gmail.com.' : text;
  return { message: nice, field: fieldFromMessage(raw) };
}
