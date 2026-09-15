// Shared course metadata helpers — real backend data only, mirrors the desktop
// app (courses.js + utils.js). Used by both the courses grid and the course
// detail screen so the logic lives in exactly one place (no duplication).
import type { Course, CourseDetail } from '@/types';

/**
 * Format a duration in SECONDS to a readable label (mirrors desktop
 * formatCourseDuration). Returns '' for zero/invalid so callers can hide the
 * chip gracefully (never fabricated).
 * e.g. "2 Hours 15 Mins", "45 Mins", "30 Sec"
 */
export function formatCourseDuration(totalSeconds?: number): string {
  let totalSec = Number(totalSeconds) || 0;
  if (totalSec <= 0) return '';
  totalSec = Math.round(totalSec);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} Hour${h > 1 ? 's' : ''}${m > 0 ? ` ${m} Mins` : ''}`;
  if (m > 0) return `${m} Min${m > 1 ? 's' : ''}${s > 0 ? ` ${s} Sec` : ''}`;
  return `${s} Sec`;
}

/**
 * Parse a stored lesson duration into seconds (mirrors desktop
 * _parseLessonDuration). Supports plain seconds ("383"), "MM:SS" ("6:23") and
 * "HH:MM:SS". Unset values ("00:00" / "0" / "") contribute 0.
 */
export function parseLessonDuration(d?: string | null): number {
  if (!d) return 0;
  const s = String(d).trim();
  if (!s || s === '00:00' || s === '0') return 0;
  if (s.indexOf(':') === -1) {
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  }
  const p = s.split(':').map((x) => parseInt(x, 10));
  if (p.some((n) => isNaN(n))) return 0;
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] || 0;
}

/**
 * Real lesson count for a course (mirrors desktop courseLessonCount). Prefers
 * actual lessons across modules, then the list route's lessonCount, then
 * totalVideos, then the module count. Never fabricated; 0 hides the chip.
 */
export function courseLessonCount(c: Course | CourseDetail): number {
  const fromModules = ((c as CourseDetail).modules || []).reduce(
    (n, m) => n + (m.lessons || []).length,
    0
  );
  if (fromModules > 0) return fromModules;
  if (c.lessonCount && Number(c.lessonCount) > 0) return Number(c.lessonCount);
  if (c.totalVideos && Number(c.totalVideos) > 0) return Number(c.totalVideos);
  if (c._count?.modules && Number(c._count.modules) > 0) return Number(c._count.modules);
  return 0;
}

/**
 * Real enrolled-student count (mirrors desktop): prefer enrolledStudents
 * (purchasers) from backend, else the stored students value. 0 hides the chip.
 */
export function courseStudents(c: Course | CourseDetail): number {
  if (typeof c.enrolledStudents === 'number' && c.enrolledStudents > 0) return c.enrolledStudents;
  if (c.students && Number(c.students) > 0) return Number(c.students);
  return 0;
}

/**
 * Real total duration in SECONDS for a course. Prefers the backend-computed
 * totalDurationSeconds (list route), else sums the per-lesson durations from
 * the detail modules (mirrors the desktop course-detail hero). No fabrication.
 */
export function courseDurationSeconds(c: Course | CourseDetail): number {
  if (typeof c.totalDurationSeconds === 'number' && c.totalDurationSeconds > 0) {
    return c.totalDurationSeconds;
  }
  const modules = (c as CourseDetail).modules || [];
  let totalSec = 0;
  for (const m of modules) {
    for (const l of m.lessons || []) totalSec += parseLessonDuration(l.duration);
  }
  return totalSec;
}
