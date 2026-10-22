/** @type {import('tailwindcss').Config} */
// Same design tokens as the web app (apps/web/src/app/globals.css @theme), so
// both apps use the same colours, radii and shadows. The font is applied by
// src/components/ui/Text.tsx (Android needs one font file per weight).
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        surface: '#f6f8fa',
        line: '#e2e8f0',
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#047857',
          700: '#065f46',
          800: '#064e3b',
          900: '#022c22',
        },
        navy: {
          700: '#1e293b',
          800: '#131c2e',
          900: '#0b1220',
          950: '#070c17',
        },
      },
      borderRadius: {
        card: '14px',
        control: '10px',
      },
    },
  },
  plugins: [],
};
