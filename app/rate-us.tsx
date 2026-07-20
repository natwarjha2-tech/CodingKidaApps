import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api';
import { Colors } from '@/theme';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function RateUsScreen() {
  const queryClient = useQueryClient();
  const [selectedRating, setSelectedRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);

  // Fetch existing app reviews
  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['app-ratings'],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean; avgRating: number; totalReviews: number;
        ratingCounts: Record<string, number>; reviews: any[];
      }>('/api/feedback/lesson?lessonId=app_rating');
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
  });

  const handleSubmit = async () => {
    if (selectedRating === 0) { setMessage({ text: 'Please select a rating', success: false }); return; }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>('/api/feedback', {
        rating: selectedRating, feedback: feedback.trim(),
        lessonId: 'app_rating', lessonTitle: 'App Rating',
      });
      if (res.data?.success) {
        setMessage({ text: '🎉 Thank you for your feedback!', success: true });
        setFeedback('');
        setSelectedRating(0);
        queryClient.invalidateQueries({ queryKey: ['app-ratings'] });
      } else {
        setMessage({ text: `❌ ${res.data?.message || 'Failed'}`, success: false });
      }
    } catch (err: any) {
      setMessage({ text: `❌ ${err?.response?.data?.message || 'Network error'}`, success: false });
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating = reviewsData?.avgRating ?? 0;
  const totalReviews = reviewsData?.totalReviews ?? 0;
  const ratingCounts = reviewsData?.ratingCounts ?? {};
  const reviews = reviewsData?.reviews ?? [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Us</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Rating Input */}
        <View style={styles.rateCard}>
          <Text style={styles.rateTitle}>How would you rate CodingKida?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setSelectedRating(star)}>
                <Text style={[styles.star, star <= selectedRating && styles.starActive]}>
                  {star <= selectedRating ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.feedbackInput}
            placeholder="Share your experience (optional)"
            placeholderTextColor={Colors.muted}
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Rating</Text>
            )}
          </TouchableOpacity>
          {message && (
            <Text style={[styles.message, { color: message.success ? Colors.success : Colors.danger }]}>
              {message.text}
            </Text>
          )}
        </View>

        {/* Reviews Summary */}
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
        ) : totalReviews > 0 ? (
          <View style={styles.reviewsCard}>
            <View style={styles.reviewsSummary}>
              <View style={styles.avgSection}>
                <Text style={styles.avgValue}>{avgRating}</Text>
                <Text style={styles.avgLabel}>{totalReviews} review{totalReviews > 1 ? 's' : ''}</Text>
              </View>
              <View style={{ flex: 1 }}>
                {[5, 4, 3, 2, 1].map((s) => {
                  const count = ratingCounts[s] || 0;
                  const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                  return (
                    <View key={s} style={styles.barRow}>
                      <Text style={styles.barLabel}>{s}★</Text>
                      <View style={styles.barBg}>
                        <View style={[styles.barFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.barCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Recent Reviews */}
            {reviews.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={styles.recentTitle}>Recent Reviews</Text>
                {reviews.slice(0, 8).map((r: any, idx: number) => (
                  <View key={idx} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewName}>{r.studentName || 'Student'}</Text>
                      <Text style={styles.reviewDate}>{formatDate(r.createdAt)}</Text>
                    </View>
                    <Text style={styles.reviewStars}>
                      {Array.from({ length: 5 }, (_, i) => i < r.rating ? '★' : '☆').join('')}
                    </Text>
                    {r.feedback ? <Text style={styles.reviewText}>{r.feedback}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyReviews}>
            <Text style={styles.emptyText}>No reviews yet. Be the first to rate!</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
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
  content: { padding: 16 },

  // Rate Card
  rateCard: {
    backgroundColor: Colors.card2, borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  rateTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  star: { fontSize: 36, color: 'rgba(255,255,255,0.3)' },
  starActive: { color: '#fbbf24' },
  feedbackInput: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14,
    textAlignVertical: 'top', marginBottom: 16, minHeight: 80,
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14,
    paddingHorizontal: 32, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  message: { marginTop: 12, fontSize: 13, fontWeight: '600' },

  // Reviews Card
  reviewsCard: {
    backgroundColor: Colors.card2, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  reviewsSummary: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  avgSection: { alignItems: 'center' },
  avgValue: { fontSize: 32, fontWeight: '800', color: '#fbbf24', marginBottom: 2 },
  avgLabel: { fontSize: 11, color: Colors.muted },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  barLabel: { fontSize: 10, color: Colors.muted, width: 18 },
  barBg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3, backgroundColor: '#fbbf24' },
  barCount: { fontSize: 10, color: Colors.muted, width: 18, textAlign: 'right' },

  // Recent reviews
  recentSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14, marginTop: 14 },
  recentTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 12 },
  reviewItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  reviewName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  reviewDate: { color: Colors.muted, fontSize: 11 },
  reviewStars: { color: '#fbbf24', fontSize: 12, marginBottom: 3 },
  reviewText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 18 },

  // Empty
  emptyReviews: { alignItems: 'center', padding: 24, backgroundColor: Colors.card2, borderRadius: 14, borderWidth: 1, borderColor: Colors.border },
  emptyText: { color: Colors.muted, fontSize: 13 },
});
