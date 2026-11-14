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
  // Real counts returned by the /api/courses list route (backend-computed).
  // lessonCount: total lessons across modules; totalDurationSeconds: summed
  // from stored per-lesson durations; enrolledStudents: real purchaser count.
  lessonCount?: number;
  totalDurationSeconds?: number;
  enrolledStudents?: number;
  _count?: { modules?: number };
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  videoUrl: string;
  notes: string;
  isFree: boolean;
  order: number;
  // HLS Quality fields (returned when ?signed=true)
  qualityUrls?: Record<string, string>;
  hlsQualities?: string[];
  hlsStatus?: string;
}

export interface ModuleMaterial {
  id: string;
  title: string;
  fileUrl: string;
  fileType: string; // "pdf" | "ppt" | "doc" | "image"
  fileSize?: number;
  order?: number;
}

export interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
  materials?: ModuleMaterial[];
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
  // Coding exercises (type === 'coding') open the code editor (desktop parity).
  // All of these come from GET /api/exercise.
  type?: string | null;
  language?: string | null; // 'java' | 'c' | 'python' | 'javascript' — locks the editor
  inputFormat?: string | null;
  outputFormat?: string | null;
  constraints?: string | null;
  explanation?: string | null;
  tags?: string[] | null;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
}

export interface Homework {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  order: number;
}
