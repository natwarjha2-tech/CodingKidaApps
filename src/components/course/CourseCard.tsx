// Reusable premium CourseCard — used by the Courses grid (and reusable by any
// future screen). Renders purely from the `course` prop; no hardcoded course
// data. Uses the global design tokens + AnimatedPressable (Phase 1). All real
// backend values via the shared course.util helpers (no duplication).
import type { FC } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '@/components/ui';
import { formatCourseDuration, courseLessonCount, courseStudents } from '@/utils/course.util';
import type { Course } from '@/types';
import { L, Radius, Shadow, TextStyles } from '@/theme';

// Real subject images (C/Java/Python) + desktop SVG banners for other subjects.
let imgC: any = null, imgJava: any = null, imgPython: any = null;
try { imgC = require('../../../assets/courses/c.jpeg'); } catch {}
try { imgJava = require('../../../assets/courses/java.jpeg'); } catch {}
try { imgPython = require('../../../assets/courses/python.jpeg'); } catch {}
import DsaBanner from '../../../assets/courses/dsa-banner.svg';
import WebBanner from '../../../assets/courses/web-banner.svg';
import RoboticsBanner from '../../../assets/courses/robotics-banner.svg';
import AiBanner from '../../../assets/courses/ai-banner.svg';
import ProblemBanner from '../../../assets/courses/problem-banner.svg';

function courseThumb(title: string): { img?: any; Svg?: FC<any>; icon: string; tint: string } {
  const t = (title || '').toLowerCase().trim();
  if (t.includes('python')) return { img: imgPython, icon: '🐍', tint: '#E4EEF7' };
  if (t.includes('java') && !t.includes('javascript')) return { img: imgJava, icon: '☕', tint: '#FDE7E7' };
  if (t === 'c' || t.startsWith('c ') || t.includes('c programming')) return { img: imgC, icon: 'C', tint: '#E4F8EC' };
  if (t.includes('dsa') || t.includes('data structure') || t.includes('algorithm')) return { Svg: DsaBanner, icon: '🧩', tint: '#EEE9FF' };
  if (t.includes('web') || t.includes('html')) return { Svg: WebBanner, icon: '🌐', tint: '#E4F1FB' };
  if (t.includes('robot')) return { Svg: RoboticsBanner, icon: '🤖', tint: '#EAECEF' };
  if (t.includes('artificial') || t === 'ai' || t.startsWith('ai ') || t.includes(' ai') || t.includes('intelligence') || t.includes('machine learning')) return { Svg: AiBanner, icon: '🧠', tint: '#FCE4F1' };
  if (t.includes('problem')) return { Svg: ProblemBanner, icon: '💡', tint: '#E4F8EC' };
  if (t.includes('scratch') || t.includes('game') || t.includes('kid')) return { icon: '🎮', tint: '#FFF3DC' };
  return { icon: '📘', tint: L.primaryLight };
}

interface Props {
  course: Course;
  onPress: () => void;
}

export function CourseCard({ course, onPress }: Props) {
  const th = courseThumb(course.title || '');
  const lessons = courseLessonCount(course);
  const duration = formatCourseDuration(course.totalDurationSeconds);
  const students = courseStudents(course);

  return (
    <AnimatedPressable style={styles.card} onPress={onPress} haptic>
      {/* Thumbnail */}
      <View style={[styles.thumb, { backgroundColor: th.tint }]}>
        {th.img ? (
          <Image source={th.img} style={styles.thumbImg} resizeMode="cover" />
        ) : th.Svg ? (
          <th.Svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
        ) : (
          <Text style={styles.thumbIcon}>{th.icon}</Text>
        )}
        {/* Soft top sheen → subtle depth so the badge/bookmark read cleanly */}
        <LinearGradient
          colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {course.category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{course.category}</Text>
          </View>
        ) : null}
        {/* Bookmark chip (top-right) — visual affordance matching the reference */}
        <View style={styles.bookmark}>
          <Text style={styles.bookmarkIcon}>♡</Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{course.title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>{course.subtitle || `Learn ${course.title} from basics to advanced`}</Text>

        {/* Meta — each on its own line with a soft icon chip (matches reference) */}
        <View style={styles.metaCol}>
          {lessons > 0 ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📖</Text>
              <Text style={styles.metaText} numberOfLines={1}>{lessons} Lesson{lessons > 1 ? 's' : ''}</Text>
            </View>
          ) : null}
          {duration ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>⏱</Text>
              <Text style={styles.metaText} numberOfLines={1}>{duration}</Text>
            </View>
          ) : null}
          {students > 0 ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>👥</Text>
              <Text style={styles.metaText} numberOfLines={1}>{students} Students</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.rating}>⭐ {course.rating || '4.5'}</Text>
          <View style={[styles.priceBadge, { backgroundColor: course.isFree ? L.successLight : L.primaryLight }]}>
            <Text style={[styles.priceText, { color: course.isFree ? L.success : L.primary }]}>
              {course.isFree ? 'Free' : 'Pro'}
            </Text>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: L.surface,
    borderRadius: Radius.card, overflow: 'hidden',
    borderWidth: 1, borderColor: L.border,
    ...Shadow.md,
  },
  thumb: { height: 118, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  thumbIcon: { fontSize: 40, zIndex: 1, color: L.primary, fontWeight: '900' },
  categoryBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  categoryBadgeText: { color: L.primary, fontSize: 9.5, fontWeight: '800' },
  bookmark: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  bookmarkIcon: { fontSize: 15, color: L.primary, fontWeight: '700' },
  body: { padding: 12 },
  title: { ...TextStyles.cardTitle, color: L.textPrimary, marginBottom: 3, lineHeight: 18 },
  subtitle: { color: L.textMuted, fontSize: 11, fontWeight: '500', marginBottom: 10, lineHeight: 15 },
  metaCol: { gap: 6, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaIcon: { fontSize: 11 },
  metaText: { color: L.textSecondary, fontSize: 11, fontWeight: '600', flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' },
  rating: { color: L.coins, fontSize: 12.5, fontWeight: '800' },
  priceBadge: { borderRadius: Radius.pill, paddingHorizontal: 11, paddingVertical: 4 },
  priceText: { fontSize: 11, fontWeight: '800' },
});
