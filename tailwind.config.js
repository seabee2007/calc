/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Add any custom colors here
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};