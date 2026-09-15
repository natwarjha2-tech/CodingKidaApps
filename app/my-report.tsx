import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Share, Modal } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDashboard, useCoins, useWeeklyStreakCount } from '@/hooks';
import { achievementsApi, weeklyStreakApi, coinsApi } from '@/api';
import { AttendanceService } from '@/services';
import { Colors } from '@/theme';
import type { Achievement } from '@/types';

const badgeEmoji: Record<string, string> = {
  'super-master': '🥇',
  master: '🥈',
  pro: '🥉',
};

const badgeLabel: Record<string, string> = {
  'super-master': 'Super Master',
  master: 'Master',
  pro: 'Pro',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Gentle daily coding goal for the day-detail progress meter (mirrors desktop CK_DAY_GOAL_MINS).
const DAY_GOAL_MINS = 20;

// Build the day-detail content (mirrors desktop showDayDetail effort tiers).
function buildDayDetail(dateKey: string, mins: number, opens: number, mode: 'past' | 'future') {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const dateObj = new Date(y, mo - 1, d);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const title = `${weekdays[dateObj.getDay()]}, ${monthsShort[mo - 1]} ${d}`;

  if (mode === 'future') {
    return {
      emoji: '📅', accent: '#a78bfa', title, badge: 'Plan a coding session!',
      message: `This day is coming up. Set a goal to code for at least ${DAY_GOAL_MINS} minutes and keep your streak strong! 🚀`,
      showStats: false, mins, opens, pct: 0,
    };
  }
  if (mins <= 0) {
    return {
      emoji: '😴', accent: '#64748b', title, badge: 'No coding this day',
      message: 'Every day counts! Jump back in and earn coins, badges and keep your streak alive. 💪',
      showStats: false, mins, opens, pct: 0,
    };
  }
  let emoji: string, badge: string, accent: string, message: string;
  if (mins < 15) { emoji = '🌱'; badge = 'Nice start!'; accent = '#c4b5fd'; message = "You showed up and learned — that's what matters. Keep it up!"; }
  else if (mins < 30) { emoji = '🔥'; badge = 'Great focus!'; accent = '#a855f7'; message = "Awesome focus today. You're building a strong coding habit!"; }
  else { emoji = '🚀'; badge = 'Coding superstar!'; accent = '#ec4899'; message = "Incredible effort! You're a true CodingKida superstar today!"; }
  const pct = Math.min(100, Math.round((mins / DAY_GOAL_MINS) * 100));
  return { emoji, accent, title, badge, message, showStats: true, mins, opens, pct };
}

export default function MyReportScreen() {
  const queryClient = useQueryClient();
  const { data: dashData, isLoading: dashLoading } = useDashboard();
  const { data: coinsData, isLoading: coinsLoading } = useCoins();
  const { data: streakCount } = useWeeklyStreakCount();
  const [todayMins, setTodayMins] = useState(0);
  const [weekMins, setWeekMins] = useState(0);
  const [calendarDays, setCalendarDays] = useState<{ date: string; day: number; mins: number; active: boolean; isToday: boolean }[]>([]);
  const [selectedBadgeType, setSelectedBadgeType] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Calendar day-detail popup (mirrors desktop showDayDetail)
  const [dayDetail, setDayDetail] = useState<ReturnType<typeof buildDayDetail> | null>(null);

  // Open the per-day detail popup with real attendance data.
  const openDayDetail = useCallback(async (dateKey: string) => {
    const todayKey = new Date().toISOString().split('T')[0];
    const mode: 'past' | 'future' = dateKey > todayKey ? 'future' : 'past';
    const detail = mode === 'future' ? { mins: 0, opens: 0 } : await AttendanceService.getDayDetail(dateKey);
    setDayDetail(buildDayDetail(dateKey, detail.mins, detail.opens, mode));
  }, []);

  // Reload attendance data (also used by refresh)
  const loadAttendance = useCallback(() => {
    AttendanceService.getTodayMins().then(setTodayMins);
    AttendanceService.getWeekMins().then(setWeekMins);
    AttendanceService.getLast30Days().then(setCalendarDays);
  }, []);

  // Manual refresh — unified: refresh the ENTIRE app (all queries) + reload
  // local attendance. Same one-button behaviour as everywhere else.
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries(); // ALL queries → whole app fresh
      loadAttendance();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, queryClient, loadAttendance]);

  // Achievements
  const { data: achievementsData, isLoading: achievementsLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => achievementsApi.get(),
    staleTime: 1000 * 60 * 5,
  });

  // Weekly Streak full data
  const enrolled = dashData?.enrolledCourses ?? [];
  const courseIds = enrolled.map((c) => c.id);

  const { data: streakData, isLoading: streakLoading } = useQuery({
    queryKey: ['streak-history', courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return { streaks: [] as any[], completedCount: 0 };
      const results = await Promise.allSettled(
        enrolled.map((course) =>
          weeklyStreakApi.getByCourse(course.id).then((res) => ({
            courseTitle: course.title,
            streaks: res.streaks ?? [],
            completedCount: res.completedCount ?? 0,
          }))
        )
      );
      let allStreaks: any[] = [];
      let totalCompleted = 0;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          totalCompleted += result.value.completedCount;
          for (const streak of result.value.streaks) {
            allStreaks.push({
              id: streak.id,
              title: streak.title,
              weekNumber: streak.weekNumber,
              completed: streak.completed,
              courseTitle: result.value.courseTitle,
            });
          }
        }
      }
      return { streaks: allStreaks, completedCount: totalCompleted };
    },
    enabled: courseIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Coins full transaction data
  const { data: coinsFullData, isLoading: coinsFullLoading } = useQuery({
    queryKey: ['coins'],
    queryFn: () => coinsApi.get(),
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = dashLoading || coinsLoading;

  // Load attendance data
  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const enrolledCourses = dashData?.enrolledCourses ?? [];
  const totalEnrolled = dashData?.enrolledCount ?? enrolledCourses.length;
  const totalCoins = coinsFullData?.totalCoins ?? coinsData?.totalCoins ?? 0;
  const transactions = coinsFullData?.transactions ?? [];

  // Calculate stats
  const totalVideosWatched = enrolledCourses.reduce(
    (sum, c) => sum + (c.completedLessons ?? 0),
    0
  );

  // KPI: learning-time display — real minutes; show a dash for genuinely-zero
  // activity instead of a misleading "0 min" (mirrors desktop _spFmtTime).
  const fmtKpiTime = useCallback((mins: number) => (!mins || mins <= 0 ? '—' : AttendanceService.formatMins(mins)), []);

  // Active days in the CURRENT calendar week (Mon–Sun), out of 7 — from the
  // same real attendance records (mirrors desktop _weekActiveDays).
  const weekActiveDays = useMemo(() => {
    const wkToday = new Date();
    const dow = wkToday.getDay();                 // 0=Sun..6=Sat
    const mondayOffset = dow === 0 ? 6 : dow - 1; // days since Monday
    const monday = new Date(wkToday); monday.setDate(wkToday.getDate() - mondayOffset); monday.setHours(0, 0, 0, 0);
    let count = 0;
    for (const rec of calendarDays) {
      if (!rec || !rec.active || !rec.date) continue;
      const p = String(rec.date).split('-');
      if (p.length !== 3) continue;
      const rd = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); rd.setHours(0, 0, 0, 0);
      if (rd >= monday && rd <= wkToday) count++;
    }
    return count;
  }, [calendarDays]);

  // Monthly calendar (mirrors desktop _renderParentReport attendance calendar):
  // Mon-first weekday columns, current-month grid with leading pad, real
  // per-day minutes/active mapped by exact date, intensity tiers, today marker.
  const monthCal = useMemo(() => {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth(); // 0-based
    const todayDate = today.getDate();

    // Map real attendance records by their exact calendar date (YYYY:M:D).
    const byYmd: Record<string, { mins: number; active: boolean }> = {};
    for (const rec of calendarDays) {
      if (!rec || !rec.date) continue;
      const p = String(rec.date).split('-');
      if (p.length === 3) byYmd[`${Number(p[0])}:${Number(p[1])}:${Number(p[2])}`] = { mins: rec.mins || 0, active: !!rec.active };
    }

    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
    let monthActiveDays = 0;
    for (let d = 1; d <= daysInMonth && d <= todayDate; d++) {
      const rec = byYmd[`${curYear}:${curMonth + 1}:${d}`];
      if (rec && rec.active) monthActiveDays++;
    }

    const firstDow = new Date(curYear, curMonth, 1).getDay(); // 0=Sun
    const startPad = firstDow === 0 ? 6 : firstDow - 1;       // Mon-first offset

    type Cell = { key: string; day: number; mins: number; active: boolean; isToday: boolean; isFuture: boolean; intensity: number } | null;
    const cells: Cell[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const rec = byYmd[`${curYear}:${curMonth + 1}:${d}`];
      const mins = rec ? rec.mins : 0;
      const active = rec ? rec.active : false;
      const isToday = d === todayDate;
      const isFuture = d > todayDate;
      const intensity = mins === 0 ? 0 : mins < 15 ? 0.3 : mins < 30 ? 0.6 : 1;
      const dateKey = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ key: dateKey, day: d, mins, active, isToday, isFuture, intensity });
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return { cells, monthActiveDays, daysInMonth, monthLabel: `${monthNames[curMonth]} ${curYear}` };
  }, [calendarDays]);

  // Achievements grouped by badge type
  const achievements: Achievement[] = achievementsData?.achievements ?? [];
  const badgeCounts: Record<string, number> = {
    'super-master': 0,
    master: 0,
    pro: 0,
  };
  for (const a of achievements) {
    if (badgeCounts[a.badgeType] !== undefined) {
      badgeCounts[a.badgeType]++;
    }
  }

  // Filtered achievements for selected badge
  const filteredAchievements = selectedBadgeType
    ? achievements.filter((a) => a.badgeType === selectedBadgeType)
    : [];

  // Streak data
  const streaks = streakData?.streaks ?? [];
  const streakCompletedCount = streakData?.completedCount ?? streakCount ?? 0;

  // ── Motivation + Next Coding Mission (mirrors desktop _renderParentReport) ──
  const motivation = useMemo(() => {
    const cal = calendarDays; // oldest → newest (last 30)
    const today = new Date();
    const dow = today.getDay();               // 0=Sun..6=Sat
    const mondayOffset = dow === 0 ? 6 : dow - 1;

    // This week = last (mondayOffset+1) days; Last week = 7 days before that
    const thisWeekSlice = cal.slice(-(mondayOffset + 1));
    const lastWeekSlice = cal.slice(-(mondayOffset + 8), -(mondayOffset + 1));
    const thisWeekDays = thisWeekSlice.filter((d) => d.active).length;
    const lastWeekDays = lastWeekSlice.filter((d) => d.active).length;

    // Best week (group all 30 into weeks of 7)
    let bestWeekDays = 0;
    for (let i = 0; i < cal.length; i += 7) {
      const w = cal.slice(i, i + 7).filter((d) => d.active).length;
      if (w > bestWeekDays) bestWeekDays = w;
    }

    let icon = '🌱', title = 'Ready for this week\u2019s mission?', text = 'Start a coding session and keep your journey moving!';
    if (thisWeekDays > 0 && thisWeekDays <= 2) {
      icon = '🚀'; title = 'You\u2019re getting started!'; text = `You've coded ${thisWeekDays} day${thisWeekDays > 1 ? 's' : ''} this week. Keep the momentum going!`;
    } else if (thisWeekDays >= 3 && thisWeekDays <= 4) {
      icon = '🔥'; title = 'You\u2019re on a roll!'; text = `${thisWeekDays} coding days this week! You're crushing it!`;
    } else if (thisWeekDays >= 5) {
      icon = '🏆'; title = 'Coding superstar!'; text = `${thisWeekDays} days of coding this week — incredible consistency!`;
    }
    if (thisWeekDays > 0 && thisWeekDays > lastWeekDays && thisWeekDays >= bestWeekDays) {
      icon = '🎉'; title = 'NEW RECORD!'; text = `You just had your strongest learning week! ${thisWeekDays} days of pure coding! 🚀`;
    }

    // Next mission: beat last week OR do one more day (cap 7)
    let nextGoal = Math.min(Math.max(lastWeekDays + 1, thisWeekDays + 1), 7);
    const remaining = Math.max(nextGoal - thisWeekDays, 0);
    const missionText = remaining === 0
      ? 'Goal reached! You\u2019re amazing! 🎉'
      : remaining === 1 ? 'One more coding session! 🚀' : `${remaining} more days to beat your best!`;
    const missionSub = thisWeekDays >= nextGoal ? 'Keep your streak alive!' : 'Beat your best week!';
    const missionProgress = nextGoal > 0 ? Math.min(Math.round((thisWeekDays / nextGoal) * 100), 100) : 100;

    return { icon, title, text, thisWeekDays, nextGoal, missionText, missionSub, missionProgress };
  }, [calendarDays]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Report</Text>
        <View style={styles.headerActions}>
          {/* Refresh — pulls latest report data */}
          <TouchableOpacity onPress={handleRefresh} disabled={refreshing} style={styles.headerActionBtn}>
            <Text style={{ color: refreshing ? Colors.muted : Colors.primary, fontSize: 13, fontWeight: '600' }}>
              {refreshing ? '⏳' : '🔄'}
            </Text>
          </TouchableOpacity>
          {/* Share */}
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => {
              Share.share({
                message: `📊 CodingKida Learning Report\n\n📚 Courses Enrolled: ${totalEnrolled}\n✅ Lessons Completed: ${totalVideosWatched}\n⏱ Today: ${AttendanceService.formatMins(todayMins)}\n📅 This Week: ${AttendanceService.formatMins(weekMins)}\n🏆 Achievements: ${achievements.length}\n🔥 Weekly Streak: ${streakCompletedCount}\n🪙 Coins: ${totalCoins}\n\n— CodingKida App`,
              });
            }}
          >
            <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '600' }}>📤 Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading report...</Text>
          </View>
        ) : (
          <>
            {/* ─── 4 KPI cards row (mirrors desktop _renderParentReport) ─── */}
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { borderColor: '#8B5CF640' }]}>
                <View style={[styles.kpiIcon, { backgroundColor: '#8B5CF618' }]}><Text style={styles.kpiEmoji}>📚</Text></View>
                <View style={styles.kpiBody}>
                  <Text style={styles.kpiValue}>{totalEnrolled}</Text>
                  <Text style={styles.kpiLabel}>Courses Enrolled</Text>
                  <Text style={styles.kpiSub}>total</Text>
                </View>
              </View>
              <View style={[styles.kpiCard, { borderColor: '#22C55E40' }]}>
                <View style={[styles.kpiIcon, { backgroundColor: '#22C55E18' }]}><Text style={styles.kpiEmoji}>✅</Text></View>
                <View style={styles.kpiBody}>
                  <Text style={styles.kpiValue}>{totalVideosWatched}</Text>
                  <Text style={styles.kpiLabel}>Lessons Completed</Text>
                  <Text style={styles.kpiSub}>all time</Text>
                </View>
              </View>
              <View style={[styles.kpiCard, { borderColor: '#F59E0B40' }]}>
                <View style={[styles.kpiIcon, { backgroundColor: '#F59E0B18' }]}><Text style={styles.kpiEmoji}>⏱</Text></View>
                <View style={styles.kpiBody}>
                  <Text style={styles.kpiValue}>{fmtKpiTime(todayMins)}</Text>
                  <Text style={styles.kpiLabel}>Today</Text>
                  <Text style={styles.kpiSub}>{todayMins > 0 ? 'learning time' : 'no activity yet'}</Text>
                </View>
              </View>
              <View style={[styles.kpiCard, { borderColor: '#EC489940' }]}>
                <View style={[styles.kpiIcon, { backgroundColor: '#EC489918' }]}><Text style={styles.kpiEmoji}>📅</Text></View>
                <View style={styles.kpiBody}>
                  <Text style={styles.kpiValue}>{fmtKpiTime(weekMins)}</Text>
                  <Text style={styles.kpiLabel}>This Week</Text>
                  <Text style={styles.kpiSub}>{weekActiveDays} active days / 7</Text>
                </View>
              </View>
            </View>

            {/* ─── Your Coding Journey — monthly calendar (mirrors desktop) ─── */}
            <View style={styles.calendarSection}>
              <Text style={styles.calendarTitle}>🗓 Your Coding Journey</Text>

              {/* Active Days strip (X / days-in-month) */}
              <View style={styles.calActiveStrip}>
                <Text style={styles.calActiveValue}>
                  {monthCal.monthActiveDays} <Text style={styles.calActiveDenom}>/ {monthCal.daysInMonth}</Text>
                </Text>
                <Text style={styles.calActiveLabel}>Active Days</Text>
              </View>

              <View style={styles.calBox}>
                <Text style={styles.calMonthLabel}>{monthCal.monthLabel}</Text>

                {/* Weekday header (Mon-first) */}
                <View style={styles.calWeekRow}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                    <Text key={d} style={styles.calWeekday}>{d}</Text>
                  ))}
                </View>

                {/* Month grid */}
                <View style={styles.calGrid}>
                  {monthCal.cells.map((cell, idx) => {
                    if (!cell) return <View key={`pad-${idx}`} style={styles.calCellPad} />;
                    // Colour tiers (mirrors desktop): inactive / Started / Focused / On Fire.
                    let bg = Colors.card2, borderColor = Colors.border, textColor = Colors.muted;
                    if (cell.active && cell.intensity <= 0.3) { bg = 'rgba(124,58,237,0.20)'; borderColor = 'rgba(124,58,237,0.35)'; textColor = '#C4B5FD'; }
                    else if (cell.active && cell.intensity <= 0.6) { bg = '#7C3AED'; borderColor = 'rgba(168,85,247,0.5)'; textColor = '#fff'; }
                    else if (cell.active) { bg = '#A855F7'; borderColor = 'rgba(236,72,153,0.5)'; textColor = '#fff'; }
                    if (cell.isFuture) { bg = 'rgba(255,255,255,0.02)'; borderColor = 'rgba(139,92,246,0.15)'; textColor = Colors.muted; }
                    return (
                      <TouchableOpacity
                        key={cell.key}
                        activeOpacity={0.7}
                        onPress={() => openDayDetail(cell.key)}
                        style={[
                          styles.calCell,
                          { backgroundColor: bg, borderColor: cell.isToday ? '#A78BFA' : borderColor, borderWidth: cell.isToday ? 2 : 1 },
                        ]}
                      >
                        <Text style={[styles.calCellText, { color: cell.isToday ? '#A78BFA' : textColor, fontWeight: cell.isToday || cell.active ? '700' : '500' }]}>
                          {cell.day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Legend */}
                <View style={styles.calLegend}>
                  <View style={styles.calLegendItem}><View style={[styles.calLegendDot, { backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.border }]} /><Text style={styles.calLegendText}>Inactive</Text></View>
                  <View style={styles.calLegendItem}><View style={[styles.calLegendDot, { backgroundColor: 'rgba(124,58,237,0.35)' }]} /><Text style={styles.calLegendText}>Started</Text></View>
                  <View style={styles.calLegendItem}><View style={[styles.calLegendDot, { backgroundColor: '#7C3AED' }]} /><Text style={styles.calLegendText}>Focused</Text></View>
                  <View style={styles.calLegendItem}><View style={[styles.calLegendDot, { backgroundColor: '#A855F7' }]} /><Text style={styles.calLegendText}>On Fire</Text></View>
                </View>
              </View>
            </View>

            {/* Motivation + Next Coding Mission (mirrors desktop) */}
            <View style={styles.motivCard}>
              <View style={styles.motivRow}>
                <Text style={styles.motivIcon}>{motivation.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.motivTitle}>{motivation.title}</Text>
                  <Text style={styles.motivText}>{motivation.text}</Text>
                </View>
              </View>
              {/* This Week progress */}
              <View style={styles.motivWeekBox}>
                <View style={styles.motivWeekHead}>
                  <Text style={styles.motivWeekLabel}>This Week</Text>
                  <Text style={styles.motivWeekVal}>{motivation.thisWeekDays} / 7 days</Text>
                </View>
                <View style={styles.motivBarBg}>
                  <View style={[styles.motivBarFill, { width: `${Math.round((motivation.thisWeekDays / 7) * 100)}%` }]} />
                </View>
              </View>
            </View>

            {/* Next Coding Mission */}
            <View style={styles.missionCard}>
              <Text style={styles.missionLabel}>🎯 NEXT CODING MISSION</Text>
              <Text style={styles.missionSub}>{motivation.missionSub}</Text>
              <Text style={styles.missionText}>{motivation.missionText}</Text>
              <View style={styles.missionBarBg}>
                <View style={[styles.missionBarFill, { width: `${motivation.missionProgress}%` }]} />
              </View>
              <Text style={styles.missionProgressText}>{motivation.thisWeekDays} / {motivation.nextGoal} days this week</Text>
            </View>

            {/* Stats Row */}
            <View style={styles.statsGrid}>
              <TouchableOpacity style={styles.statCard} onPress={() => router.push('/enrolled-courses')}>
                <Text style={styles.statEmoji}>📚</Text>
                <Text style={styles.statValue}>{totalEnrolled}</Text>
                <Text style={styles.statLabel}>Enrolled Courses</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statCard} onPress={() => router.push('/completed-videos')}>
                <Text style={styles.statEmoji}>✅</Text>
                <Text style={styles.statValue}>{totalVideosWatched}</Text>
                <Text style={styles.statLabel}>Video Completed</Text>
              </TouchableOpacity>
              <View style={styles.statCard}>
                <Text style={styles.statEmoji}>⏱</Text>
                <Text style={styles.statValue}>{AttendanceService.formatMins(todayMins)}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statEmoji}>📅</Text>
                <Text style={styles.statValue}>{AttendanceService.formatMins(weekMins)}</Text>
                <Text style={styles.statLabel}>This Week</Text>
              </View>
            </View>

            {/* ═══════════ ACHIEVEMENTS SECTION ═══════════ */}
            <Text style={styles.sectionTitle}>🏆 Recent Achievement</Text>
            {achievementsLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
            ) : achievements.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🏆</Text>
                <Text style={styles.emptyTitle}>No achievements yet</Text>
                <Text style={styles.emptyText}>Complete quizzes to earn badges!</Text>
              </View>
            ) : (
              <>
                {/* 3 Badge Cards */}
                <View style={styles.badgeGrid}>
                  {(['super-master', 'master', 'pro'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.badgeCard,
                        selectedBadgeType === type && styles.badgeCardActive,
                      ]}
                      onPress={() => setSelectedBadgeType(selectedBadgeType === type ? null : type)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.badgeCardEmoji}>{badgeEmoji[type]}</Text>
                      <Text style={styles.badgeCardCount}>{badgeCounts[type]}</Text>
                      <Text style={styles.badgeCardLabel}>{badgeLabel[type]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Show only LAST achievement (most recent) */}
                {!selectedBadgeType && achievements.length > 0 && (
                  <View style={styles.achievementCard}>
                    <View style={styles.achievementInfo}>
                      <Text style={styles.achievementTitle}>{achievements[0].title}</Text>
                      {achievements[0].courseTitle && (
                        <Text style={styles.achievementMeta}>
                          {achievements[0].courseTitle}
                          {achievements[0].lessonTitle ? ` · ${achievements[0].lessonTitle}` : ''}
                        </Text>
                      )}
                      <View style={styles.achievementStatsRow}>
                        {achievements[0].score != null && (
                          <View style={styles.achievementStatBadge}>
                            <Text style={styles.achievementStatText}>Score: {achievements[0].score}</Text>
                          </View>
                        )}
                        {achievements[0].rank != null && (
                          <View style={[styles.achievementStatBadge, { backgroundColor: Colors.warningLight }]}>
                            <Text style={[styles.achievementStatText, { color: Colors.warning }]}>
                              Rank #{achievements[0].rank}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.achievementDate}>
                        {formatDate(achievements[0].earnedAt || achievements[0].createdAt)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Filtered badge details (when badge card tapped) */}
                {selectedBadgeType && (
                  <View style={styles.badgeDetailSection}>
                    <Text style={styles.badgeDetailTitle}>
                      {badgeEmoji[selectedBadgeType]} {badgeLabel[selectedBadgeType]} Badges ({filteredAchievements.length})
                    </Text>
                    {filteredAchievements.length === 0 ? (
                      <Text style={styles.badgeDetailEmpty}>No {badgeLabel[selectedBadgeType]} badges earned yet.</Text>
                    ) : (
                      filteredAchievements.slice(0, 3).map((achievement) => (
                        <View key={achievement.id} style={styles.achievementCard}>
                          <View style={styles.achievementInfo}>
                            <Text style={styles.achievementTitle}>{achievement.title}</Text>
                            {achievement.courseTitle && (
                              <Text style={styles.achievementMeta}>
                                {achievement.courseTitle}
                                {achievement.lessonTitle ? ` · ${achievement.lessonTitle}` : ''}
                              </Text>
                            )}
                            <View style={styles.achievementStatsRow}>
                              {achievement.score != null && (
                                <View style={styles.achievementStatBadge}>
                                  <Text style={styles.achievementStatText}>Score: {achievement.score}</Text>
                                </View>
                              )}
                              {achievement.rank != null && (
                                <View style={[styles.achievementStatBadge, { backgroundColor: Colors.warningLight }]}>
                                  <Text style={[styles.achievementStatText, { color: Colors.warning }]}>
                                    Rank #{achievement.rank}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.achievementDate}>
                              {formatDate(achievement.earnedAt || achievement.createdAt)}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </>
            )}

            {/* ═══════════ WEEKLY STREAK SECTION ═══════════ */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🔥 Weekly Streak</Text>
            {streakLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
            ) : (
              <>
                <View style={styles.streakSummary}>
                  <Text style={styles.streakSummaryEmoji}>🔥</Text>
                  <Text style={styles.streakSummaryValue}>{streakCompletedCount}</Text>
                  <Text style={styles.streakSummaryLabel}>challenges completed</Text>
                </View>

                {streaks.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyEmoji}>⏳</Text>
                    <Text style={styles.emptyText}>No streak challenges yet.</Text>
                  </View>
                ) : (
                  streaks.slice(0, 10).map((streak: any) => (
                    <View key={streak.id} style={styles.streakCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.streakWeek}>Week {streak.weekNumber}</Text>
                        <Text style={styles.streakTitle}>{streak.title}</Text>
                        <Text style={styles.streakCourse}>{streak.courseTitle}</Text>
                      </View>
                      <View
                        style={[
                          styles.streakBadge,
                          {
                            backgroundColor: streak.completed
                              ? Colors.successLight
                              : Colors.warningLight,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.streakBadgeText,
                            { color: streak.completed ? Colors.success : Colors.warning },
                          ]}
                        >
                          {streak.completed ? '✅ PASS' : '⏳ Pending'}
                        </Text>
                      </View>
                    </View>
                  ))
                )}

                {streaks.length > 10 && (
                  <TouchableOpacity style={styles.viewAllBtn} onPress={() => router.push('/streak-history')}>
                    <Text style={styles.viewAllText}>View All ({streaks.length}) →</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* ═══════════ MY COINS SECTION ═══════════ */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>🪙 My Coins</Text>
            {coinsFullLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
            ) : (
              <>
                <View style={styles.coinsSummary}>
                  <Text style={styles.coinsSummaryValue}>{totalCoins}</Text>
                  <Text style={styles.coinsSummaryLabel}>Total Coins Earned</Text>
                  <Text style={styles.coinsFooter}>100+ coins = ₹ discount on next course</Text>
                </View>

                {/* Transactions */}
                <Text style={styles.subsectionTitle}>Recent Rewards</Text>
                {transactions.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No rewards yet. Complete quizzes to earn coins!</Text>
                  </View>
                ) : (
                  transactions.map((tx: any, i: number) => (
                    <View key={i} style={styles.txItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txReason}>{tx.reason}</Text>
                      </View>
                      <Text style={[
                        styles.txCoins,
                        { color: tx.type === 'EARNED' ? Colors.success : Colors.danger },
                      ]}>
                        {tx.type === 'EARNED' ? '+' : '-'}{tx.coins}
                      </Text>
                      <Text style={styles.txTime}>{formatTime(tx.createdAt)}</Text>
                    </View>
                  ))
                )}
              </>
            )}

            {/* ═══════════ COURSE PROGRESS SECTION ═══════════ */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Course Progress</Text>
            {enrolledCourses.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📖</Text>
                <Text style={styles.emptyTitle}>No courses enrolled</Text>
                <Text style={styles.emptyText}>Enroll in a course to see progress here.</Text>
              </View>
            ) : (
              enrolledCourses.map((course) => (
                <View key={course.id} style={styles.courseCard}>
                  <View style={styles.courseHeader}>
                    <Text style={styles.courseTitle} numberOfLines={1}>
                      {course.title}
                    </Text>
                    <Text style={styles.coursePercent}>{course.progressPercent}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${course.progressPercent}%`,
                          backgroundColor:
                            course.progressPercent >= 100
                              ? Colors.success
                              : course.progressPercent >= 50
                              ? Colors.warning
                              : Colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.courseMeta}>
                    {course.completedLessons ?? 0} / {course.totalLessons ?? 0} lessons completed
                  </Text>
                </View>
              ))
            )}

            <View style={{ height: 32 }} />
          </>
        )}
      </ScrollView>

      {/* Day-detail popup (mirrors desktop showDayDetail) */}
      <Modal visible={!!dayDetail} transparent animationType="fade" onRequestClose={() => setDayDetail(null)}>
        <TouchableOpacity style={styles.dayOverlay} activeOpacity={1} onPress={() => setDayDetail(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.dayCard, { borderColor: `${dayDetail?.accent ?? Colors.primary}55` }]}>
            {dayDetail && (
              <>
                <View style={styles.dayHead}>
                  <View style={styles.dayHeadLeft}>
                    <Text style={{ fontSize: 26 }}>{dayDetail.emoji}</Text>
                    <Text style={styles.dayTitle}>{dayDetail.title}</Text>
                  </View>
                  <TouchableOpacity style={styles.dayClose} onPress={() => setDayDetail(null)}>
                    <Text style={styles.dayCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.dayBadge, { color: dayDetail.accent }]}>{dayDetail.badge}</Text>

                {dayDetail.showStats && (
                  <>
                    <View style={styles.dayStatsRow}>
                      <View style={styles.dayStat}>
                        <Text style={styles.dayStatValue}>{AttendanceService.formatMins(dayDetail.mins)}</Text>
                        <Text style={styles.dayStatLabel}>🕒 Learning time</Text>
                      </View>
                      <View style={styles.dayStat}>
                        <Text style={styles.dayStatValue}>{dayDetail.opens}</Text>
                        <Text style={styles.dayStatLabel}>📲 Time{dayDetail.opens === 1 ? '' : 's'} opened</Text>
                      </View>
                    </View>
                    <View style={styles.dayGoalHead}>
                      <Text style={styles.dayGoalLabel}>Daily goal ({DAY_GOAL_MINS} min)</Text>
                      <Text style={[styles.dayGoalPct, { color: dayDetail.accent }]}>{dayDetail.pct}%</Text>
                    </View>
                    <View style={styles.dayGoalTrack}>
                      <View style={[styles.dayGoalFill, { width: `${dayDetail.pct}%` as any, backgroundColor: dayDetail.accent }]} />
                    </View>
                  </>
                )}

                <Text style={styles.dayMessage}>{dayDetail.message}</Text>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { color: Colors.primary, fontSize: 20, fontWeight: '600', paddingRight: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerActionBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  content: { padding: 16 },
  loadingState: { alignItems: 'center', padding: 60, gap: 12 },

  // Motivation + Next Mission
  motivCard: {
    backgroundColor: 'rgba(139,92,246,0.06)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.15)',
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  motivRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  motivIcon: { fontSize: 26 },
  motivTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  motivText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 18 },
  motivWeekBox: { backgroundColor: 'rgba(139,92,246,0.06)', borderRadius: 10, padding: 12 },
  motivWeekHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  motivWeekLabel: { color: Colors.muted, fontSize: 11, fontWeight: '600' },
  motivWeekVal: { color: '#c4b5fd', fontSize: 11, fontWeight: '700' },
  motivBarBg: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' },
  motivBarFill: { height: 5, borderRadius: 10, backgroundColor: '#8b5cf6' },

  missionCard: {
    backgroundColor: 'rgba(251,191,36,0.05)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.15)',
    borderRadius: 14, padding: 16, marginBottom: 24,
  },
  missionLabel: { color: '#fbbf24', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  missionSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 8 },
  missionText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  missionBarBg: { height: 7, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', marginBottom: 5 },
  missionBarFill: { height: 7, borderRadius: 10, backgroundColor: '#fbbf24' },
  missionProgressText: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  loadingText: { color: Colors.muted, fontSize: 14 },

  // Overall Progress
  overallCard: {
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  overallLabel: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  overallRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  progressCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  progressPercent: { color: Colors.primary, fontSize: 18, fontWeight: '800' },
  overallSubtext: { color: Colors.muted, fontSize: 13, marginBottom: 10 },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },

  // KPI cards row (desktop-parity)
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  kpiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: Colors.card2, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  kpiIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  kpiEmoji: { fontSize: 18 },
  kpiBody: { flex: 1 },
  kpiValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  kpiLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '600', marginTop: 1 },
  kpiSub: { color: Colors.muted, fontSize: 10, marginTop: 1 },

  // Calendar
  calendarSection: { marginBottom: 24 },
  calendarTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  calendarMeta: { color: Colors.muted, fontSize: 12, marginBottom: 12 },

  // Monthly calendar (desktop-parity)
  calActiveStrip: {
    alignSelf: 'center', alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.06)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.12)',
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 24, marginBottom: 14, minWidth: 150,
  },
  calActiveValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
  calActiveDenom: { color: Colors.muted, fontSize: 11, fontWeight: '500' },
  calActiveLabel: { color: Colors.muted, fontSize: 11, marginTop: 2 },
  calBox: {
    backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 14,
  },
  calMonthLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textAlign: 'center', marginBottom: 10 },
  calWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calWeekday: { flex: 1, textAlign: 'center', color: '#64748B', fontSize: 10, fontWeight: '600' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100 / 7}%`, aspectRatio: 1, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    // slightly inset so cells breathe like the desktop gap
    borderStyle: 'solid',
  },
  calCellPad: { width: `${100 / 7}%`, aspectRatio: 1 },
  calCellText: { fontSize: 11 },
  calLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 14 },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calLegendDot: { width: 9, height: 9, borderRadius: 3 },
  calLegendText: { color: '#64748B', fontSize: 10 },

  // Day-detail popup
  dayOverlay: { flex: 1, backgroundColor: 'rgba(5,5,15,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dayCard: { width: '100%', maxWidth: 340, backgroundColor: Colors.bg2, borderRadius: 20, padding: 22, borderWidth: 1 },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  dayHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dayTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  dayClose: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  dayCloseText: { color: Colors.muted, fontSize: 14, fontWeight: '700' },
  dayBadge: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  dayStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  dayStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, alignItems: 'center' },
  dayStatValue: { color: '#fff', fontSize: 17, fontWeight: '800' },
  dayStatLabel: { color: Colors.muted, fontSize: 10, marginTop: 3 },
  dayGoalHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  dayGoalLabel: { color: Colors.muted, fontSize: 11, fontWeight: '600' },
  dayGoalPct: { fontSize: 11, fontWeight: '800' },
  dayGoalTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 },
  dayGoalFill: { height: '100%', borderRadius: 10 },
  dayMessage: { color: '#cbd5e1', fontSize: 13, lineHeight: 20 },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card2,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statEmoji: { fontSize: 24, marginBottom: 8 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: Colors.muted, fontSize: 12 },

  // Section titles
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  subsectionTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 12 },

  // Achievements
  badgeGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  badgeCard: {
    flex: 1,
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeCardActive: {
    borderColor: Colors.warning,
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  badgeCardEmoji: { fontSize: 28, marginBottom: 6 },
  badgeCardCount: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 2 },
  badgeCardLabel: { color: Colors.muted, fontSize: 11, fontWeight: '600' },

  badgeDetailSection: { marginBottom: 8 },
  badgeDetailTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  badgeDetailEmpty: { color: Colors.muted, fontSize: 13, marginBottom: 12 },

  achievementCard: {
    backgroundColor: Colors.card2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  achievementInfo: {},
  achievementTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  achievementMeta: { color: Colors.muted, fontSize: 12, marginBottom: 8 },
  achievementStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  achievementStatBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  achievementStatText: { color: Colors.primary, fontSize: 11, fontWeight: '600' },
  achievementDate: { color: Colors.muted, fontSize: 11 },

  // Weekly Streak
  streakSummary: {
    alignItems: 'center',
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  streakSummaryEmoji: { fontSize: 32, marginBottom: 6 },
  streakSummaryValue: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 2 },
  streakSummaryLabel: { fontSize: 13, color: Colors.muted },

  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  streakWeek: { color: Colors.purple, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  streakTitle: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  streakCourse: { color: Colors.muted, fontSize: 11 },
  streakBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  streakBadgeText: { fontSize: 11, fontWeight: '700' },

  viewAllBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  viewAllText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  // Coins
  coinsSummary: {
    alignItems: 'center',
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  coinsSummaryValue: { fontSize: 32, fontWeight: '800', color: '#fbbf24', marginBottom: 4 },
  coinsSummaryLabel: { fontSize: 14, color: Colors.muted, marginBottom: 8 },
  coinsFooter: { fontSize: 12, color: Colors.success, fontWeight: '500' },

  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  txReason: { color: '#fff', fontSize: 13, fontWeight: '500' },
  txCoins: { fontSize: 14, fontWeight: '700' },
  txTime: { color: Colors.muted, fontSize: 11, width: 42 },

  // Course Cards
  courseCard: {
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  courseTitle: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  coursePercent: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  courseMeta: { color: Colors.muted, fontSize: 12, marginTop: 8 },

  // Empty
  emptyState: { alignItems: 'center', padding: 24 },
  emptyEmoji: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emptyText: { color: Colors.muted, fontSize: 13 },
});
