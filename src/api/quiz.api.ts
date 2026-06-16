import { apiClient } from './client';
import type { Quiz } from '@/types';

export const quizApi = {
  getByLesson: (lessonId: string) =>
    apiClient
      .get<{ success: boolean; quizzes: Quiz[] }>(`/api/quiz?lessonId=${lessonId}`)
      .then((r) => r.data),

  submitAttempt: (payload: {
    quizId: string;
    selected: number;
    courseId: string;
    lessonId: string;
    timeTaken?: number;
  }) =>
    apiClient
      .post<{ success: boolean; correct: boolean; coinsAwarded?: number; badge?: string; rank?: number }>(
        '/api/quiz',
        payload
      )
      .then((r) => r.data),
};
