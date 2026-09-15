import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Easing } from 'react-native';
import { Colors } from '@/theme';

interface CoinRewardToastProps {
  visible: boolean;
  coins: number;
  badge?: string;
  rank?: number;
  onHide: () => void;
}

// Badge label — matches desktop _showCoinRewardToast exactly
function badgeLabel(badge?: string): string {
  if (badge === 'super-master') return '🏆 Super Master';
  if (badge === 'master') return '🥈 Master';
  return '⭐ Pro';
}

/**
 * Coin reward toast shown after a quiz submission that awards coins.
 * Mirrors the desktop toast: "+N Coins Earned!" + "Rank #N · <badge>".
 * Auto-dismisses after ~3s.
 */
export function CoinRewardToast({ visible, coins, badge, rank, onHide }: CoinRewardToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (!visible) return;
    // Slide + fade in
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();

    // Auto-hide after 3s
    const hideTimer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        translateY.setValue(-20);
        onHide();
      });
    }, 3000);

    return () => clearTimeout(hideTimer);
  }, [visible, opacity, translateY, onHide]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]} pointerEvents="none">
      <Text style={styles.coinIcon}>🪙</Text>
      <Animated.View>
        <Text style={styles.title}>+{coins} Coins Earned!</Text>
        <Text style={styles.subtitle}>Rank #{rank ?? '-'} · {badgeLabel(badge)}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 20,
    right: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#2e1065',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    zIndex: 10001,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  coinIcon: { fontSize: 24 },
  title: { color: '#fbbf24', fontSize: 15, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
});
