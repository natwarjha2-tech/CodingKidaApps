import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { studentApi } from '@/api';
import type { ConsentState } from '@/types';

/**
 * Profile verification status (GET /api/student/consent), refreshed every time
 * the screen comes into view.
 *  - "banner": dashboard warning, shown until the profile is verified.
 *  - "badge":  small "Verified" / "Unverified" pill on the profile screen.
 */
export function ProfileVerification({ variant }: { variant: 'banner' | 'badge' }) {
  const [c, setC] = useState<ConsentState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      studentApi.getConsent().then((x) => { if (alive) setC(x); }).catch(() => {});
      return () => { alive = false; };
    }, []),
  );

  if (!c?.profile) return null;
  const { verified, missing } = c.profile;
  const open = () => router.push('/parent-consent' as any);

  if (variant === 'badge') {
    return (
      <TouchableOpacity
        style={[styles.badge, verified ? styles.badgeOk : styles.badgeWarn]}
        onPress={verified ? undefined : open}
        disabled={verified}
        activeOpacity={0.7}
      >
        <Text style={[styles.badgeText, { color: verified ? '#15803d' : '#b45309' }]}>
          {verified ? '✓ Verified' : '⚠ Unverified'}
        </Text>
      </TouchableOpacity>
    );
  }

  if (verified) return null;
  const red = c.blocked;
  const when = red
    ? 'Learning is paused until this is done.'
    : c.enabled && c.required && c.daysLeft != null
      ? (c.daysLeft <= 1 ? 'Today is the last day.' : `${c.daysLeft} days left.`)
      : '';
  return (
    <View style={[styles.banner, red ? styles.bannerRed : styles.bannerAmber]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: red ? '#991b1b' : '#92400e' }]}>⚠️ Profile not verified</Text>
        {missing.length > 0 && (
          <Text style={[styles.sub, { color: red ? '#7f1d1d' : '#78350f' }]}>
            Still needed: {missing.join(', ')}.
          </Text>
        )}
        {!!when && (
          <Text style={[styles.when, { color: red ? '#b91c1c' : '#b45309' }]}>{when}</Text>
        )}
      </View>
      <TouchableOpacity style={[styles.btn, red && styles.btnRed]} onPress={open} activeOpacity={0.8}>
        <Text style={styles.btnText}>Verify</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1,
  },
  bannerAmber: { backgroundColor: '#fffbeb', borderColor: '#fcd34d' },
  bannerRed: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  title: { fontSize: 14, fontWeight: '800' },
  sub: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  when: { fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  btn: { backgroundColor: '#6c47ff', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16 },
  btnRed: { backgroundColor: '#dc2626' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  badge: {
    alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1,
    paddingVertical: 3, paddingHorizontal: 10,
  },
  badgeOk: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  badgeWarn: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
});
