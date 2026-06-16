import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/hooks';
import { useAuthStore } from '@/store';
import { CoinsModal } from '@/components/common/CoinsModal';
import { Colors } from '@/theme';
import { apiClient } from '@/api';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const token = useAuthStore((s) => s.token);

  // Coins modal state
  const [coinsModalVisible, setCoinsModalVisible] = useState(false);

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
      case 'My Coins':
        setCoinsModalVisible(true);
        break;
      case 'Change Password':
        router.push('/change-password');
        break;
      case 'My Report':
        router.push('/my-report');
        break;
      case 'Achievements':
        router.push('/achievements');
        break;
      case 'Weekly Streak':
        router.push('/streak-history');
        break;
      case 'Refer & Earn':
        router.push('/refer-earn');
        break;
      case 'Help & Support':
        router.push('/help-support');
        break;
      default:
        break;
    }
  };

  const menuItems = [
    { emoji: '📊', label: 'My Report', color: Colors.primary },
    { emoji: '🏆', label: 'Achievements', color: Colors.warning },
    { emoji: '🔥', label: 'Weekly Streak', color: Colors.danger },
    { emoji: '🪙', label: 'My Coins', color: '#fbbf24' },
    { emoji: '🎁', label: 'Refer & Earn', color: Colors.success },
    { emoji: '🔒', label: 'Change Password', color: Colors.purple },
    { emoji: '❤️', label: 'Help & Support', color: Colors.secondary },
  ];

  const initial = user?.name?.charAt(0).toUpperCase() ?? 'U';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Page Header — exact desktop gradient style */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>My Profile</Text>
          <Text style={styles.pageSubtitle}>Manage your account, track progress, and view achievements.</Text>
        </View>

        {/* Profile Card — exact desktop style */}
        <View style={styles.profileCard}>
          <View style={styles.profileGradientBg} />
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.cameraBtn}>
              <Text style={{ fontSize: 10 }}>📷</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name ?? '—'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? '—'}</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>Pro Member 👑</Text>
            </View>
          </View>
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

      {/* Coins Modal */}
      <CoinsModal visible={coinsModalVisible} onClose={() => setCoinsModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Page header — exact desktop gradient header
  pageHeader: {
    margin: 16, borderRadius: 16, padding: 24,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 6 },
  pageSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },

  // Profile card
  profileCard: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: Colors.card,
    borderRadius: 16, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 20,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', position: 'relative',
  },
  profileGradientBg: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: '30%',
    backgroundColor: 'rgba(108,71,255,0.1)',
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(108,71,255,0.4)',
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  cameraBtn: {
    position: 'absolute', bottom: -4, right: -4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bg2,
  },
  profileName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  profileEmail: { color: Colors.muted, fontSize: 13, marginBottom: 10 },
  proBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 50,
    backgroundColor: 'rgba(245,158,11,0.2)',
  },
  proBadgeText: { fontSize: 11, fontWeight: '700', color: '#f59e0b' },

  // Menu
  menuSection: { paddingHorizontal: 16, gap: 8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  menuIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  menuEmoji: { fontSize: 18 },
  menuLabel: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  menuArrow: { color: Colors.muted, fontSize: 20 },

  // Change Password form
  changePasswordForm: {
    backgroundColor: Colors.card,
    borderRadius: 14, padding: 16, marginTop: 4,
    borderWidth: 1, borderColor: Colors.border,
    gap: 12,
  },
  pwInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  pwSubmitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  pwSubmitText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  logoutEmoji: { fontSize: 18 },
  logoutText: { color: Colors.danger, fontSize: 14, fontWeight: '700' },
});
