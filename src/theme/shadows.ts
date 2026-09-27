// ─── CodingKida Elevation / Shadow System ───────────────────────────────────
// Subtle, premium, lightweight shadows (never heavy black). Use these tokens on
// cards/containers so elevation is consistent across the app.
import { Platform } from 'react-native';

type ShadowStyle = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

// Soft brand-tinted shadow (iOS uses shadow*, Android uses elevation).
const make = (opacity: number, radius: number, y: number, elev: number, color = '#2F3A66'): ShadowStyle => ({
  shadowColor: color,
  shadowOpacity: Platform.OS === 'ios' ? opacity : opacity * 0.9,
  shadowRadius: radius,
  shadowOffset: { width: 0, height: y },
  elevation: elev,
});

export const Shadow = {
  none: make(0, 0, 0, 0),
  sm: make(0.06, 6, 2, 1),
  md: make(0.08, 12, 5, 2),
  lg: make(0.1, 18, 8, 4),
  // Slightly stronger, brand-tinted — for hero / primary CTA surfaces.
  card: make(0.07, 10, 5, 2, '#2F6BFF'),
} as const;
