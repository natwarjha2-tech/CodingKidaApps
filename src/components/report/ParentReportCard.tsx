/**
 * "Send weekly report to parent" card for My Report.
 * One tap opens WhatsApp straight into the parent's chat with a ready-made
 * report (free: the student presses Send in their own WhatsApp).
 */
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { studentApi } from '@/api';
import {
  buildWeeklyReportMessage, normalizeWhatsAppNumber, maskNumber, sendReportOnWhatsApp, type WeeklyReportInput,
} from '@/utils/weeklyReport.util';
import { enableWeeklyReminder, disableWeeklyReminder, isWeeklyReminderOn } from '@/services/weeklyReportReminder';
import { Colors } from '@/theme';

interface Props {
  /** Everything except the names, which come from the profile. */
  report: Omit<WeeklyReportInput, 'studentName' | 'parentName'>;
  fallbackName: string;
}

export function ParentReportCard({ report, fallbackName }: Props) {
  const { data, refetch } = useQuery({
    queryKey: ['student-profile'],
    queryFn: () => studentApi.getProfile(),
    staleTime: 1000 * 60,
  });
  // The student may add the number in Edit Profile and come back — refresh then.
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const s = (data?.student ?? {}) as { studentName?: string; name?: string; parentName?: string; parentContact?: string };
  const studentName = (s.studentName || s.name || fallbackName || 'Student').trim();
  const parentName = s.parentName?.trim() || '';
  const number = normalizeWhatsAppNumber(s.parentContact);

  const [reminder, setReminder] = useState(false);
  useEffect(() => { isWeeklyReminderOn().then(setReminder); }, []);

  const send = () => {
    const text = buildWeeklyReportMessage({ ...report, studentName, parentName });
    if (number) { sendReportOnWhatsApp(number, text); return; }
    Alert.alert(
      "Add your parent's WhatsApp number",
      'Save it once in your profile and the report goes straight to your parent’s WhatsApp. Or choose a contact now.',
      [
        { text: 'Choose contact now', onPress: () => sendReportOnWhatsApp(null, text) },
        { text: 'Add number', onPress: () => router.push('/edit-profile') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const toggleReminder = async (on: boolean) => {
    setReminder(on);
    if (!on) { await disableWeeklyReminder(); return; }
    const ok = await enableWeeklyReminder().catch(() => false);
    if (!ok) {
      setReminder(false);
      Alert.alert('Reminder', 'Please allow notifications for CodingKida in your phone settings to get the Sunday reminder.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.iconBox}><Text style={styles.icon}>👪</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Weekly report for parents</Text>
          <Text style={styles.sub} numberOfLines={2}>
            {number
              ? `Goes to ${parentName || 'your parent'} · ${maskNumber(number)}`
              : 'Add your parent’s WhatsApp number to send it in one tap'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.sendBtn} onPress={send} activeOpacity={0.85}>
        <Text style={styles.sendText}>💬 Send this week’s report on WhatsApp</Text>
      </TouchableOpacity>

      {!number && (
        <TouchableOpacity onPress={() => router.push('/edit-profile')} style={styles.addLink}>
          <Text style={styles.addLinkText}>＋ Add parent’s number</Text>
        </TouchableOpacity>
      )}

      <View style={styles.remRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.remTitle}>🔔 Remind me every Sunday</Text>
          <Text style={styles.remSub}>A reminder at 6 PM to send the report</Text>
        </View>
        <Switch value={reminder} onValueChange={toggleReminder} trackColor={{ true: Colors.primary }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16, padding: 14, borderRadius: 16, backgroundColor: 'rgba(37,211,102,0.07)', borderWidth: 1, borderColor: 'rgba(37,211,102,0.3)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(37,211,102,0.18)', alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22 },
  title: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sub: { color: Colors.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  sendBtn: { backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  sendText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  addLink: { alignSelf: 'center', paddingVertical: 8 },
  addLinkText: { color: '#25D366', fontSize: 13, fontWeight: '800' },
  remRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  remTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  remSub: { color: Colors.muted, fontSize: 11, marginTop: 2 },
});
