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

  // "Sign on play" — signed, ready-to-stream data for ONE lesson, fetched only
  // when the user opens that lesson (the course response no longer signs every
  // lesson upfront, which kept course-open fast for large courses).
  getLessonPlay: (lessonId: string) =>
    apiClient
      .get<{
        success: boolean;
        lesson: {
          id: string;
          title: string;
          notes: string;
          videoUrl: string;
          mediaId: string | null;
          hlsMasterUrl: string | null;
          hlsStatus: string;
          hlsQualities: string[];
          qualityUrls: Record<string, string>;
          isFree: boolean;
          locked: boolean;
        };
      }>(`/api/lessons/${lessonId}/play`)
      .then((r) => r.data),

  enroll: (courseId: string) =>
    apiClient
      .post(`/api/courses/${courseId}/enroll`, {})
      .then((r) => r.data),
};
