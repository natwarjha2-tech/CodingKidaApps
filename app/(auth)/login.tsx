import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, Image,
  Keyboard, Platform,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks';
import { authApi } from '@/api';
import { Colors } from '@/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { login, loginWithOtp, isLoading } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  // OTP (passwordless) login flow
  const [otpMode, setOtpMode] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'verify'>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpMsg, setOtpMsg] = useState<{ text: string; success: boolean } | null>(null);

  const resetOtp = () => {
    setOtpStep('email');
    setOtpEmail('');
    setOtpCode('');
    setOtpMsg(null);
    setOtpBusy(false);
  };

  const handleSendOtp = async () => {
    const em = otpEmail.trim();
    if (!em || !em.includes('@')) {
      setOtpMsg({ text: 'Please enter a valid email address.', success: false });
      return;
    }
    setOtpBusy(true);
    setOtpMsg(null);
    try {
      const data = await authApi.sendOtp(em);
      if (data.success) {
        setOtpStep('verify');
        setOtpMsg({ text: `OTP sent to ${em}. Check your inbox.`, success: true });
      } else {
        setOtpMsg({ text: data.message || 'Failed to send OTP.', success: false });
      }
    } catch {
      setOtpMsg({ text: 'Network error. Please check your connection.', success: false });
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setOtpMsg({ text: 'Please enter the 6-digit OTP.', success: false });
      return;
    }
    setOtpBusy(true);
    setOtpMsg(null);
    try {
      await loginWithOtp(otpEmail.trim(), otpCode.trim(), true);
    } catch (err: any) {
      setOtpMsg({ text: err?.message || 'Invalid OTP.', success: false });
      setOtpBusy(false);
    }
  };

  // Listen for keyboard show/hide to add bottom padding
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      // Auto scroll to bottom so all form content is visible
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    try {
      await login({ email: email.trim(), password: password.trim() }, rememberMe);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message ?? 'Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.blob1} />
      <View style={styles.blob2} />
      <View style={styles.blob3} />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.content}>
            {/* Logo */}
            <View style={styles.logoRow}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Welcome Back heading */}
            <View style={styles.heroRow}>
              <Text style={styles.heroTitle}>
                Welcome <Text style={styles.heroAccent}>Back!</Text>
              </Text>
            </View>

            {/* Subtitle with dot decorators */}
            <View style={styles.subtitleRow}>
              <View style={styles.subtitleDot} />
              <Text style={styles.subtitleText}>Continue your coding journey</Text>
              <View style={styles.subtitleDot} />
            </View>

            {/* Login Card */}
            <View style={styles.card}>
              {!otpMode ? (
                <>
                  {/* Email */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Email</Text>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputIcon}>✉️</Text>
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
                    <Text style={styles.label}>Password</Text>
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
                        <Text style={{ fontSize: 16 }}>{showPassword ? '🙈' : '👁️'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Remember Me */}
                  <TouchableOpacity
                    style={styles.rememberRow}
                    onPress={() => setRememberMe(!rememberMe)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                      {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.rememberText}>Remember me for 30 days</Text>
                  </TouchableOpacity>

                  {/* Login Button */}
                  <TouchableOpacity
                    style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
                    onPress={handleLogin}
                    disabled={isLoading}
                  >
                    <Text style={styles.loginBtnText}>
                      {isLoading ? '⏳ Logging in...' : 'Log In  →'}
                    </Text>
                  </TouchableOpacity>

                  {/* Login with OTP */}
                  <TouchableOpacity onPress={() => { setOtpMode(true); resetOtp(); }} style={styles.otpToggleRow}>
                    <Text style={styles.otpToggleText}>📧 Log in with Email OTP</Text>
                  </TouchableOpacity>

                  {/* Forgot Password */}
                  <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotRow}>
                    <Text style={styles.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* OTP Email */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Email</Text>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputIcon}>✉️</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="you@example.com"
                        placeholderTextColor="#64748b"
                        value={otpEmail}
                        onChangeText={setOtpEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={otpStep === 'email'}
                      />
                    </View>
                  </View>

                  {/* OTP Code (step 2) */}
                  {otpStep === 'verify' && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Enter 6-digit OTP</Text>
                      <View style={styles.inputWrapper}>
                        <Text style={styles.inputIcon}>🔢</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="••••••"
                          placeholderTextColor="#64748b"
                          value={otpCode}
                          onChangeText={(t) => setOtpCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                          keyboardType="number-pad"
                          maxLength={6}
                        />
                      </View>
                    </View>
                  )}

                  {/* OTP message */}
                  {otpMsg && (
                    <Text style={[styles.otpMsg, { color: otpMsg.success ? Colors.success : Colors.danger }]}>
                      {otpMsg.text}
                    </Text>
                  )}

                  {/* Action button: Send OTP / Verify */}
                  <TouchableOpacity
                    style={[styles.loginBtn, (otpBusy || isLoading) && styles.loginBtnDisabled]}
                    onPress={otpStep === 'email' ? handleSendOtp : handleVerifyOtp}
                    disabled={otpBusy || isLoading}
                  >
                    <Text style={styles.loginBtnText}>
                      {otpStep === 'email'
                        ? (otpBusy ? '⏳ Sending OTP...' : '📧 Send OTP')
                        : ((otpBusy || isLoading) ? '⏳ Verifying...' : '✓ Verify OTP')}
                    </Text>
                  </TouchableOpacity>

                  {/* Cancel — back to password login */}
                  <TouchableOpacity onPress={() => { setOtpMode(false); resetOtp(); }} style={styles.forgotRow}>
                    <Text style={styles.forgotText}>Cancel — use password login instead</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Sign up link */}
            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <Link href="/(auth)/signup">
                <Text style={styles.signupLink}>Sign Up</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0b1e' },
  blob1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: '#3730a3', top: -100, left: -80, opacity: 0.35 },
  blob2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: '#4338ca', bottom: -80, right: -50, opacity: 0.3 },
  blob3: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#6366f1', top: '40%', right: -60, opacity: 0.2 },
  content: { padding: 20 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },

  logoRow: { alignItems: 'center', marginBottom: 20 },
  logoImage: { width: 120, height: 120, borderRadius: 60 },

  heroRow: { alignItems: 'center', marginBottom: 8 },
  heroTitle: { fontSize: 30, fontWeight: '800', color: '#fff' },
  heroAccent: { color: '#7c3aed', fontWeight: '800' },

  subtitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 8 },
  subtitleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7c3aed' },
  subtitleText: { color: '#94a3b8', fontSize: 14 },

  card: {
    backgroundColor: '#1a1830', borderRadius: 16,
    padding: 24, marginBottom: 20,
  },

  formGroup: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '700', color: '#e2e8f0', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10, overflow: 'hidden',
  },
  inputIcon: { paddingHorizontal: 12, fontSize: 15 },
  input: { flex: 1, paddingVertical: 13, paddingRight: 12, color: '#fff', fontSize: 14 },
  eyeBtn: { padding: 12 },

  rememberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#7c3aed' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rememberText: { color: '#94a3b8', fontSize: 13 },

  loginBtn: {
    backgroundColor: '#7c3aed', borderRadius: 10,
    paddingVertical: 15, alignItems: 'center', marginTop: 4,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  forgotRow: { alignItems: 'center', marginTop: 14 },
  forgotText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  otpToggleRow: { alignItems: 'center', marginTop: 14 },
  otpToggleText: { color: '#a78bfa', fontSize: 13, fontWeight: '700' },
  otpMsg: { fontSize: 12, fontWeight: '600', marginBottom: 12, textAlign: 'center' },

  signupRow: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 16 },
  signupText: { color: '#94a3b8', fontSize: 13 },
  signupLink: { color: '#6366f1', fontSize: 13, fontWeight: '600' },
});
