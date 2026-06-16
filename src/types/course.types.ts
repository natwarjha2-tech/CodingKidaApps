export interface Course {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  instructor: string;
  institute: string;
  students: number;
  rating: number;
  totalHours: number;
  totalVideos: number;
  hasCert: boolean;
  color: string;
  icon: string;
  isActive: boolean;
  isEnrolled?: boolean;
  isFree?: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  videoUrl: string;
  notes: string;
  isFree: boolean;
  order: number;
}

export interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

export interface CourseDetail extends Course {
  modules: Module[];
  completedLessons?: string[];
}

export interface Quiz {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
  order: number;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  starterCode?: string;
  hints?: string[];
  order: number;
}

export interface Homework {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  order: number;
}
