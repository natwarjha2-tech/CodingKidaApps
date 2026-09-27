import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
  Keyboard, Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks';
import { Colors } from '@/theme';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { signup, isLoading } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

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

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    try {
      await signup({ name: name.trim(), email: email.trim(), password: password.trim() });
    } catch (err: any) {
      Alert.alert('Signup Failed', err.message ?? 'Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      {/* Background blobs */}
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />
      <View style={[styles.blob, styles.blob3]} />

      {/* Corner brackets */}
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoIconText}>🖥</Text>
            </View>
            <Text style={styles.logoText}>
              Coding<Text style={styles.logoAccent}>Kida</Text>
            </Text>
          </View>

          <Text style={styles.heroTitle}>
            Join the coding{'\n'}
            <Text style={styles.heroHighlight}>revolution</Text>
          </Text>
          <Text style={styles.heroDesc}>
            50,000+ students are already learning. Start your journey today — free!
          </Text>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create Account</Text>
            <Text style={styles.cardSubtitle}>Join CodingKida today — it's free</Text>

            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your full name"
                  placeholderTextColor="#64748b"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

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
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  placeholder="Min. 8 characters"
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

            {/* Signup Button */}
            <TouchableOpacity
              style={[styles.signupBtn, isLoading && styles.btnDisabled]}
              onPress={handleSignup}
              disabled={isLoading}
            >
              <Text style={styles.signupBtnText}>
                {isLoading ? '⏳ Creating account...' : '→  Create Free Account'}
              </Text>
            </TouchableOpacity>

            {/* Trust bar */}
            <View style={styles.trustBar}>
              <Text style={styles.trustItem}>🔒 Secure</Text>
              <Text style={styles.trustItem}>🆓 Free Forever</Text>
              <Text style={styles.trustItem}>🎓 Certified</Text>
            </View>
          </View>

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Link href="/(auth)/login">
              <Text style={styles.loginLink}>Log In</Text>
            </Link>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0b1e' },
  blob: { position: 'absolute', borderRadius: 999 },
  blob1: { width: 300, height: 300, backgroundColor: '#3730a3', top: -100, left: -80, opacity: 0.35 },
  blob2: { width: 250, height: 250, backgroundColor: '#4338ca', bottom: -80, right: -40, opacity: 0.35 },
  blob3: { width: 200, height: 200, backgroundColor: '#6366f1', top: '40%', right: -60, opacity: 0.25 },
  corner: { position: 'absolute', width: 32, height: 32, opacity: 0.3 },
  cornerTL: { top: 16, left: 16, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: Colors.secondary },
  cornerTR: { top: 16, right: 16, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: Colors.secondary },
  cornerBL: { bottom: 16, left: 16, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: Colors.secondary },
  cornerBR: { bottom: 16, right: 16, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: Colors.secondary },
  scroll: { padding: 24, paddingTop: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoIconText: { fontSize: 22 },
  logoText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  logoAccent: { color: Colors.secondary },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#fff', lineHeight: 40, marginBottom: 12 },
  heroHighlight: { color: Colors.secondary },
  heroDesc: { fontSize: 14, color: '#94a3b8', lineHeight: 22, marginBottom: 28 },
  card: { backgroundColor: '#1a1830', borderRadius: 16, padding: 28, marginBottom: 20 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 6 },
  cardSubtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 24 },
  formGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#e2e8f0', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10, overflow: 'hidden',
  },
  inputIcon: { paddingHorizontal: 12, fontSize: 15 },
  input: { flex: 1, paddingVertical: 13, paddingRight: 12, color: '#fff', fontSize: 14 },
  eyeBtn: { padding: 12 },
  signupBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  signupBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  trustBar: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 20 },
  trustItem: { fontSize: 11, color: '#64748b' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 16 },
  loginText: { color: '#94a3b8', fontSize: 13 },
  loginLink: { color: Colors.secondary, fontSize: 13, fontWeight: '600' },
});
