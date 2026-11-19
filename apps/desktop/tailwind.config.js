/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0e0e11',
        surface: '#17171c',
        raised: '#1f1f26',
        line: '#2a2a33',
        fg: '#ececf1',
        mute: '#8b8b98',
        accent: { DEFAULT: '#8b5cf6', hover: '#9d75f8', soft: 'rgba(139,92,246,0.14)' },
        ok: '#34d399',
        danger: '#f87171'
      },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
}
