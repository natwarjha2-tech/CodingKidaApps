import { apiClient } from './client';
import type { Course, CourseDetail } from '@/types';

export const coursesApi = {
  getAll: (category?: string, search?: string) => {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (search?.trim()) params.append('search', search.trim());
    const query = params.toString();
    return apiClient
      .get<{ success: boolean; courses: Course[] }>(`/api/courses${query ? `?${query}` : ''}`)
      .then((r) => r.data);
  },

  getById: (id: string) =>
    apiClient
      .get<{ success: boolean; course: CourseDetail }>(`/api/courses/${id}?signed=true`)
      .then((r) => r.data),

  // "Sign on play" — signed, ready-to-stream data for ONE lesson, fetched only
  // when the user opens that lesson (the course response no longer signs every
  // lesson upfront, which kept course-open fast for large courses).
  getLessonPlay: (lessonId: string) =>
    apiClient
      .get<{
        success: boolean;
        lesson: {
          id: string;
          title: string;
          notes: string;
          videoUrl: string;
          mediaId: string | null;
          hlsMasterUrl: string | null;
          hlsStatus: string;
          hlsQualities: string[];
          qualityUrls: Record<string, string>;
          isFree: boolean;
          locked: boolean;
        };
      }>(`/api/lessons/${lessonId}/play`)
      .then((r) => r.data),

  // HLS auth — authorizes adaptive (HLS) playback for ONE lesson and returns
  // the stable CloudFront master-playlist URL + CloudFront SIGNED COOKIES scoped
  // to that media's hls/<mediaId>/* prefix. The player sends those cookies on
  // every segment request so CloudFront can serve (and edge-cache) the segments.
  // When HLS isn't ready / CloudFront isn't configured → hlsReady:false and the
  // client falls back to the signed MP4 qualities from getLessonPlay.
  getLessonHlsAuth: (lessonId: string) =>
    apiClient
      .get<{
        success: boolean;
        hlsReady: boolean;
        locked: boolean;
        masterUrl: string | null;
        cookies: CloudFrontCookies | null;
        expiresIn: number;
      }>(`/api/lessons/${lessonId}/hls-auth`)
      .then((r) => r.data),

  enroll: (courseId: string) =>
    apiClient
      .post(`/api/courses/${courseId}/enroll`, {})
      .then((r) => r.data),
};

/** The three cookies CloudFront expects for signed-cookie HLS delivery. */
export type CloudFrontCookies = {
  'CloudFront-Policy': string;
  'CloudFront-Signature': string;
  'CloudFront-Key-Pair-Id': string;
};

/**
 * Join CloudFront signed cookies into a single `Cookie` request-header value.
 * react-native-video (ExoPlayer on Android) forwards `source.headers` on every
 * HLS manifest + segment request, so sending the cookies this way authorizes
 * the whole hls/<mediaId>/* path with one header. Returns '' when no cookies.
 */
export function cloudFrontCookieHeader(cookies: CloudFrontCookies | null | undefined): string {
  if (!cookies) return '';
  return [
    `CloudFront-Policy=${cookies['CloudFront-Policy']}`,
    `CloudFront-Signature=${cookies['CloudFront-Signature']}`,
    `CloudFront-Key-Pair-Id=${cookies['CloudFront-Key-Pair-Id']}`,
  ].join('; ');
}
