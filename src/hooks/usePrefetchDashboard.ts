import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { achievementsApi, leaderboardApi, weeklyStreakApi, coursesApi } from '@/api';
import { useDashboard } from './useDashboard';
import { useAuthStore } from '@/store';

/**
 * Prefetches achievements, streak history, leaderboard, and all course details
 * as soon as the dashboard mounts — so child screens open instantly.
 */
export const usePrefetchDashboard = () => {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: dashData } = useDashboard();
  const enrolledCourses = dashData?.enrolledCourses ?? [];
  const courseIds = enrolledCourses.map((c) => c.id);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Prefetch achievements
    queryClient.prefetchQuery({
      queryKey: ['achievements'],
      queryFn: () => achievementsApi.get(),
      staleTime: 1000 * 60 * 5,
    });

    // Prefetch all courses list (for courses tab)
    queryClient.prefetchQuery({
      queryKey: ['courses', 'All', ''],
      queryFn: () => coursesApi.getAll('All', ''),
      staleTime: 1000 * 60 * 5,
    });
  }, [isAuthenticated]);

  useEffect(() => {
    if (courseIds.length === 0) return;

    // Prefetch streak history for all enrolled courses
    queryClient.prefetchQuery({
      queryKey: ['streak-history', courseIds],
      queryFn: async () => {
        const results = await Promise.allSettled(
          enrolledCourses.map((course) =>
            weeklyStreakApi.getByCourse(course.id).then((res) => ({
              courseTitle: course.title,
              streaks: res.streaks ?? [],
              completedCount: res.completedCount ?? 0,
            }))
          )
        );
        let allStreaks: any[] = [];
        let totalCompleted = 0;
        for (const result of results) {
          if (result.status === 'fulfilled') {
            totalCompleted += result.value.completedCount;
            for (const streak of result.value.streaks) {
              allStreaks.push({ ...streak, courseTitle: result.value.courseTitle });
            }
          }
        }
        return { streaks: allStreaks, completedCount: totalCompleted };
      },
      staleTime: 1000 * 60 * 5,
    });

    // Prefetch leaderboard for first enrolled course
    queryClient.prefetchQuery({
      queryKey: ['leaderboard', courseIds[0]],
      queryFn: () => leaderboardApi.get(courseIds[0]),
      staleTime: 1000 * 60 * 2,
    });

    // Prefetch each enrolled course detail — so course page opens instantly
    for (const id of courseIds) {
      queryClient.prefetchQuery({
        queryKey: ['course', id],
        queryFn: () => coursesApi.getById(id),
        staleTime: 1000 * 60 * 2,
      });
    }
  }, [courseIds.join(',')]);
};
