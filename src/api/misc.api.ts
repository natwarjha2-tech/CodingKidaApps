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

export const aiMentorApi = {
  ask: (question: string, lessonId?: string, mode: 'lesson' | 'general' = 'general') =>
    apiClient
      .post<{ success: boolean; answer: string; message?: string }>('/api/ai-mentor', {
        question,
        lessonId,
        mode,
      })
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
  submit: (payload: { rating: number; feedback?: string; lessonId: string; lessonTitle?: string }) =>
    apiClient
      .post<{ success: boolean; message?: string }>('/api/feedback', {
        rating: payload.rating,
        feedback: payload.feedback ?? '',
        lessonId: payload.lessonId,
        lessonTitle: payload.lessonTitle ?? '',
      })
      .then((r) => r.data),

  getLessonReviews: (lessonId: string) =>
    apiClient
      .get<LessonReviewsData>(`/api/feedback/lesson?lessonId=${lessonId}`)
      .then((r) => r.data),
};
