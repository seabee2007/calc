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
      zIndex: {
        modal: '9999',
        'modal-overlay': '9998',
        'planner-drawer': '10050',
        'modal-above-drawer': '10101',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};