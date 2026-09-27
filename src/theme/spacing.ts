export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  // Semantic aliases (premium, disciplined corner radii)
  small: 8,
  medium: 12,
  large: 16,
  card: 20,
  pill: 50,
  full: 999,
} as const;
