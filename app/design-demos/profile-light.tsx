// ═══════════════════════════════════════════════════════════════════════════
// DESIGN DEMO — Profile screen, premium light theme (reference-matched).
// DEMO ONLY — mock data, no real screen/API/store touched.
// Top bar is dashboard-consistent (NO avatar on the right).
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

let imgPython: any = null, imgC: any = null;
try { imgPython = require('../../assets/courses/python.jpeg'); } catch {}
try { imgC = require('../../assets/courses/c.jpeg'); } catch {}

const L = {
  bg: '#F6F8FC', ink: '#1E2233', sub: '#8A90A2', blue: '#2F6BFF', blueSoft: '#E6EEFF',
  purple: '#7A3BFF', purpleSoft: '#EEE9FF', green: '#22C55E', greenSoft: '#E4F8EC',
  cyan: '#0EA5B7', cyanSoft: '#DBF3F6', amber: '#F5A623', amberSoft: '#FFF3DC',
  pink: '#F0316E', pinkSoft: '#FCE4EE', line: '#EAEDF3', card: '#FFFFFF',
};

const MENU = [
  { emoji: '📊', label: 'My Report', tint: L.blueSoft },
  { emoji: '📈', label: 'Student Progress', tint: L.greenSoft },
  { emoji: '🛒', label: 'My Purchases', tint: L.amberSoft },
  { emoji: '🏪', label: 'CK Mall', tint: '#FFF3D6' },
  { emoji: '🎁', label: 'Refer & Earn', tint: L.greenSoft },
  { emoji: '🔒', label: 'Change Password', tint: L.purpleSoft },
  { emoji: 'ℹ️', label: 'About Us', tint: '#EEF0F5' },
  { emoji: '⭐', label: 'Rate Us', tint: L.amberSoft },
  { emoji: '❤️', label: 'Help & Support', tint: L.pinkSoft },
];

export default function ProfileLightDemo() {
  return (
    <SafeAreaView style={s.safe}>
      {/* Top bar — dashboard-consistent, NO avatar */}
      <View style={s.topbar}>
        <View>
          <Text style={s.logo}>Coding<Text style={s.lk}>K</Text><Text style={s.li}>i</Text><Text style={s.ld}>d</Text><Text style={s.la}>a</Text></Text>
          <Text style={s.tagline}>Learn  •  Practice  •  Grow</Text>
        </View>
        <View style={s.topActions}>
          <View style={s.coinPill}><Text style={s.coinTxt}>🪙 562</Text></View>
          <View style={s.iconBtn}><Text>🔄</Text></View>
          <View style={s.iconBtn}><Text>🔔</Text></View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <Text style={s.back}>‹ Back to concepts</Text>
        </TouchableOpacity>

        {/* Heading + keep-learning pill */}
        <View style={s.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>My Profile</Text>
            <Text style={s.pageSubtitle}>Manage your account, track progress, and view achievements.</Text>
          </View>
          <View style={s.klPill}><Text style={s.klText}>Keep Learning{'\n'}Keep Growing 🚀</Text></View>
        </View>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}><Text style={s.avatarText}>A</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName} numberOfLines={1}>Avinash Raj Anand</Text>
            <Text style={s.profileEmail} numberOfLines={1}>avinash@codingkida.com</Text>
            <View style={s.proBadge}><Text style={s.proBadgeText}>Pro Member 👑</Text></View>
            <View style={s.btnRow}>
              <View style={[s.smallBtn, s.viewBtn]}><Text style={s.viewBtnText}>👁️ View Profile</Text></View>
              <View style={s.smallBtn}><Text style={s.smallBtnText}>✏️ Edit Profile</Text></View>
            </View>
          </View>
          <View style={s.joinedBox}>
            <Text style={s.joinedIcon}>📅</Text>
            <Text style={s.joinedLabel}>Joined</Text>
            <Text style={s.joinedVal}>Aug 2024</Text>
          </View>
        </View>

        {/* XP hero */}
        <View style={s.xpHero}>
          <View style={s.xpTop}>
            <View style={s.shield}><Text style={s.shieldNum}>12</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.levelTitle}>Legend</Text>
              <Text style={s.levelSub}>Keep learning, you're doing great!</Text>
            </View>
            <View style={s.xpGoal}><Text style={s.xpGoalText}>🎯 220 XP to Level 13</Text></View>
          </View>
          <View style={s.xpBar}><View style={[s.xpFill, { width: '85%' }]} /></View>
          <View style={s.xpLabels}>
            <Text style={s.xpLabelText}>1280 / 1500 XP</Text>
            <Text style={s.xpLabelText}>85%</Text>
          </View>
        </View>

        {/* 4 stat tiles */}
        <View style={s.tilesRow}>
          <View style={[s.tile, { backgroundColor: L.blueSoft }]}><Text style={s.tileEmoji}>📘</Text><Text style={[s.tileVal, { color: L.blue }]}>3</Text><Text style={s.tileLabel}>Learning</Text></View>
          <View style={[s.tile, { backgroundColor: L.amberSoft }]}><Text style={s.tileEmoji}>🏆</Text><Text style={[s.tileVal, { color: L.amber }]}>7</Text><Text style={s.tileLabel}>Badges</Text></View>
          <View style={[s.tile, { backgroundColor: L.pinkSoft }]}><Text style={s.tileEmoji}>🔥</Text><Text style={[s.tileVal, { color: L.pink }]}>5</Text><Text style={s.tileLabel}>Day streak</Text></View>
          <View style={[s.tile, { backgroundColor: L.greenSoft }]}><Text style={s.tileEmoji}>📊</Text><Text style={[s.tileVal, { color: L.green }]}>28</Text><Text style={s.tileLabel}>Problems</Text></View>
        </View>

        {/* Enrolled preview */}
        <View style={s.previewCard}>
          <View style={s.previewHead}>
            <Text style={s.previewTitle}>📚 Enrolled Courses</Text>
            <Text style={s.viewAll}>View All →</Text>
          </View>
          {[{ t: 'Python for Kids', p: 68, img: imgPython, icon: '🐍' }, { t: 'Web Dev Basics', p: 34, img: null, icon: '🌐' }, { t: 'C Programming', p: 90, img: imgC, icon: 'C' }].map((c) => (
            <View key={c.t} style={s.courseRow}>
              <View style={s.courseIcon}>
                {c.img ? <Image source={c.img} style={s.courseIconImg} resizeMode="cover" /> : <Text style={s.courseIconTxt}>{c.icon}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.courseRowTitle} numberOfLines={1}>{c.t}</Text>
                <View style={s.barBg}><View style={[s.barFill, { width: `${c.p}%` }]} /></View>
              </View>
              <Text style={s.coursePct}>{c.p}%</Text>
              <Text style={s.rowChevron}>›</Text>
            </View>
          ))}
        </View>

        {/* Achievements medals */}
        <View style={s.previewCard}>
          <View style={s.previewHead}>
            <Text style={s.previewTitle}>🏆 Achievements</Text>
            <Text style={[s.viewAll, { color: L.amber }]}>View All →</Text>
          </View>
          <View style={s.medalRow}>
            {[{ e: '🥇', t: 'Quiz Master', m: 'Python · Loops', d: 'Jan 12, 2025', bg: '#FFF6DC' },
              { e: '🥈', t: 'Fast Learner', m: 'Web · CSS', d: 'Feb 3, 2025', bg: '#EEF1F5' },
              { e: '🥉', t: 'Problem Solver', m: 'DSA · Arrays', d: 'Feb 20, 2025', bg: '#FBEFE0' }].map((a) => (
              <View key={a.t} style={[s.medal, { backgroundColor: a.bg }]}>
                <Text style={s.medalEmoji}>{a.e}</Text>
                <Text style={s.medalTitle} numberOfLines={1}>{a.t}</Text>
                <Text style={s.medalMeta} numberOfLines={1}>{a.m}</Text>
                <Text style={s.medalDate}>{a.d}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Menu */}
        <View style={s.menuSection}>
          {MENU.map((m) => (
            <View key={m.label} style={s.menuItem}>
              <View style={[s.menuIcon, { backgroundColor: m.tint }]}><Text style={s.menuEmoji}>{m.emoji}</Text></View>
              <Text style={s.menuLabel}>{m.label}</Text>
              <Text style={s.menuArrow}>›</Text>
            </View>
          ))}
        </View>

        {/* Logout */}
        <View style={s.logout}>
          <Text style={s.logoutEmoji}>🚪</Text>
          <Text style={s.logoutText}>Logout</Text>
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

  headRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 10 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: L.ink },
  pageSubtitle: { fontSize: 12, color: L.sub, fontWeight: '500', marginTop: 3, lineHeight: 17 },
  klPill: { backgroundColor: L.purpleSoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  klText: { color: L.purple, fontSize: 10.5, fontWeight: '800', textAlign: 'center', lineHeight: 14 },

  profileCard: {
    marginHorizontal: 16, marginBottom: 14, backgroundColor: L.card, borderRadius: 18, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: L.line,
    shadowColor: L.blue, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: L.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '900', color: '#fff' },
  profileName: { fontSize: 16, fontWeight: '900', color: L.ink },
  profileEmail: { color: L.sub, fontSize: 11.5, marginTop: 1 },
  proBadge: { alignSelf: 'flex-start', backgroundColor: L.amberSoft, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginTop: 5 },
  proBadgeText: { color: '#9A6B00', fontSize: 10.5, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50, backgroundColor: L.blueSoft, borderWidth: 1, borderColor: L.blue },
  smallBtnText: { fontSize: 10, fontWeight: '800', color: L.blue },
  viewBtn: { backgroundColor: '#EEF0F5', borderColor: L.line },
  viewBtnText: { fontSize: 10, fontWeight: '800', color: L.sub },
  joinedBox: { backgroundColor: L.purpleSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  joinedIcon: { fontSize: 15 },
  joinedLabel: { color: L.sub, fontSize: 9, fontWeight: '700', marginTop: 2 },
  joinedVal: { color: L.purple, fontSize: 11, fontWeight: '900' },

  xpHero: { marginHorizontal: 16, marginBottom: 14, backgroundColor: L.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: L.line },
  xpTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  shield: { width: 46, height: 46, borderRadius: 13, backgroundColor: L.purpleSoft, alignItems: 'center', justifyContent: 'center' },
  shieldNum: { color: L.purple, fontSize: 19, fontWeight: '900' },
  levelTitle: { color: L.ink, fontSize: 15, fontWeight: '900' },
  levelSub: { color: L.sub, fontSize: 11, fontWeight: '500', marginTop: 2 },
  xpGoal: { backgroundColor: L.pinkSoft, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, maxWidth: 96 },
  xpGoalText: { color: L.pink, fontSize: 9.5, fontWeight: '800' },
  xpBar: { height: 8, backgroundColor: '#ECECF2', borderRadius: 50, overflow: 'hidden', marginBottom: 5 },
  xpFill: { height: '100%', backgroundColor: L.purple, borderRadius: 50 },
  xpLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  xpLabelText: { color: L.sub, fontSize: 10.5, fontWeight: '700' },

  tilesRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  tile: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  tileEmoji: { fontSize: 16 },
  tileVal: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  tileLabel: { color: L.sub, fontSize: 9, fontWeight: '700', marginTop: 1 },

  previewCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: L.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: L.line },
  previewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  previewTitle: { color: L.ink, fontSize: 14, fontWeight: '900' },
  viewAll: { color: L.purple, fontSize: 12, fontWeight: '800' },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  courseIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: L.blueSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  courseIconImg: { width: '100%', height: '100%' },
  courseIconTxt: { fontSize: 18, fontWeight: '900', color: L.blue },
  courseRowTitle: { color: L.ink, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  barBg: { height: 6, borderRadius: 4, backgroundColor: '#ECECF2', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 4, backgroundColor: L.blue },
  coursePct: { color: L.blue, fontSize: 12.5, fontWeight: '800', width: 38, textAlign: 'right' },
  rowChevron: { color: L.sub, fontSize: 18, fontWeight: '300' },

  medalRow: { flexDirection: 'row', gap: 8 },
  medal: { flex: 1, borderRadius: 14, padding: 10, alignItems: 'center' },
  medalEmoji: { fontSize: 26, marginBottom: 4 },
  medalTitle: { color: L.ink, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  medalMeta: { color: L.sub, fontSize: 9, fontWeight: '600', textAlign: 'center', marginTop: 1 },
  medalDate: { color: L.sub, fontSize: 8.5, fontWeight: '500', marginTop: 3 },

  menuSection: { paddingHorizontal: 16, gap: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: L.line },
  menuIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuEmoji: { fontSize: 17 },
  menuLabel: { flex: 1, color: L.ink, fontSize: 14, fontWeight: '700' },
  menuArrow: { color: L.sub, fontSize: 20 },

  logout: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 16, backgroundColor: L.pinkSoft, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F8D3DF' },
  logoutEmoji: { fontSize: 18 },
  logoutText: { color: L.pink, fontSize: 14, fontWeight: '800' },
});
