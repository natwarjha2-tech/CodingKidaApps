import { apiClient } from './client';
import type { Course, CourseDetail } from '@/types';

export const coursesApi = {
  getAll: (category?: string, search?: string) => {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (search?.trim()) params.append('search', search.trim());
    const query = params.toString();
    return apiClient
      .get<{ success: boolean; courses: Course[] }>(`/api/courses${query ? `?${query}` : ''}`)
      .then((r) => r.data);
  },

  getById: (id: string) =>
    apiClient
      .get<{ success: boolean; course: CourseDetail }>(`/api/courses/${id}?signed=true`)
      .then((r) => r.data),

  enroll: (courseId: string) =>
    apiClient
      .post(`/api/courses/${courseId}/enroll`, {})
      .then((r) => r.data),
};
