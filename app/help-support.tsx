import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSupportContact } from '@/hooks';
import { SupportService } from '@/services';
import { Colors } from '@/theme';

// Support handlers use the LIVE contact (backend-configurable, cached, fallback)
// — mirror desktop helpOpenWhatsApp / helpOpenEmail.
function openWhatsApp(prefill?: string) {
  const msg = prefill || 'Hi CodingKida Support! I need help with the app.';
  Linking.openURL(`https://wa.me/${SupportService.get().whatsapp}?text=${encodeURIComponent(msg)}`).catch(() => {});
}
function openEmail() {
  const subject = 'Help Request';
  const body = 'Hi CodingKida Support,\n\nI need help with:\n\n[Describe your issue here]\n\nThank you';
  Linking.openURL(`mailto:${SupportService.get().email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`).catch(() => {});
}
// Open the phone dialer with the support number pre-filled (dial-ready). Uses
// the same live support number as WhatsApp; does NOT open WhatsApp.
function openPhone() {
  const number = SupportService.get().whatsapp;
  Linking.openURL(`tel:${number}`).catch(() => {});
}

interface FAQItem { question: string; answer: string }

const faqItems: FAQItem[] = [
  { question: 'How do I enroll in a course?', answer: 'Go to Courses tab, select a course, and tap Enroll.' },
  { question: 'How do I earn coins?', answer: 'You earn coins in several ways:\n\n🧠 Lesson quizzes (by rank):\n• Rank #1 → 10 coins + Super Master badge\n• Rank #2 → 7 coins + Master badge\n• Rank #3–10 → 5 coins + Pro badge\n(Coins are given once per lesson, on your first attempt.)\n\n🔥 Weekly Challenge: 50 coins on completing all your weekly coding challenges.\n\n🎁 Refer & Earn: your friend gets 50 coins when they apply your referral code, and you get 50 coins when they buy their first course.\n\n💡 Redeem: 100+ coins = a ₹ discount on your next course.' },
  { question: 'Can I download lessons for offline use?', answer: 'Yes — open a lesson and tap Download. Downloads expire after 30 days.' },
  { question: 'How do I track my progress?', answer: 'Open My Report or Student Progress from your Profile to see detailed progress.' },
  { question: 'What are achievements?', answer: 'Rank Super-Master, Master, or Pro in quizzes to earn achievement badges.' },
];

// 3 quick-help cards (mirror desktop) — each opens WhatsApp with a topic prefill.
const QUICK_HELP = [
  { emoji: '📘', title: 'Course Help', sub: 'Enrollment & learning', tint: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', topic: 'I need help with a course (enrollment / learning).' },
  { emoji: '💳', title: 'Payment Help', sub: 'Orders & payments', tint: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.25)', topic: 'I need help with a payment / order.' },
  { emoji: '🔧', title: 'Technical Help', sub: 'App & technical issues', tint: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', topic: 'I have a technical / app issue.' },
];

export default function HelpSupportScreen() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const support = useSupportContact(); // live WhatsApp/email

  const toggleFAQ = (index: number) => setExpandedIndex(expandedIndex === index ? null : index);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* 24/7 Hero */}
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <View style={styles.heroIcon}><Text style={{ fontSize: 18 }}>❤️</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>24/7 Help & Support</Text>
              <Text style={styles.heroSub}>We're always here for you — anytime, anywhere</Text>
            </View>
          </View>
          <View style={styles.herePill}>
            <View style={styles.hereDot} />
            <Text style={styles.herePillText}>We're here</Text>
          </View>
        </View>

        {/* Chat with Support Team */}
        <View style={styles.chatCard}>
          <View style={styles.cardHead}>
            <View style={[styles.cardHeadIcon, { backgroundColor: 'rgba(139,92,246,0.12)' }]}><Text style={{ fontSize: 16 }}>💬</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeadTitle}>Chat with Support Team</Text>
              <Text style={styles.cardHeadSub}>Get help from our experts</Text>
            </View>
          </View>
          <Text style={styles.chatDesc}>
            Need help with courses, payments, or technical issues? Our support team is ready to assist you on WhatsApp.
          </Text>
          <TouchableOpacity style={styles.chatBtn} onPress={() => openWhatsApp()} activeOpacity={0.85}>
            <Text style={styles.chatBtnText}>💬 Chat with Us</Text>
          </TouchableOpacity>
          <Text style={styles.chatNumber}>WhatsApp: <Text style={styles.chatNumberVal}>{support.whatsappPretty}</Text></Text>
        </View>

        {/* FAQ */}
        <View style={styles.faqSection}>
          <View style={styles.cardHead}>
            <View style={[styles.cardHeadIcon, { backgroundColor: 'rgba(251,191,36,0.12)' }]}><Text style={{ fontSize: 16 }}>❓</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeadTitle}>Frequently Asked Questions</Text>
              <Text style={styles.cardHeadSub}>Quick answers to common questions</Text>
            </View>
          </View>
          {faqItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.faqCard} onPress={() => toggleFAQ(index)} activeOpacity={0.7}>
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Text style={styles.faqToggle}>{expandedIndex === index ? '⌄' : '›'}</Text>
              </View>
              {expandedIndex === index && (
                <View style={styles.faqAnswerWrap}><Text style={styles.faqAnswer}>{item.answer}</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* 3 Quick Help cards */}
        <View style={styles.quickRow}>
          {QUICK_HELP.map((q) => (
            <TouchableOpacity key={q.title} style={[styles.quickCard, { borderColor: q.border }]} onPress={() => openWhatsApp(q.topic)} activeOpacity={0.85}>
              <View style={[styles.quickIcon, { backgroundColor: q.tint }]}><Text style={{ fontSize: 15 }}>{q.emoji}</Text></View>
              <Text style={styles.quickTitle}>{q.title}</Text>
              <Text style={styles.quickSub}>{q.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Contact Us */}
        <Text style={styles.contactHeading}>🎧 Contact Us</Text>
        <View style={styles.contactGrid}>
          {/* WhatsApp */}
          <TouchableOpacity style={[styles.contactCard, { borderColor: 'rgba(37,211,102,0.25)' }]} onPress={() => openWhatsApp()} activeOpacity={0.85}>
            <View style={[styles.contactIcon, { backgroundColor: 'rgba(37,211,102,0.12)' }]}><Text style={{ fontSize: 16 }}>💬</Text></View>
            <Text style={[styles.contactTitle, { color: '#25D366' }]}>WhatsApp</Text>
            <Text style={styles.contactMeta}>Chat with our team</Text>
            <Text style={[styles.contactValue, { color: '#25D366' }]}>{support.whatsappPretty}</Text>
            <Text style={[styles.contactCta, { color: '#25D366' }]}>Open WhatsApp →</Text>
          </TouchableOpacity>

          {/* Email */}
          <TouchableOpacity style={[styles.contactCard, { borderColor: 'rgba(96,165,250,0.25)' }]} onPress={openEmail} activeOpacity={0.85}>
            <View style={[styles.contactIcon, { backgroundColor: 'rgba(96,165,250,0.12)' }]}><Text style={{ fontSize: 16 }}>✉️</Text></View>
            <Text style={[styles.contactTitle, { color: '#60A5FA' }]}>Email Support</Text>
            <Text style={styles.contactMeta} numberOfLines={1}>{support.email}</Text>
            <Text style={[styles.contactCta, { color: '#60A5FA' }]}>Contact Support →</Text>
          </TouchableOpacity>

          {/* Available 24/7 — taps open the phone dialer (dial-ready), not WhatsApp */}
          <TouchableOpacity style={[styles.contactCard, { borderColor: 'rgba(168,85,247,0.25)' }]} onPress={openPhone} activeOpacity={0.85}>
            <View style={[styles.contactIcon, { backgroundColor: 'rgba(168,85,247,0.12)' }]}><Text style={{ fontSize: 16 }}>🕐</Text></View>
            <Text style={[styles.contactTitle, { color: '#A855F7' }]}>Available 24/7</Text>
            <Text style={styles.contactMeta}>Monday – Sunday</Text>
            <Text style={[styles.contactValue, { color: '#A855F7' }]}>{support.whatsappPretty}</Text>
            <Text style={[styles.contactCta, { color: '#A855F7' }]}>Call now →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
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

  // 24/7 Hero
  hero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card2, borderRadius: 18, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(236,72,153,0.15)',
  },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  heroIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(236,72,153,0.12)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  heroSub: { color: Colors.muted, fontSize: 11.5, marginTop: 2 },
  herePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  hereDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  herePillText: { color: '#6ee7b7', fontSize: 10.5, fontWeight: '700' },

  // Card head (shared)
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardHeadIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardHeadTitle: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  cardHeadSub: { color: Colors.muted, fontSize: 11, marginTop: 1 },

  // Chat card
  chatCard: { backgroundColor: Colors.card2, borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(139,92,246,0.12)' },
  chatDesc: { color: '#94a3b8', fontSize: 12.5, lineHeight: 19, marginBottom: 14 },
  chatBtn: { backgroundColor: 'rgba(37,211,102,0.15)', borderWidth: 1, borderColor: 'rgba(37,211,102,0.35)', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  chatBtnText: { color: '#25D366', fontSize: 13, fontWeight: '800' },
  chatNumber: { color: Colors.muted, fontSize: 11.5, textAlign: 'center', marginTop: 10 },
  chatNumberVal: { color: '#25D366', fontWeight: '700' },

  // FAQ
  faqSection: { backgroundColor: Colors.card2, borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(251,191,36,0.12)' },
  faqCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 12 },
  faqToggle: { color: Colors.muted, fontSize: 18, fontWeight: '700' },
  faqAnswerWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  faqAnswer: { color: Colors.muted, fontSize: 12.5, lineHeight: 19 },

  // 3 quick help cards
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickCard: { flex: 1, backgroundColor: Colors.card2, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1 },
  quickIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickTitle: { color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  quickSub: { color: Colors.muted, fontSize: 9.5, textAlign: 'center', marginTop: 3 },

  // Contact Us
  contactHeading: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 12 },
  contactGrid: { gap: 10 },
  contactCard: { backgroundColor: Colors.card2, borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1 },
  contactIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  contactTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  contactMeta: { color: Colors.muted, fontSize: 11, marginBottom: 4 },
  contactValue: { fontSize: 12.5, fontWeight: '700', marginBottom: 8 },
  contactCta: { fontSize: 11.5, fontWeight: '700' },
});
