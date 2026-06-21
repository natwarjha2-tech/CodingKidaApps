import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView,
  Platform, Alert, Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks';
import { Colors } from '@/theme';

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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
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

            {/* Welcome Back heading — matches image exactly */}
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

              {/* Forgot Password */}
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotRow}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign up link */}
            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <Link href="/(auth)/signup">
                <Text style={styles.signupLink}>Sign Up</Text>
              </Link>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0b1e' },
  blob1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: '#3730a3', top: -100, left: -80, opacity: 0.35 },
  blob2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: '#4338ca', bottom: -80, right: -50, opacity: 0.3 },
  blob3: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#6366f1', top: '40%', right: -60, opacity: 0.2 },
  content: { flex: 1, justifyContent: 'center', padding: 20 },

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

  signupRow: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 16 },
  signupText: { color: '#94a3b8', fontSize: 13 },
  signupLink: { color: '#6366f1', fontSize: 13, fontWeight: '600' },
});
