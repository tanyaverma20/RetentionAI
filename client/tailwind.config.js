/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // App shell background — matches the SnapLocate-style light theme spec.
        canvas: '#F5F7FB',
        // `indigo` is left as Tailwind's stock scale on purpose: #6366F1 is
        // exactly indigo-500, so every existing `indigo-*` utility class
        // already resolves to the correct brand color without remapping.
      },
      fontFamily: {
        // Overrides Tailwind's default `font-sans` stack app-wide.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Soft, diffused card shadows for the light theme — replaces the old
        // theme's colored `shadow-*-500/25` glow shadows (which only read
        // correctly against a dark background).
        soft: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 2px 8px -2px rgba(15, 23, 42, 0.06)',
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 8px 24px -8px rgba(15, 23, 42, 0.10)',
        'card-hover': '0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 12px 32px -8px rgba(15, 23, 42, 0.14)',
      },
    },
  },
  plugins: [],
};
