/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: '#1a1a1f',
        'charcoal-light': '#242430',
        'charcoal-lighter': '#2e2e3a',
        accent: '#FF4F00',
        'text-primary': '#e5e7eb',
        'text-secondary': '#6b7280',
        'text-muted': '#9ca3af',
      },
      fontFamily: {
        body: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
