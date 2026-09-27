// Exact same color values as desktop app (global.css :root variables)
export const Colors = {
  // Backgrounds — exact desktop values
  bg: '#0f0f1a',        // --dark
  bg2: '#1a1a2e',       // --dark2
  card: '#16213e',      // --card-bg (sidebar cards)
  card2: '#161B22',     // dashboard course cards
  cardAlt: '#1a1830',   // login card bg

  // Brand
  primary: '#6c47ff',   // --primary
  primaryDark: '#5035cc', // --primary-dark
  secondary: '#ec4899', // pink accent

  // Semantic
  success: '#22c55e',
  successLight: 'rgba(34,197,94,0.15)',
  danger: '#ef4444',
  dangerLight: 'rgba(239,68,68,0.15)',
  warning: '#f59e0b',
  warningLight: 'rgba(245,158,11,0.15)',

  // Text
  white: '#ffffff',
  text: '#e2e8f0',      // --text
  muted: '#94a3b8',     // --muted

  // Borders
  border: 'rgba(255,255,255,0.08)',   // --border
  borderLight: 'rgba(255,255,255,0.05)',

  // Transparency helpers
  primaryLight: 'rgba(108,71,255,0.15)',
  primaryGlow: 'rgba(108,71,255,0.08)',
  overlay: 'rgba(0,0,0,0.7)',

  // Coins
  coin: '#fbbf24',
  coinLight: 'rgba(245,158,11,0.15)',

  // Accent purples
  purple: '#a78bfa',
  purple2: '#b251ff',
} as const;

// Exact desktop gradients
export const Gradients = {
  primary: ['#6c47ff', '#ec4899'] as const,        // main gradient
  primaryBtn: ['#6c47ff', '#b251ff'] as const,      // button gradient
  welcome: ['#2e1065', '#0B0E14'] as const,         // welcome banner
  success: ['#10b981', '#34d399'] as const,
  avatar: ['#a855f7', '#ec4899', '#f43f5e'] as const, // user avatar
};
