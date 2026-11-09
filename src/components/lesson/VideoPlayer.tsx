import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Video, { type OnProgressData, type OnLoadData } from 'react-native-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Colors, Spacing, Typography, FontWeight } from '@/theme';

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  qualityUrls?: Record<string, string>;
  hlsQualities?: string[];
  /** CloudFront HLS master-playlist URL (e.g. .../master.m3u8). When present
   *  with a cookie header, the player streams HLS. Default quality = Auto
   *  (ExoPlayer adaptive). Student can pick a specific rendition (720p/480p/360p)
   *  which plays the corresponding variant playlist directly from CloudFront. */
  hlsMasterUrl?: string;
  /** Cookie request-header value carrying the three CloudFront signed cookies.
   *  Forwarded on EVERY manifest + segment request so CloudFront can authorize
   *  the whole hls/<mediaId>/* prefix. */
  hlsCookieHeader?: string;
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
  /** Fired once after ~30s of actual watch time (mirrors desktop view counting). */
  onViewCounted?: () => void;
  /** Fired when the user switches quality. */
  onQualityChange?: (quality: string, url: string) => void;
  /** True while the signed play URL is still being fetched. Shows a spinner
   *  instead of "Video not available" during the brief fetch window. */
  loading?: boolean;
}

/**
 * Derive the CloudFront variant-playlist URL from the master URL and an index.
 * Master lives at  https://<domain>/hls/<mediaId>/master.m3u8
 * Variant lives at https://<domain>/hls/<mediaId>/v<index>.m3u8
 * (ffmpeg writes v0 = 720p, v1 = 480p, v2 = 360p — same order as hlsQualities.)
 */
function variantUrl(masterUrl: string, variantIndex: number): string {
  return masterUrl.replace(/\/master\.m3u8(\?.*)?$/, `/v${variantIndex}.m3u8`);
}

const AUTO = 'Auto';
// Same ladder the encoder produces. Used when the DB row has no hlsQualities
// yet (videos encoded before the quality names were stored) — mirrors desktop.
const FALLBACK_HLS_LADDER = ['720p', '480p', '360p'];


export function VideoPlayer({
  videoUrl, title, qualityUrls, hlsQualities,
  hlsMasterUrl, hlsCookieHeader,
  onProgress, onComplete, onViewCounted, onQualityChange, loading,
}: VideoPlayerProps) {
  const videoRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // View counting: count ~30s of actual playback, fire once (like desktop)
  const watchedSecs = useRef(0);
  const lastProgressTime = useRef(0);
  const viewCounted = useRef(false);

  // ── HLS mode ────────────────────────────────────────────────────────────────
  const useHls = !!(hlsMasterUrl && hlsCookieHeader);

  // Variant names in encoder order (v0, v1, v2…). Falls back to the standard
  // ladder if the server didn't send names, so the menu is never just "Auto".
  const hlsVariants: string[] = useHls
    ? (hlsQualities && hlsQualities.length > 0 ? hlsQualities : FALLBACK_HLS_LADDER)
    : [];

  // Quality options:
  //   HLS      → [Auto, 720p, 480p, 360p]
  //   MP4 only → existing MP4 quality list (legacy videos)
  const mp4Qualities = hlsQualities && hlsQualities.length > 0
    ? hlsQualities
    : Object.keys(qualityUrls ?? {});
  const menuOptions: string[] = useHls
    ? [AUTO, ...hlsVariants]
    : (mp4Qualities.length > 0 ? mp4Qualities : ['Original']);
  const showQualityButton = menuOptions.length > 1;

  const pickMp4Default = () => {
    if (!mp4Qualities.length) return 'Original';
    return mp4Qualities.find((q) => q.replace(/[^0-9]/g, '') === '720') ?? mp4Qualities[0];
  };
  const defaultQuality = useHls ? AUTO : pickMp4Default();

  // The quality the student picked, remembered PER SOURCE. When the lesson (and
  // so the master/video URL) changes, the stored pick no longer matches and the
  // default (Auto) applies automatically — no effect needed to "reset" it.
  // Deriving instead of resetting in an effect is what keeps the player from
  // being handed its source twice (the effect used to re-set an identical
  // source with a new headers object right after mount → second load).
  const sourceId = useHls ? `hls:${hlsMasterUrl}` : `mp4:${videoUrl}`;
  const [pick, setPick] = useState<{ sourceId: string; quality: string } | null>(null);
  const selectedQuality = pick && pick.sourceId === sourceId ? pick.quality : defaultQuality;
  const savedSeek = useRef(0);

  // Active source for the selected quality, MEMOIZED: the object only changes
  // when the URL / cookie really change, so react-native-video never sees a
  // "new" source for the same stream.
  //   Auto → master.m3u8 (ExoPlayer adapts)   720p → v0.m3u8   480p → v1.m3u8 …
  //   MP4  → signed S3 URL for that quality (legacy videos only)
  const sourceUri = useHls
    ? (selectedQuality === AUTO || hlsVariants.indexOf(selectedQuality) < 0
        ? (hlsMasterUrl as string)
        : variantUrl(hlsMasterUrl as string, hlsVariants.indexOf(selectedQuality)))
    : (selectedQuality !== 'Original' && qualityUrls?.[selectedQuality]
        ? qualityUrls[selectedQuality]
        : videoUrl);
  const cookie = useHls ? (hlsCookieHeader as string) : '';
  const videoSource = useMemo(
    () => (cookie ? { uri: sourceUri, headers: { Cookie: cookie } } : { uri: sourceUri }),
    [sourceUri, cookie],
  );

  // Spinner = "this exact URL hasn't produced its first frame yet" OR the player
  // reports it is rebuffering. Derived from the URL, so switching lesson/quality
  // shows it immediately with no extra state reset.
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [rebuffering, setRebuffering] = useState(false);
  const buffering = !!sourceUri && (loadedUri !== sourceUri || rebuffering);

  // Tell the parent the active quality + URL (used by downloads). Pure
  // notification — it never feeds back into the source.
  const onQualityChangeRef = useRef(onQualityChange);
  onQualityChangeRef.current = onQualityChange;
  useEffect(() => {
    if (sourceUri) onQualityChangeRef.current?.(selectedQuality, sourceUri);
    setShowQualityMenu(false);
  }, [sourceUri, selectedQuality]);

  const handleLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
    setLoadedUri(sourceUri);
    setRebuffering(false);
    if (savedSeek.current > 0) {
      videoRef.current?.seek(savedSeek.current);
      savedSeek.current = 0;
    }
  }, [sourceUri]);

  const handleBuffer = useCallback((e: { isBuffering: boolean }) => {
    setRebuffering(e.isBuffering);
  }, []);

  const handleProgress = useCallback((data: OnProgressData) => {
    setCurrentTime(data.currentTime);
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
    setShowQualityMenu(false);
    if (q === selectedQuality) return;
    savedSeek.current = currentTime; // resume from the same spot after the switch
    setPick({ sourceId, quality: q });
  };

  const effectiveUrl = sourceUri;

  if (!effectiveUrl) {
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
      <View style={styles.videoContainer}>
        <Video
          key={effectiveUrl}
          ref={videoRef}
          source={videoSource}
          style={styles.video}
          controls={true}
          resizeMode="contain"
          onLoad={handleLoad}
          onBuffer={handleBuffer}
          onProgress={handleProgress}
          progressUpdateInterval={1000}
          ignoreSilentSwitch="ignore"
          fullscreenAutorotate={true}
          onFullscreenPlayerWillPresent={() => ScreenOrientation.unlockAsync()}
          onFullscreenPlayerWillDismiss={() =>
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
          }
        />
        {buffering && (
          <View style={styles.bufferOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </View>

      {/* Quality selector. Options open as an inline chip row below the bar —
          it stays inside the layout so taps always register (absolute
          dropdowns outside parent bounds don't get touches on Android). */}
      {showQualityButton && (
        <View style={styles.controlsBar}>
          <Text style={styles.chipRowLabel}>Quality:</Text>
          <TouchableOpacity
            style={[styles.pillBtn, showQualityMenu && styles.pillBtnOpen]}
            onPress={() => setShowQualityMenu(!showQualityMenu)}
          >
            <Text style={styles.pillBtnText}>
              {selectedQuality === AUTO ? '⚡ Auto' : selectedQuality} ▾
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {showQualityMenu && showQualityButton && (
        <View style={styles.chipRow}>
          <Text style={styles.chipRowLabel}>Quality</Text>
          {menuOptions.map((q) => (
            <TouchableOpacity
              key={q}
              style={[styles.chip, selectedQuality === q && styles.chipActive]}
              onPress={() => changeQuality(q)}
            >
              <Text style={[styles.chipText, selectedQuality === q && styles.chipTextActive]}>
                {q === AUTO ? '⚡ Auto' : q}
              </Text>
            </TouchableOpacity>
          ))}
          {useHls && <Text style={styles.chipHint}>Auto adjusts to your network</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  videoContainer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  bufferOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  placeholder: {
    width: '100%', aspectRatio: 16 / 9,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
  },
  phTitle: { color: '#fff', fontSize: Typography.base, fontWeight: FontWeight.bold, marginTop: 8 },
  phMeta: { color: Colors.muted, fontSize: Typography.xs, marginTop: 4 },

  controlsBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#0a0a14',
  },
  pillBtn: {
    backgroundColor: 'rgba(108,71,255,0.15)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.3)',
  },
  pillBtnOpen: { backgroundColor: 'rgba(108,71,255,0.3)' },
  pillBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },

  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingBottom: 10, paddingTop: 2,
    backgroundColor: '#0a0a14',
  },
  chipRowLabel: { color: Colors.muted, fontSize: 12, fontWeight: '600', marginRight: 2 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  chipActive: { backgroundColor: 'rgba(108,71,255,0.25)', borderColor: Colors.primary },
  chipText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  chipHint: { width: '100%', color: 'rgba(255,255,255,0.35)', fontSize: 11 },
});
