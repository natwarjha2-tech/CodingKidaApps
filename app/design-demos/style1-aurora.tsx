// ═══════════════════════════════════════════════════════════════════════════
// DESIGN DEMO — faithful pixel-style replica of the reference dashboard screenshot.
// Light theme. DEMO ONLY — uses local mock values, touches no real app/API/store.
//
// IMAGES: place these two PNGs in /assets (exact names):
//   • demo-hero.png      — the 3D boy-with-laptop character
//   • demo-calendar.png  — the 3D CodingKida calendar
// Until then, a graceful emoji placeholder is shown so the demo never crashes.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// Try to load the user-provided art. If a file is missing, we fall back to emoji.
let heroImg: ImageSourcePropType | null = null;
let calendarImg: ImageSourcePropType | null = null;
try { heroImg = require('../../assets/demo-hero.png'); } catch { heroImg = null; }
try { calendarImg = require('../../assets/demo-calendar.png'); } catch { calendarImg = null; }

const C = {
  bg: '#FFFFFF',
  ink: '#1E2233',
  sub: '#8A90A2',
  purple: '#2F6BFF',        // primary (screenshot uses a blue-ish primary button)
  blue: '#2F6BFF',
  bannerA: '#E9F1FF',       // light blue banner
  line: '#EEF0F5',
  amber: '#F5A623',
  amberSoft: '#FFF3DC',
  green: '#22C55E',
  greenCard: '#E9F9EF',
  greenSoft: '#E4F8EC',
  blueSoft: '#E6EEFF',
  pinkSoft: '#FCE4EE',
  purpleSoft: '#EEE9FF',
  coinInk: '#7A5A00',
};

const REC = [
  { name: 'C', logo: 'C', logoBg: '#4A78E0', logoInk: '#fff' },
  { name: 'JAVA', logo: '☕', logoBg: '#FFE3D3', logoInk: '#EA6C2B' },
  { name: 'PYTHON', logo: '🐍', logoBg: '#E4EEF7', logoInk: '#3776AB' },
  { name: 'AI', logo: '🧠', logoBg: '#241B3D', logoInk: '#B98BFF' },
];

export default function DashboardDemo() {
  const [heroOk, setHeroOk] = useState(true);
  const [calOk, setCalOk] = useState(true);

  return (
    <SafeAreaView style={s.safe}>
      {/* Top bar */}
      <View style={s.topbar}>
        <View>
          <Text style={s.logo}>Coding<Text style={{ color: C.blue }}>Kida</Text></Text>
          <Text style={s.tagline}>Learn  •  Practice  •  Grow</Text>
        </View>
        <View style={s.topActions}>
          <View style={s.coinPill}>
            <Text style={s.coinEmoji}>🪙</Text>
            <Text style={s.coinTxt}>562</Text>
            <View style={s.coinPlus}><Text style={s.coinPlusTxt}>+</Text></View>
          </View>
          <View style={s.iconBtnBlue}><Text style={{ fontSize: 15 }}>🔄</Text></View>
          <View style={s.iconBtn}>
            <Text style={{ fontSize: 15 }}>🔔</Text>
            <View style={s.bellDot} />
          </View>
          <View style={s.avatar}><Text style={{ fontSize: 18 }}>🧑🏻</Text></View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ paddingVertical: 8 }}>
          <Text style={s.back}>‹ Back to concepts</Text>
        </TouchableOpacity>

        {/* Welcome banner */}
        <View style={s.banner}>
          {/* Character (user PNG) — sits on the right, anchored to the bottom */}
          {heroImg && heroOk ? (
            <Image source={heroImg} style={s.heroImg} resizeMode="contain" onError={() => setHeroOk(false)} />
          ) : (
            <Text style={s.heroFallback}>🧑🏻‍💻</Text>
          )}

          {/* Gear — top right, above the character */}
          <View style={s.gear}><Text style={{ fontSize: 14 }}>⚙️</Text></View>

          {/* Text column (left) */}
          <View style={s.bannerText}>
            <View style={s.levelPill}>
              <Text style={s.levelStar}>⭐</Text>
              <Text style={s.levelTxt}>Level 12 · Legend</Text>
            </View>
            <Text style={s.welcome}>Welcome back,</Text>
            <Text style={s.name} numberOfLines={3}>
              Avinash Raj Anand! <Text style={s.wave}>👋</Text>
            </Text>
            <Text style={s.welcomeSub}>Keep learning, keep growing.{'\n'}You're doing great!</Text>
            <TouchableOpacity style={s.cta} activeOpacity={0.9}>
              <Text style={s.ctaTxt}>Continue Learning</Text>
              <Text style={s.ctaArrow}>→</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stat cards */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: C.purpleSoft }]}><Text style={{ fontSize: 20 }}>📚</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.statBig}>4</Text>
              <Text style={s.statLabel}>Enrolled Courses</Text>
            </View>
            <Text style={s.statChevron}>›</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: C.amberSoft, borderColor: '#F6E4C0' }]}>
            <View style={[s.statIcon, { backgroundColor: '#FCE4B8' }]}><Text style={{ fontSize: 20 }}>🏆</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.statLabel2}>No Badges Yet</Text>
              <Text style={s.statSub}>Earn your first badge!</Text>
            </View>
            <Text style={s.statChevron}>›</Text>
          </View>
        </View>

        {/* Continue Learning */}
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Continue Learning ⚡</Text>
          <View style={s.xpChip}><Text style={s.xpChipTxt}>⭐ Earn +20 XP</Text></View>
        </View>
        <View style={s.continueCard}>
          <View style={s.continueThumb}><Text style={{ fontSize: 26 }}>🧠</Text><Text style={s.continueThumbTxt}>AI</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.continueTitle}>AI</Text>
            <View style={s.diffBadge}><Text style={s.diffTxt}>● Beginner</Text></View>
            <Text style={s.continueMeta}>EP1 · EP1</Text>
            <View style={s.track}><View style={s.fill} /></View>
            <Text style={s.readyTxt}>🚀 Ready to start!</Text>
          </View>
          <TouchableOpacity style={s.resumeBtn} activeOpacity={0.9}><Text style={s.resumeTxt}>Resume ▶</Text></TouchableOpacity>
        </View>

        {/* Weekly Challenge */}
        <View style={s.wcCard}>
          <View style={s.wcHead}>
            <Text style={s.wcTitle}>🔥 Weekly Challenge</Text>
            <Text style={s.wcCount}>0 / 0</Text>
          </View>
          <Text style={s.wcDesc}>Enroll in a course to unlock coding challenges!</Text>
          <Text style={s.wcReward}>🪙 +50 Coins on completion</Text>
          <View style={s.pips}>
            <View style={[s.pipWide, { backgroundColor: C.green }]} />
            {Array.from({ length: 6 }).map((_, i) => <View key={i} style={[s.pipWide, { backgroundColor: '#CDE9D6' }]} />)}
          </View>
          {calendarImg && calOk ? (
            <Image source={calendarImg} style={s.wcArtImg} resizeMode="contain" onError={() => setCalOk(false)} />
          ) : (
            <View style={s.wcArt}><Text style={{ fontSize: 40 }}>📅</Text></View>
          )}
          <Text style={s.wcFooter}>Let's begin! 🔥</Text>
        </View>

        {/* Recommended (horizontal 4-column cards) */}
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Recommended for You</Text>
          <Text style={s.seeAll}>View all →</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingBottom: 4, paddingRight: 4 }}
          snapToInterval={162}
          decelerationRate="fast"
        >
          {REC.map((r) => (
            <View key={r.name} style={s.recCard}>
              <View style={s.recTop}>
                <View style={[s.recLogo, { backgroundColor: r.logoBg }]}>
                  <Text style={{ fontSize: r.logo.length === 1 ? 18 : 16, color: r.logoInk, fontWeight: '900' }}>{r.logo}</Text>
                </View>
                <Text style={s.recName}>{r.name}</Text>
              </View>
              <Text style={s.recSub}>Learn {r.name} programming from basics to advanced concepts</Text>
              <View style={s.recBottom}>
                <View style={s.proPill}><Text style={s.proTxt}>Pro</Text></View>
                <Text style={s.chevron}>›</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Quick Actions */}
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={s.quickRow}>
          <View style={[s.quick, { backgroundColor: C.greenCard }]}><Text style={s.quickEmoji}>🏆</Text><Text style={s.quickTxt}>Leaderboard</Text><Text style={s.quickChevron}>›</Text></View>
          <View style={[s.quick, { backgroundColor: C.blueSoft }]}><Text style={s.quickEmoji}>📥</Text><Text style={s.quickTxt}>Downloads</Text><Text style={s.quickChevron}>›</Text></View>
          <View style={[s.quick, { backgroundColor: C.pinkSoft }]}><Text style={s.quickEmoji}>🔖</Text><Text style={s.quickTxt}>Watchlist</Text><Text style={s.quickChevron}>›</Text></View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Bottom nav */}
      <View style={s.bottomNav}>
        {[['🏠', 'Home', true], ['📚', 'Courses', false], ['🤖', 'AI', false], ['👤', 'Profile', false]].map(([e, l, on]) => (
          <View key={l as string} style={s.navItem}>
            <Text style={{ fontSize: 20, opacity: on ? 1 : 0.55 }}>{e as string}</Text>
            <Text style={[s.navTxt, { color: on ? C.blue : C.sub, fontWeight: on ? '800' : '600' }]}>{l as string}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6 },
  logo: { fontSize: 22, fontWeight: '900', color: C.ink },
  tagline: { fontSize: 10.5, fontWeight: '600', color: C.sub, marginTop: 1, letterSpacing: 0.3 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF3D6', borderRadius: 16, paddingLeft: 8, paddingRight: 4, paddingVertical: 4 },
  coinEmoji: { fontSize: 13 },
  coinTxt: { fontSize: 13, fontWeight: '900', color: C.coinInk },
  coinPlus: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  coinPlusTxt: { color: '#fff', fontSize: 12, fontWeight: '900', marginTop: -1 },
  iconBtn: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#F2F0F8', alignItems: 'center', justifyContent: 'center' },
  iconBtnBlue: { width: 32, height: 32, borderRadius: 11, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 6, right: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#DDE7FB', alignItems: 'center', justifyContent: 'center' },
  back: { color: C.blue, fontWeight: '700', fontSize: 14 },

  banner: { backgroundColor: C.bannerA, borderRadius: 22, paddingVertical: 18, paddingLeft: 18, paddingRight: 12, overflow: 'hidden', minHeight: 250 },
  // Character fills the right half of the banner cleanly (touches right & bottom
  // edges so it reads as part of the card, not a pasted-on image).
  heroImg: { position: 'absolute', right: -8, bottom: -6, top: 6, left: '50%', zIndex: 1 },
  heroFallback: { position: 'absolute', right: 24, bottom: 24, fontSize: 80, zIndex: 1 },
  gear: { position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', zIndex: 5 },

  bannerText: { width: '52%', zIndex: 4 },
  levelPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  levelStar: { fontSize: 11 },
  levelTxt: { fontSize: 12, fontWeight: '800', color: C.blue },
  welcome: { fontSize: 16, fontWeight: '600', color: '#44506B' },
  name: { fontSize: 20, fontWeight: '900', color: C.ink, marginTop: 3, lineHeight: 25 },
  wave: { fontSize: 18 },
  welcomeSub: { fontSize: 12.5, fontWeight: '500', color: '#5C6680', marginTop: 8, lineHeight: 18 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: C.blue, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 11, marginTop: 14, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  ctaArrow: { color: '#fff', fontWeight: '800', fontSize: 14 },

  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3F1FB', borderRadius: 18, padding: 13, borderWidth: 1, borderColor: '#E8E4F6' },
  statIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statBig: { fontSize: 24, fontWeight: '900', color: C.ink },
  statLabel: { fontSize: 11.5, fontWeight: '700', color: '#5C6680', marginTop: 1 },
  statLabel2: { fontSize: 12.5, fontWeight: '800', color: C.ink },
  statSub: { fontSize: 10, fontWeight: '500', color: C.sub, marginTop: 3 },
  statChevron: { fontSize: 20, color: C.sub, fontWeight: '300' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: C.ink },
  seeAll: { fontSize: 13, fontWeight: '700', color: C.blue },
  xpChip: { backgroundColor: C.amberSoft, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  xpChipTxt: { fontSize: 11, fontWeight: '800', color: '#9A6B00' },

  continueCard: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: C.line, shadowColor: C.blue, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  continueThumb: { width: 62, height: 62, borderRadius: 14, backgroundColor: '#241B3D', alignItems: 'center', justifyContent: 'center' },
  continueThumbTxt: { color: '#B98BFF', fontSize: 12, fontWeight: '900', marginTop: -2 },
  continueTitle: { fontSize: 16, fontWeight: '900', color: C.ink },
  diffBadge: { alignSelf: 'flex-start', backgroundColor: C.greenSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginVertical: 5 },
  diffTxt: { fontSize: 11, fontWeight: '800', color: C.green },
  continueMeta: { fontSize: 12, fontWeight: '600', color: C.sub },
  track: { height: 5, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden', marginTop: 8 },
  fill: { height: 5, borderRadius: 3, width: '8%', backgroundColor: C.blue },
  readyTxt: { fontSize: 12, fontWeight: '700', color: '#5C6680', marginTop: 7 },
  resumeBtn: { backgroundColor: C.blue, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  resumeTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },

  wcCard: { backgroundColor: C.greenCard, borderRadius: 18, padding: 18, marginTop: 20, borderWidth: 1, borderColor: '#CFEBD8', overflow: 'hidden', minHeight: 176 },
  wcHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wcTitle: { fontSize: 16, fontWeight: '900', color: C.ink },
  wcCount: { fontSize: 16, fontWeight: '900', color: C.green },
  // All text stays in the left ~64% so the calendar art never covers it.
  wcDesc: { fontSize: 12.5, fontWeight: '500', color: '#5A6B60', marginTop: 6, maxWidth: '64%' },
  wcReward: { fontSize: 12.5, fontWeight: '800', color: '#C2830B', marginTop: 8 },
  pips: { flexDirection: 'row', gap: 6, marginTop: 12, maxWidth: '62%' },
  pipWide: { flex: 1, height: 8, borderRadius: 5 },
  // Calendar sits on the right, below the count, vertically centred — clean fit.
  wcArt: { position: 'absolute', right: 18, top: 52 },
  wcArtImg: { position: 'absolute', right: 8, top: 46, width: 104, height: 104, zIndex: 1 },
  wcFooter: { textAlign: 'center', fontWeight: '800', fontSize: 13, color: C.ink, marginTop: 16 },

  recCard: { width: 150, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.line },
  recTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  recLogo: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recName: { fontSize: 13, fontWeight: '900', color: C.ink },
  recSub: { fontSize: 10.5, fontWeight: '500', color: C.sub, lineHeight: 15, minHeight: 60 },
  recBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  proPill: { backgroundColor: C.purpleSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  proTxt: { fontSize: 11, fontWeight: '800', color: '#7A3BFF' },
  chevron: { fontSize: 18, color: C.sub, fontWeight: '300' },

  quickRow: { flexDirection: 'row', gap: 10 },
  quick: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 6 },
  quickEmoji: { fontSize: 15 },
  quickTxt: { fontSize: 11, fontWeight: '800', color: C.ink },
  quickChevron: { fontSize: 14, color: C.sub, fontWeight: '400' },

  bottomNav: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 10, paddingBottom: 14, backgroundColor: '#fff' },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navTxt: { fontSize: 11 },
});
