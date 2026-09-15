// ═══════════════════════════════════════════════════════════════════════════
// DESIGN DEMO — Courses screen, premium light theme (reference-matched).
// DEMO ONLY — mock data, no real screen/API/store touched.
// Uses the desktop course images (assets/courses/*.jpeg) + AI logo.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Image, ImageBackground } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// Assets (safe-load: a missing file falls back to emoji/plain, never crashes)
let heroImg: any = null, imgC: any = null, imgJava: any = null, imgPython: any = null, imgAI: any = null;
try { heroImg = require('../../assets/courses/courses-hero.png'); } catch {}
try { imgC = require('../../assets/courses/c.jpeg'); } catch {}
try { imgJava = require('../../assets/courses/java.jpeg'); } catch {}
try { imgPython = require('../../assets/courses/python.jpeg'); } catch {}
try { imgAI = require('../../assets/logos/ai.png'); } catch {}

const L = {
  bg: '#F6F8FC', ink: '#1E2233', sub: '#8A90A2', blue: '#2F6BFF', blueSoft: '#E6EEFF',
  purple: '#7A3BFF', purpleSoft: '#EEE9FF', green: '#22C55E', greenSoft: '#E4F8EC',
  amber: '#F5A623', line: '#EAEDF3', card: '#FFFFFF',
};

const CATS = [
  { key: 'All', icon: '📚' }, { key: 'Programming', icon: '</>' }, { key: 'Web', icon: '🌐' },
  { key: 'AI/ML', icon: '🤖' }, { key: 'Design', icon: '🎨' }, { key: 'Kids', icon: '🎮' },
];

const COURSES = [
  { id: '1', title: 'Python Bootcamp', sub: 'From basics to advanced', cat: 'Programming', img: imgPython, tint: '#E4EEF7', rating: '4.8', count: '12.4k', students: '15K', free: false },
  { id: '2', title: 'Web Development Basics', sub: 'HTML, CSS & JavaScript', cat: 'Web', img: null, icon: '</>', tint: '#FDE7DE', rating: '4.6', count: '8.9k', students: '12K', free: true },
  { id: '3', title: 'Java Fundamentals', sub: 'OOP from scratch', cat: 'Programming', img: imgJava, tint: '#FDE7E7', rating: '4.7', count: '9.1k', students: '14K', free: false },
  { id: '4', title: 'AI & Machine Learning', sub: 'Intro to intelligence', cat: 'AI/ML', img: imgAI, tint: '#EEE9FF', rating: '4.9', count: '11.2k', students: '18K', free: false },
  { id: '5', title: 'C Programming', sub: 'Core concepts', cat: 'Programming', img: imgC, tint: '#E4F8EC', rating: '4.5', count: '7.6k', students: '10K', free: true },
  { id: '6', title: 'Scratch Game Design', sub: 'Build fun games', cat: 'Kids', img: null, icon: '🎮', tint: '#FFF3DC', rating: '4.8', count: '6.3k', students: '9K', free: true },
];

export default function CoursesLightDemo() {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const list = COURSES.filter((c) => cat === 'All' || c.cat === cat);

  return (
    <SafeAreaView style={s.safe}>
      {/* Top bar (dashboard-consistent) */}
      <View style={s.topbar}>
        <View>
          <Text style={s.logo}>Coding<Text style={s.lk}>K</Text><Text style={s.li}>i</Text><Text style={s.ld}>d</Text><Text style={s.la}>a</Text></Text>
          <Text style={s.tagline}>Learn  •  Practice  •  Grow</Text>
        </View>
        <View style={s.topActions}>
          <View style={s.coinPill}><Text style={s.coinTxt}>🪙 562</Text></View>
          <View style={s.iconBtn}><Text>🔔</Text></View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <Text style={s.back}>‹ Back to concepts</Text>
        </TouchableOpacity>

        <View style={s.header}>
          <Text style={s.title}>Explore Courses</Text>
          <Text style={s.subtitle}>Learn from 200+ expert-led courses and level up your skills.</Text>
        </View>

        {/* Promo banner */}
        <View style={s.promo}>
          {heroImg ? <Image source={heroImg} style={s.promoArt} resizeMode="contain" /> : null}
          <View style={s.promoText}>
            <Text style={s.promoTitle}>Learn</Text>
            <Text style={s.promoTitle2}>Without Limits</Text>
            <Text style={s.promoSub}>Access 200+ courses, gain certificates and boost your career.</Text>
            <TouchableOpacity style={s.promoBtn} activeOpacity={0.9}><Text style={s.promoBtnTxt}>Start Learning  →</Text></TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput style={s.searchInput} placeholder="What do you want to learn today?" placeholderTextColor={L.sub} value={search} onChangeText={setSearch} />
          <Text style={s.filterIcon}>⚙️</Text>
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          {CATS.map((c) => (
            <TouchableOpacity key={c.key} style={[s.tab, cat === c.key && s.tabActive]} onPress={() => setCat(c.key)}>
              <Text style={[s.tabIcon, cat === c.key && { color: '#fff' }]}>{c.icon}</Text>
              <Text style={[s.tabText, cat === c.key && s.tabTextActive]}>{c.key}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Popular header */}
        <View style={s.popularHead}>
          <Text style={s.popularTitle}>Popular Courses</Text>
          <Text style={s.viewAll}>View all →</Text>
        </View>

        {/* Grid */}
        <View style={s.grid}>
          {list.map((item) => (
            <TouchableOpacity key={item.id} style={s.card} activeOpacity={0.9}>
              <View style={[s.thumb, { backgroundColor: item.tint }]}>
                {item.img ? (
                  <Image source={item.img} style={s.thumbImg} resizeMode="cover" />
                ) : (
                  <Text style={s.thumbIcon}>{item.icon}</Text>
                )}
                <View style={s.catBadge}><Text style={s.catBadgeText}>{item.cat}</Text></View>
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.cardSub} numberOfLines={1}>{item.sub}</Text>
                <View style={s.cardRow}>
                  <Text style={s.rating}>⭐ {item.rating} <Text style={s.count}>({item.count})</Text></Text>
                  <View style={[s.pill, { backgroundColor: item.free ? L.greenSoft : L.purpleSoft }]}>
                    <Text style={[s.pillText, { color: item.free ? L.green : L.purple }]}>{item.free ? 'Free' : 'Pro'}</Text>
                  </View>
                </View>
                <Text style={s.students}>👨‍🎓 {item.students} Students</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: L.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6 },
  logo: { fontSize: 20, fontWeight: '900', color: L.ink },
  lk: { color: '#FA0514' }, li: { color: '#FCCE02' }, ld: { color: '#9BE900' }, la: { color: '#42C900' },
  tagline: { fontSize: 10, fontWeight: '600', color: L.sub, marginTop: 1, letterSpacing: 0.3 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coinPill: { backgroundColor: '#FFF3D6', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  coinTxt: { fontSize: 12.5, fontWeight: '900', color: '#8A6D00' },
  iconBtn: { width: 32, height: 32, borderRadius: 11, backgroundColor: L.blueSoft, alignItems: 'center', justifyContent: 'center' },
  back: { color: L.blue, fontWeight: '700', fontSize: 14 },

  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 23, fontWeight: '900', color: L.ink },
  subtitle: { fontSize: 12.5, fontWeight: '500', color: L.sub, marginTop: 4 },

  promo: {
    marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 18, minHeight: 140,
    backgroundColor: '#ECE7FF', overflow: 'hidden', justifyContent: 'center',
  },
  promoArt: { position: 'absolute', right: 4, bottom: 0, width: 140, height: 130, zIndex: 1 },
  promoText: { width: '60%', zIndex: 2 },
  promoTitle: { fontSize: 20, fontWeight: '900', color: L.ink, lineHeight: 22 },
  promoTitle2: { fontSize: 20, fontWeight: '900', color: L.purple, lineHeight: 24, marginBottom: 6 },
  promoSub: { fontSize: 11, fontWeight: '500', color: '#5C6680', lineHeight: 15, marginBottom: 12 },
  promoBtn: { alignSelf: 'flex-start', backgroundColor: L.purple, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  promoBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: L.card, borderWidth: 1, borderColor: L.line, borderRadius: 14, paddingHorizontal: 14 },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, color: L.ink, fontSize: 14 },
  filterIcon: { fontSize: 15, marginLeft: 8 },

  catRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, borderWidth: 1, borderColor: L.line, backgroundColor: L.card },
  tabActive: { backgroundColor: L.purple, borderColor: L.purple },
  tabIcon: { fontSize: 11, fontWeight: '900', color: L.purple },
  tabText: { color: L.sub, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#fff' },

  popularHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  popularTitle: { fontSize: 17, fontWeight: '900', color: L.ink },
  viewAll: { fontSize: 13, fontWeight: '700', color: L.blue },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 12, justifyContent: 'space-between' },
  card: {
    width: '47.5%', backgroundColor: L.card, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: L.line, marginBottom: 12,
    shadowColor: L.blue, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  thumb: { height: 96, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  thumbIcon: { fontSize: 34, color: '#7A3BFF', fontWeight: '900' },
  catBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { color: L.ink, fontSize: 9, fontWeight: '800' },
  cardBody: { padding: 12 },
  cardTitle: { color: L.ink, fontSize: 13, fontWeight: '900', marginBottom: 2 },
  cardSub: { color: L.sub, fontSize: 11, fontWeight: '500', marginBottom: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rating: { color: L.amber, fontSize: 11.5, fontWeight: '800' },
  count: { color: L.sub, fontSize: 10, fontWeight: '600' },
  pill: { borderRadius: 50, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 10.5, fontWeight: '800' },
  students: { color: L.sub, fontSize: 10.5, fontWeight: '600' },
});
