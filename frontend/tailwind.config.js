/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Navy — primary
        navy: {
          50: '#eef3f8',
          100: '#d4e1ec',
          200: '#a8c3d8',
          300: '#7a9bb5',
          400: '#4a6d8c',
          500: '#2d4a6f',
          600: '#243b5c',
          700: '#1b2a4a',
          800: '#141f38',
          900: '#0a1628',
          950: '#060e1a',
        },
        // Gold — single accent, used for reference lines and highlights
        gold: {
          50: '#fdf8ee',
          100: '#f8ecbe',
          200: '#f0d98a',
          300: '#e8c55a',
          400: '#d4aa3c',
          500: '#b8932e',
          600: '#997321',
          700: '#7a5c1a',
          800: '#5c4512',
          900: '#3d2e0a',
        },
        // Teal — secondary chart series
        civic: {
          50: '#effcf8',
          100: '#c6f7e2',
          200: '#8eedc7',
          300: '#65d6ad',
          400: '#3ebd93',
          500: '#27ab83',
          600: '#199473',
          700: '#147d64',
          800: '#0c6b58',
          900: '#014d40',
        },
        // Brick — chart series / errors only
        brick: {
          50: '#fef2f2',
          100: '#fde3e3',
          200: '#fbd0d0',
          300: '#f5a3a3',
          400: '#ec6b6b',
          500: '#c53030',
          600: '#a82828',
          700: '#8b2020',
          800: '#6e1a1a',
          900: '#4a1010',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}
