import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '@/api';
import { Colors } from '@/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Back button */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backBtn}>← Back to Login</Text>
          </TouchableOpacity>

          {!sent ? (
            <View style={styles.card}>
              <Text style={styles.title}>🔐 Forgot Password</Text>
              <Text style={styles.subtitle}>
                Enter your registered email address. We'll send you a link to reset your password.
              </Text>

              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.submitText}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.successEmoji}>📧</Text>
              <Text style={styles.successTitle}>Check your email!</Text>
              <Text style={styles.successText}>
                If this email is registered, you will receive a password reset link shortly.
                Check your inbox (and spam folder).
              </Text>
              <Text style={styles.successNote}>
                The link expires in 15 minutes.
              </Text>

              <TouchableOpacity style={styles.backToLoginBtn} onPress={() => router.back()}>
                <Text style={styles.backToLoginText}>← Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, justifyContent: 'center', flexGrow: 1 },
  backRow: { marginBottom: 20 },
  backBtn: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: Colors.card2, borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: Colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 24 },
  label: { color: Colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 14,
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  successEmoji: { fontSize: 48, textAlign: 'center', marginBottom: 16 },
  successTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  successText: { color: Colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 12 },
  successNote: { color: Colors.warning, fontSize: 12, textAlign: 'center', marginBottom: 24 },
  backToLoginBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  backToLoginText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});
