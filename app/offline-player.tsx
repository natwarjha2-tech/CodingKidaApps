import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Colors, Spacing, Typography, FontWeight, Radius } from '@/theme';

/**
 * Offline Video Player Screen
 * Plays video from local file URI (downloaded content)
 */
export default function OfflinePlayerScreen() {
  const { uri, title } = useLocalSearchParams<{ uri: string; title: string }>();

  const player = useVideoPlayer(uri || '', (p) => {
    p.loop = false;
  });

  if (!uri) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Offline Player</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.errorState}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>Video file not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Offline Video'}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.playerContainer}>
        <VideoView
          player={player}
          style={styles.video}
          allowsFullscreen
          allowsPictureInPicture
        />
      </View>

      <View style={styles.infoBar}>
        <Text style={styles.infoIcon}>📥</Text>
        <Text style={styles.infoText}>Playing from downloaded file (offline)</Text>
      </View>
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
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  playerContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  infoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.card2, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  infoIcon: { fontSize: 14 },
  infoText: { color: Colors.success, fontSize: 12, fontWeight: '600' },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorEmoji: { fontSize: 48, marginBottom: Spacing.md },
  errorText: { color: Colors.muted, fontSize: Typography.sm },
});
