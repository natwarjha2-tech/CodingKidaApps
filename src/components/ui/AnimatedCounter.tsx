// AnimatedCounter — counts up from 0 → the REAL value once on mount (e.g.
// 0 → 7 courses, 0 → 120 XP). Never fabricates data; just animates the display
// of the real number passed in. Re-runs only when the value actually changes.
import { useEffect, useState, useRef } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { Duration } from '@/theme';

interface Props {
  value: number;
  style?: StyleProp<TextStyle>;
  duration?: number;
  prefix?: string;
  suffix?: string;
  /** Render a non-numeric value as-is (e.g. "—") without animating. */
  fallback?: string;
}

export function AnimatedCounter({ value, style, duration = Duration.slow, prefix = '', suffix = '', fallback }: Props) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const prevRef = useRef(0);

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    const from = prevRef.current;
    if (from === target) { setDisplay(target); return; }
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (target - from) * eased);
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  if (fallback != null) return <Text style={style}>{fallback}</Text>;
  return <Text style={style}>{prefix}{display}{suffix}</Text>;
}
