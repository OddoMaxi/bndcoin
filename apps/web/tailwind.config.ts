import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FBF9F4',
        surface: '#FFFFFF',
        forest: {
          DEFAULT: '#1B4332',
          soft: '#2D6A4F',
          tint: '#E8F0EB',
        },
        gold: {
          DEFAULT: '#C4A053',
          soft: '#E8D9B5',
        },
        ink: '#1A1A1A',
        muted: '#6B7280',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)',
      },
      maxWidth: {
        app: '480px',
      },
    },
  },
  plugins: [],
};

export default config;
