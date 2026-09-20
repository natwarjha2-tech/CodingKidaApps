export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface EnrolledCourse {
  id: string;
  courseId: { _id?: string; id?: string } | string;
  title: string;
  icon: string;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
}

export interface DashboardData {
  success: boolean;
  enrolledCount: number;
  enrolledCourses: EnrolledCourse[];
  lastWatched?: {
    courseId: string;
    courseTitle: string;
    courseIcon: string;
    moduleTitle: string;
    lessonTitle: string;
    progressPercent: number;
    moduleId?: string;
    lessonId?: string;
  };
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  studentName?: string;
  studentDob?: string;
  studentGrade?: string;
  studentGender?: string;
  studentSchool?: string;
  parentName?: string;
  parentEmail?: string;
  parentContact?: string;
}

export interface CoinTransaction {
  type: 'EARNED' | 'SPENT';
  coins: number;
  reason: string;
  createdAt: string;
  // Course → Module → Lesson hierarchy (present for quiz-reward transactions;
  // null for referral / coupon / coding — those fall back to `reason`).
  courseTitle?: string | null;
  moduleTitle?: string | null;
  lessonTitle?: string | null;
}

export interface CoinsData {
  success: boolean;
  totalCoins: number;
  transactions: CoinTransaction[];
}

export interface Achievement {
  id: string;
  title: string;
  badgeType: 'super-master' | 'master' | 'pro';
  lessonId: string;
  lessonTitle?: string;
  courseId?: string;
  courseTitle?: string;
  score?: number;
  rank?: number;
  studentName?: string;
  instructor?: string;
  earnedAt?: string;
  createdAt: string;
}
