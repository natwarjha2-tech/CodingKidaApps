import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCourseDetail } from '@/hooks';
import { useCourseStore } from '@/store';
import { DownloadService } from '@/services';
import { PdfViewer } from '@/components/lesson/PdfViewer';
import type { ModuleMaterial } from '@/types';
import { formatCourseDuration, courseLessonCount, courseStudents, courseDurationSeconds } from '@/utils/course.util';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';

// Icon + color per study-material file type (mirrors desktop)
function materialIcon(fileType: string): { icon: string; color: string } {
  switch (fileType) {
    case 'ppt':   return { icon: '📊', color: '#f59e0b' };
    case 'image': return { icon: '🖼️', color: '#3b82f6' };
    case 'doc':   return { icon: '📃', color: '#2563eb' };
    default:      return { icon: '📄', color: '#ef4444' }; // pdf
  }
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useCourseDetail(id);
  const setActiveLesson = useCourseStore((s) => s.setActiveLesson);
  const setActiveCourse = useCourseStore((s) => s.setActiveCourse);

  const [pdfVisible, setPdfVisible] = useState(false);
  const [activePdfUrl, setActivePdfUrl] = useState('');
  // Per-material download status: materialId -> remaining days (>=0 downloaded, undefined = not downloaded)
  const [downloadedMap, setDownloadedMap] = useState<Record<string, number>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const course = data?.course;

  // Refresh downloaded-status for every study material (reuses existing DownloadService).
  const refreshMaterialStatus = useCallback(async () => {
    const c = data?.course;
    if (!c) return;
    const map: Record<string, number> = {};
    try {
      const all = await DownloadService.getAll();
      for (const mod of c.modules) {
        for (const mat of mod.materials ?? []) {
          const rec = all.find((d) => d.id === `material_${mat.id}_pdf`);
          if (rec && new Date(rec.expiresAt) > new Date()) {
            map[mat.id] = DownloadService.getRemainingDays(rec.expiresAt);
          }
        }
      }
    } catch {
      // Silent — leave map empty on failure
    }
    setDownloadedMap(map);
  }, [data?.course]);

  // Re-check whenever the screen regains focus (e.g. returning from Downloads).
  useFocusEffect(useCallback(() => { refreshMaterialStatus(); }, [refreshMaterialStatus]));

  const openPayment = () => {
    if (!course) return;
    Linking.openURL(`https://www.codingkida.com/payment?courseId=${course.id}`);
  };

  // View a study-material file in the in-app PDF viewer
  const viewMaterial = (fileUrl: string) => {
    if (!fileUrl) return;
    setActivePdfUrl(fileUrl);
    setPdfVisible(true);
  };

  // Download a study-material file for offline access.
  // force = true re-downloads even if already saved (used by "Re-download").
  const downloadMaterial = async (mat: ModuleMaterial, moduleTitle: string, force = false) => {
    if (!course || !mat.fileUrl) return;
    if (downloadingId) return; // a download is already in progress — block double-tap

    // Already downloaded (and not expired)? Don't re-download unless forced.
    if (!force && downloadedMap[mat.id] != null) {
      const days = downloadedMap[mat.id];
      Alert.alert(
        'Already Downloaded ✅',
        `"${mat.title}" is available offline in Downloads (${days} day${days === 1 ? '' : 's'} left).`,
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Re-download', onPress: () => downloadMaterial(mat, moduleTitle, true) },
        ],
      );
      return;
    }

    setDownloadingId(mat.id);
    try {
      await DownloadService.download({
        lessonId: `material_${mat.id}`,
        lessonTitle: mat.title,
        moduleTitle,
        courseId: course.id,
        courseTitle: course.title,
        type: 'pdf',
        url: mat.fileUrl,
      });
      // Instant UI update — mark as downloaded with a fresh 30-day window.
      setDownloadedMap((prev) => ({ ...prev, [mat.id]: 30 }));
      Alert.alert('Success! ✅', 'Study material downloaded for offline access (30 days).');
    } catch (err: any) {
      Alert.alert('Download Failed', err?.message || 'Please check your internet and try again.');
    } finally {
      setDownloadingId(null);
    }
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
          {/* Real metadata — duration summed from lesson durations, lesson count
              across modules, students from enrolledStudents (mirrors desktop). */}
          <Text style={styles.courseMeta}>
            {[
              course.instructor,
              formatCourseDuration(courseDurationSeconds(course)),
              `${courseLessonCount(course)} videos`,
            ].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.badges}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>⭐ {course.rating || '—'}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>👥 {courseStudents(course)}</Text>
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

            {/* Study Material — admin-uploaded files per module (mirrors desktop) */}
            {mod.materials && mod.materials.length > 0 && (
              <View style={styles.materialSection}>
                <View style={styles.materialHeader}>
                  <Text style={styles.materialHeaderText}>📚 STUDY MATERIAL</Text>
                  <Text style={styles.materialCount}>
                    {mod.materials.length} file{mod.materials.length > 1 ? 's' : ''}
                  </Text>
                </View>
                {mod.materials.map((mat) => {
                  const canAccess = course.isEnrolled || course.isFree;
                  const { icon, color } = materialIcon(mat.fileType);
                  return (
                    <View key={mat.id} style={[styles.materialItem, !canAccess && styles.materialLocked]}>
                      <Text style={[styles.materialIcon, { color }]}>{icon}</Text>
                      <Text style={styles.materialTitle} numberOfLines={1}>{mat.title}</Text>
                      {canAccess && mat.fileUrl ? (
                        <View style={styles.materialBtns}>
                          <TouchableOpacity style={styles.materialViewBtn} onPress={() => viewMaterial(mat.fileUrl)}>
                            <Text style={styles.materialViewText}>View</Text>
                          </TouchableOpacity>
                          {downloadingId === mat.id ? (
                            <View style={[styles.materialDownloadBtn, styles.materialBtnBusy]}>
                              <ActivityIndicator size="small" color={Colors.success} />
                            </View>
                          ) : downloadedMap[mat.id] != null ? (
                            <TouchableOpacity
                              style={[styles.materialDownloadBtn, styles.materialDownloadedBtn]}
                              onPress={() => downloadMaterial(mat, mod.title)}
                            >
                              <Text style={styles.materialDownloadedText}>Downloaded ✓</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity style={styles.materialDownloadBtn} onPress={() => downloadMaterial(mat, mod.title)}>
                              <Text style={styles.materialDownloadText}>Download</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.materialLock}>🔒</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      {/* In-app PDF viewer for study material */}
      <PdfViewer
        visible={pdfVisible}
        pdfUrl={activePdfUrl}
        onClose={() => { setPdfVisible(false); setActivePdfUrl(''); }}
      />
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

  // Study Material
  materialSection: {
    marginTop: Spacing.sm, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  materialHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  materialHeaderText: { color: Colors.purple, fontSize: Typography.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  materialCount: { color: Colors.muted, fontSize: Typography.xs, marginLeft: 'auto' },
  materialItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  materialLocked: { opacity: 0.5 },
  materialIcon: { fontSize: 15, width: 22, textAlign: 'center' },
  materialTitle: { flex: 1, color: Colors.white, fontSize: Typography.sm, fontWeight: FontWeight.medium },
  materialBtns: { flexDirection: 'row', gap: 6 },
  materialViewBtn: {
    backgroundColor: 'rgba(108,71,255,0.12)', borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
  },
  materialViewText: { color: Colors.purple, fontSize: Typography.xs, fontWeight: FontWeight.semibold },
  materialDownloadBtn: {
    backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
  },
  materialDownloadText: { color: Colors.success, fontSize: Typography.xs, fontWeight: FontWeight.semibold },
  materialDownloadedBtn: {
    backgroundColor: 'rgba(34,197,94,0.22)', borderColor: 'rgba(34,197,94,0.5)',
  },
  materialDownloadedText: { color: Colors.success, fontSize: Typography.xs, fontWeight: FontWeight.bold },
  materialBtnBusy: { minWidth: 58, alignItems: 'center', justifyContent: 'center' },
  materialLock: { fontSize: 13, color: Colors.muted },
});
