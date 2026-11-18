export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  /** dd-mm-yyyy. Students under 18 must also give a parent email and phone. */
  dob?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  /** e.g. "Class 8", "College". */
  studentClass?: string;
  school?: string;
  /** The student ticked "I agree to the Terms & Conditions and Privacy Policy". */
  acceptedTerms?: boolean;
}

/** Does this student need a verified parent, and what is done? (GET /api/student/consent) */
export interface ConsentState {
  enabled: boolean;
  required: boolean;
  reason?: 'minor' | 'age_unknown' | 'adult' | 'off';
  age?: number | null;
  dobMissing?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  phoneRequired?: boolean;
  phoneTestMode?: boolean;
  verified: boolean;
  deadlineAt?: string | null;
  daysLeft?: number | null;
  blocked: boolean;
  studentDob?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  parentEmailMasked?: string | null;
  parentContact?: string | null;
  parentPhoneLast4?: string | null;
  studentName?: string | null;
  /** Profile badge: Verified when student details (+ parent, under 18) are complete. */
  profile?: { verified: boolean; missing: string[] };
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
  message?: string;
  consent?: ConsentState;
}
