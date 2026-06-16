import { create } from 'zustand';
import type { CourseDetail, Lesson, Module } from '@/types';

interface LessonContext {
  courseId: string;
  moduleId: string;
  lessonId: string;
  courseTitle: string;
  moduleTitle: string;
  lessonTitle: string;
}

interface CourseStore {
  activeCourse: CourseDetail | null;
  activeLesson: Lesson | null;
  activeModule: Module | null;
  lessonContext: LessonContext | null;
  setActiveCourse: (course: CourseDetail) => void;
  setActiveLesson: (lesson: Lesson, module: Module, courseId: string, courseTitle: string) => void;
  clearLesson: () => void;
}

export const useCourseStore = create<CourseStore>((set) => ({
  activeCourse: null,
  activeLesson: null,
  activeModule: null,
  lessonContext: null,

  setActiveCourse: (course) => set({ activeCourse: course }),

  setActiveLesson: (lesson, module, courseId, courseTitle) =>
    set({
      activeLesson: lesson,
      activeModule: module,
      lessonContext: {
        courseId,
        moduleId: module.id,
        lessonId: lesson.id,
        courseTitle,
        moduleTitle: module.title,
        lessonTitle: lesson.title,
      },
    }),

  clearLesson: () =>
    set({ activeLesson: null, activeModule: null, lessonContext: null }),
}));
