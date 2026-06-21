import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  qualityUrls?: Record<string, string>;
  hlsQualities?: string[];
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
}

export function VideoPlayer({ videoUrl, title, qualityUrls, hlsQualities, onProgress, onComplete }: VideoPlayerProps) {
  const [hasCompleted, setHasCompleted] = useState(false);
  const [currentQuality, setCurrentQuality] = useState('Original');
  const [currentUrl, setCurrentUrl] = useState(videoUrl);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Timestamp to restore after quality change
  const seekAfterLoadRef = useRef<number | null>(null);
  const isSeekingRef = useRef(false);

  const qualities = ['Original', ...(hlsQualities ?? Object.keys(qualityUrls ?? {}))];
  const hasMultipleQualities = qualities.length > 1;

  const player = useVideoPlayer(currentUrl || '', (p) => {
    p.loop = false;
  });

  // After URL changes, seek to saved timestamp once player has loaded
  useEffect(() => {
    if (seekAfterLoadRef.current === null) return;
    if (isSeekingRef.current) return;

    const targetTime = seekAfterLoadRef.current;
    isSeekingRef.current = true;

    const interval = setInterval(() => {
      if (player.duration > 0) {
        player.currentTime = targetTime;
        player.play();
        seekAfterLoadRef.current = null;
        isSeekingRef.current = false;
        clearInterval(interval);
      }
    }, 200);

    // Safety: give up after 5s
    const timeout = setTimeout(() => {
      clearInterval(interval);
      seekAfterLoadRef.current = null;
      isSeekingRef.current = false;
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [currentUrl]);

  // Track progress
  useEffect(() => {
    if (!player || !currentUrl) return;
    const interval = setInterval(() => {
      const duration = player.duration;
      const position = player.currentTime;
      if (duration > 0 && position > 0) {
        const percent = Math.round((position / duration) * 100);
        onProgress?.(percent);
        if (percent >= 90 && !hasCompleted) {
          setHasCompleted(true);
          onComplete?.();
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [player, currentUrl, hasCompleted, onProgress, onComplete]);

  const handleQualityChange = useCallback((quality: string) => {
    if (quality === currentQuality) {
      setShowQualityMenu(false);
      return;
    }
    // Save current timestamp before switching URL
    seekAfterLoadRef.current = player.currentTime ?? 0;
    isSeekingRef.current = false;

    if (quality === 'Original') {
      setCurrentUrl(videoUrl);
    } else if (qualityUrls?.[quality]) {
      setCurrentUrl(qualityUrls[quality]);
    }
    setCurrentQuality(quality);
    setShowQualityMenu(false);
  }, [currentQuality, player, videoUrl, qualityUrls]);

  if (!videoUrl) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.icon}>🎬</Text>
        <Text style={styles.title}>{title ?? 'Lesson Video'}</Text>
        <Text style={styles.meta}>Video not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        allowsFullscreen
        allowsPictureInPicture
      />

      {/* Quality Selector Gear */}
      {hasMultipleQualities && (
        <TouchableOpacity
          style={styles.qualityGear}
          onPress={() => setShowQualityMenu(true)}
        >
          <Text style={styles.qualityGearText}>⚙️</Text>
        </TouchableOpacity>
      )}

      {/* Quality Dropdown */}
      {showQualityMenu && hasMultipleQualities && (
        <TouchableOpacity
          style={styles.qualityOverlay}
          activeOpacity={1}
          onPress={() => setShowQualityMenu(false)}
        >
          <View style={styles.qualityMenu}>
            <Text style={styles.qualityMenuTitle}>Quality</Text>
            {qualities.map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.qualityItem, currentQuality === q && styles.qualityItemActive]}
                onPress={() => handleQualityChange(q)}
              >
                <Text style={[styles.qualityItemText, currentQuality === q && styles.qualityItemTextActive]}>
                  {q}
                </Text>
                {currentQuality === q && <Text style={styles.qualityDot}>●</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
    zIndex: 100,
  },
  video: { width: '100%', height: '100%' },
  placeholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 48, marginBottom: Spacing.sm },
  title: { color: Colors.white, fontSize: Typography.base, fontWeight: FontWeight.bold },
  meta: { color: Colors.muted, fontSize: Typography.xs, marginTop: 4 },
  qualityGear: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityGearText: { fontSize: 16 },
  qualityOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  qualityMenu: {
    position: 'absolute',
    top: 44,
    right: 10,
    backgroundColor: Colors.bg2,
    borderRadius: 10,
    padding: 6,
    minWidth: 130,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  qualityMenuTitle: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingVertical: 6,
    letterSpacing: 0.5,
  },
  qualityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  qualityItemActive: { backgroundColor: 'rgba(108,71,255,0.1)' },
  qualityItemText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500' },
  qualityItemTextActive: { color: '#fff', fontWeight: '700' },
  qualityDot: { color: Colors.primary, fontSize: 10 },
});
