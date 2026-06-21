import { useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useCourses } from '@/hooks';
import { coursesApi } from '@/api';
import { Colors } from '@/theme';

export default function CoursesScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const { data, isLoading } = useCourses(category, search);
  const courses = data?.courses ?? [];

  const { data: allData } = useCourses('All', '');
  const queryClient = useQueryClient();

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
      {/* Fixed Header Section (does not scroll) */}
      <View>
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Explore Courses</Text>
          <Text style={styles.pageSubtitle}>Learn from 200+ expert-led courses and level up your skills.</Text>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="What do you want to learn today?"
            placeholderTextColor={Colors.muted}
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

            return (
              <TouchableOpacity
                style={styles.courseCard}
                onPress={() => router.push(`/course/${item.id}`)}
              >
                {/* Thumbnail — exact desktop course thumb style */}
                <View style={[styles.thumb, { backgroundColor: item.color || '#4C26A8' }]}>
                  <View style={styles.thumbGlow} />
                  <Text style={styles.thumbIcon}>📖</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{item.category}</Text>
                  </View>
                </View>

                {/* Body */}
                <View style={styles.cardBody}>
                  <Text style={styles.courseTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.courseSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.rating}>⭐ {item.rating || '4.5'}</Text>
                    <View style={[
                      styles.priceBadge,
                      { backgroundColor: item.isFree ? Colors.successLight : Colors.primaryLight }
                    ]}>
                      <Text style={[
                        styles.priceText,
                        { color: item.isFree ? Colors.success : Colors.purple }
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Page header
  pageHeader: {
    margin: 16, borderRadius: 16, padding: 24,
    backgroundColor: 'rgba(76,29,149,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
  },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  pageSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, color: '#fff', fontSize: 14 },

  // Filter tabs — proper visible text
  categoryList: { paddingHorizontal: 16, paddingBottom: 12, gap: 8, height: 44 },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 50, borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTabText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },

  // Course list
  list: { paddingHorizontal: 12, paddingBottom: 32, paddingTop: 8 },
  row: { gap: 12, marginBottom: 12 },

  // Course card — exact desktop #161B22 card style
  courseCard: {
    flex: 1, backgroundColor: Colors.card2,
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  thumb: {
    height: 100, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  thumbGlow: {
    position: 'absolute', width: 100, height: 100, top: 10,
    borderRadius: 50, backgroundColor: 'rgba(108,71,255,0.3)',
  },
  thumbIcon: { fontSize: 36, zIndex: 1 },
  categoryBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3,
  },
  categoryBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  cardBody: { padding: 14 },
  courseTitle: { color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 4, lineHeight: 18 },
  courseSubtitle: { color: Colors.muted, fontSize: 11, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rating: { color: '#F59E0B', fontSize: 12, fontWeight: '700' },
  priceBadge: { borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3 },
  priceText: { fontSize: 11, fontWeight: '800' },

  loadingWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  loadingText: { color: Colors.muted },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: Colors.muted, fontSize: 14 },
});
