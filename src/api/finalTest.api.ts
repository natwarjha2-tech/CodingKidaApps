/**
 * Final course test + certificates (server-graded; answers never sent to the app).
 */
import { apiClient } from './client';

export interface FinalTestCertificate {
  code: string;
  studentName: string;
  percent: number;
  issuedAt: string;
  courseTitle?: string;
  courseId?: string;
}

export interface FinalTestAttemptSummary {
  attemptId: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  submittedAt: string;
}

export interface FinalTestAttemptReview {
  success: boolean;
  attemptId: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  submittedAt: string;
  answersRevealed: boolean;
  review: FinalTestReviewItem[];
}

export type FinalTestStatus =
  | { success: boolean; available: false }
  | {
      success: boolean;
      available: true;
      courseTitle: string;
      totalQuestions: number;
      passPercent: number;
      timeLimitMin: number;
      enrolled: boolean;
      totalLessons: number;
      completedLessons: number;
      allCompleted: boolean;
      unlocked: boolean;
      attemptsCount: number;
      attempts: FinalTestAttemptSummary[];
      bestPercent: number | null;
      passed: boolean;
      nextAttemptAt: string | null;
      inProgress: { attemptId: string; endsAt: string } | null;
      certificate: FinalTestCertificate | null;
      pendingCertificate: { attemptId: string; suggestedName: string } | null;
    };

export interface FinalTestQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface FinalTestStart {
  success: boolean;
  attemptId: string;
  courseTitle: string;
  questions: FinalTestQuestion[];
  total: number;
  passPercent: number;
  timeLimitMin: number;
  startedAt: string;
  endsAt: string;
  serverNow: string;
}

export interface FinalTestReviewItem {
  quizId: string;
  question: string;
  options: string[];
  selected: number | null;
  correct: boolean;
  answer: number | null; // only when passed
  explanation: string | null;
}

export interface FinalTestResult {
  success: boolean;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  passPercent: number;
  late: boolean;
  review: FinalTestReviewItem[];
  certificate: { code: string; issuedAt: string } | null;
  needsCertificate: boolean;
  suggestedName: string | null;
  nextAttemptAt: string | null;
}

export const finalTestApi = {
  status: (courseId: string) =>
    apiClient
      .get<FinalTestStatus>(`/api/final-test?courseId=${encodeURIComponent(courseId)}`)
      .then((r) => r.data),

  start: (courseId: string) =>
    apiClient.post<FinalTestStart>('/api/final-test/start', { courseId }).then((r) => r.data),

  submit: (attemptId: string, answers: Record<string, number>) =>
    apiClient
      .post<FinalTestResult>('/api/final-test/submit', { attemptId, answers }, { timeout: 45000 })
      .then((r) => r.data),

  /** Review of a past attempt (own answers; correct answers once the test is passed). */
  review: (attemptId: string) =>
    apiClient
      .get<FinalTestAttemptReview>(`/api/final-test/review?attemptId=${encodeURIComponent(attemptId)}`)
      .then((r) => r.data),

  issueCertificate: (attemptId: string, name: string) =>
    apiClient
      .post<{ success: boolean; created: boolean; certificate: FinalTestCertificate }>(
        '/api/certificates', { attemptId, name }, { timeout: 45000 }
      )
      .then((r) => r.data),

  myCertificates: () =>
    apiClient
      .get<{ success: boolean; certificates: FinalTestCertificate[] }>('/api/certificates')
      .then((r) => r.data),

  /** The certificate PDF as base64 (owner only, generated on demand). */
  certificatePdf: (code: string) =>
    apiClient
      .get<{ success: boolean; base64: string; filename: string }>(
        `/api/certificates/${encodeURIComponent(code)}?format=base64`, { timeout: 45000 }
      )
      .then((r) => r.data),
};
