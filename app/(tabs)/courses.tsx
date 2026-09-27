import { useState, useMemo, useEffect, type FC } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView, ImageBackground, Animated } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useCourses, useCoins, useRefreshAll } from '@/hooks';
import { coursesApi } from '@/api';
import { CoinsModal } from '@/components/common/CoinsModal';
import { formatCourseDuration, courseLessonCount, courseStudents } from '@/utils/course.util';

// Light theme palette (UI only — consistent with Dashboard)
const L = {
  bg: '#F6F8FC', ink: '#1E2233', sub: '#8A90A2', blue: '#2F6BFF', blueSoft: '#E6EEFF',
  purple: '#7A3BFF', purpleSoft: '#EEE9FF', green: '#22C55E', greenSoft: '#E4F8EC',
  amber: '#F5A623', line: '#EAEDF3', card: '#FFFFFF',
};

// Subject thumbnail image / tint from course title (UI only). Real desktop
// course images reused; unknown subjects fall back to a coloured emoji tile.
let imgC: any = null, imgJava: any = null, imgPython: any = null, heroImg: any = null;
try { imgC = require('../../assets/courses/c.jpeg'); } catch {}
try { imgJava = require('../../assets/courses/java.jpeg'); } catch {}
try { imgPython = require('../../assets/courses/python.jpeg'); } catch {}
try { heroImg = require('../../assets/courses/courses-hero.png'); } catch {}

// Vector banners (exact desktop SVGs) for the non-image subjects. Rendered as
// components via react-native-svg-transformer so any future course reuses them.
import DsaBanner from '../../assets/courses/dsa-banner.svg';
import WebBanner from '../../assets/courses/web-banner.svg';
import RoboticsBanner from '../../assets/courses/robotics-banner.svg';
import AiBanner from '../../assets/courses/ai-banner.svg';
import ProblemBanner from '../../assets/courses/problem-banner.svg';

// Course card visual: prefer the real image (C/Java/Python jpeg), else the
// desktop SVG banner (DSA/Web/Robotics/AI/Problem Solving), else a coloured
// emoji tile. Mirrors the desktop getSubjectTheme mapping exactly.
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
  if (t.includes('scratch') || t.includes('game') || t.includes('kid')) return { img: null, icon: '🎮', tint: '#FFF3DC' };
  return { img: null, icon: '📘', tint: L.purpleSoft };
}

export default function CoursesScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const { data, isLoading } = useCourses(category, search);
  const courses = data?.courses ?? [];

  const { data: allData } = useCourses('All', '');
  const { data: coinsData } = useCoins();
  const totalCoins = coinsData?.totalCoins ?? 0;
  const [coinsModalVisible, setCoinsModalVisible] = useState(false);
  const queryClient = useQueryClient();
  const { refreshAll, refreshing, spin } = useRefreshAll();

  // Prefetch each course detail when list loads — instant open on tap
  useEffect(() => {
    const allCourses = allData?.courses ?? [];
    for (const course of allCourses) {
      queryClient.prefetchQuery({
        queryKey: ['course', course.id],
        queryFn: () => coursesApi.getById(course.id),
        staleTime: 1000 * 60 * 2,
      });
    }
  }, [allData]);
  const categories = useMemo(() => {
    const allCourses = allData?.courses ?? [];
    const uniqueCats = [...new Set(allCourses.map((c) => c.category).filter(Boolean))];
    return ['All', ...uniqueCats];
  }, [allData]);

  // Add invisible dummy item for odd-count grid alignment
  const gridData = useMemo(() => {
    if (courses.length % 2 !== 0) {
      return [...courses, { id: '__placeholder__', _placeholder: true } as any];
    }
    return courses;
  }, [courses]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar — dashboard/profile consistent */}
      <View style={styles.topbar}>
        <View>
          <Text style={styles.logo}>Coding<Text style={styles.lk}>K</Text><Text style={styles.li}>i</Text><Text style={styles.ld}>d</Text><Text style={styles.la}>a</Text></Text>
          <Text style={styles.tagline}>Learn  •  Practice  •  Grow</Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.coinPill} onPress={() => setCoinsModalVisible(true)} activeOpacity={0.7} accessibilityLabel="Coins">
            <Text style={styles.coinTxt}>🪙 {totalCoins}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={refreshAll} disabled={refreshing} activeOpacity={0.7}>
            <Animated.Text style={{ transform: [{ rotate: spin }] }}>🔄</Animated.Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')} activeOpacity={0.7} accessibilityLabel="Notifications"><Text>🔔</Text></TouchableOpacity>
        </View>
      </View>

      {/* Fixed Header Section (does not scroll) */}
      <View>
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Explore Courses</Text>
          <Text style={styles.pageSubtitle}>Learn from expert-led courses and level up your skills.</Text>
        </View>

        {/* Promo banner — hero image fills the whole card, text overlaid on top */}
        <View style={styles.promoWrap}>
          <ImageBackground
            source={heroImg}
            style={styles.promo}
            imageStyle={styles.promoImg}
            resizeMode="cover"
          >
            <View style={styles.promoText}>
              <Text style={styles.promoTitle}>Learn</Text>
              <Text style={styles.promoTitle2}>Without Limits</Text>
            </View>
          </ImageBackground>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="What do you want to learn today?"
            placeholderTextColor={L.sub}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Category Filter */}
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterTab, category === item && styles.filterTabActive]}
              onPress={() => setCategory(item)}
            >
              <Text style={[styles.filterTabText, category === item && styles.filterTabTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Courses Grid (scrolls independently below fixed header) */}
      <FlatList
          style={styles.grid}
          data={gridData}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{isLoading ? 'Loading all courses...' : 'No courses found.'}</Text>
            </View>
          }
          renderItem={({ item }) => {
            // Invisible placeholder for even grid
            if (item._placeholder) {
              return <View style={[styles.courseCard, { opacity: 0 }]} />;
            }

            const th = courseThumb(item.title || '');
            return (
              <TouchableOpacity
                style={styles.courseCard}
                onPress={() => router.push(`/course/${item.id}`)}
                activeOpacity={0.9}
              >
                {/* Thumbnail — real subject image (C/Java/Python), desktop SVG
                    banner (DSA/Web/Robotics/AI/Problem), else coloured emoji tile */}
                <View style={[styles.thumb, { backgroundColor: th.tint }]}>
                  {th.img ? (
                    <Image source={th.img} style={styles.thumbImg} resizeMode="cover" />
                  ) : th.Svg ? (
                    <th.Svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
                  ) : (
                    <Text style={styles.thumbIcon}>{th.icon}</Text>
                  )}
                  {item.category ? (
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{item.category}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Body */}
                <View style={styles.cardBody}>
                  <Text style={styles.courseTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.courseSubtitle} numberOfLines={1}>{item.subtitle}</Text>

                  {/* Meta chips — real backend values (Lessons · Duration · Students),
                      computed with the same fallbacks as the desktop course card. */}
                  {(() => {
                    const lessons = courseLessonCount(item);
                    const duration = formatCourseDuration(item.totalDurationSeconds);
                    const students = courseStudents(item);
                    return (
                      <View style={styles.metaRow}>
                        {lessons > 0 ? (
                          <Text style={styles.metaChip} numberOfLines={1}>📖 {lessons} Lesson{lessons > 1 ? 's' : ''}</Text>
                        ) : null}
                        {duration ? (
                          <Text style={styles.metaChip} numberOfLines={1}>⏱ {duration}</Text>
                        ) : null}
                        {students > 0 ? (
                          <Text style={styles.metaChip} numberOfLines={1}>👥 {students} Students</Text>
                        ) : null}
                      </View>
                    );
                  })()}

                  <View style={styles.cardFooter}>
                    <Text style={styles.rating}>⭐ {item.rating || '4.5'}</Text>
                    <View style={[
                      styles.priceBadge,
                      { backgroundColor: item.isFree ? L.greenSoft : L.purpleSoft }
                    ]}>
                      <Text style={[
                        styles.priceText,
                        { color: item.isFree ? L.green : L.purple }
                      ]}>
                        {item.isFree ? 'Free' : 'Pro'}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />

      {/* Coins Modal — same shared modal as Dashboard (consistent behaviour) */}
      <CoinsModal visible={coinsModalVisible} onClose={() => setCoinsModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: L.bg },

  // Top bar
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6 },
  logo: { fontSize: 20, fontWeight: '900', color: L.ink },
  lk: { color: '#FA0514' }, li: { color: '#FCCE02' }, ld: { color: '#9BE900' }, la: { color: '#42C900' },
  tagline: { fontSize: 10, fontWeight: '600', color: L.sub, marginTop: 1, letterSpacing: 0.3 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coinPill: { backgroundColor: '#FFF3D6', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  coinTxt: { fontSize: 12.5, fontWeight: '900', color: '#8A6D00' },
  iconBtn: { width: 32, height: 32, borderRadius: 11, backgroundColor: L.blueSoft, alignItems: 'center', justifyContent: 'center' },

  // Page header
  pageHeader: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 12,
  },
  pageTitle: { fontSize: 23, fontWeight: '900', color: L.ink, marginBottom: 4 },
  pageSubtitle: { fontSize: 12.5, color: L.sub, fontWeight: '500' },

  // Promo banner — hero image fills the whole card (zoom/cover), text overlaid
  promoWrap: {
    marginHorizontal: 16, marginBottom: 14, borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#ECE7FF',
    shadowColor: L.purple, shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  promo: { width: '100%', aspectRatio: 2.2, justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 14 },
  promoImg: { borderRadius: 20, width: '112%', height: '112%', resizeMode: 'cover' },
  promoText: { width: '50%', zIndex: 2 },
  promoTitle: { fontSize: 18, fontWeight: '900', color: L.ink, lineHeight: 22 },
  promoTitle2: { fontSize: 18, fontWeight: '900', color: L.purple, lineHeight: 22, marginTop: 10 },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: L.card,
    borderWidth: 1, borderColor: L.line,
    borderRadius: 14, paddingHorizontal: 14,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, color: L.ink, fontSize: 14 },

  // Filter tabs
  categoryList: { paddingHorizontal: 16, paddingBottom: 12, gap: 8, height: 46 },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 50, borderWidth: 1,
    borderColor: L.line,
    backgroundColor: L.card,
  },
  filterTabActive: {
    backgroundColor: L.purple,
    borderColor: L.purple,
  },
  filterTabText: { color: L.sub, fontSize: 12, fontWeight: '700' },
  filterTabTextActive: { color: '#fff' },

  // Course list — grid fills the remaining height below the fixed header so it
  // scrolls the full screen (not just half).
  grid: { flex: 1 },
  list: { paddingHorizontal: 12, paddingBottom: 32, paddingTop: 8 },
  row: { gap: 12, marginBottom: 12 },

  // Course card — light theme
  courseCard: {
    flex: 1, backgroundColor: L.card,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: L.line,
    shadowColor: L.blue, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  thumb: {
    height: 96, alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbIcon: { fontSize: 34, zIndex: 1, color: L.purple, fontWeight: '900' },
  categoryBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3,
  },
  categoryBadgeText: { color: L.ink, fontSize: 9, fontWeight: '800' },

  cardBody: { padding: 12 },
  courseTitle: { color: L.ink, fontSize: 13, fontWeight: '900', marginBottom: 2, lineHeight: 17 },
  courseSubtitle: { color: L.sub, fontSize: 11, fontWeight: '500', marginBottom: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metaChip: { color: L.sub, fontSize: 10, fontWeight: '700', backgroundColor: '#F1F2F7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rating: { color: L.amber, fontSize: 12, fontWeight: '800' },
  priceBadge: { borderRadius: 50, paddingHorizontal: 10, paddingVertical: 3 },
  priceText: { fontSize: 11, fontWeight: '800' },
  students: { color: L.sub, fontSize: 10.5, fontWeight: '600', marginTop: 6 },

  loadingWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  loadingText: { color: L.sub },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: L.sub, fontSize: 14 },
});
