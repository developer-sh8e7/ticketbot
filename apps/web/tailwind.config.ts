import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        opus: {
          bg: 'var(--color-bg)',
          surface: 'var(--color-surface)',
          panel: 'var(--color-surface)',
          card: 'var(--color-border)',
          border: 'var(--color-border)',
          text: 'var(--color-text)',
          muted: 'var(--color-muted)',
          accent: 'var(--color-accent)',
          'accent-2': 'var(--color-accent-2)',
          silver: 'var(--color-accent-2)',
        },
      },
      fontFamily: {
        arabic: ['var(--font-cairo)', 'system-ui', 'sans-serif'],
        english: ['var(--font-english)', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
