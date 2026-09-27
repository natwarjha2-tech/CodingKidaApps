// SectionHeader — consistent section title (+ optional right action) used
// across screens so section headers look identical app-wide.
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { L, TextStyles } from '@/theme';

interface Props {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: Props) {
  return (
    <View style={styles.row}>
      <Text style={[TextStyles.sectionTitle, { color: L.textPrimary }]}>{title}</Text>
      {actionLabel && onAction ? (
        <AnimatedPressable onPress={onAction} haptic accessibilityRole="button">
          <Text style={[TextStyles.metadata, { color: L.primary }]}>{actionLabel} →</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
});
