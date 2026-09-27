export const Typography = {
  xs: 11,
  sm: 13,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  display: 28,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// ─── Named text styles (clear hierarchy) ─────────────────────────────────────
// Reusable typography presets — screens should apply these instead of ad-hoc
// fontSize/fontWeight combos, so type stays consistent app-wide.
export const TextStyles = {
  display:      { fontSize: 28, fontWeight: FontWeight.extrabold, letterSpacing: -0.5 },
  screenTitle:  { fontSize: 23, fontWeight: FontWeight.extrabold },
  sectionTitle: { fontSize: 17, fontWeight: FontWeight.bold },
  cardTitle:    { fontSize: 15, fontWeight: FontWeight.bold },
  body:         { fontSize: 14, fontWeight: FontWeight.regular },
  bodyMedium:   { fontSize: 14, fontWeight: FontWeight.semibold },
  caption:      { fontSize: 12, fontWeight: FontWeight.medium },
  metadata:     { fontSize: 11, fontWeight: FontWeight.semibold },
  button:       { fontSize: 14, fontWeight: FontWeight.bold },
  badge:        { fontSize: 10, fontWeight: FontWeight.extrabold, letterSpacing: 0.3 },
  numeric:      { fontSize: 22, fontWeight: FontWeight.extrabold },
} as const;
