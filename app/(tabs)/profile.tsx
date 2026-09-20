import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useXP, useDashboard, useCoins, useWeeklyStreakCount, useRefreshAll } from '@/hooks';
import { useAuthStore } from '@/store';
import { StorageService, USER_KEY } from '@/services/storage.service';
import { Colors } from '@/theme';
import { apiClient, studentApi, achievementsApi } from '@/api';
import { CoinsModal } from '@/components/common/CoinsModal';
import type { Achievement } from '@/types';

// Subject thumbnail for enrolled-course rows (real desktop images; emoji fallback)
let pImgC: any = null, pImgJava: any = null, pImgPython: any = null, pImgAI: any = null;
try { pImgC = require('../../assets/courses/c.jpeg'); } catch {}
try { pImgJava = require('../../assets/courses/java.jpeg'); } catch {}
try { pImgPython = require('../../assets/courses/python.jpeg'); } catch {}
try { pImgAI = require('../../assets/logos/ai.png'); } catch {}
function courseThumb(title: string): { img: any; icon: string } {
  const t = (title || '').toLowerCase().trim();
  if (t.includes('python')) return { img: pImgPython, icon: '🐍' };
  if (t.includes('java') && !t.includes('javascript')) return { img: pImgJava, icon: '☕' };
  if (t.includes('ai') || t.includes('intelligence')) return { img: pImgAI, icon: '🧠' };
  if (t === 'c' || t.startsWith('c ') || t.includes('c programming')) return { img: pImgC, icon: 'C' };
  if (t.includes('web') || t.includes('html')) return { img: null, icon: '🌐' };
  if (t.includes('scratch') || t.includes('game')) return { img: null, icon: '🎮' };
  return { img: null, icon: '📘' };
}

// Profile-section lavender palette (per provided color spec).
const L = {
  bg: '#F1F0FF',          // Main app background — Very Soft Lavender
  ink: '#151A2E',         // Text — Deep Navy
  sub: '#68718A',         // Secondary text — Muted Blue-Gray
  blue: '#6538FF', blueSoft: '#E3DEFF',   // primary → Bright Purple; soft card → Soft Lavender
  purple: '#6538FF', purpleSoft: '#E3DEFF',
  green: '#22C55E', greenSoft: '#E4F8EC',
  cyan: '#6538FF', amber: '#F5A623', amberSoft: '#FFF3DC', pink: '#F0316E', pinkSoft: '#FCE4EE',
  line: '#E6E3FA',        // soft lavender border
  card: '#F8F7FF',        // Secondary/White cards — Light Lavender-White
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const token = useAuthStore((s) => s.token);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();
  const xp = useXP(); // frontend gamification: level, XP, badges, streak

  // Real backend data for top bar + weekly streak tile
  const { data: coinsData } = useCoins();
  const totalCoins = coinsData?.totalCoins ?? 0;
  const [coinsModalVisible, setCoinsModalVisible] = useState(false);
  const { data: weeklyStreak } = useWeeklyStreakCount();
  const { refreshAll, refreshing, spin } = useRefreshAll();

  // Enrolled courses + achievements for profile preview cards (mirrors desktop)
  const { data: dashData } = useDashboard();
  const enrolledCourses = dashData?.enrolledCourses ?? [];

  // Real profile (for joined date) — GET /api/student returns user.createdAt + enrolledSince
  const { data: profileData } = useQuery({
    queryKey: ['student-profile'],
    queryFn: () => studentApi.getProfile(),
    staleTime: 1000 * 60 * 10,
  });

  // Joined date — real backend value (createdAt / enrolledSince); hidden if unavailable
  const joinedDate = (() => {
    const s: any = profileData?.student;
    const raw = s?.createdAt ?? s?.enrolledSince ?? (user as any)?.createdAt;
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  })();
  const { data: achievementsData } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => achievementsApi.get(),
    staleTime: 1000 * 60 * 5,
  });
  const achievements: Achievement[] = achievementsData?.achievements ?? [];
  const badgeEmojiMap: Record<string, string> = { 'super-master': '🥇', master: '🥈', pro: '🥉' };

  // Pre-fetch data for sub-pages so they open instantly (no loading spinner)
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['student-progress'],
      queryFn: () => apiClient.get('/api/student/progress').then(r => r.data),
      staleTime: 1000 * 60 * 5,
    });
    queryClient.prefetchQuery({
      queryKey: ['my-orders'],
      queryFn: () => apiClient.get('/api/student/orders').then(r => r.data),
      staleTime: 1000 * 60 * 5,
    });
    queryClient.prefetchQuery({
      queryKey: ['mall'],
      queryFn: () => apiClient.get('/api/mall').then(r => r.data),
      staleTime: 1000 * 60 * 2,
    });
    queryClient.prefetchQuery({
      queryKey: ['app-ratings'],
      queryFn: () => apiClient.get('/api/feedback/lesson?lessonId=app_rating').then(r => r.data),
      staleTime: 1000 * 60 * 2,
    });
  }, []);

  // Coins modal state
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);

  // Sync avatarUri whenever user.avatarUrl changes (e.g. after app init fetches fresh presigned URL)
  useEffect(() => {
    if (user?.avatarUrl) {
      setAvatarUri(user.avatarUrl);
    }
  }, [user?.avatarUrl]);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo access to change your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri); // show locally immediately
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('avatar', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
        const res = await apiClient.post<{ success: boolean; avatarUrl: string }>(
          '/api/student/avatar',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        if (res.data?.success) {
          // Fetch fresh presigned URL via GET — raw S3 URL from POST is private
          const avatarRes = await studentApi.getAvatar();
          const freshUrl = avatarRes?.avatarUrl ?? null;
          if (freshUrl) {
            setAvatarUri(freshUrl);
            updateUser({ avatarUrl: freshUrl });
            // Save fresh presigned URL in SecureStore for this session
            const updatedUser = { ...user, avatarUrl: freshUrl };
            await StorageService.setObject(USER_KEY, updatedUser);
          }
        }
      } catch {
        Alert.alert('Upload Failed', 'Could not upload avatar. Please try again.');
        setAvatarUri(user?.avatarUrl ?? null); // revert on failure
      } finally {
        setUploading(false);
      }
    }
  };

  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill all fields.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      await apiClient.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      Alert.alert('Success', 'Password changed successfully!');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to change password.';
      Alert.alert('Error', msg);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleMenuPress = (label: string) => {
    switch (label) {
      // TEMP: design preview — remove after a design is chosen.
      case 'Design Demos':
        router.push('/design-demos' as any);
        break;
      case 'Change Password':
        router.push('/change-password');
        break;
      case 'My Report':
        router.push('/my-report');
        break;
      case 'Student Progress':
        router.push('/student-progress');
        break;
      case 'My Purchases':
        router.push('/my-purchases');
        break;
      case 'CK Mall':
        router.push('/ck-mall');
        break;
      case 'Refer & Earn':
        router.push('/refer-earn');
        break;
      case 'About Us':
        router.push('/about-us');
        break;
      case 'Rate Us':
        router.push('/rate-us');
        break;
      case 'Help & Support':
        router.push('/help-support');
        break;
      default:
        break;
    }
  };

  const menuItems = [
    // TEMP: design preview entry — remove after a design is chosen.
    { emoji: '🎨', label: 'Design Demos', color: Colors.secondary },
    { emoji: '📊', label: 'My Report', color: Colors.primary },
    { emoji: '📈', label: 'Student Progress', color: Colors.success },
    { emoji: '🛒', label: 'My Purchases', color: Colors.warning },
    { emoji: '🏪', label: 'CK Mall', color: Colors.coin },
    { emoji: '🎁', label: 'Refer & Earn', color: Colors.success },
    { emoji: '🔒', label: 'Change Password', color: Colors.purple },
    { emoji: 'ℹ️', label: 'About Us', color: Colors.muted },
    { emoji: '⭐', label: 'Rate Us', color: Colors.warning },
    { emoji: '❤️', label: 'Help & Support', color: Colors.secondary },
  ];

  const initial = user?.name?.charAt(0).toUpperCase() ?? 'U';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

      {/* Top bar — dashboard-consistent (no avatar) */}
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

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Heading + Keep Learning pill */}
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>My Profile</Text>
          </View>
          <View style={styles.klPill}><Text style={styles.klText}>Keep Learning{'\n'}Keep Growing 🚀</Text></View>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} disabled={uploading}>
            <View style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: 64, height: 64, borderRadius: 32 }} />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
              {uploading && (
                <View style={styles.avatarUploadingOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
            </View>
            <View style={styles.cameraBtn}>
              <Text style={{ fontSize: 10 }}>📷</Text>
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>{user?.name ?? '—'}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{user?.email ?? '—'}</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>Pro Member 👑</Text>
            </View>
            <View style={styles.profileBtnRow}>
              <TouchableOpacity style={[styles.editProfileBtn, styles.viewProfileBtn]} onPress={() => router.push({ pathname: '/edit-profile', params: { mode: 'view' } })}>
                <Text style={[styles.editProfileText, styles.viewProfileText]}>👁️ View Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editProfileBtn} onPress={() => router.push('/edit-profile')}>
                <Text style={styles.editProfileText}>✏️ Edit Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Joined box — only when backend provides the date (never fabricated).
              Uses 🎓 (not the 📅 emoji, whose artwork always shows "Jul 17"). */}
          {joinedDate && (
            <View style={styles.joinedBox}>
              <Text style={styles.joinedIcon}>🎓</Text>
              <Text style={styles.joinedLabel}>Joined</Text>
              <Text style={styles.joinedVal}>{joinedDate}</Text>
            </View>
          )}
        </View>

        {/* XP Hero — Level, motivational line, goal pill, progress */}
        <View style={styles.xpHero}>
          <View style={styles.xpTopRow}>
            <View style={styles.xpShield}>
              <Text style={styles.xpShieldNum}>{String(xp.level.level).padStart(2, '0')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.xpLevelTitle}>{xp.level.title}</Text>
              <Text style={styles.xpLevelSub}>Keep learning, you're doing great!</Text>
            </View>
            {xp.level.next && (
              <View style={styles.xpGoal}>
                <Text style={styles.xpGoalText}>🎯 {xp.level.toNext} XP to Level {xp.level.next.level}</Text>
              </View>
            )}
          </View>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${xp.level.progressPct}%` as any }]} />
          </View>
          <View style={styles.xpBarLabels}>
            <Text style={styles.xpBarText}>{xp.level.xp} / {xp.level.next ? xp.level.ceil : xp.level.xp} XP</Text>
            <Text style={styles.xpBarText}>{xp.level.progressPct}%</Text>
          </View>
        </View>

        {/* 3 stat tiles — Learning / Badges / Weekly Streak (real data) */}
        <View style={styles.tilesRow}>
          <View style={[styles.tile, { backgroundColor: L.blueSoft }]}>
            <Text style={styles.tileEmoji}>📘</Text>
            <Text style={[styles.tileVal, { color: L.blue }]}>{enrolledCourses.length}</Text>
            <Text style={styles.tileLabel}>Learning</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: L.amberSoft }]}>
            <Text style={styles.tileEmoji}>🏆</Text>
            {/* Real earned badges from the backend achievements (same source as
                the Achievements section below), not the local XP gamification. */}
            <Text style={[styles.tileVal, { color: L.amber }]}>{achievements.length}</Text>
            <Text style={styles.tileLabel}>Badges</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: L.pinkSoft }]}>
            <Text style={styles.tileEmoji}>🔥</Text>
            <Text style={[styles.tileVal, { color: L.pink }]}>{weeklyStreak ?? 0}</Text>
            <Text style={styles.tileLabel}>Weekly Streak</Text>
          </View>
        </View>

        {/* Enrolled Courses preview (mirrors desktop) */}
        <View style={styles.previewCard}>
          <View style={styles.previewHead}>
            <Text style={styles.previewTitle}>📚 Enrolled Courses</Text>
            <TouchableOpacity onPress={() => router.push('/enrolled-courses')}>
              <Text style={styles.previewViewAll}>View All →</Text>
            </TouchableOpacity>
          </View>
          {enrolledCourses.length === 0 ? (
            <Text style={styles.previewEmpty}>No courses yet.</Text>
          ) : (
            enrolledCourses.slice(0, 3).map((c: any) => {
              const th = courseThumb(c.title || '');
              return (
                <TouchableOpacity key={c.id} style={styles.previewCourseRow} onPress={() => router.push(`/course/${c.id}`)}>
                  <View style={styles.previewCourseIcon}>
                    {th.img ? <Image source={th.img} style={styles.previewCourseIconImg} resizeMode="cover" /> : <Text style={styles.previewCourseIconTxt}>{th.icon}</Text>}
                  </View>
                  <View style={styles.previewCourseInfo}>
                    <Text style={styles.previewCourseTitle} numberOfLines={1}>{c.title}</Text>
                    <View style={styles.previewBarBg}>
                      <View style={[styles.previewBarFill, { width: `${c.progressPercent ?? 0}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.previewCoursePct}>{c.progressPercent ?? 0}%</Text>
                  <Text style={styles.previewChevron}>›</Text>
                </TouchableOpacity>
              );
            })
          )}
          <TouchableOpacity style={styles.browseMore} onPress={() => router.push('/(tabs)/courses')}>
            <Text style={styles.browseMoreText}>+ Browse More Courses</Text>
          </TouchableOpacity>
        </View>

        {/* Achievements preview (mirrors desktop) */}
        <View style={styles.previewCard}>
          <View style={styles.previewHead}>
            <Text style={styles.previewTitle}>🏆 Achievements</Text>
            <TouchableOpacity onPress={() => router.push('/achievements')}>
              <Text style={[styles.previewViewAll, { color: Colors.warning }]}>View All →</Text>
            </TouchableOpacity>
          </View>
          {achievements.length === 0 ? (
            <Text style={styles.previewEmpty}>No achievements yet. Complete quizzes to earn badges!</Text>
          ) : (
            <View style={styles.medalRow}>
              {achievements.slice(0, 3).map((a) => {
                const medalBg = a.badgeType === 'super-master' ? '#FFF6DC' : a.badgeType === 'master' ? '#EEF1F5' : '#FBEFE0';
                const dateStr = (a.earnedAt || a.createdAt)
                  ? new Date(a.earnedAt || a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '';
                return (
                  <View key={a.id} style={[styles.medal, { backgroundColor: medalBg }]}>
                    <Text style={styles.medalEmoji}>{badgeEmojiMap[a.badgeType] || '🏅'}</Text>
                    <Text style={styles.medalTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={styles.medalMeta} numberOfLines={1}>{a.courseTitle || ''}</Text>
                    {dateStr ? <Text style={styles.medalDate}>{dateStr}</Text> : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <View key={item.label}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuPress(item.label)}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: `${item.color}20` }]}>
                  <Text style={styles.menuEmoji}>{item.emoji}</Text>
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuArrow}>
                  {item.label === 'Change Password' && showChangePassword ? '⌄' : '›'}
                </Text>
              </TouchableOpacity>

              {/* Expandable Change Password Form */}
              {item.label === 'Change Password' && showChangePassword && (
                <View style={styles.changePasswordForm}>
                  <TextInput
                    style={styles.pwInput}
                    placeholder="Current Password"
                    placeholderTextColor={Colors.muted}
                    secureTextEntry
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                  />
                  <TextInput
                    style={styles.pwInput}
                    placeholder="New Password"
                    placeholderTextColor={Colors.muted}
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <TextInput
                    style={styles.pwInput}
                    placeholder="Confirm New Password"
                    placeholderTextColor={Colors.muted}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity
                    style={styles.pwSubmitBtn}
                    onPress={handleChangePassword}
                    disabled={changingPassword}
                  >
                    {changingPassword ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.pwSubmitText}>Update Password</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutEmoji}>🚪</Text>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
      </KeyboardAvoidingView>

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

  // Heading + keep-learning pill
  headRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 10 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: L.ink },
  pageSubtitle: { fontSize: 12, color: L.sub, fontWeight: '500', marginTop: 3, lineHeight: 17 },
  klPill: { backgroundColor: L.purpleSoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  klText: { color: L.purple, fontSize: 10.5, fontWeight: '800', textAlign: 'center', lineHeight: 14 },

  // Profile card
  profileCard: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: '#E3DEFF',
    borderRadius: 18, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: L.line,
    shadowColor: L.blue, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2,
  },
  profileGradientBg: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: '30%',
    backgroundColor: L.blueSoft,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: L.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#fff' },
  joinedBox: { backgroundColor: L.purpleSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  joinedIcon: { fontSize: 15 },
  joinedLabel: { color: L.sub, fontSize: 9, fontWeight: '700', marginTop: 2 },
  joinedVal: { color: L.purple, fontSize: 11, fontWeight: '900' },
  avatarUploadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBtn: {
    position: 'absolute', bottom: -4, right: -4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: L.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: L.line,
  },
  profileName: { fontSize: 20, fontWeight: '800', color: L.ink, marginBottom: 4 },
  profileEmail: { color: L.sub, fontSize: 13, marginBottom: 6 },
  proBadge: {
    alignSelf: 'flex-start',
    backgroundColor: L.amberSoft, borderWidth: 1, borderColor: '#F3D9A8',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8,
  },
  proBadgeText: { color: '#9A6B00', fontSize: 11, fontWeight: '700' },
  editProfileBtn: {
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 50,
    backgroundColor: L.blueSoft,
    borderWidth: 1, borderColor: L.blue,
  },
  editProfileText: { fontSize: 11, fontWeight: '700', color: L.blue },
  viewProfileBtn: {
    backgroundColor: '#EEF0F5',
    borderColor: L.line,
  },
  viewProfileText: { color: L.sub },
  profileBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },

  // XP Hero
  xpHero: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#DDD7FF', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: L.line,
    shadowColor: L.blue, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2,
  },
  xpTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  xpShield: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: L.purpleSoft,
    borderWidth: 1, borderColor: '#D8CCFF',
    alignItems: 'center', justifyContent: 'center',
  },
  xpShieldNum: { color: L.purple, fontSize: 19, fontWeight: '900' },
  xpLevelTitle: { color: L.ink, fontSize: 15, fontWeight: '900' },
  xpLevelSub: { color: L.sub, fontSize: 11, fontWeight: '500', marginTop: 2 },
  xpGoal: { backgroundColor: L.pinkSoft, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, maxWidth: 96 },
  xpGoalText: { color: L.pink, fontSize: 9.5, fontWeight: '800' },
  // 3 stat tiles
  tilesRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  tile: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  tileEmoji: { fontSize: 16 },
  tileVal: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  tileLabel: { color: L.sub, fontSize: 9.5, fontWeight: '700', marginTop: 1 },
  xpBarBg: { height: 8, backgroundColor: '#ECECF2', borderRadius: 50, overflow: 'hidden', marginBottom: 5 },
  xpBarFill: { height: '100%', backgroundColor: L.purple, borderRadius: 50 },
  xpBarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  xpBarText: { color: L.sub, fontSize: 10, fontWeight: '600' },
  xpStatsRow: { flexDirection: 'row', gap: 12 },
  xpStatBox: {
    flex: 1, backgroundColor: '#F6F8FC', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: L.line,
  },
  xpStatValue: { color: L.amber, fontSize: 22, fontWeight: '800' },
  xpStatLabel: { color: L.sub, fontSize: 10, fontWeight: '600', marginTop: 2, marginBottom: 8 },
  xpLearnSub: { color: L.sub, fontSize: 9, marginTop: -6, marginBottom: 8 },
  xpPipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  xpPip: { fontSize: 12 },
  xpPipOff: { opacity: 0.35 },
  xpSpip: {
    width: 12, height: 6, borderRadius: 3,
    backgroundColor: '#ECECF2',
  },
  xpSpipOn: { backgroundColor: L.pink },

  // Preview cards (Enrolled Courses + Achievements)
  previewCard: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: '#E7E3FB', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#DAD3F5',
    shadowColor: L.blue, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2,
  },
  previewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  previewTitle: { color: L.ink, fontSize: 14, fontWeight: '700' },
  previewViewAll: { color: L.purple, fontSize: 12, fontWeight: '600' },
  previewEmpty: { color: L.sub, fontSize: 12, paddingVertical: 8 },
  previewCourseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  previewCourseIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: L.blueSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewCourseIconImg: { width: '100%', height: '100%' },
  previewCourseIconTxt: { fontSize: 18, fontWeight: '900', color: L.blue },
  previewCourseInfo: { flex: 1, minWidth: 0 },
  previewCourseTitle: { color: L.ink, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  previewBarBg: { height: 6, borderRadius: 4, backgroundColor: '#ECECF2', overflow: 'hidden' },
  previewBarFill: { height: 6, borderRadius: 4, backgroundColor: L.blue },
  previewCoursePct: { color: L.blue, fontSize: 12.5, fontWeight: '800', width: 38, textAlign: 'right' },
  previewChevron: { color: L.sub, fontSize: 18, fontWeight: '300' },
  // Achievements medals
  medalRow: { flexDirection: 'row', gap: 8 },
  medal: { flex: 1, borderRadius: 14, padding: 10, alignItems: 'center' },
  medalEmoji: { fontSize: 26, marginBottom: 4 },
  medalTitle: { color: L.ink, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  medalMeta: { color: L.sub, fontSize: 9, fontWeight: '600', textAlign: 'center', marginTop: 1 },
  medalDate: { color: L.sub, fontSize: 8.5, fontWeight: '500', marginTop: 3 },
  browseMore: {
    marginTop: 10, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    backgroundColor: L.purpleSoft, borderWidth: 1, borderColor: '#D8CCFF', borderStyle: 'dashed',
  },
  browseMoreText: { color: L.purple, fontSize: 12, fontWeight: '600' },
  achRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  achEmoji: { fontSize: 22 },
  achTitle: { color: L.ink, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  achMeta: { color: L.sub, fontSize: 11 },

  // Menu
  menuSection: { paddingHorizontal: 16, gap: 8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#E7E3FB',
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#DAD3F5',
  },
  menuIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  menuEmoji: { fontSize: 18 },
  menuLabel: { flex: 1, color: L.ink, fontSize: 14, fontWeight: '600' },
  menuArrow: { color: L.sub, fontSize: 20 },

  // Change Password form
  changePasswordForm: {
    backgroundColor: L.card,
    borderRadius: 14, padding: 16, marginTop: 4,
    borderWidth: 1, borderColor: L.line,
    gap: 12,
  },
  pwInput: {
    backgroundColor: '#F3F4F8',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: L.ink, fontSize: 14,
    borderWidth: 1, borderColor: L.line,
  },
  pwSubmitBtn: {
    backgroundColor: L.blue,
    borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  pwSubmitText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: L.pinkSoft,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#F8D3DF',
  },
  logoutEmoji: { fontSize: 18 },
  logoutText: { color: L.pink, fontSize: 14, fontWeight: '700' },
});
