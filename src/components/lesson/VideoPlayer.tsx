import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
}

export function VideoPlayer({ videoUrl, title, onProgress, onComplete }: VideoPlayerProps) {
  const [hasCompleted, setHasCompleted] = useState(false);

  const player = useVideoPlayer(videoUrl || '', (p) => {
    p.loop = false;
  });

  // Track progress via timeUpdate
  useEffect(() => {
    if (!player || !videoUrl) return;

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
  }, [player, videoUrl, hasCompleted, onProgress, onComplete]);

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
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
});
