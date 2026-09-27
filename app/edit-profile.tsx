import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
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
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Account name is required.');
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
});
