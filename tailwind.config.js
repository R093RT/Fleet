/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1a2332',
        amber: '#d4a843',
        surface: '#08090d',
        'surface-raised': '#0f1117',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"SF Mono"', '"Cascadia Code"', 'monospace'],
      },
    },
  },
  plugins: [],
}
