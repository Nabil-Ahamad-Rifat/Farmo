// Colour values for places that need a plain colour string (icons, native
// navigation options). Same tokens as tailwind.config.js and the web app.
export const colors = {
  ink: '#0f172a',
  surface: '#f6f8fa',
  line: '#e2e8f0',
  brand50: '#ecfdf5',
  brand600: '#047857',
  brand700: '#065f46',
  navy800: '#131c2e',
  navy900: '#0b1220',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  red600: '#dc2626',
  amber600: '#d97706',
  amber700: '#b45309',
  sky700: '#0369a1',
  white: '#ffffff',
};

/** Plus Jakarta Sans, one family per weight (loaded in app/_layout.tsx). */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

/** Card shadow, like the web's shadow-card. */
export const cardShadow = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.06,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};
