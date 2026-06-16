import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCourseDetail } from '@/hooks';
import { useCourseStore } from '@/store';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useCourseDetail(id);
  const setActiveLesson = useCourseStore((s) => s.setActiveLesson);
  const setActiveCourse = useCourseStore((s) => s.setActiveCourse);

  const course = data?.course;

  const openPayment = () => {
    if (!course) return;
    Linking.openURL(`https://www.codingkida.com/payment?courseId=${course.id}`);
  };

  const openLesson = (lessonId: string, moduleId: string) => {
    if (!course) return;
    const mod = course.modules.find((m) => m.id === moduleId);
    const lesson = mod?.lessons.find((l) => l.id === lessonId);
    if (!mod || !lesson) return;
    setActiveCourse(course);
    setActiveLesson(lesson, mod, course.id, course.title);
    router.push(`/lesson/${lessonId}`);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>Loading course...</Text>
      </SafeAreaView>
    );
  }

  if (!course) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>Course not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.courseTitle}>{course.title}</Text>
          <Text style={styles.courseMeta}>
            {course.instructor} · {course.totalHours}h · {course.totalVideos} videos
          </Text>
          <View style={styles.badges}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>⭐ {course.rating}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>👥 {course.students}</Text>
            </View>
            {course.isEnrolled && (
              <View style={[styles.badge, { backgroundColor: Colors.successLight }]}>
                <Text style={[styles.badgeText, { color: Colors.success }]}>✅ Enrolled</Text>
              </View>
            )}
          </View>

          {/* Unlock Course Button — shown when not enrolled */}
          {!course.isEnrolled && (
            <TouchableOpacity style={styles.unlockBtn} onPress={openPayment}>
              <Text style={styles.unlockBtnText}>🔓 Unlock Course</Text>
            </TouchableOpacity>
          )}
        </View>

        {course.modules.map((mod) => (
          <View key={mod.id} style={styles.module}>
            <Text style={styles.moduleTitle}>{mod.title}</Text>
            {mod.lessons.map((lesson) => {
              const canAccess = course.isEnrolled || lesson.isFree;
              return (
                <TouchableOpacity
                  key={lesson.id}
                  style={[styles.lessonItem, !canAccess && styles.lessonLocked]}
                  onPress={() => canAccess ? openLesson(lesson.id, mod.id) : openPayment()}
                >
                  <Text style={styles.lessonIcon}>{canAccess ? '▶' : '🔒'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lessonTitle, !canAccess && { color: Colors.muted }]}>
                      {lesson.title}
                    </Text>
                    <Text style={styles.lessonDuration}>{lesson.duration}</Text>
                  </View>
                  <View style={[
                    styles.lessonBadge,
                    { backgroundColor: lesson.isFree ? Colors.successLight : Colors.primaryLight },
                  ]}>
                    <Text style={[
                      styles.lessonBadgeText,
                      { color: lesson.isFree ? Colors.success : Colors.purple },
                    ]}>
                      {lesson.isFree ? 'Free' : course.isEnrolled ? 'Enrolled' : 'Pro'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loading: { color: Colors.muted, textAlign: 'center', marginTop: 80, fontSize: Typography.base },
  backBtn: { padding: Spacing.xl, paddingBottom: Spacing.sm },
  backText: { color: Colors.primary, fontSize: 20, fontWeight: FontWeight.semibold },
  header: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  courseTitle: { color: Colors.white, fontSize: Typography.xxl, fontWeight: FontWeight.extrabold, marginBottom: Spacing.sm },
  courseMeta: { color: Colors.muted, fontSize: Typography.sm, marginBottom: Spacing.md },
  badges: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  badge: {
    backgroundColor: Colors.card, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  badgeText: { color: Colors.muted, fontSize: Typography.xs, fontWeight: FontWeight.semibold },
  module: { marginHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  moduleTitle: {
    color: Colors.muted, fontSize: Typography.xs, fontWeight: FontWeight.bold,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm,
  },
  lessonItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  lessonLocked: { opacity: 0.6 },
  lessonIcon: { color: Colors.success, fontSize: Typography.sm, width: 16 },
  lessonTitle: { color: Colors.white, fontSize: Typography.sm, fontWeight: FontWeight.medium },
  lessonDuration: { color: Colors.muted, fontSize: Typography.xs, marginTop: 2 },
  lessonBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  lessonBadgeText: { fontSize: Typography.xs, fontWeight: FontWeight.bold },
  unlockBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center',
    marginTop: Spacing.lg, alignSelf: 'flex-start',
  },
  unlockBtnText: { color: '#fff', fontSize: Typography.sm, fontWeight: FontWeight.bold },
});
