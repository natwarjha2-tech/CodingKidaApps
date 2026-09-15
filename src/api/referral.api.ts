import { apiClient } from './client';

export interface ReferralInfo {
  code: string;
  referredCount: number;
  coinsEarned: number;
  hasApplied: boolean;
  canApply: boolean;
  rewardNewUser: number;
  rewardReferrer: number;
}

export const referralApi = {
  /** Real server-issued referral code + stats (GET /api/referral). */
  get: () =>
    apiClient
      .get<{ success: boolean } & ReferralInfo>('/api/referral')
      .then((r) => r.data),

  /** Apply a friend's referral code (POST /api/referral/apply → new user earns coins). */
  apply: (code: string) =>
    apiClient
      .post<{ success: boolean; message: string; coinsAwarded?: number }>('/api/referral/apply', { code })
      .then((r) => r.data),
};
