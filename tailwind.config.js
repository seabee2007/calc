import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#ffffff',
          elevated: '#ffffff',
          muted: '#f8fafc',
        },
        border: {
          DEFAULT: '#e2e8f0',
        },
        canvas: {
          light: '#f8fafc',
          dark: '#020617',
        },
      },
      borderRadius: {
        card: '0.75rem',
        modal: '1rem',
      },
      boxShadow: {
        card: '0 4px 16px rgba(0, 0, 0, 0.1)',
        elevated: '0 8px 32px rgba(0, 0, 0, 0.16)',
      },
      spacing: {
        page: '2rem',
        section: '1.5rem',
        card: '1.25rem',
      },
      zIndex: {
        modal: '9999',
        'modal-overlay': '9998',
        'planner-drawer': '10050',
        'modal-above-drawer': '10101',
      },
    },
  },
  plugins: [
    typography,
  ],
};