import { useQuery } from '@tanstack/react-query';
import { coinsApi } from '@/api';
import { useAuthStore } from '@/store';

export const useCoins = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['coins'],
    queryFn: () => coinsApi.get(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 min cache
  });
};
