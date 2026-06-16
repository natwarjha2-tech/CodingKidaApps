import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/theme';

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'How do I enroll in a course?',
    answer: 'Go to Courses tab, select a course, and tap Enroll.',
  },
  {
    question: 'How do I earn coins?',
    answer: 'Complete quizzes and rank in the top 3 to earn coins.',
  },
  {
    question: 'How do I redeem coins?',
    answer: '100+ coins can be redeemed for ₹ discount on paid courses.',
  },
  {
    question: 'What are achievements?',
    answer: 'Rank Super-Master, Master, or Pro in quizzes to earn achievement badges.',
  },
  {
    question: 'How do I contact support?',
    answer: 'Email us at support@codingkida.com or reach out on WhatsApp.',
  },
];

export default function HelpSupportScreen() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

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
        {/* Contact Card */}
        <View style={styles.contactCard}>
          <Text style={styles.contactEmoji}>💬</Text>
          <Text style={styles.contactTitle}>Connect with our support team</Text>
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Email:</Text>
            <Text style={styles.contactValue}>support@codingkida.com</Text>
          </View>
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Response time:</Text>
            <Text style={styles.contactValue}>Under 5 minutes</Text>
          </View>
        </View>

        {/* FAQ Section */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {faqItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.faqCard}
            onPress={() => toggleFAQ(index)}
            activeOpacity={0.7}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <Text style={styles.faqToggle}>
                {expandedIndex === index ? '−' : '+'}
              </Text>
            </View>
            {expandedIndex === index && (
              <View style={styles.faqAnswerWrap}>
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Additional Help */}
        <View style={styles.helpCard}>
          <Text style={styles.helpEmoji}>🤝</Text>
          <Text style={styles.helpTitle}>Still need help?</Text>
          <Text style={styles.helpText}>
            Our support team is available 24/7 to assist you with any questions or issues.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { color: Colors.primary, fontSize: 20, fontWeight: '600', paddingRight: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { padding: 16 },

  // Contact Card
  contactCard: {
    backgroundColor: Colors.card2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  contactEmoji: { fontSize: 36, marginBottom: 12 },
  contactTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    width: '100%',
    justifyContent: 'center',
  },
  contactLabel: { color: Colors.muted, fontSize: 13 },
  contactValue: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  // FAQ
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  faqCard: {
    backgroundColor: Colors.card2,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 12 },
  faqToggle: { color: Colors.primary, fontSize: 20, fontWeight: '700' },
  faqAnswerWrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  faqAnswer: { color: Colors.muted, fontSize: 13, lineHeight: 20 },

  // Help Card
  helpCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 20,
    marginTop: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108,71,255,0.3)',
  },
  helpEmoji: { fontSize: 32, marginBottom: 10 },
  helpTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  helpText: { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
