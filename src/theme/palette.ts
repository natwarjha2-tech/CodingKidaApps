// ─── CodingKida Premium Light Palette ───────────────────────────────────────
// The single source of truth for the app's premium LIGHT theme. Screens should
// consume `L` instead of hardcoding hex values, so a global theme change means
// editing this one file. (The legacy dark `Colors` in colors.ts is kept intact
// for screens that still use it — this palette is additive, not a replacement.)
export const L = {
  // Backgrounds & surfaces (soft off-white / very light lavender, layered depth)
  background: '#F4F6FC',      // main app background
  backgroundAlt: '#EEF2FB',   // alternate section background
  surface: '#FFFFFF',         // primary cards
  surfaceElevated: '#FBFCFF', // raised cards / sheets
  surfaceTint: '#F1F0FF',     // soft lavender tint (profile-style)

  // Brand / actions
  primary: '#6538FF',         // premium purple/indigo — primary action
  primaryDark: '#4B23D6',
  primaryLight: '#EEE9FF',    // soft primary surface
  secondary: '#2F6BFF',       // technology blue
  secondaryLight: '#E6EEFF',
  accent: '#7A3BFF',          // accent purple

  // Text
  textPrimary: '#1E2233',     // deep ink
  textSecondary: '#5C6680',   // secondary text
  textMuted: '#8A90A2',       // muted / metadata

  // Lines & borders
  border: '#E6E9F2',
  borderSoft: '#EEF0F5',

  // Semantic
  success: '#22C55E',
  successLight: '#E4F8EC',
  warning: '#F5A623',
  warningLight: '#FFF3DC',
  error: '#F0316E',
  errorLight: '#FCE4EE',

  // Gamification
  xp: '#2F6BFF',              // XP → tech blue
  coins: '#F5A623',           // CodingKida yellow/amber
  coinsSoft: '#FFF3D6',
  coinsInk: '#8A6D00',
  badge: '#7A3BFF',           // achievements → accent purple
  progress: '#6538FF',        // progress fill → primary

  // Brand logo letter colors (CodingKida wordmark)
  logoK: '#FA0514',
  logoI: '#FCCE02',
  logoD: '#9BE900',
  logoA: '#42C900',

  white: '#FFFFFF',
} as const;

// Premium light gradients (subtle, for hero / CTA depth — used sparingly).
export const LGradients = {
  hero: ['#EFEAFF', '#E4EEFF'] as const,       // soft lavender → light blue
  primaryBtn: ['#6538FF', '#7A3BFF'] as const,  // primary action button
  coins: ['#FFE9B0', '#FFD36B'] as const,       // coins pill
  challenge: ['#E4F8EC', '#DFF6FF'] as const,   // weekly challenge (soft green→cyan)
  success: ['#22C55E', '#34D399'] as const,
};
