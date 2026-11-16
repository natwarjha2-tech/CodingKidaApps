import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/api';
import { useAuth } from '@/hooks';
import { Colors } from '@/theme';

/**
 * Delete account (required by Google Play and the App Store): explain what
 * happens → type DELETE → confirm with a code sent to the account email →
 * signed out; the account is deleted after 30 days unless the student signs in.
 */
export default function DeleteAccountScreen() {
  const { logout } = useAuth();
  const [step, setStep] = useState<'intro' | 'code'>('intro');
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setBusy(true);
    try {
      const r = await apiClient.post<{ sentTo: string }>('/api/account/delete/send-code', {});
      setSentTo(r.data.sentTo || 'your email');
      setStep('code');
    } catch (err: any) {
      Alert.alert('Could not send the code', err?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      'You will be signed out of all devices. Your account is deleted permanently after 30 days unless you sign in again before then.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const r = await apiClient.post<{ scheduledFor: string }>('/api/account/delete', {
                code: code.trim(), reason, channel: 'app',
              });
              const when = r.data.scheduledFor
                ? new Date(r.data.scheduledFor).toLocaleDateString('en-IN', { dateStyle: 'long' })
                : 'in 30 days';
              Alert.alert('Account deletion scheduled', `Your account will be deleted on ${when}. Sign in again before then to keep it.`);
              await logout();
            } catch (err: any) {
              Alert.alert('Could not delete', err?.message || 'Please try again.');
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚠️ Before you delete your account</Text>
            <Text style={styles.point}>• You are signed out of all your devices straight away.</Text>
            <Text style={styles.point}>• Your account is permanently deleted after 30 days. Sign in again before then to restore it.</Text>
            <Text style={styles.point}>• We delete your profile, email, phone, parent details, photo, notifications, chat messages and saved code.</Text>
            <Text style={styles.point}>• Your progress, coins, badges, certificates and purchased courses can't be recovered. Purchases are not refunded.</Text>
            <Text style={styles.point}>• Payment records are kept only where the law requires, without your name or email.</Text>

            {step === 'intro' ? (
              <>
                <Text style={styles.label}>Why are you leaving? (optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                  multiline
                  maxLength={500}
                  placeholder="Tell us what we could do better"
                  placeholderTextColor={Colors.muted}
                  value={reason}
                  onChangeText={setReason}
                />
                <Text style={styles.label}>Type DELETE to continue</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="characters"
                  placeholder="DELETE"
                  placeholderTextColor={Colors.muted}
                  value={confirmText}
                  onChangeText={setConfirmText}
                />
                <TouchableOpacity
                  style={[styles.dangerBtn, (busy || confirmText.trim().toUpperCase() !== 'DELETE') && styles.disabled]}
                  onPress={sendCode}
                  disabled={busy || confirmText.trim().toUpperCase() !== 'DELETE'}
                >
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.dangerText}>Send confirmation code to my email</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>Enter the 6-digit code we sent to {sentTo}</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="••••••"
                  placeholderTextColor={Colors.muted}
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
                />
                <TouchableOpacity
                  style={[styles.dangerBtn, (busy || code.length !== 6) && styles.disabled]}
                  onPress={confirmDelete}
                  disabled={busy || code.length !== 6}
                >
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.dangerText}>Delete my account</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={sendCode} disabled={busy} style={{ alignSelf: 'center', marginTop: 12 }}>
                  <Text style={styles.link}>Send a new code</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <TouchableOpacity onPress={() => Linking.openURL('https://www.codingkida.com/delete-account')} style={{ alignSelf: 'center', marginTop: 16 }}>
            <Text style={styles.link}>You can also do this on our website</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { color: Colors.primary, fontSize: 20, fontWeight: '600', paddingRight: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { padding: 16 },
  card: { backgroundColor: Colors.card2, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  point: { color: '#cbd5e1', fontSize: 13, lineHeight: 20, marginBottom: 6 },
  label: { color: Colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14,
  },
  codeInput: { textAlign: 'center', fontSize: 20, letterSpacing: 8, fontWeight: '800' },
  dangerBtn: { backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  dangerText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  link: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});
