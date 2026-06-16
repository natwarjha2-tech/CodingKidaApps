import { useQuery } from '@tanstack/react-query';
import { coursesApi } from '@/api';

export const useCourses = (category?: string, search?: string) => {
  return useQuery({
    queryKey: ['courses', category, search],
    queryFn: () => coursesApi.getAll(category, search),
    staleTime: 1000 * 60 * 5, // 5 min cache
    retry: 1,
  });
};

export const useCourseDetail = (id: string) => {
  return useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesApi.getById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });
};
