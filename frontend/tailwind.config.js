/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: '#1a1a1f',
        'charcoal-light': '#242430',
        'charcoal-lighter': '#2e2e3a',
        'gym-red': '#e85d4a',
        'gym-orange': '#f59e0b',
        'academic-blue': '#3b82f6',
        'habit-green': '#22c55e',
        'quest-purple': '#a855f7',
        'quest-gold': '#eab308',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
        body: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
