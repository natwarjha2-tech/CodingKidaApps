// ─── CodingKida App Colors — Premium Soft Light Theme ───────────────────────
// Single source of truth for every screen. The keys are unchanged (so no screen
// reference breaks) — only the VALUES were moved from the old dark theme to the
// premium light theme, giving the whole app one consistent look. Screens that
// still hardcode white text on top of these are fixed per-page during rollout.
export const Colors = {
  // Backgrounds — soft off-white / very light lavender (never pure white)
  bg: '#F4F6FC',        // main app background
  bg2: '#FFFFFF',       // sheets / modals base
  card: '#FFFFFF',      // primary cards
  card2: '#FBFCFF',     // secondary cards (raised)
  cardAlt: '#F1F0FF',   // soft lavender tinted surface

  // Brand
  primary: '#6538FF',   // premium purple/indigo
  primaryDark: '#4B23D6',
  secondary: '#2F6BFF', // technology blue

  // Semantic
  success: '#22c55e',
  successLight: '#E4F8EC',
  danger: '#F0316E',
  dangerLight: '#FCE4EE',
  warning: '#F5A623',
  warningLight: '#FFF3DC',

  // Text (dark ink on light surfaces)
  white: '#ffffff',
  text: '#1E2233',      // primary text — deep ink
  muted: '#8A90A2',     // muted / secondary text

  // Borders
  border: '#E6E9F2',
  borderLight: '#EEF0F5',

  // Transparency helpers (soft brand tints)
  primaryLight: '#EEE9FF',
  primaryGlow: 'rgba(101,56,255,0.08)',
  overlay: 'rgba(15,18,40,0.55)',

  // Coins
  coin: '#F5A623',
  coinLight: '#FFF3D6',

  // Accent purples
  purple: '#7A3BFF',
  purple2: '#6538FF',

  // Kept for the video player area, which stays intentionally dark.
  videoBg: '#0F1117',
} as const;

// Premium light gradients (subtle — for depth where used).
export const Gradients = {
  primary: ['#6538FF', '#7A3BFF'] as const,
  primaryBtn: ['#6538FF', '#7A3BFF'] as const,
  welcome: ['#EFEAFF', '#E4EEFF'] as const,
  success: ['#22C55E', '#34D399'] as const,
  avatar: ['#a855f7', '#ec4899', '#f43f5e'] as const,
};
