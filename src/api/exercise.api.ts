import { apiClient } from './client';
import type { Exercise } from '@/types';

export const exerciseApi = {
  getByLesson: (lessonId: string) =>
    apiClient
      .get<{ success: boolean; exercises: Exercise[] }>(`/api/exercise?lessonId=${lessonId}`)
      .then((r) => r.data),

  submitAttempt: (payload: { exerciseId: string; code: string; courseId: string }) =>
    apiClient
      .post<{ success: boolean; passed: boolean; message?: string }>('/api/exercise', payload)
      .then((r) => r.data),
};
