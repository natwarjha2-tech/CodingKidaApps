// ═══════════════════════════════════════════════════════════════════════════
// DESIGN DEMO ENTRY — opens the faithful replica of the reference dashboard.
// Pure demo — no real app screens, data, stores or APIs are touched.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DemoPicker() {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.kicker}>DESIGN PREVIEW</Text>
        <Text style={s.title}>Light Theme Dashboard</Text>
        <Text style={s.subtitle}>A faithful demo of the reference design. Tap to preview it live. Nothing here changes the real app.</Text>

        <TouchableOpacity style={s.card} activeOpacity={0.9} onPress={() => router.push('/design-demos/style1-aurora' as any)}>
          <View style={s.thumb}>
            <View style={s.thumbBanner} />
            <View style={s.thumbRow}><View style={s.thumbDotP} /><View style={s.thumbDotA} /></View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.num}>Screen 1</Text>
            <Text style={s.name}>Dashboard (Light)</Text>
            <Text style={s.desc}>Reference layout — banner, stat cards, Continue Learning, Weekly Challenge, Recommended & Quick Actions.</Text>
          </View>
          <Text style={s.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.card} activeOpacity={0.9} onPress={() => router.push('/design-demos/courses-light' as any)}>
          <View style={[s.thumb, { backgroundColor: '#EAF1FF' }]}>
            <View style={[s.thumbBanner, { backgroundColor: '#C9DCFB', height: 22 }]} />
            <View style={s.thumbRow}><View style={[s.thumbDotP, { backgroundColor: '#C9DCFB' }]} /><View style={[s.thumbDotA, { backgroundColor: '#C9DCFB' }]} /></View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.num}>Screen 2</Text>
            <Text style={s.name}>Courses (Light)</Text>
            <Text style={s.desc}>Search, category chips & a clean 2-column course grid — consistent with the dashboard.</Text>
          </View>
          <Text style={s.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.card} activeOpacity={0.9} onPress={() => router.push('/design-demos/profile-light' as any)}>
          <View style={[s.thumb, { backgroundColor: '#F0EEFB' }]}>
            <View style={[s.thumbBanner, { backgroundColor: '#DBD2FA', height: 20 }]} />
            <View style={s.thumbRow}><View style={[s.thumbDotP, { backgroundColor: '#DBD2FA' }]} /><View style={[s.thumbDotA, { backgroundColor: '#FCE4B8' }]} /></View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.num}>Screen 3</Text>
            <Text style={s.name}>Profile (Light)</Text>
            <Text style={s.desc}>Profile card, XP hero, enrolled & achievements previews, menu list — light & consistent.</Text>
          </View>
          <Text style={s.arrow}>›</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
        <Text style={s.footer}>Approve these and I'll roll the light theme out across the whole app.</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBFBFD' },
  scroll: { padding: 22 },
  kicker: { color: '#7A3BFF', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginTop: 8 },
  title: { color: '#1E1B2E', fontSize: 28, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 },
  subtitle: { color: '#8A8699', fontSize: 14, fontWeight: '500', marginTop: 8, marginBottom: 24, lineHeight: 21 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#fff', borderRadius: 22, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#EEEEF2', shadowColor: '#7A3BFF', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  thumb: { width: 64, height: 80, borderRadius: 16, backgroundColor: '#F2EEFB', overflow: 'hidden', padding: 8, justifyContent: 'space-between' },
  thumbBanner: { height: 28, borderRadius: 8, backgroundColor: '#E0D4FB' },
  thumbRow: { flexDirection: 'row', gap: 6 },
  thumbDotP: { flex: 1, height: 18, borderRadius: 6, backgroundColor: '#D9C9FA' },
  thumbDotA: { flex: 1, height: 18, borderRadius: 6, backgroundColor: '#FCE4B8' },
  num: { color: '#8A8699', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  name: { color: '#1E1B2E', fontSize: 17, fontWeight: '800', marginTop: 2 },
  desc: { color: '#8A8699', fontSize: 12.5, fontWeight: '500', marginTop: 4, lineHeight: 18 },
  arrow: { color: '#C7C7CF', fontSize: 28, fontWeight: '300' },
  footer: { color: '#8A8699', fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
});
