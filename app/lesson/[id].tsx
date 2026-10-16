import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Keyboard, Platform, ActivityIndicator, BackHandler, Modal } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { useCourseStore, useAuthStore } from '@/store';
import { useQuiz, useExercise, useCoins } from '@/hooks';
import { quizApi, exerciseApi, progressApi, weeklyStreakApi, mediaApi, lessonApi, feedbackApi, leaderboardApi, coursesApi, lessonChatApi, lessonHelpApi, codoScriptsApi, type LessonReviewsData, type LessonChatMessage } from '@/api';
import { StorageService, DownloadService, XPService, XP_REWARDS, seedHelpCache, stopCodoVoice } from '@/services';
import { userScopedKey } from '@/services/storage.service';
import { VideoPlayer } from '@/components/lesson/VideoPlayer';
import { PdfViewer } from '@/components/lesson/PdfViewer';
import { CoinsModal } from '@/components/common/CoinsModal';
import { CoinRewardToast } from '@/components/common/CoinRewardToast';
import { CodoHelpButton, CodoAnswerCard } from '@/components/lesson/CodoHelp';
import { CodoPromptModal } from '@/components/lesson/CodoPromptModal';
import { getWatchlist, setWatchlist } from '@/utils/watchlist.util';
import { getPlayCache, setPlayCache, type PlayData } from '@/utils/playCache.util';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';

// 'asknow' is the lesson Q&A tab (desktop calls it "AskNow"). Renamed from the
// earlier 'doubts' key so the tab, deep-link, and empty-state all read "AskNow".
type Tab = 'notes' | 'quiz' | 'exercise' | 'streak' | 'rate' | 'asknow';

// The signed "play" data cache (45-min TTL) now lives in a shared util module
// (@/utils/playCache.util) so the global Refresh can clear it. See getPlayCache /
// setPlayCache / clearPlayCache. PlayData is imported from there too.

// Lesson IDs for which Codo's "take a quiz?" nudge has ALREADY been shown this
// app session. Module-scoped so it survives the lesson screen remounting (e.g.
// navigating forward to the next lesson, then pressing back to this one). This
// prevents Codo from re-asking on a lesson the user already answered/declined
// when they simply revisit it. It resets on app restart — a genuine fresh
// re-watch to 90% in a new session will prompt again.
const _codoPromptedLessons = new Set<string>();

export default function LessonScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { activeCourse, activeLesson, activeModule, lessonContext } = useCourseStore();
  const setActiveLesson = useCourseStore((s) => s.setActiveLesson);
  const xpUserId = useAuthStore((s) => s.user?.id);
  const currentUserEmail = useAuthStore((s) => s.user?.email);
  // Initial tab honours a ?tab= deep-link (e.g. from a lesson_question /
  // lesson_answer notification → jump straight to the AskNow chat). Accept both
  // 'asknow' and the legacy 'doubts' param so older notification links still work.
  const [activeTab, setActiveTab] = useState<Tab>(
    tab === 'asknow' || tab === 'doubts' ? 'asknow' : 'notes'
  );
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizAttemptedBefore, setQuizAttemptedBefore] = useState(false);
  // Expanded full-screen quiz view (same content, Close returns to inline tab).
  const [quizExpanded, setQuizExpanded] = useState(false);
  // Once the student manually closes the expanded quiz, don't auto-reopen it
  // for this tab visit (so Close actually stays closed).
  const quizAutoOpenedRef = useRef(false);
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
  const navigation = useNavigation();

  // ── Codo "lesson complete → take a quiz?" nudge ──────────────────────────
  // Fixed Codo lines (same for everyone, DB-backed, no AI). Fetched once.
  const [codoScripts, setCodoScripts] = useState<Record<string, string>>({});
  // The quiz-offer popup (shown when the student tries to LEAVE after watching
  // ≥90%, if they haven't done/attempted the quiz yet).
  const [showQuizPrompt, setShowQuizPrompt] = useState(false);
  // The thank-you popup (shown once the quiz is completed).
  const [showQuizThanks, setShowQuizThanks] = useState(false);
  // Guards so each popup nags at most once per lesson visit.
  const quizPromptShownRef = useRef(false);
  const quizThanksShownRef = useRef(false);
  // When the user is leaving and we intercept to show the prompt, we hold the
  // navigation action here so "Not now" can resume it.
  const pendingLeaveRef = useRef<null | (() => void)>(null);

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
  // Whether THIS user has already rated the current lesson. A lesson may be
  // rated only ONCE — this locks the Rate tab (matches desktop). Detected by
  // comparing the current user's email local-part to each review's studentName.
  const [lessonAlreadyRated, setLessonAlreadyRated] = useState(false);

  // Doubts / Q&A group chat (mirrors desktop lesson-chat). Enrolled students ask
  // doubts; the course instructor replies. RN has no EventSource, so live updates
  // use polling on the server's `after` cursor while the Doubts tab is open.
  const [chatMessages, setChatMessages] = useState<LessonChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatIsInstructor, setChatIsInstructor] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatRefreshing, setChatRefreshing] = useState(false);
  // Tracks whether history has been loaded for this lesson (so opening the tab
  // loads once). State, not ref, so the load effect reacts correctly.
  const [chatLoaded, setChatLoaded] = useState(false);
  const chatSeenIdsRef = useRef<Record<string, true>>({}); // de-dupe by message id
  const chatCursorRef = useRef<string | null>(null);       // newest createdAt seen

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
  // Dedicated scroll ref for the AskNow message list (its own bounded, scrollable
  // area so a long conversation scrolls independently and the composer stays
  // pinned/visible below it).
  const chatScrollRef = useRef<ScrollView>(null);

  // Track keyboard visibility — collapse video when keyboard is open (like YouTube)
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Keyboard height — used to pad the scroll area so the AskNow composer is
  // lifted ABOVE the keyboard (visible while typing, even after a long chat).
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 60);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // PDF Viewer
  const [pdfViewerVisible, setPdfViewerVisible] = useState(false);
  // The URL currently shown in the PDF viewer. Defaults to the lesson notes, but
  // a study-material row can open its own signed URL here before showing.
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);

  // Module notes file — comes from the course response (materials are signed
  // up front by the backend). Under Notes we show the SINGLE module file whose
  // title/filename ends with the literal text "ppt" (naming convention marking
  // "this is the lesson notes to show"), e.g. "Module4-ppt.pdf".
  const notesMaterial = (() => {
    const mats = activeModule?.materials ?? [];
    const endsWithPpt = (s?: string) =>
      /ppt$/i.test((s || '').replace(/\.[^.]+$/, '').trim());
    return mats.find((m) => endsWithPpt(m.title)) ?? null;
  })();

  // Download status
  const [videoDownloaded, setVideoDownloaded] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [savedToWatchlist, setSavedToWatchlist] = useState(false);

  // Selected video quality (from the player) — download uses exactly this quality.
  const [selectedQuality, setSelectedQuality] = useState('Original');
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

  // "Sign on play": the course response no longer carries signed video/quality
  // URLs (signed on demand to keep course-open fast). Fetch this lesson's signed
  // playable data when the screen opens, and use it for the player.
  const [playData, setPlayData] = useState<PlayData | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!lessonId) { setPlayData(null); return; }

    // 45-min cache (shared util so Refresh can clear it): presigned S3 URLs are
    // valid 60 min, so reusing within 45 min is safe (15-min buffer) and lets
    // re-opening the same lesson replay instantly without another signing call.
    const cached = getPlayCache(lessonId);
    if (cached) {
      setPlayData(cached);
      return;
    }

    setPlayData(null);
    coursesApi
      .getLessonPlay(lessonId)
      .then((res) => {
        if (cancelled || !res?.success || !res.lesson) return;
        const data = {
          videoUrl: res.lesson.videoUrl || '',
          qualityUrls: res.lesson.qualityUrls || {},
          hlsQualities: res.lesson.hlsQualities || [],
          notes: res.lesson.notes,
        };
        // Only cache a FULLY-READY response. If the lesson has a video but its
        // qualities aren't ready yet (still processing on the server), caching
        // here would pin an empty-qualities response for 45 min — so re-opening
        // (even as another user, since this cache is device-wide and keyed by
        // lessonId only) would keep showing no qualities. Skip caching in that
        // case so the next open re-fetches and picks up the finished qualities.
        const videoStillProcessing =
          !!data.videoUrl && Object.keys(data.qualityUrls).length === 0;
        if (!videoStillProcessing) {
          setPlayCache(lessonId, data);
        }
        setPlayData(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lessonId]);

  // Prefetch the NEXT lesson's signed play URL into the cache once THIS lesson's
  // play data has loaded — so hitting "Next" opens instantly. Uses the WHOLE
  // course sequence (activeCourse.modules flattened) so it also prefetches the
  // next module's first lesson when the current one is a module's last lesson.
  // Only the tiny signed URL (never the video bytes), only if not already warm.
  // Fires ~4s after play data lands so it never competes with the current load.
  useEffect(() => {
    if (!playData) return;
    // Build the course-wide ordered lesson sequence; fall back to the single
    // active module if the full course isn't available.
    const seq = (activeCourse?.modules?.length
      ? activeCourse.modules.flatMap((m) => m.lessons ?? [])
      : (activeModule?.lessons ?? []));
    if (!seq.length) return;
    const idx = seq.findIndex((l) => l.id === lessonId);
    const next = idx >= 0 ? seq[idx + 1] : null;
    if (!next) return;
    if (getPlayCache(next.id)) return; // already warm
    const t = setTimeout(() => {
      coursesApi
        .getLessonPlay(next.id)
        .then((res) => {
          if (!res?.success || !res.lesson) return;
          const data = {
            videoUrl: res.lesson.videoUrl || '',
            qualityUrls: res.lesson.qualityUrls || {},
            hlsQualities: res.lesson.hlsQualities || [],
            notes: res.lesson.notes,
          };
          // Don't warm the cache with a still-processing (empty-qualities)
          // response — same reasoning as the main fetch above.
          const videoStillProcessing =
            !!data.videoUrl && Object.keys(data.qualityUrls).length === 0;
          if (!videoStillProcessing) {
            setPlayCache(next.id, data);
          }
        })
        .catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, [playData, activeCourse, activeModule, lessonId]);

  // Playable source: prefer the freshly-signed play data, fall back to whatever
  // the lesson object had (keeps old cached content / free previews working).
  const playVideoUrl = playData?.videoUrl || activeLesson?.videoUrl || '';
  const playQualityUrls = (playData && Object.keys(playData.qualityUrls).length > 0)
    ? playData.qualityUrls
    : activeLesson?.qualityUrls;
  const playHlsQualities = (playData && playData.hlsQualities.length > 0)
    ? playData.hlsQualities
    : activeLesson?.hlsQualities;

  // ── Next lesson (continuous across modules) — for the "Next Lesson" button ──
  // Build the course-wide ordered sequence and find the lesson right after this
  // one, along with the module it belongs to (so we can set it active correctly).
  const nextLessonInfo = (() => {
    const mods = activeCourse?.modules ?? (activeModule ? [activeModule] : []);
    if (!mods.length) return null;
    const flat: { lesson: any; module: any }[] = [];
    for (const m of mods) for (const l of (m.lessons ?? [])) flat.push({ lesson: l, module: m });
    const idx = flat.findIndex((x) => x.lesson.id === lessonId);
    if (idx < 0 || idx + 1 >= flat.length) return null; // last lesson of the course
    return flat[idx + 1];
  })();

  // Holds the latest Codo "take a quiz?" gate so goToNextLesson (defined before
  // the gate) can call it without a use-before-declaration issue.
  const quizNudgeRef = useRef<((proceed: () => void) => boolean) | null>(null);

  const goToNextLesson = useCallback(() => {
    if (!nextLessonInfo) return;
    const { lesson, module } = nextLessonInfo;
    // The actual navigation to the next lesson.
    const go = () => {
      // Set the next lesson active (so the reused screen has full context), then
      // navigate. Its play URL was prefetched, so it opens near-instantly.
      setActiveLesson(lesson, module, lessonContext?.courseId ?? '', lessonContext?.courseTitle ?? '');
      router.push(`/lesson/${lesson.id}`);
    };
    // If the current lesson is ≥90% watched with an unattempted quiz, Codo asks
    // first; "Not now" runs `go`. Otherwise navigate immediately.
    if (quizNudgeRef.current && quizNudgeRef.current(go)) return;
    go();
  }, [nextLessonInfo, setActiveLesson, lessonContext]);

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

  // Check if quiz was previously attempted for this lesson (user-scoped key so
  // different users on the same device don't share attempted/completed state).
  useEffect(() => {
    if (!lessonId) return;
    // RESET per-lesson state first — the screen is reused across lessons, so
    // without this the previous lesson's "attempted" (true) leaks into a new
    // lesson and wrongly suppresses Codo's quiz nudge. Mirrors the desktop fix.
    setQuizAttemptedBefore(false);
    setQuizCompleted(false);
    quizPromptShownRef.current = false;
    quizThanksShownRef.current = false;
    userScopedKey('ck_quiz_attempted_lessons').then((key) =>
      StorageService.getObject<string[]>(key).then((attempted) => {
        if (attempted && attempted.includes(lessonId)) {
          setQuizAttemptedBefore(true);
        }
      })
    );
  }, [lessonId]);

  // Backend is the source of truth for "already attempted" — the QuizAttempt
  // table persists across app reinstalls/updates (local storage doesn't). OR it
  // with the local flag so we never lose attempted state. When the backend says
  // attempted, also seed the local cache so offline reads stay consistent.
  useEffect(() => {
    if (lessonId && quizData?.attempted) {
      setQuizAttemptedBefore(true);
      userScopedKey('ck_quiz_attempted_lessons').then(async (key) => {
        const attempted = (await StorageService.getObject<string[]>(key)) ?? [];
        if (!attempted.includes(lessonId)) {
          attempted.push(lessonId);
          await StorageService.setObject(key, attempted);
        }
      });
    }
  }, [lessonId, quizData?.attempted]);

  // Fetch weekly streak for this lesson
  const { data: streakData } = useQuery({
    queryKey: ['streak-lesson', lessonId],
    queryFn: () => weeklyStreakApi.getByLesson(lessonId),
    enabled: !!lessonId,
    staleTime: 1000 * 60 * 10,
  });

  const quizzes = quizData?.quizzes ?? [];

  // Auto-open the full-screen quiz the moment the Quiz tab is active and a quiz
  // exists (so the student doesn't have to tap "Open"). Only auto-opens ONCE
  // per tab visit — if they manually Close, it stays closed. Resets when they
  // leave the quiz tab so re-entering auto-opens again.
  useEffect(() => {
    if (activeTab === 'quiz' && quizzes.length > 0 && !quizCompleted && !quizAutoOpenedRef.current) {
      quizAutoOpenedRef.current = true;
      setQuizExpanded(true);
    }
    if (activeTab !== 'quiz') {
      quizAutoOpenedRef.current = false; // allow auto-open next time they open the tab
    }
  }, [activeTab, quizzes.length, quizCompleted]);

  // When the quiz is fully completed, show the result + Codo thank-you briefly,
  // then AUTO-CLOSE the full-screen quiz and return to the normal lesson screen.
  useEffect(() => {
    if (quizCompleted && quizExpanded) {
      const t = setTimeout(() => {
        stopCodoVoice();
        setQuizExpanded(false);
      }, 3500); // ~3.5s so the student sees the score + hears Codo's thanks
      return () => clearTimeout(t);
    }
  }, [quizCompleted, quizExpanded]);
  const exercises = exerciseData?.exercises ?? [];
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
    // NOTE: we no longer show an Alert popup here. The floating "UP NEXT" button
    // (rendered when lessonCompleted && nextLessonInfo) is the single next-lesson
    // prompt — the Alert was a duplicate that popped a few seconds later.
  }, [lessonId, lessonCompleted, queryClient]);

  // Fetch the fixed Codo lines once (DB-backed, no AI). Best-effort — if it
  // fails, the popups just won't show.
  useEffect(() => {
    let cancelled = false;
    codoScriptsApi.get()
      .then((res) => { if (!cancelled && res?.success && res.scripts) setCodoScripts(res.scripts); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Reset the per-lesson nag guards when the lesson changes.
  useEffect(() => {
    quizPromptShownRef.current = false;
    quizThanksShownRef.current = false;
  }, [lessonId]);

  // Intercept leaving the lesson AFTER the student has watched ≥90% (lessonCompleted)
  // and still hasn't done/attempted the quiz. Show Codo's "take a quiz?" nudge
  // once; "Not now" resumes the navigation, "Take the Quiz" jumps to the tab.
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
      const quizDone = quizCompleted || quizAttemptedBefore;
      // Already prompted for this lesson this session → let navigation proceed.
      if (lessonId && _codoPromptedLessons.has(lessonId)) return;
      if (!lessonCompleted || quizDone || quizPromptShownRef.current || quizzes.length === 0) {
        return; // let navigation proceed normally
      }
      // Hold the leave; show the prompt instead.
      e.preventDefault();
      quizPromptShownRef.current = true;
      if (lessonId) _codoPromptedLessons.add(lessonId); // remember for this session
      pendingLeaveRef.current = () => navigation.dispatch(e.data.action as never);
      setShowQuizPrompt(true);
    });
    return sub;
  }, [navigation, lessonId, lessonCompleted, quizCompleted, quizAttemptedBefore, quizzes.length]);

  // When the quiz is completed, show Codo's thank-you (once).
  useEffect(() => {
    if (quizCompleted && !quizThanksShownRef.current) {
      quizThanksShownRef.current = true;
      setShowQuizThanks(true);
    }
  }, [quizCompleted]);

  // Shared gate used by the header back arrow (and any explicit leave action).
  // If the lesson is ≥90% watched, has an unattempted quiz, and we haven't
  // nagged yet → show Codo's prompt and return true (caller should NOT proceed;
  // "Not now" runs `proceed`). Otherwise returns false (caller proceeds).
  // This complements the beforeRemove listener, which isn't always reliable for
  // the custom back button in Expo Router.
  const maybeShowQuizNudge = useCallback((proceed: () => void): boolean => {
    const quizDone = quizCompleted || quizAttemptedBefore;
    // Already prompted for THIS lesson this session (even if the screen was
    // remounted via forward+back navigation) → never re-ask. This is the fix
    // for Codo re-appearing when you go to the next lesson and press back.
    if (lessonId && _codoPromptedLessons.has(lessonId)) return false;
    if (!lessonCompleted || quizDone || quizPromptShownRef.current || quizzes.length === 0) {
      return false;
    }
    quizPromptShownRef.current = true;
    if (lessonId) _codoPromptedLessons.add(lessonId); // remember for this session
    pendingLeaveRef.current = proceed;
    setShowQuizPrompt(true);
    return true;
  }, [lessonId, lessonCompleted, quizCompleted, quizAttemptedBefore, quizzes.length]);

  // Keep the ref in sync so goToNextLesson (defined earlier) can use the gate.
  useEffect(() => { quizNudgeRef.current = maybeShowQuizNudge; }, [maybeShowQuizNudge]);

  // Hardware back (Android): same gate before leaving the lesson screen.
  useEffect(() => {
    const onHardwareBack = () => maybeShowQuizNudge(() => router.back());
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [maybeShowQuizNudge]);

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
      if (data?.success) {
        setReviewsData(data);
        // One-rating-per-lesson: the lesson-feedback API exposes each review's
        // studentName (email local-part). Match it (case-insensitive) against the
        // current user to detect an existing rating and lock the form. The backend
        // stores every submission, so the client enforces the single-rating rule.
        const myName = (currentUserEmail || '').split('@')[0].toLowerCase();
        if (myName && Array.isArray(data.reviews)) {
          const mine = data.reviews.find(
            (r) => (r.studentName || '').toLowerCase() === myName
          );
          if (mine) {
            setLessonAlreadyRated(true);
            setLessonRating(mine.rating || 0);
            setRateFeedback(mine.feedback || '');
          }
        }
      }
    } catch {
      // Silent — reviews are non-critical
    } finally {
      setReviewsLoading(false);
    }
  }, [lessonId, currentUserEmail]);

  // Reset the rating lock + form when switching to a different lesson so the
  // per-lesson state doesn't leak across lessons in the reused screen.
  useEffect(() => {
    setLessonAlreadyRated(false);
    setLessonRating(0);
    setRateFeedback('');
    setRateMessage(null);
    setReviewsData(null);
  }, [lessonId]);

  // Load reviews the first time the Rate tab is opened
  useEffect(() => {
    if (activeTab === 'rate' && !reviewsData && !reviewsLoading) {
      loadLessonReviews();
    }
  }, [activeTab, reviewsData, reviewsLoading, loadLessonReviews]);



  // Submit lesson rating (mirrors desktop wording/behaviour)
  const handleSubmitLessonRating = useCallback(async () => {
    if (lessonAlreadyRated) {
      setRateMessage({ text: "You've already rated this lesson.", success: true });
      return;
    }
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
        // Lock the form — one rating per lesson (keep the rating shown read-only).
        setLessonAlreadyRated(true);
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
  }, [lessonAlreadyRated, lessonRating, rateFeedback, lessonId, activeLesson?.title, loadLessonReviews]);

  // ── Doubts / Q&A group chat ──
  // Append only messages we haven't rendered yet (de-dupe by id), keep the newest
  // createdAt as the polling cursor, and auto-scroll to the latest.
  const appendChatMessages = useCallback((incoming: LessonChatMessage[]) => {
    if (!incoming || incoming.length === 0) return;
    const fresh = incoming.filter((m) => m && m.id && !chatSeenIdsRef.current[m.id]);
    if (fresh.length === 0) return;
    fresh.forEach((m) => { chatSeenIdsRef.current[m.id] = true; });
    const last = fresh[fresh.length - 1];
    if (last?.createdAt) chatCursorRef.current = last.createdAt;
    setChatMessages((prev) => [...prev, ...fresh]);
  }, []);

  // Load chat history once when the Doubts tab is first opened for this lesson.
  const loadLessonChat = useCallback(async () => {
    if (!lessonId || chatLoaded) return;
    setChatLoading(true);
    try {
      const data = await lessonChatApi.getMessages(lessonId);
      if (data?.success) {
        setChatIsInstructor(!!data.isInstructor);
        chatSeenIdsRef.current = {};
        chatCursorRef.current = null;
        setChatMessages([]);
        appendChatMessages(data.messages || []);
        setChatLoaded(true);
      }
    } catch {
      // Silent — the tab shows an empty/retry state
    } finally {
      setChatLoading(false);
    }
  }, [lessonId, chatLoaded, appendChatMessages]);

  // Open the Doubts tab → load history once.
  useEffect(() => {
    if (activeTab === 'asknow' && !chatLoaded && !chatLoading) {
      loadLessonChat();
    }
  }, [activeTab, chatLoaded, chatLoading, loadLessonChat]);

  // Arriving via a lesson_answer notification (?tab=doubts): if history is
  // already loaded for this lesson, fetch just the newer messages once so the
  // instructor's fresh reply appears immediately (no polling needed).
  useEffect(() => {
    if ((tab === 'asknow' || tab === 'doubts') && chatLoaded) {
      refreshLessonChat();
    }
    // Only when the deep-link param or lesson changes — not on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, lessonId, chatLoaded]);

  // No background polling (keeps backend/data cost minimal). New messages are
  // fetched ON DEMAND only: when the Doubts tab opens, after you send, on
  // pull-to-refresh / the Refresh button, and when arriving via a notification
  // tap (which re-fetches on navigation). Fetches only messages newer than the
  // cursor so a refresh is cheap.
  const refreshLessonChat = useCallback(async () => {
    if (!lessonId) return;
    setChatRefreshing(true);
    try {
      const after = chatCursorRef.current || undefined;
      const data = await lessonChatApi.getMessages(lessonId, after);
      if (data?.success) appendChatMessages(data.messages || []);
    } catch {
      // ignore — user can retry
    } finally {
      setChatRefreshing(false);
    }
  }, [lessonId, appendChatMessages]);

  // "Codo is typing…" while we wait for the auto-generated AI reply after a send.
  const [chatAwaitingAi, setChatAwaitingAi] = useState(false);

  // Keep the AskNow message list pinned to the newest message: when the chat
  // grows or "Codo is typing…" toggles, scroll the INNER chat list to the
  // bottom. The list is its own bounded scroll area, so this never shifts the
  // composer off-screen.
  useEffect(() => {
    if (activeTab !== 'asknow') return;
    const t = setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [chatMessages.length, chatAwaitingAi, activeTab]);

  // After a student sends a message, the backend auto-generates a Codo (AI)
  // answer asynchronously (desktop receives it over SSE). React Native has no
  // EventSource, so we POLL for newer-than-cursor messages a few times until the
  // AI reply arrives (or we give up). This replicates desktop's "Codo answers
  // instantly after you ask" without a persistent stream.
  const pollForReplies = useCallback(async () => {
    if (!lessonId) return;
    setChatAwaitingAi(true);
    let gotAi = false;
    // ~ up to 15s: 1s, then 2s intervals. AI generation usually lands in <10s.
    const delays = [1000, 2000, 2000, 2000, 2000, 3000, 3000];
    try {
      for (const d of delays) {
        await new Promise((r) => setTimeout(r, d));
        const after = chatCursorRef.current || undefined;
        let data;
        try {
          data = await lessonChatApi.getMessages(lessonId, after);
        } catch {
          continue; // transient — keep polling
        }
        const fresh = data?.success ? (data.messages || []) : [];
        if (fresh.length > 0) {
          appendChatMessages(fresh);
          if (fresh.some((m) => m.senderRole === 'ai' || m.senderRole === 'instructor')) {
            gotAi = true;
            break; // Codo (or the instructor) replied — stop polling
          }
        }
      }
    } finally {
      setChatAwaitingAi(false);
    }
    return gotAi;
  }, [lessonId, appendChatMessages]);

  // Send a doubt/message; optimistic-render via the returned message (poll
  // de-dupes), then poll for Codo's auto-generated AI reply (mirrors desktop).
  const handleSendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || !lessonId || chatSending) return;
    setChatSending(true);
    try {
      const data = await lessonChatApi.send(lessonId, text);
      if (data?.success && data.message && typeof data.message !== 'string') {
        setChatInput('');
        appendChatMessages([data.message]);
        // Fetch Codo's AI answer that the server generates after the question.
        void pollForReplies();
      } else {
        Alert.alert('Error', (typeof data?.message === 'string' && data.message) || 'Failed to send. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setChatSending(false);
    }
  }, [chatInput, lessonId, chatSending, appendChatMessages, pollForReplies]);

  // "Connect with our Expert" — escalate under a Codo (AI) answer. Notifies the
  // instructor and posts a confirmation into the thread (mirrors desktop).
  const [chatEscalating, setChatEscalating] = useState(false);
  const [chatEscalated, setChatEscalated] = useState(false);
  const handleConnectExpert = useCallback(async () => {
    if (!lessonId || chatEscalating || chatEscalated) return;
    setChatEscalating(true);
    try {
      const data = await lessonChatApi.escalate(lessonId);
      if (data?.success) {
        setChatEscalated(true);
        if (data.message && typeof data.message !== 'string') {
          appendChatMessages([data.message]);
        }
      } else {
        Alert.alert('Error', (typeof data?.message === 'string' && data.message) || 'Could not connect right now. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setChatEscalating(false);
    }
  }, [lessonId, chatEscalating, chatEscalated, appendChatMessages]);

  // Reset chat state when switching lessons so a stale thread never lingers.
  useEffect(() => {
    setChatLoaded(false);
    chatSeenIdsRef.current = {};
    chatCursorRef.current = null;
    setChatMessages([]);
    setChatIsInstructor(false);
    setChatInput('');
    setChatEscalated(false);
  }, [lessonId]);

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
    // The playable URL now comes from the "sign on play" fetch (playVideoUrl),
    // not activeLesson.videoUrl (which is empty under sign-on-play). Use the
    // currently-selected quality if the user switched, else the resolved play URL.
    const baseUrl = playVideoUrl || activeLesson?.videoUrl || '';
    if (!baseUrl) {
      Alert.alert('Error', 'No video available to download.');
      return;
    }
    if (videoDownloaded) {
      Alert.alert('Already Downloaded', 'This video is already saved for offline viewing.');
      return;
    }
    try {
      // Download the quality the user currently selected in the player (mirrors
      // desktop). Falls back to the resolved play URL if no quality was switched.
      const dlUrl = selectedVideoUrl || baseUrl;
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

  const viewPdf = (url?: string) => {
    setPdfViewerUrl(url ?? activeLesson?.notes ?? null);
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

  // Background cache-warm for a quiz's Codo help (hint + answer). Fetches both
  // stages; if the server pre-computed audio, seed the voice cache so playback
  // is instant with no second /api/tts call. Silent + best-effort.
  const prefetchQuizHelp = useCallback(async (quizId: string) => {
    const stages: Array<'answer'> = ['answer']; // hint stage removed
    for (const stage of stages) {
      try {
        const data = await lessonHelpApi.getHelp({ kind: 'quiz', quizId, stage });
        if (data?.success && data.help) {
          // Cache the FULL response (text + sources + voice) in memory so the
          // Codo tap renders instantly with NO backend call. seedHelpCache also
          // seeds the voice cache from data.audio.
          seedHelpCache('quiz', quizId, stage, {
            help: data.help,
            source: data.source,
            sources: data.sources,
            audio: data.audio ?? null,
          });
        }
      } catch {
        // best-effort prefetch — ignore
      }
    }
  }, []);

  const handleQuizSubmit = async () => {
    if (selectedOption === null || quizzes.length === 0) return;
    setQuizSubmitted(true);
    const currentQuiz = quizzes[currentQuizIndex];
    const isCorrect = selectedOption === currentQuiz.answer;

    // Wrong answer → warm Codo's help cache in the BACKGROUND (hint + answer)
    // so when the student taps Codo it's instant. Cached items return at once;
    // uncached ones generate (and store) now instead of on tap. Best-effort:
    // silent, never blocks the UI, never throws. Mirrors desktop prefetch.
    if (!isCorrect && currentQuiz?.id) {
      void prefetchQuizHelp(currentQuiz.id);
    }

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
    { key: 'notes', label: '📊 PPT' },
    { key: 'quiz', label: '🧠 Quiz' },
    { key: 'exercise', label: '💻 Exercise' },
    ...(streak ? [{ key: 'streak' as Tab, label: '🔥 Streak' }] : []),
    { key: 'asknow', label: '💬 AskNow' },
    { key: 'rate', label: '⭐ Rate' },
  ];

  // The quiz body (questions, options, submit, Codo help, next). Defined once
  // and rendered BOTH inline (quiz tab) and inside the full-screen Modal so the
  // state is shared — closing the overlay shows the same progress inline.
  const quizBody = quizzes.length > 0 ? (
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
            let bg: string = Colors.card;
            let border: string = Colors.border;
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
          ) : null}

          {quizSubmitted && selectedOption !== quizzes[currentQuizIndex].answer && (
            <CodoHelpButton
              key={'codo-quiz-' + quizzes[currentQuizIndex].id}
              kind="quiz"
              quizId={quizzes[currentQuizIndex].id}
              onOpenPdf={viewPdf}
            />
          )}

          {quizSubmitted ? (
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
                    stopCodoVoice();
                    setCurrentQuizIndex(currentQuizIndex + 1);
                    setSelectedOption(null);
                    setQuizSubmitted(false);
                  }}
                >
                  <Text style={styles.submitBtnText}>Next Question →</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </>
      )}
    </View>
  ) : (
    <Text style={styles.emptyText}>Quiz coming soon for this lesson.</Text>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (!maybeShowQuizNudge(() => router.back())) router.back(); }}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.lessonTitle} numberOfLines={1}>
          {activeLesson?.title ?? 'Lesson'}
        </Text>
      </View>

      {/* Video Player — collapses when keyboard is open for more scroll space */}
      {!keyboardVisible && (
        <VideoPlayer
          videoUrl={playVideoUrl}
          title={activeLesson?.title}
          qualityUrls={playQualityUrls}
          onQualityChange={(q, url) => { setSelectedQuality(q); setSelectedVideoUrl(url); }}
          hlsQualities={playHlsQualities}
          onComplete={handleVideoComplete}
          onViewCounted={handleViewCounted}
          onProgress={handleVideoProgress}
          // Show a spinner (not "not available") during the brief sign-on-play
          // URL fetch: loading = play data not resolved yet AND no fallback URL.
          loading={!playData && !playVideoUrl}
        />
      )}

      {/* Engagement bar: like / dislike / views (mirrors desktop) */}
      {!keyboardVisible && (playVideoUrl || activeLesson?.videoUrl) ? (
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

      {/* Next Lesson button — continuous across modules (mirrors desktop). Only
          shown AFTER the video has finished (lessonCompleted) and when there is a
          next lesson. Its play URL is prefetched, so it opens near-instantly. */}
      {!keyboardVisible && lessonCompleted && nextLessonInfo ? (
        <TouchableOpacity style={styles.nextBtn} onPress={goToNextLesson} activeOpacity={0.85}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.nextBtnLabel}>UP NEXT</Text>
            <Text style={styles.nextBtnTitle} numberOfLines={1}>{nextLessonInfo.lesson.title}</Text>
          </View>
          <Text style={styles.nextBtnArrow}>Next ▶</Text>
        </TouchableOpacity>
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
      <ScrollView
        ref={scrollViewRef}
        style={styles.tabContent}
        contentContainerStyle={{ paddingBottom: keyboardVisible ? keyboardHeight + 24 : 0 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >

        {/* PPT Tab — shows the single module study file (name ends with "ppt"). */}
        {activeTab === 'notes' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Module PPT</Text>
            {notesMaterial ? (
              <View>
                <Text style={styles.notesText}>Study material (PPT) is available for this module.</Text>
                <View style={styles.pdfBtnRow}>
                  <TouchableOpacity style={styles.pdfBtn} onPress={() => viewPdf(notesMaterial.fileUrl)}>
                    <Text style={styles.pdfBtnText}>📊 View PPT</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>No PPT available for this module yet.</Text>
            )}
          </View>
        )}

        {/* Quiz Tab */}
        {activeTab === 'quiz' && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.cardTitle}>🧠 Quiz</Text>
              {quizzes.length > 0 && (
                <TouchableOpacity
                  onPress={() => setQuizExpanded(true)}
                  style={{ backgroundColor: 'rgba(108,71,255,0.15)', borderWidth: 1, borderColor: 'rgba(108,71,255,0.35)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '700' }}>⤢ Open</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* When expanded, the body renders inside the Modal below instead. */}
            {!quizExpanded && quizBody}
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

                {/* Codo "Stuck? Can I help?" — hint then answer (Hindi + voice) */}
                <CodoHelpButton kind="exercise" exerciseId={ex.id} onOpenPdf={viewPdf} />

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

        {/* AskNow Tab — lesson Q&A chat with Codo + instructor (mirrors desktop) */}
        {activeTab === 'asknow' && (
          <View style={styles.card}>
            <View style={styles.chatHeaderRow}>
              <Text style={[styles.cardTitle, { marginBottom: 0, flex: 1 }]}>
                💬 AskNow
                {chatIsInstructor ? <Text style={styles.chatRoleTag}>  (you are the instructor)</Text> : null}
              </Text>
              <TouchableOpacity
                style={styles.chatRefreshBtn}
                onPress={refreshLessonChat}
                disabled={chatRefreshing}
                activeOpacity={0.7}
              >
                <Text style={styles.chatRefreshBtnText}>{chatRefreshing ? '…' : '↻ Refresh'}</Text>
              </TouchableOpacity>
            </View>

            {chatLoading ? (
              <Text style={[styles.emptyText, { paddingVertical: 16 }]}>Loading discussion…</Text>
            ) : chatMessages.length === 0 ? (
              <Text style={[styles.emptyText, { paddingVertical: 16 }]}>
                {chatIsInstructor
                  ? "No questions yet. Students' questions will appear here."
                  : 'Ask a question about this lesson. Codo answers instantly from your course material, and your instructor can add more. Everyone enrolled can see the discussion.'}
              </Text>
            ) : (
              <ScrollView
                ref={chatScrollRef}
                style={styles.chatScroll}
                contentContainerStyle={styles.chatList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {chatMessages.map((m) => {
                  const isAi = m.senderRole === 'ai';
                  const isInstructor = m.senderRole === 'instructor';
                  const mine = !!m.isMine;
                  // Codo (AI) answers render as a rich card with voice, like desktop.
                  if (isAi) {
                    // "Connect with our Expert" shows under Codo answers, but NOT on
                    // the confirmation message, and not for the instructor's view
                    // (mirrors desktop showExpertBtn logic).
                    const isConfirmation = /has been notified|asked to connect with our expert/i.test(m.text || '');
                    const showExpertBtn = !isConfirmation && !chatIsInstructor;
                    return (
                      <View key={m.id} style={styles.chatRow}>
                        <View style={{ flex: 1 }}>
                          <CodoAnswerCard text={m.text} onOpenPdf={viewPdf} />
                          {showExpertBtn && (
                            <TouchableOpacity
                              style={[styles.expertBtn, chatEscalated && styles.expertBtnDone]}
                              onPress={handleConnectExpert}
                              disabled={chatEscalating || chatEscalated}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.expertBtnText}>
                                {chatEscalated
                                  ? '✓ Expert notified'
                                  : chatEscalating
                                  ? 'Connecting…'
                                  : '🎓 Connect with our Expert'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  }
                  return (
                    <View
                      key={m.id}
                      style={[styles.chatRow, mine && styles.chatRowMine]}
                    >
                      <View
                        style={[
                          styles.chatAvatar,
                          isInstructor ? styles.chatAvatarInstructor : mine ? styles.chatAvatarMine : styles.chatAvatarOther,
                        ]}
                      >
                        <Text style={styles.chatAvatarText}>
                          {isInstructor ? 'IN' : (m.senderName ? m.senderName.charAt(0).toUpperCase() : 'U')}
                        </Text>
                      </View>
                      <View style={styles.chatBubbleWrap}>
                        <Text style={[styles.chatWho, mine && styles.chatWhoMine]}>
                          {(m.senderName || 'User') + (isInstructor ? ' · Instructor' : '')}
                        </Text>
                        <View style={[styles.chatBubble, mine ? styles.chatBubbleMine : styles.chatBubbleOther]}>
                          <Text style={styles.chatBubbleText}>{m.text}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {/* Codo is composing an answer (polled, since RN has no SSE).
                    Inside the scroll area so it stays with the latest messages. */}
                {chatAwaitingAi && (
                  <View style={styles.chatTypingRow}>
                    <ActivityIndicator size="small" color={Colors.purple} />
                    <Text style={styles.chatTypingText}>  Codo is typing…</Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* Composer — pinned directly below the (independently scrollable)
                message list, so it's always visible even in a long chat. */}
            <View style={styles.chatComposer}>
              <TextInput
                style={styles.chatInput}
                placeholder="Ask Codo a question about this lesson…"
                placeholderTextColor={Colors.muted}
                value={chatInput}
                onChangeText={setChatInput}
                multiline
                autoCapitalize="sentences"
                editable={!chatSending}
                // When the box is tapped, lift it (and the latest messages)
                // above the keyboard by scrolling the tab area to the bottom.
                onFocus={() => {
                  setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 350);
                }}
              />
              <TouchableOpacity
                style={[styles.chatSendBtn, (chatSending || !chatInput.trim()) && styles.chatSendBtnDisabled]}
                onPress={handleSendChat}
                disabled={chatSending || !chatInput.trim()}
                activeOpacity={0.7}
              >
                <Text style={styles.chatSendBtnText}>{chatSending ? '…' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Rate Tab — per-lesson rating + reviews (mirrors desktop) */}
        {activeTab === 'rate' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⭐ Rate this Lesson</Text>

            {/* "How helpful?" prompt — hidden once the user has already rated
                (mirrors desktop _lockLessonRateForm). */}
            {!lessonAlreadyRated && (
              <Text style={styles.ratePrompt}>How helpful was this lesson?</Text>
            )}

            {/* Stars — only shown when NOT yet rated. Once rated, the stars are
                removed too (per request) and we show only the thank-you note. */}
            {!lessonAlreadyRated && (
              <View style={styles.rateStarsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setLessonRating(star)} activeOpacity={0.6}>
                    <Text style={[styles.rateStar, star <= lessonRating && styles.rateStarActive]}>
                      {star <= lessonRating ? '★' : '☆'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Already rated → show ONLY the thank-you note (no prompt, no stars,
                no comment box, no Submit). Otherwise show stars + comment + Submit. */}
            {lessonAlreadyRated ? (
              <Text style={[styles.rateMessage, { color: Colors.purple, marginTop: 4 }]}>
                ✓ You've already rated this lesson. Thanks for your feedback!
              </Text>
            ) : (
              <>
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
              </>
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

      {/* PDF Viewer Modal — shows the currently-selected URL (lesson notes or a
          module study-material file) */}
      <PdfViewer
        visible={pdfViewerVisible}
        pdfUrl={pdfViewerUrl ?? activeLesson?.notes ?? ''}
        onClose={() => setPdfViewerVisible(false)}
      />

      {/* Full-screen Quiz overlay — SAME quiz body as the inline tab (shared
          state), with a Close button that returns to the normal inline view. */}
      <Modal
        visible={quizExpanded}
        animationType="slide"
        onRequestClose={() => { stopCodoVoice(); setQuizExpanded(false); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <View style={styles.header}>
            <Text style={[styles.lessonTitle, { flex: 1 }]} numberOfLines={1}>🧠 Quiz</Text>
            <TouchableOpacity onPress={() => { stopCodoVoice(); setQuizExpanded(false); }}>
              <Text style={{ color: Colors.danger, fontSize: Typography.sm, fontWeight: FontWeight.bold }}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.xl }}>
            {quizBody}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Codo "you finished the lesson — take a quiz?" nudge. Shown when the
          student tries to leave after watching ≥90% and hasn't done the quiz.
          Accept → jump to the Quiz tab + stay. Not now → resume leaving. */}
      <CodoPromptModal
        visible={showQuizPrompt}
        message={codoScripts.lesson_complete_prompt || ''}
        acceptLabel="Take the Quiz 📝"
        onAccept={() => {
          setShowQuizPrompt(false);
          pendingLeaveRef.current = null; // cancel the hold — we're staying
          setActiveTab('quiz');
        }}
        rejectLabel="Not now"
        onReject={() => {
          setShowQuizPrompt(false);
          const leave = pendingLeaveRef.current;
          pendingLeaveRef.current = null;
          if (leave) leave(); // resume the navigation we intercepted
        }}
      />

      {/* Codo thank-you after the quiz is completed. Single dismiss button. */}
      <CodoPromptModal
        visible={showQuizThanks}
        message={codoScripts.quiz_complete_thanks || ''}
        rejectLabel="Yay! 🎉"
        onReject={() => setShowQuizThanks(false)}
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

  // "Next Lesson" button (continuous across modules — industry-standard "up next")
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: Spacing.xl, marginVertical: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radius.lg,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.5)',
  },
  nextBtnLabel: {
    color: Colors.muted, fontSize: 10, fontWeight: '700',
    letterSpacing: 1, marginBottom: 2,
  },
  nextBtnTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  nextBtnArrow: { color: '#a5b4fc', fontSize: 14, fontWeight: '800' },

  // Rate tab
  ratePrompt: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  rateStarsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  rateStar: { fontSize: 34, color: 'rgba(255,255,255,0.3)' },
  rateStarActive: { color: '#fbbf24' },
  rateFeedbackInput: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14,
    textAlignVertical: 'top', marginBottom: 14, minHeight: 80,
  },
  rateFeedbackInputLocked: { opacity: 0.6 },
  rateLockedBtn: { backgroundColor: 'rgba(255,255,255,0.1)' },
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

  // Doubts / Q&A chat
  chatHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.lg },
  chatRefreshBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9,
    backgroundColor: 'rgba(108,71,255,0.12)', borderWidth: 1, borderColor: 'rgba(108,71,255,0.25)',
  },
  chatRefreshBtnText: { color: Colors.purple, fontSize: 12, fontWeight: '700' },
  chatRoleTag: { color: Colors.muted, fontSize: 11, fontWeight: '500' },
  // Bounded, independently-scrollable message list so a long conversation
  // scrolls inside this box and the composer below it stays visible.
  chatScroll: { maxHeight: 360, marginBottom: 12 },
  chatList: { gap: 12, paddingBottom: 4 },
  chatRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  chatRowMine: { flexDirection: 'row-reverse' },
  chatAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  chatAvatarInstructor: { backgroundColor: '#f59e0b' },
  chatAvatarMine: { backgroundColor: '#10b981' },
  chatAvatarOther: { backgroundColor: Colors.primary },
  chatAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  chatBubbleWrap: { maxWidth: '78%' },
  chatWho: { fontSize: 10.5, color: Colors.muted, marginBottom: 3 },
  chatWhoMine: { textAlign: 'right' },
  chatBubble: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  chatBubbleOther: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: Colors.border },
  chatBubbleMine: { backgroundColor: 'rgba(108,71,255,0.15)', borderColor: 'rgba(108,71,255,0.3)' },
  chatBubbleText: { color: Colors.text, fontSize: 13.5, lineHeight: 20 },
  chatComposer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12,
  },
  chatInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 14,
    maxHeight: 100, textAlignVertical: 'top',
  },
  chatSendBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  chatSendBtnDisabled: { opacity: 0.5 },
  chatSendBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  // "Connect with our Expert" button under Codo AI answers
  expertBtn: {
    alignSelf: 'flex-start', marginTop: 8,
    backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  expertBtnDone: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.4)' },
  expertBtnText: { color: Colors.coin, fontSize: 12, fontWeight: '700' },

  // "Codo is typing…" indicator while polling for the AI reply
  chatTypingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  chatTypingText: { color: Colors.muted, fontSize: 13, fontStyle: 'italic' },

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

  // Module study-material rows (Notes tab)
  materialRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  materialTitle: { color: '#fff', fontSize: Typography.sm, fontWeight: FontWeight.bold },
  materialMeta: { color: Colors.muted, fontSize: Typography.xs, marginTop: 2 },
  materialBtn: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.sm,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.primary,
  },
  materialBtnText: { color: Colors.primary, fontSize: Typography.xs, fontWeight: FontWeight.bold },
});
