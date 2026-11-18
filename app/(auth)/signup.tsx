import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView,
  Keyboard, Platform,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks';
import {
  validateName, validatePassword, isEmail, dobError, isMinor, cleanName, formatDobInput, PASSWORD_HINT,
} from '@/utils/signupValidation';
import { explainSignupError, type SignupField, type SignupProblem } from '@/utils/signupErrors';
import { LegalAgreeModal, type LegalDoc } from '@/components/common/LegalAgreeModal';

const CLASS_OPTIONS = [
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6',
  'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12',
  'College', 'Other',
];

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dob, setDob] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [school, setSchool] = useState('');
  // Unticked by default: the student must agree to the Terms and Privacy Policy themselves.
  const [agreed, setAgreed] = useState(false);
  // Which document the in-app "read the terms" window shows (null = closed).
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { signup, isLoading } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  // The problem to show (under its field, or above the button) and the field marked red.
  const [problem, setProblem] = useState<SignupProblem | null>(null);
  // Where each field sits, so we can scroll to the one with the problem.
  const pos = useRef<Record<string, number>>({});
  const at = (key: string) => (e: { nativeEvent: { layout: { y: number } } }) => { pos.current[key] = e.nativeEvent.layout.y; };
  const fail = (p: SignupProblem) => {
    setProblem(p);
    Keyboard.dismiss();
    setTimeout(() => {
      const f = p.field;
      const inParent = f === 'parentName' || f === 'parentEmail' || f === 'parentPhone';
      const own = f ? pos.current[f] : pos.current.problemBox;
      if (own == null) return;
      const y = (pos.current.card ?? 0) + (inParent ? pos.current.parentBox ?? 0 : 0) + own;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }, 80);
  };
  const isBad = (f: SignupField) => problem?.field === f;
  // Typing in the marked field clears the problem.
  const edit = (f: SignupField, set: (v: string) => void) => (v: string) => {
    set(v);
    if (problem?.field === f) setProblem(null);
  };
  const fieldError = (f: SignupField) =>
    isBad(f) ? <Text style={styles.fieldError}>{problem!.message}</Text> : null;

  // Under 18: the parent's name, email and phone are needed (verified right after sign-up).
  const minor = isMinor(dob) === true;

  // Listen for keyboard show/hide to add bottom padding
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
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
    // Checked top to bottom, so the first problem on screen is the one shown.
    if (!name.trim()) return fail({ message: 'Please enter your full name.', field: 'name' });
    const nameProblem = validateName(name);
    if (nameProblem) return fail({ message: nameProblem, field: 'name' });
    if (!email.trim()) return fail({ message: 'Please enter your email address.', field: 'email' });
    if (!isEmail(email)) return fail({ message: 'Please enter a valid email address, for example name@gmail.com.', field: 'email' });
    if (!password.trim()) return fail({ message: 'Please choose a password.', field: 'password' });
    const pwProblem = validatePassword(password.trim(), email);
    if (pwProblem) return fail({ message: pwProblem, field: 'password' });
    if (!dob.trim()) return fail({ message: 'Please enter your date of birth (DD-MM-YYYY).', field: 'dob' });
    const dobProblem = dobError(dob);
    if (dobProblem) return fail({ message: dobProblem, field: 'dob' });
    if (!studentClass) return fail({ message: 'Select your class.', field: 'studentClass' });
    if (school.trim().length < 2) return fail({ message: 'Enter your school name.', field: 'school' });
    if (minor) {
      if (!parentName.trim()) return fail({ message: "Enter your parent or guardian's name.", field: 'parentName' });
      if (!isEmail(parentEmail)) return fail({ message: "Enter your parent or guardian's email address.", field: 'parentEmail' });
      if (parentEmail.trim().toLowerCase() === email.trim().toLowerCase()) {
        return fail({ message: 'The parent email must be different from your own email.', field: 'parentEmail' });
      }
      if (parentPhone.replace(/\D/g, '').length < 10) {
        return fail({ message: "Enter your parent or guardian's 10-digit phone number.", field: 'parentPhone' });
      }
    }
    if (!agreed) {
      return fail({ message: 'Please read and accept the Terms & Conditions and Privacy Policy.', field: 'terms' });
    }
    setProblem(null);
    try {
      await signup({
        name: cleanName(name),
        email: email.trim(),
        password: password.trim(),
        dob: dob.trim(),
        studentClass,
        school: school.replace(/\s+/g, ' ').trim(),
        acceptedTerms: true,
        ...(minor ? { parentName: cleanName(parentName), parentEmail: parentEmail.trim(), parentPhone: parentPhone.trim() } : {}),
      });
    } catch (err) {
      fail(explainSignupError(err));
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
            Learn coding with lessons, quizzes and real programs.
          </Text>

          {/* Card */}
          <View style={styles.card} onLayout={at('card')}>
            <Text style={styles.cardTitle}>Create Account</Text>
            <Text style={styles.cardSubtitle}>It takes about a minute.</Text>

            {/* Name */}
            <View style={styles.formGroup} onLayout={at('name')}>
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputWrapper, isBad('name') && styles.inputBad]}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your full name"
                  placeholderTextColor="#64748b"
                  value={name}
                  onChangeText={edit('name', setName)}
                  autoCapitalize="words"
                />
              </View>
              {fieldError('name')}
            </View>

            {/* Email */}
            <View style={styles.formGroup} onLayout={at('email')}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputWrapper, isBad('email') && styles.inputBad]}>
                <Text style={styles.inputIcon}>✉</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#64748b"
                  value={email}
                  onChangeText={edit('email', setEmail)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {fieldError('email')}
              {isBad('email') && problem?.emailTaken && (
                <TouchableOpacity style={styles.loginInsteadBtn} onPress={() => router.replace('/(auth)/login')}>
                  <Text style={styles.loginInsteadText}>Log in with this email →</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Password */}
            <View style={styles.formGroup} onLayout={at('password')}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrapper, isBad('password') && styles.inputBad]}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={edit('password', setPassword)}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={{ fontSize: 16 }}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
              {fieldError('password')}
              {!isBad('password') && <Text style={styles.fieldHint}>{PASSWORD_HINT}</Text>}
            </View>

            {/* Date of birth */}
            <View style={styles.formGroup} onLayout={at('dob')}>
              <Text style={styles.label}>Date of Birth</Text>
              <View style={[styles.inputWrapper, isBad('dob') && styles.inputBad]}>
                <Text style={styles.inputIcon}>🎂</Text>
                <TextInput
                  style={styles.input}
                  placeholder="DD-MM-YYYY"
                  placeholderTextColor="#64748b"
                  value={dob}
                  onChangeText={edit('dob', (t) => setDob(formatDobInput(t)))}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
              {fieldError('dob')}
            </View>

            {/* Class */}
            <View style={styles.formGroup} onLayout={at('studentClass')}>
              <Text style={styles.label}>Class</Text>
              <View style={[styles.chipWrap, isBad('studentClass') && styles.chipWrapBad]}>
                {CLASS_OPTIONS.map((c) => {
                  const on = studentClass === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => { setStudentClass(c); if (problem?.field === 'studentClass') setProblem(null); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {fieldError('studentClass')}
            </View>

            {/* School */}
            <View style={styles.formGroup} onLayout={at('school')}>
              <Text style={styles.label}>School name</Text>
              <View style={[styles.inputWrapper, isBad('school') && styles.inputBad]}>
                <Text style={styles.inputIcon}>🏫</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your school or college"
                  placeholderTextColor="#64748b"
                  value={school}
                  onChangeText={edit('school', setSchool)}
                  autoCapitalize="words"
                  maxLength={150}
                />
              </View>
              {fieldError('school')}
            </View>

            {/* Parent details — only for students under 18 */}
            {minor && (
              <View style={styles.parentBox} onLayout={at('parentBox')}>
                <Text style={styles.parentTitle}>Parent or guardian</Text>
                <Text style={styles.parentHint}>
                  You are under 18, so a parent or guardian must confirm. We will send them a code on the next screen.
                </Text>
                <View style={styles.formGroup} onLayout={at('parentName')}>
                  <Text style={styles.label}>Parent name</Text>
                  <View style={[styles.inputWrapper, isBad('parentName') && styles.inputBad]}>
                    <Text style={styles.inputIcon}>👤</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Parent or guardian name"
                      placeholderTextColor="#64748b"
                      value={parentName}
                      onChangeText={edit('parentName', setParentName)}
                      autoCapitalize="words"
                    />
                  </View>
                  {fieldError('parentName')}
                </View>
                <View style={styles.formGroup} onLayout={at('parentEmail')}>
                  <Text style={styles.label}>Parent email</Text>
                  <View style={[styles.inputWrapper, isBad('parentEmail') && styles.inputBad]}>
                    <Text style={styles.inputIcon}>✉</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="parent@example.com"
                      placeholderTextColor="#64748b"
                      value={parentEmail}
                      onChangeText={edit('parentEmail', setParentEmail)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  {fieldError('parentEmail')}
                </View>
                <View style={[styles.formGroup, { marginBottom: 4 }]} onLayout={at('parentPhone')}>
                  <Text style={styles.label}>Parent phone (WhatsApp)</Text>
                  <View style={[styles.inputWrapper, isBad('parentPhone') && styles.inputBad]}>
                    <Text style={styles.inputIcon}>📱</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="10-digit mobile number"
                      placeholderTextColor="#64748b"
                      value={parentPhone}
                      onChangeText={edit('parentPhone', setParentPhone)}
                      keyboardType="phone-pad"
                      maxLength={15}
                    />
                  </View>
                  {fieldError('parentPhone')}
                </View>
              </View>
            )}

            {/* Problems that don't belong to one field (network, too many tries, server) */}
            {problem && !problem.field && (
              <View style={styles.problemBox} onLayout={at('problemBox')}>
                <Text style={styles.problemText}>⚠️ {problem.message}</Text>
              </View>
            )}

            {/* Terms: the student must tick this themselves (not ticked by default) */}
            <View onLayout={at('terms')}>
              <View style={[styles.termsRow, isBad('terms') && styles.termsRowBad]}>
                <TouchableOpacity
                  onPress={() => { setAgreed((v) => !v); if (problem?.field === 'terms') setProblem(null); }}
                  style={[styles.checkbox, agreed && styles.checkboxOn]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: agreed }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {agreed && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
                <Text style={styles.termsText}>
                  I have read and agree to the{' '}
                  <Text style={styles.consentLink} onPress={() => setLegalDoc('terms')}>Terms & Conditions</Text>
                  {' '}and{' '}
                  <Text style={styles.consentLink} onPress={() => setLegalDoc('privacy')}>Privacy Policy</Text>.
                  {minor ? ' My parent or guardian will also confirm.' : ''}
                </Text>
              </View>
              {fieldError('terms')}
              <TouchableOpacity onPress={() => setLegalDoc('terms')} style={styles.readLink}>
                <Text style={styles.readLinkText}>📄 Read the Terms & Privacy Policy</Text>
              </TouchableOpacity>
            </View>
            <LegalAgreeModal
              visible={legalDoc !== null}
              initial={legalDoc ?? 'terms'}
              onClose={() => setLegalDoc(null)}
              onAgree={() => { setAgreed(true); if (problem?.field === 'terms') setProblem(null); }}
            />

            {/* Signup Button */}
            <TouchableOpacity
              style={[styles.signupBtn, (isLoading || !agreed) && styles.btnDisabled]}
              onPress={handleSignup}
              disabled={isLoading}
            >
              <Text style={styles.signupBtnText}>
                {isLoading ? '⏳ Creating account...' : '→  Create Account'}
              </Text>
            </TouchableOpacity>
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
  cornerTL: { top: 16, left: 16, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: '#6366f1' },
  cornerTR: { top: 16, right: 16, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: '#6366f1' },
  cornerBL: { bottom: 16, left: 16, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: '#6366f1' },
  cornerBR: { bottom: 16, right: 16, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: '#6366f1' },
  scroll: { padding: 24, paddingTop: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#6d28d9', alignItems: 'center', justifyContent: 'center' },
  logoIconText: { fontSize: 22 },
  logoText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  logoAccent: { color: '#6366f1' },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#fff', lineHeight: 40, marginBottom: 12 },
  heroHighlight: { color: '#6366f1' },
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
  inputBad: { borderColor: '#f87171', borderWidth: 1.5, backgroundColor: 'rgba(248,113,113,0.08)' },
  fieldError: { color: '#fca5a5', fontSize: 13, lineHeight: 19, marginTop: 6, fontWeight: '600' },
  fieldHint: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 6 },
  loginInsteadBtn: {
    alignSelf: 'flex-start', marginTop: 8, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: 'rgba(99,102,241,0.18)', borderWidth: 1, borderColor: 'rgba(129,140,248,0.5)',
  },
  loginInsteadText: { color: '#c7d2fe', fontSize: 13, fontWeight: '700' },
  parentBox: {
    backgroundColor: 'rgba(99,102,241,0.08)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)',
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  parentTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 6 },
  parentHint: { fontSize: 12, color: '#cbd5e1', lineHeight: 18, marginBottom: 14 },
  problemBox: {
    backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.45)',
    borderRadius: 10, padding: 12, marginBottom: 14,
  },
  problemText: { color: '#fecaca', fontSize: 13, lineHeight: 19 },
  consentLink: { color: '#a5b4fc', textDecorationLine: 'underline', fontWeight: '600' },
  termsRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, marginBottom: 14,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  termsRowBad: { borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.08)' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#818cf8',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxOn: { backgroundColor: '#6d28d9', borderColor: '#6d28d9' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '900', lineHeight: 16 },
  termsText: { flex: 1, color: '#e2e8f0', fontSize: 13, lineHeight: 19 },
  readLink: { alignSelf: 'flex-start', marginTop: -6, marginBottom: 14, paddingVertical: 4 },
  readLinkText: { color: '#a5b4fc', fontSize: 12.5, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderRadius: 10, padding: 2 },
  chipWrapBad: { borderWidth: 1.5, borderColor: '#f87171', padding: 6 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipOn: { backgroundColor: '#6d28d9', borderColor: '#8b5cf6' },
  chipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  signupBtn: { backgroundColor: '#6d28d9', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  signupBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 16 },
  loginText: { color: '#94a3b8', fontSize: 13 },
  loginLink: { color: '#6366f1', fontSize: 13, fontWeight: '600' },
});
