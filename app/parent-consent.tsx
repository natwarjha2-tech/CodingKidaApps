import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { studentApi } from '@/api';
import { useAuth } from '@/hooks';
import { Colors } from '@/theme';
import type { ConsentState } from '@/types';
import { dobError, isEmail, isMinor, formatDobInput, cleanName, validateName } from '@/utils/signupValidation';

/**
 * Parent verification (students under 18, and anyone whose age is not on file).
 * The student saves the parent's email and phone; a 6-digit code is sent to the
 * parent's email (and to the parent's WhatsApp once that is switched on); the
 * parent reads the codes out and the student types them in.
 *
 * Before the deadline it can be left for later. After the deadline it blocks the
 * rest of the app until it is finished.
 */
export default function ParentConsentScreen() {
  const { logout } = useAuth();
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const [emailSent, setEmailSent] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'emailSend' | 'emailConfirm' | 'phoneSend' | 'phoneConfirm'>(null);

  const fill = (c: ConsentState) => {
    setFullName(c.studentName ?? '');
    setDob(c.studentDob ?? '');
    setParentName(c.parentName ?? '');
    setParentEmail(c.parentEmail ?? '');
    setParentPhone(c.parentContact ?? '');
  };

  const load = useCallback(async (refillForm = true) => {
    try {
      const c = await studentApi.getConsent();
      setConsent(c);
      if (refillForm) fill(c);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // What is saved on the server vs. what is typed now.
  const dirty =
    !!consent && (
      fullName.trim() !== (consent.studentName ?? '') ||
      dob.trim() !== (consent.studentDob ?? '') ||
      parentEmail.trim() !== (consent.parentEmail ?? '') ||
      parentPhone.trim() !== (consent.parentContact ?? '') ||
      parentName.trim() !== (consent.parentName ?? '')
    );

  const saveDetails = async (): Promise<boolean> => {
    const nameChanged = fullName.trim() !== (consent?.studentName ?? '');
    if (nameChanged) {
      const nameProblem = validateName(fullName);
      if (nameProblem) { Alert.alert('Your name', nameProblem); return false; }
    }
    const dobProblem = dobError(dob);
    if (dobProblem) { Alert.alert('Date of birth', dobProblem); return false; }
    // 18 or older only needs the date; the parent fields are for under 18.
    const adult = isMinor(dob) === false;
    if (!adult) {
      if (!isEmail(parentEmail)) { Alert.alert('Parent email', "Enter your parent or guardian's email address."); return false; }
      if (parentPhone.replace(/\D/g, '').length < 10) { Alert.alert('Parent phone', "Enter your parent or guardian's 10-digit phone number."); return false; }
    }
    setSaving(true);
    try {
      await studentApi.updateProfile({
        ...(nameChanged ? { name: cleanName(fullName) } : {}),
        studentDob: dob.trim(),
        ...(adult ? {} : {
          parentName: cleanName(parentName),
          parentEmail: parentEmail.trim(),
          parentContact: parentPhone.trim(),
        }),
      } as any);
      await load(true);
      return true;
    } catch (e) {
      Alert.alert('Could not save', (e as Error)?.message || 'Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const sendEmailCode = async () => {
    if (dirty && !(await saveDetails())) return;
    setBusy('emailSend');
    try {
      const r = await studentApi.sendConsentEmailCode();
      setEmailSent(true); setEmailCode(''); setEmailTo(r.sentTo);
      Alert.alert('Code sent', `We emailed a 6-digit code to ${r.sentTo}. Ask your parent to open it and read the code out to you.`);
    } catch (e) {
      Alert.alert('Could not send the code', (e as Error)?.message || 'Please try again.');
    } finally { setBusy(null); }
  };

  const confirmEmailCode = async () => {
    if (!/^\d{6}$/.test(emailCode.trim())) { Alert.alert('Enter the code', 'The code has 6 digits.'); return; }
    setBusy('emailConfirm');
    try {
      await studentApi.confirmConsentEmailCode(emailCode.trim());
      setEmailSent(false); setEmailCode('');
      await load(false);
    } catch (e) {
      Alert.alert('Code not accepted', (e as Error)?.message || 'Please try again.');
    } finally { setBusy(null); }
  };

  const sendPhoneCode = async () => {
    if (dirty && !(await saveDetails())) return;
    setBusy('phoneSend');
    try {
      const r = await studentApi.sendParentCode();
      setPhoneSent(true); setPhoneCode(''); setDevCode(r.devCode ?? null);
      Alert.alert('Code sent', r.testMode
        ? 'Test mode: no WhatsApp message was sent. The code is shown on screen.'
        : `We sent a 6-digit code to your parent's WhatsApp (${r.sentTo}). Ask them to read it out to you.`);
    } catch (e) {
      Alert.alert('Could not send the code', (e as Error)?.message || 'Please try again.');
    } finally { setBusy(null); }
  };

  const confirmPhoneCode = async () => {
    if (!/^\d{6}$/.test(phoneCode.trim())) { Alert.alert('Enter the code', 'The code has 6 digits.'); return; }
    setBusy('phoneConfirm');
    try {
      await studentApi.confirmParentCode(phoneCode.trim());
      setPhoneSent(false); setPhoneCode(''); setDevCode(null);
      await load(false);
    } catch (e) {
      Alert.alert('Code not accepted', (e as Error)?.message || 'Please try again.');
    } finally { setBusy(null); }
  };

  const goOn = () => router.replace('/(tabs)/dashboard');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (loadFailed || !consent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>Could not load</Text>
          <Text style={styles.hint}>Check your internet connection and try again.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goOn}><Text style={styles.link}>Skip for now</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Everything needed is done.
  const profileDone = consent.profile ? consent.profile.verified : (!consent.required || consent.verified);
  if (profileDone) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>✅</Text>
          <Text style={styles.title}>Profile verified</Text>
          <Text style={styles.hint}>
            {isMinor(consent.studentDob ?? '') === false
              ? 'Your details are complete.'
              : 'Thank you. Your parent or guardian is verified. You can use CodingKida without any limit.'}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={goOn}><Text style={styles.btnText}>Continue</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const emailBusy = busy === 'emailSend' || busy === 'emailConfirm';
  const phoneBusy = busy === 'phoneSend' || busy === 'phoneConfirm';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Verify your profile</Text>
          <Text style={styles.hint}>
            CodingKida is made for students, and anyone under 18 needs a parent or guardian to confirm. It takes about two minutes.
          </Text>
          {!!consent.profile?.missing.length && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Still needed</Text>
              {consent.profile.missing.map((m) => <Text key={m} style={styles.hint}>• {m}</Text>)}
            </View>
          )}

          {consent.blocked ? (
            <View style={[styles.banner, styles.bannerRed]}>
              <Text style={styles.bannerText}>Finish this to keep using CodingKida. Your learning is on hold until your parent is verified.</Text>
            </View>
          ) : consent.daysLeft !== null && consent.daysLeft !== undefined ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                {consent.daysLeft <= 1 ? 'Last day to finish this.' : `${consent.daysLeft} days left to finish this.`}
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>1. Your details</Text>
            <Text style={styles.label}>Your full name</Text>
            <TextInput
              style={styles.input} placeholder="Your full name" placeholderTextColor={Colors.muted}
              value={fullName} onChangeText={setFullName} autoCapitalize="words"
            />
            <Text style={styles.label}>Your date of birth</Text>
            <TextInput
              style={styles.input} placeholder="DD-MM-YYYY" placeholderTextColor={Colors.muted}
              value={dob} onChangeText={(t) => setDob(formatDobInput(t))} keyboardType="number-pad" maxLength={10}
            />
            <Text style={styles.label}>Parent or guardian name</Text>
            <TextInput
              style={styles.input} placeholder="Full name" placeholderTextColor={Colors.muted}
              value={parentName} onChangeText={setParentName} autoCapitalize="words"
            />
            <Text style={styles.label}>Parent email</Text>
            <TextInput
              style={styles.input} placeholder="parent@example.com" placeholderTextColor={Colors.muted}
              value={parentEmail} onChangeText={setParentEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />
            <Text style={styles.label}>Parent phone (WhatsApp)</Text>
            <TextInput
              style={styles.input} placeholder="10-digit mobile number" placeholderTextColor={Colors.muted}
              value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" maxLength={15}
            />
            {dirty && (
              <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={saveDetails} disabled={saving}>
                <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save details'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>2. Parent email {consent.emailVerified ? '✅' : ''}</Text>
            {consent.emailVerified ? (
              <Text style={styles.ok}>Verified ({consent.parentEmailMasked})</Text>
            ) : (
              <>
                <Text style={styles.hint}>
                  We email a 6-digit code to {consent.parentEmailMasked || 'your parent'}. Your parent reads it out and you type it here.
                </Text>
                {emailSent && (
                  <View style={styles.codeRow}>
                    <TextInput
                      style={[styles.input, styles.codeInput]} placeholder="6-digit code" placeholderTextColor={Colors.muted}
                      value={emailCode} onChangeText={(t) => setEmailCode(t.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad" maxLength={6}
                    />
                    <TouchableOpacity style={[styles.btnSmall, emailBusy && { opacity: 0.6 }]} onPress={confirmEmailCode} disabled={emailBusy}>
                      <Text style={styles.btnText}>{busy === 'emailConfirm' ? '…' : 'Confirm'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {emailSent && !!emailTo && <Text style={styles.small}>Sent to {emailTo}. Check the spam folder too.</Text>}
                <TouchableOpacity style={[styles.btn, emailBusy && { opacity: 0.6 }]} onPress={sendEmailCode} disabled={emailBusy || saving}>
                  <Text style={styles.btnText}>{busy === 'emailSend' ? 'Sending…' : emailSent ? 'Send a new code' : 'Send code to parent email'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>3. Parent phone {consent.phoneRequired && consent.phoneVerified ? '✅' : ''}</Text>
            {!consent.phoneRequired ? (
              <Text style={styles.hint}>
                Phone verification on WhatsApp will start soon. For now, only the parent email is checked. Please keep the phone number above correct.
              </Text>
            ) : consent.phoneVerified ? (
              <Text style={styles.ok}>Verified (•••• {consent.parentPhoneLast4})</Text>
            ) : (
              <>
                <Text style={styles.hint}>We send a 6-digit code to your parent's WhatsApp. Your parent reads it out and you type it here.</Text>
                {phoneSent && (
                  <View style={styles.codeRow}>
                    <TextInput
                      style={[styles.input, styles.codeInput]} placeholder="6-digit code" placeholderTextColor={Colors.muted}
                      value={phoneCode} onChangeText={(t) => setPhoneCode(t.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad" maxLength={6}
                    />
                    <TouchableOpacity style={[styles.btnSmall, phoneBusy && { opacity: 0.6 }]} onPress={confirmPhoneCode} disabled={phoneBusy}>
                      <Text style={styles.btnText}>{busy === 'phoneConfirm' ? '…' : 'Confirm'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!!devCode && <Text style={styles.small}>Test mode: your code is {devCode}</Text>}
                <TouchableOpacity style={[styles.btn, phoneBusy && { opacity: 0.6 }]} onPress={sendPhoneCode} disabled={phoneBusy || saving}>
                  <Text style={styles.btnText}>{busy === 'phoneSend' ? 'Sending…' : phoneSent ? 'Send a new code' : "Send code to parent's WhatsApp"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {!consent.blocked && (
            <TouchableOpacity onPress={goOn}><Text style={styles.link}>Do this later</Text></TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => { logout().catch(() => {}); }}>
            <Text style={[styles.link, { color: Colors.muted }]}>Sign out</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  content: { padding: 18 },
  bigEmoji: { fontSize: 48 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  hint: { color: Colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  small: { color: Colors.muted, fontSize: 12, marginTop: 6 },
  ok: { color: Colors.success, fontSize: 14, fontWeight: '700' },
  banner: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.4)', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  bannerRed: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' },
  bannerText: { color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 8 },
  label: { color: '#e2e8f0', fontSize: 12.5, fontWeight: '600', marginTop: 8, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 14,
  },
  codeRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  codeInput: { flex: 1, letterSpacing: 4, textAlign: 'center' },
  btn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10, alignSelf: 'stretch' },
  btnSmall: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 12 },
});
