import { apiClient } from './client';
import type { DashboardData, StudentProfile, ConsentState } from '@/types';

/** What the student did on one day (same data the weekly parent report is built from). */
export interface DayActivity {
  date: string;
  minutes: number;
  sessions: number;
  lessons: { title: string; module: string | null; course: string | null; at: string }[];
  quizzes: { lesson: string; module?: string | null; course: string | null; correct: number; total: number; at: string }[];
  exercises: { title: string; lesson: string | null; module?: string | null; course?: string | null; language: string | null; passed: boolean; attempts: number; at: string }[];
  coins: { type: string; coins: number; reason: string; lesson?: string | null; module?: string | null; course?: string | null; at: string }[];
  badges: { title: string; lesson: string; module?: string | null; course?: string | null; at: string }[];
}

export const studentApi = {
  /** Daily activity for a date range (YYYY-MM-DD, inclusive). */
  getActivity: (from: string, to: string = from) =>
    apiClient
      .get<{ success: boolean; days: DayActivity[] }>('/api/student/activity', { params: { from, to } })
      .then((r) => r.data),

  getProfile: () =>
    apiClient.get<{ success: boolean; student: StudentProfile }>('/api/student').then((r) => r.data),

  getDashboard: () =>
    apiClient.get<DashboardData>('/api/student/dashboard?signed=true').then((r) => r.data),

  updateProfile: (data: Partial<StudentProfile>) =>
    apiClient.patch('/api/student/profile', data).then((r) => r.data),

  /** WhatsApp a 6-digit code to the parent number saved on the profile. */
  sendParentCode: () =>
    apiClient
      .post<{ success: boolean; sentTo: string; expiresInSec: number; devCode?: string; testMode: boolean }>('/api/student/parent-verify/send')
      .then((r) => r.data),

  /** Check the code the parent read out → the parent's number becomes verified. */
  confirmParentCode: (code: string) =>
    apiClient
      .post<{ success: boolean; verified: boolean }>('/api/student/parent-verify/confirm', { code })
      .then((r) => r.data),

  /** Does this student need a verified parent, and what is already done? */
  getConsent: () =>
    apiClient.get<{ success: boolean; consent: ConsentState }>('/api/student/consent').then((r) => r.data.consent),

  /** Email a 6-digit code to the parent email saved on the profile. */
  sendConsentEmailCode: () =>
    apiClient
      .post<{ success: boolean; sentTo: string; expiresInSec: number }>('/api/student/consent/email/send')
      .then((r) => r.data),

  /** Check the code the parent gave → the parent's email becomes verified. */
  confirmConsentEmailCode: (code: string) =>
    apiClient
      .post<{ success: boolean; verified: boolean }>('/api/student/consent/email/confirm', { code })
      .then((r) => r.data),

  getAvatar: () =>
    apiClient
      .get<{ success: boolean; avatarUrl: string }>('/api/student/avatar')
      .then((r) => r.data),
};
