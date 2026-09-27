import { useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, ImageBackground, Animated } from 'react-native';
import Reanimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useCourses, useCoins, useRefreshAll } from '@/hooks';
import { coursesApi } from '@/api';
import { CoinsModal } from '@/components/common/CoinsModal';
import { AnimatedPressable } from '@/components/ui';
import { CourseCard, CourseSkeletonCard } from '@/components/course';
import { EnterDelay, Duration } from '@/theme';

let heroImg: any = null;
try { heroImg = require('../../assets/courses/courses-hero.png'); } catch {}

// Local light palette (kept for this screen's header/hero/search/chip styles).
const L = {
  bg: '#F4F3FC', ink: '#1E2233', sub: '#8A90A2', blue: '#2F6BFF', blueSoft: '#E6EEFF',
  purple: '#6538FF', purpleSoft: '#EEE9FF', green: '#22C55E', greenSoft: '#E4F8EC',
  amber: '#F5A623', line: '#EAEDF3', card: '#FFFFFF',
};

// Category → small leading icon (visual only, matches the reference chips).
function categoryIcon(cat: string): string {
  const c = (cat || '').toLowerCase();
  if (c === 'all') return '▦';
  if (c.includes('program')) return '</>';
  if (c.includes('general')) return '📖';
  if (c.includes('dsa') || c.includes('data structure') || c.includes('algorithm')) return '🔗';
  if (c.includes('web')) return '🌐';
  if (c.includes('ai') || c.includes('intelligence') || c.includes('machine')) return '🤖';
  if (c.includes('robot')) return '🤖';
  if (c.includes('problem')) return '💡';
  return '📚';
}

export default function CoursesScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [searchFocused, setSearchFocused] = useState(false);
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
          <AnimatedPressable style={styles.coinPill} onPress={() => setCoinsModalVisible(true)} haptic accessibilityLabel="Coins">
            <Text style={styles.coinTxt}>🪙 {totalCoins}</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.iconBtn} onPress={refreshAll} disabled={refreshing}>
            <Animated.Text style={{ transform: [{ rotate: spin }] }}>🔄</Animated.Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.iconBtn} onPress={() => router.push('/notifications')} accessibilityLabel="Notifications"><Text>🔔</Text></AnimatedPressable>
        </View>
      </View>

      {/* Fixed Header Section (does not scroll) */}
      <View>
        {/* Page Header */}
        <Reanimated.View entering={FadeInDown.delay(EnterDelay.header).duration(Duration.normal)} style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Explore Courses</Text>
          <Text style={styles.pageSubtitle}>Learn from expert-led courses and level up your skills.</Text>
        </Reanimated.View>

        {/* Promo banner — hero image fills the whole card, text overlaid on top */}
        <Reanimated.View entering={FadeInDown.delay(EnterDelay.hero).duration(Duration.slow)} style={styles.promoWrap}>
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
        </Reanimated.View>

        {/* Search */}
        <Reanimated.View entering={FadeInDown.delay(EnterDelay.stats).duration(Duration.normal)} style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="What do you want to learn today?"
            placeholderTextColor={L.sub}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <View style={styles.searchFilterBtn}>
            <Text style={styles.searchFilterIcon}>⚙︎</Text>
          </View>
        </Reanimated.View>

        {/* Category Filter */}
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => {
            const active = category === item;
            return (
              <AnimatedPressable
                style={[styles.filterTab, active && styles.filterTabActive]}
                onPress={() => setCategory(item)}
                haptic
              >
                <Text style={[styles.filterTabIcon, active && styles.filterTabIconActive]}>{categoryIcon(item)}</Text>
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                  {item}
                </Text>
              </AnimatedPressable>
            );
          }}
        />

        {/* Section label above the grid (matches the reference) */}
        <Reanimated.View entering={FadeInDown.delay(EnterDelay.primary).duration(Duration.normal)} style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>🔥 {category === 'All' ? 'Popular Courses' : category}</Text>
        </Reanimated.View>
      </View>

      {/* Courses Grid (scrolls independently below fixed header) */}
      {isLoading && courses.length === 0 ? (
        // Premium skeleton grid while loading (resembles the CourseCard layout)
        <View style={styles.list}>
          {[0, 1, 2, 3].map((r) => (
            <View key={r} style={styles.row}>
              <CourseSkeletonCard />
              <CourseSkeletonCard />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          style={styles.grid}
          data={gridData}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Reanimated.View entering={FadeIn.duration(Duration.normal)} style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No courses found</Text>
              <Text style={styles.emptyText}>Try a different search or category.</Text>
            </Reanimated.View>
          }
          renderItem={({ item, index }) => {
            // Invisible placeholder for even grid
            if (item._placeholder) {
              return <View style={[styles.courseCard, { opacity: 0 }]} />;
            }
            return (
              <Reanimated.View
                entering={FadeInDown.delay(Math.min(index, 6) * 60).duration(Duration.slow)}
                style={styles.cardWrap}
              >
                <CourseCard course={item} onPress={() => router.push(`/course/${item.id}`)} />
              </Reanimated.View>
            );
          }}
        />
      )}

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
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: L.card,
    borderWidth: 1.5, borderColor: L.line,
    borderRadius: 16, paddingLeft: 14, paddingRight: 6,
    shadowColor: '#2F3A66', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
  searchWrapFocused: { borderColor: L.purple, shadowOpacity: 0.1 },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 13, color: L.ink, fontSize: 14 },
  searchFilterBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: L.purpleSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  searchFilterIcon: { fontSize: 15, color: L.purple },

  // Filter tabs
  categoryList: { paddingHorizontal: 16, paddingBottom: 12, gap: 8, height: 48 },
  filterTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 15, paddingVertical: 9,
    borderRadius: 50, borderWidth: 1,
    borderColor: L.line,
    backgroundColor: L.card,
  },
  filterTabActive: {
    backgroundColor: L.purple,
    borderColor: L.purple,
    shadowColor: L.purple, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  filterTabIcon: { fontSize: 12, color: L.sub, fontWeight: '800' },
  filterTabIconActive: { color: '#fff' },
  filterTabText: { color: L.sub, fontSize: 12.5, fontWeight: '700' },
  filterTabTextActive: { color: '#fff' },

  // Section label above grid
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 4 },
  sectionTitle: { color: L.ink, fontSize: 16, fontWeight: '800' },

  // Course list — grid fills the remaining height below the fixed header so it
  // scrolls the full screen (not just half).
  grid: { flex: 1 },
  list: { paddingHorizontal: 14, paddingBottom: 32, paddingTop: 4 },
  row: { gap: 14, marginBottom: 14, alignItems: 'stretch' },
  cardWrap: { flex: 1 },

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
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: L.ink, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  emptyText: { color: L.sub, fontSize: 14 },
});
