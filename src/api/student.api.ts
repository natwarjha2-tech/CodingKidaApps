import { apiClient } from './client';
import type { DashboardData, StudentProfile } from '@/types';

export const studentApi = {
  getProfile: () =>
    apiClient.get<{ success: boolean; student: StudentProfile }>('/api/student').then((r) => r.data),

  getDashboard: () =>
    apiClient.get<DashboardData>('/api/student/dashboard?signed=true').then((r) => r.data),

  updateProfile: (data: Partial<StudentProfile>) =>
    apiClient.patch('/api/student/profile', data).then((r) => r.data),

  getAvatar: () =>
    apiClient
      .get<{ success: boolean; avatarUrl: string }>('/api/student/avatar')
      .then((r) => r.data),
};
