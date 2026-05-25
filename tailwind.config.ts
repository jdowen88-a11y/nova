import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}', './functions/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'void-black': '#0F0F1A',
        'deep-space': '#151526',
        'star-white': '#F8FAFC',
        'nebula-gray': '#374151',
        'electric-purple': '#8B5CF6',
        'nebula-pink': '#EC4899',
        'supernova-gold': '#FBBF24',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        'rocket-fly': 'rocket-fly 0.8s ease-in-out infinite alternate',
        'crash-flash': 'crash-flash 0.35s ease-in-out 3',
      },
      keyframes: {
        'rocket-fly': {
          '0%': { transform: 'translateY(0) rotate(-45deg)' },
          '100%': { transform: 'translateY(-6px) rotate(-45deg)' },
        },
        'crash-flash': {
          '0%, 100%': { filter: 'brightness(1)' },
          '50%': { filter: 'brightness(1.8)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
