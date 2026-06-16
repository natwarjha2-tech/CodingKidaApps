import { useQuery } from '@tanstack/react-query';
import { studentApi } from '@/api';
import { useAuthStore } from '@/store';

export const useDashboard = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => studentApi.getDashboard(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 min cache
    retry: 1,
  });
};
