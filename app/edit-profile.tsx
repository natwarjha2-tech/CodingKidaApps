import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { normalizeWhatsAppNumber } from '@/utils/weeklyReport.util';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { studentApi } from '@/api';
import { useAuthStore } from '@/store';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';

export default function EditProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const viewOnly = mode === 'view';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentDob, setStudentDob] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [studentGender, setStudentGender] = useState('');
  const [studentSchool, setStudentSchool] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentContact, setParentContact] = useState('');
  // Weekly report to the parent on WhatsApp (opt-in). `initialConsent` lets us
  // send the field only when the student changed it.
  const [reportConsent, setReportConsent] = useState(false);
  const [initialConsent, setInitialConsent] = useState(false);
  // Parent WhatsApp verification (one-time code)
  const [savedContact, setSavedContact] = useState('');
  const [verif, setVerif] = useState<{ verified: boolean; phoneLast4: string | null; testMode: boolean }>({ verified: false, phoneLast4: null, testMode: false });
  const [codeSent, setCodeSent] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [verifBusy, setVerifBusy] = useState<'send' | 'confirm' | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await studentApi.getProfile();
      const s = res.student;
      setName(s.name || '');
      setEmail(s.email || '');
      setStudentName(s.studentName || '');
      setStudentDob(s.studentDob || '');
      setStudentGrade(s.studentGrade || '');
      setStudentGender(s.studentGender || '');
      setStudentSchool(s.studentSchool || '');
      setParentName(s.parentName || '');
      setParentEmail(s.parentEmail || '');
      setParentContact(s.parentContact || '');
      const ext = s as { parentReportConsent?: boolean; parentVerification?: { verified: boolean; phoneLast4: string | null; testMode: boolean } };
      const c = !!ext.parentReportConsent;
      setReportConsent(c);
      setInitialConsent(c);
      setSavedContact(s.parentContact || '');
      if (ext.parentVerification) setVerif(ext.parentVerification);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Account name is required.');
      return;
    }
    if (parentContact.trim() && !normalizeWhatsAppNumber(parentContact)) {
      Alert.alert('Check the number', 'Enter the parent’s WhatsApp number with 10 digits, for example +91 98765 43210.');
      return;
    }
    setSaving(true);
    try {
      await studentApi.updateProfile({
        name: name.trim(),
        studentName: studentName.trim(),
        studentDob,
        studentGrade,
        studentGender,
        studentSchool: studentSchool.trim(),
        parentName: parentName.trim(),
        parentEmail: parentEmail.trim(),
        parentContact: parentContact.trim(),
        ...(reportConsent !== initialConsent ? { parentReportConsent: reportConsent } : {}),
      } as any);
      Alert.alert('Success ✅', 'Profile updated!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Parent WhatsApp verification ───────────────────────────────────────────
  const typedNumber = normalizeWhatsAppNumber(parentContact);
  const savedNumber = normalizeWhatsAppNumber(savedContact);
  const numberSaved = !!typedNumber && typedNumber === savedNumber; // the server verifies the SAVED number
  const showVerified = verif.verified && numberSaved;

  const sendCode = async () => {
    setVerifBusy('send');
    try {
      const r = await studentApi.sendParentCode();
      setCodeSent(true);
      setCodeInput('');
      setDevCode(r.devCode ?? null);
      Alert.alert('Code sent', r.testMode
        ? 'Test mode: no WhatsApp message was sent. The code is shown on screen.'
        : `We sent a 6-digit code to your parent’s WhatsApp (${r.sentTo}). Ask them to read it out to you.`);
    } catch (e) {
      Alert.alert('Could not send the code', (e as Error)?.message || 'Please try again.');
    } finally {
      setVerifBusy(null);
    }
  };

  const confirmCode = async () => {
    if (!/^\d{6}$/.test(codeInput.trim())) { Alert.alert('Enter the code', 'The code has 6 digits.'); return; }
    setVerifBusy('confirm');
    try {
      await studentApi.confirmParentCode(codeInput.trim());
      setCodeSent(false); setCodeInput(''); setDevCode(null);
      Alert.alert('Verified ✅', 'Your parent’s WhatsApp is verified. Your weekly report will now be sent to them every week.');
      await loadProfile();
    } catch (e) {
      Alert.alert('Code not accepted', (e as Error)?.message || 'Please try again.');
    } finally {
      setVerifBusy(null);
    }
  };

  const inputStyle = (extraStyle?: object) => [
    styles.input,
    viewOnly && styles.inputViewOnly,
    extraStyle,
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {viewOnly ? 'View Profile' : 'Edit Profile'}
        </Text>
        {viewOnly ? (
          <TouchableOpacity onPress={() => router.replace('/edit-profile')}>
            <Text style={styles.editBtn}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? '...' : 'Save'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>

          {/* Student Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎓 Student Information</Text>
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Student Name</Text>
                <TextInput style={inputStyle()} placeholder="Student's full name" placeholderTextColor={Colors.muted} value={studentName} onChangeText={setStudentName} editable={!viewOnly} />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Date of Birth</Text>
                <TextInput style={inputStyle()} placeholder="dd-mm-yyyy" placeholderTextColor={Colors.muted} value={studentDob} onChangeText={setStudentDob} editable={!viewOnly} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Grade/Class</Text>
                <TextInput style={inputStyle()} placeholder="e.g. Class 10" placeholderTextColor={Colors.muted} value={studentGrade} onChangeText={setStudentGrade} editable={!viewOnly} />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Gender</Text>
                <TextInput style={inputStyle()} placeholder="Male/Female/Other" placeholderTextColor={Colors.muted} value={studentGender} onChangeText={setStudentGender} editable={!viewOnly} />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>School Name</Text>
              <TextInput style={inputStyle()} placeholder="School/Institution name" placeholderTextColor={Colors.muted} value={studentSchool} onChangeText={setStudentSchool} editable={!viewOnly} />
            </View>
          </View>

          {/* Parent/Guardian Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👨‍👩‍👧 Parent/Guardian Information</Text>
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Parent Name</Text>
                <TextInput style={inputStyle()} placeholder="Parent full name" placeholderTextColor={Colors.muted} value={parentName} onChangeText={setParentName} editable={!viewOnly} />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Parent Email</Text>
                <TextInput style={inputStyle()} placeholder="parent@email.com" placeholderTextColor={Colors.muted} value={parentEmail} onChangeText={setParentEmail} keyboardType="email-address" autoCapitalize="none" editable={!viewOnly} />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Parent Contact Number</Text>
              <TextInput style={inputStyle()} placeholder="+91 9876543210" placeholderTextColor={Colors.muted} value={parentContact} onChangeText={setParentContact} keyboardType="phone-pad" editable={!viewOnly} />
            </View>
            {/* Weekly report to the parent on WhatsApp — only for a VERIFIED number */}
            <View style={styles.consentBox}>
              <Text style={styles.consentTitle}>💬 Weekly report to my parent on WhatsApp</Text>
              {showVerified ? (
                <>
                  <Text style={styles.okText}>✅ Parent’s WhatsApp verified (•••• {verif.phoneLast4})</Text>
                  <View style={styles.consentRow}>
                    <Text style={[styles.hint, { flex: 1, marginTop: 0 }]}>
                      Send one short message a week with my progress. Your parent can reply STOP any time to stop it.
                    </Text>
                    <Switch value={reportConsent} onValueChange={setReportConsent} disabled={viewOnly} trackColor={{ true: Colors.primary }} />
                  </View>
                </>
              ) : viewOnly ? (
                <Text style={styles.hint}>Not verified yet. Open Edit Profile to verify your parent’s WhatsApp number.</Text>
              ) : !typedNumber ? (
                <Text style={styles.hint}>Enter your parent’s WhatsApp number above, save, and then verify it to send them your weekly report.</Text>
              ) : !numberSaved ? (
                <Text style={styles.hint}>Tap Save at the top first. Then come back here to verify this number.</Text>
              ) : (
                <>
                  <Text style={styles.hint}>
                    We will WhatsApp a 6-digit code to your parent. When they read it out and you type it here, the weekly report is switched on.
                  </Text>
                  {codeSent && (
                    <View style={styles.codeRow}>
                      <TextInput
                        style={[styles.input, styles.codeInput]}
                        placeholder="6-digit code"
                        placeholderTextColor={Colors.muted}
                        value={codeInput}
                        onChangeText={(t) => setCodeInput(t.replace(/\D/g, '').slice(0, 6))}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                      <TouchableOpacity style={[styles.verifyBtn, verifBusy === 'confirm' && { opacity: 0.6 }]} onPress={confirmCode} disabled={!!verifBusy}>
                        <Text style={styles.verifyBtnText}>{verifBusy === 'confirm' ? '…' : 'Confirm'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {!!devCode && <Text style={styles.devText}>Test mode — your code is {devCode}</Text>}
                  <TouchableOpacity style={[styles.verifyBtn, styles.verifyBtnWide, verifBusy === 'send' && { opacity: 0.6 }]} onPress={sendCode} disabled={!!verifBusy}>
                    <Text style={styles.verifyBtnText}>{verifBusy === 'send' ? 'Sending…' : codeSent ? 'Send a new code' : 'Verify parent’s WhatsApp'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Account Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ Account Settings</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Account Name (Display Name)</Text>
              <TextInput style={inputStyle()} placeholder="Your display name" placeholderTextColor={Colors.muted} value={name} onChangeText={setName} editable={!viewOnly} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Account Email</Text>
              <TextInput style={inputStyle({ opacity: 0.6 })} value={email} editable={false} />
              {!viewOnly && <Text style={styles.hint}>Email cannot be changed</Text>}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { color: Colors.primary, fontSize: 20, fontWeight: '600', paddingRight: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  saveBtn: { color: Colors.success, fontSize: 14, fontWeight: '700' },
  editBtn: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  content: { padding: 16 },
  section: {
    backgroundColor: Colors.card2, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 16 },
  field: { marginBottom: 12 },
  fieldHalf: { flex: 1 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  label: { color: Colors.muted, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: '#fff', fontSize: 13,
  },
  inputViewOnly: {
    backgroundColor: 'transparent', borderColor: 'transparent',
    color: 'rgba(255,255,255,0.85)',
  },
  hint: { color: Colors.muted, fontSize: 10, marginTop: 4 },
  consentBox: { marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, gap: 8 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  consentTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  okText: { color: Colors.success, fontSize: 12, fontWeight: '700' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeInput: { flex: 1, letterSpacing: 4, textAlign: 'center', fontSize: 16, fontWeight: '800' },
  verifyBtn: { backgroundColor: '#25D366', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center' },
  verifyBtnWide: { alignSelf: 'stretch' },
  verifyBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  devText: { color: Colors.warning, fontSize: 12, fontWeight: '700' },
});
