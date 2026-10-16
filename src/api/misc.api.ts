import { apiClient } from './client';
import type { CoinsData, Achievement } from '@/types';

export const leaderboardApi = {
  get: (courseId: string, lessonId?: string) => {
    const params = new URLSearchParams({ courseId });
    if (lessonId) params.append('lessonId', lessonId);
    return apiClient
      .get<{ success: boolean; leaderboard: any[]; currentUserRank?: any; totalStudents?: number }>(
        `/api/leaderboard?${params.toString()}`
      )
      .then((r) => r.data);
  },
};

export const coinsApi = {
  get: () =>
    apiClient.get<CoinsData>('/api/coins').then((r) => r.data),
};

export const achievementsApi = {
  get: () =>
    apiClient
      .get<{ success: boolean; achievements: Achievement[] }>('/api/achievements')
      .then((r) => r.data),
};

// Source attribution shown with an AI answer ("From your course material").
export interface AiSource {
  name: string;
  fileUrl: string | null;
  snippet: string;
}

export const aiMentorApi = {
  // Returns the full answer plus (when grounded in study material) the source
  // documents. Mirrors desktop sendAI → POST /api/ai-mentor.
  ask: (question: string, lessonId?: string, mode: 'lesson' | 'general' = 'general') =>
    apiClient
      .post<{
        success: boolean;
        answer: string;
        source?: 'study_material' | 'teacher_note' | 'ai';
        sources?: AiSource[];
        message?: string;
      }>('/api/ai-mentor', { question, lessonId, mode })
      .then((r) => r.data),
};

// ── Codo quiz/exercise Help (mirrors desktop /api/lesson-help) ──
// Two-stage: stage 'hint' → gentle nudge; stage 'answer' → correct answer +
// kid-friendly reasons (Hindi), with source attribution. The server may also
// ship pre-computed `audio` (base64 mp3) so the Listen button is instant.
// NOTE: mobile uses the NON-streaming JSON response (no `stream` flag) because
// React Native's axios/XHR can't read SSE — the backend returns full JSON then.
export interface LessonHelpData {
  success: boolean;
  stage?: 'hint' | 'answer';
  help?: string;
  source?: 'study_material' | 'teacher_note' | 'ai' | 'stored';
  sources?: AiSource[];
  audio?: string | null; // base64 mp3 (optional, pre-computed voice)
  voice?: string | null;
  message?: string;
}

export const lessonHelpApi = {
  getHelp: (params: {
    kind: 'quiz' | 'exercise';
    quizId?: string;
    exerciseId?: string;
    stage: 'hint' | 'answer';
  }) =>
    apiClient
      .post<LessonHelpData>(
        '/api/lesson-help',
        {
          kind: params.kind,
          quizId: params.quizId || '',
          exerciseId: params.exerciseId || '',
          stage: params.stage,
          // Intentionally no `stream: true` — mobile reads JSON, not SSE.
        },
        { timeout: 30000 }
      )
      .then((r) => r.data),
};

// ── Text-to-speech for Codo's voice (mirrors desktop /api/tts) ──
export const ttsApi = {
  synthesize: (text: string) =>
    apiClient
      .post<{ success: boolean; audio?: string; voice?: string; message?: string }>(
        '/api/tts',
        { text },
        { timeout: 30000 }
      )
      .then((r) => r.data),
};

// ── Server-side attendance (per-day learning minutes) ──
// Lets the My Report calendar show the FULL history (join month → now) across
// devices, not just the ~35 days kept locally.
export interface AttendanceDay { date: string; minutes: number; sessions: number }
export const attendanceApi = {
  // Record a day's minutes/sessions (server accumulates per user+day).
  record: (date: string, minutes: number, sessions = 1) =>
    apiClient
      .post<{ success: boolean; day?: AttendanceDay }>('/api/attendance', { date, minutes, sessions }, { timeout: 15000 })
      .then((r) => r.data)
      .catch(() => ({ success: false as const })),
  // Fetch the full history + the student's join date (YYYY-MM-DD).
  getHistory: () =>
    apiClient
      .get<{ success: boolean; joinedAt?: string | null; days?: AttendanceDay[] }>('/api/attendance', { timeout: 20000 })
      .then((r) => r.data)
      .catch(() => ({ success: false as const, joinedAt: null, days: [] as AttendanceDay[] })),
};

// ── Fixed Codo voice lines (same for every student, stored in DB, no AI). ──
// Returns a key→text map, e.g. { lesson_complete_prompt, quiz_complete_thanks }.
export const codoScriptsApi = {
  get: () =>
    apiClient
      .get<{ success: boolean; scripts?: Record<string, string>; scriptsAudio?: Record<string, string | null> }>('/api/codo-scripts')
      .then((r) => r.data),
};

export const weeklyStreakApi = {
  getByLesson: (lessonId: string) =>
    apiClient
      .get<{ success: boolean; streak?: any }>(`/api/weekly-streak?lessonId=${lessonId}`)
      .then((r) => r.data),

  getByCourse: (courseId: string) =>
    apiClient
      .get<{ success: boolean; streaks: any[]; completedCount: number; totalStreaks: number }>(
        `/api/weekly-streak?courseId=${courseId}`
      )
      .then((r) => r.data),

  submit: (streakId: string, answer: string) =>
    apiClient
      .post<{ success: boolean; passed: boolean; feedback?: string }>('/api/weekly-streak', {
        streakId,
        answer,
      })
      .then((r) => r.data),
};


export const progressApi = {
  markComplete: (lessonId: string) =>
    apiClient
      .post<{ success: boolean; message: string }>(`/api/lessons/${lessonId}/progress`, {
        completed: true,
      })
      .then((r) => r.data),
};

export const mediaApi = {
  getSignedUrl: (url: string) =>
    apiClient
      .post<{ success: boolean; signedUrl: string }>('/api/media/signed-url', { url })
      .then((r) => r.data),
};

// Lesson engagement: like/dislike reactions + view counting
// (mirrors desktop: GET/POST /api/lessons/:id/reaction, POST /api/lessons/:id/view)
export interface LessonReactionData {
  success: boolean;
  likes: number;
  dislikes: number;
  views: number;
  userReaction: 'like' | 'dislike' | null;
}

export const lessonApi = {
  getReactions: (lessonId: string) =>
    apiClient
      .get<LessonReactionData>(`/api/lessons/${lessonId}/reaction`)
      .then((r) => r.data),

  react: (lessonId: string, type: 'like' | 'dislike') =>
    apiClient
      .post<LessonReactionData>(`/api/lessons/${lessonId}/reaction`, { type })
      .then((r) => r.data),

  recordView: (lessonId: string) =>
    apiClient
      .post<{ success: boolean; views?: number }>(`/api/lessons/${lessonId}/view`, {})
      .then((r) => r.data),
};

// Ratings & reviews (per-lesson or app-level via lessonId)
// Mirrors desktop: POST /api/feedback, GET /api/feedback/lesson?lessonId=<id>
export interface LessonReview {
  studentName?: string;
  rating: number;
  feedback?: string;
  createdAt?: string;
}

export interface LessonReviewsData {
  success: boolean;
  avgRating: number;
  totalReviews: number;
  ratingCounts: Record<string, number>;
  reviews: LessonReview[];
}

export const feedbackApi = {
  // Rating submit is a single DB insert on the server, but the survey table's
  // JSON-path queries can make the request slow under load. Give it a generous
  // per-request timeout (30s) so a slow-but-successful save is never shown as a
  // false "Network error". Overrides the axios client's default 15s timeout.
  submit: (payload: { rating: number; feedback?: string; lessonId: string; lessonTitle?: string }) =>
    apiClient
      .post<{ success: boolean; message?: string }>('/api/feedback', {
        rating: payload.rating,
        feedback: payload.feedback ?? '',
        lessonId: payload.lessonId,
        lessonTitle: payload.lessonTitle ?? '',
      }, { timeout: 30000 })
      .then((r) => r.data),

  // Reviews list also reads the survey table (unindexed JSON path) — give it a
  // longer timeout so it doesn't fail on larger datasets. Non-blocking anyway.
  getLessonReviews: (lessonId: string) =>
    apiClient
      .get<LessonReviewsData>(`/api/feedback/lesson?lessonId=${lessonId}`, { timeout: 30000 })
      .then((r) => r.data),
};

// ── Lesson Doubts / Q&A group chat (mirrors desktop lesson-chat) ──
// Enrolled students ask doubts; the course instructor replies. Everyone enrolled
// sees the discussion. Backed by REST: GET/POST /api/lesson-chat. React Native
// has no EventSource, so live updates use the same `after` cursor the server's
// SSE uses internally — we poll GET with ?after=<lastCreatedAt> while the tab is open.
export interface LessonChatMessage {
  id: string;
  courseId: string;
  senderId: string;
  senderRole: string; // 'instructor' | 'student' | 'ai'
  senderName: string;
  text: string;
  parentId: string | null;
  createdAt: string;
  isMine?: boolean;
}

export interface LessonChatData {
  success: boolean;
  messages: LessonChatMessage[];
  isInstructor: boolean;
  courseId?: string;
  lessonTitle?: string;
  courseTitle?: string;
  message?: string;
}

export const lessonChatApi = {
  // Load history, or (with `after`) only messages newer than a cursor (polling).
  getMessages: (lessonId: string, after?: string) => {
    const params = new URLSearchParams({ lessonId });
    if (after) params.append('after', after);
    return apiClient
      .get<LessonChatData>(`/api/lesson-chat?${params.toString()}`, { timeout: 30000 })
      .then((r) => r.data);
  },

  send: (lessonId: string, text: string) =>
    apiClient
      .post<{ success: boolean; message?: LessonChatMessage | string }>(
        '/api/lesson-chat',
        { lessonId, text },
        { timeout: 30000 }
      )
      .then((r) => r.data),

  // "Connect with our Expert" — pull in the human instructor under a Codo (AI)
  // answer. Notifies the instructor and posts a confirmation into the thread.
  // Mirrors desktop connectWithExpert → POST /api/lesson-chat/escalate.
  escalate: (lessonId: string) =>
    apiClient
      .post<{ success: boolean; message?: LessonChatMessage | string }>(
        '/api/lesson-chat/escalate',
        { lessonId },
        { timeout: 30000 }
      )
      .then((r) => r.data),
};
