import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/theme';

/**
 * codingkida://payment-done — the website opens this after a successful payment.
 * The browser tab has already closed; go straight back to the screen the student
 * paid from (the course screen reloads itself and unlocks).
 */
export default function PaymentDone() {
  useEffect(() => {
    const t = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/dashboard');
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={Colors.primary} />
    </View>
  );
}
