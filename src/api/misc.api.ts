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
