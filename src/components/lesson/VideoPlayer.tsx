import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
}

export function VideoPlayer({ videoUrl, title, qualityUrls, hlsQualities, onProgress, onComplete }: VideoPlayerProps) {
  const videoRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);

  // Quality
  const [currentQuality, setCurrentQuality] = useState('Original');
  const [currentUrl, setCurrentUrl] = useState(videoUrl);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const savedSeek = useRef(0);

  const qualities = ['Original', ...(hlsQualities ?? Object.keys(qualityUrls ?? {}))];
  const hasMultipleQualities = qualities.length > 1;

  const handleLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
    if (savedSeek.current > 0) {
      videoRef.current?.seek(savedSeek.current);
      savedSeek.current = 0;
    }
  }, []);

  const handleProgress = useCallback((data: OnProgressData) => {
    setCurrentTime(data.currentTime);
    if (duration > 0) {
      const pct = Math.round((data.currentTime / duration) * 100);
      onProgress?.(pct);
      if (pct >= 90 && !hasCompleted) { setHasCompleted(true); onComplete?.(); }
    }
  }, [duration, hasCompleted, onProgress, onComplete]);

  const changeQuality = (q: string) => {
    if (q === currentQuality) { setShowQualityMenu(false); return; }
    savedSeek.current = currentTime;
    let url = videoUrl;
    if (q !== 'Original' && qualityUrls?.[q]) url = qualityUrls[q];
    setCurrentUrl(url);
    setCurrentQuality(q);
    setShowQualityMenu(false);
  };

  if (!videoUrl) {
    return (
      <View style={styles.placeholder}>
        <Text style={{ fontSize: 48 }}>🎬</Text>
        <Text style={styles.phTitle}>{title ?? 'Lesson Video'}</Text>
        <Text style={styles.phMeta}>Video not available</Text>
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
