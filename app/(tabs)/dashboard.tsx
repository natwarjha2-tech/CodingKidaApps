import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ImageBackground, Image, Animated, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { useCourseStore } from '@/store';
import { useDashboard, useCoins, useCourses, usePrefetchDashboard, useRefreshAll, usePrefetchNotifications, useXP } from '@/hooks';
import { achievementsApi, weeklyCodingApi } from '@/api';
import { CoinsModal } from '@/components/common/CoinsModal';
import { CodeArenaCard } from '@/components/common/CodeArenaCard';
import { ProfileVerification } from '@/components/common/ProfileVerification';
import { Colors } from '@/theme';
import type { Achievement } from '@/types';
import { getUnreadCount } from '@/services/notification.service';
import { getLastLesson, type LastLesson } from '@/utils/lastLesson.util';
import { coursesApi } from '@/api';

// Real subject logos (transparent PNGs in assets/logos). Loaded safely — a
// missing file falls back to the emoji tile below, never crashes.
const SUBJECT_LOGOS: Record<string, any> = (() => {
  const m: Record<string, any> = {};
  try { m.c = require('../../assets/logos/c.png'); } catch {}
  try { m.java = require('../../assets/logos/java.png'); } catch {}
  try { m.python = require('../../assets/logos/python.png'); } catch {}
  try { m.ai = require('../../assets/logos/ai.png'); } catch {}
  return m;
})();

// Subject logo/tint for the "Recommended for You" cards (derived from the
// course title — UI only, no logic depends on this). `logo` (if present) is a
// real image; otherwise `icon` emoji is shown.
function subjectVisual(title: string): { icon: string; bg: string; ink: string; logo?: any } {
  const t = (title || '').toLowerCase();
  if (t.includes('python')) return { icon: '🐍', bg: '#E4EEF7', ink: '#3776AB', logo: SUBJECT_LOGOS.python };
  if (t.includes('java') && !t.includes('javascript')) return { icon: '☕', bg: '#FFE3D3', ink: '#EA6C2B', logo: SUBJECT_LOGOS.java };
  if (t.includes('javascript') || t === 'js' || t.includes(' js')) return { icon: 'JS', bg: '#FFF6D6', ink: '#C9A100' };
  if (t.includes('react')) return { icon: '⚛️', bg: '#E1F3FB', ink: '#149ECA' };
  if (t.includes('ai') || t.includes('intelligence')) return { icon: '🧠', bg: '#241B3D', ink: '#B98BFF', logo: SUBJECT_LOGOS.ai };
  if (t.includes('web') || t.includes('html')) return { icon: '🌐', bg: '#FDEAD9', ink: '#E35D2B' };
  if (t.includes('node')) return { icon: '🟢', bg: '#E6F5E6', ink: '#3C873A' };
  if (t === 'c' || t.startsWith('c ') || t.includes('c programming') || t.includes('c++') || t.includes('c#')) return { icon: 'C', bg: '#4A78E0', ink: '#FFFFFF', logo: SUBJECT_LOGOS.c };
  return { icon: '📘', bg: '#EEE9FF', ink: '#7A3BFF' };
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, refetch, isRefetching } = useDashboard();
  const { data: coinsData } = useCoins();
  const { data: allCoursesData } = useCourses('All', '');
  const [coinsModalVisible, setCoinsModalVisible] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const [xpHowOpen, setXpHowOpen] = useState(false);
  const queryClient = useQueryClient();
  const lessonContext = useCourseStore((s) => s.lessonContext);
  const setActiveLesson = useCourseStore((s) => s.setActiveLesson);
  const setActiveCourse = useCourseStore((s) => s.setActiveCourse);
  // Persisted last lesson (survives app restart, 15-day window) — used as a
  // fallback when the in-memory lessonContext is gone.
  const [persistedLesson, setPersistedLesson] = useState<LastLesson | null>(null);

  // Prefetch leaderboard, achievements & streak so child screens open instantly
  usePrefetchDashboard();
  // Prefetch notifications so the Notifications page opens instantly (no spinner)
  usePrefetchNotifications();

  // Fetch unread notification count
  useEffect(() => {
    getUnreadCount().then(setNotifUnread).catch(() => {});
  }, []);

  // Load the persisted last-lesson (only needed when there's no in-memory context)
  useEffect(() => {
    if (!lessonContext) getLastLesson().then(setPersistedLesson).catch(() => {});
  }, [lessonContext]);

  // ── Unified "refresh entire app" (same behaviour everywhere): invalidate ALL
  // queries → whole app refetches fresh from server, bypassing staleTime. ──
  const { refreshAll: handleRefreshAll, refreshing, spin } = useRefreshAll(setNotifUnread);

  const enrolledCount = data?.enrolledCount ?? 0;
  const totalCoins = coinsData?.totalCoins ?? 0;

  // Level badge: the SAME XP level as the profile (one level system everywhere).
  // XP comes from lessons, quizzes and exercises (see XPService).
  const xp = useXP();
  const userLevel = xp.level.level;
  const userLevelTitle = xp.level.title;

  // Level up! — celebrate once when the server level goes up (first load only saves it).
  const serverLevel = xp.server?.level;
  useEffect(() => {
    if (!serverLevel || !user?.id) return;
    const key = `ck_last_level_${user.id}`;
    AsyncStorage.getItem(key).then((saved) => {
      const before = Number(saved) || 0;
      if (before && serverLevel > before) {
        Alert.alert('Level up! 🚀', `You reached Level ${serverLevel} · ${xp.level.title}. Keep learning to earn more XP!`);
      }
      if (serverLevel !== before) AsyncStorage.setItem(key, String(serverLevel)).catch(() => {});
    }).catch(() => {});
  }, [serverLevel, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // First name only for the welcome card (e.g. "Avinash Raj Anand" → "Avinash")
  const firstName = (user?.name?.trim().split(/\s+/)[0]) || 'Learner';

  // Videos/lessons completed count (sum across enrolled courses — same as completed-videos screen)
  const videosCompleted = (data?.enrolledCourses ?? []).reduce((sum: number, c: any) => sum + (c.completedLessons ?? 0), 0);

  // Continue-Learning source priority (all user-specific):
  //   1. in-memory lessonContext (current session)
  //   2. persisted last lesson (survives restart, valid 15 days)
  //   3. API lastWatched (server fallback)
  const resumeSource = lessonContext ?? persistedLesson;
  const resumeData = resumeSource
    ? {
        courseId: resumeSource.courseId,
        courseTitle: resumeSource.courseTitle,
        moduleTitle: resumeSource.moduleTitle,
        lessonId: resumeSource.lessonId,
        lessonTitle: resumeSource.lessonTitle,
        progressPercent: data?.lastWatched?.progressPercent ?? 0,
      }
    : data?.lastWatched ?? null;

  // Continue Learning enrichment (mirrors desktop): language chip, difficulty, XP, progress text, time-left
  const resumePct = resumeData?.progressPercent ?? 0;
  const resumeCourseTitle = (resumeData?.courseTitle || '').toLowerCase();
  const resumeLangChip =
    resumeCourseTitle.includes('python') ? 'PYTHON' :
    (resumeCourseTitle.includes('java') && !resumeCourseTitle.includes('javascript')) ? 'JAVA' :
    resumeCourseTitle.includes('javascript') || resumeCourseTitle.includes(' js') ? 'JS' :
    (resumeCourseTitle === 'c' || resumeCourseTitle.startsWith('c ') || resumeCourseTitle.includes('c programming')) ? 'C' :
    resumeCourseTitle.includes('react') ? 'REACT' :
    resumeCourseTitle.includes('html') || resumeCourseTitle.includes('web') ? 'WEB' :
    resumeCourseTitle.includes('node') ? 'NODE' : '';
  const resumeDifficulty =
    resumePct >= 70 ? { label: '🟠 Advanced', color: '#fdba74' } :
    resumePct >= 30 ? { label: '🟡 Intermediate', color: '#fde047' } :
    { label: '🟢 Beginner', color: '#6ee7b7' };
  const resumeProgressText =
    resumePct >= 100 ? '🏆 Quest Complete!' :
    resumePct >= 90 ? `🔥 Almost done! ${resumePct}%` :
    resumePct >= 50 ? `⚡ Halfway there! ${resumePct}%` :
    resumePct > 0 ? `⚡ Just started ${resumePct}%` :
    '🚀 Ready to start!';

  // Weekly Challenge card = this week's coding challenge (one program a week,
  // +10 coins once). Shows "Completed this week" once solved.
  const { data: weekly } = useQuery({
    queryKey: ['weekly-coding'],
    queryFn: () => weeklyCodingApi.get(),
    staleTime: 60_000,
  });
  const wcDone = !!weekly?.completed;
  const wcReward = weekly?.reward ?? 10;
  const wcTitle = weekly?.exercise?.title ?? null;
  const wcDescription = !weekly
    ? 'Loading this week’s challenge…'
    : !weekly.exercise
      ? 'No challenge this week yet. Check back soon!'
      : wcDone
        ? `You solved “${wcTitle}”. A new challenge comes every Monday.`
        : `Solve this week’s coding program: “${wcTitle}”`;

  // Fetch achievements to get latest badge
  const { data: achievementsData } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => achievementsApi.get(),
    staleTime: 1000 * 60 * 5,
  });

  const achievements: Achievement[] = achievementsData?.achievements ?? [];
  // Sort by earnedAt/createdAt descending to get latest badge
  const latestBadge = achievements.length > 0
    ? [...achievements].sort((a, b) => {
        const dateA = new Date(a.earnedAt || a.createdAt).getTime();
        const dateB = new Date(b.earnedAt || b.createdAt).getTime();
        return dateB - dateA;
      })[0]
    : null;

  const badgeEmoji: Record<string, string> = {
    'super-master': '🥇',
    master: '🥈',
    pro: '🥉',
    'coding-gold': '🥇',
    'coding-silver': '🥈',
    'coding-bronze': '🥉',
    'weekly-champion': '🏆',
    'weekly-finalist': '🎖️',
    'weekly-solver': '✅',
  };

  // Open the Continue-Learning target. If the in-memory lesson context is set
  // (current session), the lesson screen already has the active lesson → open
  // directly. Otherwise (persisted / API source) resolve the lesson from the
  // (prefetched) course detail, set it active so the video plays, then open.
  const openContinueLearning = async () => {
    if (!resumeData) return;
    if (lessonContext && resumeData.lessonId) {
      router.push(`/lesson/${resumeData.lessonId}`);
      return;
    }
    const { courseId, lessonId } = resumeData;
    if (!lessonId || !courseId) {
      if (courseId) router.push(`/course/${courseId}`);
      return;
    }
    try {
      const res = await queryClient.fetchQuery({
        queryKey: ['course', courseId],
        queryFn: () => coursesApi.getById(courseId),
        staleTime: 1000 * 60 * 2,
      });
      const course = res?.course;
      const mod = course?.modules?.find((m) => m.lessons?.some((l) => l.id === lessonId));
      const lesson = mod?.lessons?.find((l) => l.id === lessonId);
      if (course && mod && lesson) {
        setActiveCourse(course);
        setActiveLesson(lesson, mod, course.id, course.title);
        router.push(`/lesson/${lessonId}`);
      } else {
        router.push(`/course/${courseId}`);
      }
    } catch {
      router.push(`/course/${courseId}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Topbar: logo + tagline + refresh + notification bell */}
      <View style={styles.topbar}>
        <View>
          <Text style={styles.topbarTitle}>
            Coding<Text style={styles.logoK}>K</Text><Text style={styles.logoI}>i</Text><Text style={styles.logoD}>d</Text><Text style={styles.logoA}>a</Text>
          </Text>
          <Text style={styles.topbarTagline}>Learn  •  Practice  •  Grow</Text>
        </View>
        <View style={styles.topbarActions}>
          {/* Coins widget — tap opens Coins modal (mirrors desktop topbar coins) */}
          <TouchableOpacity
            style={styles.topbarCoins}
            onPress={() => setCoinsModalVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="Coins"
          >
            <Text style={styles.topbarCoinsEmoji}>🪙</Text>
            <Text style={styles.topbarCoinsText}>{totalCoins}</Text>
          </TouchableOpacity>

          {/* Leaderboard — beside the coins, like the desktop app */}
          <TouchableOpacity
            style={[styles.iconBtn, styles.iconBtnAmber]}
            onPress={() => router.push('/leaderboard')}
            activeOpacity={0.7}
            accessibilityLabel="Leaderboard"
          >
            <Text style={styles.iconText}>🏆</Text>
          </TouchableOpacity>

          {/* Refresh button — pulls latest data from server (bypasses cache) */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleRefreshAll}
            activeOpacity={0.7}
            disabled={refreshing}
            accessibilityLabel="Refresh data"
          >
            <Animated.Text style={[styles.iconText, { transform: [{ rotate: spin }] }]}>🔄</Animated.Text>
          </TouchableOpacity>

          {/* Notification bell */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
          >
            <Text style={styles.iconText}>🔔</Text>
            {notifUnread > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{notifUnread > 99 ? '99+' : notifUnread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching || refreshing} onRefresh={handleRefreshAll} tintColor={Colors.primary} />}
      >
        {/* Stays until the profile / parent is verified */}
        <ProfileVerification variant="banner" />

        {/* Welcome Card — banner artwork as background, dynamic native UI on top.
            Data/navigation unchanged — only the visual treatment is new. */}
        <View style={styles.welcomeWrapper}>
          <ImageBackground
            source={require('../../assets/welcome-banner.png')}
            style={styles.welcomeBanner}
            imageStyle={styles.welcomeBannerImg}
            resizeMode="cover"
          >
            <View style={styles.welcomeLeft}>
              {/* Level badge (coins-based) — mirrors desktop */}
              <View style={styles.levelBadge}>
                <Text style={styles.levelStar}>⭐</Text>
                <Text style={styles.levelText}>Level {userLevel} · {userLevelTitle}</Text>
              </View>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.welcomeName} numberOfLines={1}>{firstName}! 👋</Text>
              <Text style={styles.welcomeSubtitle}>Keep learning,</Text>
              <Text style={styles.welcomeSubtitle}>keep growing.</Text>
            </View>
          </ImageBackground>
        </View>

        {/* Level & XP — the one place for XP. XP = learning points; every 100 XP = 1 level. */}
        <View style={styles.xpCard}>
          <View style={styles.xpBlobA} />
          <View style={styles.xpBlobB} />
          <View style={styles.xpRow}>
            <View style={styles.xpLevelCircle}>
              <Text style={styles.xpLevelNum}>{xp.level.level}</Text>
              <Text style={styles.xpLevelTiny}>LEVEL</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.xpLevelName} numberOfLines={1}>{xp.level.title}</Text>
              <Text style={styles.xpTotal}>⭐ {xp.level.xp} XP earned</Text>
            </View>
          </View>
          <View style={styles.xpBar}>
            <View style={[styles.xpBarFill, { width: `${Math.max(4, xp.level.progressPct)}%` as any }]} />
          </View>
          <Text style={styles.xpNext}>
            {xp.level.xp - xp.level.floor} / 100 XP · {xp.level.toNext} more XP to reach Level {xp.level.level + 1} 🚀
          </Text>
          <TouchableOpacity style={styles.xpHowRow} onPress={() => setXpHowOpen((v) => !v)} activeOpacity={0.7}>
            <Text style={styles.xpHowTitle}>How to earn XP</Text>
            <Text style={styles.xpHowArrow}>{xpHowOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {xpHowOpen && (
            <View style={styles.xpChips}>
              <Text style={styles.xpChip}>🎬 Watch a video +{xp.server?.rewards.video ?? 10}</Text>
              <Text style={styles.xpChip}>✅ Right quiz answer +{xp.server?.rewards.quizCorrect ?? 5}</Text>
              <Text style={styles.xpChip}>🧠 Finish a quiz +{xp.server?.rewards.quizFinished ?? 20}</Text>
              <Text style={styles.xpChip}>💻 Solve an exercise +{xp.server?.rewards.exercise ?? 30}</Text>
              <Text style={styles.xpChip}>🔥 Weekly challenge +{xp.server?.rewards.weekly ?? 50}</Text>
            </View>
          )}
        </View>

        {/* Stats Row — 2 thin cards in one row: Enrolled Courses + Latest Badge */}
        <View style={styles.statsGrid}>
          {/* Enrolled Courses */}
          <TouchableOpacity
            style={[styles.statCard, styles.statCardBlue]}
            onPress={() => router.push('/enrolled-courses')}
            activeOpacity={0.9}
          >
            <View style={styles.statBlob} />
            <View style={styles.statTop}>
              <View style={styles.statIconWrap}>
                <Text style={styles.statEmoji}>📚</Text>
              </View>
              <Text style={styles.statValue}>{isLoading ? '—' : enrolledCount}</Text>
            </View>
            <Text style={styles.statTitle} numberOfLines={2}>Enrolled Courses</Text>
            <Text style={styles.statSub} numberOfLines={1}>Keep learning ›</Text>
          </TouchableOpacity>

          {/* Latest Achievement Badge */}
          <TouchableOpacity
            style={[styles.statCard, styles.statCardAmber]}
            onPress={() => router.push('/achievements')}
            activeOpacity={0.9}
          >
            <View style={styles.statBlob} />
            <View style={styles.statTop}>
              <View style={styles.statIconWrap}>
                <Text style={styles.statEmoji}>{latestBadge ? (badgeEmoji[latestBadge.badgeType] || '🏅') : '🏆'}</Text>
              </View>
              <Text style={styles.statValue}>{achievements.length}</Text>
            </View>
            <Text style={styles.statTitle} numberOfLines={2}>My Achievements</Text>
            <Text style={styles.statSub} numberOfLines={1}>
              {latestBadge ? `Latest: ${latestBadge.title}` : 'Earn your first badge!'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Live Classes banner — sits above the resume video card so students
            can jump straight to a live/scheduled class. Always visible. */}
        <TouchableOpacity style={styles.liveBanner} onPress={() => router.push('/live' as never)} activeOpacity={0.85}>
          <View style={styles.liveBannerDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.liveBannerTitle}>🔴 Live Classes</Text>
            <Text style={styles.liveBannerSub}>Join your teacher’s live session</Text>
          </View>
          <Text style={styles.liveBannerChevron}>›</Text>
        </TouchableOpacity>

        {/* Continue Learning (enriched — mirrors desktop) */}
        {resumeData && (
          <>
            <View style={styles.continueHeader}>
              <Text style={styles.continueHeaderTitle}>Continue Learning ⚡</Text>
            </View>
            <TouchableOpacity
              style={styles.continueCard}
              onPress={openContinueLearning}
            >
              <View style={styles.continueThumbnail}>
                <Text style={styles.continueThumbnailIcon}>▶</Text>
              </View>
              <View style={{ flex: 1 }}>
                {/* Title + language chip */}
                <View style={styles.continueTitleRow}>
                  <Text style={styles.continueCourseTitle} numberOfLines={1}>{resumeData.courseTitle}</Text>
                  {resumeLangChip ? (
                    <View style={styles.continueLangChip}><Text style={styles.continueLangChipText}>{resumeLangChip}</Text></View>
                  ) : null}
                </View>
                {/* Difficulty badge */}
                <View style={[styles.continueDiffBadge, { borderColor: `${resumeDifficulty.color}55` }]}>
                  <Text style={[styles.continueDiffText, { color: resumeDifficulty.color }]}>{resumeDifficulty.label}</Text>
                </View>
                <Text style={styles.continueMeta} numberOfLines={1}>
                  {resumeData.moduleTitle} · {resumeData.lessonTitle}
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${resumePct}%` as any }]} />
                </View>
                <Text style={styles.continueProgressText}>{resumeProgressText}</Text>
              </View>
              <View style={styles.resumeBtn}>
                <Text style={styles.resumeBtnText}>Resume ▶</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Weekly Challenge card (this week's coding challenge) */}
        <TouchableOpacity style={styles.wcCard} activeOpacity={0.9} onPress={() => router.push('/weekly-challenge' as never)}>
          {/* CodingKida calendar art — right side, doesn't cover text */}
          <ImageBackground
            source={require('../../assets/demo-calendar.png')}
            style={styles.wcArt}
            resizeMode="contain"
          />
          <View style={styles.wcHeader}>
            <Text style={styles.wcTitle}>🔥 Weekly Challenge</Text>
            <Text style={styles.wcProgressText}>{wcDone ? '✅ Done' : '0 / 1'}</Text>
          </View>
          <View style={styles.wcProgressBarWrap}>
            <View style={styles.wcProgressBar}>
              <View style={[styles.wcProgressFill, { width: wcDone ? '100%' : '0%' }]} />
            </View>
          </View>
          <Text style={styles.wcDescription}>{wcDescription}</Text>
          <Text style={styles.wcReward}>
            {wcDone
              ? `${weekly?.medal ? `${weekly.medal.icon} ${weekly.medal.label}` : '✅'} · Completed this week · ${weekly?.coinsEarned ?? 0} coins earned`
              : `🪙 Up to ${wcReward} coins + ${weekly?.xp ?? 50} XP when you solve it`}
          </Text>
          <Text style={styles.wcCta}>{wcDone ? 'See this week’s solvers  ›' : 'Start coding  ›'}</Text>
        </TouchableOpacity>

        {/* Recommended for You */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recommended for You</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/courses')}>
            <Text style={styles.seeAll}>View all →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recRow}
          snapToInterval={174}
          decelerationRate="fast"
        >
          {(allCoursesData?.courses ?? []).slice(0, 4).map((course) => {
            const sv = subjectVisual(course.title || '');
            return (
              <TouchableOpacity
                key={course.id}
                style={styles.recCard}
                onPress={() => router.push(`/course/${course.id}`)}
                activeOpacity={0.85}
              >
                <View style={styles.recTop}>
                  <View style={[styles.recLogo, { backgroundColor: sv.logo ? '#fff' : sv.bg }]}>
                    {sv.logo ? (
                      <Image source={sv.logo} style={styles.recLogoImg} resizeMode="contain" />
                    ) : (
                      <Text style={{ fontSize: sv.icon.length <= 2 ? 16 : 18, color: sv.ink, fontWeight: '900' }}>{sv.icon}</Text>
                    )}
                  </View>
                  <Text style={styles.recName} numberOfLines={1}>{course.title || ''}</Text>
                </View>
                <Text style={styles.recSub} numberOfLines={3}>
                  {course.subtitle || `Learn ${course.title} from basics to advanced concepts`}
                </Text>
                <View style={styles.recBottom}>
                  <View style={[styles.priceBadge, { backgroundColor: course.isFree ? L.greenSoft : L.purpleSoft }]}>
                    <Text style={[styles.priceText, { color: course.isFree ? L.green : L.purple }]}>
                      {course.isFree ? 'Free' : 'Pro'}
                    </Text>
                  </View>
                  <Text style={styles.recChevron}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <CodeArenaCard />
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.quickActionBtn, { backgroundColor: L.blueSoft }]} onPress={() => router.push('/downloads')} activeOpacity={0.85}>
            <Text style={styles.quickActionEmoji}>📥</Text>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Downloads</Text>
            <Text style={styles.quickActionChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickActionBtn, { backgroundColor: L.pinkSoft }]} onPress={() => router.push('/watchlist')} activeOpacity={0.85}>
            <Text style={styles.quickActionEmoji}>📺</Text>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Watchlist</Text>
            <Text style={styles.quickActionChevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Coins Modal */}
      <CoinsModal visible={coinsModalVisible} onClose={() => setCoinsModalVisible(false)} />
    </SafeAreaView>
  );
}

// ── Light-theme palette (UI only — no logic depends on these) ──
const L = {
  bg: '#FFFFFF',
  ink: '#1E2233',
  sub: '#8A90A2',
  blue: '#2F6BFF',
  blueSoft: '#E6EEFF',
  amber: '#F5A623',
  amberSoft: '#FFF3DC',
  green: '#22C55E',
  greenCard: '#E9F9EF',
  greenSoft: '#E4F8EC',
  pink: '#F0316E',
  pinkSoft: '#FCE4EE',
  purple: '#7A3BFF',
  purpleSoft: '#EEE9FF',
  line: '#EEF0F5',
  card: '#FFFFFF',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: L.bg },

  // Topbar
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topbarTitle: { fontSize: 21, fontWeight: '900', color: L.ink },
  // "Kida" multi-colour — exact CodingKida logo shades
  logoK: { color: '#FA0514' }, // Bright Red
  logoI: { color: '#FCCE02' }, // Golden Yellow
  logoD: { color: '#9BE900' }, // Lime Green
  logoA: { color: '#42C900' }, // Green
  topbarTagline: { fontSize: 10.5, fontWeight: '600', color: L.sub, marginTop: 1, letterSpacing: 0.3 },
  topbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { position: 'relative', width: 34, height: 34, borderRadius: 12, backgroundColor: L.blueSoft, alignItems: 'center', justifyContent: 'center' },
  iconBtnAmber: { backgroundColor: L.amberSoft },
  // Level & XP card
  xpCard: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 14, padding: 16, borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#F3F1FB', borderWidth: 1.5, borderColor: '#DDD6F7',
    shadowColor: '#6538FF', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  xpBlobA: { position: 'absolute', width: 130, height: 130, borderRadius: 65, right: -40, top: -50, backgroundColor: 'rgba(101,56,255,0.07)' },
  xpBlobB: { position: 'absolute', width: 80, height: 80, borderRadius: 40, left: -25, bottom: -35, backgroundColor: 'rgba(255,196,0,0.14)' },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  xpLevelCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: L.purple, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFC400',
  },
  xpLevelNum: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', lineHeight: 24 },
  xpLevelTiny: { color: '#FFFFFF', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8, marginTop: -1 },
  xpLevelName: { fontSize: 18, fontWeight: '900', color: '#5B2EF0' },
  xpTotal: { fontSize: 12.5, fontWeight: '700', color: '#5C6680', marginTop: 2 },
  xpBar: { height: 12, borderRadius: 8, backgroundColor: '#E2DCF7', overflow: 'hidden', marginTop: 14 },
  xpBarFill: { height: '100%', borderRadius: 8, backgroundColor: L.purple },
  xpNext: { fontSize: 12, fontWeight: '700', color: '#5C6680', marginTop: 8, lineHeight: 17 },
  xpHowRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E8E4F6',
  },
  xpHowTitle: { fontSize: 12.5, fontWeight: '800', color: '#5B2EF0' },
  xpHowArrow: { fontSize: 11, fontWeight: '800', color: '#5C6680' },
  xpChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  xpChip: {
    fontSize: 11.5, fontWeight: '800', color: '#4B3FA0', backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden', borderWidth: 1, borderColor: '#E8E4F6',
  },
  wcCta: { marginTop: 10, fontSize: 12.5, fontWeight: '800', color: L.purple },
  iconText: { fontSize: 17 },
  topbarCoins: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: L.amberSoft,
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
  },
  topbarCoinsEmoji: { fontSize: 13 },
  topbarCoinsText: { fontSize: 13, fontWeight: '900', color: '#8A6D00' },
  bellBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff',
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // Welcome Card (banner artwork background + overlaid dynamic UI)
  welcomeWrapper: {
    marginHorizontal: 16, marginTop: 6, marginBottom: 8,
    borderRadius: 22, overflow: 'hidden',
    shadowColor: L.blue, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  welcomeBanner: { width: '100%', aspectRatio: 2.3, justifyContent: 'flex-start', paddingLeft: 16, paddingRight: 8, paddingTop: 12, overflow: 'hidden', backgroundColor: '#E4EFFB' },
  welcomeBannerImg: { borderRadius: 22, width: '108%', height: '108%', resizeMode: 'cover', transform: [{ translateX: 2 }] },
  welcomeLeft: { width: '56%', zIndex: 2 },
  levelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
    marginBottom: 8,
    shadowColor: L.blue, shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  levelStar: { fontSize: 11 },
  levelText: { fontSize: 11.5, fontWeight: '800', color: L.blue },
  welcomeText: { fontSize: 14, fontWeight: '600', color: '#44506B' },
  welcomeName: { fontSize: 19, fontWeight: '900', color: L.ink, marginTop: 1, lineHeight: 23 },
  welcomeSubtitle: { fontSize: 11.5, fontWeight: '500', color: '#5C6680', lineHeight: 15 },
  continueBtn: {
    position: 'absolute', left: 16, bottom: 12, zIndex: 3,
    alignSelf: 'flex-start',
    backgroundColor: L.blue, borderRadius: 16, paddingVertical: 5, paddingHorizontal: 8,
    shadowColor: L.blue, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  continueBtnText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },

  // Stats Row — 2 thin cards side by side
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16, gap: 12, marginTop: 8, marginBottom: 20,
  },
  // Chunky, game-style tiles (bright colour + thick "pressable" bottom edge)
  statCard: {
    flex: 1, minHeight: 130, borderRadius: 24, padding: 14, justifyContent: 'space-between', overflow: 'hidden',
    borderWidth: 0, borderBottomWidth: 6,
  },
  statCardBlue: { backgroundColor: '#3B82F6', borderBottomColor: '#2058C9' },
  statCardAmber: { backgroundColor: '#FFA928', borderBottomColor: '#D9820A' },
  statBlob: {
    position: 'absolute', width: 96, height: 96, borderRadius: 48, right: -28, top: -30,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statIconWrap: {
    width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  statEmoji: { fontSize: 26 },
  statValue: { fontSize: 38, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  statTitle: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', marginTop: 10 },
  statSub: {
    alignSelf: 'flex-start', marginTop: 6, fontSize: 11.5, fontWeight: '800', color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden',
  },

  // Continue Learning Card
  continueCard: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: L.card,
    borderRadius: 18, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: L.line,
    shadowColor: L.blue, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2,
  },
  // Live Classes banner (above the resume card)
  liveBanner: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: L.card,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
  },
  liveBannerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  liveBannerTitle: { color: L.ink, fontSize: 15, fontWeight: '900' },
  liveBannerSub: { color: L.sub, fontSize: 12, fontWeight: '600', marginTop: 2 },
  liveBannerChevron: { color: L.sub, fontSize: 22, fontWeight: '700' },

  continueThumbnail: {
    width: 62, height: 62, borderRadius: 14,
    backgroundColor: '#241B3D', alignItems: 'center', justifyContent: 'center',
  },
  continueThumbnailIcon: { fontSize: 24, color: '#B98BFF' },
  continueCourseTitle: { color: L.ink, fontSize: 16, fontWeight: '900', flexShrink: 1 },
  continueMeta: { color: L.sub, fontSize: 12, fontWeight: '600', marginBottom: 8 },

  // Continue Learning enrichment
  continueHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginBottom: 12,
  },
  continueHeaderTitle: { color: L.ink, fontSize: 17, fontWeight: '900' },
  continueXpChip: {
    backgroundColor: L.amberSoft,
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5,
  },
  continueXpChipText: { color: '#9A6B00', fontSize: 11, fontWeight: '800' },
  continueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  continueLangChip: {
    backgroundColor: L.purpleSoft,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  continueLangChipText: { color: L.purple, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  continueDiffBadge: {
    alignSelf: 'flex-start',
    backgroundColor: L.greenSoft, borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6,
  },
  continueDiffText: { fontSize: 10.5, fontWeight: '800' },
  continueProgressText: { color: L.sub, fontSize: 11, fontWeight: '700', marginTop: 6 },
  resumeBtn: {
    backgroundColor: L.blue, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  resumeBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Progress bar
  progressBar: {
    height: 6, backgroundColor: L.line,
    borderRadius: 50, overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: L.blue,
    borderRadius: 50,
  },

  // Weekly Challenge card + streak pips
  wcCard: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: L.greenCard, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: '#CFEBD8', overflow: 'hidden',
  },
  wcArt: { position: 'absolute', right: 10, top: 44, width: 104, height: 104, zIndex: 1 },
  wcHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  wcTitle: { color: L.ink, fontSize: 16, fontWeight: '900' },
  wcProgressText: { color: L.green, fontSize: 15, fontWeight: '900' },
  wcProgressBarWrap: { maxWidth: '66%' },
  wcProgressBar: { height: 8, backgroundColor: '#D3EEDC', borderRadius: 50, overflow: 'hidden', marginBottom: 10 },
  wcProgressFill: { height: '100%', backgroundColor: L.green, borderRadius: 50 },
  wcDescription: { color: '#5A6B60', fontSize: 12.5, fontWeight: '500', lineHeight: 18, marginBottom: 4, maxWidth: '66%' },
  wcReward: { color: '#C2830B', fontSize: 12.5, fontWeight: '800', lineHeight: 18, marginBottom: 12, maxWidth: '64%' },
  streakPipsRow: { flexDirection: 'row', gap: 6, marginBottom: 10, maxWidth: '64%' },
  streakPip: {
    flex: 1, height: 8, borderRadius: 5,
    backgroundColor: '#CDE9D6',
  },
  streakPipFilled: { backgroundColor: L.green },
  streakPipNext: { backgroundColor: '#8DDBA8' },
  streakFooter: { color: L.ink, fontSize: 12.5, fontWeight: '800', textAlign: 'center' },

  // Section header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 12,
  },
  sectionTitle: { color: L.ink, fontSize: 17, fontWeight: '900' },
  seeAll: { color: L.blue, fontSize: 13, fontWeight: '700' },

  // Recommended horizontal cards
  recRow: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  recCard: {
    width: 162, backgroundColor: L.card, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: L.line,
  },
  recTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  recLogo: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  recLogoImg: { width: 30, height: 30 },
  recName: { flex: 1, color: L.ink, fontSize: 13, fontWeight: '900' },
  recSub: { color: L.sub, fontSize: 10.5, fontWeight: '500', lineHeight: 15, minHeight: 60 },
  recBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  recChevron: { fontSize: 18, color: L.sub, fontWeight: '300' },
  priceBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  priceText: { fontSize: 11.5, fontWeight: '800' },

  // Quick Actions
  quickActions: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  quickActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 6,
  },
  quickActionEmoji: { fontSize: 16 },
  quickActionLabel: { color: L.ink, fontSize: 11, fontWeight: '800' },
  quickActionChevron: { fontSize: 13, color: L.sub, fontWeight: '400' },
});
