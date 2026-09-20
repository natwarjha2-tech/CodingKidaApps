import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Keyboard, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { useCourseStore, useAuthStore } from '@/store';
import { useQuiz, useExercise, useHomework, useCoins } from '@/hooks';
import { quizApi, exerciseApi, progressApi, weeklyStreakApi, mediaApi, lessonApi, feedbackApi, leaderboardApi, type LessonReviewsData } from '@/api';
import { StorageService, DownloadService, XPService, XP_REWARDS } from '@/services';
import { userScopedKey } from '@/services/storage.service';
import { VideoPlayer } from '@/components/lesson/VideoPlayer';
import { PdfViewer } from '@/components/lesson/PdfViewer';
import { CoinsModal } from '@/components/common/CoinsModal';
import { CoinRewardToast } from '@/components/common/CoinRewardToast';
import { getWatchlist, setWatchlist } from '@/utils/watchlist.util';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';

type Tab = 'notes' | 'quiz' | 'exercise' | 'homework' | 'streak' | 'rate';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeLesson, activeModule, lessonContext } = useCourseStore();
  const xpUserId = useAuthStore((s) => s.user?.id);
  const [activeTab, setActiveTab] = useState<Tab>('notes');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizAttemptedBefore, setQuizAttemptedBefore] = useState(false);
  const [exerciseAnswers, setExerciseAnswers] = useState<Record<string, string>>({});
  const [exerciseResults, setExerciseResults] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Coin reward toast (after quiz awards coins — mirrors desktop)
  const [coinToast, setCoinToast] = useState<{ coins: number; badge?: string; rank?: number } | null>(null);
  // Exercise rank (course-level) — shown after a submission (mirrors desktop)
  const [exerciseRank, setExerciseRank] = useState<{ rank: number; totalStudents: number; score: number } | null>(null);
  const [exerciseRankLoading, setExerciseRankLoading] = useState(false);
  const [exerciseRankLoaded, setExerciseRankLoaded] = useState(false);

  const lessonId = activeLesson?.id ?? id;
  const courseId = lessonContext?.courseId ?? '';
  const queryClient = useQueryClient();
  const [lessonCompleted, setLessonCompleted] = useState(false);

  // Video engagement: like/dislike reactions + view count (mirrors desktop)
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [views, setViews] = useState(0);
  const [userReaction, setUserReaction] = useState<'like' | 'dislike' | null>(null);
  const viewRecorded = useRef(false);

  // Per-lesson rating (Rate tab) — mirrors desktop
  const [lessonRating, setLessonRating] = useState(0);
  const [rateFeedback, setRateFeedback] = useState('');
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const [rateMessage, setRateMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [reviewsData, setReviewsData] = useState<LessonReviewsData | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Invalidate dashboard when leaving lesson — so lastWatched card updates instantly
  useEffect(() => {
    return () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };
  }, []);

  // Load XP state for the current user (frontend gamification)
  useEffect(() => {
    if (xpUserId) XPService.init(xpUserId);
  }, [xpUserId]);

  // Coins
  const { data: coinsData } = useCoins();
  const totalCoins = coinsData?.totalCoins ?? 0;
  const [coinsModalVisible, setCoinsModalVisible] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // Track keyboard visibility — collapse video when keyboard is open (like YouTube)
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // PDF Viewer
  const [pdfViewerVisible, setPdfViewerVisible] = useState(false);

  // Download status
  const [videoDownloaded, setVideoDownloaded] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [savedToWatchlist, setSavedToWatchlist] = useState(false);

  // Selected video quality (from the player) — download uses exactly this quality.
  const [selectedQuality, setSelectedQuality] = useState('Original');
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

  // Check download status on mount
  useEffect(() => {
    if (lessonId) {
      DownloadService.isDownloaded(lessonId, 'video').then(setVideoDownloaded);
      DownloadService.isDownloaded(lessonId, 'pdf').then(setPdfDownloaded);
      // Check watchlist (user-scoped)
      getWatchlist().then((items) => {
        setSavedToWatchlist(items.some((i) => i.lessonId === lessonId));
      });
    }
  }, [lessonId]);

  const { data: quizData } = useQuiz(lessonId);
  const { data: exerciseData } = useExercise(lessonId);
  const { data: homeworkData } = useHomework(lessonId);

  // Check if quiz was previously attempted for this lesson (user-scoped key so
  // different users on the same device don't share attempted/completed state).
  useEffect(() => {
    if (lessonId) {
      userScopedKey('ck_quiz_attempted_lessons').then((key) =>
        StorageService.getObject<string[]>(key).then((attempted) => {
          if (attempted && attempted.includes(lessonId)) {
            setQuizAttemptedBefore(true);
          }
        })
      );
    }
  }, [lessonId]);

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
    // Award XP for completing the lesson (once per lesson — anti-farming key)
    XPService.awardXP(`lesson-complete:${lessonId}`, XP_REWARDS.lessonComplete);
    try {
      await progressApi.markComplete(lessonId);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['course'] });
    } catch {
      // Silently fail - will retry next time
    }
  }, [lessonId, lessonCompleted, queryClient]);

  // Load like/dislike/view counts + user's current reaction (mirrors desktop)
  useEffect(() => {
    if (!lessonId) return;
    viewRecorded.current = false;
    let cancelled = false;
    lessonApi.getReactions(lessonId)
      .then((data) => {
        if (cancelled || !data?.success) return;
        setLikes(data.likes || 0);
        setDislikes(data.dislikes || 0);
        setViews(data.views || 0);
        setUserReaction(data.userReaction ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lessonId]);

  // Toggle like/dislike reaction
  const handleReact = useCallback(async (type: 'like' | 'dislike') => {
    if (!lessonId) return;
    try {
      const data = await lessonApi.react(lessonId, type);
      if (data?.success) {
        setLikes(data.likes || 0);
        setDislikes(data.dislikes || 0);
        setUserReaction(data.userReaction ?? null);
      }
    } catch {
      // Silent — reaction failure must not disrupt lesson
    }
  }, [lessonId]);

  // Record a view after ~30s watch time (fired once per lesson open)
  const handleViewCounted = useCallback(() => {
    if (viewRecorded.current || !lessonId) return;
    viewRecorded.current = true;
    setViews((v) => v + 1); // optimistic
    lessonApi.recordView(lessonId).catch(() => {});
  }, [lessonId]);

  // Award XP once when the lesson is ~80% watched (mirrors desktop lessonWatch80)
  const handleVideoProgress = useCallback((percent: number) => {
    if (percent >= 80 && lessonId) {
      XPService.awardXP(`lesson-watch:${lessonId}`, XP_REWARDS.lessonWatch80);
    }
  }, [lessonId]);

  // Load lesson reviews (called when Rate tab opens)
  const loadLessonReviews = useCallback(async () => {
    if (!lessonId) return;
    setReviewsLoading(true);
    try {
      const data = await feedbackApi.getLessonReviews(lessonId);
      if (data?.success) setReviewsData(data);
    } catch {
      // Silent — reviews are non-critical
    } finally {
      setReviewsLoading(false);
    }
  }, [lessonId]);

  // Load reviews the first time the Rate tab is opened
  useEffect(() => {
    if (activeTab === 'rate' && !reviewsData && !reviewsLoading) {
      loadLessonReviews();
    }
  }, [activeTab, reviewsData, reviewsLoading, loadLessonReviews]);

  // Submit lesson rating (mirrors desktop wording/behaviour)
  const handleSubmitLessonRating = useCallback(async () => {
    if (lessonRating === 0) {
      setRateMessage({ text: 'Please select a star rating', success: false });
      return;
    }
    setRateSubmitting(true);
    setRateMessage(null);
    try {
      const data = await feedbackApi.submit({
        rating: lessonRating,
        feedback: rateFeedback.trim(),
        lessonId,
        lessonTitle: activeLesson?.title ?? '',
      });
      if (data?.success) {
        setRateMessage({ text: '🎉 Thank you! Your rating has been submitted.', success: true });
        setRateFeedback('');
        setLessonRating(0);
        // Refresh the reviews list in the background — do NOT await, so the
        // success message shows instantly (the reviews query can be slow).
        void loadLessonReviews();
      } else {
        setRateMessage({ text: `❌ ${data?.message || 'Failed'}`, success: false });
      }
    } catch (err: any) {
      setRateMessage({ text: `❌ ${err?.response?.data?.message || 'Network error'}`, success: false });
    } finally {
      setRateSubmitting(false);
    }
  }, [lessonRating, rateFeedback, lessonId, activeLesson?.title, loadLessonReviews]);

  // Save to Watchlist (user-scoped)
  const saveToWatchlist = async () => {
    const existing = await getWatchlist();
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
    await setWatchlist([...existing, newItem]);
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
      // Download the quality the user currently selected in the player (mirrors
      // desktop). Falls back to the Original URL if no quality was switched.
      const dlUrl = selectedVideoUrl || activeLesson.videoUrl;
      Alert.alert('Downloading...', `Video download started${selectedQuality !== 'Original' ? ` (${selectedQuality})` : ''}.`);
      await DownloadService.download({
        lessonId,
        lessonTitle: activeLesson?.title ?? 'Lesson',
        moduleTitle: activeModule?.title ?? '',
        courseId: lessonContext?.courseId ?? '',
        courseTitle: lessonContext?.courseTitle ?? '',
        type: 'video',
        url: dlUrl,
        quality: selectedQuality,
      });
      setVideoDownloaded(true);
      Alert.alert('Success! ✅', `Video downloaded for offline viewing (${selectedQuality}, 30 days).`);
    } catch (err: any) {
      Alert.alert('Download Failed', err?.message || 'Please check your internet and try again.');
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
    const isCorrect = selectedOption === currentQuiz.answer;

    // Track score
    setQuizScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));

    // Award XP per correct answer (unique key per quiz question)
    if (isCorrect) {
      XPService.awardXP(`quiz-correct:${currentQuiz.id}`, XP_REWARDS.quizCorrect);
    }

    // Check if this is last question
    if (currentQuizIndex === quizzes.length - 1) {
      setQuizCompleted(true);
      // Award XP for completing the quiz (once per lesson quiz)
      XPService.awardXP(`quiz-complete:${lessonId}`, XP_REWARDS.quizComplete);
      // Mark lesson quiz as attempted (prevents future coin rewards) — user-scoped
      if (!quizAttemptedBefore) {
        const key = await userScopedKey('ck_quiz_attempted_lessons');
        const attempted = await StorageService.getObject<string[]>(key) ?? [];
        if (!attempted.includes(lessonId)) {
          attempted.push(lessonId);
          await StorageService.setObject(key, attempted);
        }
      }
    }

    // Submit to backend (only awards coins on first attempt — backend enforces this)
    if (courseId && currentQuiz) {
      try {
        const res = await quizApi.submitAttempt({
          quizId: currentQuiz.id,
          selected: selectedOption,
          courseId,
          lessonId,
        });
        // Instantly refresh coins if awarded + show reward toast (mirrors desktop)
        if (res.coinsAwarded && res.coinsAwarded > 0) {
          queryClient.invalidateQueries({ queryKey: ['coins'] });
          setCoinToast({ coins: res.coinsAwarded, badge: res.badge, rank: res.rank });
        }
      } catch {}
    }
  };

  // Fetch course-level exercise rank (mirrors desktop fetchAndShowExerciseRank)
  const fetchExerciseRank = useCallback(async () => {
    if (!courseId) return;
    setExerciseRankLoading(true);
    setExerciseRankLoaded(true);
    try {
      const data = await leaderboardApi.get(courseId);
      if (data?.success && data.currentUserRank) {
        const r = data.currentUserRank;
        setExerciseRank({ rank: r.rank, totalStudents: r.totalStudents, score: r.score });
      } else {
        setExerciseRank(null);
      }
    } catch {
      // Silent — rank is non-critical
    } finally {
      setExerciseRankLoading(false);
    }
  }, [courseId]);

  const handleExerciseSubmit = async (exercise: any) => {
    const answer = exerciseAnswers[exercise.id] || '';
    if (!answer.trim()) {
      Alert.alert('Error', 'Please type your answer first.');
      return;
    }
    setSubmitting(true);
    setExerciseResults(prev => ({ ...prev, [exercise.id]: '' }));
    try {
      const res = await exerciseApi.submitAttempt({
        exerciseId: exercise.id,
        code: answer,
        courseId,
      });
      if (res.passed) {
        setExerciseResults(prev => ({ ...prev, [exercise.id]: '✅ Correct Answer! Well done!' }));
        // Award XP for passing the exercise (once per exercise)
        XPService.awardXP(`exercise-complete:${exercise.id}`, XP_REWARDS.exerciseComplete);
      } else {
        setExerciseResults(prev => ({ ...prev, [exercise.id]: `❌ Incorrect Answer: ${res.message || 'Try Again'}` }));
      }
    } catch {
      setExerciseResults(prev => ({ ...prev, [exercise.id]: '✅ Answer submitted for evaluation.' }));
    } finally {
      setSubmitting(false);
      fetchExerciseRank(); // show/refresh exercise rank after submission
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
    { key: 'rate', label: '⭐ Rate' },
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

      {/* Video Player — collapses when keyboard is open for more scroll space */}
      {!keyboardVisible && (
        <VideoPlayer
          videoUrl={activeLesson?.videoUrl ?? ''}
          title={activeLesson?.title}
          qualityUrls={activeLesson?.qualityUrls}
          onQualityChange={(q, url) => { setSelectedQuality(q); setSelectedVideoUrl(url); }}
          hlsQualities={activeLesson?.hlsQualities}
          onComplete={handleVideoComplete}
          onViewCounted={handleViewCounted}
          onProgress={handleVideoProgress}
        />
      )}

      {/* Engagement bar: like / dislike / views (mirrors desktop) */}
      {!keyboardVisible && activeLesson?.videoUrl ? (
        <View style={styles.engagementBar}>
          <TouchableOpacity
            style={[styles.engBtn, userReaction === 'like' && styles.engBtnLike]}
            onPress={() => handleReact('like')}
            activeOpacity={0.7}
          >
            <Text style={[styles.engIcon, userReaction === 'like' && { color: Colors.success }]}>👍</Text>
            <Text style={[styles.engCount, userReaction === 'like' && { color: Colors.success }]}>{likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.engBtn, userReaction === 'dislike' && styles.engBtnDislike]}
            onPress={() => handleReact('dislike')}
            activeOpacity={0.7}
          >
            <Text style={[styles.engIcon, userReaction === 'dislike' && { color: Colors.danger }]}>👎</Text>
            <Text style={[styles.engCount, userReaction === 'dislike' && { color: Colors.danger }]}>{dislikes}</Text>
          </TouchableOpacity>
          <View style={styles.engViews}>
            <Text style={styles.engIcon}>👁️</Text>
            <Text style={styles.engCount}>{views} views</Text>
          </View>
        </View>
      ) : null}

      {/* Action Toolbar — hidden when keyboard open */}
      {!keyboardVisible && (
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
      )}

      {/* Tabs — single horizontal line, equal gap, no wrap (each tab sizes to
          its label; scrolls horizontally if they don't all fit the screen). */}
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text numberOfLines={1} style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab Content */}
      <ScrollView ref={scrollViewRef} style={styles.tabContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>

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
                {/* Previously attempted warning */}
                {quizAttemptedBefore && !quizCompleted && (
                  <View style={[styles.result, { backgroundColor: Colors.warningLight, borderColor: Colors.warning, marginBottom: 12, marginTop: 0 }]}>
                    <Text style={[styles.resultText, { color: Colors.warning, fontWeight: '800' }]}>
                      ⚠️ You attempted this quiz before. Try again only for Practice.
                    </Text>
                    <Text style={{ color: Colors.muted, fontSize: 11, marginTop: 4 }}>No coins or leaderboard changes on re-attempts.</Text>
                  </View>
                )}

                {/* Quiz completed summary */}
                {quizCompleted ? (
                  <View style={[styles.result, styles.resultCorrect, { marginBottom: 16, marginTop: 0 }]}>
                    <Text style={[styles.resultText, { fontWeight: '800', fontSize: 15 }]}>
                      🎉 You completed this quiz with {quizScore.correct}/{quizzes.length} Correct
                    </Text>
                  </View>
                ) : (
                  <>
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

                        {currentQuizIndex < quizzes.length - 1 && (
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
                        )}
                      </View>
                    )}
                  </>
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
                <TextInput
                  style={styles.codeInput}
                  placeholder="Type your answer here..."
                  placeholderTextColor={Colors.muted}
                  value={exerciseAnswers[ex.id] || ''}
                  onChangeText={(text) => setExerciseAnswers(prev => ({ ...prev, [ex.id]: text }))}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                  onPress={() => handleExerciseSubmit(ex)}
                  disabled={submitting}
                >
                  <Text style={styles.submitBtnText}>{submitting ? 'Evaluating...' : 'Submit Answer'}</Text>
                </TouchableOpacity>
                {exerciseResults[ex.id] ? (
                  <View style={[styles.result, exerciseResults[ex.id].startsWith('✅') ? styles.resultCorrect : styles.resultWrong, { marginTop: 12 }]}>
                    <Text style={[styles.resultText, { fontWeight: '800' }]}>
                      {exerciseResults[ex.id]}
                    </Text>
                  </View>
                ) : null}
              </View>
            )) : (
              <Text style={styles.emptyText}>Exercise coming soon for this lesson.</Text>
            )}

            {/* Exercise Rank — shown after a submission (mirrors desktop) */}
            {exerciseRankLoaded && (
              <View style={styles.exRankBox}>
                {exerciseRankLoading ? (
                  <Text style={styles.exRankLoading}>Loading rank...</Text>
                ) : exerciseRank ? (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.exRankBolt}>⚡</Text>
                    <Text style={styles.exRankLabel}>Your Exercise Rank</Text>
                    <Text style={styles.exRankValue}>#{exerciseRank.rank}</Text>
                    <Text style={styles.exRankMeta}>
                      out of {exerciseRank.totalStudents} students · Score: {exerciseRank.score}%
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.exRankEmpty}>Complete more exercises to see your rank!</Text>
                )}
              </View>
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

        {/* Rate Tab — per-lesson rating + reviews (mirrors desktop) */}
        {activeTab === 'rate' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⭐ Rate this Lesson</Text>

            {/* Star input */}
            <View style={styles.rateStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setLessonRating(star)}>
                  <Text style={[styles.rateStar, star <= lessonRating && styles.rateStarActive]}>
                    {star <= lessonRating ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.rateFeedbackInput}
              placeholder="Share your feedback (optional)"
              placeholderTextColor={Colors.muted}
              value={rateFeedback}
              onChangeText={setRateFeedback}
              multiline
              autoCapitalize="sentences"
            />

            <TouchableOpacity
              style={[styles.submitBtn, rateSubmitting && styles.submitBtnDisabled]}
              onPress={handleSubmitLessonRating}
              disabled={rateSubmitting}
            >
              <Text style={styles.submitBtnText}>{rateSubmitting ? 'Submitting...' : 'Submit'}</Text>
            </TouchableOpacity>

            {rateMessage && (
              <Text style={[styles.rateMessage, { color: rateMessage.success ? Colors.success : Colors.danger }]}>
                {rateMessage.text}
              </Text>
            )}

            {/* Reviews summary + list */}
            {reviewsLoading ? (
              <Text style={[styles.emptyText, { paddingVertical: 16 }]}>Loading reviews...</Text>
            ) : reviewsData && reviewsData.totalReviews > 0 ? (
              <View style={styles.rateReviewsSection}>
                <View style={styles.rateSummaryRow}>
                  <View style={styles.rateAvgBox}>
                    <Text style={styles.rateAvgValue}>{reviewsData.avgRating}</Text>
                    <Text style={styles.rateAvgLabel}>
                      {reviewsData.totalReviews} review{reviewsData.totalReviews > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {[5, 4, 3, 2, 1].map((s) => {
                      const count = reviewsData.ratingCounts[s] || 0;
                      const pct = reviewsData.totalReviews > 0 ? Math.round((count / reviewsData.totalReviews) * 100) : 0;
                      return (
                        <View key={s} style={styles.rateBarRow}>
                          <Text style={styles.rateBarLabel}>{s}★</Text>
                          <View style={styles.rateBarBg}>
                            <View style={[styles.rateBarFill, { width: `${pct}%` }]} />
                          </View>
                          <Text style={styles.rateBarCount}>{count}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <Text style={styles.rateReviewsTitle}>Student Reviews</Text>
                {reviewsData.reviews.slice(0, 10).map((r, idx) => (
                  <View key={idx} style={styles.rateReviewItem}>
                    <View style={styles.rateReviewHeader}>
                      <Text style={styles.rateReviewName}>{r.studentName || 'Student'}</Text>
                      <Text style={styles.rateReviewDate}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                      </Text>
                    </View>
                    <Text style={styles.rateReviewStars}>
                      {Array.from({ length: 5 }, (_, i) => (i < r.rating ? '★' : '☆')).join('')}
                    </Text>
                    {r.feedback ? <Text style={styles.rateReviewText}>{r.feedback}</Text> : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyText, { paddingVertical: 16 }]}>No reviews yet. Be the first to rate!</Text>
            )}
          </View>
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      {/* Coin reward toast (after quiz coins awarded) */}
      <CoinRewardToast
        visible={coinToast !== null}
        coins={coinToast?.coins ?? 0}
        badge={coinToast?.badge}
        rank={coinToast?.rank}
        onHide={() => setCoinToast(null)}
      />

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

  // Engagement bar (like / dislike / views)
  engagementBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.xl, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg,
  },
  engBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  engBtnLike: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.5)' },
  engBtnDislike: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.5)' },
  engIcon: { fontSize: 14 },
  engCount: { color: '#fff', fontSize: 12, fontWeight: '700' },
  engViews: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },

  // Rate tab
  rateStarsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  rateStar: { fontSize: 34, color: 'rgba(255,255,255,0.3)' },
  rateStarActive: { color: '#fbbf24' },
  rateFeedbackInput: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14,
    textAlignVertical: 'top', marginBottom: 14, minHeight: 80,
  },
  rateMessage: { marginTop: 12, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  rateReviewsSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16, marginTop: 16 },
  rateSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  rateAvgBox: { alignItems: 'center' },
  rateAvgValue: { fontSize: 30, fontWeight: '800', color: '#fbbf24', marginBottom: 2 },
  rateAvgLabel: { fontSize: 11, color: Colors.muted },
  rateBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  rateBarLabel: { fontSize: 10, color: Colors.muted, width: 18 },
  rateBarBg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  rateBarFill: { height: 5, borderRadius: 3, backgroundColor: '#fbbf24' },
  rateBarCount: { fontSize: 10, color: Colors.muted, width: 18, textAlign: 'right' },
  rateReviewsTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  rateReviewItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rateReviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  rateReviewName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  rateReviewDate: { color: Colors.muted, fontSize: 11 },
  rateReviewStars: { color: '#fbbf24', fontSize: 12, marginBottom: 3 },
  rateReviewText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 18 },

  // Exercise rank
  exRankBox: {
    marginTop: 20, padding: 16, borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
  },
  exRankLoading: { color: Colors.muted, fontSize: 13, textAlign: 'center' },
  exRankEmpty: { color: Colors.muted, fontSize: 13, textAlign: 'center' },
  exRankBolt: { fontSize: 22, marginBottom: 4 },
  exRankLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
  exRankValue: { color: Colors.success, fontSize: 26, fontWeight: '800', marginVertical: 4 },
  exRankMeta: { color: Colors.muted, fontSize: 12 },
  tabsWrap: {
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.cardAlt,
  },
  // Row of tabs with equal spacing on a single line. Each tab sizes to its
  // label (no flex:1 / minWidth), so the emoji+text never wraps to two lines.
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  tab: { paddingVertical: Spacing.md, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { color: Colors.muted, fontSize: 12, fontWeight: FontWeight.medium, textAlign: 'center' },
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
});
