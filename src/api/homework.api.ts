import { apiClient } from './client';
import type { Homework } from '@/types';

export const homeworkApi = {
  getByLesson: (lessonId: string) =>
    apiClient
      .get<{ success: boolean; homeworks: Homework[] }>(`/api/homework?lessonId=${lessonId}`)
      .then((r) => r.data),
};
