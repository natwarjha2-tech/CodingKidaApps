import { apiClient } from './client';
import type { Exercise } from '@/types';

export const exerciseApi = {
  getByLesson: (lessonId: string) =>
    apiClient
      .get<{ success: boolean; exercises: Exercise[] }>(`/api/exercise?lessonId=${lessonId}`)
      .then((r) => r.data),

  // `language` is optional: sent by the coding editor's legacy fallback (desktop parity).
  submitAttempt: (payload: { exerciseId: string; code: string; courseId: string; language?: string | null }) =>
    apiClient
      .post<{ success: boolean; passed: boolean; message?: string }>('/api/exercise', payload)
      .then((r) => r.data),
};
