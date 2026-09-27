import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Video, { type OnProgressData, type OnLoadData } from 'react-native-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Colors, Spacing, Typography, FontWeight } from '@/theme';

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  qualityUrls?: Record<string, string>;
  hlsQualities?: string[];
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
  /** Fired once after ~30s of actual watch time (mirrors desktop view counting). */
  onViewCounted?: () => void;
  /** Fired when the user switches quality — reports the selected quality + its URL
   *  so the parent can download exactly that quality (mirrors desktop). */
  onQualityChange?: (quality: string, url: string) => void;
  /** True while the signed play URL is still being fetched (sign-on-play). When
   *  true and there's no URL yet, show a loading spinner instead of the empty
   *  "not available" placeholder — so the brief fetch window looks polished. */
  loading?: boolean;
}

export function VideoPlayer({ videoUrl, title, qualityUrls, hlsQualities, onProgress, onComplete, onViewCounted, onQualityChange, loading }: VideoPlayerProps) {
  const videoRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  // True from the moment a source is set until the first frame is ready (onLoad)
  // or while the player reports it's buffering. Used to keep a spinner OVER the
  // video so there's no black gap between "signed URL arrived" and "video plays".
  const [buffering, setBuffering] = useState(true);

  // View counting: count ~30s of actual playback progress, fire once (like desktop)
  const watchedSecs = useRef(0);
  const lastProgressTime = useRef(0);
  const viewCounted = useRef(false);

  // Quality — only real available qualities (no "Original") when the video has
  // quality URLs; otherwise fall back to the raw video so it never breaks.
  const availableQualities = hlsQualities ?? Object.keys(qualityUrls ?? {});
  const hasQualities = availableQualities.length > 0;
  const qualities = hasQualities ? availableQualities : ['Original'];
  const hasMultipleQualities = qualities.length > 1;

  // Default quality: prefer 720 → else the first available → else Original(raw).
  const pickDefault = () => {
    if (!hasQualities) return { q: 'Original', url: videoUrl };
    const prefer = availableQualities.find((q) => q.replace(/[^0-9]/g, '') === '720') || availableQualities[0];
    return { q: prefer, url: qualityUrls?.[prefer] || videoUrl };
  };
  const _def = pickDefault();

  const [currentQuality, setCurrentQuality] = useState(_def.q);
  const [currentUrl, setCurrentUrl] = useState(_def.url);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const savedSeek = useRef(0);

  // CRITICAL: the source props (videoUrl / qualityUrls) arrive ASYNC under
  // "sign on play" — the player first mounts with an empty videoUrl, then the
  // signed URL lands a moment later. useState only captured the INITIAL (empty)
  // url, so without this the player kept an empty source ("Trying to load empty
  // source") and never played. Re-sync the current source whenever the incoming
  // default source changes (e.g. empty → signed URL, or a new lesson).
  useEffect(() => {
    setCurrentQuality(_def.q);
    setCurrentUrl(_def.url);
    // A new source means we're buffering again until the first frame is ready.
    if (_def.url) setBuffering(true);
    // Tell the parent the (new) default quality so downloads use it even if the
    // user never opens the quality menu.
    onQualityChange?.(_def.q, _def.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_def.q, _def.url]);

  const handleLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
    setBuffering(false); // first frame is ready — hide the overlay spinner
    if (savedSeek.current > 0) {
      videoRef.current?.seek(savedSeek.current);
      savedSeek.current = 0;
    }
  }, []);

  // react-native-video reports buffering start/stop. Keep the overlay spinner in
  // sync so any mid-stream rebuffer also shows the spinner instead of a freeze.
  const handleBuffer = useCallback((e: { isBuffering: boolean }) => {
    setBuffering(e.isBuffering);
  }, []);

  const handleProgress = useCallback((data: OnProgressData) => {
    setCurrentTime(data.currentTime);

    // Count actual watch time: only advancing playback counts (ignore seeks/pauses).
    const delta = data.currentTime - lastProgressTime.current;
    if (delta > 0 && delta < 2) watchedSecs.current += delta;
    lastProgressTime.current = data.currentTime;
    if (!viewCounted.current && watchedSecs.current >= 30) {
      viewCounted.current = true;
      onViewCounted?.();
    }

    if (duration > 0) {
      const pct = Math.round((data.currentTime / duration) * 100);
      onProgress?.(pct);
      if (pct >= 90 && !hasCompleted) { setHasCompleted(true); onComplete?.(); }
    }
  }, [duration, hasCompleted, onProgress, onComplete, onViewCounted]);

  const changeQuality = (q: string) => {
    if (q === currentQuality) { setShowQualityMenu(false); return; }
    savedSeek.current = currentTime;
    let url = videoUrl;
    if (q !== 'Original' && qualityUrls?.[q]) url = qualityUrls[q];
    setBuffering(true); // switching source — show spinner until it re-loads
    setCurrentUrl(url);
    setCurrentQuality(q);
    setShowQualityMenu(false);
    onQualityChange?.(q, url); // tell parent so download uses the selected quality
  };

  if (!currentUrl) {
    // While the signed URL is still being fetched (sign-on-play), show a loading
    // spinner — NOT "Video not available" (that only shows once the fetch is done
    // and there's genuinely no video). Mirrors YouTube's brief loading state.
    return (
      <View style={styles.placeholder}>
        {loading ? (
          <>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.phMeta}>Loading video…</Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 48 }}>🎬</Text>
            <Text style={styles.phTitle}>{title ?? 'Lesson Video'}</Text>
            <Text style={styles.phMeta}>Video not available</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <View>
      {/* Video with native controls — guaranteed visible on all platforms */}
      <View style={styles.videoContainer}>
        <Video
          key={currentUrl}
          ref={videoRef}
          source={{ uri: currentUrl }}
          style={styles.video}
          controls={true}
          resizeMode="contain"
          onLoad={handleLoad}
          onBuffer={handleBuffer}
          onProgress={handleProgress}
          progressUpdateInterval={1000}
          ignoreSilentSwitch="ignore"
          fullscreenAutorotate={true}
          onFullscreenPlayerWillPresent={() => {
            ScreenOrientation.unlockAsync();
          }}
          onFullscreenPlayerWillDismiss={() => {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          }}
        />
        {/* Overlay spinner: covers the black gap between the source being set and
            the first frame being ready (and any mid-stream rebuffering), so the
            video never "pops in" out of a black screen. */}
        {buffering && (
          <View style={styles.bufferOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </View>

      {/* Quality selector — below video, always visible, no overlay conflict */}
      {hasMultipleQualities && (
        <View style={styles.qualityBar}>
          <Text style={styles.qualityLabel}>Quality:</Text>
          <TouchableOpacity style={styles.qualityBtn} onPress={() => setShowQualityMenu(!showQualityMenu)}>
            <Text style={styles.qualityBtnText}>{currentQuality} ▾</Text>
          </TouchableOpacity>

          {showQualityMenu && (
            <View style={styles.qualityDropdown}>
              {qualities.map(q => (
                <TouchableOpacity
                  key={q}
                  style={[styles.qualityItem, currentQuality === q && styles.qualityItemActive]}
                  onPress={() => changeQuality(q)}
                >
                  <Text style={[styles.qualityItemText, currentQuality === q && styles.qualityItemTextActive]}>{q}</Text>
                  {currentQuality === q && <Text style={{ color: Colors.primary, fontSize: 8 }}>●</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  videoContainer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  placeholder: { width: '100%', aspectRatio: 16 / 9, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  phTitle: { color: '#fff', fontSize: Typography.base, fontWeight: FontWeight.bold, marginTop: 8 },
  phMeta: { color: Colors.muted, fontSize: Typography.xs, marginTop: 4 },

  // Quality bar
  qualityBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#0a0a14', position: 'relative', zIndex: 100 },
  qualityLabel: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  qualityBtn: { backgroundColor: 'rgba(108,71,255,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)' },
  qualityBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  qualityDropdown: {
    position: 'absolute', bottom: 40, left: 12, backgroundColor: 'rgba(10,10,20,0.97)',
    borderRadius: 10, padding: 4, minWidth: 130, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.5, shadowRadius: 12, zIndex: 999,
  },
  qualityItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6 },
  qualityItemActive: { backgroundColor: 'rgba(108,71,255,0.12)' },
  qualityItemText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500' },
  qualityItemTextActive: { color: '#fff', fontWeight: '700' },
});
