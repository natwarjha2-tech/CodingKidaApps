import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, Alert, Dimensions, Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks';
import { Colors } from '@/theme';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    try {
      await login({ email: email.trim(), password: password.trim() });
    } catch (err: any) {
      Alert.alert('Login Failed', err.message ?? 'Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      {/* Background blobs */}
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />
      <View style={[styles.blob, styles.blob3]} />

      {/* Grid overlay */}
      <View style={styles.gridOverlay} />

      {/* Corner brackets */}
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={styles.logoRow}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Hero text */}
            <Text style={styles.heroTitle}>
              Start your coding{'\n'}
              <Text style={styles.heroHighlight}>journey</Text>
            </Text>
            <Text style={styles.heroDesc}>
              India's most engaging coding platform — real projects, expert mentors, and a community that grows with you.
            </Text>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <Text style={styles.statText}>50K+ Students</Text>
              <View style={styles.statDivider} />
              <Text style={styles.statText}>200+ Courses</Text>
              <View style={styles.statDivider} />
              <Text style={styles.statText}>4.8★ Rating</Text>
            </View>

            {/* Login Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Welcome back</Text>
              <Text style={styles.cardSubtitle}>Log in to continue learning</Text>

              {/* Email */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>✉</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor="#64748b"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Password</Text>
                  <TouchableOpacity>
                    <Text style={styles.forgotLink}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={[styles.input, { paddingRight: 48 }]}
                    placeholder="••••••••"
                    placeholderTextColor="#64748b"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={{ fontSize: 16 }}>{showPassword ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remember me */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Remember me for 30 days</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                <Text style={styles.loginBtnText}>
                  {isLoading ? '⏳ Logging in...' : '→  Log In'}
                </Text>
              </TouchableOpacity>

              {/* Forgot Password */}
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotRow}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* Trust bar */}
              <View style={styles.trustBar}>
                <Text style={styles.trustItem}>🔒 Secure</Text>
                <Text style={styles.trustItem}>🔐 Encrypted</Text>
                <Text style={styles.trustItem}>👤 50K+ Users</Text>
              </View>
            </View>

            {/* Sign up link */}
            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <Link href="/(auth)/signup">
                <Text style={styles.signupLink}>Sign Up</Text>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0b1e' },

  // Background blobs
  blob: { position: 'absolute', borderRadius: 999 },
  blob1: { width: 300, height: 300, backgroundColor: '#3730a3', top: -100, left: -80, opacity: 0.35 },
  blob2: { width: 250, height: 250, backgroundColor: '#4338ca', bottom: -80, right: -40, opacity: 0.35 },
  blob3: { width: 200, height: 200, backgroundColor: '#6366f1', top: '40%', right: -60, opacity: 0.25 },

  // Grid
  gridOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.07,
  },

  // Corners
  corner: { position: 'absolute', width: 32, height: 32, opacity: 0.3 },
  cornerTL: { top: 16, left: 16, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: '#6366f1' },
  cornerTR: { top: 16, right: 16, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: '#6366f1' },
  cornerBL: { bottom: 16, left: 16, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: '#6366f1' },
  cornerBR: { bottom: 16, right: 16, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: '#6366f1' },

  scroll: { padding: 24, paddingTop: 12 },

  // Logo
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  logoImage: { width: 80, height: 80, borderRadius: 40 },

  // Hero
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#fff', lineHeight: 40, marginBottom: 12 },
  heroHighlight: { color: '#6366f1' },
  heroDesc: { fontSize: 14, color: '#94a3b8', lineHeight: 22, marginBottom: 20 },

  // Stats
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  statText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  statDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 12 },

  // Card
  card: {
    backgroundColor: '#1a1830', borderRadius: 16,
    padding: 28, marginBottom: 20,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 6 },
  cardSubtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 24 },

  // Form
  formGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#e2e8f0', marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  forgotLink: { fontSize: 12, color: '#6366f1', fontWeight: '500' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10, overflow: 'hidden',
  },
  inputIcon: { paddingHorizontal: 12, fontSize: 15 },
  input: {
    flex: 1, paddingVertical: 13, paddingRight: 12,
    color: '#fff', fontSize: 14,
  },
  eyeBtn: { padding: 12 },

  // Checkbox
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#6d28d9', borderColor: '#6d28d9' },
  checkmark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  checkboxLabel: { fontSize: 12, color: '#94a3b8' },

  // Login button
  loginBtn: {
    backgroundColor: '#6d28d9', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Trust bar
  trustBar: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 16, marginTop: 20,
  },
  trustItem: { fontSize: 11, color: '#64748b' },

  // Signup row
  signupRow: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 16 },
  signupText: { color: '#94a3b8', fontSize: 13 },
  signupLink: { color: '#6366f1', fontSize: 13, fontWeight: '600' },

  // Forgot password
  forgotRow: { alignItems: 'center', marginTop: 12 },
  forgotText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});
