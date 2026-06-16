import { useQuery } from '@tanstack/react-query';
import { weeklyStreakApi } from '@/api';
import { useDashboard } from './useDashboard';

/**
 * Fetches total weekly streak completed count across all enrolled courses.
 * Same logic as desktop app's loadWeeklyStreakCount().
 */
export const useWeeklyStreakCount = () => {
  const { data: dashData } = useDashboard();
  const enrolledCourses = dashData?.enrolledCourses ?? [];
  const courseIds = enrolledCourses.map((c) => c.id);

  return useQuery({
    queryKey: ['weekly-streak-count', courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return 0;

      let totalCompleted = 0;
      // Fetch streak count for each enrolled course in parallel
      const results = await Promise.allSettled(
        courseIds.map((courseId) => weeklyStreakApi.getByCourse(courseId))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          totalCompleted += result.value.completedCount ?? 0;
        }
      }

      return totalCompleted;
    },
    enabled: courseIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 min cache (doesn't change often)
  });
};
