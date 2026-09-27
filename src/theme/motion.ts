// ─── CodingKida Motion System ───────────────────────────────────────────────
// Central animation tokens. Every animated component/screen must reuse these so
// motion feels consistent app-wide and can be tuned from one place.
import { Easing } from 'react-native-reanimated';

/** Timing durations (ms) — micro 150–300, feature 250–450, celebration 800–1500. */
export const Duration = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 450,
  emphasis: 600,
  celebration: 1200,
} as const;

/** Standard easing curves for timing animations. */
export const EaseCurve = {
  standard: Easing.bezier(0.25, 0.1, 0.25, 1), // smooth in-out
  out: Easing.out(Easing.cubic),               // decelerate (entrances)
  in: Easing.in(Easing.cubic),                 // accelerate (exits)
} as const;

/** Reanimated spring presets for interactive elements. */
export const Spring = {
  // Gentle, premium — for cards, progress, entrances.
  soft: { damping: 18, stiffness: 160, mass: 1 },
  // Balanced default — for buttons, tabs, most micro-interactions.
  standard: { damping: 15, stiffness: 220, mass: 1 },
  // Slight overshoot — for badges/rewards/celebration (use sparingly).
  playful: { damping: 10, stiffness: 200, mass: 0.9 },
} as const;

/** Timing config helpers (pair a duration with the standard easing). */
export const Timing = {
  fade: { duration: Duration.normal, easing: EaseCurve.standard },
  slide: { duration: Duration.slow, easing: EaseCurve.out },
  scale: { duration: Duration.fast, easing: EaseCurve.out },
} as const;

/** Staggered entrance delays (ms) for the Home/page enter sequence. */
export const EnterDelay = {
  header: 50,
  hero: 100,
  stats: 180,
  primary: 240,
  secondary: 300,
  rest: 350,
} as const;

/** Common interactive press scale. */
export const PressScale = 0.96;
