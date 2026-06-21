import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { useCourseStore } from '@/store';
import { useQuiz, useExercise, useHomework, useCoins } from '@/hooks';
import { quizApi, exerciseApi, progressApi, weeklyStreakApi, aiMentorApi, mediaApi } from '@/api';
import { StorageService, DownloadService } from '@/services';
import { VideoPlayer } from '@/components/lesson/VideoPlayer';
import { PdfViewer } from '@/components/lesson/PdfViewer';
import { CoinsModal } from '@/components/common/CoinsModal';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';

type Tab = 'notes' | 'quiz' | 'exercise' | 'homework' | 'streak' | 'ai';

const WATCHLIST_KEY = 'ck_watchlist';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeLesson, activeModule, lessonContext } = useCourseStore();
  const [activeTab, setActiveTab] = useState<Tab>('notes');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [exerciseCode, setExerciseCode] = useState('');
  const [exerciseResult, setExerciseResult] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const lessonId = activeLesson?.id ?? id;
  const courseId = lessonContext?.courseId ?? '';
  const queryClient = useQueryClient();
  const [lessonCompleted, setLessonCompleted] = useState(false);

  // Invalidate dashboard when leaving lesson — so lastWatched card updates instantly
  useEffect(() => {
    return () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };
  }, []);

  // Coins
  const { data: coinsData } = useCoins();
  const totalCoins = coinsData?.totalCoins ?? 0;
  const [coinsModalVisible, setCoinsModalVisible] = useState(false);

  // AI Mentor
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // PDF Viewer
  const [pdfViewerVisible, setPdfViewerVisible] = useState(false);

  // Download status
  const [videoDownloaded, setVideoDownloaded] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [savedToWatchlist, setSavedToWatchlist] = useState(false);

  // Check download status on mount
  useEffect(() => {
    if (lessonId) {
      DownloadService.isDownloaded(lessonId, 'video').then(setVideoDownloaded);
      DownloadService.isDownloaded(lessonId, 'pdf').then(setPdfDownloaded);
      // Check watchlist
      StorageService.getObject<any[]>(WATCHLIST_KEY).then((items) => {
        setSavedToWatchlist((items ?? []).some((i) => i.lessonId === lessonId));
      });
    }
  }, [lessonId]);

  const { data: quizData } = useQuiz(lessonId);
  const { data: exerciseData } = useExercise(lessonId);
  const { data: homeworkData } = useHomework(lessonId);

  // Fetch weekly streak for this lesson
  const { data: streakData } = useQuery({
    queryKey: ['streak-lesson', lessonId],
    queryFn: () => weeklyStreakApi.getByLesson(lessonId),
    enabled: !!lessonId,
    staleTime: 1000 * 60 * 10,
  });

  const quizzes = quizData?.quizzes ?? [];
  const exercises = exerciseData?.exercises ?? [];
  const homeworks = homeworkData?.homeworks ?? [];
  const streak = streakData?.streak ?? null;

  // Streak answer state
  const [streakAnswer, setStreakAnswer] = useState('');
  const [streakSubmitting, setStreakSubmitting] = useState(false);
  const [streakResult, setStreakResult] = useState<{ passed: boolean; feedback?: string } | null>(null);

  // Mark lesson complete when 90%+ video watched
  const handleVideoComplete = useCallback(async () => {
    if (lessonCompleted || !lessonId) return;
    setLessonCompleted(true);
    try {
      await progressApi.markComplete(lessonId);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['course'] });
    } catch {
      // Silently fail - will retry next time
    }
  }, [lessonId, lessonCompleted, queryClient]);

  // Save to Watchlist
  const saveToWatchlist = async () => {
    const existing = await StorageService.getObject<any[]>(WATCHLIST_KEY) ?? [];
    const alreadySaved = existing.some(item => item.lessonId === lessonId);
    if (alreadySaved) {
      Alert.alert('Already Saved', 'This lesson is already in your watchlist.');
      return;
    }
    const newItem = {
      lessonId,
      lessonTitle: activeLesson?.title ?? 'Lesson',
      moduleTitle: activeModule?.title ?? '',
      courseId: lessonContext?.courseId ?? '',
      courseTitle: lessonContext?.courseTitle ?? '',
      savedAt: new Date().toISOString(),
    };
    await StorageService.setObject(WATCHLIST_KEY, [...existing, newItem]);
    setSavedToWatchlist(true);
    Alert.alert('Saved!', 'Lesson added to your watchlist.');
  };

  // Download Video (with signed URL)
  const downloadVideo = async () => {
    if (!activeLesson?.videoUrl) {
      Alert.alert('Error', 'No video available to download.');
      return;
    }
    if (videoDownloaded) {
      Alert.alert('Already Downloaded', 'This video is already saved for offline viewing.');
      return;
    }
    try {
      Alert.alert('Downloading...', 'Video download started.');
      await DownloadService.download({
        lessonId,
        lessonTitle: activeLesson?.title ?? 'Lesson',
        moduleTitle: activeModule?.title ?? '',
        courseId: lessonContext?.courseId ?? '',
        courseTitle: lessonContext?.courseTitle ?? '',
        type: 'video',
        url: activeLesson.videoUrl,
      });
      setVideoDownloaded(true);
      Alert.alert('Success! ✅', 'Video downloaded for offline viewing (30 days).');
    } catch (err: any) {
      Alert.alert('Download Failed', err?.message || 'Please check your internet and try again.');
    }
  };

  // AI Mentor
  const askAi = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    try {
      const res = await aiMentorApi.ask(aiQuestion, lessonId, 'lesson');
      setAiAnswer(res.answer ?? 'No response.');
    } catch {
      setAiAnswer('AI is busy. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // Notes PDF helpers
  const isPdfUrl = activeLesson?.notes?.startsWith('http');

  const viewPdf = () => {
    setPdfViewerVisible(true);
  };

  const downloadPdf = async () => {
    if (!activeLesson?.notes) return;
    if (pdfDownloaded) {
      Alert.alert('Already Downloaded', 'PDF notes already saved for offline reading.');
      return;
    }
    try {
      Alert.alert('Downloading...', 'PDF download started.');
      await DownloadService.download({
        lessonId,
        lessonTitle: activeLesson?.title ?? 'Lesson',
        moduleTitle: activeModule?.title ?? '',
        courseId: lessonContext?.courseId ?? '',
        courseTitle: lessonContext?.courseTitle ?? '',
        type: 'pdf',
        url: activeLesson.notes,
      });
      setPdfDownloaded(true);
      Alert.alert('Success! ✅', 'PDF notes downloaded for offline reading (30 days).');
    } catch (err: any) {
      Alert.alert('Download Failed', err?.message || 'Please check your internet and try again.');
    }
  };

  const handleQuizSubmit = async () => {
    if (selectedOption === null || quizzes.length === 0) return;
    setQuizSubmitted(true);
    const currentQuiz = quizzes[currentQuizIndex];
    if (courseId && currentQuiz) {
      try {
        await quizApi.submitAttempt({
          quizId: currentQuiz.id,
          selected: selectedOption,
          courseId,
          lessonId,
        });
      } catch {}
    }
  };

  const handleExerciseSubmit = async (exercise: any) => {
    if (!exerciseCode.trim()) {
      Alert.alert('Error', 'Please write your solution first.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await exerciseApi.submitAttempt({
        exerciseId: exercise.id,
        code: exerciseCode,
        courseId,
      });
      setExerciseResult(res.passed ? '✅ Correct! Well done!' : `⚠️ ${res.message ?? 'Not quite right. Try again!'}`);
    } catch {
      setExerciseResult('✅ Solution submitted!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStreakSubmit = async () => {
    if (!streakAnswer.trim() || !streak) return;
    setStreakSubmitting(true);
    try {
      const res = await weeklyStreakApi.submit(streak.id, streakAnswer.trim());
      setStreakResult({ passed: res.passed, feedback: res.feedback });
    } catch {
      setStreakResult({ passed: false, feedback: 'Failed to submit. Try again.' });
    } finally {
      setStreakSubmitting(false);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'notes', label: '📄 Notes' },
    { key: 'quiz', label: '🧠 Quiz' },
    { key: 'exercise', label: '💻 Exercise' },
    { key: 'homework', label: '📝 Homework' },
    ...(streak ? [{ key: 'streak' as Tab, label: '🔥 Streak' }] : []),
    { key: 'ai', label: '🤖 AI' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.lessonTitle} numberOfLines={1}>
          {activeLesson?.title ?? 'Lesson'}
        </Text>
      </View>

      {/* Video Player */}
      <VideoPlayer
        videoUrl={activeLesson?.videoUrl ?? ''}
        title={activeLesson?.title}
        qualityUrls={activeLesson?.qualityUrls}
        hlsQualities={activeLesson?.hlsQualities}
        onComplete={handleVideoComplete}
      />

      {/* Action Toolbar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={saveToWatchlist}>
          <Text style={styles.actionIcon}>{savedToWatchlist ? '✅' : '📌'}</Text>
          <Text style={[styles.actionLabel, savedToWatchlist && { color: Colors.success }]}>
            {savedToWatchlist ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={downloadVideo}>
          <Text style={styles.actionIcon}>{videoDownloaded ? '✅' : '⬇️'}</Text>
          <Text style={[styles.actionLabel, videoDownloaded && { color: Colors.success }]}>
            {videoDownloaded ? 'Downloaded' : 'Download'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setCoinsModalVisible(true)}>
          <Text style={styles.actionIcon}>🪙</Text>
          <Text style={styles.actionLabel}>{totalCoins}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📄 Lesson Notes</Text>
            {activeLesson?.notes ? (
              isPdfUrl ? (
                <View>
                  <Text style={styles.notesText}>PDF notes are available for this lesson.</Text>
                  <View style={styles.pdfBtnRow}>
                    <TouchableOpacity style={styles.pdfBtn} onPress={viewPdf}>
                      <Text style={styles.pdfBtnText}>📄 View PDF Notes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.pdfBtn, styles.pdfBtnDownload]} onPress={downloadPdf}>
                      <Text style={[styles.pdfBtnText, styles.pdfBtnTextDownload]}>
                        {pdfDownloaded ? '✅ Downloaded' : '⬇️ Download PDF'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.notesText}>{activeLesson.notes}</Text>
              )
            ) : (
              <Text style={styles.emptyText}>No notes available for this lesson yet.</Text>
            )}
          </View>
        )}

        {/* Quiz Tab */}
        {activeTab === 'quiz' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🧠 Quiz</Text>
            {quizzes.length > 0 ? (
              <View>
                <Text style={styles.quizCounter}>
                  Question {currentQuizIndex + 1} of {quizzes.length}
                </Text>
                <Text style={styles.question}>{quizzes[currentQuizIndex].question}</Text>
                {quizzes[currentQuizIndex].options.map((opt, i) => {
                  let bg = Colors.card;
                  let border = Colors.border;
                  if (quizSubmitted) {
                    if (i === quizzes[currentQuizIndex].answer) { bg = Colors.successLight; border = Colors.success; }
                    else if (i === selectedOption) { bg = Colors.dangerLight; border = Colors.danger; }
                  } else if (i === selectedOption) {
                    bg = Colors.primaryLight; border = Colors.primary;
                  }
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.option, { backgroundColor: bg, borderColor: border }]}
                      onPress={() => !quizSubmitted && setSelectedOption(i)}
                      disabled={quizSubmitted}
                    >
                      <Text style={styles.optionLetter}>{['A','B','C','D'][i]}</Text>
                      <Text style={styles.optionText}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}

                {!quizSubmitted ? (
                  <TouchableOpacity
                    style={[styles.submitBtn, selectedOption === null && styles.submitBtnDisabled]}
                    onPress={handleQuizSubmit}
                    disabled={selectedOption === null}
                  >
                    <Text style={styles.submitBtnText}>Check Answer</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <View style={[
                      styles.result,
                      selectedOption === quizzes[currentQuizIndex].answer ? styles.resultCorrect : styles.resultWrong,
                    ]}>
                      <Text style={styles.resultText}>
                        {selectedOption === quizzes[currentQuizIndex].answer ? '🎉 Correct!' : '❌ Incorrect.'}
                      </Text>
                    </View>

                    {currentQuizIndex < quizzes.length - 1 ? (
                      <TouchableOpacity
                        style={[styles.submitBtn, { marginTop: 12, backgroundColor: Colors.success }]}
                        onPress={() => {
                          setCurrentQuizIndex(currentQuizIndex + 1);
                          setSelectedOption(null);
                          setQuizSubmitted(false);
                        }}
                      >
                        <Text style={styles.submitBtnText}>Next Question →</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.result, styles.resultCorrect, { marginTop: 12 }]}>
                        <Text style={styles.resultText}>🎉 Quiz Complete! All {quizzes.length} questions attempted.</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.emptyText}>Quiz coming soon for this lesson.</Text>
            )}
          </View>
        )}

        {/* Exercise Tab */}
        {activeTab === 'exercise' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💻 Practice Exercise</Text>
            {exercises.length > 0 ? exercises.map((ex) => (
              <View key={ex.id} style={styles.exerciseBlock}>
                <Text style={styles.question}>{ex.description}</Text>
                {ex.hints && ex.hints.length > 0 && (
                  <View style={styles.hint}>
                    <Text style={styles.hintText}>💡 {ex.hints[0]}</Text>
                  </View>
                )}
                <Text style={styles.codeLabel}>Your Code:</Text>
                <TextInput
                  style={styles.codeInput}
                  placeholder={ex.starterCode ?? 'Write your solution here...'}
                  placeholderTextColor={Colors.muted}
                  value={exerciseCode}
                  onChangeText={setExerciseCode}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                  onPress={() => handleExerciseSubmit(ex)}
                  disabled={submitting}
                >
                  <Text style={styles.submitBtnText}>{submitting ? 'Checking...' : 'Submit Solution'}</Text>
                </TouchableOpacity>
                {exerciseResult ? (
                  <Text style={[
                    styles.resultText,
                    { color: exerciseResult.startsWith('✅') ? Colors.success : Colors.warning },
                  ]}>
                    {exerciseResult}
                  </Text>
                ) : null}
              </View>
            )) : (
              <Text style={styles.emptyText}>Exercise coming soon for this lesson.</Text>
            )}
          </View>
        )}

        {/* Homework Tab */}
        {activeTab === 'homework' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📝 Homework</Text>
            {homeworks.length > 0 ? homeworks.map((hw, i) => (
              <View key={hw.id} style={styles.hwBlock}>
                <View style={styles.hwHeader}>
                  <Text style={styles.question}>Q{i + 1}. {hw.title}</Text>
                  <View style={[styles.diffBadge, {
                    backgroundColor: hw.difficulty === 'easy' ? Colors.successLight :
                      hw.difficulty === 'hard' ? Colors.dangerLight : Colors.warningLight,
                  }]}>
                    <Text style={[styles.diffText, {
                      color: hw.difficulty === 'easy' ? Colors.success :
                        hw.difficulty === 'hard' ? Colors.danger : Colors.warning,
                    }]}>
                      {hw.difficulty}
                    </Text>
                  </View>
                </View>
                <Text style={styles.notesText}>{hw.description}</Text>
              </View>
            )) : (
              <Text style={styles.emptyText}>No homework for this lesson yet.</Text>
            )}
            {homeworks.length > 0 && (
              <Text style={styles.hwNote}>ℹ️ Practice problems — no submission required</Text>
            )}
          </View>
        )}

        {/* Streak Tab */}
        {activeTab === 'streak' && streak && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔥 Weekly Streak Challenge</Text>
            <View style={styles.streakWeekBadge}>
              <Text style={styles.streakWeekText}>Week {streak.weekNumber}</Text>
            </View>
            <Text style={styles.question}>{streak.title}</Text>
            {streak.description ? (
              <Text style={styles.notesText}>{streak.description}</Text>
            ) : null}
            <View style={styles.streakProblemBox}>
              <Text style={styles.streakProblemLabel}>Problem:</Text>
              <Text style={styles.streakProblemText}>{streak.problem}</Text>
            </View>
            
            {!streakResult ? (
              <View>
                <Text style={styles.codeLabel}>Your Answer:</Text>
                <TextInput
                  style={styles.codeInput}
                  placeholder="Write your answer here..."
                  placeholderTextColor={Colors.muted}
                  value={streakAnswer}
                  onChangeText={setStreakAnswer}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.submitBtn, (streakSubmitting || !streakAnswer.trim()) && styles.submitBtnDisabled]}
                  onPress={handleStreakSubmit}
                  disabled={streakSubmitting || !streakAnswer.trim()}
                >
                  <Text style={styles.submitBtnText}>
                    {streakSubmitting ? 'Checking...' : 'Submit Answer'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[
                styles.result,
                streakResult.passed ? styles.resultCorrect : styles.resultWrong,
              ]}>
                <Text style={styles.resultText}>
                  {streakResult.passed ? '🎉 Streak Complete! Well done!' : '❌ Not quite right.'}
                </Text>
                {streakResult.feedback ? (
                  <Text style={[styles.notesText, { marginTop: 8 }]}>{streakResult.feedback}</Text>
                ) : null}
              </View>
            )}
          </View>
        )}

        {/* AI Mentor Tab */}
        {activeTab === 'ai' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🤖 AI Mentor</Text>
            <View style={styles.aiInputRow}>
              <TextInput
                style={styles.aiInput}
                placeholder="Ask anything about this lesson"
                placeholderTextColor={Colors.muted}
                value={aiQuestion}
                onChangeText={setAiQuestion}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.aiSendBtn, (!aiQuestion.trim() || aiLoading) && styles.submitBtnDisabled]}
                onPress={askAi}
                disabled={!aiQuestion.trim() || aiLoading}
              >
                <Text style={styles.aiSendText}>{aiLoading ? '...' : 'Ask'}</Text>
              </TouchableOpacity>
            </View>
            {aiAnswer ? (
              <View style={styles.aiAnswer}>
                <Text style={styles.aiAnswerText}>{aiAnswer}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={{ height: activeTab === 'ai' ? 300 : Spacing.xxxl }} />
      </ScrollView>

      {/* Coins Modal */}
      <CoinsModal visible={coinsModalVisible} onClose={() => setCoinsModalVisible(false)} />

      {/* PDF Viewer Modal */}
      <PdfViewer
        visible={pdfViewerVisible}
        pdfUrl={activeLesson?.notes ?? ''}
        onClose={() => setPdfViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backText: { color: Colors.primary, fontSize: 20, fontWeight: FontWeight.semibold },
  lessonTitle: { flex: 1, color: Colors.white, fontSize: Typography.base, fontWeight: FontWeight.bold },
  actionBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionIcon: { fontSize: 18 },
  actionLabel: { color: Colors.muted, fontSize: 10, fontWeight: '600' },
  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.cardAlt,
  },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { color: Colors.muted, fontSize: Typography.xs, fontWeight: FontWeight.medium },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  tabContent: { flex: 1 },
  card: {
    margin: Spacing.xl, backgroundColor: Colors.card,
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { color: Colors.white, fontSize: Typography.md, fontWeight: FontWeight.bold, marginBottom: Spacing.lg },
  notesText: { color: Colors.text, fontSize: Typography.sm, lineHeight: 22 },
  emptyText: { color: Colors.muted, fontSize: Typography.sm, textAlign: 'center', paddingVertical: Spacing.xxxl },
  quizCounter: { color: Colors.muted, fontSize: Typography.xs, fontWeight: FontWeight.semibold, marginBottom: Spacing.md },
  question: { color: Colors.white, fontSize: Typography.base, fontWeight: FontWeight.semibold, marginBottom: Spacing.lg, lineHeight: 22 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1,
  },
  optionLetter: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.bg, color: Colors.white,
    fontSize: Typography.sm, fontWeight: FontWeight.bold,
    textAlign: 'center', lineHeight: 28,
  },
  optionText: { flex: 1, color: Colors.white, fontSize: Typography.sm },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.white, fontSize: Typography.base, fontWeight: FontWeight.bold },
  result: { borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md, borderWidth: 1 },
  resultCorrect: { backgroundColor: Colors.successLight, borderColor: Colors.success },
  resultWrong: { backgroundColor: Colors.dangerLight, borderColor: Colors.danger },
  resultText: { color: Colors.white, fontSize: Typography.sm, fontWeight: FontWeight.semibold },
  exerciseBlock: { marginBottom: Spacing.xl },
  hint: {
    backgroundColor: Colors.warningLight, borderRadius: Radius.sm,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  hintText: { color: Colors.warning, fontSize: Typography.sm },
  codeLabel: { color: Colors.muted, fontSize: Typography.xs, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  codeInput: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, color: Colors.purple,
    fontSize: Typography.sm, fontFamily: 'monospace', minHeight: 120,
    textAlignVertical: 'top',
  },
  hwBlock: { marginBottom: Spacing.lg, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hwHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  diffBadge: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  diffText: { fontSize: Typography.xs, fontWeight: FontWeight.bold, textTransform: 'capitalize' },
  hwNote: { color: Colors.muted, fontSize: Typography.xs, textAlign: 'center', marginTop: Spacing.md },
  streakWeekBadge: { alignSelf: 'flex-start', backgroundColor: Colors.dangerLight, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 4, marginBottom: Spacing.md },
  streakWeekText: { color: Colors.danger, fontSize: Typography.xs, fontWeight: FontWeight.bold },
  streakProblemBox: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: Radius.md, padding: Spacing.md, marginVertical: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  streakProblemLabel: { color: Colors.warning, fontSize: Typography.xs, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  streakProblemText: { color: Colors.text, fontSize: Typography.sm, lineHeight: 22 },
  pdfBtnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.md,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.primary,
  },
  pdfBtnDownload: {
    backgroundColor: Colors.successLight, borderColor: Colors.success,
  },
  pdfBtnText: { color: Colors.primary, fontSize: Typography.sm, fontWeight: FontWeight.bold },
  pdfBtnTextDownload: { color: Colors.success },
  aiInputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  aiInput: {
    flex: 1, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, color: Colors.white, fontSize: Typography.sm,
  },
  aiSendBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 16, justifyContent: 'center' },
  aiSendText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: Typography.sm },
  aiAnswer: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, marginTop: 12, borderWidth: 1, borderColor: Colors.border },
  aiAnswerText: { color: Colors.text, fontSize: Typography.sm, lineHeight: 22 },
});
