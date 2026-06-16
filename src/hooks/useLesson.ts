import { useQuery } from '@tanstack/react-query';
import { quizApi, exerciseApi, homeworkApi } from '@/api';

export const useQuiz = (lessonId: string) => {
  return useQuery({
    queryKey: ['quiz', lessonId],
    queryFn: () => quizApi.getByLesson(lessonId),
    enabled: !!lessonId,
    staleTime: 1000 * 60 * 10,
  });
};

export const useExercise = (lessonId: string) => {
  return useQuery({
    queryKey: ['exercise', lessonId],
    queryFn: () => exerciseApi.getByLesson(lessonId),
    enabled: !!lessonId,
    staleTime: 1000 * 60 * 10,
  });
};

export const useHomework = (lessonId: string) => {
  return useQuery({
    queryKey: ['homework', lessonId],
    queryFn: () => homeworkApi.getByLesson(lessonId),
    enabled: !!lessonId,
    staleTime: 1000 * 60 * 10,
  });
};
