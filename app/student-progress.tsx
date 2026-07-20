import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api';
import { Colors } from '@/theme';

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  let stars = '';
  for (let i = 1; i <= 5; i++) stars += i <= full ? '★' : '☆';
  return stars;
}

export default function StudentProgressScreen() {
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [showRatingDetail, setShowRatingDetail] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['student-progress'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/api/student/progress');
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>←</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>Student Progress</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.loadingState}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading progress...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data?.success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>←</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>Student Progress</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.loadingState}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>⚠️</Text>
          <Text style={styles.loadingText}>Failed to load progress.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const courses = data.courses || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Student Progress</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Overall Rating Card */}
        <TouchableOpacity style={styles.overallCard} onPress={() => setShowRatingDetail(!showRatingDetail)} activeOpacity={0.8}>
          <Text style={styles.overallLabel}>OVERALL STUDENT RATING</Text>
          <View style={styles.overallRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.starsRow}>
                <Text style={styles.starsText}>{renderStars(data.overallRating)}</Text>
                <Text style={styles.ratingValue}>{data.overallRating}/5</Text>
              </View>
              <Text style={styles.overallMeta}>
                Based on quiz accuracy (70%) + exercise completion (30%) · Score: {data.overallScore}%
              </Text>
            </View>
            <View style={styles.overallStats}>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatValue}>{data.totalLessonsCompleted}/{data.totalLessons}</Text>
                <Text style={styles.miniStatLabel}>Lessons</Text>
              </View>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatValue}>{courses.length}</Text>
                <Text style={styles.miniStatLabel}>Courses</Text>
              </View>
            </View>
          </View>

          {/* Rating Breakdown (expandable) */}
          {showRatingDetail && data.ratingBreakdown && (
            <View style={styles.breakdownSection}>
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>🧠 Quiz Rating</Text>
                <Text style={styles.breakdownStars}>{renderStars(data.ratingBreakdown.quiz.rating)} {data.ratingBreakdown.quiz.rating}/5</Text>
                <Text style={styles.breakdownMeta}>Accuracy: {data.ratingBreakdown.quiz.accuracy}%</Text>
                <Text style={styles.breakdownMeta}>Total: {data.ratingBreakdown.quiz.totalQuizzes} · Attempted: {data.ratingBreakdown.quiz.attempted} · Correct: {data.ratingBreakdown.quiz.correct}</Text>
              </View>
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>💻 Exercise Rating</Text>
                <Text style={styles.breakdownStars}>{renderStars(data.ratingBreakdown.exercise.rating)} {data.ratingBreakdown.exercise.rating}/5</Text>
                <Text style={styles.breakdownMeta}>Pass Rate: {data.ratingBreakdown.exercise.passRate}%</Text>
                <Text style={styles.breakdownMeta}>Total: {data.ratingBreakdown.exercise.totalExercises} · Attempted: {data.ratingBreakdown.exercise.attempted} · Passed: {data.ratingBreakdown.exercise.passed}</Text>
              </View>
            </View>
          )}
          <Text style={styles.tapHint}>{showRatingDetail ? '▲ Tap to collapse' : '▼ Tap to see breakdown'}</Text>
        </TouchableOpacity>

        {/* Course-wise Progress */}
        <Text style={styles.sectionTitle}>Course-wise Progress</Text>

        {courses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>📖</Text>
            <Text style={styles.emptyText}>No enrolled courses yet. Start learning to see your progress!</Text>
          </View>
        ) : (
          courses.map((course: any) => (
            <View key={course.id} style={styles.courseCard}>
              {/* Course Header (tap to expand) */}
              <TouchableOpacity
                style={styles.courseHeader}
                onPress={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.courseIcon, { backgroundColor: course.color || Colors.primaryLight }]}>
                  <Text style={{ fontSize: 16 }}>📚</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseTitle} numberOfLines={1}>{course.title}</Text>
                  <Text style={styles.courseMeta}>
                    {course.lessonsCompleted}/{course.totalLessons} lessons · Quiz: {course.quiz.accuracy}% · Progress: {course.progressPercent}%
                  </Text>
                </View>
                <Text style={styles.chevron}>{expandedCourse === course.id ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {/* Course Content (expanded) */}
              {expandedCourse === course.id && (
                <View style={styles.courseContent}>
                  {/* Course Stats */}
                  <View style={styles.courseStatsRow}>
                    <View style={[styles.courseStat, { backgroundColor: 'rgba(108,71,255,0.1)' }]}>
                      <Text style={styles.courseStatValue}>{course.quiz.attempted}/{course.quiz.total}</Text>
                      <Text style={styles.courseStatLabel}>Quizzes Done</Text>
                    </View>
                    <View style={[styles.courseStat, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                      <Text style={styles.courseStatValue}>{course.exercise.passed}/{course.exercise.total}</Text>
                      <Text style={styles.courseStatLabel}>Exercises Passed</Text>
                    </View>
                    <View style={[styles.courseStat, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                      <Text style={styles.courseStatValue}>{course.quiz.accuracy}%</Text>
                      <Text style={styles.courseStatLabel}>Quiz Accuracy</Text>
                    </View>
                  </View>

                  {/* Modules & Lessons */}
                  {(course.modules || []).map((mod: any) => (
                    <View key={mod.id} style={styles.moduleSection}>
                      <Text style={styles.moduleTitle}>{mod.title}</Text>
                      {(mod.lessons || []).map((lesson: any) => (
                        <View key={lesson.id} style={styles.lessonItem}>
                          <Text style={[styles.lessonIcon, { color: lesson.completed ? Colors.success : 'rgba(255,255,255,0.2)' }]}>
                            {lesson.completed ? '✅' : '○'}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.lessonTitle} numberOfLines={1}>{lesson.title}</Text>
                            <View style={styles.lessonBadges}>
                              {lesson.quiz.total > 0 && (
                                <Text style={[styles.badge, { backgroundColor: lesson.quiz.accuracy != null && lesson.quiz.accuracy >= 70 ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: lesson.quiz.accuracy != null && lesson.quiz.accuracy >= 70 ? '#4ade80' : '#fbbf24' }]}>
                                  Quiz: {lesson.quiz.accuracy != null ? `${lesson.quiz.accuracy}%` : 'Not taken'}
                                </Text>
                              )}
                              {lesson.exercise.total > 0 && (
                                <Text style={[styles.badge, { backgroundColor: lesson.exercise.passed > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: lesson.exercise.passed > 0 ? '#4ade80' : '#f87171' }]}>
                                  Ex: {lesson.exercise.passed}/{lesson.exercise.total}
                                </Text>
                              )}
                              {lesson.homeworkCount > 0 && (
                                <Text style={[styles.badge, { backgroundColor: 'rgba(236,72,153,0.15)', color: '#ec4899' }]}>
                                  HW: {lesson.homeworkCount}
                                </Text>
                              )}
                              {(lesson.achievements || []).map((a: any, i: number) => (
                                <Text key={i} style={[styles.badge, { backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24' }]}>
                                  {a.badgeType === 'super-master' ? '🏆' : a.badgeType === 'master' ? '🥈' : '⭐'}
                                </Text>
                              ))}
                            </View>
                          </View>
                          {lesson.duration ? <Text style={styles.lessonDuration}>{lesson.duration}</Text> : null}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { color: Colors.primary, fontSize: 20, fontWeight: '600', paddingRight: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { padding: 16 },
  loadingState: { alignItems: 'center', padding: 60, gap: 12 },
  loadingText: { color: Colors.muted, fontSize: 14 },
  retryBtn: { marginTop: 12, backgroundColor: Colors.primaryLight, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },

  // Overall Card
  overallCard: {
    backgroundColor: 'rgba(108,71,255,0.1)', borderRadius: 20, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)',
  },
  overallLabel: { fontSize: 10, color: Colors.muted, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  overallRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  starsText: { fontSize: 18, color: '#fbbf24' },
  ratingValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  overallMeta: { fontSize: 11, color: Colors.muted, lineHeight: 16 },
  overallStats: { flexDirection: 'row', gap: 8 },
  miniStat: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10, alignItems: 'center' },
  miniStatValue: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 2 },
  miniStatLabel: { fontSize: 9, color: Colors.muted },
  tapHint: { color: Colors.muted, fontSize: 10, textAlign: 'center', marginTop: 10 },

  // Breakdown
  breakdownSection: { flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  breakdownCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  breakdownTitle: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 6 },
  breakdownStars: { fontSize: 12, color: '#fbbf24', marginBottom: 6 },
  breakdownMeta: { fontSize: 11, color: Colors.muted, lineHeight: 18 },

  // Section
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 14 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: Colors.muted, fontSize: 13, textAlign: 'center' },

  // Course Card
  courseCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16,
    marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  courseHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  courseIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  courseTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 3 },
  courseMeta: { fontSize: 11, color: Colors.muted },
  chevron: { color: Colors.muted, fontSize: 12 },

  // Course Content
  courseContent: { paddingHorizontal: 16, paddingBottom: 16 },
  courseStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  courseStat: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  courseStatValue: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 2 },
  courseStatLabel: { fontSize: 9, color: Colors.muted },

  // Module
  moduleSection: { marginBottom: 12 },
  moduleTitle: { fontSize: 11, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4 },

  // Lesson
  lessonItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 10, marginBottom: 6,
  },
  lessonIcon: { fontSize: 14 },
  lessonTitle: { fontSize: 12, fontWeight: '600', color: '#fff', marginBottom: 4 },
  lessonBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', fontWeight: '600' },
  lessonDuration: { fontSize: 10, color: Colors.muted },
});
