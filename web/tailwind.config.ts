import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0a1a',
        card: '#16213e',
        sidebar: '#0f1729',
        accent: {
          DEFAULT: '#E5A00D',
          hover: '#d4940c',
          light: '#f5c842',
        },
        surface: {
          DEFAULT: '#1a2540',
          hover: '#1e2d4d',
          border: '#2a3a5c',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
